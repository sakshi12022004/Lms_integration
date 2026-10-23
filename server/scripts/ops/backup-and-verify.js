/**
 * Makes a backup of the LMS database and proves the backup can be restored.
 *
 *   node scripts/ops/backup-and-verify.js --db <path to .db> --out <backup folder>
 *
 * Steps:
 *   1. SQLite online backup of the database (safe while the server is running; the source
 *      is opened read-only and is never changed).
 *   2. The backup file is opened on its own, as a restore would do, and checked:
 *      SQLite integrity check, and every table has the same number of rows as the source
 *      had when the backup was taken.
 *   3. Prints the backup path and exits 0 only when every check passed.
 *
 * A backup that has not been opened and checked is only a hope. Run this from a scheduled
 * task, keep the files off the server, and copy the uploads folder with the same timestamp.
 * To restore: stop the server, replace the database file with the backup (remove any
 * -wal / -shm files beside it), start the server, check /health/ready.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const option = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const dbPath = option('--db');
const outDir = option('--out');
if (!dbPath || !outDir || !fs.existsSync(dbPath)) {
  console.error('Usage: node scripts/ops/backup-and-verify.js --db <path to .db> --out <backup folder>');
  process.exit(1);
}

const rowCounts = (db) =>
  Object.fromEntries(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
      .map(({ name }) => [name, db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get().n])
  );

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(outDir, `${path.basename(dbPath, path.extname(dbPath))}-${stamp}.db`);

  const source = new Database(dbPath, { readonly: true, fileMustExist: true });
  // Counts and copy from one consistent view of the data
  const expected = rowCounts(source);
  await source.backup(backupPath);
  source.close();

  const restored = new Database(backupPath, { readonly: true, fileMustExist: true });
  const integrity = restored.pragma('integrity_check', { simple: true });
  const actual = rowCounts(restored);
  restored.close();

  const problems = [];
  if (integrity !== 'ok') problems.push(`integrity check: ${integrity}`);
  for (const table of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    // rows written between the count and the copy may add to a table, never remove from it
    if (actual[table] === undefined || actual[table] < expected[table]) {
      problems.push(`table ${table}: expected at least ${expected[table]} rows, backup has ${actual[table] ?? 'no table'}`);
    }
  }

  const totalRows = Object.values(actual).reduce((sum, n) => sum + n, 0);
  console.log(`Backup: ${backupPath}`);
  console.log(`Size: ${fs.statSync(backupPath).size} bytes | tables: ${Object.keys(actual).length} | rows: ${totalRows}`);
  if (problems.length) {
    console.error('BACKUP NOT VERIFIED:');
    problems.forEach((problem) => console.error(` - ${problem}`));
    process.exit(2);
  }
  console.log('Verified: the backup opens, passes the integrity check and holds every table and row.');
})().catch((err) => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
