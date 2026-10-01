import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import StudentLayout from '../../components/StudentLayout';
import ProgressBar from '../../components/ProgressBar';
import { useAuth } from '../../auth/auth';
import { useTranslation } from '../../context/TranslationContext';
import {
  BookOpen,
  Users,
  Clock,
  PlayCircle,
  Award,
  ChevronRight,
  Search,
  TrendingUp,
  CheckCircle,
  Calendar
} from 'lucide-react';

const Courses = () => {
  const { token, API } = useAuth();
  const { t } = useTranslation();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);

        const coursesResponse = await axios.get(`${API}/courses/student`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const enrolledCourses = coursesResponse.data;

        const coursesWithProgress = await Promise.all(
          enrolledCourses.map(async (course) => {
            try {
              const progressResponse = await axios.get(`${API}/progress/${course._id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });

              const courseDetailsResponse = await axios.get(`${API}/courses/${course._id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });

              return {
                ...course,
                mentor: courseDetailsResponse.data.mentorId,
                progress: progressResponse.data.completionPercentage || 0,
                completedChapters: progressResponse.data.completedChapters || 0,
                totalChapters: progressResponse.data.totalChapters || 0
              };
            } catch (error) {
              return {
                ...course,
                progress: 0,
                completedChapters: 0,
                totalChapters: 0
              };
            }
          })
        );

        setCourses(coursesWithProgress);
      } catch (err) {
        console.error('Error fetching courses');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchCourses();
    }
  }, [token, API]);

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' ||
                         (filterStatus === 'completed' && course.progress === 100) ||
                         (filterStatus === 'in-progress' && course.progress > 0 && course.progress < 100);

    return matchesSearch && matchesStatus;
  });

  const formatDate = (date) => {
    if (!date) return t('not_started');
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('today');
    if (diffDays === 1) return t('yesterday');
    if (diffDays < 7) return t('days_ago').replace('{days}', diffDays);

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const stats = {
    totalCourses: courses.length,
    completedCourses: courses.filter(c => c.progress === 100).length,
    inProgressCourses: courses.filter(c => c.progress > 0 && c.progress < 100).length,
    totalProgress: courses.length > 0 ? Math.round(courses.reduce((acc, c) => acc + c.progress, 0) / courses.length) : 0
  };

  if (loading) {
    return (
      <StudentLayout><div className="flex-1 overflow-y-auto scrollable-content p-3 sm:p-4 md:p-6">
        <div className="min-min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-text/60">{t('loading_courses')}</p>
          </div>
        </div>
      </div></StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="min-h-screen bg-[#fffdf4] p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header & Horizontal Overview Strip */}
          <div className="bg-white border border-[#e6e8f1] rounded-none p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="shrink-0">
                <span className="text-[11px] font-extrabold tracking-wider text-[#7a809c] uppercase mb-1 block">ACADEMIC PORTAL</span>
                <h1 className="text-2xl sm:text-3xl font-['DM_Serif_Display',serif] text-[#141a33] tracking-tight mb-1 whitespace-nowrap">
                  {t('my_courses')}
                </h1>
                <p className="text-xs sm:text-sm text-[#7a809c] font-medium">
                  {stats.totalCourses > 0
                    ? t('courses_enrolled').replace('{count}', stats.totalCourses).replace('{plural}', stats.totalCourses > 1 ? 's' : '')
                    : t('no_courses_yet')}
                </p>
              </div>

              {/* Horizontal Overview Strip Matching Dashboard Palette */}
              <div data-tour="courses-overview" className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Courses */}
                <div className="bg-[#fcfaff] border border-[#e6e8f1] p-3.5 rounded-none flex items-center gap-3 shadow-xs hover:shadow-md transition-shadow group">
                  <div className="w-10 h-10 rounded-none bg-[#efebff] text-[#5b3fd9] flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-extrabold text-[#141a33] leading-none truncate">{stats.totalCourses}</div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#7a809c] mt-1 truncate">{t('total')}</div>
                  </div>
                </div>

                {/* In Progress */}
                <div className="bg-[#fffdfa] border border-[#e6e8f1] p-3.5 rounded-none flex items-center gap-3 shadow-xs hover:shadow-md transition-shadow group">
                  <div className="w-10 h-10 rounded-none bg-[#fff1e6] text-[#f07b1d] flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-extrabold text-[#141a33] leading-none truncate">{stats.inProgressCourses}</div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#7a809c] mt-1 truncate">{t('in_progress')}</div>
                  </div>
                </div>

                {/* Completed */}
                <div className="bg-[#f8fdfa] border border-[#e6e8f1] p-3.5 rounded-none flex items-center gap-3 shadow-xs hover:shadow-md transition-shadow group">
                  <div className="w-10 h-10 rounded-none bg-[#e8f7ee] text-[#16a34a] flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-extrabold text-[#141a33] leading-none truncate">{stats.completedCourses}</div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#7a809c] mt-1 truncate">{t('completed')}</div>
                  </div>
                </div>

                {/* Avg Progress */}
                <div className="bg-[#f8faff] border border-[#e6e8f1] p-3.5 rounded-none flex items-center gap-3 shadow-xs hover:shadow-md transition-shadow group">
                  <div className="w-10 h-10 rounded-none bg-[#e8efff] text-[#2563eb] flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-extrabold text-[#141a33] leading-none truncate">{stats.totalProgress}%</div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#7a809c] mt-1 truncate">{t('avg_progress')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div data-tour="courses-search" className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search my courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-12 pl-4 pr-11 bg-white border border-[#d0cbef] rounded-none text-sm text-[#141a33] outline-none placeholder-[#7a809c] focus:border-[#5b3fd9] focus:ring-1 focus:ring-[#5b3fd9]/30 transition-all shadow-xs"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#7a809c]">
                  <Search className="w-4 h-4 text-[#5b3fd9]" />
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 bg-white p-1.5 border border-[#e6e8f1] rounded-none items-center shadow-xs">
              <button
                onClick={() => setFilterStatus('all')}
                className={`h-full px-4 py-2 rounded-none font-semibold text-xs uppercase tracking-wider transition-all ${
                  filterStatus === 'all'
                    ? 'bg-[#5b3fd9] text-white shadow-xs'
                    : 'text-[#7a809c] hover:bg-[#fbfaff] hover:text-[#141a33]'
                }`}
              >
                {t('all')}
              </button>
              <button
                onClick={() => setFilterStatus('in-progress')}
                className={`h-full px-4 py-2 rounded-none font-semibold text-xs uppercase tracking-wider transition-all ${
                  filterStatus === 'in-progress'
                    ? 'bg-[#5b3fd9] text-white shadow-xs'
                    : 'text-[#7a809c] hover:bg-[#fbfaff] hover:text-[#141a33]'
                }`}
              >
                In Progress
              </button>
              <button
                onClick={() => setFilterStatus('completed')}
                className={`h-full px-4 py-2 rounded-none font-semibold text-xs uppercase tracking-wider transition-all ${
                  filterStatus === 'completed'
                    ? 'bg-[#5b3fd9] text-white shadow-xs'
                    : 'text-[#7a809c] hover:bg-[#fbfaff] hover:text-[#141a33]'
                }`}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Courses Grid */}
          {filteredCourses.length === 0 ? (
            <div className="bg-white rounded-none border border-[#e6e8f1] p-12 text-center shadow-sm">
              <div className="w-16 h-16 mx-auto bg-[#efebff] text-[#5b3fd9] rounded-none flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-[#141a33] mb-2 font-['DM_Serif_Display',serif]">
                {courses.length === 0 ? t('no_courses_assigned') : t('no_matching_courses')}
              </h3>
              <p className="text-[#7a809c] mb-6 max-w-sm mx-auto text-xs sm:text-sm">
                {courses.length === 0
                  ? t('mentor_will_assign')
                  : t('try_different_search')}
              </p>
              {courses.length === 0 && (
                <Link
                  to="/student/dashboard"
                  className="inline-flex items-center gap-2 h-10 px-5 bg-[#0f1731] hover:bg-[#1c2850] text-white font-semibold text-xs uppercase tracking-wider rounded-none transition-all shadow-sm"
                >
                  {t('back_to_dashboard')}
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCourses.map((course, index) => (
                <div 
                  key={course._id} 
                  data-tour={index === 0 ? 'courses-page-first-card' : undefined} 
                  className="group border border-[#e6e8f1] rounded-none overflow-hidden bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Course Banner Artwork */}
                    <div 
                      className="h-32 sm:h-36 w-full relative bg-cover bg-center p-3.5 flex flex-col justify-between rounded-none"
                      style={{
                        backgroundImage: course.photo 
                          ? `url(${API}${course.photo})` 
                          : (course.title && (course.title.toLowerCase().includes('math') || course.title.toLowerCase().includes('algebra') || course.title.toLowerCase().includes('geometry') || course.title.toLowerCase().includes('stat') || course.title.toLowerCase().includes('calc')))
                            ? `url(${['/banners/math_blueprint.png', '/banners/math_geometry.png', '/banners/math_stats.png'][index % 3]})`
                            : (course.title && (course.title.toLowerCase().includes('scienc') || course.title.toLowerCase().includes('physic') || course.title.toLowerCase().includes('chemist') || course.title.toLowerCase().includes('biolog') || course.title.toLowerCase().includes('experiment') || course.title.toLowerCase().includes('lab')))
                              ? `url(${['/banners/science_general.png', '/banners/science_physics.png', '/banners/science_chemistry.png'][index % 3]})`
                              : 'linear-gradient(135deg, #5b3fd9 0%, #2563eb 100%)'
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-transparent"></div>
                      <div className="relative z-10 flex items-start justify-between">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-none uppercase tracking-wider backdrop-blur-md ${
                          course.progress === 100 
                            ? 'bg-emerald-500/90 text-white' 
                            : 'bg-[#5b3fd9]/90 text-white'
                        }`}>
                          {course.progress === 100 ? "Completed" : "In Progress"}
                        </span>
                        <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-none bg-black/60 text-white backdrop-blur-md">
                          {course.progress}%
                        </span>
                      </div>
                    </div>

                    {/* Course Content */}
                    <div className="p-4 sm:p-5">
                      <h3 className="font-bold text-base text-[#141a33] line-clamp-1 group-hover:text-[#5b3fd9] transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-xs text-[#7a809c] line-clamp-2 mt-1 mb-3">
                        {course.description || t('continue_learning')}
                      </p>

                      {course.mentor && (
                        <div className="flex items-center gap-1.5 text-xs text-[#7a809c] mb-3">
                          <Users className="w-3.5 h-3.5 text-[#5b3fd9]" />
                          <span className="truncate">Mentor: <strong className="text-[#141a33]">{course.mentor.name || 'Assigned Instructor'}</strong></span>
                        </div>
                      )}

                      {/* Progress Stats & Bar */}
                      <div className="space-y-2 mt-2">
                        <div className="flex justify-between text-[11px] font-semibold text-[#3a4160]">
                          <span>Progress</span>
                          <span>{course.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#eceef5] rounded-none overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#5b3fd9] to-[#2563eb] rounded-none transition-all duration-500" 
                            style={{ width: `${course.progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#7a809c] pt-1">
                          <span>{course.completedChapters}/{course.totalChapters || 0} chapters</span>
                          <span>{course.assessmentCount || 0} assessments</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 border-t border-[#f0f2f8] flex items-center justify-between">
                    <Link
                      to={`/student/course/${course._id}`}
                      data-tour={index === 0 ? 'courses-first-continue' : undefined}
                      className="inline-flex items-center gap-2 h-9 px-4 rounded-none bg-[#0f1731] hover:bg-[#1c2850] text-white font-semibold text-xs uppercase tracking-wider transition-all shadow-xs group-hover:shadow-md"
                    >
                      {course.progress === 100 ? (
                        <>
                          <Award className="w-3.5 h-3.5 text-amber-400" />
                          <span>{t('view_certificate')}</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>{t('continue')}</span>
                        </>
                      )}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <span className="text-[11px] text-[#7a809c] font-medium">Self-Paced</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stats Summary Section */}
          <div data-tour="course-learning-summary" className="bg-white rounded-none border border-[#e6e8f1] p-6 shadow-sm">
            <h3 className="font-bold text-base text-[#141a33] mb-4">{t('learning_summary')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-[#fbfaff] border border-[#e6e8f1] rounded-none">
                <div className="text-2xl font-extrabold text-[#141a33]">{stats.totalCourses}</div>
                <p className="text-xs font-semibold text-[#7a809c] uppercase tracking-wider mt-1">{t('total_courses')}</p>
              </div>
              <div className="text-center p-4 bg-[#f8fdfa] border border-[#e6e8f1] rounded-none">
                <div className="text-2xl font-extrabold text-[#16a34a]">{stats.completedCourses}</div>
                <p className="text-xs font-semibold text-[#7a809c] uppercase tracking-wider mt-1">Completed</p>
              </div>
              <div className="text-center p-4 bg-[#fffdfa] border border-[#e6e8f1] rounded-none">
                <div className="text-2xl font-extrabold text-[#f07b1d]">{stats.inProgressCourses}</div>
                <p className="text-xs font-semibold text-[#7a809c] uppercase tracking-wider mt-1">In Progress</p>
              </div>
              <div className="text-center p-4 bg-[#f8faff] border border-[#e6e8f1] rounded-none">
                <div className="text-2xl font-extrabold text-[#2563eb]">{stats.totalProgress}%</div>
                <p className="text-xs font-semibold text-[#7a809c] uppercase tracking-wider mt-1">Avg Progress</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
};

export default Courses;