// Question types through the real services + SQLite adapter (in-memory LMS database with migrations 001-006):
// teacher authoring, student answering, server-side grading, answer-key secrecy, legacy (pre-006) mode.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { IDS, createLmsTestDb, mcq, multi, numerical } = require('../helpers/lmsTestDb');
const { createSqliteAssessmentLmsAdapter } = require('../../backend/src/adapters/lms/SqliteAssessmentLmsAdapter');
const { AssessmentService } = require('../../backend/src/core/AssessmentService');
const { AttemptService } = require('../../backend/src/core/AttemptService');
const { StudentPerformanceService } = require('../../backend/src/core/analytics/StudentPerformanceService');

const T1 = { userId: IDS.teacher1, universityId: IDS.school1, kind: 'teacher' };
const T3 = { userId: IDS.teacher3, universityId: IDS.school2, kind: 'teacher' };
const S1 = { userId: IDS.student1, universityId: IDS.school1, kind: 'student' };
const S3 = { userId: IDS.student3, universityId: IDS.school2, kind: 'student' };
const code = (fn) => { try { fn(); } catch (err) { return err.code; } assert.fail('expected an error'); };

let db, service, attempts;
beforeEach(() => {
  db = createLmsTestDb();
  const adapter = createSqliteAssessmentLmsAdapter(db);
  service = new AssessmentService({ adapter });
  attempts = new AttemptService({ adapter });
});

/** Q1 single (correct B), Q2 multi (correct B+D), Q3 integer 42, Q4 decimal 2.5. */
function mixedTest() {
  const a = service.createAssessment(T1, { title: 'Mixed types', subject: 'Maths', classroomId: IDS.class10 });
  service.addQuestion(T1, a.id, mcq('What is 2 + 2?', 1));
  service.addQuestion(T1, a.id, multi('Which are even? Select all that apply.', [1, 3]));
  service.addQuestion(T1, a.id, numerical('What is 7 x 6?', '42', 'integer'));
  service.addQuestion(T1, a.id, numerical('What is 5 / 2?', '2.50', 'decimal'));
  return service.publish(T1, a.id);
}
const start = (test) => attempts.startAttempt(S1, test.id).attempt;

describe('teacher authoring of the new types', () => {
  it('stores and returns each type with its answer key (teacher view)', () => {
    const t = service.getOwnAssessment(T1, mixedTest().id);
    assert.deepEqual(t.questions.map((q) => q.type), ['single_mcq', 'multi_select', 'numerical', 'numerical']);
    assert.deepEqual(t.questions[1].options.map((o) => o.isCorrect), [false, true, false, true]);
    assert.deepEqual([t.questions[2].numericAnswer, t.questions[3].numericAnswer], [{ format: 'integer', value: '42' }, { format: 'decimal', value: '2.5' }]);
    assert.deepEqual(t.questions[2].options, []);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM aia_options').get().n, 8); // numerical questions store no options
  });

  it('changing a question\'s type on edit replaces its answer structure', () => {
    const a = service.createAssessment(T1, { title: 'Edit', subject: 'Maths' });
    const q = service.addQuestion(T1, a.id, mcq()).questions[0];
    let edited = service.updateQuestion(T1, a.id, q.id, numerical('How many sides has a hexagon?', '6'));
    assert.deepEqual([edited.questions[0].type, edited.questions[0].options.length, edited.questions[0].numericAnswer.value], ['numerical', 0, '6']);
    edited = service.updateQuestion(T1, a.id, q.id, multi());
    assert.deepEqual([edited.questions[0].type, edited.questions[0].numericAnswer, edited.questions[0].options.filter((o) => o.isCorrect).length], ['multi_select', null, 2]);
  });

  it('from-review saves mixed types as ONE draft; an invalid one saves nothing', () => {
    const body = (questions) => ({ assessment: { title: 'Reviewed', subject: 'Maths' }, questions });
    const saved = service.createAssessmentWithQuestions(T1, body([mcq(), multi(), numerical()]));
    assert.deepEqual([saved.status, saved.questions.map((q) => q.type)], ['draft', ['single_mcq', 'multi_select', 'numerical']]);
    const before = db.prepare('SELECT COUNT(*) AS n FROM aia_questions').get().n;
    assert.equal(code(() => service.createAssessmentWithQuestions(T1, body([mcq(), multi('Which?', [1])]))), 'VALIDATION_FAILED');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM aia_questions').get().n, before);
  });

  it('teacher authorization is unchanged: other schools/teachers and students cannot see or edit', () => {
    const t = mixedTest();
    assert.equal(code(() => service.getOwnAssessment(T3, t.id)), 'NOT_FOUND');
    assert.equal(code(() => service.addQuestion(S1, t.id, numerical())), 'FORBIDDEN');
    assert.equal(code(() => service.getAvailableForStudent(S3, t.id)), 'NOT_FOUND');
  });
});

