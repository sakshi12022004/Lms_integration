// Migration 008 (recipients + shared reports): additive, preserves 001-007 data, has a rollback, runner support.
// Temp/in-memory databases only; the live LMS database is never opened (mtime asserted).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { IDS, UP_008, DOWN_008, createLmsTestDb, createLmsTestDbFile, mcq } = require('../helpers/lmsTestDb');
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
const NEW = ['aia_assessment_recipients', 'aia_performance_reports'];
const dumpOld = (db) => master(db).filter((r) => r.type === 'table' && !NEW.includes(r.name)).map((t) => JSON.stringify(rows(db, `SELECT * FROM ${t.name}`)));

function populated() {
  const db = createLmsTestDb({ withRecipientsReports: false });
  const adapter = createSqliteAssessmentLmsAdapter(db);
  const svc = new AssessmentService({ adapter });
  const a = svc.createAssessment(T1, { title: 'Before 008', subject: 'Maths', classroomId: IDS.class10 });
  svc.addQuestion(T1, a.id, mcq());
  svc.publish(T1, a.id);
  const att = new AttemptService({ adapter });
  const { attempt } = att.startAttempt(S1, a.id);
  att.submit(S1, attempt.id);
  return { db, id: a.id };
}

describe('migration 008', () => {
  it('adds ONLY the two new tables; every 001-007 table and row is unchanged; existing tests stay whole-class', () => {
    const { db, id } = populated();
    const schemaBefore = master(db);
    const dataBefore = dumpOld(db);
    db.exec(fs.readFileSync(UP_008, 'utf8'));
    const added = master(db).filter((r) => !schemaBefore.some((b) => b.name === r.name));
    assert.deepEqual(added.filter((r) => r.type === 'table').map((r) => r.name).sort(), NEW);
    assert.deepEqual(master(db).filter((r) => schemaBefore.some((b) => b.name === r.name)), schemaBefore);
    assert.deepEqual(dumpOld(db), dataBefore);
    const adapter = createSqliteAssessmentLmsAdapter(db);
    assert.equal(adapter.supportsRecipientsReports(), true);
    assert.equal(adapter.isAssessmentRecipient(IDS.school1, id, IDS.student1), true); // no rows = whole class
    assert.equal(new AssessmentService({ adapter }).listAvailableForStudent(S1).length, 1);
    db.exec(fs.readFileSync(UP_008, 'utf8')); // idempotent
  });

  it('the rollback removes only the 008 tables', () => {
    const { db } = populated();
    const schemaBefore = master(db);
    const dataBefore = dumpOld(db);
    db.exec(fs.readFileSync(UP_008, 'utf8'));
    db.exec(fs.readFileSync(DOWN_008, 'utf8'));
    assert.deepEqual(master(db), schemaBefore);
    assert.deepEqual(dumpOld(db), dataBefore);
  });

  it('the runner applies and rolls back 008 on a temp file (--only 008)', () => {
    const file = createLmsTestDbFile({ withRecipientsReports: false });
    try {
      const run = (...extra) => execFileSync(process.execPath, [path.resolve(__dirname, '../../backend/scripts/applyMigration.js'), '--db', file.dbPath, ...extra, '--yes'], { encoding: 'utf8' });
      assert.match(run('--only', '008'), /applied 008_aia_recipients_reports/);
      assert.match(run('--only', '008'), /skip 008_aia_recipients_reports \(already applied\)/);
      assert.match(run('--down', '--only', '008'), /rolled back 008_aia_recipients_reports/);
    } finally {
      file.cleanup();
    }
  });

  it('never touched the live LMS database', () => {
    assert.equal(liveMtime(), liveBefore);
  });
});
