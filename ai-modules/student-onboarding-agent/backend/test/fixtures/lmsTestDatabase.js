/**
 * Throwaway IN-MEMORY LMS database for adapter tests. Never touches a file.
 *
 * Table definitions are copied verbatim from the live LMS database
 * (server/data/lms_permanent.db, read-only inspection in Step 9A), so the
 * adapter is tested against the real column names, defaults and constraints.
 * The proposed idempotency migration is applied from its source file.
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const LMS_TABLES = [
  "CREATE TABLE users ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', university_id INTEGER DEFAULT 1, isApproved INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP , classroom_id INTEGER, subscriptionPlan TEXT DEFAULT 'free', created_by INTEGER)",
  'CREATE TABLE students ( id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, studentId TEXT UNIQUE, grade TEXT, rollNumber TEXT, totalFees REAL DEFAULT 0, feesPaid REAL DEFAULT 0, pendingFees REAL DEFAULT 0, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (userId) REFERENCES users(id) )',
  'CREATE TABLE universities ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, area TEXT, adminId INTEGER, subscriptionPlan TEXT DEFAULT \'free\', createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP )',
  'CREATE TABLE classrooms ( id INTEGER PRIMARY KEY AUTOINCREMENT, university_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL, grade TEXT NOT NULL, section TEXT, classTeacher TEXT, classTeacherId INTEGER, studentCount INTEGER DEFAULT 0, timetable TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (classTeacherId) REFERENCES users(id), FOREIGN KEY (university_id) REFERENCES universities(id) )',
  'CREATE TABLE student_classroom_assignment ( id INTEGER PRIMARY KEY AUTOINCREMENT, studentId INTEGER NOT NULL, classroomId INTEGER NOT NULL, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(studentId, classroomId), FOREIGN KEY(studentId) REFERENCES users(id), FOREIGN KEY(classroomId) REFERENCES classrooms(id) )',
];

const MIGRATION_PATH = path.join(__dirname, '../../src/adapters/lms/migrations/001_soa_idempotency_keys.sql');

/**
 * Seed: schools 1 (free), 2 (standard), 3 (professional).
 * Users: 1 admin@s1 (school 1), 2 admin@s2 (school 2), 3 mentor@s1 (mentor, school 1),
 *        4 admin with NULL school, 5 admin@s3 (school 3).
 * Classrooms: school 1: 10/A, 11/B, 12/C twice (ambiguous); school 2: 10/A.
 */
function createLmsTestDatabase({ withMigration = true } = {}) {
  const db = new DatabaseSync(':memory:');
  for (const sql of LMS_TABLES) db.exec(sql);
  if (withMigration) db.exec(fs.readFileSync(MIGRATION_PATH, 'utf8'));

  const uni = db.prepare('INSERT INTO universities (id, name, subscriptionPlan) VALUES (?, ?, ?)');
  uni.run(1, 'School One', 'free');
  uni.run(2, 'School Two', 'standard');
  uni.run(3, 'School Three', 'professional');

  const user = db.prepare('INSERT INTO users (id, name, email, password, role, university_id) VALUES (?, ?, ?, ?, ?, ?)');
  user.run(1, 'Admin One', 'admin@s1.test', 'x', 'admin', 1);
  user.run(2, 'Admin Two', 'admin@s2.test', 'x', 'admin', 2);
  user.run(3, 'Mentor One', 'mentor@s1.test', 'x', 'mentor', 1);
  user.run(4, 'Admin Nowhere', 'admin@none.test', 'x', 'admin', null);
  user.run(5, 'Admin Three', 'admin@s3.test', 'x', 'admin', 3);

  const room = db.prepare('INSERT INTO classrooms (university_id, name, grade, section) VALUES (?, ?, ?, ?)');
  room.run(1, 'Grade 10 - A', '10', 'A');
  room.run(1, 'Grade 11 - B', '11', 'B');
  room.run(1, 'Grade 12 - C', '12', 'C');
  room.run(1, 'Grade 12 - C (2)', '12', 'C');
  room.run(2, 'Grade 10 - A', '10', 'A');
  return db;
}

/** Row counts of the tables the adapter writes, for "nothing was written" checks. */
function counts(db) {
  const n = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  const out = { users: n('users'), students: n('students'), assignments: n('student_classroom_assignment') };
  const hasKeys = db.prepare("SELECT 1 AS x FROM sqlite_master WHERE name = 'soa_idempotency_keys'").get();
  out.idempotency = hasKeys ? n('soa_idempotency_keys') : null;
  return out;
}

module.exports = { createLmsTestDatabase, counts };
