const { get, all } = require('./dbAsync');

/**
 * Teaching scope: which classrooms and courses a signed-in admin or teacher may act on.
 *
 *   Admin   -> every classroom of their school, and the courses in those classrooms.
 *   Teacher -> classrooms where they are the class teacher, are listed in classroomAssignments,
 *              or teach a course; and in those classrooms the courses they teach (a class
 *              teacher / assigned teacher may act on every course of that classroom).
 *
 * Every classroom or course id that arrives from the browser must go through
 * authorizeClassroom / authorizeCourse. The dropdowns in the UI are a convenience only.
 */

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const TEACHER_ROLES = ['mentor', 'teacher'];

// The teacher runs this classroom (class teacher or assigned to it). Takes the user id 3 times.
const CLASSROOM_STAFF_SQL = `(
  CAST(c.classTeacher AS INTEGER) = ? OR c.classTeacherId = ?
  OR EXISTS (SELECT 1 FROM classroomAssignments ca WHERE ca.classroomId = c.id AND ca.teacherId = ?)
)`;
// The teacher runs this classroom or teaches a course in it. Takes the user id 4 times.
const CLASSROOM_ACCESS_SQL = `(
  ${CLASSROOM_STAFF_SQL}
  OR EXISTS (SELECT 1 FROM courses co2 WHERE co2.classroomId = c.id AND co2.mentorId = ?)
)`;

const times = (value, count) => Array(count).fill(value);

const currentUser = (req) => {
  const userId = req.user?.userId;
  const role = req.user?.role;
  const isAdmin = role === 'admin';
  if (!userId || (!isAdmin && !TEACHER_ROLES.includes(role))) {
    throw new HttpError(403, 'Access denied');
  }
  return { userId, isAdmin, universityId: req.user.universityId || 1 };
};

/* ================= CLASSROOMS ================= */
const listClassrooms = async (req) => {
  const user = currentUser(req);
  const columns = 'c.id, c.name, c.grade, c.section, c.classTeacher, c.classTeacherId, c.studentCount, c.createdAt';
  if (user.isAdmin) {
    return all(`SELECT ${columns} FROM classrooms c WHERE c.university_id = ? ORDER BY c.createdAt DESC`, [user.universityId]);
  }
  return all(
    `SELECT ${columns} FROM classrooms c
     WHERE c.university_id = ? AND ${CLASSROOM_ACCESS_SQL}
     ORDER BY c.createdAt DESC`,
    [user.universityId, ...times(user.userId, 4)]
  );
};

// Returns the classroom, or throws 400 / 403 / 404.
const authorizeClassroom = async (req, classroomId) => {
  const user = currentUser(req);
  const id = Number(classroomId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid classroom');

  const classroom = await get('SELECT * FROM classrooms WHERE id = ?', [id]);
  if (!classroom) throw new HttpError(404, 'Classroom not found');

  const denied = new HttpError(403, 'You are not authorized to manage this classroom');
  if (Number(classroom.university_id) !== Number(user.universityId)) throw denied;
  if (user.isAdmin) return classroom;

  const allowed = await get(`SELECT c.id FROM classrooms c WHERE c.id = ? AND ${CLASSROOM_ACCESS_SQL}`, [
    id,
    ...times(user.userId, 4),
  ]);
  if (!allowed) throw denied;
  return classroom;
};

/* ================= COURSES ================= */
/**
 * Returns the course, or throws. When classroomId is given the course must belong to exactly
 * that classroom (class + section). A course without a classroom (older data) is only
 * available to the teacher who teaches it, and never through a class/section selection.
 */
const authorizeCourse = async (req, courseId, classroomId = null) => {
  const user = currentUser(req);
  const id = Number(courseId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid course');

  const course = await get('SELECT * FROM courses WHERE id = ?', [id]);
  if (!course) throw new HttpError(404, 'Course not found');

  if (classroomId !== null && classroomId !== undefined && classroomId !== '') {
    if (Number(course.classroomId) !== Number(classroomId)) {
      throw new HttpError(400, 'This course does not belong to the selected class and section');
    }
  }

  const denied = new HttpError(403, 'You are not authorized for this course');
  const teachesIt = String(course.mentorId) === String(user.userId);

  if (!course.classroomId) {
    if (user.isAdmin ? Number(course.university_id) === Number(user.universityId) : teachesIt) return course;
    throw denied;
  }

  // The course's classroom must be in the user's school
  const classroom = await get('SELECT id, university_id FROM classrooms WHERE id = ?', [course.classroomId]);
  if (!classroom || Number(classroom.university_id) !== Number(user.universityId)) throw denied;
  if (user.isAdmin || teachesIt) return course;

  const staff = await get(`SELECT c.id FROM classrooms c WHERE c.id = ? AND ${CLASSROOM_STAFF_SQL}`, [
    classroom.id,
    ...times(user.userId, 3),
  ]);
  if (!staff) throw denied;
  return course;
};

/* ================= CLASS -> SECTION -> COURSE TREE ================= */
// Two queries in total, whatever the number of classrooms.
const getTeachingScope = async (req) => {
  const user = currentUser(req);
  const classrooms = await listClassrooms(req);
  if (classrooms.length === 0) return [];

  const courses = user.isAdmin
    ? await all(
        `SELECT co.id, co.title, co.classroomId FROM courses co
         JOIN classrooms c ON c.id = co.classroomId
         WHERE c.university_id = ? ORDER BY co.title`,
        [user.universityId]
      )
    : await all(
        `SELECT co.id, co.title, co.classroomId FROM courses co
         JOIN classrooms c ON c.id = co.classroomId
         WHERE c.university_id = ? AND (co.mentorId = ? OR ${CLASSROOM_STAFF_SQL})
         ORDER BY co.title`,
        [user.universityId, user.userId, ...times(user.userId, 3)]
      );

  const byClassroom = new Map();
  courses.forEach((course) => {
    if (!byClassroom.has(course.classroomId)) byClassroom.set(course.classroomId, []);
    byClassroom.get(course.classroomId).push({ id: course.id, title: course.title });
  });

  return classrooms.map((c) => ({
    id: c.id,
    name: c.name,
    grade: c.grade,
    section: c.section,
    courses: byClassroom.get(c.id) || [],
  }));
};

module.exports = {
  HttpError,
  CLASSROOM_ACCESS_SQL,
  listClassrooms,
  authorizeClassroom,
  authorizeCourse,
  getTeachingScope,
};
