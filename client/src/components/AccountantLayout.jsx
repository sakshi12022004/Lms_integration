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
import whiteLogo from '../../../core5 logo new new-modified (1).png';

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
          bg-gradient-to-b from-emerald-700 via-emerald-700 to-teal-700
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

          {/* ================= NAVIGATION ================= */}
          <nav className="flex-1 min-h-0 p-4 overflow-y-auto hide-scrollbar">
            <div className="space-y-1">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => handleNavClick(e, item)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                      ${isActive
                        ? 'bg-white/20 text-white'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }
                      ${sidebarCollapsed ? 'justify-center' : ''}
                    `}
                    title={sidebarCollapsed ? t(item.nameKey) : ''}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="font-medium">{t(item.nameKey)}</span>
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
                <ChevronRight size={20} />
              ) : (
                <>
                  <span className="font-medium text-sm">Collapse</span>
                  <ChevronLeft size={20} />
                </>
              )}
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
              bg-red-600/20 text-red-300 hover:bg-red-600/30 transition"
            >
              <LogOut size={20} />
              {!sidebarCollapsed && <span className="font-medium text-sm">Logout</span>}
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
        bg-gradient-to-b from-emerald-700 via-emerald-700 to-teal-700
        transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full backdrop-blur-xl bg-white/5 p-4">
          <div className="flex justify-between items-center mb-6">
            <img src={whiteLogo} alt="Core5 Academy" className="h-16" />
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={(e) => {
                  handleNavClick(e, item);
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-white hover:bg-white/20"
              >
                {item.icon}
                <span>{t(item.nameKey)}</span>
              </Link>
            ))}
          </nav>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-600/20 text-red-300 hover:bg-red-600/30 w-full"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
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
