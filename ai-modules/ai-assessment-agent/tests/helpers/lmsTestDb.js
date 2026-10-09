/**
 * Throwaway LMS database for tests (in memory, or a temp file for HTTP tests).
 * Never touches server/data/lms_permanent.db.
 *
 * LMS table definitions are copied verbatim from the live database
 * (read-only inspection, 2026-09-28), including the LEGACY `assessments` /
 * `assessment_questions` tables, so tests prove the module does not collide
 * with or alter them.
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const MIGRATIONS = path.join(__dirname, '../../backend/src/adapters/lms/migrations');
const UP = path.join(MIGRATIONS, '001_aia_assessments.sql');
const DOWN = path.join(MIGRATIONS, '001_aia_assessments.down.sql');
const UP_002 = path.join(MIGRATIONS, '002_aia_question_explanation.sql');
const DOWN_002 = path.join(MIGRATIONS, '002_aia_question_explanation.down.sql');
const UP_003 = path.join(MIGRATIONS, '003_aia_attempts.sql');
const DOWN_003 = path.join(MIGRATIONS, '003_aia_attempts.down.sql');
const UP_004 = path.join(MIGRATIONS, '004_aia_assessment_window.sql');
const DOWN_004 = path.join(MIGRATIONS, '004_aia_assessment_window.down.sql');
const UP_005 = path.join(MIGRATIONS, '005_aia_attempt_archive.sql');
const DOWN_005 = path.join(MIGRATIONS, '005_aia_attempt_archive.down.sql');
const UP_006 = path.join(MIGRATIONS, '006_aia_question_types.sql');
const DOWN_006 = path.join(MIGRATIONS, '006_aia_question_types.down.sql');
const UP_007 = path.join(MIGRATIONS, '007_aia_assignments.sql');
const DOWN_007 = path.join(MIGRATIONS, '007_aia_assignments.down.sql');
const UP_008 = path.join(MIGRATIONS, '008_aia_recipients_reports.sql');
const DOWN_008 = path.join(MIGRATIONS, '008_aia_recipients_reports.down.sql');

const UP_009 = path.join(MIGRATIONS, '009_aia_question_images.sql');

const LMS_TABLES = [
  "CREATE TABLE classroomAssignments ( id INTEGER PRIMARY KEY AUTOINCREMENT, classroomId INTEGER NOT NULL, teacherId INTEGER NOT NULL, role TEXT NOT NULL DEFAULT 'class_teacher', assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP )",
  "CREATE TABLE users ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', university_id INTEGER DEFAULT 1, isApproved INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP , classroom_id INTEGER, subscriptionPlan TEXT DEFAULT 'free', created_by INTEGER)",
  "CREATE TABLE universities ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, area TEXT, adminId INTEGER, subscriptionPlan TEXT DEFAULT 'free', createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP )",
  'CREATE TABLE classrooms ( id INTEGER PRIMARY KEY AUTOINCREMENT, university_id INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL, grade TEXT NOT NULL, section TEXT, classTeacher TEXT, classTeacherId INTEGER, studentCount INTEGER DEFAULT 0, timetable TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (classTeacherId) REFERENCES users(id), FOREIGN KEY (university_id) REFERENCES universities(id) )',
  'CREATE TABLE student_classroom_assignment ( id INTEGER PRIMARY KEY AUTOINCREMENT, studentId INTEGER NOT NULL, classroomId INTEGER NOT NULL, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(studentId, classroomId), FOREIGN KEY(studentId) REFERENCES users(id), FOREIGN KEY(classroomId) REFERENCES classrooms(id) )',
  'CREATE TABLE courses ( id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, mentorId INTEGER, classroomId INTEGER, category TEXT, duration INTEGER, price REAL DEFAULT 0, university_id INTEGER DEFAULT 1, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (mentorId) REFERENCES users(id), FOREIGN KEY (classroomId) REFERENCES classrooms(id) )',
  'CREATE TABLE assessments ( id INTEGER PRIMARY KEY AUTOINCREMENT, courseId INTEGER NOT NULL, weekId INTEGER, title TEXT NOT NULL, description TEXT, startTime DATETIME NOT NULL, endTime DATETIME NOT NULL, timer INTEGER DEFAULT 60, isPublished BOOLEAN DEFAULT 0, createdBy INTEGER NOT NULL, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (courseId) REFERENCES courses(id), FOREIGN KEY (weekId) REFERENCES weeks(id), FOREIGN KEY (createdBy) REFERENCES users(id) )',
  "CREATE TABLE assessment_questions ( id INTEGER PRIMARY KEY AUTOINCREMENT, assessmentId INTEGER NOT NULL, questionNumber INTEGER NOT NULL, questionText TEXT NOT NULL, questionType TEXT NOT NULL CHECK (questionType IN ('multiple_choice', 'short_answer', 'essay', 'true_false')), options TEXT, correctAnswer TEXT, marks INTEGER DEFAULT 1, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (assessmentId) REFERENCES assessments(id) )",
];

/**
 * Seed (ids are fixed so tests read clearly):
 *   schools: 1 "School One", 2 "School Two"
 *   users:   1 teacher1 (mentor, s1)   2 teacher2 (mentor, s1)   3 teacher3 (mentor, s2)
 *            4 student1 (s1, class 10) 5 student2 (s1, class 11) 6 student3 (s2, class 20)
 *            7 admin1 (admin, s1)      8 teacherRole (role 'teacher', s1)
 *            9 studentNoClass (s1)
 *   classes: 10 = s1 Grade 10 A, 11 = s1 Grade 11 B, 20 = s2 Grade 10 A
 */
