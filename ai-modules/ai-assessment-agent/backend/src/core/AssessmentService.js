const { AssessmentError, notFound, forbidden } = require('./errors');
const { LIMITS, validateAssessmentInput, validateQuestionInput } = require('./assessmentValidation');
const { assertAssessmentLmsAdapter } = require('../adapters/lms/AssessmentLmsAdapter');
const { studentQuestionView } = require('./questionTypes');

/**
 * Core assessment rules. LMS-agnostic: all data access goes through the
 * AssessmentLmsAdapter, and the actor always comes from adapter.resolveActor
 * (the authenticated session), never from request data.
 *
 * Rules:
 *   - Only teachers create, read (with answers), edit, publish and unpublish,
 *     and only their OWN assessments in their OWN school. Another teacher's or
 *     another school's assessment is "not found" (existence is not revealed).
 *   - Edits are allowed only while an assessment is a draft. A published
 *     assessment must be unpublished first. (Safe in Step 1 because there are no
 *     student attempts yet; revisit when attempts exist.)
 *   - Publishing requires a target classroom in the same school and at least
 *     one question, and re-checks every stored question.
 *   - Students only list/read PUBLISHED assessments targeted at a classroom
 *     they belong to in their school, and never see which option is correct.
 *   - Migration 008: a test may be published to SELECTED students of its class
 *     (publish body { recipientIds }). No recipients stored = the whole class,
 *     exactly as before; a non-recipient sees nothing ("not found").
 */
const MAX_RECIPIENTS = 500;
class AssessmentService {
  constructor({ adapter, now = () => Date.now() }) {
    this.lms = assertAssessmentLmsAdapter(adapter);
    this.now = now; // Step 5: server clock for window checks at publish time
  }

  // ---- teacher ----

  /** For teacher-only actions that touch no assessment data (e.g. AI generation). */
  assertTeacher(actor) {
    requireTeacher(actor);
  }

  /**
   * Multiple-select and numerical questions need migration 006. Checked BEFORE an AI request
   * (no LLM call for something that could not be saved) and before every write.
   */
  assertQuestionTypeAvailable(type) {
    if (type !== 'single_mcq' && !this.lms.supportsQuestionTypes()) {
      throw new AssessmentError('QUESTION_TYPES_NOT_READY',
        'Multiple-select and numerical questions are not available yet (a database update is pending). Single-answer MCQs work as usual.', { statusCode: 503 });
    }
  }

  listClassrooms(actor) {
    requireTeacher(actor);
    return this.lms.listTeacherClassrooms(actor.universityId, actor.userId).map(classroomView); // only classes this teacher is assigned to
  }

  /** "Assign to" picker: the students of one class in the teacher's school (id + name only). */
  listClassroomStudents(actor, classroomId) {
    requireTeacher(actor);
    const id = toId(classroomId);
    if (!id || !this.lms.getTeacherClassroom(actor.universityId, actor.userId, id)) throw notFound();
    return this.lms.listClassroomStudents(actor.universityId, id).map((s) => ({ id: s.id, name: s.name }));
  }

  createAssessment(actor, input) {
    requireTeacher(actor);
    const fields = validateAssessmentInput(input);
    return this.lms.transaction(() => {
      this.checkClassroom(actor, fields.classroomId);
      const id = this.lms.insertAssessment({ ...fields, universityId: actor.universityId, teacherId: actor.userId });
      return this.detail(actor, this.lms.findAssessment(actor.universityId, id));
    });
  }

