/**
 * Applies (or rolls back) the assessment agent's migrations to ONE SQLite file.
 * Deliberately explicit: the database path and --yes are required, nothing
 * runs automatically at server start, and it prints the aia_* state after.
 *
 *   node backend/scripts/applyMigration.js --db <absolute path to .db> --yes          # 001 ... 008
 *   node backend/scripts/applyMigration.js --db <absolute path to .db> --down --yes   # 008 ... 001 down
 *   add --only 006 / --only 007 / --only 008 to apply/roll back just that one migration (the earlier ones must be in place)
 *
 * Already-applied migrations are skipped. Everything runs in one transaction.
 * Back up the database file first.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../src/adapters/lms/migrations');
const hasTable = (db, name) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
const hasColumn = (db, table, column) => hasTable(db, table) && db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);

const MIGRATIONS = [
  { name: '001_aia_assessments', isApplied: (db) => hasTable(db, 'aia_assessments') && hasTable(db, 'aia_questions') && hasTable(db, 'aia_options') },
  { name: '002_aia_question_explanation', isApplied: (db) => hasColumn(db, 'aia_questions', 'explanation') },
  { name: '003_aia_attempts', isApplied: (db) => hasTable(db, 'aia_attempts') && hasTable(db, 'aia_attempt_answers') },
  { name: '004_aia_assessment_window', isApplied: (db) => hasColumn(db, 'aia_assessments', 'closed_at') },
  { name: '005_aia_attempt_archive', isApplied: (db) => hasTable(db, 'aia_attempt_archive') },
  { name: '006_aia_question_types', isApplied: (db) => hasColumn(db, 'aia_questions', 'question_type') && hasTable(db, 'aia_attempt_responses') },
  { name: '007_aia_assignments', isApplied: (db) => hasTable(db, 'aia_assignments') && hasTable(db, 'aia_assignment_questions') && hasTable(db, 'aia_assignment_submissions') },
  { name: '008_aia_recipients_reports', isApplied: (db) => hasTable(db, 'aia_assessment_recipients') && hasTable(db, 'aia_performance_reports') },
];

const args = process.argv.slice(2);
const dbIndex = args.indexOf('--db');
const dbPath = dbIndex >= 0 ? args[dbIndex + 1] : undefined;
const down = args.includes('--down');
const onlyIndex = args.indexOf('--only');
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;

if (!dbPath || !path.isAbsolute(dbPath) || !args.includes('--yes') || (onlyIndex >= 0 && !MIGRATIONS.some((m) => m.name.startsWith(`${only}_`)))) {
  console.error('Usage: node backend/scripts/applyMigration.js --db <absolute path> [--down] [--only 006|007|008] --yes');
  process.exit(1);
}
if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found: ${dbPath}`);
  process.exit(1);
}

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e) {
  DatabaseSync = require('better-sqlite3');
}
const db = new DatabaseSync(dbPath);
try {
  db.exec('BEGIN IMMEDIATE');
  const selected = only ? MIGRATIONS.filter((m) => m.name.startsWith(`${only}_`)) : MIGRATIONS;
  const plan = down ? [...selected].reverse() : selected;
  for (const m of plan) {
    const applied = m.isApplied(db);
    if (down ? !applied : applied) {
      console.log(`skip ${m.name} (${down ? 'not applied' : 'already applied'})`);
      continue;
    }
    db.exec(fs.readFileSync(path.join(DIR, `${m.name}${down ? '.down' : ''}.sql`), 'utf8'));
    console.log(`${down ? 'rolled back' : 'applied'} ${m.name}`);
  }
  db.exec('COMMIT');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'aia\\_%' ESCAPE '\\' ORDER BY name").all().map((r) => r.name);
  console.log(`aia_* tables now: ${tables.length ? tables.join(', ') : '(none)'}${hasColumn(db, 'aia_questions', 'explanation') ? ' (+ Step 2 question columns)' : ''}`);
} catch (err) {
  try { db.exec('ROLLBACK'); } catch { /* not in a transaction */ }
  console.error(`Failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  db.close();
}
