// Migration 006 (question types): backward compatibility with EXISTING single-answer MCQ data.
// Temp/in-memory databases only; the live LMS database is never opened (mtime asserted).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const { IDS, UP_006, DOWN_006, createLmsTestDb, createLmsTestDbFile, mcq } = require('../helpers/lmsTestDb');
const { createSqliteAssessmentLmsAdapter } = require('../../backend/src/adapters/lms/SqliteAssessmentLmsAdapter');
const { AssessmentService } = require('../../backend/src/core/AssessmentService');
const { AttemptService } = require('../../backend/src/core/AttemptService');

const LIVE_DB = path.resolve(__dirname, '../../../../server/data/lms_permanent.db');
const liveMtime = () => (fs.existsSync(LIVE_DB) ? fs.statSync(LIVE_DB).mtimeMs : null);
const liveBefore = liveMtime();

const T1 = { userId: IDS.teacher1, universityId: IDS.school1, kind: 'teacher' };
const S1 = { userId: IDS.student1, universityId: IDS.school1, kind: 'student' };
const T0 = Date.parse('2026-09-29T10:00:00.000Z');

/** A 001-005 database (the live schema today) holding real-looking single-MCQ activity. */
function populatedPre006() {
  const db = createLmsTestDb({ withQuestionTypes: false });
  const adapter = createSqliteAssessmentLmsAdapter(db);
  let clock = T0;
  const now = () => clock;
  const svc = new AssessmentService({ adapter, now });
  const att = new AttemptService({ adapter, now });
  const make = (title) => {
    const a = svc.createAssessment(T1, { title, subject: 'Maths', classroomId: IDS.class10, durationMinutes: 30 });
    svc.addQuestion(T1, a.id, { ...mcq('What is 2 + 2?', 1), explanation: 'Four.', difficulty: 'easy' });
    svc.addQuestion(T1, a.id, mcq('What is 10 + 12?', 3));
    return svc.publish(T1, a.id);
  };
  const finished = make('Finished before 006');
  const inProgress = make('In progress across 006');
  const archived = make('Reset before 006');
  // finished: 1 right, 1 wrong
  let { attempt } = att.startAttempt(S1, finished.id);
  att.saveAnswer(S1, attempt.id, attempt.questions[0].id, { optionPosition: 1 });
  att.saveAnswer(S1, attempt.id, attempt.questions[1].id, { optionPosition: 0 });
  att.submit(S1, attempt.id);
  // archived: submitted, then reset by the teacher (history row with answers_json)
  ({ attempt } = att.startAttempt(S1, archived.id));
  att.saveAnswer(S1, attempt.id, attempt.questions[0].id, { optionPosition: 1 });
  att.submit(S1, attempt.id);
  att.resetAttempt(T1, archived.id, IDS.student1);
  // in progress: one answer saved, not submitted
  ({ attempt } = att.startAttempt(S1, inProgress.id));
  att.saveAnswer(S1, attempt.id, attempt.questions[0].id, { optionPosition: 1 });
  clock += 60000;
  return { db, ids: { finished: finished.id, inProgress: inProgress.id, archived: archived.id }, inProgressAttemptId: attempt.id, setClock: (ms) => { clock = ms; } };
}

