const db = require('../config/database-switch');

/* ================= PROMISE WRAPPERS ================= */
const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

/* ================= TRANSACTIONS ================= */
// The app shares one database connection, so transactions are queued one after
// another to make sure two of them never overlap (no nested BEGIN).
let queue = Promise.resolve();

const withTransaction = (work) => {
  const result = queue.then(async () => {
    await run('BEGIN IMMEDIATE');
    try {
      const value = await work();
      await run('COMMIT');
      return value;
    } catch (err) {
      try {
        await run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Transaction rollback failed:', rollbackErr.message);
      }
      throw err;
    }
  });
  queue = result.catch(() => {});
  return result;
};

module.exports = { get, all, run, withTransaction };
