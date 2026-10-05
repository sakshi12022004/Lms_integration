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
        <div className="p-8 text-center bg-[#fffdf4] border border-[#ebdcaa]">
          <div className="animate-spin rounded-none h-10 w-10 border-4 border-[#B99652] border-t-transparent mx-auto"></div>
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mt-3">{t('loading_classroom')}</p>
        </div>
      </AdminLayout>
    );
  }

  if (!classroom) {
    return (
      <AdminLayout>
        <div className="p-8 text-center bg-[#fffdf4] border border-[#ebdcaa]">
          <p className="text-sm font-semibold text-red-600">{t('classroom_not_found')}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#ebdcaa]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin/classrooms")}
              className="p-2 bg-white border border-[#ebdcaa] rounded-none hover:bg-[#ebdcaa]/30 text-[#1e1b4b] transition-colors"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-[#B99652]" />
            </button>
            <div>
              <h1 className="text-3xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b]">
                {classroom.name} {classroom.section && `- Section ${classroom.section}`}
              </h1>
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mt-0.5">
                {t('class_teacher')}: {" "}
                <span className="text-[#1e1b4b]">
                  {(typeof classroom.classTeacher === 'object' ? classroom.classTeacher?.name : classroom.classTeacher) || t('not_assigned')}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* COURSES LIST (READ-ONLY FOR ADMIN) */}
        <div className="bg-[#fffdf4] border border-[#ebdcaa] rounded-none p-6 shadow-xs">
          <div className="flex items-center gap-2 pb-3 mb-5 border-b border-[#ebdcaa]">
            <BookOpen className="w-5 h-5 text-[#B99652]" />
            <h2 className="font-bold text-xl font-['DM_Serif_Display',serif] text-[#1e1b4b]">{t('courses')}</h2>
          </div>

          {courses.length === 0 ? (
            <div className="text-center py-12 bg-white border border-[#ebdcaa]">
              <p className="text-sm font-semibold text-[#1e1b4b]">{t('no_courses_yet')}</p>
              <p className="text-xs text-slate-500 mt-1">No courses have been assigned to this classroom yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.map((course) => (
                <div
                  key={course._id}
                  className="bg-white border border-[#ebdcaa] border-l-4 border-l-[#B99652] rounded-none p-5 shadow-xs hover:border-[#B99652] transition-colors"
                >
                  <h3 className="font-bold text-lg font-['DM_Serif_Display',serif] text-[#1e1b4b]">{course.title}</h3>

                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    <p>
                      <span className="font-semibold text-slate-500 uppercase tracking-wider">{t('teacher')}:</span>{" "}
                      <span className="font-semibold text-[#1e1b4b]">{course.mentor?.name || t('not_assigned')}</span>
                    </p>

                    <p className="flex items-center gap-1.5 text-slate-600">
                      <Users className="w-4 h-4 text-[#B99652]" />
                      <span className="font-semibold text-slate-500 uppercase tracking-wider">{t('students')}:</span>{" "}
                      <span className="font-semibold text-[#1e1b4b]">{course.students?.length || 0}</span>
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