  /**
   * Step 2: saves a teacher-REVIEWED set of questions (e.g. edited AI proposals)
   * as ONE new DRAFT, atomically. Same rules as createAssessment + addQuestion:
   * every question passes validateQuestionInput, the class must be in the
   * teacher's school, and nothing is published. Body: { assessment, questions }.
   */
  createAssessmentWithQuestions(actor, body) {
    requireTeacher(actor);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new AssessmentError('VALIDATION_FAILED', 'Send { assessment, questions }.', { details: [{ field: '', code: 'MUST_BE_OBJECT' }] });
    }
    const unknown = Object.keys(body).filter((k) => k !== 'assessment' && k !== 'questions');
    if (unknown.length > 0) {
      throw new AssessmentError('VALIDATION_FAILED', 'Send { assessment, questions }.', { details: unknown.map((field) => ({ field, code: 'UNKNOWN_FIELD' })) });
    }
    const fields = validateAssessmentInput(body.assessment);
    if (fields.classroomId === null || fields.classroomId === undefined) {
      throw new AssessmentError('VALIDATION_FAILED', 'Choose the class for this test.', { details: [{ field: 'assessment.classroomId', code: 'REQUIRED' }] });
    }
    const list = body.questions;
    if (!Array.isArray(list) || list.length === 0 || list.length > LIMITS.questionsPerAssessment) {
      throw new AssessmentError('VALIDATION_FAILED', 'The questions are not valid.', {
        details: [{ field: 'questions', code: Array.isArray(list) && list.length > 0 ? 'TOO_MANY_QUESTIONS' : 'REQUIRED' }],
      });
    }
    const questions = [];
    const details = [];
    list.forEach((q, i) => {
      try {
        questions.push(validateQuestionInput(q));
      } catch (err) {
        if (!(err instanceof AssessmentError)) throw err;
        for (const d of err.details) details.push({ ...d, field: `questions[${i}]${d.field ? '.' + d.field : ''}` });
      }
    });
    if (details.length > 0) throw new AssessmentError('VALIDATION_FAILED', 'Some questions are not valid.', { details });
    for (const q of questions) this.assertQuestionTypeAvailable(q.type);

