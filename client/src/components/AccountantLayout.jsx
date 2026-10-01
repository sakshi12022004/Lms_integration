import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  DollarSign,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  Database,
  Users,
  Calendar,
  User,
  Building,
} from 'lucide-react';
import { useAuth } from '../auth/auth';
import { useTranslation } from '../context/TranslationContext';
import AnnouncementBell from './AnnouncementBell';
import QuotaLimitModal from './QuotaLimitModal';
import LoginFooter from './LoginFooter';
import whiteLogo from '../assets/core5-final-rbg.png';

const AccountantLayout = ({ children }) => {
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
    // Check if this is a restricted feature
    const restrictedFeatures = {
      '/accountant/payment-history': 'payment history',
      '/accountant/expenses': 'expenses',
      '/accountant/database-export': 'database export',
    };

    const featureName = restrictedFeatures[item.path];

    if (featureName) {
      e.preventDefault();
      try {
        if (!token) {
          setQuotaDetails({
            type: 'feature',
            resourceType: featureName,
            message: 'Please login to access this feature.',
          });
          setShowQuotaModal(true);
          return;
        }

        const res = await fetch(`${API}/api/subscriptions/check-feature-access`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('feature check failed');
        const data = await res.json();

        // Check if current plan is 'free'
        if (data.currentPlan === 'free') {
          setQuotaDetails({
            type: 'feature',
            resourceType: featureName,
            message: 'Your account is on the Free plan — upgrade to access this feature.',
          });
          setShowQuotaModal(true);
          return;
        }

        // If not free plan, allow navigation
        navigate(item.path);
      } catch (err) {
        console.error('Feature check error', err);
        setQuotaDetails({
          type: 'feature',
          resourceType: featureName,
          message: 'Your account is on the Free plan — upgrade to access this feature.',
        });
        setShowQuotaModal(true);
      }
    }
  };

  const navItems = [
    {
      path: '/accountant/dashboard',
      nameKey: 'nav_dashboard',
      icon: <LayoutDashboard size={20} />,
    },
    {
      path: '/accountant/vendor-invoices',
      nameKey: 'vendor_invoices',
      icon: <FileText size={20} />,
    },
    {
      path: '/accountant/fees',
      nameKey: 'fee_collection',
      icon: <BarChart3 size={20} />,
    },
    {
      path: '/accountant/expenses',
      nameKey: 'expenses',
      icon: <DollarSign size={20} />,
    },
    {
      path: '/accountant/database-export',
      nameKey: 'database_export',
      icon: <Database size={20} />,
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
          ${sidebarCollapsed ? 'w-20' : 'w-64'}
          bg-[#002366]
          shadow-[0_0_40px_rgba(0,35,102,0.4)]
        `}
      >
        <div className="flex flex-col h-full bg-[#002366] relative overflow-hidden">

          {/* Full Mountain / Pahad Silhouette Backdrop for the entire Sidebar */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            {/* Ambient Stars & Subtle Glowing Accents */}
            <div className="absolute top-[28%] right-6 w-1.5 h-1.5 rounded-full bg-amber-200/40" />
            <div className="absolute top-[35%] left-7 w-1 h-1 rounded-full bg-white/40" />
            <div className="absolute top-[42%] right-12 w-2 h-2 rounded-full bg-white/30 blur-[0.5px]" />
            <div className="absolute bottom-[230px] right-6 w-12 h-12 rounded-full bg-gradient-to-tr from-amber-300/25 to-amber-100/5 blur-sm" />

            {/* Multi-layered Mountain Silhouettes */}
            <svg
              className="absolute inset-x-0 bottom-0 w-full h-[380px] opacity-60 pointer-events-none"
              viewBox="0 0 300 380"
              preserveAspectRatio="none"
              fill="none"
            >
              <defs>
                <linearGradient id="acct-nav-mountain-back" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4b5d94" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#1e274a" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="acct-nav-mountain-mid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2e3e70" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#111833" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="acct-nav-mountain-front" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1a254c" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#060a18" stopOpacity="1" />
                </linearGradient>
              </defs>

              {/* Glowing Moon behind peak */}
              <circle cx="210" cy="85" r="14" fill="#ffd6a0" opacity="0.75" />

              {/* Back Mountain Ridge */}
              <path d="M 0 190 L 60 115 L 95 150 L 155 65 L 205 125 L 245 90 L 300 165 L 300 380 L 0 380 Z" fill="url(#acct-nav-mountain-back)" />

              {/* Mid Mountain Ridge */}
              <path d="M 0 235 L 45 175 L 90 215 L 160 135 L 220 195 L 260 165 L 300 215 L 300 380 L 0 380 Z" fill="url(#acct-nav-mountain-mid)" />

              {/* Foreground Mountain Base */}
              <path d="M 0 275 L 70 225 L 140 270 L 210 210 L 275 260 L 300 240 L 300 380 L 0 380 Z" fill="url(#acct-nav-mountain-front)" />
            </svg>
          </div>

          {/* ===== LOGO ===== */}
          <div className="h-24 sm:h-28 border-b border-white/15 flex items-center justify-center relative z-10">
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
            <div className="p-4 border-b border-white/15 relative z-10">
              <div className="flex items-center space-x-3">
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full bg-[#f1be38] text-[#1e1b4b] flex items-center justify-center font-bold text-base shadow-md">
                    {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-[#002366]"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-white">
                    {user?.name || 'Accountant'}
                  </p>
                  <p className="text-white/70 text-xs truncate">
                    {user?.email || 'accountant@core5.com'}
                  </p>
                  <div className="flex items-center mt-1 space-x-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                      Active
                    </span>
                    <span className="text-white/50 text-xs capitalize">Accountant</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= NAVIGATION ================= */}
          <nav className="flex-1 min-h-0 p-4 space-y-1.5 overflow-y-auto hide-scrollbar relative z-10">
            <div className="space-y-1.5">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => handleNavClick(e, item)}
                    className={`
                      flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
                      ${isActive
                        ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 text-white shadow-lg border border-white/20 backdrop-blur-xs'
                        : 'text-white/70 hover:bg-white/10 hover:text-white hover:shadow-md'
                      }
                      ${sidebarCollapsed ? 'justify-center' : ''}
                    `}
                    title={sidebarCollapsed ? t(item.nameKey) : ''}
                  >
                    <span className={`shrink-0 ${isActive ? 'text-white' : 'text-white/70'} transition-colors`}>{item.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="font-medium text-sm">{t(item.nameKey)}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* ===== FOOTER ===== */}
          <div className="p-4 border-t border-white/15 space-y-3 relative z-10">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-white/10 to-white/5 hover:from-white/20 hover:to-white/10 text-white/80 hover:text-white transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <ChevronLeft className={`transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
                {!sidebarCollapsed && (
                  <span className="font-medium text-sm">Collapse</span>
                )}
              </div>
              {sidebarCollapsed && <ChevronRight size={20} />}
            </button>

            <button
              onClick={handleLogout}
              className={`w-full flex items-center p-3 rounded-xl bg-gradient-to-r from-red-500/10 to-pink-500/10 hover:from-red-500/20 hover:to-pink-500/20 text-red-400 hover:text-red-300 transition-all duration-200 ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
            >
              <LogOut size={18} />
              {!sidebarCollapsed && <span className="ml-3 font-medium text-sm">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MOBILE SIDEBAR ================= */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 lg:hidden transition-opacity ${
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside
        className={`fixed top-0 left-0 h-screen w-64 z-40 lg:hidden
        bg-[#002366] text-white shadow-lg
        transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full bg-[#002366]">
          <div className="h-24 sm:h-28 border-b border-white/15 flex items-center justify-between px-4">
            <img src={whiteLogo} alt="Core5 Academy" className="max-h-full w-auto object-contain" />
            <button onClick={() => setMobileMenuOpen(false)} className="text-white">
              <ChevronLeft size={20} />
            </button>
          </div>

          <div className="p-4 border-b border-white/15">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#f1be38] text-[#1e1b4b] flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-md">
                {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div>
                <h1 className="font-bold text-base text-white">Accountant Portal</h1>
                <p className="text-xs text-white/70 truncate">{user?.name || user?.email}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={(e) => {
                  handleNavClick(e, item);
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
              >
                {item.icon}
                <span className="font-medium text-sm">{t(item.nameKey)}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-white/15 mt-auto">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 w-full font-medium text-sm"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main
        className={`
          transition-all duration-300 flex-1 overflow-hidden
          ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}
          h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900
        `}
      >
        {/* ================= HEADER ================= */}
        <header className="sticky top-0 z-20 bg-slate-800/50 backdrop-blur-md border-b border-slate-700/50">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4 lg:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-slate-700"
              >
                <ChevronRight size={24} className="text-white" />
              </button>
              <h1 className="text-xl font-bold text-white">{currentPage}</h1>
            </div>

            <div className="hidden lg:block">
              <h1 className="text-xl font-bold text-white">{currentPage}</h1>
            </div>

            <div className="flex items-center gap-4">
            </div>
          </div>
        </header>

        {/* ================= PAGE CONTENT ================= */}
        <div className="flex-1 overflow-y-auto scrollable-content p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
      
      {/* Footer */}
      <LoginFooter />

      {/* ================= QUOTA LIMIT MODAL ================= */}
      {showQuotaModal && (
        <QuotaLimitModal
          details={quotaDetails}
          onClose={() => setShowQuotaModal(false)}
        />
      )}
    </div>
  );
};

export default AccountantLayout;
