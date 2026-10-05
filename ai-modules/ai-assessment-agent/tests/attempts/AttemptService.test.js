// Step 3: attempt lifecycle, server timer, deterministic grading, results, teacher report.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { AssessmentService } = require('../../backend/src/core/AssessmentService');
const { AttemptService } = require('../../backend/src/core/AttemptService');
const { createSqliteAssessmentLmsAdapter } = require('../../backend/src/adapters/lms/SqliteAssessmentLmsAdapter');
const { IDS, UP_003, DOWN_003, createLmsTestDb, mcq } = require('../helpers/lmsTestDb');

const T0 = Date.parse('2026-10-01T10:00:00.000Z');
const session = (userId, universityId) => ({ userId, universityId, role: 'x' });
const code = (fn) => { try { fn(); } catch (err) { return err.code; } assert.fail('expected an error'); };

let db, adapter, service, attempts, clock, t1, t2, t3, st1, st2, st3, stNoClass;
beforeEach(() => {
  clock = T0;
  db = createLmsTestDb();
  adapter = createSqliteAssessmentLmsAdapter(db);
  service = new AssessmentService({ adapter });
  attempts = new AttemptService({ adapter, now: () => clock });
  const r = (id, school) => adapter.resolveActor(session(id, school));
  [t1, t2, t3] = [r(IDS.teacher1, 1), r(IDS.teacher2, 1), r(IDS.teacher3, 2)];
  [st1, st2, st3, stNoClass] = [r(IDS.student1, 1), r(IDS.student2, 1), r(IDS.student3, 2), r(IDS.studentNoClass, 1)];
});

/** Published test: 3 questions, correct positions [1, 2, 0]. */
function publishedTest(teacher = t1, classroomId = IDS.class10, { durationMinutes = 10, title = 'Unit test' } = {}) {
  const a = service.createAssessment(teacher, { title, subject: 'Science', classroomId, durationMinutes });
  service.addQuestion(teacher, a.id, mcq('Question one?', 1));
  service.addQuestion(teacher, a.id, mcq('Question two?', 2));
  service.addQuestion(teacher, a.id, mcq('Question three?', 0));
  return service.publish(teacher, a.id);
}
const qids = (test) => test.questions.map((q) => q.id);
const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;

describe('student test list (1, 2)', () => {
  it('1. shows only published tests for the student\'s own class, with attempt status', () => {
    const mine = publishedTest(t1, IDS.class10, { title: 'Mine' });
    publishedTest(t1, IDS.class11, { title: 'Other class' });
    service.createAssessment(t1, { title: 'Draft', subject: 'S', classroomId: IDS.class10 });
    const list = attempts.withAttemptStatus(st1, service.listAvailableForStudent(st1));
    assert.deepEqual(list.map((a) => [a.title, a.attempt]), [['Mine', null]]);
    attempts.startAttempt(st1, mine.id);
    assert.equal(attempts.withAttemptStatus(st1, service.listAvailableForStudent(st1))[0].attempt.status, 'in_progress');
  });

  it('2. another school\'s test is invisible and cannot be started', () => {
    const other = publishedTest(t3, IDS.class20);
    assert.deepEqual(service.listAvailableForStudent(st1), []);
    assert.equal(code(() => attempts.startAttempt(st1, other.id)), 'NOT_FOUND');
    assert.equal(code(() => attempts.startAttempt(stNoClass, publishedTest().id)), 'NOT_FOUND');
    assert.equal(count('aia_attempts'), 0);
  });

  it('drafts cannot be started', () => {
    const d = service.createAssessment(t1, { title: 'D', subject: 'S', classroomId: IDS.class10 });
    assert.equal(code(() => attempts.startAttempt(st1, d.id)), 'NOT_FOUND');
  });
});

