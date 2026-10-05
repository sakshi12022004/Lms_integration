// Teacher review -> explicit save path (service level) + migration 002.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { AssessmentService } = require('../../backend/src/core/AssessmentService');
const { createSqliteAssessmentLmsAdapter } = require('../../backend/src/adapters/lms/SqliteAssessmentLmsAdapter');
const { IDS, LMS_TABLES, UP, UP_002, DOWN_002, createLmsTestDb } = require('../helpers/lmsTestDb');

const session = (userId, universityId) => ({ userId, universityId, role: 'x' });
const reviewed = (text, correct = 0, explanation = 'Because.') => ({
  text,
  options: ['Alpha', 'Beta', 'Gamma', 'Delta'].map((t, i) => ({ text: t, isCorrect: i === correct })),
  explanation,
  difficulty: 'hard',
});
const code = (fn) => { try { fn(); } catch (err) { return err.code; } assert.fail('expected an error'); };

let db, adapter, service, t1, t3, st1;
beforeEach(() => {
  db = createLmsTestDb();
  adapter = createSqliteAssessmentLmsAdapter(db);
  service = new AssessmentService({ adapter });
  t1 = adapter.resolveActor(session(IDS.teacher1, IDS.school1));
  t3 = adapter.resolveActor(session(IDS.teacher3, IDS.school2));
  st1 = adapter.resolveActor(session(IDS.student1, IDS.school1));
});
const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;

describe('17. createAssessmentWithQuestions (teacher-reviewed save)', () => {
  it('saves ONE draft with all reviewed questions, explanations and difficulty', () => {
    const a = service.createAssessmentWithQuestions(t1, {
      assessment: { title: 'AI Planets', subject: 'Science', classroomId: IDS.class10 },
      questions: [reviewed('Q one?', 1, 'Beta is right.'), reviewed('Q two?', 3)],
    });
    assert.equal(a.status, 'draft');
    assert.equal(a.publishedAt, null);
    assert.equal(a.questionCount, 2);
    assert.deepEqual(a.questions.map((q) => [q.position, q.text, q.explanation, q.difficulty]), [[1, 'Q one?', 'Beta is right.', 'hard'], [2, 'Q two?', 'Because.', 'hard']]);
    assert.deepEqual(a.questions[1].options.map((o) => o.isCorrect), [false, false, false, true]);
  });

  it('16. is never published automatically; students cannot see it until the teacher publishes', () => {
    const a = service.createAssessmentWithQuestions(t1, { assessment: { title: 'T', subject: 'S', classroomId: IDS.class10 }, questions: [reviewed('Q?')] });
    assert.deepEqual(service.listAvailableForStudent(st1), []);
    service.publish(t1, a.id); // the normal Step 1 path
    const view = service.getAvailableForStudent(st1, a.id);
    assert.equal(JSON.stringify(view).includes('explanation'), false); // teacher-only
    assert.equal(JSON.stringify(view).includes('isCorrect'), false);
  });

  it('an invalid question rejects the whole save and writes nothing', () => {
    const bad = reviewed('Bad?'); bad.options[2].isCorrect = true;
    try {
      service.createAssessmentWithQuestions(t1, { assessment: { title: 'T', subject: 'S' }, questions: [reviewed('Good?'), bad] });
      assert.fail('should throw');
    } catch (err) {
      assert.deepEqual(err.details, [{ field: 'questions[1].options', code: 'MULTIPLE_CORRECT_OPTIONS' }]);
    }
    assert.deepEqual([count('aia_assessments'), count('aia_questions'), count('aia_options')], [0, 0, 0]);
  });

  it('requires at least one question and rejects extra top-level fields (status, ids, tenant)', () => {
    assert.equal(code(() => service.createAssessmentWithQuestions(t1, { assessment: { title: 'T', subject: 'S' }, questions: [] })), 'VALIDATION_FAILED');
    assert.equal(code(() => service.createAssessmentWithQuestions(t1, { assessment: { title: 'T', subject: 'S', status: 'published' }, questions: [reviewed('Q?')] })), 'VALIDATION_FAILED');
    assert.equal(code(() => service.createAssessmentWithQuestions(t1, { assessment: { title: 'T', subject: 'S' }, questions: [reviewed('Q?')], publish: true, universityId: 2 })), 'VALIDATION_FAILED');
    assert.equal(count('aia_assessments'), 0);
  });

  it('14/13. students (and non-teachers) cannot save', () => {
    assert.equal(code(() => service.createAssessmentWithQuestions(st1, { assessment: { title: 'T', subject: 'S' }, questions: [reviewed('Q?')] })), 'FORBIDDEN');
    assert.equal(code(() => service.assertTeacher(st1)), 'FORBIDDEN');
    assert.equal(count('aia_assessments'), 0);
  });

  it('15. tenant isolation: another school\'s class is refused, and the saved draft is private', () => {
    assert.equal(code(() => service.createAssessmentWithQuestions(t1, { assessment: { title: 'T', subject: 'S', classroomId: IDS.class20 }, questions: [reviewed('Q?')] })), 'VALIDATION_FAILED');
    assert.equal(count('aia_assessments'), 0);
    const a = service.createAssessmentWithQuestions(t1, { assessment: { title: 'T', subject: 'S' }, questions: [reviewed('Q?')] });
    assert.equal(code(() => service.getOwnAssessment(t3, a.id)), 'NOT_FOUND');
    assert.equal(code(() => service.resolveGenerationTarget(t1, IDS.class20)), 'VALIDATION_FAILED');
    assert.equal(service.resolveGenerationTarget(t1, IDS.class10).grade, '10');
  });

  it('Step 1 manual edit keeps working and can edit the explanation', () => {
    const a = service.createAssessmentWithQuestions(t1, { assessment: { title: 'T', subject: 'S' }, questions: [reviewed('Q?')] });
    const updated = service.updateQuestion(t1, a.id, a.questions[0].id, { ...reviewed('Q edited?', 2, 'New reason.'), difficulty: null });
    assert.deepEqual([updated.questions[0].text, updated.questions[0].explanation, updated.questions[0].difficulty], ['Q edited?', 'New reason.', null]);
  });
});

