import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Calendar,
  UserPlus,
  School,
  Database
} from "lucide-react";
import { useAuth } from "../auth/auth";
import QuotaLimitModal from './QuotaLimitModal';
import { useSimpleTranslation } from "../context/SimpleTranslationContext";
import { useTranslation } from "../context/TranslationContext";
import AnnouncementBell from "./AnnouncementBell";
import LoginFooter from './LoginFooter';
import GuideBotLauncher from '../guidebot/runtime/GuideBotLauncher';
import whiteLogo from '../../../core5 logo new new-modified (1).png';

const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logoutUser } = useAuth();
  const { currentLanguage, supportedLanguages, changeLanguage } = useSimpleTranslation();
  const { t } = useTranslation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaDetails, setQuotaDetails] = useState(null);

  const { API, token } = useAuth();

  const handleNavClick = async (e, item) => {
    // Intercept database export & calendar navigation to check feature access
    // DISABLED: Allow all features without restrictions
    // Database export and calendar are now accessible to all users
  };

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  /* ================= SIDEBAR ITEMS ================= */
  const navItems = [
    { path: "/admin/dashboard", nameKey: 'nav_dashboard', icon: <LayoutDashboard size={20} />, tourId: 'nav-dashboard' },
    { path: "/admin/users", nameKey: 'nav_users', icon: <Users size={20} />, tourId: 'nav-users' },
    { path: "/admin/database-export", nameKey: 'nav_database_export', icon: <Database size={20} />, tourId: 'nav-database-export' },
    { path: "/admin/fee-structure", nameKey: 'nav_fee_structure', icon: <BarChart3 size={20} />, tourId: 'nav-fee-structure' },
    { path: "/admin/calendar", nameKey: 'nav_calendar', icon: <Calendar size={20} />, tourId: 'nav-calendar' },

    /* ===== BELOW CALENDAR ===== */
    { path: "/admin/add-student", nameKey: 'nav_add_student', icon: <UserPlus size={20} />, tourId: 'nav-add-student' },
    { path: "/admin/add-teacher", nameKey: 'nav_add_teacher', icon: <UserPlus size={20} />, tourId: 'nav-add-teacher' },

    /* ===== CLASSROOMS (JUST BELOW ADD TEACHER) ===== */
    { path: "/admin/classrooms", nameKey: 'nav_classrooms', icon: <School size={20} />, tourId: 'nav-classrooms' },
  ];

  const currentPage =
    navItems.find((item) => item.path === location.pathname)?.nameKey
      ? t(navItems.find((item) => item.path === location.pathname)?.nameKey)
      : t('nav_dashboard');

  return (
    <div className="h-screen bg-background overflow-hidden">
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside
        className={`fixed top-0 left-0 h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-lg z-40 hidden md:block transition-all duration-300 ${
          sidebarCollapsed ? "w-16 md:w-20" : "w-56 md:w-64"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className="h-24 sm:h-28 border-b border-white/10 flex items-center justify-center">
            {!sidebarCollapsed && (
              <img
                src={whiteLogo}
                alt="Core5 Academy"
                className="max-h-full w-auto object-contain"
              />
            )}
            {sidebarCollapsed && (
              <img
                src={whiteLogo}
                alt="Core5 Academy"
                className="h-16 w-auto object-contain"
              />
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 min-h-0 p-4 space-y-1 overflow-y-auto hide-scrollbar">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={(e) => handleNavClick(e, item)}
                  data-tour={item.tourId}
                  className={`flex items-center rounded-lg px-3 py-3 transition-colors
                    ${isActive ? "bg-white/10 text-white border-l-4 border-blue-500" : "hover:bg-white/5 text-gray-300 hover:text-white"}
                    ${sidebarCollapsed ? "justify-center" : ""}
                  `}
                >
                  {item.icon}
                  {!sidebarCollapsed && <span className="ml-3 font-medium">{t(item.nameKey)}</span>}
                </Link>
              );
            })}
            <QuotaLimitModal isOpen={showQuotaModal} onClose={() => setShowQuotaModal(false)} quotaDetails={quotaDetails} />
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
            >
              {sidebarCollapsed ? <ChevronRight /> : <>{t('nav_collapse')} <ChevronLeft /></>}
            </button>

            <button
              onClick={handleLogout}
              className={`mt-3 w-full flex items-center p-3 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
            >
              <LogOut size={18} />
              {!sidebarCollapsed && <span className="ml-3">{t('nav_logout')}</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className={`transition-all flex-1 overflow-hidden ${sidebarCollapsed ? "md:ml-16 lg:ml-20" : "md:ml-56 lg:ml-64"} h-screen flex flex-col`}>
        {/* Top Bar */}
        <header className="sticky top-0 bg-white border-b z-30 px-3 sm:px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                <ChevronRight size={20} />
              </button>
              <h1 className="text-lg sm:text-xl font-bold truncate">{currentPage}</h1>
            </div>

            {/* Announcement Bell */}
            <AnnouncementBell />
          </div>
        </header>

        {/* Mobile Sidebar */}
        {mobileMenuOpen && (
          <div className="mobile-backdrop" onClick={() => setMobileMenuOpen(false)}>
            <div className="mobile-sidebar open" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <img src={whiteLogo} alt="Core5 Academy" className="h-10 w-auto" />
                  <button onClick={() => setMobileMenuOpen(false)}>
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={(e) => { setMobileMenuOpen(false); handleNavClick(e, item); }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
                >
                  {item.icon}
                  <span>{t(item.nameKey)}</span>
                </Link>
              ))}
              <div className="p-4 border-t mt-auto">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/10 text-red-600 rounded-lg hover:bg-red-500/20"
                >
                  <LogOut size={18} />
                  <span>{t('nav_logout')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto scrollable-content p-3 sm:p-4 md:p-6">{children}</div>
      </main>
      
      {/* GuideBot Launcher — one shared instance for both desktop and mobile */}
      <div className="fixed bottom-6 right-6 z-40">
        <GuideBotLauncher tourId="admin-overview-v1" />
      </div>

      {/* Footer */}
      <LoginFooter />
    </div>
  );
};

export default AdminLayout;
