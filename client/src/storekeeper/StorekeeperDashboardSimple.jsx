import React from 'react';
import './StorekeeperStyles.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/auth';

// Import components directly
import Sidebar from './Sidebar';
import WelcomeStorekeeper from './WelcomeStorekeeper';
import InventoryManagementSimple from './InventoryManagementSimple';
import VendorManagementSimple from './VendorManagementSimple';
import Requirements from './Requirements';

const StorekeeperDashboard = () => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <div className="flex bg-[#fffdf4] h-screen overflow-hidden text-[#1e1b4b]">
      <Sidebar />
      
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto bg-[#fffdf4]">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-full overflow-y-auto scrollable-content">
            <Routes>
              <Route path="" element={<WelcomeStorekeeper />} />
              <Route path="welcome" element={<WelcomeStorekeeper />} />
              <Route path="inventory" element={<InventoryManagementSimple />} />
              <Route path="vendors" element={<VendorManagementSimple />} />
              <Route path="vendor-stock" element={<VendorManagementSimple />} />
              <Route path="requirements" element={<Requirements />} />
              <Route
                path="reports"
                element={
                  <div className="bg-white/95 backdrop-blur-sm border border-[#ebdcaa] rounded-none shadow-[0_4px_25px_rgba(185,150,82,0.06)] p-6">
                    <h2 className="text-xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-2">
                      Inventory & Requisition Reports
                    </h2>
                    <p className="text-xs text-[#7a705a]">
                      Export and audit reports for storekeeper inventories.
                    </p>
                  </div>
                }
              />
              <Route path="*" element={<Navigate to="/storekeeper/dashboard" replace />} />
            </Routes>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StorekeeperDashboard;