describe('migration 002 (explanation + difficulty columns)', () => {
  it('adds exactly two columns to aia_questions and nothing else; down removes them', () => {
    const cols = (d) => d.prepare('PRAGMA table_info(aia_questions)').all().map((c) => c.name);
    const d = new DatabaseSync(':memory:');
    for (const sql of LMS_TABLES) d.exec(sql);
    d.exec(fs.readFileSync(UP, 'utf8'));
    const before = cols(d);
    const objects = () => d.prepare('SELECT name FROM sqlite_master ORDER BY name').all().map((r) => r.name);
    const objectsBefore = objects();
    d.exec(fs.readFileSync(UP_002, 'utf8'));
    assert.deepEqual(cols(d), [...before, 'explanation', 'difficulty']);
    assert.deepEqual(objects(), objectsBefore);
    d.exec(fs.readFileSync(DOWN_002, 'utf8'));
    assert.deepEqual(cols(d), before);
  });

  it('the adapter is NOT ready with only migration 001 (writes would fail), and ready with both', () => {
    assert.equal(createSqliteAssessmentLmsAdapter(createLmsTestDb({ withStep2: false })).isReady(), false);
    assert.equal(createSqliteAssessmentLmsAdapter(createLmsTestDb()).isReady(), true);
  });

  it('the database refuses an unknown difficulty', () => {
    const a = service.createAssessmentWithQuestions(t1, { assessment: { title: 'T', subject: 'S' }, questions: [reviewed('Q?')] });
    assert.throws(() => db.prepare("UPDATE aia_questions SET difficulty = 'expert' WHERE assessment_id = ?").run(a.id), /CHECK/);
  });
});