describe('students never receive an answer key', () => {
  it('published view and in-progress attempt carry no isCorrect, numeric answer, explanation or correct positions', () => {
    const t = mixedTest();
    for (const view of [service.getAvailableForStudent(S1, t.id), start(t)]) {
      const json = JSON.stringify(view);
      for (const leak of ['isCorrect', 'numericAnswer', '"42"', '"2.5"', 'correctPosition', 'correctValue', 'explanation']) assert.equal(json.includes(leak), false, leak);
    }
    const attempt = start(t);
    assert.deepEqual(attempt.questions.map((q) => q.type), ['single_mcq', 'multi_select', 'numerical', 'numerical']);
    assert.deepEqual(attempt.questions.slice(2).map((q) => q.numericFormat), ['integer', 'decimal']);
  });
});

describe('server-side grading per type', () => {
  function answerAll(t, [single, set, int, dec]) {
    const a = start(t);
    const [q1, q2, q3, q4] = a.questions.map((q) => q.id);
    if (single !== undefined) attempts.saveAnswer(S1, a.id, q1, { optionPosition: single });
    if (set !== undefined) attempts.saveAnswer(S1, a.id, q2, { optionPositions: set });
    if (int !== undefined) attempts.saveAnswer(S1, a.id, q3, { value: int });
    if (dec !== undefined) attempts.saveAnswer(S1, a.id, q4, { value: dec });
    return attempts.submit(S1, a.id).attempt;
  }

  it('all correct: single option, exact set (any order), integer, equivalent decimal spelling', () => {
    const r = answerAll(mixedTest(), [1, [3, 1], ' 042 ', '2.50']);
    assert.deepEqual([r.result.score, r.result.percentage], [4, 100]);
    assert.deepEqual(r.questions.map((q) => q.outcome), ['correct', 'correct', 'correct', 'correct']);
  });

  it('all incorrect: wrong option, subset of the correct set, wrong integer, wrong decimal', () => {
    const r = answerAll(mixedTest(), [0, [1], '41', '2.51']);
    assert.deepEqual([r.result.score, r.result.correct, r.result.incorrect], [0, 0, 4]);
  });

  it('a superset is incorrect too (no partial credit)', () => {
    assert.equal(answerAll(mixedTest(), [1, [1, 2, 3], '42', '2.5']).questions[1].outcome, 'incorrect');
  });

  it('unanswered and cleared answers count as unattempted', () => {
    const t = mixedTest();
    const a = start(t);
    const [, q2, q3] = a.questions.map((q) => q.id);
    attempts.saveAnswer(S1, a.id, q2, { optionPositions: [1, 3] });
    attempts.saveAnswer(S1, a.id, q2, { optionPositions: [] }); // cleared
    attempts.saveAnswer(S1, a.id, q3, { value: '42' });
    attempts.saveAnswer(S1, a.id, q3, { value: null }); // cleared
    const r = attempts.submit(S1, a.id).attempt;
    assert.deepEqual([r.result.attempted, r.result.unattempted], [0, 4]);
  });

  it('after finalization the student sees their answers and the answer key per type', () => {
    const r = answerAll(mixedTest(), [1, [1], '42', '3']);
    const [q1, q2, q3, q4] = r.questions;
    assert.deepEqual([q1.selectedPosition, q1.correctPosition], [1, 1]);
    assert.deepEqual([q2.selectedPositions, q2.correctPositions, q2.outcome], [[1], [1, 3], 'incorrect']);
    assert.deepEqual([q3.submittedValue, q3.correctValue, q3.outcome], ['42', '42', 'correct']);
    assert.deepEqual([q4.submittedValue, q4.correctValue, q4.outcome], ['3', '2.5', 'incorrect']);
  });

  it('refresh resumes saved answers of every type', () => {
    const t = mixedTest();
    const a = start(t);
    attempts.saveAnswer(S1, a.id, a.questions[1].id, { optionPositions: [3, 1] });
    attempts.saveAnswer(S1, a.id, a.questions[2].id, { value: '0042' });
    assert.deepEqual(attempts.getAttempt(S1, a.id).answers, [
      { questionId: a.questions[1].id, optionPositions: [1, 3] },
      { questionId: a.questions[2].id, value: '42' },
    ]);
  });

  it('answers must fit the question type and format', () => {
    const t = mixedTest();
    const a = start(t);
    const [q1, q2, q3] = a.questions.map((q) => q.id);
    assert.equal(code(() => attempts.saveAnswer(S1, a.id, q1, { optionPositions: [1] })), 'WRONG_ANSWER_TYPE');
    assert.equal(code(() => attempts.saveAnswer(S1, a.id, q2, { optionPosition: 1 })), 'WRONG_ANSWER_TYPE');
    assert.equal(code(() => attempts.saveAnswer(S1, a.id, q3, { optionPosition: 1 })), 'WRONG_ANSWER_TYPE');
    assert.equal(code(() => attempts.saveAnswer(S1, a.id, q2, { optionPositions: [1, 1] })), 'INVALID_OPTION');
    assert.equal(code(() => attempts.saveAnswer(S1, a.id, q2, { optionPositions: [5] })), 'INVALID_OPTION');
    assert.equal(code(() => attempts.saveAnswer(S1, a.id, q3, { value: '42.5' })), 'INVALID_NUMBER'); // integer question
    assert.equal(code(() => attempts.saveAnswer(S1, a.id, q3, { value: '42 m' })), 'INVALID_NUMBER');
    assert.equal(code(() => attempts.saveAnswer(S1, a.id, q3, { value: true })), 'INVALID_NUMBER');
    assert.equal(code(() => attempts.saveAnswer(S1, a.id, q3, { value: '42', isCorrect: true })), 'VALIDATION_FAILED');
    assert.equal(code(() => attempts.saveAnswer(S1, a.id, q3, { value: '42', optionPosition: 1 })), 'VALIDATION_FAILED');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM aia_attempt_responses').get().n, 0);
  });

  it('reset archives new-type answers and the retake starts clean; performance metrics count them', () => {
    const t = mixedTest();
    answerAll(t, [1, [1, 3], '42', '9']);
    attempts.resetAttempt(T1, t.id, IDS.student1);
    const archived = JSON.parse(db.prepare('SELECT answers_json FROM aia_attempt_archive').get().answers_json);
    assert.equal(archived.length, 4);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM aia_attempt_responses').get().n, 0);
    const retake = answerAll(t, [1, [1, 3], '42', '2.5']);
    assert.equal(retake.result.score, 4);
    const perf = new StudentPerformanceService({ adapter: createSqliteAssessmentLmsAdapter(db) }).getPerformance(T1, IDS.student1);
    assert.deepEqual([perf.metrics.scores.average, perf.metrics.history[0].previousAttempts[0].percentage], [100, 75]);
  });
});