describe('start attempt (3, 4, 5, 14)', () => {
  it('4. creates an attempt with SERVER start time and deadline = start + duration', () => {
    const test = publishedTest();
    const { created, attempt } = attempts.startAttempt(st1, test.id);
    assert.equal(created, true);
    assert.equal(attempt.status, 'in_progress');
    assert.equal(attempt.startedAt, '2026-10-01T10:00:00.000Z');
    assert.equal(attempt.deadlineAt, '2026-10-01T10:10:00.000Z');
    assert.equal(attempt.serverNow, '2026-10-01T10:00:00.000Z');
    assert.equal(attempt.questions.length, 3);
    assert.deepEqual(attempt.answers, []);
  });

  it('3. the pre-submission payload has no correct answers, answer keys or explanations', () => {
    const test = publishedTest();
    service.unpublish(t1, test.id);
    service.updateQuestion(t1, test.id, test.questions[0].id, { ...mcq('Question one?', 1), explanation: 'SECRET EXPLANATION' });
    service.publish(t1, test.id);
    const { attempt } = attempts.startAttempt(st1, test.id);
    const json = JSON.stringify(attempt) + JSON.stringify(attempts.getAttempt(st1, attempt.id));
    for (const leak of ['isCorrect', 'correctPosition', 'correctAnswer', 'explanation', 'SECRET EXPLANATION', 'outcome', 'result']) {
      assert.equal(json.includes(leak), false, leak);
    }
    assert.deepEqual(Object.keys(attempt.questions[0].options[0]).sort(), ['position', 'text']);
  });

  it('5. a second start returns the SAME attempt (resume after refresh) and never creates another', () => {
    const test = publishedTest();
    const first = attempts.startAttempt(st1, test.id);
    clock += 60000;
    const again = attempts.startAttempt(st1, test.id);
    assert.equal(again.created, false);
    assert.equal(again.attempt.id, first.attempt.id);
    assert.equal(again.attempt.deadlineAt, first.attempt.deadlineAt); // not reset by restarting
    assert.equal(count('aia_attempts'), 1);
    assert.throws(() => adapter.insertAttempt({ universityId: 1, assessmentId: test.id, studentId: IDS.student1, startedAt: 'x', deadlineAt: null }), /UNIQUE/);
  });

  it('untimed tests (no duration) have no deadline', () => {
    const { attempt } = attempts.startAttempt(st1, publishedTest(t1, IDS.class10, { durationMinutes: null }).id);
    assert.equal(attempt.deadlineAt, null);
    clock += 24 * 3600 * 1000;
    assert.equal(attempts.getAttempt(st1, attempt.id).status, 'in_progress');
  });
});

