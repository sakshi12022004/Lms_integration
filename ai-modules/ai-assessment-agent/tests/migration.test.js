const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { LMS_TABLES, UP, DOWN, createLmsTestDb } = require('./helpers/lmsTestDb');

const schema = (db) => db.prepare("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => ({ ...r }));
const lmsOnly = (rows) => rows.filter((r) => !r.name.startsWith('aia_') && !r.name.startsWith('idx_aia_') && !r.name.startsWith('uq_aia_'));

describe('001_aia_assessments migration (existing LMS schema stays unchanged)', () => {
  it('adds only aia_* tables/indexes and leaves every LMS table (incl. legacy assessments) byte-identical', () => {
    const before = schema(createLmsTestDb({ withMigration: false }));
    const after = schema(createLmsTestDb({ withMigration: true, withStep2: false })); // 001 only (003 is tested in tests/attempts)
    assert.deepEqual(lmsOnly(after), before);
    const added = after.filter((r) => !before.some((b) => b.name === r.name)).map((r) => r.name).sort();
    assert.deepEqual(added, [
      'aia_assessments', 'aia_options', 'aia_questions',
      'idx_aia_assessments_class', 'idx_aia_assessments_owner', 'idx_aia_questions_assessment', 'uq_aia_options_one_correct',
    ]);
  });

  it('does not change existing rows (legacy assessments included)', () => {
    const db = createLmsTestDb({ withMigration: false });
    db.exec('PRAGMA foreign_keys = OFF'); // legacy assessments references `weeks`, which the fixture omits
    db.exec("INSERT INTO courses (id, title) VALUES (1, 'C')");
    db.exec("INSERT INTO assessments (courseId, title, startTime, endTime, createdBy) VALUES (1, 'Legacy', '2026-01-01', '2026-01-02', 1)");
    const dump = () => ['users', 'universities', 'classrooms', 'student_classroom_assignment', 'courses', 'assessments']
      .map((t) => JSON.stringify(db.prepare(`SELECT * FROM ${t} ORDER BY id`).all()));
    const before = dump();
    db.exec(fs.readFileSync(UP, 'utf8'));
    assert.deepEqual(dump(), before);
  });

  it('declares no foreign key into any LMS table', () => {
    const db = createLmsTestDb();
    for (const t of ['aia_assessments', 'aia_questions', 'aia_options']) {
      for (const fk of db.prepare(`PRAGMA foreign_key_list(${t})`).all()) {
        assert.ok(fk.table.startsWith('aia_'), `${t} references ${fk.table}`);
      }
    }
  });

  it('is idempotent and the down migration removes only aia_* objects', () => {
    const db = createLmsTestDb({ withStep2: false }); // 001 only; the runner rolls back 003/002 before 001
    db.exec(fs.readFileSync(UP, 'utf8')); // second run is a no-op
    db.exec(fs.readFileSync(DOWN, 'utf8'));
    assert.deepEqual(schema(db), schema(createLmsTestDb({ withMigration: false })));
  });

  it('applies on a database that has only the LMS tables it reads', () => {
    const db = new DatabaseSync(':memory:');
    for (const sql of LMS_TABLES) db.exec(sql);
    assert.doesNotThrow(() => db.exec(fs.readFileSync(UP, 'utf8')));
  });
});
