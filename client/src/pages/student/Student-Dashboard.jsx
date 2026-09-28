import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import StudentLayout from "../../components/StudentLayout";
import AnnouncementBell from "../../components/AnnouncementBell";
import { useAuth } from "../../auth/auth";
import ProgressBar from "../../components/ProgressBar";
import { useTranslation } from "../../context/TranslationContext";
import {
  BookOpen,
  Trophy,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  GraduationCap,
} from "lucide-react";

const StudentDashboard = () => {
  const { user, token, API } = useAuth();
  const { t } = useTranslation();
  const [courses, setCourses] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalProgress: 0,
    completedCourses: 0,
    streakDays: 0,
    certificatesCount: 0,
    attendancePercentage: 0,
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        console.log("📊 Starting dashboard data fetch...");
        console.log("API URL:", API);
        console.log("Token available:", !!token);

        // Fetch classrooms
        console.log("🔍 DEBUG: Fetching student classrooms...");
        console.log("🔗 DEBUG: API URL:", `${API}/classrooms/student-classrooms`);
        console.log("👤 DEBUG: User:", user);
        console.log("🔑 DEBUG: Token available:", !!token);
        
        const classroomsResponse = await axios.get(
          `${API}/classrooms/student-classrooms`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        console.log("📊 DEBUG: Student classrooms response status:", classroomsResponse.status);
        console.log("📋 DEBUG: Student classrooms response data:", classroomsResponse.data);
        
        const classroomList = Array.isArray(classroomsResponse.data) ? classroomsResponse.data : [];
        console.log("✅ DEBUG: Classrooms fetched:", classroomList.length);
        console.log("📋 DEBUG: Classroom list:", classroomList);
        setClassrooms(classroomList);

        // Fetch attendance for student (no classroom dependency)
        let attendanceData = null;
        try {
          // Fetch attendance records for this student
          const attendanceResponse = await axios.get(
            `${API}/attendance/student`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          const allRecords = Array.isArray(attendanceResponse.data) 
            ? attendanceResponse.data 
            : (attendanceResponse.data?.data || []);
          const studentAttendance = Array.isArray(allRecords) ? allRecords : [];
          attendanceData = studentAttendance;
          setAttendance(attendanceData);
        } catch (err) {
          console.error("❌ Attendance fetch error:", err.response?.data || err.message);
        }

        // Fetch results
        try {
          console.log("🔄 Fetching results from: `${API}/results/my-results`");
          const resultsResponse = await axios.get(
            `${API}/results/my-results`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          console.log("📈 Results response received:", resultsResponse.data);

          const studentResults = Array.isArray(resultsResponse.data) 
            ? resultsResponse.data 
            : [];
          
          console.log("✅ Results count:", studentResults.length);
          setResults(studentResults);
        } catch (resultsErr) {
          console.error("❌ Results fetch error:", resultsErr.response?.data || resultsErr.message);
          // Try universal routes as fallback
          try {
            console.log("🔄 Trying universal results endpoint...");
            const studentId = user?.id || user?.userId || user?._id;
            console.log("📝 Using student ID:", studentId);
            const universalResultsResponse = await axios.get(
              `${API}/results/student/${studentId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const responseData = universalResultsResponse.data;
            const studentResults = Array.isArray(responseData?.data) ? responseData.data : 
                                 Array.isArray(responseData) ? responseData : [];
            console.log("✅ Universal results count:", studentResults.length);
            setResults(studentResults);
          } catch (universalErr) {
            console.error("❌ Universal results fetch also failed:", universalErr.response?.data || universalErr.message);
            setResults([]);
          }
        }

        // Fetch courses
        try {
          console.log("🔄 Fetching courses from: `${API}/courses/student`");
          const coursesResponse = await axios.get(
            `${API}/courses/student`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          console.log("📚 Courses response received:", coursesResponse.data);

          const enrolledCourses = Array.isArray(coursesResponse.data)
            ? coursesResponse.data
            : [];
          
          console.log("✅ Enrolled courses count:", enrolledCourses.length);

          if (enrolledCourses.length === 0) {
            console.warn("⚠️ No courses found for this student");
          }

          const coursesWithProgress = await Promise.all(
            enrolledCourses.map(async (course) => {
              try {
                const progressResponse = await axios.get(
                  `${API}/progress/${course._id}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );

                const progressData = progressResponse.data || {};

                return {
                  ...course,
                  progress: progressData.completionPercentage || 0,
                  completedChapters: progressData.completedChapters || 0,
                  totalChapters: progressData.totalChapters || 0,
                  progressDetails: progressData.progress || [],
                };
              } catch {
                return {
                  ...course,
                  progress: 0,
                  completedChapters: 0,
                  totalChapters: 0,
                  progressDetails: [],
                };
              }
            })
          );

          setCourses(coursesWithProgress);
          console.log("📊 Courses with progress set:", coursesWithProgress.length);

          const totalProgress =
            coursesWithProgress.length > 0
              ? coursesWithProgress.reduce((acc, c) => acc + c.progress, 0) /
              coursesWithProgress.length
              : 0;

          const completedCourses = coursesWithProgress.filter(
            (c) => c.progress === 100
          ).length;

          // Calculate attendance percentage from attendance data
          let attendancePercentage = 0;
          if (attendanceData && Array.isArray(attendanceData)) {
            const total = attendanceData.length;
            const presentCount = attendanceData.filter(record => (record.status || '').toLowerCase() === 'present').length;
            attendancePercentage = total > 0 ? (presentCount / total) * 100 : 0;
          } else if (attendanceData && attendanceData.percentage) {
            attendancePercentage = attendanceData.percentage;
          }

          setStats({
            totalCourses: coursesWithProgress.length,
            totalProgress: Math.round(totalProgress),
            completedCourses,
            streakDays: 4,
            certificatesCount: 0,
            attendancePercentage: Math.round(attendancePercentage),
          });
          
          console.log("✅ Dashboard stats updated:", {
            totalCourses: coursesWithProgress.length,
            totalProgress: Math.round(totalProgress),
            completedCourses,
            attendancePercentage: Math.round(attendancePercentage),
          });
        } catch (courseErr) {
          console.error("❌ Course fetch error:", courseErr.response?.data || courseErr.message);
          console.error("Course endpoint status:", courseErr.response?.status);
          console.error("Full error:", courseErr);
          setCourses([]);
        }

      } catch (err) {
        console.error("❌ Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [token, API]);

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex-1 overflow-y-auto scrollable-content p-3 sm:p-4 md:p-6">
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin h-10 w-10 border-4 border-purple-500 border-t-transparent rounded-full"></div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="flex-1 overflow-y-auto scrollable-content p-3 sm:p-4 md:p-6">
        <div className="responsive-container space-y-4 sm:space-y-6">

          {/* HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="responsive-text-2xl font-bold">Dashboard</h1>
              <p className="text-gray-500 responsive-text-sm">Welcome back</p>
            </div>
            <div data-tour="announcement-bell"><AnnouncementBell /></div>
          </div>

          {/* WELCOME BANNER */}
          <div className="responsive-card bg-gradient-to-r from-purple-500 to-purple-400 text-white relative overflow-hidden">
            <div className="responsive-card-content flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex-1">
                <p className="responsive-text-sm opacity-80">{new Date().toDateString()}</p>
                <h2 className="responsive-text-xl sm:text-2xl font-bold mt-2">
                  Welcome back, {user?.name || "Student"}!
                  {user?.studentId && (
                    <div className="responsive-text-sm opacity-80 mt-1">
                      Roll No: {user.studentId}
                    </div>
                  )}
                </h2>
                <p className="responsive-text-sm opacity-90 mt-1">
                  {t('always_stay_updated_student_portal')}
                </p>
              </div>

              {/* ✅ 3D CARTOON CHARACTER */}
              <img
                src="https://static.vecteezy.com/system/resources/previews/009/363/425/non_2x/back-to-school-3d-characters-png.png"
                alt="3D Student"
                className="w-24 h-24 sm:w-40 sm:h-40 object-contain drop-shadow-2xl flex-shrink-0"
              />
            </div>
          </div>

          {/* STATS */}
          <div data-tour="stats-grid" className="dashboard-grid">
            <div className="responsive-card animate-fade-in hover:scale-105 transition-all duration-300">
              <div className="responsive-card-content">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 responsive-text-sm">{t('total_courses')}</p>
                    <h3 className="responsive-text-lg sm:text-xl font-bold">{stats.totalCourses}</h3>
                  </div>
                  <BookOpen className="text-purple-500" size={20} />
                </div>
              </div>
            </div>

            <div className="responsive-card border-2 border-purple-400 animate-fade-in hover:scale-105 transition-all duration-300">
              <div className="responsive-card-content">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 responsive-text-sm">{t('avg_progress')}</p>
                    <h3 className="responsive-text-lg sm:text-xl font-bold">{stats.totalProgress}%</h3>
                  </div>
                  <Clock className="text-purple-500" size={20} />
                </div>
              </div>
            </div>

            <div className="responsive-card animate-fade-in hover:scale-105 transition-all duration-300">
              <div className="responsive-card-content">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 responsive-text-sm">{t('attendance')}</p>
                    <h3 className="responsive-text-lg sm:text-xl font-bold">{stats.attendancePercentage.toFixed(1)}%</h3>
                  </div>
                  <CheckCircle className="text-green-500" size={20} />
                </div>
              </div>
            </div>
          </div>

          {/* CLASSROOM & TIMETABLE */}
          {classrooms.length > 0 && (
            <div className="space-y-4 animate-slide-in">
              <h2 className="font-bold text-lg">{t('my_classroom')}</h2>
              {classrooms.map((classroom) => {
                // Filter courses that belong to this classroom
                const classroomCourses = courses.filter(course => course.classroomId === classroom.id || course.classroomId === classroom._id);
                
                return (
                  <div key={classroom._id} className="bg-white rounded-2xl p-6 shadow hover:shadow-lg transition-all duration-300 transform hover:scale-105 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">
                          {classroom.name} {classroom.section && `- ${classroom.section}`}
                        </h3>
                        <p className="text-gray-500 text-sm">
                          {t('class_teacher')}: {classroom.classTeacher?.name || t('not_assigned')}
                        </p>
                      </div>
                      {classroom.photo && (
                        <img
                          src={`${API}${classroom.photo}`}
                          alt={classroom.name}
                          className="w-24 h-24 rounded-lg object-cover"
                        />
                      )}
                    </div>
                    
                    {/* Display courses if this classroom has any */}
                    {classroomCourses.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">📚 {t('courses_in_classroom')}</h4>
                        <div className="space-y-2">
                          {classroomCourses.map((course) => (
                            <div 
                              key={course._id} 
                              className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 cursor-pointer hover:shadow-md group"
                              onClick={() => {
                                console.log('🎯 Clicking course:', course._id, course.title || course.name);
                                navigate(`/student/course/${course._id}`);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h5 className="font-semibold text-gray-800 text-sm group-hover:text-blue-700 transition-colors">
                                    {course.title || course.name}
                                  </h5>
                                  <p className="text-xs text-gray-600 mt-1">
                                    {course.description ? course.description.substring(0, 80) + '...' : t('no_description_available')}
                                  </p>
                                  {course.courseTeacher && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {t('instructor')}: {course.courseTeacher.name}
                                    </p>
                                  )}
                                </div>
                                <div className="ml-4 text-right">
                                  {course.progress !== undefined && (
                                    <div className="text-xs text-gray-600 mb-1">
                                      Progress: {course.progress}%
                                    </div>
                                  )}
                                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                                      style={{ width: `${Math.min(100, course.progress || 0)}%`, maxWidth: '100%' }}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2 pt-2 border-t border-blue-200">
                                <p className="text-xs text-blue-600 font-medium flex items-center group-hover:text-blue-800 transition-colors">
                                  📚 Click to access materials, assessments & more →
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ATTENDANCE & RESULTS QUICK VIEW */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Attendance Widget */}
            <div data-tour="attendance-summary" className="bg-white rounded-2xl p-6 shadow hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">📊 Attendance Summary</h2>
                <Link to="/student/attendance" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View All →
                </Link>
              </div>
              <div className="space-y-3">
                {attendance && Array.isArray(attendance) && attendance.length > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600">Present</p>
                        <p className="text-2xl font-bold text-green-600">{attendance.filter(a => a.status === 'present').length}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600">Absent</p>
                        <p className="text-2xl font-bold text-red-600">{attendance.filter(a => a.status === 'absent').length}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600">Total</p>
                        <p className="text-2xl font-bold text-blue-600">{attendance.length}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">Last 5 records:</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {attendance.slice(0, 5).map((record, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span className="text-sm text-gray-700">{new Date(record.date).toLocaleDateString()}</span>
                          <span className={`text-xs px-2 py-1 rounded font-medium ${record.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {record.status === 'present' ? '✓ Present' : '✗ Absent'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm">No attendance records yet</p>
                )}
              </div>
            </div>

            {/* Results Widget */}
            <div data-tour="result-summary" className="bg-white rounded-2xl p-6 shadow hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">📊 Results Summary</h2>
                <Link to="/student/results" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View All →
                </Link>
              </div>
              <div className="space-y-3">
                {results && results.length > 0 ? (
                  <>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {results.slice(0, 3).map((result, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-gray-800">{result.term || 'Examination'}</h4>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${result.overallPercentage >= 85 ? 'bg-green-100 text-green-700' : result.overallPercentage >= 70 ? 'bg-blue-100 text-blue-700' : result.overallPercentage >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {result.overallStatus || 'PASS'} ({result.overallPercentage || 0}%)
                            </span>
                          </div>
                          
                          {result.subjects && (
                            <div className="mb-2">
                              <p className="text-xs text-gray-600 mb-1">Subject-wise Marks:</p>
                              <div className="flex flex-wrap gap-2">
                                {Array.isArray(result.subjects) ? result.subjects.map((subject, subIdx) => (
                                  <span key={subIdx} className="text-xs bg-white px-2 py-1 rounded border">
                                    {subject.name}: {subject.marks}/{subject.total}
                                  </span>
                                )) : (
                                  <span className="text-xs text-gray-500">Subjects data available</span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {result.comments && (
                            <p className="text-xs text-gray-600 italic">"${result.comments}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {results.length > 3 && (
                      <p className="text-xs text-gray-500 text-center">Showing latest 3 of {results.length} results</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-3">Click the button above to view your detailed report cards and marks.</p>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-sm text-blue-900">
                        <span className="font-semibold">Tip:</span> Your results will appear here as soon as your teachers publish them. Check back regularly for updates!
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* COURSES */}
          <div data-tour="enrolled-courses" className="space-y-4">
            <h2 className="font-bold text-lg">Enrolled Courses</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((course, index) => (
                <Link
                  key={course._id}
                  to={`/student/course/${course._id}`}
                  data-tour={index === 0 ? 'first-course-card' : undefined}
                  className="relative rounded-xl overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl group animate-scale-in"
                  style={{
                    animationDelay: `${index * 0.1}s`,
                    backgroundImage: course.photo ? `url(${API}${course.photo})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    minHeight: '200px'
                  }}
                >
                  <div className="absolute inset-0 bg-black/50 group-hover:bg-black/60 transition-all duration-300"></div>
                  <div className="relative p-5 text-white h-full flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between mb-2">
                        <BookOpen className="text-white" size={20} />
                        {course.progress === 100 && <Trophy className="text-yellow-400" size={20} />}
                      </div>
                      <h3 className="font-bold text-lg mb-2">{course.title}</h3>
                      {course.description && (
                        <p className="text-sm opacity-90 mb-3 line-clamp-2">{course.description}</p>
                      )}
                    </div>
                    <div>
                      <ProgressBar progress={course.progress} />
                      <p className="text-xs mt-2 opacity-80">
                        {course.completedChapters}/{course.totalChapters} chapters completed
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </StudentLayout>
  );
};

export default StudentDashboard;