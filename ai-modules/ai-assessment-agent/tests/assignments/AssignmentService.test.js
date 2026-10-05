// Descriptive Assignments: rules through the real service + SQLite adapter (in-memory, migrations 001-007).
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { IDS, createLmsTestDb } = require('../helpers/lmsTestDb');
const { createSqliteAssessmentLmsAdapter } = require('../../backend/src/adapters/lms/SqliteAssessmentLmsAdapter');
const { AssignmentService } = require('../../backend/src/assignments/AssignmentService');

const T1 = { userId: IDS.teacher1, universityId: IDS.school1, kind: 'teacher' };
const T2 = { userId: IDS.teacher2, universityId: IDS.school1, kind: 'teacher' };
const T3 = { userId: IDS.teacher3, universityId: IDS.school2, kind: 'teacher' };
const S1 = { userId: IDS.student1, universityId: IDS.school1, kind: 'student' }; // class 10
const S2 = { userId: IDS.student2, universityId: IDS.school1, kind: 'student' }; // class 11
const S3 = { userId: IDS.student3, universityId: IDS.school2, kind: 'student' }; // school 2
const T0 = Date.parse('2026-10-01T09:00:00.000Z');
const code = (fn) => { try { fn(); } catch (err) { return err.code; } assert.fail('expected an error'); };
const details = (fn) => { try { fn(); } catch (err) { return err.details.map((d) => `${d.field}:${d.code}`); } assert.fail('expected an error'); };

let db, svc, clock, keyN;
beforeEach(() => {
  db = createLmsTestDb();
  db.exec("INSERT INTO users (id, name, email, password, role, university_id) VALUES (40, 'Second Student', 's40@s1.test', 'x', 'student', 1)");
  db.exec('INSERT INTO student_classroom_assignment (studentId, classroomId) VALUES (40, 10)');
  clock = T0;
  keyN = 0;
  svc = new AssignmentService({ adapter: createSqliteAssessmentLmsAdapter(db), now: () => clock });
});

const QUESTIONS = [{ text: 'Explain photosynthesis.', maxMarks: 6 }, { text: 'Compare mitosis and meiosis.', maxMarks: 4 }];
const draft = (over = {}) => svc.create(T1, { title: 'Biology essay', instructions: 'Answer in full sentences.', classroomId: IDS.class10, maxMarks: 10, ...over });
function published(over = {}) {
  const a = draft(over);
  svc.replaceQuestions(T1, a.id, { questions: QUESTIONS });
  return svc.publish(T1, a.id);
}
const file = () => ({ storageKey: `0000000${keyN}-0000-4000-8000-00000000000${keyN++}.pdf`, originalFilename: 'answer.pdf', size: 1234, sha256: 'a'.repeat(64) });