const rows = (db, sql) => db.prepare(sql).all().map((r) => ({ ...r }));
/** Every pre-006 aia_* row, excluding only the new columns. */
function dumpPre006(db) {
  return {
    assessments: rows(db, 'SELECT * FROM aia_assessments ORDER BY id'),
    questions: rows(db, 'SELECT id, assessment_id, position, text, explanation, difficulty, created_at, updated_at FROM aia_questions ORDER BY id'),
    options: rows(db, 'SELECT * FROM aia_options ORDER BY id'),
    attempts: rows(db, 'SELECT * FROM aia_attempts ORDER BY id'),
    answers: rows(db, 'SELECT * FROM aia_attempt_answers ORDER BY attempt_id, question_id'),
    archive: rows(db, 'SELECT * FROM aia_attempt_archive ORDER BY id'),
  };
}
const LMS_TABLE_NAMES = ['users', 'universities', 'classrooms', 'student_classroom_assignment', 'courses', 'assessments', 'assessment_questions'];
const lmsDump = (db) => LMS_TABLE_NAMES.map((t) => JSON.stringify(rows(db, `SELECT * FROM ${t} ORDER BY id`)));
const master = (db) => rows(db, "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
const shape = (db) => master(db).map((r) => ({
  type: r.type, name: r.name,
  columns: r.type === 'table' ? rows(db, `PRAGMA table_info(${r.name})`).map((c) => `${c.name}:${c.type}:${c.notnull}:${c.dflt_value}:${c.pk}`) : undefined,
  sql: r.type === 'index' ? r.sql : undefined,
}));

describe('migration 006: existing single-answer MCQ data is preserved', () => {
  it('changes no existing aia_* row; every existing question becomes single_mcq with no numeric data', () => {
    const { db } = populatedPre006();
    const before = dumpPre006(db);
    assert.equal(before.archive.length, 1);
    db.exec(fs.readFileSync(UP_006, 'utf8'));
    assert.deepEqual(dumpPre006(db), before);
    const types = rows(db, 'SELECT question_type, numeric_answer, numeric_format FROM aia_questions');
    assert.equal(types.length, 6);
    for (const t of types) assert.deepEqual(t, { question_type: 'single_mcq', numeric_answer: null, numeric_format: null });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM aia_attempt_responses').get().n, 0);
  });

  it('leaves every LMS table (legacy assessments included) byte-identical, rows and definitions', () => {
    const { db } = populatedPre006();
    const lmsSchema = () => master(db).filter((r) => !/^(aia_|idx_aia_|uq_aia_)/.test(r.name));
    const [rowsBefore, schemaBefore] = [lmsDump(db), lmsSchema()];
    db.exec(fs.readFileSync(UP_006, 'utf8'));
    assert.deepEqual(lmsDump(db), rowsBefore);
    assert.deepEqual(lmsSchema(), schemaBefore);
  });

  it('is additive: adds 3 question columns + aia_attempt_responses, drops only the one-correct index', () => {
    const pre = createLmsTestDb({ withQuestionTypes: false });
    const post = createLmsTestDb();
    const names = (db) => master(db).map((r) => r.name);
    assert.deepEqual(names(post).filter((n) => !names(pre).includes(n)), ['aia_attempt_responses']);
    assert.deepEqual(names(pre).filter((n) => !names(post).includes(n)), ['uq_aia_options_one_correct']);
    const cols = (db) => rows(db, 'PRAGMA table_info(aia_questions)').map((c) => c.name);
    assert.deepEqual(cols(post).filter((c) => !cols(pre).includes(c)), ['question_type', 'numeric_answer', 'numeric_format']);
    for (const t of ['aia_assessments', 'aia_options', 'aia_attempts', 'aia_attempt_answers', 'aia_attempt_archive']) {
      assert.equal(post.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(t).sql, pre.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(t).sql, t);
    }
    for (const fk of post.prepare('PRAGMA foreign_key_list(aia_attempt_responses)').all()) assert.ok(fk.table.startsWith('aia_'), fk.table);
  });

  it('a test finished before 006 keeps its result; a test IN PROGRESS across 006 grades exactly as before', () => {
    const { db, ids, inProgressAttemptId } = populatedPre006();
    db.exec(fs.readFileSync(UP_006, 'utf8'));
    const adapter = createSqliteAssessmentLmsAdapter(db);
    const now = () => T0 + 120000;
    const att = new AttemptService({ adapter, now });
    const report = att.report(T1, ids.finished);
    assert.deepEqual([report.students[0].score, report.students[0].percentage], [1, 50]);
    const attempt = att.getAttempt(S1, inProgressAttemptId);
    assert.equal(attempt.answers[0].optionPosition, 1); // the answer saved before 006 is still there
    att.saveAnswer(S1, inProgressAttemptId, attempt.questions[1].id, { optionPosition: 3 });
    const done = att.submit(S1, inProgressAttemptId).attempt;
    assert.deepEqual([done.result.score, done.result.percentage], [2, 100]);
    assert.equal(att.report(T1, ids.archived).students[0].previousAttempts.length, 1);
  });

  it('existing single-answer MCQ rules still hold after 006 (one correct option, 4 options)', () => {
    const db = createLmsTestDb();
    const svc = new AssessmentService({ adapter: createSqliteAssessmentLmsAdapter(db) });
    const a = svc.createAssessment(T1, { title: 'x', subject: 'y' });
    const two = mcq();
    two.options[0].isCorrect = true;
    assert.throws(() => svc.addQuestion(T1, a.id, two), (e) => e.details.some((d) => d.code === 'MULTIPLE_CORRECT_OPTIONS'));
    assert.equal(svc.addQuestion(T1, a.id, mcq()).questions[0].options.filter((o) => o.isCorrect).length, 1);
  });

  it('aia_attempt_responses holds exactly one kind of answer per row', () => {
    const db = createLmsTestDb();
    db.exec('PRAGMA foreign_keys = OFF');
    assert.throws(() => db.exec("INSERT INTO aia_attempt_responses (attempt_id, question_id) VALUES (1, 1)"), /CHECK/);
    assert.throws(() => db.exec("INSERT INTO aia_attempt_responses (attempt_id, question_id, selected_positions, numeric_value) VALUES (1, 1, '[0]', '1')"), /CHECK/);
    assert.throws(() => db.exec("INSERT INTO aia_questions (assessment_id, position, text, question_type) VALUES (1, 1, 'q', 'essay')"), /CHECK/);
    assert.throws(() => db.exec("INSERT INTO aia_questions (assessment_id, position, text, numeric_format) VALUES (1, 1, 'q', 'fraction')"), /CHECK/);
  });
});

describe('migration 006: rollback', () => {
  it('down restores the 001-005 schema exactly (tables, columns, indexes) and keeps single-MCQ data', () => {
    const { db } = populatedPre006();
    const expected = shape(db);
    const data = dumpPre006(db);
    db.exec(fs.readFileSync(UP_006, 'utf8'));
    db.exec(fs.readFileSync(DOWN_006, 'utf8'));
    assert.deepEqual(shape(db), expected);
    assert.deepEqual(dumpPre006(db), data);
  });

  it('down REFUSES while a multiple-select or numerical question exists, and changes nothing', () => {
    for (const type of ['multi_select', 'numerical']) {
      const db = createLmsTestDb();
      db.exec("INSERT INTO aia_assessments (university_id, teacher_id, title, subject) VALUES (1, 1, 't', 's')");
      db.exec(`INSERT INTO aia_questions (assessment_id, position, text, question_type) VALUES (1, 1, 'q', '${type}')`);
      const before = shape(db);
      db.exec('BEGIN');
      assert.throws(() => db.exec(fs.readFileSync(DOWN_006, 'utf8')), /CHECK constraint failed/);
      db.exec('ROLLBACK');
      assert.deepEqual(shape(db), before, type);
    }
  });
});

describe('migration 006: the runner script (temp database file)', () => {
  const RUNNER = path.resolve(__dirname, '../../backend/scripts/applyMigration.js');
  const run = (...args) => execFileSync(process.execPath, [RUNNER, ...args], { encoding: 'utf8' });

  it('--only 006 applies 006 to a 001-005 database, skips it when re-run, and rolls it back', () => {
    const file = createLmsTestDbFile({ withQuestionTypes: false });
    try {
      assert.match(run('--db', file.dbPath, '--only', '006', '--yes'), /applied 006_aia_question_types/);
      assert.match(run('--db', file.dbPath, '--only', '006', '--yes'), /skip 006_aia_question_types \(already applied\)/);
      assert.match(run('--db', file.dbPath, '--yes'), /skip 005_aia_attempt_archive[\s\S]*skip 006_aia_question_types/);
      const out = run('--db', file.dbPath, '--down', '--only', '006', '--yes');
      assert.match(out, /rolled back 006_aia_question_types/);
      assert.match(out, /aia_attempt_archive/); // 005 and earlier untouched
      const db = new DatabaseSync(file.dbPath, { readOnly: true });
      try {
        assert.equal(rows(db, 'PRAGMA table_info(aia_questions)').some((c) => c.name === 'question_type'), false);
        assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'aia_attempt_archive'").get());
      } finally { db.close(); }
    } finally { file.cleanup(); }
  });

  it('rejects an unknown --only value', () => {
    assert.throws(() => run('--db', path.join(os.tmpdir(), 'nope.db'), '--only', '999', '--yes'));
  });

  it('never touched the live LMS database', () => {
    assert.equal(liveMtime(), liveBefore);
  });
});
