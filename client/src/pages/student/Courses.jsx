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
      <div className="min-min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <h1 className="text-2xl font-bold text-text mb-2">{t('my_courses')}</h1>
                <p className="text-text/60">
                  {stats.totalCourses > 0
                    ? t('courses_enrolled').replace('{count}', stats.totalCourses).replace('{plural}', stats.totalCourses > 1 ? 's' : '')
                    : t('no_courses_yet')}
                </p>
              </div>

              {/* Stats */}
              <div data-tour="courses-overview" className="bg-white rounded-lg border p-5 min-w-[280px]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-text">{t('overview')}</h3>
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-text">{stats.totalCourses}</div>
                    <div className="text-sm text-text/60">{t('total')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-success">{stats.completedCourses}</div>
                    <div className="text-sm text-text/60">{t('completed')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">{stats.inProgressCourses}</div>
                    <div className="text-sm text-text/60">{t('in_progress')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-text">{stats.totalProgress}%</div>
                    <div className="text-sm text-text/60">{t('avg_progress')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div data-tour="courses-search" className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text/40 w-4 h-4" />
                <input
                  type="text"
                  placeholder={t('search_courses')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-4 py-2.5 rounded-lg font-medium text-sm ${
                    filterStatus === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-white border text-text/80 hover:bg-background'
                  }`}
                >
                  {t('all')}
                </button>
                <button
                  onClick={() => setFilterStatus('in-progress')}
                  className={`px-4 py-2.5 rounded-lg font-medium text-sm ${
                    filterStatus === 'in-progress'
                      ? 'bg-primary text-white'
                      : 'bg-white border text-text/80 hover:bg-background'
                  }`}
                >
                  In Progress
                </button>
                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`px-4 py-2.5 rounded-lg font-medium text-sm ${
                    filterStatus === 'completed'
                      ? 'bg-primary text-white'
                      : 'bg-white border text-text/80 hover:bg-background'
                  }`}
                >
                  Completed
                </button>
              </div>
            </div>
          </div>

          {/* Courses Grid */}
          {filteredCourses.length === 0 ? (
            <div className="bg-white rounded-lg border p-8 text-center">
              <div className="w-16 h-16 mx-auto bg-background rounded-full flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-text/40" />
              </div>
              <h3 className="text-lg font-medium text-text mb-2">
                {courses.length === 0 ? t('no_courses_assigned') : t('no_matching_courses')}
              </h3>
              <p className="text-text/60 mb-6 max-w-sm mx-auto text-sm">
                {courses.length === 0
                  ? t('mentor_will_assign')
                  : t('try_different_search')}
              </p>
              {courses.length === 0 && (
                <Link
                  to="/student/dashboard"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 text-sm"
                >
                  {t('back_to_dashboard')}
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCourses.map((course, index) => (
                <div key={course._id} data-tour={index === 0 ? 'courses-page-first-card' : undefined} className="bg-white rounded-lg border overflow-hidden hover:border-primary/50">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-primary" />
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        course.progress === 100 ? 'bg-success/10 text-success' : 
                        course.progress >= 50 ? 'bg-primary/10 text-primary' : 
                        'bg-warning/10 text-warning'
                      }`}>
                        {course.progress}%
                      </span>
                    </div>

                    <h3 className="font-semibold text-text mb-2 line-clamp-2">
                      {course.title}
                    </h3>
                    <p className="text-text/60 text-sm mb-4 line-clamp-2">
                      {course.description || t('continue_learning')}
                    </p>

                    {course.mentor && (
                      <div className="flex items-center gap-2 text-sm text-text/60 mb-4">
                        <Users className="w-3 h-3" />
                        <span>Mentor: {course.mentor.name || 'Unknown'}</span>
                      </div>
                    )}

                    <div className="space-y-3 mb-5">
                      <div>
                        <div className="flex justify-between text-sm text-text/60 mb-1">
                          <span>{t('progress')}</span>
                          <span>{course.progress}%</span>
                        </div>
                        <ProgressBar progress={course.progress} />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text/60">
                          {course.completedChapters}/{course.totalChapters} {t('chapters')}
                        </span>
                        <span className="text-text/60">
                          {course.assessmentCount || 0} {t('assessments')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-background">
                      <Link
                        to={`/student/course/${course._id}`}
                        data-tour={index === 0 ? 'courses-first-continue' : undefined}
                        className="flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm"
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
                      <ChevronRight className="w-4 h-4 text-text/40" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stats Summary */}
          <div className="mt-8">
            <div data-tour="course-learning-summary" className="bg-white rounded-lg border p-5">
              <h3 className="font-medium text-text mb-4">{t('learning_summary')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-background rounded-lg">
                  <div className="text-2xl font-bold text-text">{stats.totalCourses}</div>
                  <p className="text-sm text-text/60 mt-1">{t('total_courses')}</p>
                </div>
                <div className="text-center p-4 bg-success/5 rounded-lg">
                  <div className="text-2xl font-bold text-success">{stats.completedCourses}</div>
                  <p className="text-sm text-text/60 mt-1">Completed</p>
                </div>
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{stats.inProgressCourses}</div>
                  <p className="text-sm text-text/60 mt-1">In Progress</p>
                </div>
                <div className="text-center p-4 bg-warning/5 rounded-lg">
                  <div className="text-2xl font-bold text-warning">{stats.totalProgress}%</div>
                  <p className="text-sm text-text/60 mt-1">Avg Progress</p>
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