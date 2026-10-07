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

        const res = await fetch(`${API}/subscriptions/check-feature-access`, {
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
          bg-[#1e1b4b]
          shadow-xl
        `}
      >
        <div className="flex flex-col h-full bg-[#1e1b4b] relative overflow-hidden">
          {/* ===== LOGO ===== */}
          <div className="h-24 sm:h-28 border-b border-white/10 flex items-center justify-center relative z-10">
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
            <div className="p-4 border-b border-white/10 relative z-10">
              <div className="flex items-center space-x-3">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-none bg-[#B99652]/20 border border-[#B99652] text-[#B99652] flex items-center justify-center font-bold text-sm">
                    {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-none border border-[#1e1b4b]"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate text-white">
                    {user?.name || 'Accountant'}
                  </p>
                  <p className="text-white/60 text-xs truncate">
                    {user?.email || 'accountant@core5.com'}
                  </p>
                  <div className="flex items-center mt-1 space-x-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[10px] uppercase tracking-wider font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Active
                    </span>
                    <span className="text-white/40 text-xs uppercase tracking-wider">Accountant</span>
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
                      flex items-center gap-3 px-4 py-3 rounded-none transition-all duration-200
                      ${isActive
                        ? 'bg-[#B99652]/20 text-white border-l-4 border-[#B99652] font-semibold'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }
                      ${sidebarCollapsed ? 'justify-center' : ''}
                    `}
                    title={sidebarCollapsed ? t(item.nameKey) : ''}
                  >
                    <span className={`shrink-0 ${isActive ? 'text-[#B99652]' : 'text-white/70'} transition-colors`}>{item.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="font-medium text-sm">{t(item.nameKey)}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* ===== FOOTER ===== */}
          <div className="p-4 border-t border-white/10 space-y-2 relative z-10">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-between p-3 rounded-none bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              <div className="flex items-center space-x-3">
                <ChevronLeft size={16} className={`transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
                {!sidebarCollapsed && (
                  <span>Collapse</span>
                )}
              </div>
              {sidebarCollapsed && <ChevronRight size={16} />}
            </button>

            <button
              onClick={handleLogout}
              className={`w-full flex items-center p-3 rounded-none bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold uppercase tracking-wider transition-colors ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
            >
              <LogOut size={16} />
              {!sidebarCollapsed && <span className="ml-3">Logout</span>}
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
        bg-[#1e1b4b] text-white shadow-xl
        transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full bg-[#1e1b4b]">
          <div className="h-24 sm:h-28 border-b border-white/10 flex items-center justify-between px-4">
            <img src={whiteLogo} alt="Core5 Academy" className="max-h-full w-auto object-contain" />
            <button onClick={() => setMobileMenuOpen(false)} className="text-white">
              <ChevronLeft size={20} />
            </button>
          </div>

          <div className="p-4 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-none bg-[#B99652]/20 border border-[#B99652] text-[#B99652] flex items-center justify-center font-bold text-sm flex-shrink-0">
                {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div>
                <h1 className="font-bold text-sm text-white font-['DM_Serif_Display',serif]">Accountant Portal</h1>
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
                className="flex items-center gap-3 px-4 py-3 rounded-none text-white/80 hover:bg-white/10 hover:text-white"
              >
                {item.icon}
                <span className="font-medium text-sm">{t(item.nameKey)}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-white/10 mt-auto">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 p-3 rounded-none bg-red-500/20 text-red-300 hover:bg-red-500/30 w-full font-semibold text-xs uppercase tracking-wider"
            >
              <LogOut size={16} />
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
          h-full bg-[#0f172a] text-slate-100
        `}
      >
        {/* ================= HEADER ================= */}
        <header className="sticky top-0 z-20 bg-[#1e1b4b] border-b border-white/10 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4 lg:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-none hover:bg-white/10"
              >
                <ChevronRight size={24} className="text-white" />
              </button>
              <h1 className="text-xl font-bold font-['DM_Serif_Display',serif] text-white">{currentPage}</h1>
            </div>

            <div className="hidden lg:block">
              <h1 className="text-xl font-bold font-['DM_Serif_Display',serif] text-white">{currentPage}</h1>
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
