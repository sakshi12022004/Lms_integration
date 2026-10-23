/**
 * Records without a school (staged school-isolation migration).
 *
 * Some tables were created without a school column (expenses, orders, inventory,
 * vendors) and some older rows carry no school id. The server never guesses a
 * school for such rows: they stay hidden from school accounts until an operator
 * decides where they belong. This script is that decision tool.
 *
 *   node scripts/security/reconcile-school-ownership.js --db <path to .db>
 *       Report only (the database is opened read-only): what has no school, what
 *       can be derived from an existing link, and what is ambiguous.
 *
 *   node scripts/security/reconcile-school-ownership.js --db <path> --apply-derived
 *       Fills in the school where an existing link proves it (an order belongs to
 *       the school of the storekeeper who placed it). Nothing else is touched.
 *
 *   node scripts/security/reconcile-school-ownership.js --db <path> --assign-remaining <schoolId>
 *       Assigns every remaining row without a school to ONE school. Only correct for
 *       a database that has always served a single school; the script refuses when
 *       the database holds more than one school unless --i-have-checked is added.
 *
 * A changing run first copies the database file to <db>.pre-school-reconcile.<time>.bak
 * and makes all changes in one transaction (all or nothing).
 * There is no default path on purpose: you must name the database you mean.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const flag = (name) => args.includes(name);

const dbPath = option('--db');
if (!dbPath || !fs.existsSync(dbPath)) {
  console.error('Usage: node scripts/security/reconcile-school-ownership.js --db <path to the .db file> [--apply-derived] [--assign-remaining <schoolId>]');
  process.exit(1);
}

const applyDerived = flag('--apply-derived');
const assignSchool = option('--assign-remaining');
const changing = applyDerived || assignSchool !== undefined;

// Tables with their own school column, and (where one exists) the link that proves the school.
const TABLES = [
  { table: 'orders', derive: 'SELECT u.university_id FROM users u WHERE u.id = orders.storekeeperId' },
  { table: 'expenses', derive: null },
  { table: 'inventory', derive: null },
  { table: 'vendors', derive: null },
  { table: 'calendar_events', derive: 'SELECT u.university_id FROM users u WHERE u.id = calendar_events.createdByUser' },
  { table: 'announcements', derive: 'SELECT u.university_id FROM users u WHERE u.id = announcements.createdByUser' },
  { table: 'courses', derive: 'SELECT c.university_id FROM classrooms c WHERE c.id = courses.classroomId' },
];

const db = new Database(dbPath, changing ? { fileMustExist: true } : { fileMustExist: true, readonly: true });
const hasColumn = (table, column) => db.prepare(`PRAGMA table_info("${table}")`).all().some((info) => info.name === column);
const tableExists = (table) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));

const schools = tableExists('universities') ? db.prepare('SELECT id, name FROM universities ORDER BY id').all() : [];
console.log(`Database: ${path.resolve(dbPath)}`);
console.log(`Schools in this database: ${schools.length}${schools.length ? ' (' + schools.map((s) => `${s.id}: ${s.name}`).join(', ') + ')' : ''}`);
console.log('');

const report = [];
for (const { table, derive } of TABLES) {
  if (!tableExists(table)) continue;
  if (!hasColumn(table, 'university_id')) {
    report.push({ table, total: db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n, withoutSchool: 'no school column yet (start the server once to add it)', derivable: 0, derive });
    continue;
  }
  const total = db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n;
  const withoutSchool = db.prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE university_id IS NULL`).get().n;
  const derivable = derive ? db.prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE university_id IS NULL AND (${derive}) IS NOT NULL`).get().n : 0;
  report.push({ table, total, withoutSchool, derivable, derive });
}
// Accounts of a school role that have no school cannot use the LMS at all.
if (tableExists('users')) {
  const stranded = db.prepare("SELECT COUNT(*) AS n FROM users WHERE university_id IS NULL AND role <> 'superadmin'").get().n;
  report.push({ table: 'users (school roles)', total: db.prepare('SELECT COUNT(*) AS n FROM users').get().n, withoutSchool: stranded, derivable: 0, derive: null });
}

console.log('Table'.padEnd(26) + 'Rows'.padStart(8) + '  Without school'.padEnd(18) + 'Derivable from a link');
for (const row of report) {
  console.log(row.table.padEnd(26) + String(row.total).padStart(8) + '  ' + String(row.withoutSchool).padEnd(16) + String(row.derivable));
}
console.log('');

if (!changing) {
  console.log('Report only: nothing was changed.');
  db.close();
  process.exit(0);
}

if (assignSchool !== undefined) {
  if (!schools.some((school) => String(school.id) === String(assignSchool))) {
    console.error(`School ${assignSchool} does not exist in this database. Nothing was changed.`);
    process.exit(1);
  }
  if (schools.length > 1 && !flag('--i-have-checked')) {
    console.error('This database holds more than one school. Assigning every remaining row to one school could give');
    console.error('one school another school\'s records. Review the rows first; add --i-have-checked to proceed. Nothing was changed.');
    process.exit(1);
  }
}

const backupPath = `${dbPath}.pre-school-reconcile.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
db.pragma('wal_checkpoint(TRUNCATE)');
fs.copyFileSync(dbPath, backupPath);
console.log(`Backup written: ${backupPath}`);

const changes = db.transaction(() => {
  const done = [];
  for (const row of report) {
    if (typeof row.withoutSchool !== 'number' || !TABLES.some((entry) => entry.table === row.table)) continue;
    if (applyDerived && row.derive) {
      const result = db.prepare(`UPDATE "${row.table}" SET university_id = (${row.derive}) WHERE university_id IS NULL AND (${row.derive}) IS NOT NULL`).run();
      if (result.changes) done.push(`${row.table}: ${result.changes} row(s) given the school proven by their link`);
    }
    if (assignSchool !== undefined) {
      const result = db.prepare(`UPDATE "${row.table}" SET university_id = ? WHERE university_id IS NULL`).run(assignSchool);
      if (result.changes) done.push(`${row.table}: ${result.changes} row(s) assigned to school ${assignSchool}`);
    }
  }
  return done;
})();

console.log(changes.length ? changes.join('\n') : 'No row needed a change.');
console.log('To undo: stop the server and copy the backup file back over the database.');
db.close();
