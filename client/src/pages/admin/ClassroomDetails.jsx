import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { useAuth } from "../../auth/auth";
import { toast } from "react-toastify";
import { ArrowLeft, Users, BookOpen } from "lucide-react";
import { useTranslation } from "../../context/TranslationContext";

const ClassroomDetails = () => {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const { API, token } = useAuth();
  const { t } = useTranslation();

  const [classroom, setClassroom] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH CLASSROOM ================= */
  const fetchClassroom = async () => {
    try {
      const res = await fetch(`${API}/classrooms/${classroomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Handle both response formats: { data: {...} } and {...}
      const classroom = data.data || data;
      setClassroom(classroom);
    } catch (err) {
      console.error("Error fetching classroom:", err);
      toast.error(err.message || t('failed_to_load_classroom'));
      setClassroom(null);
    }
  };

  /* ================= FETCH COURSES ================= */
  const fetchCourses = async () => {
    try {
      const res = await fetch(
        `${API}/courses/classroom?classroomId=${classroomId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Handle both response formats
      const coursesList = Array.isArray(data) ? data : (data.data || []);
      setCourses(coursesList);
    } catch (err) {
      console.error("Error fetching courses:", err);
      toast.error(err.message || t('failed_to_load_courses'));
      setCourses([]);
    }
  };

  useEffect(() => {
    if (classroomId) {
      Promise.all([fetchClassroom(), fetchCourses()]).finally(() =>
        setLoading(false)
      );
    }
  }, [classroomId]);

  if (loading) {
    return (
      <AdminLayout>
        <p>{t('loading_classroom')}</p>
      </AdminLayout>
    );
  }

  if (!classroom) {
    return (
      <AdminLayout>
        <p className="text-red-500">{t('classroom_not_found')}</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/admin/classrooms")}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Go back"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">
                {classroom.name} {classroom.section && `- ${classroom.section}`}
              </h1>
              <p className="text-gray-600">
                {t('class_teacher')}: {" "}
                <span className="font-medium">
                  {(typeof classroom.classTeacher === 'object' ? classroom.classTeacher?.name : classroom.classTeacher) || t('not_assigned')}
                </span>
              </p>
            </div>
          </div>

          {/* ❌ CREATE COURSE REMOVED FOR ADMIN */}
        </div>

        {/* COURSES LIST (READ-ONLY FOR ADMIN) */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-lg">{t('courses')}</h2>
          </div>

          {courses.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('no_courses_yet')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.map((course) => (
                <div
                  key={course._id}
                  className="border rounded-lg p-4 hover:shadow-md transition"
                >
                  <h3 className="font-semibold text-lg">{course.title}</h3>

                  <div className="mt-3 space-y-2 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">{t('teacher')}:</span>{" "}
                      {course.mentor?.name || t('not_assigned')}
                    </p>

                    <p className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span className="font-medium">{t('students')}:</span>{" "}
                      {course.students?.length || 0}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
};

export default ClassroomDetails;
