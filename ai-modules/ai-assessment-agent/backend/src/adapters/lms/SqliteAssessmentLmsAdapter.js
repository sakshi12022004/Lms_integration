const fs = require('fs');
const { AssessmentError, forbidden } = require('../../core/errors');
const { assignmentMethods } = require('./sqliteAssignmentStore'); // Descriptive Assignments (migration 007)
const { recipientsReportsMethods } = require('./sqliteRecipientsReportsStore'); // recipients + shared reports (migration 008)

/**
 * AssessmentLmsAdapter for THIS LMS: the SQLite database at
 * server/data/lms_permanent.db, via Node's built-in node:sqlite (Node 22.5+).
 *
 * LMS facts this adapter encodes (checked against the live schema, read-only):
 *   - users(id, role, university_id): teachers have role 'mentor' (the client
 *     also treats 'teacher' as a teacher); students have role 'student'.
 *   - classrooms(id, university_id, name, grade, section) is the "class".
 *   - student_classroom_assignment(studentId, classroomId) is the membership
 *     the LMS reads (users.classroom_id is unused).
 * It only READS those tables. It writes only the module's aia_* tables.
 */
const TEACHER_ROLES = Object.freeze(['mentor', 'teacher']);
// The teacher runs the classroom or teaches a course in it. Binds the teacher id four times.
const TEACHES_CLASSROOM = `(
  CAST(c.classTeacher AS INTEGER) = ? OR c.classTeacherId = ?
  OR EXISTS (SELECT 1 FROM classroomAssignments ca WHERE ca.classroomId = c.id AND ca.teacherId = ?)
  OR EXISTS (SELECT 1 FROM courses co WHERE co.classroomId = c.id AND co.mentorId = ?)
)`;
const STUDENT_ROLES = Object.freeze(['student']);
// 001 + 003 (attempts). The module is "ready" only when every migration is applied.
const MODULE_TABLES = Object.freeze(['aia_assessments', 'aia_questions', 'aia_options', 'aia_attempts', 'aia_attempt_answers', 'aia_attempt_archive']);

const ATTEMPT_COLUMNS = `
  id, university_id AS universityId, assessment_id AS assessmentId, student_id AS studentId, status,
  started_at AS startedAt, deadline_at AS deadlineAt, finished_at AS finishedAt,
  total_questions AS totalQuestions, attempted, correct, incorrect, unattempted, score, percentage`;
const STEP2_QUESTION_COLUMNS = Object.freeze(['explanation', 'difficulty']); // migration 002
const STEP5_ASSESSMENT_COLUMNS = Object.freeze(['opens_at', 'closes_at', 'closed_at']); // migration 004
// Migration 006 (question types) is OPTIONAL for readiness: without it the module runs exactly as
// before (single-answer MCQ only) and refuses the new types (see supportsQuestionTypes).
const TYPES_NOT_READY = () => new AssessmentError('QUESTION_TYPES_NOT_READY',
  'Multiple-select and numerical questions are not available yet (a database update is pending). Single-answer MCQs work as usual.', { statusCode: 503 });

const ASSESSMENT_COLUMNS = `
  a.id, a.university_id AS universityId, a.teacher_id AS teacherId, a.title, a.description, a.subject,
  a.classroom_id AS classroomId, a.duration_minutes AS durationMinutes, a.status,
  a.created_at AS createdAt, a.updated_at AS updatedAt, a.published_at AS publishedAt,
  a.opens_at AS opensAt, a.closes_at AS closesAt, a.closed_at AS closedAt,
  (SELECT COUNT(*) FROM aia_questions q WHERE q.assessment_id = a.id) AS questionCount`;

const EDITABLE = Object.freeze({
  title: 'title',
  description: 'description',
  subject: 'subject',
  classroomId: 'classroom_id',
  durationMinutes: 'duration_minutes',
  opensAt: 'opens_at',
  closesAt: 'closes_at',
});

