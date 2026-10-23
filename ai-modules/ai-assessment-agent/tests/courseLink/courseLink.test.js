// Migration 010: a test belongs to a class AND a course of that class.
// Real AssessmentService + SQLite adapter, in-memory LMS database (migrations 001-010) with the
// LMS enrolment tables (course_students, course_classrooms) that the adapter reads.
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createLmsTestDb, IDS, mcq } = require('../helpers/lmsTestDb');
const { createSqliteAssessmentLmsAdapter } = require('../../backend/src/adapters/lms/SqliteAssessmentLmsAdapter');
const { AssessmentService } = require('../../backend/src/core/AssessmentService');

const UP_010 = path.join(__dirname, '../../backend/src/adapters/lms/migrations/010_aia_assessment_course.sql');
const T1 = { userId: IDS.teacher1, universityId: IDS.school1, kind: 'teacher' };
const T2 = { userId: IDS.teacher2, universityId: IDS.school1, kind: 'teacher' };
const T3 = { userId: IDS.teacher3, universityId: IDS.school2, kind: 'teacher' };
const student = (id, school = IDS.school1) => ({ userId: id, universityId: school, kind: 'student' });
const failure = (fn) => { try { fn(); } catch (e) { return { code: e.code, details: (e.details || []).map((d) => `${d.field}:${d.code}`) }; } return { code: 'ok', details: [] }; };

// Courses: 100 Maths (teacher1, home class 10); 101 Science (teacher2, home class 10);
// 102 History (teacher1, home class 11, also assigned to class 10).
// Class 10: student1 (enrolled in Maths) and student 30 (enrolled in History only).
function buildDb({ withCourseLink = true } = {}) {
  const db = createLmsTestDb();
  db.exec(`CREATE TABLE course_students (id INTEGER PRIMARY KEY AUTOINCREMENT, courseId INTEGER NOT NULL, studentId INTEGER NOT NULL, enrolledViaClassroomId INTEGER, UNIQUE(courseId, studentId));
           CREATE TABLE course_classrooms (id INTEGER PRIMARY KEY AUTOINCREMENT, courseId INTEGER NOT NULL, classroomId INTEGER NOT NULL, enrollAll INTEGER NOT NULL DEFAULT 1, UNIQUE(courseId, classroomId));`);
  if (withCourseLink) db.exec(fs.readFileSync(UP_010, 'utf8'));
  db.exec(`INSERT INTO users (id, name, email, password, role, university_id) VALUES (30, 'Student Thirty', 'st30@s1.test', 'x', 'student', 1);
           INSERT INTO student_classroom_assignment (studentId, classroomId) VALUES (30, 10);
           INSERT INTO courses (id, title, mentorId, classroomId, university_id) VALUES (100, 'Maths', 1, 10, 1), (101, 'Science', 2, 10, 1), (102, 'History', 1, 11, 1);
           INSERT INTO course_classrooms (courseId, classroomId, enrollAll) VALUES (100, 10, 1), (101, 10, 1), (102, 11, 1), (102, 10, 0);
           INSERT INTO course_students (courseId, studentId) VALUES (100, 4), (102, 30);`);
  return db;
}

describe('AI assessments belong to a course of their class (migration 010)', () => {
  let svc;
  let db;
  before(() => {
    db = buildDb();
    svc = new AssessmentService({ adapter: createSqliteAssessmentLmsAdapter(db) });
  });

  it('a new test needs a class and one of the teacher\'s courses taught to that class', () => {
    assert.deepEqual(failure(() => svc.createAssessment(T1, { title: 'No course', subject: 'Maths', classroomId: IDS.class10 })), { code: 'VALIDATION_FAILED', details: ['courseId:REQUIRED'] });
    assert.deepEqual(failure(() => svc.createAssessment(T1, { title: 'No class', subject: 'Maths', courseId: 100 })), { code: 'VALIDATION_FAILED', details: ['classroomId:REQUIRED'] });
    assert.deepEqual(failure(() => svc.createAssessment(T1, { title: 'Not mine', subject: 'Science', classroomId: IDS.class10, courseId: 101 })), { code: 'VALIDATION_FAILED', details: ['courseId:COURSE_NOT_FOUND'] }, 'another teacher\'s course');
    assert.deepEqual(failure(() => svc.createAssessment(T1, { title: 'Wrong class', subject: 'Maths', classroomId: IDS.class11, courseId: 100 })), { code: 'VALIDATION_FAILED', details: ['courseId:COURSE_NOT_FOUND'] }, 'Maths is not taught to class 11');
    assert.deepEqual(failure(() => svc.createAssessment(T3, { title: 'Other school', subject: 'Maths', classroomId: IDS.class20, courseId: 100 })), { code: 'VALIDATION_FAILED', details: ['courseId:COURSE_NOT_FOUND'] });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM aia_assessments').get().n, 0, 'nothing was saved');

    const maths = svc.createAssessment(T1, { title: 'Fractions', subject: 'Maths', classroomId: IDS.class10, courseId: 100 });
    assert.deepEqual([maths.courseId, maths.course, maths.legacy], [100, { id: 100, title: 'Maths' }, false]);
    assert.equal(db.prepare('SELECT course_id FROM aia_assessments WHERE id = ?').get(maths.id).course_id, 100, 'stored with the test');
    const history = svc.createAssessment(T1, { title: 'Kings', subject: 'History', classroomId: IDS.class10, courseId: 102 });
    assert.equal(history.course.title, 'History', 'a course assigned to the class (not its home class) is valid too');

    // the AI review -> save path has the same rule
    assert.deepEqual(failure(() => svc.createAssessmentWithQuestions(T1, { assessment: { title: 'Reviewed', subject: 'Maths', classroomId: IDS.class10 }, questions: [mcq()] })),
      { code: 'VALIDATION_FAILED', details: ['assessment.courseId:REQUIRED'] });
  });
});

