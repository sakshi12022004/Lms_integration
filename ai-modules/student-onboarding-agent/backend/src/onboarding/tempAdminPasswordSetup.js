const fs = require('fs');
const { ValidationError } = require('../errors');
const { DEFAULT_OPTIONS } = require('./StudentSetupService');

/**
 * TEMPORARY TESTING / ADMIN SETUP MECHANISM — replace with the production email invite flow
 * (StudentSetupService + /api/student-setup) once SMTP is configured.
 *
 * Lets a school admin set the first password of a student that THEIR onboarding import created,
 * so the full flow can be tested while email is disabled.
 *
 * Provenance is checked in the LMS database, not trusted from memory or the client:
 *   soa_idempotency_keys (university_id = admin's school, key = "<jobId>:<rowNumber>:createStudent")
 *   -> the studentRef this import created -> students.studentId -> users (role 'student', same school).
 * Only users.password (and updated_at) of that one student is written. The password and hash are
 * never returned or logged. Students who already set their password via an emailed link are refused.
 */
const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const SETUP_TABLE = 'soa_student_setup_tokens';

const fail = (message, code, statusCode) => new ValidationError(message, [], { code, statusCode });

async function setStudentPasswordByAdmin({ dbPath, actor, jobId, rowNumber, password, hashPassword }) {
  if (typeof password !== 'string') throw fail('Send { "password": "..." } only.', 'INVALID_REQUEST', 400);
  if (password.length < DEFAULT_OPTIONS.minPasswordLength) throw fail('The password must be at least 8 characters long.', 'PASSWORD_TOO_SHORT', 400);
  if (Buffer.byteLength(password, 'utf8') > DEFAULT_OPTIONS.maxPasswordBytes) throw fail('The password is too long (at most 72 bytes).', 'PASSWORD_TOO_LONG', 400);
  const row = Number(rowNumber);
  if (!Number.isInteger(row) || row < 1 || row > 10_000_000 || String(row) !== String(rowNumber)) {
    throw fail('Row number must be a positive integer.', 'INVALID_REQUEST', 400);
  }

  const hash = await hashPassword(password);
  if (typeof hash !== 'string' || !BCRYPT_PATTERN.test(hash)) throw new Error('hashPassword did not return a bcrypt hash');

  const { DatabaseSync } = require('node:sqlite');
  if (!fs.existsSync(dbPath)) throw fail('Onboarding is not available.', 'LMS_NOT_READY', 503);
  const db = new DatabaseSync(dbPath);
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec('BEGIN IMMEDIATE');
    try {
      const created = db
        .prepare("SELECT result_json FROM soa_idempotency_keys WHERE university_id = ? AND idempotency_key = ? AND operation = 'createStudent'")
        .get(actor.universityId, `${jobId}:${row}:createStudent`);
      const studentRef = created ? safeJson(created.result_json).studentRef : null;
      const m = typeof studentRef === 'string' ? /^lms-student:(\d{1,20})$/.exec(studentRef) : null;
      const student = m
        ? db.prepare("SELECT u.id FROM students s JOIN users u ON u.id = s.userId WHERE s.studentId = ? AND u.university_id = ? AND u.role = 'student'").get(m[1], actor.universityId)
        : null;
      if (!student) throw fail('No student created by this import was found for that row.', 'STUDENT_NOT_FOUND', 404);

      const hasSetupTable = db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?").get(SETUP_TABLE);
      if (hasSetupTable && db.prepare(`SELECT 1 AS x FROM ${SETUP_TABLE} WHERE user_id = ? AND used_at IS NOT NULL LIMIT 1`).get(student.id)) {
        throw fail('This student already set their own password.', 'STUDENT_ALREADY_SET_UP', 409);
      }

      const upd = db
        .prepare("UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND university_id = ? AND role = 'student'")
        .run(hash, student.id, actor.universityId);
      if (upd.changes !== 1) throw fail('No student created by this import was found for that row.', 'STUDENT_NOT_FOUND', 404);
      if (hasSetupTable) {
        // Any outstanding emailed link must not override the admin-set password later.
        db.prepare(`UPDATE ${SETUP_TABLE} SET revoked_at = ? WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL`).run(Date.now(), student.id);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  } finally {
    db.close();
  }
  return { passwordSet: true, rowNumber: row };
}

function safeJson(text) {
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

module.exports = { setStudentPasswordByAdmin };
