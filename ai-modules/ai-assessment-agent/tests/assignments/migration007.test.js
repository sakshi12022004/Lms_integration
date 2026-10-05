// Migration 007 (Descriptive Assignments): additive, preserves 001-006 data, has a rollback, runner support.
// Temp/in-memory databases only; the live LMS database is never opened (mtime asserted).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const { IDS, UP_007, DOWN_007, createLmsTestDb, createLmsTestDbFile, mcq, multi } = require('../helpers/lmsTestDb');
const { createSqliteAssessmentLmsAdapter } = require('../../backend/src/adapters/lms/SqliteAssessmentLmsAdapter');
const { AssessmentService } = require('../../backend/src/core/AssessmentService');
const { AttemptService } = require('../../backend/src/core/AttemptService');

const LIVE_DB = path.resolve(__dirname, '../../../../server/data/lms_permanent.db');
const liveMtime = () => (fs.existsSync(LIVE_DB) ? fs.statSync(LIVE_DB).mtimeMs : null);
const liveBefore = liveMtime();
const T1 = { userId: IDS.teacher1, universityId: IDS.school1, kind: 'teacher' };
const S1 = { userId: IDS.student1, universityId: IDS.school1, kind: 'student' };
const rows = (db, sql) => db.prepare(sql).all().map((r) => ({ ...r }));
const master = (db) => rows(db, "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
const dumpAll = (db) => master(db).filter((r) => r.type === 'table' && !r.name.startsWith('aia_assignment')).map((t) => JSON.stringify(rows(db, `SELECT * FROM ${t.name}`)));

/** 001-006 database with an assessment, questions of every type, an attempt and answers. */
function populated() {
  const db = createLmsTestDb({ withAssignments: false });
  const adapter = createSqliteAssessmentLmsAdapter(db);
  const svc = new AssessmentService({ adapter });
  const att = new AttemptService({ adapter });
  const a = svc.createAssessment(T1, { title: 'Before 007', subject: 'Maths', classroomId: IDS.class10 });
  svc.addQuestion(T1, a.id, mcq());
  svc.addQuestion(T1, a.id, multi());
  svc.publish(T1, a.id);
  const { attempt } = att.startAttempt(S1, a.id);
  att.saveAnswer(S1, attempt.id, attempt.questions[0].id, { optionPosition: 1 });
  att.saveAnswer(S1, attempt.id, attempt.questions[1].id, { optionPositions: [1, 3] });
  att.submit(S1, attempt.id);
  return db;
}

describe('migration 007', () => {
  it('adds exactly the three assignment tables (+ indexes) and leaves every existing table and row unchanged', () => {
    const db = populated();
    const before = { schema: master(db), data: dumpAll(db) };
    db.exec(fs.readFileSync(UP_007, 'utf8'));
    const after = master(db);
    assert.deepEqual(after.filter((r) => !before.schema.some((b) => b.name === r.name)).map((r) => r.name).sort(), [
      'aia_assignment_questions', 'aia_assignment_submissions', 'aia_assignments',
      'idx_aia_assignment_submissions_student', 'idx_aia_assignments_class', 'idx_aia_assignments_owner',
    ]);
    assert.deepEqual(after.filter((r) => before.schema.some((b) => b.name === r.name)), before.schema);
    assert.deepEqual(dumpAll(db), before.data);
  });

  it('is independent of 006 (applies on a 001-005 database) and declares no FK into LMS tables', () => {
    const db = createLmsTestDb({ withQuestionTypes: false, withAssignments: false });
    assert.doesNotThrow(() => db.exec(fs.readFileSync(UP_007, 'utf8')));
    for (const t of ['aia_assignments', 'aia_assignment_questions', 'aia_assignment_submissions']) {
      for (const fk of db.prepare(`PRAGMA foreign_key_list(${t})`).all()) assert.ok(fk.table.startsWith('aia_'), `${t} -> ${fk.table}`);
    }
  });

  it('submissions keep AI suggestions (ai_*, incl. ai_limitations_json) apart from the teacher final_* marks', () => {
    const cols = createLmsTestDb().prepare('PRAGMA table_info(aia_assignment_submissions)').all().map((c) => c.name);
    for (const c of ['ai_marks', 'ai_feedback', 'ai_question_marks_json', 'ai_limitations_json', 'ai_evaluated_at', 'final_marks', 'teacher_feedback', 'final_question_marks_json', 'evaluated_by']) assert.ok(cols.includes(c), c);
  });

  it('constraints: one current submission per student, statuses, PDF only, evaluated needs final marks', () => {
    const db = createLmsTestDb();
    db.exec("INSERT INTO aia_assignments (university_id, teacher_id, classroom_id, title, max_marks) VALUES (1, 1, 10, 'A', 10)");
    const sub = (key, extra = '') => db.exec(`INSERT INTO aia_assignment_submissions (university_id, assignment_id, student_id, storage_key, original_filename, file_size, sha256, submitted_at${extra ? ', ' + extra.split('=')[0] : ''})
      VALUES (1, 1, 4, '${key}', 'a.pdf', 10, 'x', '2026-01-01T00:00:00Z'${extra ? ', ' + extra.split('=')[1] : ''})`);
    sub('k1');
    assert.throws(() => sub('k2'), /UNIQUE/); // same student + assignment
    assert.throws(() => db.exec("INSERT INTO aia_assignments (university_id, teacher_id, classroom_id, title, max_marks, status) VALUES (1, 1, 10, 'B', 10, 'archived')"), /CHECK/);
    assert.throws(() => db.exec("INSERT INTO aia_assignments (university_id, teacher_id, classroom_id, title, max_marks) VALUES (1, 1, 10, 'B', 0)"), /CHECK/);
    db.exec('DELETE FROM aia_assignment_submissions');
    assert.throws(() => sub('k3', "content_type='text/html'"), /CHECK/);
    assert.throws(() => sub('k4', "status='evaluated'"), /CHECK/); // evaluated without final marks
  });

  it('down removes exactly the three tables and keeps 001-006 data', () => {
    const db = populated();
    const before = { schema: master(db), data: dumpAll(db) };
    db.exec(fs.readFileSync(UP_007, 'utf8'));
    db.exec(fs.readFileSync(DOWN_007, 'utf8'));
    assert.deepEqual(master(db), before.schema);
    assert.deepEqual(dumpAll(db), before.data);
  });

  it('runner: --only 007 applies, skips when re-run, and rolls back (temp file)', () => {
    const RUNNER = path.resolve(__dirname, '../../backend/scripts/applyMigration.js');
    const run = (...args) => execFileSync(process.execPath, [RUNNER, ...args], { encoding: 'utf8' });
    const file = createLmsTestDbFile({ withAssignments: false });
    try {
      assert.match(run('--db', file.dbPath, '--only', '007', '--yes'), /applied 007_aia_assignments/);
      assert.match(run('--db', file.dbPath, '--only', '007', '--yes'), /skip 007_aia_assignments \(already applied\)/);
      assert.match(run('--db', file.dbPath, '--down', '--only', '007', '--yes'), /rolled back 007_aia_assignments/);
      const db = new DatabaseSync(file.dbPath, { readOnly: true });
      try {
        assert.equal(!!db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'aia_assignments'").get(), false);
        assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'aia_attempt_responses'").get()); // 006 untouched
      } finally { db.close(); }
    } finally { file.cleanup(); }
  });

  it('never touched the live LMS database', () => {
    assert.equal(liveMtime(), liveBefore);
  });
});