describe('saving answers (6, 7, 8, 9, 10)', () => {
  it('6. answers can be saved, changed and cleared before submission', () => {
    const test = publishedTest();
    const { attempt } = attempts.startAttempt(st1, test.id);
    const [q1, q2] = qids(test);
    attempts.saveAnswer(st1, attempt.id, q1, { optionPosition: 0 });
    attempts.saveAnswer(st1, attempt.id, String(q1), { optionPosition: 1 }); // re-answer (ids arrive as strings)
    attempts.saveAnswer(st1, attempt.id, q2, { optionPosition: 3 });
    attempts.saveAnswer(st1, attempt.id, q2, { optionPosition: null }); // clear
    assert.deepEqual(attempts.getAttempt(st1, attempt.id).answers, [{ questionId: q1, optionPosition: 1 }]);
  });

  it('7. question ids from another assessment or garbage are rejected', () => {
    const test = publishedTest();
    const other = publishedTest(t1, IDS.class10, { title: 'Other' });
    const { attempt } = attempts.startAttempt(st1, test.id);
    for (const q of [other.questions[0].id, 999999, 'abc', '0']) {
      assert.equal(code(() => attempts.saveAnswer(st1, attempt.id, q, { optionPosition: 1 })), 'QUESTION_NOT_FOUND');
    }
    assert.equal(count('aia_attempt_answers'), 0);
  });

  it('8. invalid option values are rejected; nothing but optionPosition is accepted', () => {
    const test = publishedTest();
    const { attempt } = attempts.startAttempt(st1, test.id);
    const q = qids(test)[0];
    for (const body of [{ optionPosition: 4 }, { optionPosition: -1 }, { optionPosition: '1' }, { optionPosition: 1.5 }, {}]) {
      assert.equal(code(() => attempts.saveAnswer(st1, attempt.id, q, body)), 'INVALID_OPTION', JSON.stringify(body));
    }
    assert.equal(code(() => attempts.saveAnswer(st1, attempt.id, q, { optionPosition: 1, isCorrect: true })), 'VALIDATION_FAILED');
    assert.equal(code(() => attempts.saveAnswer(st1, attempt.id, q, { optionPosition: 1, assessmentId: 9 })), 'VALIDATION_FAILED');
    assert.equal(count('aia_attempt_answers'), 0);
  });

  it('9. another student (same or other school) cannot read, answer or submit someone else\'s attempt', () => {
    const test = publishedTest();
    const { attempt } = attempts.startAttempt(st1, test.id);
    for (const other of [st2, st3]) {
      assert.equal(code(() => attempts.getAttempt(other, attempt.id)), 'ATTEMPT_NOT_FOUND');
      assert.equal(code(() => attempts.saveAnswer(other, attempt.id, qids(test)[0], { optionPosition: 1 })), 'ATTEMPT_NOT_FOUND');
      assert.equal(code(() => attempts.submit(other, attempt.id)), 'ATTEMPT_NOT_FOUND');
      assert.equal(code(() => attempts.getResult(other, attempt.id)), 'ATTEMPT_NOT_FOUND');
    }
    assert.equal(attempts.getAttempt(st1, attempt.id).status, 'in_progress');
    assert.equal(code(() => attempts.getAttempt(t1, attempt.id)), 'FORBIDDEN'); // teachers use the report
  });

  it('10. after the SERVER deadline, saving is refused and the attempt is auto-finalized and graded', () => {
    const test = publishedTest();
    const { attempt } = attempts.startAttempt(st1, test.id);
    const [q1, q2] = qids(test);
    attempts.saveAnswer(st1, attempt.id, q1, { optionPosition: 1 }); // correct
    clock = Date.parse(attempt.deadlineAt) - 1;
    attempts.saveAnswer(st1, attempt.id, q2, { optionPosition: 0 }); // 1 ms before: still accepted (wrong)
    clock = Date.parse(attempt.deadlineAt); // at the deadline: closed
    assert.equal(code(() => attempts.saveAnswer(st1, attempt.id, q2, { optionPosition: 2 })), 'ATTEMPT_EXPIRED');
    const r = attempts.getResult(st1, attempt.id);
    assert.equal(r.status, 'expired');
    assert.equal(r.finishedAt, attempt.deadlineAt);
    assert.deepEqual(r.result, { totalQuestions: 3, attempted: 2, correct: 1, incorrect: 1, unattempted: 1, score: 1, percentage: 33.33 });
  });

  it('delayed requests: an expired attempt is finalized by ANY later read, list or report, not just saves', () => {
    const test = publishedTest();
    const { attempt } = attempts.startAttempt(st1, test.id);
    clock += 11 * 60000;
    assert.equal(attempts.withAttemptStatus(st1, service.listAvailableForStudent(st1))[0].attempt.status, 'expired');
    assert.equal(db.prepare('SELECT status FROM aia_attempts WHERE id = ?').get(attempt.id).status, 'expired');
    assert.equal(attempts.startAttempt(st1, test.id).attempt.status, 'expired'); // cannot restart after expiry
  });
});