    return this.lms.transaction(() => {
      this.checkClassroom(actor, fields.classroomId);
      const id = this.lms.insertAssessment({ ...fields, universityId: actor.universityId, teacherId: actor.userId });
      for (const q of questions) this.lms.insertQuestion(id, q);
      return this.detail(actor, this.lms.findAssessment(actor.universityId, id)); // status: 'draft'
    });
  }

  /**
   * Step 2: the class context for an AI generation request, checked against the
   * teacher's school BEFORE anything is sent to an LLM. Returns null when no
   * class was chosen. Reads only; the LLM never receives ids or student data.
   */
  resolveGenerationTarget(actor, classroomId) {
    requireTeacher(actor);
    if (classroomId === null || classroomId === undefined) return null;
    const classroom = this.lms.getTeacherClassroom(actor.universityId, actor.userId, classroomId);
    if (!classroom) {
      throw new AssessmentError('VALIDATION_FAILED', 'The generation request is not valid.', { details: [{ field: 'classroomId', code: 'CLASSROOM_NOT_FOUND' }] });
    }
    return classroomView(classroom);
  }

  listOwnAssessments(actor) {
    requireTeacher(actor);
    return this.lms.listAssessmentsByTeacher(actor.universityId, actor.userId).map((row) => this.summary(actor, row));
  }

  getOwnAssessment(actor, assessmentId) {
    requireTeacher(actor);
    return this.detail(actor, this.findOwn(actor, assessmentId));
  }

  updateAssessment(actor, assessmentId, input) {
    requireTeacher(actor);
    const fields = validateAssessmentInput(input, { partial: true });
    return this.lms.transaction(() => {
      const row = this.findOwnDraft(actor, assessmentId);
      if (fields.classroomId !== undefined) this.checkClassroom(actor, fields.classroomId);
      // Step 5: the window must stay ordered after merging with the stored values.
      const opensAt = fields.opensAt !== undefined ? fields.opensAt : row.opensAt;
      const closesAt = fields.closesAt !== undefined ? fields.closesAt : row.closesAt;
      if (opensAt && closesAt && Date.parse(closesAt) <= Date.parse(opensAt)) {
        throw new AssessmentError('VALIDATION_FAILED', 'The assessment details are not valid.', { details: [{ field: 'closesAt', code: 'CLOSES_BEFORE_OPENS' }] });
      }
      this.lms.updateAssessment(actor.universityId, row.id, fields);
      return this.detail(actor, this.lms.findAssessment(actor.universityId, row.id));
    });
  }

  addQuestion(actor, assessmentId, input) {
    requireTeacher(actor);
    const question = validateQuestionInput(input);
    this.assertQuestionTypeAvailable(question.type);
    return this.lms.transaction(() => {
      const row = this.findOwnDraft(actor, assessmentId);
      if (row.questionCount >= LIMITS.questionsPerAssessment) {
        throw new AssessmentError('TOO_MANY_QUESTIONS', `An assessment can have at most ${LIMITS.questionsPerAssessment} questions.`, { statusCode: 409 });
      }
      this.lms.insertQuestion(row.id, question);
      this.lms.updateAssessment(actor.universityId, row.id, {});
      return this.detail(actor, this.lms.findAssessment(actor.universityId, row.id));
    });
  }

  updateQuestion(actor, assessmentId, questionId, input) {
    requireTeacher(actor);
    const question = validateQuestionInput(input);
    this.assertQuestionTypeAvailable(question.type);
    const qid = toId(questionId);
    return this.lms.transaction(() => {
      const row = this.findOwnDraft(actor, assessmentId);
      if (!qid || !this.lms.replaceQuestion(row.id, qid, question)) throw questionNotFound();
      this.lms.updateAssessment(actor.universityId, row.id, {});
      return this.detail(actor, this.lms.findAssessment(actor.universityId, row.id));
    });
  }

  deleteQuestion(actor, assessmentId, questionId) {
    requireTeacher(actor);
    const qid = toId(questionId);
    return this.lms.transaction(() => {
      const row = this.findOwnDraft(actor, assessmentId);
      if (!qid || !this.lms.deleteQuestion(row.id, qid)) throw questionNotFound();
      this.lms.updateAssessment(actor.universityId, row.id, {});
      return this.detail(actor, this.lms.findAssessment(actor.universityId, row.id));
    });
  }

  /**
   * Publishes to the whole class (no body / no recipientIds), or to SELECTED students of the class
   * ({ recipientIds: [studentId, ...] }, migration 008). Selecting every student of the class is stored as
   * "whole class", so students who join the class later see the test too, as before.
   */
  publish(actor, assessmentId, body = {}) {
    requireTeacher(actor);
    const recipientIds = validatePublishBody(body);
    if (recipientIds && !this.recipientsAvailable()) {
      throw new AssessmentError('RECIPIENTS_NOT_READY', 'Assigning to selected students is not available yet (a database update is pending). Assign to the whole class instead.', { statusCode: 503 });
    }
    return this.lms.transaction(() => {
      const row = this.findOwn(actor, assessmentId);
      if (row.status === 'published') throw new AssessmentError('ALREADY_PUBLISHED', 'This assessment is already published.', { statusCode: 409 });
      const problems = [];
      if (row.classroomId === null) problems.push({ field: 'classroomId', code: 'REQUIRED' });
      else if (!this.lms.getTeacherClassroom(actor.universityId, actor.userId, row.classroomId)) problems.push({ field: 'classroomId', code: 'CLASSROOM_NOT_FOUND' });
      const questions = this.lms.listQuestions(row.id);
      if (questions.length === 0) problems.push({ field: 'questions', code: 'NO_QUESTIONS' });
      if (row.closesAt && Date.parse(row.closesAt) <= this.now()) problems.push({ field: 'closesAt', code: 'CLOSES_IN_PAST' }); // Step 5
      for (const q of questions) {
        try {
          validateQuestionInput(q.type === 'numerical'
            ? { type: q.type, text: q.text, numericAnswer: q.numericAnswer }
            : { type: q.type, text: q.text, options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) });
        } catch (err) {
          problems.push({ field: `questions[${q.position}]`, code: 'INVALID_QUESTION' });
        }
      }
      if (problems.length > 0) throw new AssessmentError('NOT_PUBLISHABLE', 'This assessment cannot be published yet.', { statusCode: 409, details: problems });
      let stored = [];
      if (recipientIds) {
        const roster = new Set(this.lms.listClassroomStudents(actor.universityId, row.classroomId).map((st) => st.id));
        const outside = recipientIds.filter((sid) => !roster.has(sid));
        if (outside.length > 0) {
          throw new AssessmentError('VALIDATION_FAILED', 'Some selected students are not in this class.', { details: outside.map(() => ({ field: 'recipientIds', code: 'NOT_IN_CLASS' })) });
        }
        stored = recipientIds.length === roster.size ? [] : recipientIds; // everyone selected = whole class
      }
      if (this.recipientsAvailable()) this.lms.replaceRecipients(actor.universityId, row.id, stored);
      this.lms.setAssessmentStatus(actor.universityId, row.id, 'published');
      return this.detail(actor, this.lms.findAssessment(actor.universityId, row.id));
    });
  }

  unpublish(actor, assessmentId) {
    requireTeacher(actor);
    return this.lms.transaction(() => {
      const row = this.findOwn(actor, assessmentId);
      if (row.status !== 'published') throw new AssessmentError('NOT_PUBLISHED', 'This assessment is not published.', { statusCode: 409 });
      // Step 3: once students have attempts, the questions they were graded on must not change.
      if (this.lms.countAttempts(row.id) > 0) {
        throw new AssessmentError('ASSESSMENT_HAS_ATTEMPTS', 'Students have already started this test, so it can no longer be unpublished or edited.', { statusCode: 409 });
      }
      this.lms.setAssessmentStatus(actor.universityId, row.id, 'draft');
      return this.detail(actor, this.lms.findAssessment(actor.universityId, row.id));
    });
  }

  // ---- student (read-only, no answers) ----

  listAvailableForStudent(actor) {
    requireStudent(actor);
    const classroomIds = this.lms.getStudentClassroomIds(actor.universityId, actor.userId);
    return this.lms.listPublishedForClassrooms(actor.universityId, classroomIds)
      .filter((row) => this.isRecipient(actor, row))
      .map((row) => this.studentSummary(actor, row));
  }

  getAvailableForStudent(actor, assessmentId) {
    requireStudent(actor);
    const id = toId(assessmentId);
    const row = id ? this.lms.findAssessment(actor.universityId, id) : null;
    if (!row || row.status !== 'published' || !this.lms.getStudentClassroomIds(actor.universityId, actor.userId).includes(row.classroomId)
      || !this.isRecipient(actor, row)) {
      throw notFound();
    }
    return {
      ...this.studentSummary(actor, row),
      questions: this.lms.listQuestions(row.id).map(studentQuestionView), // no isCorrect / numeric answer, ever
    };
  }

  // ---- internals ----

  recipientsAvailable() {
    return typeof this.lms.supportsRecipientsReports === 'function' && this.lms.supportsRecipientsReports();
  }

  /** Migration 008: whole-class test, or the student is one of its selected recipients. */
  isRecipient(actor, row) {
    return typeof this.lms.isAssessmentRecipient !== 'function' || this.lms.isAssessmentRecipient(actor.universityId, row.id, actor.userId);
  }

  /** Teacher view of who the test is assigned to. */
  recipientsView(actor, row) {
    const ids = typeof this.lms.listRecipientIds === 'function' ? this.lms.listRecipientIds(actor.universityId, row.id) : [];
    return ids.length === 0 ? { mode: 'class', studentIds: [] } : { mode: 'selected', studentIds: ids };
  }

  findOwn(actor, assessmentId) {
    const id = toId(assessmentId);
    const row = id ? this.lms.findAssessment(actor.universityId, id) : null;
    if (!row || row.teacherId !== actor.userId) throw notFound();
    return row;
  }

  findOwnDraft(actor, assessmentId) {
    const row = this.findOwn(actor, assessmentId);
    if (row.status !== 'draft') {
      throw new AssessmentError('ASSESSMENT_PUBLISHED', 'A published assessment cannot be edited. Unpublish it first.', { statusCode: 409 });
    }
    return row;
  }

  checkClassroom(actor, classroomId) {
    if (classroomId === null || classroomId === undefined) return;
    if (!this.lms.getTeacherClassroom(actor.universityId, actor.userId, classroomId)) {
      throw new AssessmentError('VALIDATION_FAILED', 'The assessment details are not valid.', { details: [{ field: 'classroomId', code: 'CLASSROOM_NOT_FOUND' }] });
    }
  }

  summary(actor, row) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      subject: row.subject,
      classroomId: row.classroomId,
      classroom: row.classroomId === null ? null : classroomView(this.lms.getClassroom(actor.universityId, row.classroomId)),
      durationMinutes: row.durationMinutes,
      status: row.status,
      questionCount: row.questionCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
      opensAt: row.opensAt ?? null, // Step 5 window
      closesAt: row.closesAt ?? null,
      closedAt: row.closedAt ?? null,
      recipients: this.recipientsView(actor, row), // migration 008; { mode: 'class' } before it
    };
  }

  /** The picture key of ONE question of a test this student may see (404 otherwise, or when it has no picture). */
  questionImageForStudent(actor, assessmentId, questionId) {
    const visible = this.getAvailableForStudent(actor, assessmentId); // school, class, published, recipient
    const qid = toId(questionId);
    const question = qid ? this.lms.listQuestions(visible.id).find((q) => q.id === qid) : null;
    if (!question || !question.imageKey) throw notFound();
    return question.imageKey;
  }

  detail(actor, row) {
    return { ...this.summary(actor, row), questions: this.lms.listQuestions(row.id) };
  }

  studentSummary(actor, row) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      subject: row.subject,
      classroom: classroomView(this.lms.getClassroom(actor.universityId, row.classroomId)),
      durationMinutes: row.durationMinutes,
      questionCount: row.questionCount,
      publishedAt: row.publishedAt,
      opensAt: row.opensAt ?? null, // Step 5 window (the list adds a computed availability)
      closesAt: row.closesAt ?? null,
      closedAt: row.closedAt ?? null,
    };
  }
}

