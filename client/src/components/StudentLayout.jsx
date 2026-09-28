import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  GraduationCap,
  Trophy,
  Clock,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from "../auth/auth";
import QuotaLimitModal from './QuotaLimitModal';
import { useTranslation } from "../context/TranslationContext";
import GuideBotLauncher from '../guidebot/runtime/GuideBotLauncher';
import whiteLogo from '../../../core5 logo new new-modified (1).png';

const StudentLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logoutUser, user } = useAuth();
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaDetails, setQuotaDetails] = useState(null);
  const { API, token } = useAuth();

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  const handleNavClick = async (e, item) => {
    // Allow dashboard to always work
    if (item.path === '/student/dashboard') {
      return;
    }

    // DISABLED: Allow all features without restrictions
    // All features are now accessible to all users
  };

  // Enhanced navigation items with newest icons and features
  const navItems = [
    {
      path: '/student/dashboard',
      nameKey: 'nav_dashboard',
      icon: <Home size={20} />,
      label: 'Dashboard',
      description: 'Overview & Stats',
      tourId: 'nav-dashboard'
    },
    {
      path: '/student/courses',
      nameKey: 'nav_courses',
      icon: <GraduationCap size={20} />,
      label: 'Courses',
      description: 'My Courses',
      tourId: 'nav-courses'
    },
    {
      path: '/student/results',
      nameKey: 'nav_results',
      icon: <Trophy size={20} />,
      label: 'Results',
      description: 'Academic Results',
      tourId: 'nav-results'
    },
    {
      path: '/student/attendance',
      nameKey: 'nav_attendance',
      icon: <Clock size={20} />,
      label: 'Attendance',
      description: 'Attendance Records',
      tourId: 'nav-attendance'
    },
  ];

  const currentPage =
    navItems.find((item) => item.path === location.pathname)?.nameKey
      ? t(navItems.find((item) => item.path === location.pathname)?.nameKey)
      : t('nav_dashboard');

  return (
    <div className="h-screen bg-background overflow-hidden">
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 hidden lg:block
          transition-all duration-300
          ${sidebarCollapsed ? "w-20" : "w-64"}
          bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900
          shadow-[0_0_40px_rgba(0,0,0,0.5)]
        `}
      >
        <div className="flex flex-col h-full backdrop-blur-xl bg-white/5">

          {/* ===== LOGO ===== */}
          <div className="h-24 sm:h-28 border-b border-white/20 flex items-center justify-center">
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

          {/* ================= USER INFO ================= */}
          {!sidebarCollapsed && (
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                    <span className="font-semibold text-white text-lg">
                      {user?.name?.charAt(0)?.toUpperCase() || 'S'}
                    </span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-slate-900"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-white">
                    {user?.name || 'Student'}
                  </p>
                  <p className="text-white/70 text-xs truncate">
                    {user?.email || 'student@example.com'}
                  </p>
                  <div className="flex items-center mt-1 space-x-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                      Active
                    </span>
                    <span className="text-white/50 text-xs">Student</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= NAVIGATION ================= */}
          <nav className="flex-1 min-h-0 p-4 overflow-y-auto hide-scrollbar">
            <div className="space-y-2">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => handleNavClick(e, item)}
                    data-tour={item.tourId}
                    className={`
                      group relative flex items-center rounded-xl px-3 py-3 transition-all duration-200
                      ${isActive
                        ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 text-white shadow-lg border border-white/20'
                        : 'text-white/70 hover:text-white hover:bg-white/10 hover:shadow-md'
                      }
                      ${sidebarCollapsed ? 'justify-center' : ''}
                    `}
                  >
                    <div className={`flex items-center ${sidebarCollapsed ? '' : 'justify-between w-full'}`}>
                      <div className="flex items-center space-x-3">
                        <div className={`
                          ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white'}
                          transition-colors duration-200
                        `}>
                          {item.icon}
                        </div>
                        {!sidebarCollapsed && (
                          <div>
                            <span className={`font-medium ${isActive ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>
                              {item.label}
                            </span>
                            {!sidebarCollapsed && (
                              <p className="text-xs text-white/50 group-hover:text-white/70 mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {!sidebarCollapsed && isActive && (
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    
                    {/* Tooltip for collapsed state */}
                    {sidebarCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                        {item.label}
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-slate-800 rotate-45"></div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="p-4 border-t border-white/10 space-y-3">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-white/10 to-white/5 hover:from-white/20 hover:to-white/10 text-white/80 hover:text-white transition-all duration-200 group"
            >
              <div className="flex items-center space-x-3">
                <ChevronLeft className={`transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
                {!sidebarCollapsed && (
                  <span className="font-medium">{t('nav_collapse') ?? 'Collapse'}</span>
                )}
              </div>
              {sidebarCollapsed && <ChevronRight />}
            </button>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-xl blur-xl"></div>
              <button
                onClick={handleLogout}
                className={`relative w-full flex items-center p-3 rounded-xl bg-gradient-to-r from-red-500/10 to-pink-500/10 hover:from-red-500/20 hover:to-pink-500/20 text-red-400 hover:text-red-300 transition-all duration-200 group ${sidebarCollapsed ? 'justify-center' : ''}`}
              >
                <LogOut size={18} className="group-hover:scale-110 transition-transform duration-200" />
                {!sidebarCollapsed && (
                  <span className="ml-3 font-medium">{t('nav_logout') ?? 'Logout'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ================= MOBILE SIDEBAR ================= */}
      {mobileMenuOpen && (
        <div className="mobile-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-sidebar open bg-gradient-to-b from-slate-900 to-slate-800" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <img src={whiteLogo} alt="Core5 Academy" className="h-10 w-auto" />
                <button onClick={() => setMobileMenuOpen(false)}>
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            <div className="p-5 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <div>
                  <h1 className="font-bold text-lg">Student Portal</h1>
                  <p className="text-white/70 text-sm">Welcome back</p>
                </div>
              </div>
            </div>

            <nav className="p-4">
              <div className="space-y-1">
                {navItems.map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={(e) => { setMobileMenuOpen(false); handleNavClick(e, item); }}
                      className={`
                        flex items-center space-x-3 rounded-xl px-3 py-3 transition
                        ${isActive
                          ? 'bg-white/20 text-white'
                          : 'text-white/80 hover:bg-white/10'
                        }
                      `}
                    >
                      {item.icon}
                      <span className="font-medium">{t(item.nameKey)}</span>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-6 space-y-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 p-3 rounded-xl bg-red-500/20 hover:bg-red-500/30"
                >
                  <LogOut size={18} />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* ================= MAIN CONTENT ================= */}
      <main
        className={`
          transition-all duration-300 flex-1 overflow-y-auto
          ${sidebarCollapsed ? 'md:ml-16 lg:ml-20' : 'md:ml-56 lg:ml-64'}
          flex-1 overflow-y-auto
        `}
      >

        {/* ================= TOP BAR ================= */}
        <header className="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-200">
          <div className="px-3 sm:px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-lg hover:bg-gray-100"
                >
                  <ChevronRight size={20} className="text-text" />
                </button>
                <h1 className="text-lg sm:text-xl font-bold text-text truncate">{currentPage}</h1>
              </div>

              <div className="flex items-center space-x-3">
                {/* Removed duplicate announcement and logout buttons - only in sidebar now */}
              </div>
            </div>
          </div>
        </header>

        {/* ================= CONTENT AREA ================= */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollable-content p-3 sm:p-4 md:p-6 h-full max-h-screen">
          <div className="min-h-full">
            {children}
          </div>
        </div>

      </main>

      {/* ================= QUOTA MODAL (OVERLAY) ================= */}
      <QuotaLimitModal isOpen={showQuotaModal} onClose={() => setShowQuotaModal(false)} quotaDetails={quotaDetails} />

      {/* GuideBot Launcher — one shared instance for both desktop and mobile */}
      <div className="fixed bottom-6 right-6 z-40">
        <GuideBotLauncher tourId="student-overview-v1" />
      </div>
    </div>
  );
};

/* Custom scrollbar styles */
const style = document.createElement('style');
style.textContent = `
  .scrollable-content::-webkit-scrollbar {
    width: 8px;
  }
  .scrollable-content::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }
  .scrollable-content::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }
  .scrollable-content::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;
if (!document.head.querySelector('style[data-scrollbar-styles]')) {
  style.setAttribute('data-scrollbar-styles', 'true');
  document.head.appendChild(style);
}

export default StudentLayout;