import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Package, Users2, FileText, LayoutDashboard, ClipboardList, LogOut, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import { useAuth } from "../auth/auth";
import { useTranslation } from "../context/TranslationContext";
import RequestStatus from "./RequestStatus";
import whiteLogo from '../../../core5 logo new new-modified (1).png';

const items = [
  { name: "Inventory", icon: Package },
  { name: "Vendors", icon: Users2 },
  { name: "Vendor Stock", icon: Package },
  { name: "Requirements", icon: ClipboardList },
  { name: "Reports", icon: FileText },
];

export default function Sidebar() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { logoutUser } = useAuth();
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    logoutUser?.();
    navigate('/login');
  };

  return (
    <aside className={`sticky top-0 h-screen flex-shrink-0 text-white shadow-lg flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-64'} bg-gradient-to-b from-green-900 via-green-800 to-green-900`}>
      <div className="h-24 sm:h-28 border-b border-white/10 flex items-center justify-center">
        {!sidebarCollapsed ? (
          <img src={whiteLogo} alt="Core5 Academy" className="max-h-full w-auto object-contain" />
        ) : (
          <img src={whiteLogo} alt="Core5 Academy" className="h-16 w-auto object-contain" />
        )}
      </div>

      <nav className="flex-1 p-4 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-200">
        {items.map((item) => {
          const Icon = item.icon;
          // Handle special cases for multi-word items
          const path = item.name === "Vendor Stock" 
            ? "/storekeeper/vendor-stock"
            : `/storekeeper/${item.name.toLowerCase()}`;
          const active = loc.pathname.startsWith(path);
          return (
            <Link
              key={item.name}
              to={path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                active
                  ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              } ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <Icon size={20} />
              {!sidebarCollapsed && <span className="font-medium">{item.name}</span>}
            </Link>
          );
        })}
        
        {/* Request Status Section */}
        {!sidebarCollapsed && <RequestStatus />}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
        >
          {sidebarCollapsed ? <ChevronRight /> : <>{t('nav_collapse') ?? 'Collapse'} <ChevronLeft /></>}
        </button>

        <button
          onClick={handleLogout}
          className={`mt-3 w-full flex items-center p-3 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 ${sidebarCollapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={18} />
          {!sidebarCollapsed && <span className="ml-3">{t('nav_logout') ?? 'Logout'}</span>}
        </button>
      </div>
    </aside>
  );
}
