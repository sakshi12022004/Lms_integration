import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Package,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Warehouse
} from 'lucide-react';
import { useAuth } from '../auth/auth';
import LoginFooter from './LoginFooter';
import whiteLogo from '../../../core5 logo new new-modified (1).png';

const VendorLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logoutUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  const navItems = [
    { path: '/vendor/dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/vendor/invoices', name: 'Invoices', icon: <FileText size={20} /> },
    { path: '/vendor/orders', name: 'Orders', icon: <Package size={20} /> },
    { path: '/vendor/stock', name: 'Stock', icon: <Warehouse size={20} /> },
    { path: '/vendor/payments', name: 'Payments', icon: <DollarSign size={20} /> },
  ];

  const currentPage = navItems.find(item => location.pathname === item.path)?.name || 'Dashboard';

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50">
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-gradient-to-b from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg z-40 hidden lg:block transition-all duration-300 ${
          sidebarCollapsed ? "w-20" : "w-64"
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

          {/* ================= NAVIGATION ================= */}
          <nav className="flex-1 min-h-0 p-4 overflow-y-auto hide-scrollbar">
            <div className="space-y-1">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                      ${isActive
                        ? 'bg-purple-800 text-white border-l-4 border-purple-600'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }
                      ${sidebarCollapsed ? 'justify-center' : ''}
                    `}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="font-medium">{item.name}</span>
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
        className={`fixed top-0 left-0 h-screen w-64 z-40 bg-gradient-to-b from-violet-600 via-purple-600 to-indigo-600 text-white transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full backdrop-blur-xl bg-white/5 p-4">
          <div className="flex justify-between items-center mb-6">
            <img src={whiteLogo} alt="Core5 Academy" className="h-16" />
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg"
            >
              <ChevronLeft size={20} />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/90 hover:bg-white/20
                  ${location.pathname === item.path ? 'bg-purple-800 border-l-4 border-purple-600' : ''}"
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* Mobile Logout */}
          <div className="pt-4 border-t border-white/20">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl
              bg-red-600/20 text-red-300 hover:bg-red-600/30 transition"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <div className={`lg:ml-${sidebarCollapsed ? "20" : "64"} transition-all duration-300 bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50`}>
        {/* Desktop Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30 hidden lg:block">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                <Menu size={20} />
              </button>
              <h1 className="text-xl font-semibold text-gray-800">{currentPage}</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30 lg:hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Menu size={20} />
              </button>
              <h1 className="text-lg font-semibold text-gray-800">{currentPage}</h1>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
      
      {/* Footer */}
      <LoginFooter />
    </div>
  );
};

export default VendorLayout;
