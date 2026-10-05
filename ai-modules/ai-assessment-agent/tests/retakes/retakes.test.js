// Step 6: teacher attempt reset / retake with preserved history. Fake server clock, temp DB.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { AssessmentService } = require('../../backend/src/core/AssessmentService');
const { AttemptService, MAX_RESETS_PER_STUDENT } = require('../../backend/src/core/AttemptService');
const { createSqliteAssessmentLmsAdapter } = require('../../backend/src/adapters/lms/SqliteAssessmentLmsAdapter');
const { IDS, UP_005, DOWN_005, createLmsTestDb, mcq } = require('../helpers/lmsTestDb');

const T0 = Date.parse('2026-10-10T08:00:00.000Z');
const at = (min) => new Date(T0 + min * 60000).toISOString();
const session = (userId, universityId) => ({ userId, universityId, role: 'x' });
const code = (fn) => { try { fn(); } catch (err) { return err.code; } assert.fail('expected an error'); };

let db, adapter, service, attempts, clock, t1, t2, t3, st1, st2;
beforeEach(() => {
  clock = T0;
  db = createLmsTestDb();
  adapter = createSqliteAssessmentLmsAdapter(db);
  service = new AssessmentService({ adapter, now: () => clock });
  attempts = new AttemptService({ adapter, now: () => clock });
  const r = (id, school) => adapter.resolveActor(session(id, school));
  [t1, t2, t3, st1, st2] = [r(IDS.teacher1, 1), r(IDS.teacher2, 1), r(IDS.teacher3, 2), r(IDS.student1, 1), r(IDS.student2, 1)];
});

/** Published 2-question, 20-minute test for class 10 (correct positions 1, 2). */
function published(window = {}) {
  const a = service.createAssessment(t1, { title: 'Retake test', subject: 'Science', classroomId: IDS.class10, durationMinutes: 20, ...window });
  service.addQuestion(t1, a.id, mcq('Q1?', 1));
  service.addQuestion(t1, a.id, mcq('Q2?', 2));
  return service.publish(t1, a.id);
}
/** Student 1 starts, answers Q1 with `pos`, submits. Returns the finished attempt. */
function takeAndSubmit(test, pos = 0) {
  const { attempt } = attempts.startAttempt(st1, test.id);
  attempts.saveAnswer(st1, attempt.id, attempt.questions[0].id, { optionPosition: pos });
  return attempts.submit(st1, attempt.id).attempt;
}
const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
const snapshotTest = (id) => JSON.stringify({
  a: db.prepare('SELECT title, subject, status, classroom_id, duration_minutes, opens_at, closes_at, closed_at FROM aia_assessments WHERE id = ?').get(id),
  q: db.prepare('SELECT id, position, text, explanation FROM aia_questions WHERE assessment_id = ? ORDER BY id').all(id),
  o: db.prepare('SELECT o.question_id, o.position, o.text, o.is_correct FROM aia_options o JOIN aia_questions q ON q.id = o.question_id WHERE q.assessment_id = ? ORDER BY o.id').all(id),
});

