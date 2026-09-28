import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MentorLayout from "../../components/MentorLayout";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import { toast } from "react-toastify";
import { Plus, BookOpen, Users, X, ChevronDown, ArrowRight, GraduationCap } from "lucide-react";

const MentorClassrooms = () => {
  const { API, token, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
    category: "",
    duration: "",
    courseTeacherId: "",
    studentIds: [],
  });

  const fetchAssignedClassrooms = async () => {
    try {
      setLoading(true);
      
      console.log("🔍 DEBUG: fetchAssignedClassrooms called");
      console.log("👤 DEBUG: User object:", user);
      console.log("🔑 DEBUG: Token available:", !!token);
      
      // Always set loading to false in a timeout to prevent infinite loading
      const loadingTimeout = setTimeout(() => {
        setLoading(false);
        console.log("⏰ DEBUG: Loading timeout - forcing loading to false");
      }, 5000);
      
      if (!user?.id && !user?._id) {
        console.error("❌ DEBUG: No user ID available");
        setClassrooms([]);
        clearTimeout(loadingTimeout);
        setLoading(false);
        return;
      }
      
      const userId = user.id || user._id;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      console.log("🔍 DEBUG: User ID:", userId);
      console.log("🔗 DEBUG: API URL:", `${API}/classrooms/my-classrooms`);
      console.log("🔑 DEBUG: Headers:", headers);
      
      // Fetch classrooms assigned to this mentor
      const res = await fetch(`${API}/classrooms/my-classrooms`, {
        headers: headers,
      });
      
      console.log("📊 DEBUG: Response status:", res.status);
      console.log("📊 DEBUG: Response ok:", res.ok);
      
      const data = await res.json();
      
      console.log("📋 DEBUG: Response data:", data);
      
      clearTimeout(loadingTimeout);
      
      if (!res.ok) {
        console.warn("❌ DEBUG: API Error:", data.message);
        setClassrooms([]);
      } else {
        // Handle both array and wrapped response
        const classroomList = data.data || data.classrooms || data;
        const validClassrooms = Array.isArray(classroomList) ? classroomList : [];
        
        console.log("📋 DEBUG: Extracted classroomList:", classroomList);
        console.log("📋 DEBUG: Valid classrooms:", validClassrooms);
        console.log("📋 DEBUG: Is array:", Array.isArray(classroomList));
        console.log("📋 DEBUG: Length:", validClassrooms.length);
        
        setClassrooms(validClassrooms);
        console.log(`✅ Loaded ${validClassrooms.length} classrooms for user ${userId}`);
      }
    } catch (err) {
      console.error("❌ DEBUG: Fetch error:", err);
      setClassrooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedClassrooms();
    
    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      console.log("⚠️ SAFETY: Forced loading to false after 10 seconds");
    }, 10000);
    
    return () => clearTimeout(safetyTimeout);
  }, []);

  const handleCreateCourse = (classroom) => {
    // Navigate to CreateCourse page with classroom context
    navigate('/mentor/create-course', { 
      state: { 
        classroomId: classroom._id || classroom.id,
        classroomName: classroom.name 
      } 
    });
  };

  
  return (
    <MentorLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          {/* ENHANCED HEADER */}
          <div data-tour="classrooms-header" data-tour-classrooms-state={loading ? 'loading' : 'ready'} className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-lg">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-5xl font-bold text-gray-900">{t('my_classrooms')}</h1>
            </div>
            <p className="text-gray-600 text-lg ml-14">{t('manage_classrooms_courses_students')}</p>
          </div>

          {/* CONTENT */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : classrooms.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl shadow-md border-2 border-dashed border-gray-300">
              <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <GraduationCap className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('no_classrooms_assigned')}</h3>
              <p className="text-gray-600 mb-6">{t('not_assigned_to_classrooms')}</p>
              <button
                onClick={() => navigate("/mentor")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition"
              >
                {t('go_to_dashboard')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
              {classrooms.map((classroom, classroomIndex) => (
                <div
                  key={classroom._id || classroom.id}
                  data-tour={classroomIndex === 0 ? 'my-classroom-first-card' : undefined}
                  onClick={() => navigate(`/mentor/classroom/${classroom._id || classroom.id}`)}
                  className="bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer transform hover:scale-105 border-t-4 border-blue-500 group"
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 border-b-2 border-blue-100 group-hover:from-blue-100 transition">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-1">{classroom.name}</h3>
                        <p className="text-sm text-gray-600">📚 Grade {classroom.grade} • Section {classroom.section}</p>
                      </div>
                      <div className="bg-blue-500 p-3 rounded-lg">
                        <GraduationCap size={24} className="text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <span className="text-gray-700 font-medium">{t('students')}</span>
                      </div>
                      <span className="font-bold text-xl text-blue-600">{classroom.studentCount || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3">
                      <span className="text-gray-700 font-medium">👨‍🏫 {t('class_teacher')}</span>
                      <span className="text-gray-900 font-semibold">
                        {classroom.classTeacher?.name || "Not Assigned"}
                      </span>
                    </div>

                    {classroom.academicYear && (
                      <div className="flex items-center justify-between p-3 border-t border-gray-200 pt-4">
                        <span className="text-gray-700 font-medium">{t('academic_year')}</span>
                        <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-semibold">
                          {classroom.academicYear}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t-2 border-gray-200 flex items-center justify-between group-hover:bg-blue-50 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateCourse(classroom);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm"
                    >
                      <Plus size={16} />
                      {t('create_course')}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/mentor/classroom/${classroom._id || classroom.id}`);
                      }}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition text-sm font-medium"
                    >
                      {t('view_details')} →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MentorLayout>
  );
};

export default MentorClassrooms;
