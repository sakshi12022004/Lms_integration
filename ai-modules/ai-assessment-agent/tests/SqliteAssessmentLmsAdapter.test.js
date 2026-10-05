const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createSqliteAssessmentLmsAdapter } = require('../backend/src/adapters/lms/SqliteAssessmentLmsAdapter');
const { assertAssessmentLmsAdapter } = require('../backend/src/adapters/lms/AssessmentLmsAdapter');
const { AssessmentService } = require('../backend/src/core/AssessmentService');
const { IDS, createLmsTestDb } = require('./helpers/lmsTestDb');

const code = (fn) => { try { fn(); } catch (err) { return err.code; } assert.fail('expected an error'); };

describe('SqliteAssessmentLmsAdapter.resolveActor (session -> verified actor)', () => {
  const adapter = createSqliteAssessmentLmsAdapter(createLmsTestDb());

  it('builds a frozen actor from the session and the LMS database', () => {
    const actor = adapter.resolveActor({ userId: IDS.teacher1, universityId: IDS.school1, role: 'mentor' });
    assert.deepEqual(actor, { userId: IDS.teacher1, universityId: IDS.school1, kind: 'teacher' });
    assert.ok(Object.isFrozen(actor));
    assert.equal(adapter.resolveActor({ userId: String(IDS.student1), universityId: String(IDS.school1), role: 'student' }).kind, 'student');
  });

  it('refuses a session whose school does not match the user\'s school', () => {
    assert.equal(code(() => adapter.resolveActor({ userId: IDS.teacher1, universityId: IDS.school2, role: 'mentor' })), 'TENANT_MISMATCH');
  });

  it('refuses unknown users and schools', () => {
    assert.equal(code(() => adapter.resolveActor({ userId: 999, universityId: IDS.school1, role: 'mentor' })), 'TENANT_MISMATCH');
    assert.equal(code(() => adapter.resolveActor({ userId: IDS.teacher1, universityId: 999, role: 'mentor' })), 'TENANT_MISMATCH');
  });

  it('takes the role from the database, not from the token', () => {
    // A token still claiming "mentor" for a user who is a student in the LMS.
    assert.equal(adapter.resolveActor({ userId: IDS.student1, universityId: IDS.school1, role: 'mentor' }).kind, 'student');
  });

  it('refuses missing/invalid ids and non-teacher, non-student roles', () => {
    for (const s of [undefined, null, {}, { userId: 0, universityId: 1 }, { userId: 'abc', universityId: 1 }, { userId: 1, universityId: null }]) {
      assert.equal(code(() => adapter.resolveActor(s)), 'FORBIDDEN');
    }
    assert.equal(code(() => adapter.resolveActor({ userId: IDS.admin1, universityId: IDS.school1, role: 'admin' })), 'FORBIDDEN');
  });
});

describe('adapter readiness and contract', () => {
  it('isReady is false until the migration is applied, and nothing creates tables implicitly', () => {
    const db = createLmsTestDb({ withMigration: false });
    const adapter = createSqliteAssessmentLmsAdapter(db);
    assert.equal(adapter.isReady(), false);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'aia_%'").get().n, 0);
  });

  it('isReady is true with the migration', () => {
    assert.equal(createSqliteAssessmentLmsAdapter(createLmsTestDb()).isReady(), true);
  });

  it('the service refuses an incomplete adapter', () => {
    assert.throws(() => new AssessmentService({ adapter: { resolveActor() {} } }), /missing: getClassroom/);
    assert.doesNotThrow(() => assertAssessmentLmsAdapter(createSqliteAssessmentLmsAdapter(createLmsTestDb())));
  });

  it('transaction rolls back everything when the callback throws', () => {
    const db = createLmsTestDb();
    const adapter = createSqliteAssessmentLmsAdapter(db);
    assert.throws(() => adapter.transaction(() => {
      adapter.insertAssessment({ universityId: 1, teacherId: 1, title: 't', description: '', subject: 's', classroomId: null, durationMinutes: null });
      throw new Error('boom');
    }), /boom/);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM aia_assessments').get().n, 0);
  });
});
