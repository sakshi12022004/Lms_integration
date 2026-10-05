const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Descriptive Assignments - SubmissionFileStore on the local disk.
 *
 * The ONLY code that touches submission files. Callers (service, and later the Prompt 2 AI
 * evaluator) work with opaque storage keys: `save(buffer)` returns { storageKey, sha256 } and
 * `read(key)` returns the bytes. Keys are generated here (random UUID + ".pdf") and validated on
 * every call, so no caller input can ever name a path (no traversal, no original filenames).
 *
 *   rootDir  absolute directory, created on first save (mode 0700; files 0600). Configure with
 *            AIA_SUBMISSIONS_DIR; default <module>/data/submissions (git-ignored).
 *
 * Writes are atomic (temp file + rename). Nothing is logged except keys, never contents.
 * Swap this class for a cloud store later by keeping the same four methods.
 */
const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/;

class LocalSubmissionFileStore {
  constructor({ rootDir }) {
    if (typeof rootDir !== 'string' || !path.isAbsolute(rootDir)) throw new TypeError('LocalSubmissionFileStore requires an absolute rootDir.');
    this.rootDir = path.resolve(rootDir);
  }

  /** Resolves a key to its file, refusing anything that is not a key this store generated. */
  pathOf(storageKey) {
    if (typeof storageKey !== 'string' || !KEY.test(storageKey)) throw new Error('Invalid storage key.');
    const full = path.resolve(this.rootDir, storageKey);
    if (path.dirname(full) !== this.rootDir) throw new Error('Invalid storage key.');
    return full;
  }

  async save(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('Nothing to save.');
    await fs.promises.mkdir(this.rootDir, { recursive: true, mode: 0o700 });
    const storageKey = `${crypto.randomUUID()}.pdf`;
    const target = this.pathOf(storageKey);
    const temp = `${target}.${process.pid}.tmp`;
    await fs.promises.writeFile(temp, buffer, { mode: 0o600, flag: 'wx' });
    await fs.promises.rename(temp, target);
    return { storageKey, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
  }

  async read(storageKey) {
    return fs.promises.readFile(this.pathOf(storageKey));
  }

  async exists(storageKey) {
    try {
      await fs.promises.access(this.pathOf(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  /** Idempotent: deleting a missing file is not an error. */
  async delete(storageKey) {
    try {
      await fs.promises.unlink(this.pathOf(storageKey));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}

const defaultSubmissionsDir = () => path.resolve(__dirname, '../../../data/submissions');

module.exports = { LocalSubmissionFileStore, defaultSubmissionsDir, STORAGE_KEY: KEY };