describe('teacher: create, validate, edit drafts', () => {
  it('creates a draft owned by the session teacher in the session school (server-derived identity)', () => {
    const a = draft();
    assert.deepEqual([a.status, a.maxMarks, a.classroom.name, a.questionCount], ['draft', 10, 'Grade 10 - A', 0]);
    const row = db.prepare('SELECT university_id, teacher_id, classroom_id, status FROM aia_assignments WHERE id = ?').get(a.id);
    assert.deepEqual({ ...row }, { university_id: 1, teacher_id: 1, classroom_id: 10, status: 'draft' });
  });

  it('validation: required fields, ranges, due date format; forged owner/school/status/student fields are rejected', () => {
    assert.deepEqual(details(() => svc.create(T1, {})), ['title:REQUIRED', 'classroomId:REQUIRED', 'maxMarks:OUT_OF_RANGE']);
    assert.ok(details(() => draft({ maxMarks: 0 })).includes('maxMarks:OUT_OF_RANGE'));
    assert.ok(details(() => draft({ maxMarks: 12.5 })).includes('maxMarks:OUT_OF_RANGE'));
    assert.ok(details(() => draft({ dueAt: '2026-10-05 10:00' })).includes('dueAt:INVALID_DATETIME'));
    for (const forged of ['teacherId', 'ownerId', 'universityId', 'schoolId', 'status', 'studentId', 'id']) {
      assert.deepEqual(details(() => draft({ [forged]: 99 })), [`${forged}:UNKNOWN_FIELD`], forged);
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM aia_assignments').get().n, 0);
  });

  it('class must be in the teacher\'s school (another school\'s class id is refused)', () => {
    assert.deepEqual(details(() => draft({ classroomId: IDS.class20 })), ['classroomId:CLASSROOM_NOT_FOUND']);
    const a = draft();
    assert.deepEqual(details(() => svc.update(T1, a.id, { classroomId: IDS.class20 })), ['classroomId:CLASSROOM_NOT_FOUND']);
  });

  it('draft editing: details and questions (add, edit, remove, reorder by replacing the list)', () => {
    const a = draft();
    assert.equal(svc.update(T1, a.id, { title: 'Renamed', dueAt: '2026-10-10T17:00:00+05:30' }).dueAt, '2026-10-10T11:30:00.000Z');
    let d = svc.replaceQuestions(T1, a.id, { questions: [...QUESTIONS, { text: 'Third', maxMarks: 1 }] });
    assert.deepEqual(d.questions.map((q) => [q.position, q.text]), [[1, 'Explain photosynthesis.'], [2, 'Compare mitosis and meiosis.'], [3, 'Third']]);
    d = svc.replaceQuestions(T1, a.id, { questions: [QUESTIONS[1], QUESTIONS[0]] }); // remove + reorder
    assert.deepEqual(d.questions.map((q) => q.text), ['Compare mitosis and meiosis.', 'Explain photosynthesis.']);
    assert.deepEqual([d.questionCount, d.questionMarksTotal], [2, 10]);
    assert.ok(details(() => svc.replaceQuestions(T1, a.id, { questions: [{ text: '', maxMarks: 0, id: 3 }] })).includes('questions[0].id:UNKNOWN_FIELD'));
  });
});

describe('teacher: publish, marks total, lock, close', () => {
  it('publishing needs questions whose marks add up to maxMarks, and a future due date', () => {
    const a = draft();
    assert.deepEqual(details(() => svc.publish(T1, a.id)), ['questions:NO_QUESTIONS']);
    svc.replaceQuestions(T1, a.id, { questions: [{ text: 'Q', maxMarks: 7 }] });
    assert.deepEqual(details(() => svc.publish(T1, a.id)), ['questions:MARKS_MISMATCH']);
    svc.replaceQuestions(T1, a.id, { questions: QUESTIONS });
    svc.update(T1, a.id, { dueAt: new Date(T0 - 60000).toISOString() });
    assert.deepEqual(details(() => svc.publish(T1, a.id)), ['dueAt:DUE_IN_PAST']);
    svc.update(T1, a.id, { dueAt: null });
    const p = svc.publish(T1, a.id);
    assert.deepEqual([p.status, p.acceptingSubmissions, !!p.publishedAt], ['published', true, true]);
    assert.equal(code(() => svc.publish(T1, a.id)), 'NOT_A_DRAFT');
  });

  it('published and closed assignments are locked (details and questions)', () => {
    const p = published();
    assert.equal(code(() => svc.update(T1, p.id, { title: 'Changed' })), 'ASSIGNMENT_LOCKED');
    assert.equal(code(() => svc.replaceQuestions(T1, p.id, { questions: QUESTIONS })), 'ASSIGNMENT_LOCKED');
    const c = svc.close(T1, p.id);
    assert.deepEqual([c.status, c.acceptingSubmissions], ['closed', false]);
    assert.equal(code(() => svc.close(T1, p.id)), 'NOT_PUBLISHED');
    assert.equal(code(() => svc.update(T1, p.id, { title: 'Changed' })), 'ASSIGNMENT_LOCKED');
  });

  it('isolation: other teachers (same or other school) get NOT_FOUND; students and admins-as-non-teachers get FORBIDDEN', () => {
    const p = published();
    for (const other of [T2, T3]) {
      for (const fn of [() => svc.getOwn(other, p.id), () => svc.close(other, p.id), () => svc.submissions(other, p.id), () => svc.update(other, p.id, { title: 'x' })]) {
        assert.equal(code(fn), 'NOT_FOUND');
      }
      assert.deepEqual(svc.listOwn(other), []);
    }
    for (const notTeacher of [S1, { ...S1, kind: 'admin' }, null]) {
      assert.equal(code(() => svc.create(notTeacher, { title: 'x', classroomId: 10, maxMarks: 5 })), 'FORBIDDEN');
      assert.equal(code(() => svc.listOwn(notTeacher)), 'FORBIDDEN');
    }
  });
});

describe('student visibility', () => {
  it('students see published/closed assignments of their own class only; drafts, other classes and schools are 404', () => {
    const d = draft({ title: 'Draft only' });
    const p = published();
    assert.deepEqual(svc.listForStudent(S1).map((a) => [a.title, a.myStatus, a.teacherName]), [['Biology essay', 'not_submitted', 'Teacher One']]);
    assert.equal(code(() => svc.getForStudent(S1, d.id)), 'NOT_FOUND');
    assert.deepEqual(svc.listForStudent(S2), []);
    assert.equal(code(() => svc.getForStudent(S2, p.id)), 'NOT_FOUND');
    assert.equal(code(() => svc.getForStudent(S3, p.id)), 'NOT_FOUND');
    assert.equal(code(() => svc.getForStudent(T1, p.id)), 'FORBIDDEN');
    const view = svc.getForStudent(S1, p.id);
    assert.deepEqual(view.questions.map((q) => [q.position, q.maxMarks]), [[1, 6], [2, 4]]);
    assert.equal(JSON.stringify(view).includes('teacherId'), false);
  });
});

describe('submissions', () => {
  it('first upload creates the submission; re-upload before evaluation replaces it (version + 1, old key returned for deletion)', () => {
    const p = published();
    const first = svc.recordSubmission(S1, p.id, file());
    assert.deepEqual([first.created, first.submission.status, first.submission.version, first.replacedStorageKey], [true, 'submitted', 1, null]);
    const oldKey = db.prepare('SELECT storage_key FROM aia_assignment_submissions').get().storage_key;
    const second = svc.recordSubmission(S1, p.id, { ...file(), originalFilename: 'v2.pdf' });
    assert.deepEqual([second.created, second.submission.version, second.submission.originalFilename, second.replacedStorageKey], [false, 2, 'v2.pdf', oldKey]);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM aia_assignment_submissions').get().n, 1); // one current submission
    assert.equal(JSON.stringify(second.submission).match(/storageKey|sha256|\.pdf"?\s*:/), null);
    assert.deepEqual(Object.keys(second.submission).sort(), ['fileSize', 'id', 'originalFilename', 'status', 'submittedAt', 'version']);
  });

  it('closed, past-due or already-evaluated submissions are refused; nothing changes', () => {
    const p = published({ dueAt: new Date(T0 + 3600000).toISOString() });
    svc.recordSubmission(S1, p.id, file());
    clock = T0 + 3600000; // due now
    assert.equal(code(() => svc.recordSubmission(S1, p.id, file())), 'ASSIGNMENT_PAST_DUE');
    assert.equal(code(() => svc.assertCanSubmit(S1, p.id)), 'ASSIGNMENT_PAST_DUE');
    clock = T0;
    const sub = svc.submissions(T1, p.id).students.find((s) => s.studentId === IDS.student1).submission;
    svc.evaluate(T1, p.id, sub.id, { finalMarks: 7.5, teacherFeedback: 'Clear structure.' });
    assert.equal(code(() => svc.recordSubmission(S1, p.id, file())), 'SUBMISSION_EVALUATED');
    const q = published({ title: 'Closed one' });
    svc.close(T1, q.id);
    assert.equal(code(() => svc.recordSubmission(S1, q.id, file())), 'ASSIGNMENT_CLOSED');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM aia_assignment_submissions').get().n, 1);
  });

  it('students cannot submit to drafts, other classes or other schools, and teachers cannot submit', () => {
    const d = draft();
    const p = published();
    assert.equal(code(() => svc.recordSubmission(S1, d.id, file())), 'NOT_FOUND');
    assert.equal(code(() => svc.recordSubmission(S2, p.id, file())), 'NOT_FOUND');
    assert.equal(code(() => svc.recordSubmission(S3, p.id, file())), 'NOT_FOUND');
    assert.equal(code(() => svc.recordSubmission(T1, p.id, file())), 'FORBIDDEN');
  });
});

describe('teacher submission dashboard + manual marks', () => {
  it('shows who submitted and who has not; after closing, non-submitters are missed', () => {
    const p = published();
    svc.recordSubmission(S1, p.id, file());
    let dash = svc.submissions(T1, p.id);
    assert.deepEqual(dash.students.map((s) => [s.studentName, s.status]), [['Second Student', 'not_submitted'], ['Student One', 'submitted']]);
    assert.deepEqual(dash.summary, { students: 2, submitted: 1, evaluated: 0, notSubmitted: 1, missed: 0 });
    assert.equal(JSON.stringify(dash).includes('storageKey'), false);
    svc.close(T1, p.id);
    dash = svc.submissions(T1, p.id);
    assert.deepEqual(dash.students.map((s) => s.status), ['missed', 'submitted']);
    assert.equal(svc.listForStudent({ ...S1, userId: 40 }).find((a) => a.id === p.id).myStatus, 'missed');
  });

  it('manual final marks: 0..maxMarks in 0.5 steps; evaluated status and feedback reach the student', () => {
    const p = published();
    svc.recordSubmission(S1, p.id, file());
    const sid = svc.submissions(T1, p.id).students.find((s) => s.submission).submission.id;
    for (const bad of [-1, 10.5, 3.25, '8', null]) assert.ok(details(() => svc.evaluate(T1, p.id, sid, { finalMarks: bad })).includes('finalMarks:OUT_OF_RANGE'), String(bad));
    assert.ok(details(() => svc.evaluate(T1, p.id, sid, { finalMarks: 5, aiMarks: 9 })).includes('aiMarks:UNKNOWN_FIELD'));
    assert.equal(code(() => svc.evaluate(T2, p.id, sid, { finalMarks: 5 })), 'NOT_FOUND');
    const r = svc.evaluate(T1, p.id, sid, { finalMarks: 8.5, teacherFeedback: 'Good comparison.' });
    assert.deepEqual([r.submission.status, r.submission.finalMarks], ['evaluated', 8.5]);
    assert.equal(db.prepare('SELECT evaluated_by FROM aia_assignment_submissions').get().evaluated_by, IDS.teacher1);
    const mine = svc.getForStudent(S1, p.id);
    assert.deepEqual([mine.myStatus, mine.submission.finalMarks, mine.submission.teacherFeedback], ['evaluated', 8.5, 'Good comparison.']);
  });

  it('a submission id from another assignment cannot be used through this one', () => {
    const p = published();
    const q = published({ title: 'Other' });
    svc.recordSubmission(S1, q.id, file());
    const otherSid = svc.submissions(T1, q.id).students.find((s) => s.submission).submission.id;
    assert.equal(code(() => svc.evaluate(T1, p.id, otherSid, { finalMarks: 1 })), 'SUBMISSION_NOT_FOUND');
    assert.equal(code(() => svc.submissionFileFor(T1, p.id, otherSid)), 'SUBMISSION_NOT_FOUND');
  });
});

describe('without migration 007', () => {
  it('the assignment service reports ASSIGNMENTS_NOT_READY (503); assessments are unaffected', () => {
    const pre = createLmsTestDb({ withAssignments: false });
    const adapter = createSqliteAssessmentLmsAdapter(pre);
    assert.equal(adapter.isReady(), true);
    assert.throws(() => new AssignmentService({ adapter }), (e) => e.code === 'ASSIGNMENTS_NOT_READY' && e.statusCode === 503);
  });
});
