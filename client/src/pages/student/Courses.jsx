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
      <div className="flex-1 overflow-y-auto bg-[#f4f5fa] text-[#141a33] font-['Plus_Jakarta_Sans',sans-serif] min-h-screen pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          
          {/* Header */}
          <div className="mb-6 pb-6 border-b border-[#e6e8f1]">
            <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
              <div className="shrink-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#141a33] tracking-tight mb-1 whitespace-nowrap">{t('my_courses')}</h1>
                <p className="text-xs sm:text-sm text-[#7a809c] font-medium">
                  {stats.totalCourses > 0
                    ? t('courses_enrolled').replace('{count}', stats.totalCourses).replace('{plural}', stats.totalCourses > 1 ? 's' : '')
                    : t('no_courses_yet')}
                </p>
              </div>

              {/* Horizontal Overview Strip Matching Dashboard Style */}
              <div data-tour="courses-overview" className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Courses */}
                <div className="bg-white border border-[#e6e8f1] px-4 py-3.5 rounded-xl flex items-center gap-3.5 shadow-sm hover:shadow-md hover:border-[#d0cbef] transition-all w-full">
                  <div className="w-10 h-10 rounded-lg bg-[#efebff] text-[#5b3fd9] flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-extrabold text-[#141a33] leading-none truncate">{stats.totalCourses}</div>
                    <div className="text-xs text-[#7a809c] font-medium mt-1 truncate">{t('total')}</div>
                  </div>
                </div>

                {/* In Progress */}
                <div className="bg-white border border-[#e6e8f1] px-4 py-3.5 rounded-xl flex items-center gap-3.5 shadow-sm hover:shadow-md hover:border-[#d0cbef] transition-all w-full">
                  <div className="w-10 h-10 rounded-lg bg-[#fff1e6] text-[#f07b1d] flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-extrabold text-[#141a33] leading-none truncate">{stats.inProgressCourses}</div>
                    <div className="text-xs text-[#7a809c] font-medium mt-1 truncate">{t('in_progress')}</div>
                  </div>
                </div>

                {/* Completed */}
                <div className="bg-white border border-[#e6e8f1] px-4 py-3.5 rounded-xl flex items-center gap-3.5 shadow-sm hover:shadow-md hover:border-[#d0cbef] transition-all w-full">
                  <div className="w-10 h-10 rounded-lg bg-[#e8f7ee] text-[#16a34a] flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-extrabold text-[#141a33] leading-none truncate">{stats.completedCourses}</div>
                    <div className="text-xs text-[#7a809c] font-medium mt-1 truncate">{t('completed')}</div>
                  </div>
                </div>

                {/* Avg Progress */}
                <div className="bg-white border border-[#e6e8f1] px-4 py-3.5 rounded-xl flex items-center gap-3.5 shadow-sm hover:shadow-md hover:border-[#d0cbef] transition-all w-full">
                  <div className="w-10 h-10 rounded-lg bg-[#e8efff] text-[#2563eb] flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-extrabold text-[#141a33] leading-none truncate">{stats.totalProgress}%</div>
                    <div className="text-xs text-[#7a809c] font-medium mt-1 truncate">{t('avg_progress')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div data-tour="courses-search" className="mb-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch">
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  placeholder="Search my courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 h-11 px-4 bg-white border border-[#d0cbef] rounded-lg text-sm text-[#141a33] outline-none placeholder-[#7a809c] focus:border-[#5b3fd9] focus:ring-1 focus:ring-[#5b3fd9]/30 transition-all shadow-sm"
                />
                <button
                  type="button"
                  className="h-11 w-11 shrink-0 bg-[#d8ceff] hover:bg-[#c9bbff] text-[#5b3fd9] rounded-xl flex items-center justify-center transition-colors shadow-sm"
                >
                  <Search className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
              <div className="flex gap-1.5 bg-white p-1 border border-[#e6e8f1] rounded-xl items-center shadow-sm">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-4 py-2 rounded-lg font-semibold text-xs transition-all ${
                    filterStatus === 'all'
                      ? 'bg-[#5b3fd9] text-white shadow-sm'
                      : 'text-[#7a809c] hover:bg-[#f4f5fa] hover:text-[#141a33]'
                  }`}
                >
                  {t('all')}
                </button>
                <button
                  onClick={() => setFilterStatus('in-progress')}
                  className={`px-4 py-2 rounded-lg font-semibold text-xs transition-all ${
                    filterStatus === 'in-progress'
                      ? 'bg-[#5b3fd9] text-white shadow-sm'
                      : 'text-[#7a809c] hover:bg-[#f4f5fa] hover:text-[#141a33]'
                  }`}
                >
                  In Progress
                </button>
                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`px-4 py-2 rounded-lg font-semibold text-xs transition-all ${
                    filterStatus === 'completed'
                      ? 'bg-[#5b3fd9] text-white shadow-sm'
                      : 'text-[#7a809c] hover:bg-[#f4f5fa] hover:text-[#141a33]'
                  }`}
                >
                  Completed
                </button>
              </div>
            </div>
          </div>

          {/* Courses Grid */}
          {filteredCourses.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#e6e8f1] p-8 text-center shadow-sm">
              <div className="w-16 h-16 mx-auto bg-[#efebff] text-[#5b3fd9] rounded-xl flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#141a33] mb-2">
                {courses.length === 0 ? t('no_courses_assigned') : t('no_matching_courses')}
              </h3>
              <p className="text-[#7a809c] mb-6 max-w-sm mx-auto text-sm">
                {courses.length === 0
                  ? t('mentor_will_assign')
                  : t('try_different_search')}
              </p>
              {courses.length === 0 && (
                <Link
                  to="/student/dashboard"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5b3fd9] hover:bg-[#452ab8] text-white font-semibold rounded-lg text-sm transition-colors shadow-sm"
                >
                  {t('back_to_dashboard')}
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCourses.map((course, index) => (
                <div key={course._id} data-tour={index === 0 ? 'courses-page-first-card' : undefined} className="bg-white rounded-xl border border-[#e6e8f1] overflow-hidden hover:shadow-md hover:border-[#d0cbef] transition-all">
                  <div 
                    className="h-28 w-full relative bg-cover bg-center p-4 flex flex-col justify-between"
                    style={{
                      backgroundImage: course.photo 
                        ? `url(${API}${course.photo})` 
                        : (course.title && (course.title.toLowerCase().includes('math') || course.title.toLowerCase().includes('algebra') || course.title.toLowerCase().includes('geometry') || course.title.toLowerCase().includes('stat') || course.title.toLowerCase().includes('calc')))
                          ? `url(${['/banners/math_blueprint.png', '/banners/math_geometry.png', '/banners/math_stats.png'][index % 3]})`
                          : (course.title && (course.title.toLowerCase().includes('scienc') || course.title.toLowerCase().includes('physic') || course.title.toLowerCase().includes('chemist') || course.title.toLowerCase().includes('biolog') || course.title.toLowerCase().includes('experiment') || course.title.toLowerCase().includes('lab')))
                            ? `url(${['/banners/science_general.png', '/banners/science_physics.png', '/banners/science_chemistry.png'][index % 3]})`
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-900/20 to-transparent"></div>
                    <div className="relative z-10 flex items-start justify-between">
                      <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center text-white">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold backdrop-blur-md ${
                        course.progress === 100 ? 'bg-emerald-500/90 text-white' : 
                        course.progress >= 50 ? 'bg-blue-500/90 text-white' : 
                        'bg-amber-500/90 text-white'
                      }`}>
                        {course.progress}%
                      </span>
                    </div>
                  </div>
                  <div className="p-5">

                    <h3 className="font-bold text-[#141a33] mb-2 line-clamp-2">
                      {course.title}
                    </h3>
                    <p className="text-[#7a809c] text-sm mb-4 line-clamp-2">
                      {course.description || t('continue_learning')}
                    </p>

                    {course.mentor && (
                      <div className="flex items-center gap-2 text-sm text-[#7a809c] mb-4">
                        <Users className="w-3.5 h-3.5 text-[#5b3fd9]" />
                        <span>Mentor: <strong className="text-[#141a33]">{course.mentor.name || 'Unknown'}</strong></span>
                      </div>
                    )}

                    <div className="space-y-3 mb-5">
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-[#7a809c] mb-1">
                          <span>{t('progress')}</span>
                          <span className="text-[#5b3fd9]">{course.progress}%</span>
                        </div>
                        <ProgressBar progress={course.progress} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#7a809c] pt-1">
                        <span>
                          {course.completedChapters}/{course.totalChapters} {t('chapters')}
                        </span>
                        <span>
                          {course.assessmentCount || 0} {t('assessments')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[#f0f2f8]">
                      <Link
                        to={`/student/course/${course._id}`}
                        data-tour={index === 0 ? 'courses-first-continue' : undefined}
                        className="flex items-center gap-2 text-[#5b3fd9] hover:text-[#452ab8] font-semibold text-sm transition-colors"
                      >
                        {course.progress === 100 ? (
                          <>
                            <Award className="w-4 h-4" />
                            {t('view_certificate')}
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-4 h-4" />
                            {t('continue')}
                          </>
                        )}
                      </Link>
                      <ChevronRight className="w-4 h-4 text-[#7a809c]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stats Summary */}
          <div className="mt-8">
            <div data-tour="course-learning-summary" className="bg-white rounded-xl border border-[#e6e8f1] p-5 shadow-sm">
              <h3 className="font-bold text-[#141a33] mb-4">{t('learning_summary')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-[#f4f5fa] rounded-xl border border-[#e6e8f1]">
                  <div className="text-2xl font-extrabold text-[#141a33]">{stats.totalCourses}</div>
                  <p className="text-xs text-[#7a809c] font-medium mt-1">{t('total_courses')}</p>
                </div>
                <div className="text-center p-4 bg-[#e8f7ee] rounded-xl border border-[#c3eed4]">
                  <div className="text-2xl font-extrabold text-[#16a34a]">{stats.completedCourses}</div>
                  <p className="text-xs text-[#16a34a] font-medium mt-1">Completed</p>
                </div>
                <div className="text-center p-4 bg-[#efebff] rounded-xl border border-[#d0cbef]">
                  <div className="text-2xl font-extrabold text-[#5b3fd9]">{stats.inProgressCourses}</div>
                  <p className="text-xs text-[#5b3fd9] font-medium mt-1">{t('in_progress')}</p>
                </div>
                <div className="text-center p-4 bg-[#e8efff] rounded-xl border border-[#c5d9ff]">
                  <div className="text-2xl font-extrabold text-[#2563eb]">{stats.totalProgress}%</div>
                  <p className="text-xs text-[#2563eb] font-medium mt-1">{t('avg_progress')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
};

export default Courses;