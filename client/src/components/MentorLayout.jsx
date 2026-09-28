import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  PlusSquare,
  Users,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Calendar,
  School,
  FileText,
  Package
} from "lucide-react";
import { useAuth } from "../auth/auth";
import QuotaLimitModal from './QuotaLimitModal';
import { useTranslation } from "../context/TranslationContext";
import AnnouncementBell from "./AnnouncementBell";
import LoginFooter from './LoginFooter';
import GuideBotLauncher from '../guidebot/runtime/GuideBotLauncher';
import whiteLogo from '../../../core5 logo new new-modified (1).png';

const MentorLayout = ({ children }) => {
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
    navigate("/login");
  };

  const checkFeatureAccess = async (e, item) => {
    // DISABLED: Allow all features without checks
    navigate(item.path);
  };

  // The sidebar <Link onClick> below calls this; it was referenced but never
  // defined, so every sidebar click threw and fell back to a full page reload.
  // Navigation itself is done by the <Link>.
  const handleNavClick = () => {};

  // Language selector removed for Mentor portal

  const navItems = [
    {
      path: "/mentor/dashboard",
      nameKey: "nav_dashboard",
      icon: <LayoutDashboard size={20} />,
      tourId: "nav-dashboard",
    },
    ...(user?.role === "mentor" || user?.role === "teacher"
      ? [
        {
          path: "/mentor/classrooms",
          nameKey: "my_classrooms",
          icon: <School size={20} />,
          tourId: "nav-my-classroom",
        },
        {
          path: "/mentor/attendance",
          nameKey: "nav_attendance",
          icon: <Users size={20} />,
          tourId: "nav-attendance",
        },
        {
          path: "/mentor/results",
          nameKey: "class_results",
          icon: <FileText size={20} />,
          tourId: "nav-results",
        },
        {
          path: "/mentor/requirements",
          nameKey: "requirements",
          icon: <Package size={20} />,
          tourId: "nav-requirements",
        },
      ]
      : []),
    {
      path: "/mentor/calendar",
      nameKey: "nav_calendar",
      icon: <Calendar size={20} />,
      tourId: "nav-calendar",
    },
  ];

  const currentPage =
    navItems.find((item) => item.path === location.pathname)?.nameKey
      ? t(navItems.find((item) => item.path === location.pathname)?.nameKey)
      : t("nav_dashboard");

  return (
    <div className="h-screen bg-background overflow-hidden">
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 hidden lg:block
          transition-all duration-300
          ${sidebarCollapsed ? "w-20" : "w-64"}
          bg-gradient-to-b from-blue-700 via-indigo-700 to-cyan-700
          shadow-[0_0_40px_rgba(0,0,0,0.25)]
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

          {/* ===== NAV ===== */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto hide-scrollbar">
            <div className="space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => handleNavClick(e, item)}
                    data-tour={item.tourId}
                    className={`
                      relative flex items-center gap-3 px-4 py-3 rounded-xl
                      transition-all duration-300
                      ${isActive
                        ? "bg-white/20 text-white shadow-lg"
                        : "text-white/80 hover:bg-white/10"
                      }
                      ${sidebarCollapsed ? "justify-center" : ""}
                    `}
                  >
                    {/* Active glow bar */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full bg-white" />
                    )}

                    <span className="shrink-0">{item.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="font-medium tracking-wide">
                        {t(item.nameKey)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* ===== FOOTER ===== */}
          <div className="p-4 border-t border-white/20 space-y-3">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl
              bg-white/10 text-white hover:bg-white/20 transition"
            >
              {sidebarCollapsed ? (
                <ChevronRight />
              ) : (
                <>
                  <span className="text-sm font-medium">{t('nav_collapse')}</span>
                  <ChevronLeft />
                </>
              )}
            </button>

            <button
              onClick={handleLogout}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl
                bg-red-500/20 text-red-100 hover:bg-red-500/30 transition
                ${sidebarCollapsed ? "justify-center" : ""}
              `}
            >
              <LogOut size={18} />
              {!sidebarCollapsed && <span className="font-medium">{t('nav_logout')}</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main
        className={`transition-all duration-300 flex-1 overflow-hidden ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
          } h-screen flex flex-col`}
      >
        {/* ===== TOP BAR ===== */}
        <header className="sticky top-0 z-30 bg-white border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{currentPage}</h1>
            
            {/* Language selector removed for Mentor portal */}

            {/* Announcement Bell */}
            <AnnouncementBell />
          </div>
        </header>

        {/* ===== CONTENT ===== */}
        <div className="flex-1 overflow-y-auto scrollable-content p-4 md:p-6">{children}</div>
      </main>
      
      {/* Footer */}
      <LoginFooter />

      {/* ================= QUOTA MODAL (OVERLAY) ================= */}
      <QuotaLimitModal isOpen={showQuotaModal} onClose={() => setShowQuotaModal(false)} quotaDetails={quotaDetails} />

      {/* GuideBot Launcher — one shared instance for both desktop and mobile */}
      <div className="fixed bottom-6 right-6 z-40">
        <GuideBotLauncher tourId="mentor-overview-v1" />
      </div>
    </div>
  );
};

export default MentorLayout;