function requireTeacher(actor) {
  if (!actor || actor.kind !== 'teacher') throw forbidden('Only teachers can manage assessments.');
}

function requireStudent(actor) {
  if (!actor || actor.kind !== 'student') throw forbidden('Only students can view assigned assessments.');
}

/** Publish body: {} (whole class) or { recipientIds: [distinct student ids] }. Returns the ids or null. */
function validatePublishBody(body) {
  if (body === undefined || body === null) return null;
  if (typeof body !== 'object' || Array.isArray(body)) throw new AssessmentError('INVALID_REQUEST', 'Request body must be a JSON object.');
  const unknown = Object.keys(body).filter((k) => k !== 'recipientIds');
  if (unknown.length > 0) {
    throw new AssessmentError('VALIDATION_FAILED', 'The assignment is not valid.', { details: unknown.map((field) => ({ field, code: 'UNKNOWN_FIELD' })) });
  }
  if (body.recipientIds === undefined) return null;
  const list = body.recipientIds;
  const bad = (code) => new AssessmentError('VALIDATION_FAILED', 'The assignment is not valid.', { details: [{ field: 'recipientIds', code }] });
  if (!Array.isArray(list) || list.length === 0) throw bad('SELECT_AT_LEAST_ONE');
  if (list.length > MAX_RECIPIENTS) throw bad('TOO_MANY');
  if (!list.every((v) => Number.isInteger(v) && v >= 1)) throw bad('INVALID_ID');
  if (new Set(list).size !== list.length) throw bad('DUPLICATE');
  return [...list].sort((a, b) => a - b);
}

function toId(v) {
  const n = typeof v === 'string' && /^\d{1,15}$/.test(v) ? Number(v) : v;
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function classroomView(c) {
  return c ? { id: c.id, name: c.name, grade: c.grade, section: c.section ?? null } : null;
}

function questionNotFound() {
  return new AssessmentError('QUESTION_NOT_FOUND', 'Question not found.', { statusCode: 404 });
}

module.exports = { AssessmentService };