function positiveInt(v) {
  const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/** Wraps an open DatabaseSync connection. The caller owns the connection. */
function createSqliteAssessmentLmsAdapter(db) {
  const plain = (row) => (row ? { ...row } : row);
  let typesSupported; // cached per connection

  let imagesSupported;
  /** Stores (or clears) the question's picture key when migration 009 is applied. */
  const setQuestionImage = (questionId, question) => {
    if (!adapter.supportsQuestionImages()) return;
    db.prepare('UPDATE aia_questions SET image_key = ? WHERE id = ?').run(question.imageKey ?? null, questionId);
  };

  const adapter = {
    // ---- LMS directory ----

    resolveActor(sessionUser) {
      const userId = positiveInt(sessionUser && sessionUser.userId);
      const universityId = positiveInt(sessionUser && sessionUser.universityId);
      if (!userId || !universityId) throw forbidden();
      const user = db.prepare('SELECT id, role, university_id FROM users WHERE id = ?').get(userId);
      if (!user || positiveInt(user.university_id) !== universityId || !db.prepare('SELECT id FROM universities WHERE id = ?').get(universityId)) {
        throw new AssessmentError('TENANT_MISMATCH', 'Your account does not match this school.', { statusCode: 403 });
      }
      // The LMS database decides the role, not the token (a demoted teacher loses access at once).
      const kind = TEACHER_ROLES.includes(user.role) ? 'teacher' : STUDENT_ROLES.includes(user.role) ? 'student' : null;
      if (!kind) throw forbidden();
      return Object.freeze({ userId, universityId, kind });
    },

    getClassroom(universityId, classroomId) {
      return plain(db.prepare('SELECT id, name, grade, section FROM classrooms WHERE id = ? AND university_id = ?').get(classroomId, universityId)) || null;
    },

    listClassrooms(universityId) {
      return db.prepare('SELECT id, name, grade, section FROM classrooms WHERE university_id = ? ORDER BY grade, section, name, id').all(universityId).map(plain);
    },

    /**
     * The classrooms of the school that THIS teacher may use: class teacher, listed in
     * classroomAssignments, or teaching a course there (the LMS's own teaching relationships).
     */
    listTeacherClassrooms(universityId, teacherId) {
      return db.prepare(`SELECT c.id, c.name, c.grade, c.section FROM classrooms c
                         WHERE c.university_id = ? AND ${TEACHES_CLASSROOM}
                         ORDER BY c.grade, c.section, c.name, c.id`)
        .all(universityId, teacherId, teacherId, teacherId, teacherId).map(plain);
    },

    /** One classroom, only if this teacher may use it (same rule as listTeacherClassrooms); else null. */
    getTeacherClassroom(universityId, teacherId, classroomId) {
      return plain(db.prepare(`SELECT c.id, c.name, c.grade, c.section FROM classrooms c
                               WHERE c.id = ? AND c.university_id = ? AND ${TEACHES_CLASSROOM}`)
        .get(classroomId, universityId, teacherId, teacherId, teacherId, teacherId)) || null;
    },

    getStudentClassroomIds(universityId, userId) {
      return db
        .prepare(`SELECT DISTINCT c.id FROM student_classroom_assignment sca
                  JOIN classrooms c ON c.id = sca.classroomId
                  WHERE sca.studentId = ? AND c.university_id = ?`)
        .all(userId, universityId)
        .map((r) => r.id);
    },

    /** Step 3: students of one class in the school (for the teacher report roster). */
    listClassroomStudents(universityId, classroomId) {
      return db
        .prepare(`SELECT DISTINCT u.id, u.name FROM student_classroom_assignment sca
                  JOIN classrooms c ON c.id = sca.classroomId
                  JOIN users u ON u.id = sca.studentId
                  WHERE sca.classroomId = ? AND c.university_id = ? AND u.university_id = ? AND u.role = 'student'
                  ORDER BY u.name, u.id`)
        .all(classroomId, universityId, universityId)
        .map(plain);
    },

    /** Performance Analyst (read-only): a STUDENT of this school, or null (other school / not a student). */
    getSchoolStudent(universityId, studentId) {
      return plain(db
        .prepare("SELECT id, name FROM users WHERE id = ? AND university_id = ? AND role = 'student'")
        .get(studentId, universityId)) || null;
    },

    /** Performance Analyst (read-only): the student's classes in this school, with the date they were added. */
    listStudentMemberships(universityId, studentId) {
      return db
        .prepare(`SELECT c.id AS classroomId, c.name, c.grade, c.section, sca.createdAt AS joinedAt
                  FROM student_classroom_assignment sca JOIN classrooms c ON c.id = sca.classroomId
                  WHERE sca.studentId = ? AND c.university_id = ? ORDER BY c.id`)
        .all(studentId, universityId)
        .map(plain);
    },

    /** Step 3: display names of users in the school (id -> name); other schools' users are omitted. */
    getUserNames(universityId, userIds) {
      if (userIds.length === 0) return new Map();
      const rows = db
        .prepare(`SELECT id, name FROM users WHERE university_id = ? AND id IN (${userIds.map(() => '?').join(', ')})`)
        .all(universityId, ...userIds);
      return new Map(rows.map((r) => [r.id, r.name]));
    },

    // ---- assessment store ----

    isReady() {
      const found = db
        .prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN (${MODULE_TABLES.map(() => '?').join(', ')})`)
        .get(...MODULE_TABLES).n;
      if (found !== MODULE_TABLES.length) return false;
      const columns = db.prepare('PRAGMA table_info(aia_questions)').all().map((c) => c.name);
      const assessmentColumns = db.prepare('PRAGMA table_info(aia_assessments)').all().map((c) => c.name);
      return STEP2_QUESTION_COLUMNS.every((c) => columns.includes(c)) && STEP5_ASSESSMENT_COLUMNS.every((c) => assessmentColumns.includes(c));
    },

    /** Migration 009 applied: optional picture per question. Without it questions simply have no picture. */
    supportsQuestionImages() {
      if (imagesSupported === undefined) {
        imagesSupported = db.prepare('PRAGMA table_info(aia_questions)').all().some((c) => c.name === 'image_key');
      }
      return imagesSupported;
    },

    /** Migration 006 applied: question types + aia_attempt_responses. */
    supportsQuestionTypes() {
      if (typesSupported === undefined) {
        typesSupported = db.prepare('PRAGMA table_info(aia_questions)').all().some((c) => c.name === 'question_type')
          && !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'aia_attempt_responses'").get();
      }
      return typesSupported;
    },

    transaction(fn) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    insertAssessment(row) {
      return Number(db
        .prepare(`INSERT INTO aia_assessments (university_id, teacher_id, title, description, subject, classroom_id, duration_minutes, opens_at, closes_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(row.universityId, row.teacherId, row.title, row.description, row.subject, row.classroomId, row.durationMinutes, row.opensAt ?? null, row.closesAt ?? null)
        .lastInsertRowid);
    },

    updateAssessment(universityId, id, fields) {
      const keys = Object.keys(fields).filter((k) => EDITABLE[k]);
      const sets = keys.map((k) => `${EDITABLE[k]} = ?`).concat('updated_at = CURRENT_TIMESTAMP');
      db.prepare(`UPDATE aia_assessments SET ${sets.join(', ')} WHERE id = ? AND university_id = ?`).run(...keys.map((k) => fields[k]), id, universityId);
    },

    setAssessmentStatus(universityId, id, status) {
      // Back to draft also clears a manual close (Step 5): a draft is never "closed".
      db.prepare(`UPDATE aia_assessments
                  SET status = ?, published_at = CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END,
                      closed_at = CASE WHEN ? = 'draft' THEN NULL ELSE closed_at END, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ? AND university_id = ?`).run(status, status, status, id, universityId);
    },

    /** Step 5: marks a published test closed (server time). Returns false if already closed / not found. */
    closeAssessment(universityId, id, closedAt) {
      return db
        .prepare(`UPDATE aia_assessments SET closed_at = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ? AND university_id = ? AND status = 'published' AND closed_at IS NULL`)
        .run(closedAt, id, universityId).changes === 1;
    },

    findAssessment(universityId, id) {
      return plain(db.prepare(`SELECT ${ASSESSMENT_COLUMNS} FROM aia_assessments a WHERE a.id = ? AND a.university_id = ?`).get(id, universityId)) || null;
    },

    listAssessmentsByTeacher(universityId, teacherId) {
      return db
        .prepare(`SELECT ${ASSESSMENT_COLUMNS} FROM aia_assessments a WHERE a.university_id = ? AND a.teacher_id = ? ORDER BY a.updated_at DESC, a.id DESC`)
        .all(universityId, teacherId)
        .map(plain);
    },

    listPublishedForClassrooms(universityId, classroomIds) {
      if (classroomIds.length === 0) return [];
      return db
        .prepare(`SELECT ${ASSESSMENT_COLUMNS} FROM aia_assessments a
                  WHERE a.university_id = ? AND a.status = 'published' AND a.classroom_id IN (${classroomIds.map(() => '?').join(', ')})
                  ORDER BY a.published_at DESC, a.id DESC`)
        .all(universityId, ...classroomIds)
        .map(plain);
    },

    /**
     * [{ id, position, type, text, explanation, difficulty, options: [{ position, text, isCorrect }],
     *    numericAnswer: { format, value } | null }]. Before migration 006 every question is single_mcq.
     */
    listQuestions(assessmentId) {
      const typed = adapter.supportsQuestionTypes();
      const questions = db
        .prepare(`SELECT id, position, text, explanation, difficulty${typed ? ', question_type, numeric_answer, numeric_format' : ''}${adapter.supportsQuestionImages() ? ', image_key' : ''}
                  FROM aia_questions WHERE assessment_id = ? ORDER BY position, id`)
        .all(assessmentId);
      const optionsOf = db.prepare('SELECT position, text, is_correct FROM aia_options WHERE question_id = ? ORDER BY position');
      return questions.map((q) => ({
        id: q.id,
        position: q.position,
        type: typed ? q.question_type : 'single_mcq',
        text: q.text,
        explanation: q.explanation,
        difficulty: q.difficulty ?? null,
        options: optionsOf.all(q.id).map((o) => ({ position: o.position, text: o.text, isCorrect: o.is_correct === 1 })),
        numericAnswer: typed && q.question_type === 'numerical' && q.numeric_answer !== null ? { format: q.numeric_format, value: q.numeric_answer } : null,
        imageKey: q.image_key ?? null,
      }));
    },

    insertQuestion(assessmentId, question) {
      const type = typeOf(question);
      const { next } = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM aia_questions WHERE assessment_id = ?').get(assessmentId);
      const id = adapter.supportsQuestionTypes()
        ? Number(db
          .prepare('INSERT INTO aia_questions (assessment_id, position, text, explanation, difficulty, question_type, numeric_answer, numeric_format) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(assessmentId, next, question.text, question.explanation ?? '', question.difficulty ?? null, type, ...numericOf(question)).lastInsertRowid)
        : Number(db
          .prepare('INSERT INTO aia_questions (assessment_id, position, text, explanation, difficulty) VALUES (?, ?, ?, ?, ?)')
          .run(assessmentId, next, question.text, question.explanation ?? '', question.difficulty ?? null).lastInsertRowid);
      insertOptions(id, type === 'numerical' ? [] : question.options);
      setQuestionImage(id, question);
      return id;
    },

    replaceQuestion(assessmentId, questionId, question) {
      const type = typeOf(question);
      const changed = adapter.supportsQuestionTypes()
        ? db
          .prepare(`UPDATE aia_questions SET text = ?, explanation = ?, difficulty = ?, question_type = ?, numeric_answer = ?, numeric_format = ?,
                      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND assessment_id = ?`)
          .run(question.text, question.explanation ?? '', question.difficulty ?? null, type, ...numericOf(question), questionId, assessmentId).changes
        : db
          .prepare('UPDATE aia_questions SET text = ?, explanation = ?, difficulty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND assessment_id = ?')
          .run(question.text, question.explanation ?? '', question.difficulty ?? null, questionId, assessmentId).changes;
      if (changed === 0) return false;
      db.prepare('DELETE FROM aia_options WHERE question_id = ?').run(questionId);
      insertOptions(questionId, type === 'numerical' ? [] : question.options);
      setQuestionImage(questionId, question);
      return true;
    },

    deleteQuestion(assessmentId, questionId) {
      const row = db.prepare('SELECT position FROM aia_questions WHERE id = ? AND assessment_id = ?').get(questionId, assessmentId);
      if (!row) return false;
      db.prepare('DELETE FROM aia_options WHERE question_id = ?').run(questionId); // explicit: do not rely on PRAGMA foreign_keys
      db.prepare('DELETE FROM aia_questions WHERE id = ?').run(questionId);
      db.prepare('UPDATE aia_questions SET position = position - 1 WHERE assessment_id = ? AND position > ?').run(assessmentId, row.position);
      return true;
    },

    // ---- attempts (Step 3, migration 003) ----

    insertAttempt({ universityId, assessmentId, studentId, startedAt, deadlineAt }) {
      return Number(db
        .prepare('INSERT INTO aia_attempts (university_id, assessment_id, student_id, started_at, deadline_at) VALUES (?, ?, ?, ?, ?)')
        .run(universityId, assessmentId, studentId, startedAt, deadlineAt).lastInsertRowid);
    },

    findAttempt(universityId, attemptId) {
      return plain(db.prepare(`SELECT ${ATTEMPT_COLUMNS} FROM aia_attempts WHERE id = ? AND university_id = ?`).get(attemptId, universityId)) || null;
    },

    findAttemptFor(universityId, assessmentId, studentId) {
      return plain(db
        .prepare(`SELECT ${ATTEMPT_COLUMNS} FROM aia_attempts WHERE university_id = ? AND assessment_id = ? AND student_id = ?`)
        .get(universityId, assessmentId, studentId)) || null;
    },

    listAttemptsForAssessment(universityId, assessmentId) {
      return db.prepare(`SELECT ${ATTEMPT_COLUMNS} FROM aia_attempts WHERE university_id = ? AND assessment_id = ? ORDER BY id`).all(universityId, assessmentId).map(plain);
    },

    listAttemptsForStudent(universityId, studentId) {
      return db.prepare(`SELECT ${ATTEMPT_COLUMNS} FROM aia_attempts WHERE university_id = ? AND student_id = ? ORDER BY id`).all(universityId, studentId).map(plain);
    },

    /** Current AND archived (reset) attempts: any attempt ever keeps the test locked (Step 3 + Step 6). */
    countAttempts(assessmentId) {
      const current = db.prepare('SELECT COUNT(*) AS n FROM aia_attempts WHERE assessment_id = ?').get(assessmentId).n;
      const archived = db.prepare('SELECT COUNT(*) AS n FROM aia_attempt_archive WHERE assessment_id = ?').get(assessmentId).n;
      return current + archived;
    },

    // ---- attempt archive (Step 6, migration 005) ----

    /**
     * Moves a FINISHED current attempt into the archive and removes it (and its answers)
     * from aia_attempts, so the student can start fresh. Caller runs this in a transaction.
     */
    archiveAttempt(attempt, { answers, resetBy, resetAt }) {
      db.prepare(`INSERT INTO aia_attempt_archive (original_attempt_id, university_id, assessment_id, student_id, status, started_at,
                    deadline_at, finished_at, total_questions, attempted, correct, incorrect, unattempted, score, percentage,
                    answers_json, reset_by, reset_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(attempt.id, attempt.universityId, attempt.assessmentId, attempt.studentId, attempt.status, attempt.startedAt,
          attempt.deadlineAt, attempt.finishedAt, attempt.totalQuestions, attempt.attempted, attempt.correct, attempt.incorrect,
          attempt.unattempted, attempt.score, attempt.percentage, JSON.stringify(answers), resetBy, resetAt);
      db.prepare('DELETE FROM aia_attempt_answers WHERE attempt_id = ?').run(attempt.id); // explicit: do not rely on PRAGMA foreign_keys
      if (adapter.supportsQuestionTypes()) db.prepare('DELETE FROM aia_attempt_responses WHERE attempt_id = ?').run(attempt.id);
      db.prepare('DELETE FROM aia_attempts WHERE id = ? AND university_id = ?').run(attempt.id, attempt.universityId);
    },

    /** Archived attempts of one test (oldest first), same school only. */
    listArchivedAttempts(universityId, assessmentId) {
      return db
        .prepare(`SELECT id, original_attempt_id AS originalAttemptId, student_id AS studentId, status, started_at AS startedAt,
                    finished_at AS finishedAt, total_questions AS totalQuestions, attempted, correct, incorrect, unattempted,
                    score, percentage, reset_by AS resetBy, reset_at AS resetAt
                  FROM aia_attempt_archive WHERE university_id = ? AND assessment_id = ? ORDER BY id`)
        .all(universityId, assessmentId)
        .map(plain);
    },

    countArchivedAttemptsFor(universityId, assessmentId, studentId) {
      return db
        .prepare('SELECT COUNT(*) AS n FROM aia_attempt_archive WHERE university_id = ? AND assessment_id = ? AND student_id = ?')
        .get(universityId, assessmentId, studentId).n;
    },

    /** Saves (position 0-3) or clears (null) one answer. The caller has checked ownership/state/validity. */
    saveAnswer(attemptId, questionId, optionPosition) {
      if (optionPosition === null) {
        db.prepare('DELETE FROM aia_attempt_answers WHERE attempt_id = ? AND question_id = ?').run(attemptId, questionId);
        return;
      }
      db.prepare(`INSERT INTO aia_attempt_answers (attempt_id, question_id, option_position) VALUES (?, ?, ?)
                  ON CONFLICT (attempt_id, question_id) DO UPDATE SET option_position = excluded.option_position, updated_at = CURRENT_TIMESTAMP`)
        .run(attemptId, questionId, optionPosition);
    },

    /**
     * Migration 006: saves ({ selectedPositions: [sorted positions] } | { numericValue: canonical text })
     * or clears (null) one answer to a multiple-select / numerical question. The caller has checked
     * ownership, state and validity.
     */
    saveResponse(attemptId, questionId, response) {
      if (!adapter.supportsQuestionTypes()) throw TYPES_NOT_READY();
      if (response === null) {
        db.prepare('DELETE FROM aia_attempt_responses WHERE attempt_id = ? AND question_id = ?').run(attemptId, questionId);
        return;
      }
      const selected = response.selectedPositions ? JSON.stringify(response.selectedPositions) : null;
      const numeric = selected === null ? response.numericValue : null;
      db.prepare(`INSERT INTO aia_attempt_responses (attempt_id, question_id, selected_positions, numeric_value) VALUES (?, ?, ?, ?)
                  ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected_positions = excluded.selected_positions,
                    numeric_value = excluded.numeric_value, updated_at = CURRENT_TIMESTAMP`)
        .run(attemptId, questionId, selected, numeric);
    },

    /**
     * Single-answer MCQ rows (aia_attempt_answers): { questionId, optionPosition, isCorrect } - exactly the
     * pre-006 shape (it is also the reset-archive snapshot format). Migration-006 rows:
     * { questionId, optionPositions, isCorrect } (multiple-select) or { questionId, value, isCorrect } (numerical).
     * isCorrect is null until graded.
     */
    listAnswers(attemptId) {
      const bit = (v) => (v === null ? null : v === 1);
      const single = db
        .prepare('SELECT question_id AS questionId, option_position AS optionPosition, is_correct AS isCorrect FROM aia_attempt_answers WHERE attempt_id = ?')
        .all(attemptId)
        .map((r) => ({ questionId: r.questionId, optionPosition: r.optionPosition, isCorrect: bit(r.isCorrect) }));
      if (!adapter.supportsQuestionTypes()) return single;
      const typed = db
        .prepare('SELECT question_id AS questionId, selected_positions AS selected, numeric_value AS value, is_correct AS isCorrect FROM aia_attempt_responses WHERE attempt_id = ?')
        .all(attemptId)
        .map((r) => (r.selected !== null
          ? { questionId: r.questionId, optionPositions: JSON.parse(r.selected), isCorrect: bit(r.isCorrect) }
          : { questionId: r.questionId, value: r.value, isCorrect: bit(r.isCorrect) }));
      return [...single, ...typed];
    },

    /**
     * Finalizes ONLY an in-progress attempt (returns false if it was already
     * finalized: the first finalization wins). Grades are written per answer.
     */
    finalizeAttempt(attemptId, { status, finishedAt, result, gradedAnswers }) {
      const changed = db
        .prepare(`UPDATE aia_attempts SET status = ?, finished_at = ?, total_questions = ?, attempted = ?, correct = ?, incorrect = ?,
                    unattempted = ?, score = ?, percentage = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ? AND status = 'in_progress'`)
        .run(status, finishedAt, result.totalQuestions, result.attempted, result.correct, result.incorrect,
          result.unattempted, result.score, result.percentage, attemptId).changes;
      if (changed === 0) return false;
      const mark = db.prepare('UPDATE aia_attempt_answers SET is_correct = ? WHERE attempt_id = ? AND question_id = ?');
      const markTyped = adapter.supportsQuestionTypes() ? db.prepare('UPDATE aia_attempt_responses SET is_correct = ? WHERE attempt_id = ? AND question_id = ?') : null;
      for (const a of gradedAnswers) {
        mark.run(a.isCorrect ? 1 : 0, attemptId, a.questionId);
        if (markTyped) markTyped.run(a.isCorrect ? 1 : 0, attemptId, a.questionId);
      }
      return true;
    },
  };

  /** New types need migration 006; before it, only single_mcq can be written. */
  function typeOf(question) {
    const type = question.type || 'single_mcq';
    if (type !== 'single_mcq' && !adapter.supportsQuestionTypes()) throw TYPES_NOT_READY();
    return type;
  }

  const numericOf = (question) => (question.numericAnswer ? [question.numericAnswer.value, question.numericAnswer.format] : [null, null]);

  function insertOptions(questionId, options) {
    const stmt = db.prepare('INSERT INTO aia_options (question_id, position, text, is_correct) VALUES (?, ?, ?, ?)');
    options.forEach((o, i) => stmt.run(questionId, i, o.text, o.isCorrect ? 1 : 0));
  }

  Object.assign(adapter, assignmentMethods(db)); // Descriptive Assignments: remove this line to remove the feature
  Object.assign(adapter, recipientsReportsMethods(db)); // migration 008: student recipients + shared AI reports
  return adapter;
}

/**
 * Opens the LMS database for one request and returns { adapter, close }.
 * A missing database file is reported as not ready (never created here).
 */
function openSqliteAssessmentLmsAdapter(dbPath) {
  if (!fs.existsSync(dbPath)) {
    throw new AssessmentError('NOT_READY', 'Assessments are not available yet.', { statusCode: 503 });
  }
  let DatabaseSync;
  try {
    DatabaseSync = require('node:sqlite').DatabaseSync;
  } catch (e) {
    DatabaseSync = require('better-sqlite3');
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA busy_timeout = 5000'); // the LMS's own sqlite3 connection shares this file
  return { adapter: createSqliteAssessmentLmsAdapter(db), close: () => db.close() };
}

module.exports = { createSqliteAssessmentLmsAdapter, openSqliteAssessmentLmsAdapter, TEACHER_ROLES, STUDENT_ROLES, MODULE_TABLES };