describe('submit, grading, results (11, 12, 13, 15, 16, 17)', () => {
  it('11/12. grades every question on the server and counts unattempted ones', () => {
    const test = publishedTest();
    const { attempt } = attempts.startAttempt(st1, test.id);
    const [q1, q2] = qids(test);
    attempts.saveAnswer(st1, attempt.id, q1, { optionPosition: 1 }); // correct
    attempts.saveAnswer(st1, attempt.id, q2, { optionPosition: 0 }); // wrong (correct is 2)
    clock += 5 * 60000;
    const { alreadyFinalized, attempt: done } = attempts.submit(st1, attempt.id);
    assert.equal(alreadyFinalized, false);
    assert.equal(done.status, 'submitted');
    assert.equal(done.finishedAt, '2026-10-01T10:05:00.000Z');
    assert.deepEqual(done.result, { totalQuestions: 3, attempted: 2, correct: 1, incorrect: 1, unattempted: 1, score: 1, percentage: 33.33 });
    assert.deepEqual(done.questions.map((q) => [q.selectedPosition, q.correctPosition, q.outcome]), [[1, 1, 'correct'], [0, 2, 'incorrect'], [null, 0, 'unattempted']]);
  });

  it('all correct -> 100%, none answered -> 0%', () => {
    const test = publishedTest();
    const a = attempts.startAttempt(st1, test.id).attempt;
    [1, 2, 0].forEach((p, i) => attempts.saveAnswer(st1, a.id, qids(test)[i], { optionPosition: p }));
    assert.equal(attempts.submit(st1, a.id).attempt.result.percentage, 100);
    const b = attempts.startAttempt(st2, publishedTest(t1, IDS.class11).id).attempt;
    assert.deepEqual(attempts.submit(st2, b.id).attempt.result, { totalQuestions: 3, attempted: 0, correct: 0, incorrect: 0, unattempted: 3, score: 0, percentage: 0 });
  });

  it('15. double submit is idempotent: same stored result, nothing changes', () => {
    const test = publishedTest();
    const { attempt } = attempts.startAttempt(st1, test.id);
    attempts.saveAnswer(st1, attempt.id, qids(test)[0], { optionPosition: 1 });
    const first = attempts.submit(st1, attempt.id).attempt;
    clock += 60000;
    const second = attempts.submit(st1, attempt.id);
    assert.equal(second.alreadyFinalized, true);
    assert.deepEqual(second.attempt.result, first.result);
    assert.equal(second.attempt.finishedAt, first.finishedAt);
    assert.equal(count('aia_attempts'), 1);
    assert.equal(code(() => attempts.saveAnswer(st1, attempt.id, qids(test)[1], { optionPosition: 2 })), 'ATTEMPT_SUBMITTED');
    assert.deepEqual(attempts.getResult(st1, attempt.id).result, first.result);
  });

  it('16/17. the result is persisted and retrievable later by its owner only', () => {
    const test = publishedTest();
    const { attempt } = attempts.startAttempt(st1, test.id);
    assert.equal(code(() => attempts.getResult(st1, attempt.id)), 'ATTEMPT_IN_PROGRESS');
    attempts.saveAnswer(st1, attempt.id, qids(test)[2], { optionPosition: 0 });
    attempts.submit(st1, attempt.id);
    const row = { ...db.prepare('SELECT status, correct, score, percentage, total_questions FROM aia_attempts WHERE id = ?').get(attempt.id) };
    assert.deepEqual(row, { status: 'submitted', correct: 1, score: 1, percentage: 33.33, total_questions: 3 });
    assert.deepEqual(db.prepare('SELECT is_correct FROM aia_attempt_answers WHERE attempt_id = ?').all(attempt.id).map((r) => r.is_correct), [1]);
    // A fresh service instance (e.g. after a server restart) returns the same result.
    const later = new AttemptService({ adapter, now: () => clock + 86400000 }).getResult(st1, attempt.id);
    assert.equal(later.result.score, 1);
    assert.equal(JSON.stringify(later).includes('explanation'), false); // explanations stay teacher-only
    assert.equal(code(() => attempts.getResult(st2, attempt.id)), 'ATTEMPT_NOT_FOUND');
  });

  it('13. the client cannot influence scoring: only the chosen option per question is ever read', () => {
    const test = publishedTest();
    const { attempt } = attempts.startAttempt(st1, test.id);
    // The only client input is optionPosition. Scores/flags in the answer body are refused...
    assert.equal(code(() => attempts.saveAnswer(st1, attempt.id, qids(test)[0], { optionPosition: 0, score: 3, percentage: 100 })), 'VALIDATION_FAILED');
    // ...and submit takes no input at all (the HTTP layer rejects any body, tested in the HTTP suite).
    assert.equal(attempts.submit(st1, attempt.id).attempt.result.score, 0);
  });
});

describe('unpublish lock once attempts exist (Step 1 compatibility)', () => {
  it('a test with attempts cannot be unpublished (so graded questions cannot change); tests without attempts still can', () => {
    const used = publishedTest();
    attempts.startAttempt(st1, used.id);
    assert.equal(code(() => service.unpublish(t1, used.id)), 'ASSESSMENT_HAS_ATTEMPTS');
    const unused = publishedTest(t1, IDS.class10, { title: 'Unused' });
    assert.equal(service.unpublish(t1, unused.id).status, 'draft');
  });
});

