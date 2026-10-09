const Database = require('better-sqlite3');

/**
 * Transaction isolation for payment reads and writes.
 *
 * The LMS shares ONE async sqlite3 connection across all requests, so a
 * BEGIN/ROLLBACK issued on it captures (and can undo) unrelated requests'
 * writes. Payment work therefore runs on its own short-lived connection to
 * the same database file, using the synchronous driver:
 *
 *  - the transaction body (fn) executes in one uninterrupted JS turn and needs
 *    no worker threads, so it cannot be starved by other queries waiting on
 *    the database lock;
 *  - payment transactions are queued so only one runs at a time in this process;
 *  - SQLite's file lock (BEGIN IMMEDIATE) serializes it against the shared
 *    connection and against other processes.
 *
 * Waiting for the file lock is done by retrying with the event loop running,
 * never by blocking it: the shared connection can hold a read lock that is
 * only released from an event-loop callback (sqlite3's Database#get), so a
 * blocking wait would deadlock until timeout.
 *
 * Callbacks (fn) passed to these helpers MUST be synchronous.
 */

const BUSY_TIMEOUT_MS = 5000; // total time to keep retrying before giving up with SQLITE_BUSY
const SYNC_BUSY_WAIT_MS = 20; // longest a single attempt may block the event loop
const RETRY_DELAY_MS = 10;

const isBusyError = (err) => !!err && typeof err.code === 'string' && err.code.startsWith('SQLITE_BUSY');
const isConstraintError = (err) => !!err && typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const yieldToEventLoop = () => new Promise(resolve => setImmediate(resolve));

// Retries a synchronous step while the database is locked, yielding between attempts
async function retryWhileBusy(step, deadline) {
  for (;;) {
    try {
      return step();
    } catch (err) {
      if (!isBusyError(err) || Date.now() >= deadline) throw err;
      await sleep(RETRY_DELAY_MS);
    }
  }
}

// In-process FIFO queue for write transactions
let writeQueue = Promise.resolve();
function enqueueWrite(task) {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => {});
  return run;
}

function openConnection(db, readonly) {
  const filename = db && db.filename;
  if (!filename || filename === ':memory:') {
    const err = new Error('Installment payments require a file-backed SQLite database.');
    err.statusCode = 500;
    throw err;
  }
  const conn = new Database(filename, { fileMustExist: true, readonly, timeout: SYNC_BUSY_WAIT_MS });
  // Match the app's shared connection, which runs with foreign keys off: the legacy
  // payments.studentId FK points at students(id) while the LMS stores users.id there.
  // Student existence and role are validated explicitly by the installment service.
  conn.pragma('foreign_keys = OFF');
  return conn;
}

// Minimal query interface handed to callers: get / all / run with positional params
function queryInterface(conn) {
  return {
    get: (sql, params = []) => conn.prepare(sql).get(...params),
    all: (sql, params = []) => conn.prepare(sql).all(...params),
    run: (sql, params = []) => {
      const info = conn.prepare(sql).run(...params);
      return { lastID: Number(info.lastInsertRowid), changes: info.changes };
    }
  };
}

/**
 * Runs fn(q) inside BEGIN IMMEDIATE ... COMMIT on a dedicated connection to
 * the same file as `db`. Rolls back (only its own work) if fn throws.
 */
function withWriteTransaction(db, fn) {
  return enqueueWrite(async () => {
    // Let a shared-connection statement whose callback invoked us release its read lock
    await yieldToEventLoop();
    const conn = openConnection(db, false);
    const deadline = Date.now() + BUSY_TIMEOUT_MS;
    try {
      await retryWhileBusy(() => conn.exec('BEGIN IMMEDIATE'), deadline);
      try {
        const result = fn(queryInterface(conn));
        // A busy COMMIT leaves the transaction open, so it is safe to retry
        await retryWhileBusy(() => conn.exec('COMMIT'), deadline);
        return result;
      } catch (innerErr) {
        if (conn.inTransaction) conn.exec('ROLLBACK');
        throw innerErr;
      }
    } finally {
      conn.close();
    }
  });
}

/** Runs fn(q) on a dedicated read-only connection (a consistent snapshot of committed data). */
async function withReadConnection(db, fn) {
  await yieldToEventLoop();
  const conn = openConnection(db, true);
  const deadline = Date.now() + BUSY_TIMEOUT_MS;
  try {
    return await retryWhileBusy(() => {
      conn.exec('BEGIN');
      try {
        return fn(queryInterface(conn));
      } finally {
        if (conn.inTransaction) conn.exec('COMMIT');
      }
    }, deadline);
  } finally {
    conn.close();
  }
}

module.exports = { withWriteTransaction, withReadConnection, isBusyError, isConstraintError, BUSY_TIMEOUT_MS };
