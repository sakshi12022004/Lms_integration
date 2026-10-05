// Live-readiness: the LIVE schema today is 001-005 (neither 006 nor 007). On a TEMP copy of that state:
// the old single-MCQ flow works, the new features are unavailable, and applying 006 then 007 with the real
// runner keeps every existing row and LMS table unchanged and enables both features.
// Plus: the AI write path can never touch the teacher's final marks. The live DB is never opened.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const { IDS, createLmsTestDbFile, mcq, multi } = require('./helpers/lmsTestDb');
const { createSqliteAssessmentLmsAdapter } = require('../backend/src/adapters/lms/SqliteAssessmentLmsAdapter');
const { AssessmentService } = require('../backend/src/core/AssessmentService');
const { AttemptService } = require('../backend/src/core/AttemptService');
const { AssignmentService } = require('../backend/src/assignments/AssignmentService');

const LIVE_DB = path.resolve(__dirname, '../../../server/data/lms_permanent.db');
const liveMtime = () => (fs.existsSync(LIVE_DB) ? fs.statSync(LIVE_DB).mtimeMs : null);
const T1 = { userId: IDS.teacher1, universityId: IDS.school1, kind: 'teacher' };
const S1 = { userId: IDS.student1, universityId: IDS.school1, kind: 'student' };
const code = (fn) => { try { fn(); } catch (e) { return e.code; } return 'ok'; };
const dumpAll = (db) => Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
  .map((t) => [t.name, JSON.stringify(db.prepare(`SELECT * FROM ${t.name}`).all())]));
// 006 adds question columns + aia_attempt_responses and drops only uq_aia_options_one_correct (by design).
const schemaOf = (db) => db.prepare("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '%aia_assignment%' AND name NOT IN ('aia_attempt_responses', 'aia_questions', 'uq_aia_options_one_correct') ORDER BY name").all().map((r) => ({ ...r }));

describe('live readiness: exact 001-005 state (no 006, no 007)', () => {
  const liveBefore = liveMtime();
  const file = createLmsTestDbFile({ withQuestionTypes: false, withAssignments: false });

  it('single-MCQ assessments work; new question types and assignments are unavailable (safe 503s)', () => {
    const db = new DatabaseSync(file.dbPath);
    try {
      const adapter = createSqliteAssessmentLmsAdapter(db);
      assert.deepEqual([adapter.isReady(), adapter.supportsQuestionTypes(), adapter.supportsAssignments()], [true, false, false]);
      const svc = new AssessmentService({ adapter });
      const att = new AttemptService({ adapter });
      const a = svc.createAssessment(T1, { title: 'Pre-006 test', subject: 'Maths', classroomId: IDS.class10 });
      assert.equal(code(() => svc.addQuestion(T1, a.id, multi())), 'QUESTION_TYPES_NOT_READY');
      svc.addQuestion(T1, a.id, mcq());
      svc.publish(T1, a.id);
      const { attempt } = att.startAttempt(S1, a.id);
      att.saveAnswer(S1, attempt.id, attempt.questions[0].id, { optionPosition: 1 });
      assert.equal(att.submit(S1, attempt.id).attempt.result.score, 1);
      assert.throws(() => new AssignmentService({ adapter }), (e) => e.code === 'ASSIGNMENTS_NOT_READY' && e.statusCode === 503);
    } finally { db.close(); }
  });

  it('runner applies 006 then 007 (skipping 001-005); all existing rows + LMS tables unchanged; both features then work', () => {
    const before = (() => { const db = new DatabaseSync(file.dbPath, { readOnly: true }); try { return { data: dumpAll(db), schema: schemaOf(db) }; } finally { db.close(); } })();
    const out = execFileSync(process.execPath, [path.resolve(__dirname, '../backend/scripts/applyMigration.js'), '--db', file.dbPath, '--yes'], { encoding: 'utf8' });
    assert.match(out, /skip 001[\s\S]*skip 005_aia_attempt_archive[\s\S]*applied 006_aia_question_types[\s\S]*applied 007_aia_assignments/);
    const db = new DatabaseSync(file.dbPath);
    try {
      const after = dumpAll(db);
      for (const [table, rows] of Object.entries(before.data)) {
        if (table === 'aia_questions') { // gained 3 columns: old values identical, new ones default
          const cols = db.prepare('SELECT id, assessment_id, position, text, created_at, updated_at, explanation, difficulty FROM aia_questions').all();
          assert.equal(JSON.stringify(cols), rows);
          assert.deepEqual(db.prepare('SELECT DISTINCT question_type, numeric_answer FROM aia_questions').all().map((r) => ({ ...r })), [{ question_type: 'single_mcq', numeric_answer: null }]);
        } else assert.equal(after[table], rows, table);
      }
      assert.deepEqual(schemaOf(db), before.schema);
      const adapter = createSqliteAssessmentLmsAdapter(db);
      assert.deepEqual([adapter.supportsQuestionTypes(), adapter.supportsAssignments()], [true, true]);
      const svc = new AssessmentService({ adapter });
      const a = svc.createAssessment(T1, { title: 'Post-006', subject: 'Maths' });
      assert.equal(svc.addQuestion(T1, a.id, multi()).questions[0].type, 'multi_select');
      assert.equal(new AssignmentService({ adapter }).create(T1, { title: 'Post-007', classroomId: IDS.class10, maxMarks: 5 }).status, 'draft');
    } finally { db.close(); file.cleanup(); }
  });

  it('never touched the live LMS database', () => {
    assert.equal(liveMtime(), liveBefore);
  });
});

describe('AI can never write the teacher\'s final evaluation', () => {
  it('the only AI write (setSubmissionAiEvaluation) updates ai_* columns only', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../backend/src/adapters/lms/sqliteAssignmentStore.js'), 'utf8');
    const fn = src.slice(src.indexOf('setSubmissionAiEvaluation('), src.indexOf('getRedactionNames('));
    const setClause = /SET([\s\S]*?)WHERE/.exec(fn)[1];
    const columns = setClause.split(',').map((c) => c.trim().split(/\s*=/)[0]).filter(Boolean);
    assert.deepEqual(columns, ['ai_marks', 'ai_feedback', 'ai_question_marks_json', 'ai_limitations_json', 'ai_evaluated_at', 'updated_at']);
    for (const forbidden of ['final_marks', 'final_question_marks_json', 'teacher_feedback', 'evaluated_by', 'evaluated_at', 'status']) {
      assert.equal(columns.includes(forbidden), false, forbidden);
    }
  });
});