describe('who is given a course test', () => {
  let svc;
  let db;
  let maths;
  before(() => {
    db = buildDb();
    svc = new AssessmentService({ adapter: createSqliteAssessmentLmsAdapter(db) });
    maths = svc.createAssessmentWithQuestions(T1, { assessment: { title: 'Fractions', subject: 'Maths', classroomId: IDS.class10, courseId: 100 }, questions: [mcq()] });
  });

  it('the "assign to" list shows the class\'s students enrolled in the course', () => {
    assert.deepEqual(svc.listClassroomStudents(T1, IDS.class10, 100).map((s) => s.id), [IDS.student1]);
    assert.deepEqual(svc.listClassroomStudents(T1, IDS.class10, 102).map((s) => s.id), [30]);
    assert.deepEqual(svc.listClassroomStudents(T1, IDS.class10).map((s) => s.id).sort((a, b) => a - b), [IDS.student1, 30], 'without a course: the class');
    assert.equal(failure(() => svc.listClassroomStudents(T1, IDS.class10, 101)).code, 'NOT_FOUND', 'not the teacher\'s course');
  });

  it('published to the whole class, only the enrolled students see it', () => {
    svc.publish(T1, maths.id);
    assert.deepEqual(svc.listAvailableForStudent(student(IDS.student1)).map((a) => a.id), [maths.id]);
    assert.equal(svc.listAvailableForStudent(student(IDS.student1))[0].course.title, 'Maths');
    assert.deepEqual(svc.listAvailableForStudent(student(30)), [], 'in the class but not in the course');
    assert.equal(failure(() => svc.getAvailableForStudent(student(30), maths.id)).code, 'NOT_FOUND');
    assert.deepEqual(svc.listAvailableForStudent(student(IDS.student2)), [], 'another class');
  });

  it('a selected student must be enrolled in the course', () => {
    const second = svc.createAssessmentWithQuestions(T1, { assessment: { title: 'Decimals', subject: 'Maths', classroomId: IDS.class10, courseId: 100 }, questions: [mcq()] });
    assert.deepEqual(failure(() => svc.publish(T1, second.id, { recipientIds: [30] })), { code: 'VALIDATION_FAILED', details: ['recipientIds:NOT_IN_COURSE'] });
    const published = svc.publish(T1, second.id, { recipientIds: [IDS.student1] });
    assert.equal(published.status, 'published');
  });

  it('edits keep the class and the course together', () => {
    const draft = svc.createAssessment(T1, { title: 'Draft', subject: 'Maths', classroomId: IDS.class10, courseId: 100 });
    assert.deepEqual(failure(() => svc.updateAssessment(T1, draft.id, { classroomId: IDS.class11 })), { code: 'VALIDATION_FAILED', details: ['courseId:COURSE_NOT_FOUND'] }, 'Maths is not taught to class 11');
    const moved = svc.updateAssessment(T1, draft.id, { classroomId: IDS.class11, courseId: 102 });
    assert.deepEqual([moved.classroomId, moved.courseId], [IDS.class11, 102]);
    assert.deepEqual(failure(() => svc.updateAssessment(T1, draft.id, { courseId: null })), { code: 'VALIDATION_FAILED', details: ['courseId:REQUIRED'] });
    assert.deepEqual(failure(() => svc.updateAssessment(T2, draft.id, { title: 'x' })).code, 'NOT_FOUND', 'another teacher');
  });
});

describe('tests made before migration 010 (legacy)', () => {
  it('stay with their class audience, are marked legacy, and may be given a course later', () => {
    const db = buildDb();
    const svc = new AssessmentService({ adapter: createSqliteAssessmentLmsAdapter(db) });
    // a draft and a published test written before tests had a course
    db.exec(`INSERT INTO aia_assessments (id, university_id, teacher_id, title, subject, classroom_id, status, published_at) VALUES
             (900, 1, 1, 'Old published', 'Maths', 10, 'published', CURRENT_TIMESTAMP), (901, 1, 1, 'Old draft', 'Maths', 10, 'draft', NULL);
             INSERT INTO aia_questions (id, assessment_id, position, text) VALUES (9000, 900, 1, 'Q');`);
    const listed = svc.listOwnAssessments(T1);
    const old = listed.find((a) => a.id === 900);
    assert.deepEqual([old.courseId, old.course, old.legacy], [null, null, true]);
    assert.deepEqual(svc.listAvailableForStudent(student(30)).map((a) => a.id), [900], 'the whole class still sees it: no course is guessed');
    const given = svc.updateAssessment(T1, 901, { courseId: 100 });
    assert.deepEqual([given.courseId, given.legacy], [100, false]);
    assert.equal(db.prepare('SELECT course_id FROM aia_assessments WHERE id = 900').get().course_id, null, 'the published one is left as it was');
  });

  it('before migration 010 nothing changes: no course is asked for or stored', () => {
    const db = buildDb({ withCourseLink: false });
    const svc = new AssessmentService({ adapter: createSqliteAssessmentLmsAdapter(db) });
    const a = svc.createAssessment(T1, { title: 'As before', subject: 'Maths', classroomId: IDS.class10, courseId: 100 });
    assert.equal(a.courseId, undefined);
    assert.equal(a.legacy, undefined);
    assert.ok(!db.prepare('PRAGMA table_info(aia_assessments)').all().some((c) => c.name === 'course_id'));
  });
});