describe('teacher resets a finished attempt; student retakes', () => {
  it('reset archives the result, removes the current attempt, and leaves the test/questions unchanged', () => {
    const test = published();
    const first = takeAndSubmit(test, 0); // wrong answer: 0/2
    const before = snapshotTest(test.id);
    clock += 30 * 60000;

    const { reset } = attempts.resetAttempt(t1, test.id, IDS.student1);
    assert.deepEqual([reset.studentId, reset.archivedAttemptId, reset.resetAt, reset.resetsUsed, reset.resetsRemaining], [IDS.student1, first.id, at(30), 1, MAX_RESETS_PER_STUDENT - 1]);
    assert.deepEqual(reset.previousResult, first.result);
    assert.deepEqual([count('aia_attempts'), count('aia_attempt_answers'), count('aia_attempt_archive')], [0, 0, 1]);

    const archived = db.prepare('SELECT * FROM aia_attempt_archive').get();
    assert.deepEqual([archived.original_attempt_id, archived.status, archived.score, archived.reset_by, archived.reset_at], [first.id, 'submitted', 0, IDS.teacher1, at(30)]);
    assert.deepEqual(JSON.parse(archived.answers_json), [{ questionId: test.questions[0].id, optionPosition: 0, isCorrect: false }]);
    assert.equal(snapshotTest(test.id), before);
  });

  it('after reset the student starts a FRESH attempt: new id, fresh server deadline, no old answers', () => {
    const test = published();
    const first = takeAndSubmit(test, 0);
    clock += 45 * 60000;
    attempts.resetAttempt(t1, test.id, IDS.student1);
    const list = attempts.withAttemptStatus(st1, service.listAvailableForStudent(st1));
    assert.equal(list[0].attempt, null); // the old result is no longer "current"

    const { created, attempt } = attempts.startAttempt(st1, test.id);
    assert.equal(created, true);
    assert.notEqual(attempt.id, first.id);
    assert.deepEqual([attempt.status, attempt.startedAt, attempt.deadlineAt], ['in_progress', at(45), at(65)]);
    assert.deepEqual(attempt.answers, []);
    assert.equal(code(() => attempts.getAttempt(st1, first.id)), 'ATTEMPT_NOT_FOUND'); // old attempt is history, not current

    attempts.saveAnswer(st1, attempt.id, attempt.questions[0].id, { optionPosition: 1 });
    attempts.saveAnswer(st1, attempt.id, attempt.questions[1].id, { optionPosition: 2 });
    assert.equal(attempts.submit(st1, attempt.id).attempt.result.score, 2);
  });

  it('report shows the CURRENT attempt with its number and the previous results as history', () => {
    const test = published();
    takeAndSubmit(test, 0); // attempt 1: 0/2
    attempts.resetAttempt(t1, test.id, IDS.student1);
    let row = attempts.report(t1, test.id).students.find((s) => s.studentId === IDS.student1);
    assert.deepEqual([row.status, row.attemptNumber, row.previousAttempts.length, row.previousAttempts[0].score], ['not_started', null, 1, 0]);

    takeAndSubmit(test, 1); // attempt 2: 1/2
    const report = attempts.report(t1, test.id);
    row = report.students.find((s) => s.studentId === IDS.student1);
    assert.deepEqual([row.status, row.attemptNumber, row.score, row.percentage], ['submitted', 2, 1, 50]);
    assert.deepEqual(row.previousAttempts.map((p) => [p.attemptNumber, p.status, p.score, p.percentage]), [[1, 'submitted', 0, 0]]);
    // Summary counts current attempts only (no double counting of the archived one).
    assert.deepEqual([report.summary.totalSubmissions, report.summary.averageScore, report.summary.highestScore], [1, 1, 1]);
  });

  it('an attempt past its deadline is finalized and can then be reset', () => {
    const test = published();
    attempts.startAttempt(st1, test.id);
    clock += 21 * 60000; // past the 20-minute deadline, nobody touched it
    const { reset } = attempts.resetAttempt(t1, test.id, IDS.student1);
    assert.equal(reset.previousResult.unattempted, 2);
    assert.equal(db.prepare('SELECT status FROM aia_attempt_archive').get().status, 'expired');
  });
});

describe('reset is refused when it would be unsafe', () => {
  it('while the student is still taking the test (409 ATTEMPT_IN_PROGRESS), nothing changes', () => {
    const test = published();
    attempts.startAttempt(st1, test.id);
    assert.equal(code(() => attempts.resetAttempt(t1, test.id, IDS.student1)), 'ATTEMPT_IN_PROGRESS');
    assert.deepEqual([count('aia_attempts'), count('aia_attempt_archive')], [1, 0]);
  });

  it('on a manually closed test (409 TEST_CLOSED): a reset never reopens a test', () => {
    const test = published();
    takeAndSubmit(test);
    attempts.closeAssessment(t1, test.id);
    assert.equal(code(() => attempts.resetAttempt(t1, test.id, IDS.student1)), 'TEST_CLOSED');
    assert.deepEqual([count('aia_attempts'), count('aia_attempt_archive')], [1, 0]);
  });

  it('on a test whose closesAt has passed (409 TEST_CLOSED)', () => {
    const test = published({ closesAt: at(60) });
    takeAndSubmit(test);
    clock = Date.parse(at(60));
    assert.equal(code(() => attempts.resetAttempt(t1, test.id, IDS.student1)), 'TEST_CLOSED');
  });

  it('a reset done while open does not let the student start after the window closes', () => {
    const test = published({ closesAt: at(60) });
    takeAndSubmit(test);
    attempts.resetAttempt(t1, test.id, IDS.student1);
    clock = Date.parse(at(60));
    assert.equal(code(() => attempts.startAttempt(st1, test.id)), 'TEST_CLOSED');
    assert.equal(attempts.report(t1, test.id).students.find((s) => s.studentId === IDS.student1).status, 'missed');
  });

  it('the fresh deadline is still capped by closesAt', () => {
    const test = published({ closesAt: at(50) });
    takeAndSubmit(test);
    clock = Date.parse(at(40));
    attempts.resetAttempt(t1, test.id, IDS.student1);
    assert.equal(attempts.startAttempt(st1, test.id).attempt.deadlineAt, at(50));
  });

  it(`after ${MAX_RESETS_PER_STUDENT} resets of the same student: 409 RESET_LIMIT_REACHED`, () => {
    const test = published();
    for (let i = 0; i < MAX_RESETS_PER_STUDENT; i += 1) {
      takeAndSubmit(test);
      attempts.resetAttempt(t1, test.id, IDS.student1);
    }
    takeAndSubmit(test);
    assert.equal(code(() => attempts.resetAttempt(t1, test.id, IDS.student1)), 'RESET_LIMIT_REACHED');
    assert.deepEqual([count('aia_attempts'), count('aia_attempt_archive')], [1, MAX_RESETS_PER_STUDENT]);
  });

  it('no attempt to reset, bad ids: 404 ATTEMPT_NOT_FOUND', () => {
    const test = published();
    assert.equal(code(() => attempts.resetAttempt(t1, test.id, IDS.student1)), 'ATTEMPT_NOT_FOUND');
    assert.equal(code(() => attempts.resetAttempt(t1, test.id, 'abc')), 'ATTEMPT_NOT_FOUND');
  });
});

