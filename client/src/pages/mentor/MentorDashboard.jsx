import AnnouncementBell from "../../components/AnnouncementBell";
import CreateAnnouncementModal from "../../components/announcements/CreateAnnouncementModal";
import QuotaLimitModal from "../../components/QuotaLimitModal";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/auth";
import MentorLayout from "../../components/MentorLayout";
import { useTranslation } from "../../context/TranslationContext";
import { toast } from "react-toastify";
import {
  BookOpen,
  Award,
  PlusCircle,
  Users,
  TrendingUp,
  ClipboardList
} from "lucide-react";

/* ================= RANDOM COURSE THEMES ================= */

const COURSE_BACKGROUNDS = [
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
  "https://images.unsplash.com/photo-1503676260728-1c00da094a0b",
  "https://images.unsplash.com/photo-1584697964154-f09e38f4c5b3",
  "https://images.unsplash.com/photo-1532619675605-1ede6c2ed2b0"
];

const COURSE_GRADIENTS = [
  "from-purple-600 to-indigo-600",
  "from-blue-600 to-cyan-600",
  "from-emerald-600 to-teal-600",
  "from-pink-600 to-rose-600",
  "from-orange-500 to-amber-500",
  "from-violet-600 to-fuchsia-600"
];

const getCourseTheme = (id) => {
  if (!id) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

const MentorDashboard = () => {
  const navigate = useNavigate();
  const { user, token, API } = useAuth();
  const { t } = useTranslation();

  const [courseList, setCourseList] = useState([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);

  /* 🔔 Announcement modal */
  const [openAnnouncement, setOpenAnnouncement] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaDetails, setQuotaDetails] = useState(null);

  useEffect(() => {
    if (user && token && API) {
      fetchCourses();
    } else {
      setIsLoadingCourses(false);
    }
  }, [user, token, API]);

  const fetchCourses = async () => {
    try {
      const res = await fetch(`${API}/courses/mentor`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setCourseList(Array.isArray(data) ? data : []);
      } else {
        setCourseList([]);
      }
    } catch (error) {
      console.error('Failed to load courses:', error);
      setCourseList([]);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  /** 🔥 CONDITIONAL REDIRECT LOGIC (UPDATED) */
  const handleAssessmentClick = (courseId) => {
    // Always navigate to Create Assessment page as requested
    navigate("/mentor/create-assessment", {
      state: { courseId },
    });
  };

  /* ================= REQUIRE USER ================= */
  if (!user) {
    return (
      <MentorLayout>
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </MentorLayout>
    );
  }

  /* ================= RENDER DASHBOARD ================= */
  return (
    <MentorLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-10">

        {/* ================= TOP BAR ================= */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {t('welcome_back')}, {user?.name || "Mentor"}
            </h1>
            <p className="text-gray-500 text-sm">
              {t('mentoring_overview')}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div data-tour="mentor-announcements"><AnnouncementBell /></div>
          </div>
        </div>

        {/* ================= HERO ================= */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between text-white">
          <div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-4"
              style={{ fontFamily: "'Inter', 'Poppins', system-ui, sans-serif" }}
            >
              {t('inspire_teach_lead')}
            </h2>

            <p
              className="text-white/90 text-lg md:text-xl leading-relaxed max-w-xl"
              style={{ fontFamily: "'Inter', 'Poppins', system-ui, sans-serif" }}
            >
              {t('manage_courses_hero')}
            </p>

          </div>

          <img
            src="https://static.vecteezy.com/system/resources/previews/009/363/425/non_2x/back-to-school-3d-characters-png.png"
            alt="mentor"
            className="w-44 mt-6 md:mt-0"
          />
        </div>

        {/* ================= STATS ================= */}
        <div data-tour="mentor-stats" className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div className="rounded-xl p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:scale-105 transition-all duration-300">
            <p className="text-sm opacity-90 mb-1">{t('total_courses')}</p>
            <h3 className="text-3xl font-bold">{isLoadingCourses ? '-' : courseList.length}</h3>
          </div>

          <div className="rounded-xl p-6 bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg hover:scale-105 transition-all duration-300">
            <p className="text-sm opacity-90 mb-1">{t('total_students')}</p>
            <h3 className="text-3xl font-bold">
              {isLoadingCourses ? '-' : courseList.reduce((a, c) => a + (c.students?.length || 0), 0)}
            </h3>
          </div>

          <div className="rounded-xl p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:scale-105 transition-all duration-300">
            <p className="text-sm opacity-90 mb-1">{t('active_courses')}</p>
            <h3 className="text-3xl font-bold">{isLoadingCourses ? '-' : courseList.length}</h3>
          </div>

        </div>

        {/* ================= COURSES ================= */}
        <div data-tour="mentor-courses" data-tour-courses-state={isLoadingCourses ? 'loading' : 'ready'}>
          <div className="flex items-center justify-between mb-4">
            <h2 data-tour="mentor-courses-heading" className="text-xl font-bold">{t('your_courses')}</h2>

            <button
              onClick={() => setOpenAnnouncement(true)}
              data-tour="mentor-create-announcement"
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg"
            >
              <PlusCircle size={18} />
              {t('announcement')}
            </button>
          </div>

          {courseList.length === 0 ? (
            <p className="text-gray-500">{t('no_courses_assigned')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courseList.map((course, courseIndex) => (
                <div
                  key={course._id}
                  data-tour={courseIndex === 0 ? 'mentor-first-course-card' : undefined}
                  className="relative h-52 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition transform hover:-translate-y-1"
                >
                  {/* Background */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${COURSE_BACKGROUNDS[
                        getCourseTheme(course._id) % COURSE_BACKGROUNDS.length
                      ]
                        })`,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                  />

                  {/* Gradient */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${COURSE_GRADIENTS[
                      getCourseTheme(course._id) % COURSE_GRADIENTS.length
                    ]
                      } opacity-90`}
                  />

                  {/* Content */}
                  <div className="relative z-10 p-4 flex flex-col justify-between h-full text-white">
                    <div>
                      <h3 className="text-lg font-bold line-clamp-2">
                        {course.title}
                      </h3>
                      <p className="text-sm opacity-90">
                        {course.students?.length || 0} students enrolled
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/mentor/course/${course._id}`)}
                        data-tour={courseIndex === 0 ? 'mentor-course-view' : undefined}
                        className="flex-1 bg-white/20 hover:bg-white/30 text-white text-xs py-2 rounded-lg"
                      >
                        {t('view')}
                      </button>
                      <button
                        data-tour={courseIndex === 0 ? 'mentor-course-add-chapter' : undefined}
                        onClick={() =>
                          navigate("/mentor/add-chapter", {
                            state: { courseId: course._id },
                          })
                        }
                        className="flex-1 bg-white/20 hover:bg-white/30 text-white text-xs py-2 rounded-lg"
                      >
                        {t('add_chapter')}
                      </button>

                      <button
                        data-tour={courseIndex === 0 ? 'mentor-course-assign' : undefined}
                        onClick={() =>
                          navigate("/mentor/assign-students", {
                            state: { courseId: course._id },
                          })
                        }
                        className="flex-1 bg-white/20 hover:bg-white/30 text-white text-xs py-2 rounded-lg"
                      >
                        {t('assign')}
                      </button>

                      <button
                        onClick={() => handleAssessmentClick(course._id)}
                        className="flex-1 bg-white/20 hover:bg-white/30 text-white text-xs py-2 rounded-lg"
                      >
                        {t('assessment')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= CREATE ANNOUNCEMENT MODAL ================= */}
      <CreateAnnouncementModal
        open={openAnnouncement}
        onClose={() => setOpenAnnouncement(false)}
        courses={courseList}
        onQuotaExceeded={(detail) => {
          setQuotaDetails(detail);
          setShowQuotaModal(true);
          setOpenAnnouncement(false);
        }}
      />

      {/* ================= QUOTA LIMIT MODAL ================= */}
      <QuotaLimitModal isOpen={showQuotaModal} onClose={() => setShowQuotaModal(false)} quotaDetails={quotaDetails} />
    </MentorLayout>
  );
};

export default MentorDashboard;