const IDS = Object.freeze({
  school1: 1, school2: 2,
  teacher1: 1, teacher2: 2, teacher3: 3,
  student1: 4, student2: 5, student3: 6,
  admin1: 7, teacherRole: 8, studentNoClass: 9,
  class10: 10, class11: 11, class20: 20,
});

function seed(db) {
  db.exec("INSERT INTO universities (id, name) VALUES (1, 'School One'), (2, 'School Two')");
  const user = db.prepare('INSERT INTO users (id, name, email, password, role, university_id) VALUES (?, ?, ?, ?, ?, ?)');
  user.run(1, 'Teacher One', 't1@s1.test', 'x', 'mentor', 1);
  user.run(2, 'Teacher Two', 't2@s1.test', 'x', 'mentor', 1);
  user.run(3, 'Teacher Three', 't3@s2.test', 'x', 'mentor', 2);
  user.run(4, 'Student One', 'st1@s1.test', 'x', 'student', 1);
  user.run(5, 'Student Two', 'st2@s1.test', 'x', 'student', 1);
  user.run(6, 'Student Three', 'st3@s2.test', 'x', 'student', 2);
  user.run(7, 'Admin One', 'a1@s1.test', 'x', 'admin', 1);
  user.run(8, 'Teacher Role', 'tr@s1.test', 'x', 'teacher', 1);
  user.run(9, 'Student No Class', 'st9@s1.test', 'x', 'student', 1);
  const room = db.prepare('INSERT INTO classrooms (id, university_id, name, grade, section) VALUES (?, ?, ?, ?, ?)');
  room.run(10, 1, 'Grade 10 - A', '10', 'A');
  room.run(11, 1, 'Grade 11 - B', '11', 'B');
  room.run(20, 2, 'Grade 10 - A', '10', 'A');
  db.exec('INSERT INTO student_classroom_assignment (studentId, classroomId) VALUES (4, 10), (5, 11), (6, 20)');
  // Teaching assignments (the LMS's classroomAssignments): each school's teachers teach its classes.
  db.exec('INSERT INTO classroomAssignments (classroomId, teacherId) VALUES (10, 1), (11, 1), (10, 2), (11, 2), (10, 8), (11, 8), (20, 3)');
}

/**
 * withMigration: apply 001 ... 006 (the current schema).
 * withStep2: false stops after 001; withStep3: false stops after 002; withStep5: false stops after 003;
 * withStep6: false stops after 004; withQuestionTypes: false stops after 005 (the live schema before 006).
 * withAssignments (007) is independent of 006: false leaves the assignment tables out.
 * withRecipientsReports (008) is independent too: false = the live schema before 008.
 */
function createLmsSchema(db, { withMigration = true, withStep2 = true, withStep3 = true, withStep5 = true, withStep6 = true, withQuestionTypes = true, withAssignments = true, withRecipientsReports = true } = {}) {
  for (const sql of LMS_TABLES) db.exec(sql);
  seed(db);
  if (withMigration) {
    db.exec(fs.readFileSync(UP, 'utf8'));
    if (withStep2) {
      db.exec(fs.readFileSync(UP_002, 'utf8'));
      if (withStep3) {
        db.exec(fs.readFileSync(UP_003, 'utf8'));
        if (withStep5) {
          db.exec(fs.readFileSync(UP_004, 'utf8'));
          if (withStep6) {
            db.exec(fs.readFileSync(UP_005, 'utf8'));
            if (withQuestionTypes) db.exec(fs.readFileSync(UP_006, 'utf8'));
            if (withAssignments) db.exec(fs.readFileSync(UP_007, 'utf8'));
            if (withRecipientsReports) db.exec(fs.readFileSync(UP_008, 'utf8'));
            if (withQuestionTypes && withAssignments) db.exec(fs.readFileSync(UP_009, 'utf8')); // 009 adds a column to tables from 001 and 007
          }
        }
      }
    }
  }
  return db;
}

/** In-memory DB (foreign keys ON, as node:sqlite does by default). */
function createLmsTestDb(options) {
  return createLmsSchema(new DatabaseSync(':memory:'), options);
}

/** A temp-file DB for tests that must open it by path. Returns { dbPath, cleanup }. */
function createLmsTestDbFile(options) {
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aia-test-'));
  const dbPath = path.join(dir, 'lms-test.db');
  const db = new DatabaseSync(dbPath);
  createLmsSchema(db, options);
  db.close();
  return { dbPath, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** A valid question body; `correct` picks the correct option index. */
function mcq(text = 'What is 2 + 2?', correct = 1) {
  return { text, options: ['3', '4', '5', '22'].map((t, i) => ({ text: t, isCorrect: i === correct })) };
}

/** Step 2 (question types): a valid multiple-select body; `correct` lists the correct option indexes. */
function multi(text = 'Which of these are even numbers?', correct = [1, 3]) {
  return { type: 'multi_select', text, options: ['3', '4', '5', '22'].map((t, i) => ({ text: t, isCorrect: correct.includes(i) })) };
}

/** Step 2 (question types): a valid numerical body. */
function numerical(text = 'What is 7 x 6?', value = '42', format = 'integer') {
  return { type: 'numerical', text, numericAnswer: { format, value } };
}

module.exports = { IDS, LMS_TABLES, UP, DOWN, UP_002, DOWN_002, UP_003, DOWN_003, UP_004, DOWN_004, UP_005, DOWN_005, UP_006, DOWN_006, UP_007, DOWN_007, UP_008, DOWN_008, createLmsTestDb, createLmsTestDbFile, mcq, multi, numerical };
