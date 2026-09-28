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
  console.log('🔍 StorekeeperDashboard rendering...');
  console.log('User:', user);
  
  if (!user) {
    console.log('❌ No user found, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  return (
    <div className="flex bg-gray-50 h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 p-6 overflow-y-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Storekeeper Dashboard</h1>
            <p className="text-gray-600">Welcome, {user?.name || 'Storekeeper'}!</p>
          </div>
          
          <div className="h-full overflow-y-auto scrollable-content">
          <Routes>
            <Route path="" element={<WelcomeStorekeeper />} />
            <Route path="welcome" element={<WelcomeStorekeeper />} />
            <Route path="inventory" element={<InventoryManagementSimple />} />
            <Route path="vendors" element={<VendorManagementSimple />} />
            <Route path="vendor-stock" element={<VendorManagementSimple />} />
            <Route path="vendor-stock" element={<VendorManagementSimple />} />
            <Route path="requirements" element={<Requirements />} />
            <Route path="reports" element={<div className="bg-white rounded-xl shadow-sm p-6"><h2 className="text-xl font-bold mb-4">Reports</h2><p className="text-gray-600">Reports section coming soon...</p></div>} />
            <Route path="*" element={<Navigate to="/storekeeper/dashboard" replace />} />
          </Routes>
        </div>
        </div>
      </main>
    </div>
  );
};

export default StorekeeperDashboard;
