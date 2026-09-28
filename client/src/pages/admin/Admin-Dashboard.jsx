import AnnouncementBell from "../../components/AnnouncementBell";
import CreateAnnouncementModal from "../announcements/CreateAnnouncementModal";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/auth";
import { useSimpleTranslation } from "../../context/SimpleTranslationContext";
import { useTranslation } from "../../context/TranslationContext";
import AdminLayout from "../../components/AdminLayout";
import { toast } from "react-toastify";
import {
  Users,
  UserCheck,
  BarChart3,
  UserPlus,
  BookOpen,
  Award,
  Clock,
  RefreshCw,
} from "lucide-react";

const AdminDashboard = () => {
  const { token, API } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    students: 0,
    mentors: 0,
    courses: 0,
    certificates: 0,
    newUsers: 0,
    pendingMentors: 0,
    publishedCourses: 0,
  });

  const [loading, setLoading] = useState(true);
  const [openAnnouncementModal, setOpenAnnouncementModal] = useState(false);

  useEffect(() => {
    getDashboardData();
  }, []);

  const getDashboardData = async () => {
    try {
      setLoading(true);
      // If there's no auth token, avoid calling protected API and prompt login
      if (!token) {
        setLoading(false);
        toast.info('Please sign in to view the admin dashboard');
        navigate('/login');
        return;
      }
      const res = await fetch(`${API}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Handle unauthorized responses explicitly so we can guide the user
      if (res.status === 401 || res.status === 403) {
        toast.error('Not authorized — please sign in as an admin');
        setLoading(false);
        navigate('/login');
        return;
      }

      if (!res.ok) throw new Error();

      const data = await res.json();
      setStats({
        students: data?.userStats?.find(u => u.role === 'student')?.count || 0,
        mentors: data?.userStats?.find(u => u.role === 'mentor')?.count || 0,
        courses: data?.totalCourses || 0,
        certificates: 0,
        newUsers: data?.recentUsers?.length || 0,
        pendingMentors: data?.userStats?.find(u => u.role === 'mentor' && u.isApproved === 0)?.count || 0,
        publishedCourses: data?.totalCourses || 0,
      });
    } catch {
      toast.error(t('could_not_load_dashboard_data'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6 flex justify-center items-center h-96">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6">
        <div className="max-w-7xl mx-auto">

          {/* ================= HEADER ================= */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-text">
                {t('admin_dashboard_title')}
              </h1>
              <p className="text-gray-600 mt-1">
                {t('welcome_control_panel')}
              </p>
            </div>

            {/* ✅ RIGHT CONTROLS */}
            <div className="flex items-center gap-4">
              <AnnouncementBell />

              {/* Create Course button removed */}

              {/* ➕ CREATE ANNOUNCEMENT */}
              <button
                data-tour="admin-announcement-btn"
                onClick={() => setOpenAnnouncementModal(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
              >
                {t('announcement_button')}
              </button>

              <button
                onClick={getDashboardData}
                className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
              >
                <RefreshCw size={18} />
                <span>{t('refresh')}</span>
              </button>
            </div>
          </div>

          {/* ================= STATS ================= */}
          <div data-tour="admin-overview-stats" className="dashboard-grid mb-6 sm:mb-8">
            <StatCard title={t('total_students')} value={stats.students} icon={<Users />} link="/admin/users" />
            <StatCard title={t('total_mentors')} value={stats.mentors} icon={<UserCheck />} link="/admin/mentors" />
            <StatCard title={t('total_courses')} value={stats.courses} icon={<BookOpen />} />
            <StatCard title={t('certificates')} value={stats.certificates} icon={<Award />} />
          </div>

          {/* ================= QUICK ACTIONS ================= */}
          <div className="mb-6 sm:mb-8">
            <h2 className="responsive-text-lg font-bold mb-3 sm:mb-4">{t('quick_actions')}</h2>
            <div className="responsive-grid">
              <QuickLink to="/admin/users" icon={<Users />} title={t('manage_users')} />
            </div>
          </div>

          {/* ================= RECENT ACTIVITY ================= */}
          <div data-tour="admin-recent-activity" className="responsive-card">
            <div className="responsive-card-content">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="responsive-text-lg font-bold">{t('recent_activity')}</h2>
                <Clock size={20} className="text-gray-400" />
              </div>

              <div className="responsive-grid">
                <Activity label={t('new_users')} value={stats.newUsers} icon={<UserPlus />} />
                <Activity label={t('pending_mentors')} value={stats.pendingMentors} icon={<UserCheck />} />
                <Activity label={t('published_courses')} value={stats.publishedCourses} icon={<BookOpen />} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 📢 CREATE ANNOUNCEMENT MODAL */}
      <CreateAnnouncementModal
        open={openAnnouncementModal}
        onClose={() => setOpenAnnouncementModal(false)}
        onSuccess={() => setOpenAnnouncementModal(false)}
      />
    </AdminLayout>
  );
};

/* ================= HELPERS ================= */

const StatCard = ({ title, value, icon, link }) => (
  <div className="responsive-card hover:shadow-md transition-shadow">
    <div className="responsive-card-content">
      <div className="flex justify-between mb-3 sm:mb-4">
        <div className="p-2 sm:p-3 bg-blue-100 rounded-lg text-blue-600">{icon}</div>
        {link && <Link to={link} className="text-blue-600 responsive-text-sm hover:underline">View</Link>}
      </div>
      <p className="responsive-text-sm text-gray-600 font-medium">{title}</p>
      <p className="responsive-text-xl sm:text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const QuickLink = ({ to, icon, title }) => (
  <Link to={to} className="responsive-card bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-lg hover:scale-105 transition-all">
    <div className="responsive-card-content">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="p-2 sm:p-3 bg-white/20 rounded-lg backdrop-blur-sm">{icon}</div>
        <h3 className="font-semibold responsive-text-base sm:text-lg">{title}</h3>
      </div>
    </div>
  </Link>
);

const Activity = ({ label, value, icon }) => (
  <div>
    <div className="flex justify-center gap-2 mb-2">
      {icon}
      <span>{label}</span>
    </div>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

export default AdminDashboard;