describe('authorization and tenant isolation', () => {
  it('other teachers (same or other school) get NOT_FOUND; students FORBIDDEN; nothing changes', () => {
    const test = published();
    takeAndSubmit(test);
    assert.equal(code(() => attempts.resetAttempt(t2, test.id, IDS.student1)), 'NOT_FOUND');
    assert.equal(code(() => attempts.resetAttempt(t3, test.id, IDS.student1)), 'NOT_FOUND');
    assert.equal(code(() => attempts.resetAttempt(st1, test.id, IDS.student1)), 'FORBIDDEN');
    assert.equal(code(() => attempts.resetAttempt(st2, test.id, IDS.student1)), 'FORBIDDEN');
    assert.deepEqual([count('aia_attempts'), count('aia_attempt_archive')], [1, 0]);
  });

  it('a student id from another school finds no attempt in this school (404)', () => {
    const test = published();
    takeAndSubmit(test);
    assert.equal(code(() => attempts.resetAttempt(t1, test.id, IDS.student3)), 'ATTEMPT_NOT_FOUND');
  });

  it('archived attempts keep the test locked: it still cannot be unpublished/edited after a reset', () => {
    const test = published();
    takeAndSubmit(test);
    attempts.resetAttempt(t1, test.id, IDS.student1);
    assert.equal(count('aia_attempts'), 0);
    assert.equal(code(() => service.unpublish(t1, test.id)), 'ASSESSMENT_HAS_ATTEMPTS');
  });
});

describe('migration 005', () => {
  it('adds only the archive table (+ index); down removes exactly it; adapter not ready without it', () => {
    const d = createLmsTestDb({ withStep6: false });
    const names = () => d.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
    const before = names();
    assert.equal(createSqliteAssessmentLmsAdapter(d).isReady(), false);
    d.exec(fs.readFileSync(UP_005, 'utf8'));
    assert.deepEqual(names().filter((n) => !before.includes(n)), ['aia_attempt_archive', 'idx_aia_attempt_archive_student']);
    assert.equal(createSqliteAssessmentLmsAdapter(d).isReady(), true);
    d.exec(fs.readFileSync(UP_005, 'utf8')); // idempotent
    d.exec(fs.readFileSync(DOWN_005, 'utf8'));
    assert.deepEqual(names(), before);
  });

  it('keeps UNIQUE(assessment_id, student_id) on current attempts and has no FK into LMS tables', () => {
    assert.match(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'aia_attempts'").get().sql, /UNIQUE \(assessment_id, student_id\)/);
    for (const fk of db.prepare('PRAGMA foreign_key_list(aia_attempt_archive)').all()) assert.ok(fk.table.startsWith('aia_'), fk.table);
    assert.throws(() => db.prepare("INSERT INTO aia_attempt_archive (original_attempt_id, university_id, assessment_id, student_id, status, started_at, finished_at, total_questions, attempted, correct, incorrect, unattempted, score, percentage, answers_json, reset_by, reset_at) VALUES (1,1,999,1,'in_progress','x','x',1,1,1,0,0,1,100,'[]',1,'x')").run(), /CHECK|FOREIGN/);
  });
});
