import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/auth';
import AdminLayout from '../../components/AdminLayout';
import { useTranslation } from '../../context/TranslationContext';
import { toast } from 'react-toastify';
import { 
  Users, 
  UserCheck, 
  BookOpen, 
  Award,
  TrendingUp,
  BarChart3,
  RefreshCw
} from 'lucide-react';

const Analytics = () => {
  const { token, API } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    students: 0,
    mentors: 0,
    approvedMentors: 0,
    totalCourses: 0,
    publishedCourses: 0,
    totalCertificates: 0,
    newUsers: 0,
    newCourses: 0,
    newCertificates: 0,
    completionRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics();
  }, []);

  const getAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/users/analytics`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(t('could_not_load_analytics'));
      }

      const data = await response.json();
      setStats({
        totalUsers: data?.users?.total || 0,
        activeUsers: data?.users?.active || 0,
        students: data?.users?.students || 0,
        mentors: data?.users?.mentors || 0,
        approvedMentors: data?.users?.approvedMentors || 0,
        totalCourses: data?.courses?.total || 0,
        publishedCourses: data?.courses?.published || 0,
        totalCertificates: data?.certificates?.total || 0,
        newUsers: data?.users?.newUsers || 0,
        newCourses: data?.courses?.newCourses || 0,
        newCertificates: data?.certificates?.newCertificates || 0,
        completionRate: data?.courses?.completionRate || 0
      });

    } catch (error) {
      toast.error(t('could_not_load_analytics'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'total_users_label',
      value: stats.totalUsers,
      change: `${stats.newUsers} ${t('this_month_suffix')}`,
      icon: <Users size={24} />,
      color: 'primary',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'active_users_label',
      value: stats.activeUsers,
      change: `${stats.students} ${t('students')}`,
      icon: <UserCheck size={24} />,
      color: 'success',
      bgColor: 'bg-green-50'
    },
    {
      title: 'total_courses_label',
      value: stats.totalCourses,
      change: `${stats.publishedCourses} ${t('published')}`,
      icon: <BookOpen size={24} />,
      color: 'secondary',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'certificates_label',
      value: stats.totalCertificates,
      change: `${stats.newCertificates} ${t('this_month_suffix')}`,
      icon: <Award size={24} />,
      color: 'warning',
      bgColor: 'bg-yellow-50'
    }
  ];

  const userStats = [
    { label: 'students', value: stats.students },
    { label: 'mentors', value: stats.mentors },
    { label: 'approved_mentors', value: stats.approvedMentors }
  ];

  const recentActivity = [
    { label: 'new_users_label', value: stats.newUsers, color: 'text-primary' },
    { label: 'new_courses_label', value: stats.newCourses, color: 'text-secondary' },
    { label: 'new_certificates_label', value: stats.newCertificates, color: 'text-warning' }
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-text">{t('loading_analytics')}</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-text">{t('analytics_dashboard_title')}</h1>
                <p className="text-gray-600 mt-1">{t('system_performance_overview')}</p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((card, index) => (
              <div key={index} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${card.bgColor}`}>
                    <div className={`text-${card.color}`}>
                      {card.icon}
                    </div>
                  </div>
                  <TrendingUp className="text-gray-400" size={18} />
                </div>
                <h3 className="text-gray-600 text-sm mb-1">{t(card.title)}</h3>
                <p className="text-2xl font-bold text-text">{card.value}</p>
                <p className="text-sm text-gray-500 mt-1">{card.change}</p>
              </div>
            ))}
          </div>

          {/* User Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-text">{t('user_breakdown')}</h2>
                <Users className="text-gray-400" size={20} />
              </div>
              <div className="space-y-4">
                {userStats.map((stat, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-gray-600">{t(stat.label)}</span>
                    <span className="font-semibold text-text">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-text">{t('course_completion')}</h2>
                <BarChart3 className="text-gray-400" size={20} />
              </div>
              <div className="text-center py-6">
                <div className="text-4xl font-bold text-primary mb-2">{stats.completionRate}%</div>
                <p className="text-gray-600">Overall completion rate</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text">{t('recent_activity_30_days')}</h2>
              <TrendingUp className="text-gray-400" size={20} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {recentActivity.map((item, index) => (
                <div key={index} className="text-center">
                  <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-gray-600">{t(item.label)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-bold text-text mb-4">{t('course_statistics')}</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Courses</span>
                  <span className="font-semibold text-text">{stats.totalCourses}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Published Courses</span>
                  <span className="font-semibold text-text">{stats.publishedCourses}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">New Courses (30 days)</span>
                  <span className="font-semibold text-text">{stats.newCourses}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-bold text-text mb-4">{t('certificate_statistics')}</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Certificates</span>
                  <span className="font-semibold text-text">{stats.totalCertificates}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">New Certificates (30 days)</span>
                  <span className="font-semibold text-text">{stats.newCertificates}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Issuance Rate</span>
                  <span className="font-semibold text-text">
                    {stats.totalUsers > 0 ? Math.round((stats.totalCertificates / stats.totalUsers) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-text mb-4">{t('system_summary')}</h3>
            <div className="text-gray-600 space-y-2">
              <p>• {t('total_users_colon')} <span className="font-semibold text-text">{stats.totalUsers}</span></p>
              <p>• {t('active_mentors_colon')} <span className="font-semibold text-text">{stats.approvedMentors}</span></p>
              <p>• {t('course_completion_rate_colon')} <span className="font-semibold text-text">{stats.completionRate}%</span></p>
              <p>• {t('new_activity_this_month')} <span className="font-semibold text-text">
                {stats.newUsers + stats.newCourses + stats.newCertificates} total events
              </span></p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Analytics;