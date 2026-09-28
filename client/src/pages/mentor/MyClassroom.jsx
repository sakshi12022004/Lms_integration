import { useEffect, useState } from "react";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import MentorLayout from "../../components/MentorLayout";
import { toast } from "react-toastify";
import { useNavigate, useLocation } from "react-router-dom";

const MyClassroom = () => {
  const { API, token, socket } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [classroom, setClassroom] = useState(null);
  const [courses, setCourses] = useState([]); // ✅ KEPT
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  /* ================= FETCH MY CLASSROOM ================= */
  const unwrapResponse = (data) => {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      if ('data' in data) return data.data;
      if ('classrooms' in data) return data.classrooms;
    }
    return null;
  };

  const fetchClassroom = async () => {
    try {
      setLoading(true);
      setError(false);

      const teacherId = localStorage.getItem('userId') || 'me';
      console.log(`Fetching classrooms for teacherId: ${teacherId}`);
      const res = await fetch(`${API}/classrooms/mentor/${teacherId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const raw = await res.json();
      console.log('Classrooms response:', raw);
      const data = unwrapResponse(raw);
      console.log('Unwrapped classroom data:', data);

      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        console.log('Setting classroom:', first);
        setClassroom({
          ...first,
          students: Array.isArray(first.students) ? first.students : [],
          courses: Array.isArray(first.courses) ? first.courses : [],
        });
      } else {
        console.log('No classrooms found for teacher');
        setClassroom(null);
      }
    } catch (err) {
      console.error(err);
      setError(true);
      toast.error("Failed to load classroom");
    } finally {
      setLoading(false);
    }
  };

  /* ================= FETCH CLASSROOM STUDENTS (NEW) ================= */
  const fetchClassroomStudents = async (classroomId) => {
    try {
      if (!classroomId) {
        console.log('No classroomId provided, skipping fetch');
        setStudents([]);
        return;
      }

      console.log(`Fetching students for classroom: ${classroomId}`);
      const res = await fetch(`${API}/classrooms/${classroomId}/students`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const raw = await res.json();
      console.log('Students response:', raw);
      // Unwrap: backend returns { success: true, data: [...] }
      const studentsList = raw?.data || raw || [];
      console.log('Parsed students list:', studentsList);
      setStudents(Array.isArray(studentsList) ? studentsList : []);
    } catch (err) {
      console.error('Error fetching classroom students:', err);
      setStudents([]);
    }
  };

  /* ================= FETCH CLASSROOM COURSES (🔥 FIXED) ================= */
  const fetchClassroomCourses = async () => {
    try {
      // Only fetch if we have a classroom with an ID
      if (!classroom || !classroom.id) {
        setCourses([]);
        return;
      }

      // Try path param first, fallback to query param
      let res = await fetch(`${API}/courses/classroom/${classroom.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        res = await fetch(`${API}/courses/classroom?classroomId=${classroom.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      const data = await res.json();

      const safeCourses = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

      setCourses(safeCourses);

      // 🔒 keep classroom state in sync (NO REMOVAL)
      setClassroom((prev) =>
        prev
          ? {
              ...prev,
              courses: safeCourses,
            }
          : prev
      );
    } catch (err) {
      console.error("FETCH COURSES ERROR:", err);
    }
  };

  /* ================= AUTO REFRESH ================= */
  useEffect(() => {
    const loadData = async () => {
      await fetchClassroom();
    };

    loadData();
  }, [location.pathname]);

  // Fetch students and courses when classroom changes
  useEffect(() => {
    console.log('Classroom changed:', classroom);
    if (classroom?.id) {
      console.log('Fetching data for classroom ID:', classroom.id);
      fetchClassroomStudents(classroom.id);
      fetchClassroomCourses();
    }
  }, [classroom?.id]);

  // Refresh when a student is assigned elsewhere
  useEffect(() => {
    if (!socket) return;
    const onStudentAssigned = () => {
      console.log('Student assigned event received, refreshing classroom and students');
      fetchClassroom();
    };
    socket.on('student-assigned', onStudentAssigned);
    return () => socket.off('student-assigned', onStudentAssigned);
  }, [socket]);

  /* ================= LOADING ================= */
  if (loading) {
    return (
      <MentorLayout>
        <p>Loading classroom...</p>
      </MentorLayout>
    );
  }

  /* ================= ERROR ================= */
  if (error) {
    return (
      <MentorLayout>
        <p className="text-red-500">
          Something went wrong. Please refresh the page.
        </p>
      </MentorLayout>
    );
  }

  /* ================= NOT CLASS TEACHER ================= */
  if (!classroom) {
    return (
      <MentorLayout>
        <p className="text-gray-600">
          You are not assigned as a class teacher yet.
        </p>
      </MentorLayout>
    );
  }

  /* ================= CLASSROOM VIEW ================= */
  return (
    <MentorLayout>
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            {classroom.name} {classroom.section && `- ${classroom.section}`}
          </h1>
          <p className="text-gray-500 mt-1">Class Teacher: You</p>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => navigate("/mentor/create-course")}
            className="bg-primary text-white px-4 py-2 rounded-lg"
          >
            Create Course
          </button>

          <button
            onClick={() => navigate("/mentor/assign-classroom-students")}
            className="border px-4 py-2 rounded-lg"
          >
            Assign Students
          </button>

          <button
            onClick={() => navigate(`/mentor/attendance?classroomId=${classroom.id}`)}
            className="border px-4 py-2 rounded-lg"
          >
            Attendance
          </button>

          <button
            onClick={() => navigate("/mentor/add-result")}
            className="border px-4 py-2 rounded-lg"
          >
            Add Result
          </button>
        </div>

        {/* STUDENTS */}
        <div className="mb-8">
          <h2 className="font-semibold text-lg mb-2">Students</h2>

          {students.length === 0 ? (
            <p className="text-gray-500">No students assigned yet</p>
          ) : (
            <table className="w-full border rounded-lg">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Email</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s._id || s.id} className="border-t">
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2">{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* COURSES */}
        <div>
          <h2 className="font-semibold text-lg mb-2">Courses</h2>

          {courses.length === 0 ? (
            <p className="text-gray-500">No courses created yet</p>
          ) : (
            <div className="space-y-3">
              {courses.map((c) => (
                <div
                  key={c._id}
                  onClick={() => navigate(`/mentor/course/${c._id}`)}
                  className="border rounded-lg p-4 cursor-pointer hover:shadow"
                >
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className="text-sm text-gray-500">
                    Category: {c.category}
                  </p>
                  <p className="text-sm text-gray-500">
                    Duration: {c.duration} hrs
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </MentorLayout>
  );
};

export default MyClassroom;