describe('legacy mode: a database WITHOUT migration 006 (the live schema today)', () => {
  it('single-answer MCQs work unchanged; new types are refused with 503 QUESTION_TYPES_NOT_READY and nothing is written', () => {
    const pre = createLmsTestDb({ withQuestionTypes: false });
    const adapter = createSqliteAssessmentLmsAdapter(pre);
    const svc = new AssessmentService({ adapter });
    const att = new AttemptService({ adapter });
    assert.equal(adapter.supportsQuestionTypes(), false);
    assert.equal(adapter.isReady(), true);
    const a = svc.createAssessment(T1, { title: 'Legacy', subject: 'Maths', classroomId: IDS.class10 });
    for (const q of [multi(), numerical()]) assert.equal(code(() => svc.addQuestion(T1, a.id, q)), 'QUESTION_TYPES_NOT_READY');
    assert.equal(code(() => svc.createAssessmentWithQuestions(T1, { assessment: { title: 'x', subject: 'y' }, questions: [numerical()] })), 'QUESTION_TYPES_NOT_READY');
    svc.addQuestion(T1, a.id, mcq());
    const test = svc.publish(T1, a.id);
    assert.equal(test.questions[0].type, 'single_mcq');
    const { attempt } = att.startAttempt(S1, test.id);
    att.saveAnswer(S1, attempt.id, attempt.questions[0].id, { optionPosition: 1 });
    assert.equal(att.submit(S1, attempt.id).attempt.result.score, 1);
    assert.equal(pre.prepare('SELECT COUNT(*) AS n FROM aia_questions').get().n, 1);
  });
});