describe('teacher report (18, 19)', () => {
  it('18. per-student results, roster statuses and summary; expired attempts are finalized first', () => {
    const test = publishedTest(t1, IDS.class10);
    db.exec(`INSERT INTO users (id, name, email, password, role, university_id) VALUES (30, 'Aarav Synthetic', 'a30@s1.test', 'x', 'student', 1), (31, 'Zoya Synthetic', 'z31@s1.test', 'x', 'student', 1)`);
    db.exec(`INSERT INTO student_classroom_assignment (studentId, classroomId) VALUES (30, ${IDS.class10}), (31, ${IDS.class10})`);
    const s30 = adapter.resolveActor(session(30, 1));
    const s31 = adapter.resolveActor(session(31, 1));

    const a = attempts.startAttempt(st1, test.id).attempt; // Student One: 3/3 in 2 min
    [1, 2, 0].forEach((p, i) => attempts.saveAnswer(st1, a.id, qids(test)[i], { optionPosition: p }));
    clock += 2 * 60000;
    attempts.submit(st1, a.id);
    const b = attempts.startAttempt(s30, test.id).attempt; // Aarav: 1 correct, then time runs out
    attempts.saveAnswer(s30, b.id, qids(test)[0], { optionPosition: 1 });
    clock += 20 * 60000; // past Aarav's deadline; nobody touched it since

    const { assessment, summary, students } = attempts.report(t1, test.id);
    assert.equal(assessment.title, 'Unit test');
    assert.deepEqual(students.map((s) => [s.studentName, s.status, s.score ?? null, s.percentage ?? null]), [
      ['Aarav Synthetic', 'expired', 1, 33.33],
      ['Student One', 'submitted', 3, 100],
      ['Zoya Synthetic', 'not_started', null, null],
    ]);
    assert.equal(students[1].timeTakenSeconds, 120);
    assert.equal(students[0].timeTakenSeconds, 600); // capped at the deadline
    assert.deepEqual(summary, {
      studentsInClass: 3, studentsAttempted: 2, totalSubmissions: 2, inProgress: 0,
      averageScore: 2, averagePercentage: 66.67, highestScore: 3, lowestScore: 1, highestPercentage: 100, lowestPercentage: 33.33,
    });
    assert.equal(s31.kind, 'student');
    assert.equal(JSON.stringify(students).includes('rank'), false);
  });

  it('19. other teachers and other schools cannot see the report; students cannot use it', () => {
    const test = publishedTest();
    assert.equal(code(() => attempts.report(t2, test.id)), 'NOT_FOUND');
    assert.equal(code(() => attempts.report(t3, test.id)), 'NOT_FOUND');
    assert.equal(code(() => attempts.report(st1, test.id)), 'FORBIDDEN');
  });

  it('an empty report has null statistics, not zeros', () => {
    const { summary } = attempts.report(t1, publishedTest().id);
    assert.deepEqual([summary.totalSubmissions, summary.averageScore, summary.highestScore], [0, null, null]);
  });
});

describe('migration 003', () => {
  it('adds only the two attempt tables (+ indexes) and down removes exactly them', () => {
    const d = createLmsTestDb({ withStep3: false });
    const names = () => d.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
    const before = names();
    d.exec(fs.readFileSync(UP_003, 'utf8'));
    assert.deepEqual(names().filter((n) => !before.includes(n)), ['aia_attempt_answers', 'aia_attempts', 'idx_aia_attempts_assessment', 'idx_aia_attempts_student']);
    d.exec(fs.readFileSync(UP_003, 'utf8')); // idempotent
    d.exec(fs.readFileSync(DOWN_003, 'utf8'));
    assert.deepEqual(names(), before);
  });

  it('no foreign key into an LMS table; the adapter is not ready without 003', () => {
    for (const t of ['aia_attempts', 'aia_attempt_answers']) {
      for (const fk of db.prepare(`PRAGMA foreign_key_list(${t})`).all()) assert.ok(fk.table.startsWith('aia_'), `${t} -> ${fk.table}`);
    }
    assert.equal(createSqliteAssessmentLmsAdapter(createLmsTestDb({ withStep3: false })).isReady(), false);
  });

  it('the database enforces status/finished_at consistency and valid option positions', () => {
    const test = publishedTest();
    const { attempt } = attempts.startAttempt(st1, test.id);
    assert.throws(() => db.prepare("UPDATE aia_attempts SET status = 'submitted' WHERE id = ?").run(attempt.id), /CHECK/);
    assert.throws(() => db.prepare('INSERT INTO aia_attempt_answers (attempt_id, question_id, option_position) VALUES (?, ?, 7)').run(attempt.id, qids(test)[0]), /CHECK/);
  });
});
