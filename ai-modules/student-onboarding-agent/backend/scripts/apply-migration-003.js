'use strict';
/**
 * Applies migration 003 (custom student fields) to ONE SQLite database, following the procedure used
 * for this module's earlier migrations (see adapters/lms/README.md): verify, back up, apply in one
 * transaction on its own connection, verify again. Stop the backend before running it on the live DB.
 *
 *   node backend/scripts/apply-migration-003.js --db <absolute .db path> --backup-dir <absolute dir> --yes
 *
 * STOPS (exit 1, nothing applied) if: 001/002 are missing, 003 is already applied, integrity_check is not
 * "ok", or the backup cannot be verified (integrity + identical content fingerprint).
 * Prints only counts, table names, hashes and paths - never row contents.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIGRATION = path.join(__dirname, '../src/adapters/lms/migrations/003_soa_custom_fields.sql');
const REQUIRED_BEFORE = ['soa_idempotency_keys', 'soa_student_setup_tokens']; // 001, 002
const NEW_TABLES = ['soa_custom_field_values', 'soa_custom_fields'];

const tables = (db) => db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => ({ name: r.name, sql: r.sql }));
const integrity = (db) => db.prepare('PRAGMA integrity_check').all().map((r) => Object.values(r)[0]).join('; ');

/** Per table: its CREATE statement, row count and SHA-256 of all rows (stable order). */
function fingerprint(db) {
  const out = {};
  for (const t of tables(db)) {
    const q = `"${t.name.replace(/"/g, '""')}"`;
    const rows = db.prepare(`SELECT * FROM ${q} ORDER BY rowid`).all();
    out[t.name] = { sql: t.sql, rows: rows.length, sha256: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
  }
  return out;
}

async function applyMigration003({ dbPath, backupDir, now = new Date(), log = console.log }) {
  let DatabaseSync, doBackup, isNodeSqlite = false;
  try {
    const mod = require('node:sqlite');
    DatabaseSync = mod.DatabaseSync;
    doBackup = mod.backup;
    isNodeSqlite = true;
  } catch {
    DatabaseSync = require('better-sqlite3');
    doBackup = async (db, dest) => await db.backup(dest);
  }
  const stop = (msg) => { const e = new Error(`STOP: ${msg} (nothing was applied)`); e.code = 'PRECHECK_FAILED'; throw e; };
  if (!path.isAbsolute(dbPath) || !fs.existsSync(dbPath)) stop('database file not found');
  if (!path.isAbsolute(backupDir)) stop('--backup-dir must be absolute');

  // 1) live state
  const src = new DatabaseSync(dbPath);
  let before;
  let backupPath;
  try {
    src.exec('PRAGMA busy_timeout = 5000');
    const names = tables(src).map((t) => t.name);
    const missing = REQUIRED_BEFORE.filter((t) => !names.includes(t));
    if (missing.length) stop(`earlier onboarding migrations missing: ${missing.join(', ')}`);
    if (NEW_TABLES.some((t) => names.includes(t))) stop('migration 003 is already applied');
    const ok = integrity(src);
    if (ok !== 'ok') stop(`integrity_check: ${ok}`);
    before = fingerprint(src);
    log(`pre-check: ${names.length} tables, integrity ok, 003 not applied`);

    // 2) backup (node:sqlite online backup) + verification
    fs.mkdirSync(backupDir, { recursive: true });
    backupPath = path.join(backupDir, `lms_permanent.pre-soa-003.${now.toISOString().replace(/[:.]/g, '-')}.db`);
    await doBackup(src, backupPath);
  } finally {
    src.close();
  }
  const bk = new DatabaseSync(backupPath, isNodeSqlite ? { readOnly: true } : { readonly: true });
  try {
    const ok = integrity(bk);
    if (ok !== 'ok') stop(`backup integrity_check: ${ok}`);
    if (JSON.stringify(fingerprint(bk)) !== JSON.stringify(before)) stop('backup content differs from the live database');
  } finally {
    bk.close();
  }
  const fileSha = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');
  fs.appendFileSync(path.join(backupDir, 'PRE_MIGRATION_CONTENT_SHA256.txt'), `${fileSha}  ${path.basename(backupPath)}\n`);
  log(`backup: ${backupPath} (${fs.statSync(backupPath).size} bytes, sha256 ${fileSha}), integrity ok, content identical`);

  // 3) apply: one transaction, own connection
  const db = new DatabaseSync(dbPath);
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(fs.readFileSync(MIGRATION, 'utf8'));
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
      throw err;
    }
    // 4) verification
    const after = fingerprint(db);
    const added = Object.keys(after).filter((t) => !before[t]).sort();
    const changed = Object.keys(before).filter((t) => JSON.stringify(before[t]) !== JSON.stringify(after[t]));
    const ok = integrity(db);
    const result = {
      backupPath, backupSha256: fileSha, tablesBefore: Object.keys(before).length, tablesAfter: Object.keys(after).length,
      added, changedExistingTables: changed, integrity: ok,
      customFieldColumns: db.prepare('PRAGMA table_info(soa_custom_fields)').all().map((c) => c.name),
    };
    if (JSON.stringify(added) !== JSON.stringify(NEW_TABLES) || changed.length || ok !== 'ok') {
      const e = new Error(`VERIFY FAILED after applying 003: ${JSON.stringify(result)}. Restore the backup.`);
      e.code = 'VERIFY_FAILED';
      throw e;
    }
    log(`applied 003: tables ${result.tablesBefore} -> ${result.tablesAfter}, added ${added.join(', ')}, existing tables unchanged, integrity ok`);
    return result;
  } finally {
    db.close();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  if (!args.includes('--yes') || !arg('--db') || !arg('--backup-dir')) {
    console.error('Usage: node backend/scripts/apply-migration-003.js --db <absolute .db> --backup-dir <absolute dir> --yes');
    process.exit(1);
  }
  applyMigration003({ dbPath: arg('--db'), backupDir: arg('--backup-dir') })
    .catch((err) => { console.error(err.message); process.exit(1); });
}

module.exports = { applyMigration003, fingerprint };
