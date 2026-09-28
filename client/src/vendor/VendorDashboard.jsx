import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/auth';
import {
  FileText,
  Package,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  RefreshCw
} from 'lucide-react';

const VendorDashboard = () => {
  const { API, token } = useAuth();
  const [stats, setStats] = useState({
    totalInvoices: 0,
    pendingInvoices: 0,
    paidInvoices: 0,
    totalRevenue: 0
  });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 30 seconds for real-time updates
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Debug: Log current user info
      console.log('🔍 Current user info:', { API, token: token ? 'present' : 'missing' });
      
      // Fetch vendor stats
      const statsRes = await fetch(`${API}/vendor/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('📊 Stats API Response Status:', statsRes.status);
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        console.log('📊 Vendor Stats API Response:', statsData);
        if (statsData.success) {
          console.log('📈 Setting stats:', statsData.data);
          setStats(statsData.data);
        } else {
          console.error('❌ Stats API returned success: false:', statsData.message);
        }
      } else {
        console.error('❌ Stats API Error:', statsRes.status, statsRes.statusText);
        const errorText = await statsRes.text();
        console.error('❌ Error response:', errorText);
      }

      // Fetch recent invoices
      const invoicesRes = await fetch(`${API}/vendor/invoices?limit=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('📄 Invoices API Response Status:', invoicesRes.status);
      
      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        console.log('📄 Vendor Invoices API Response:', invoicesData);
        if (invoicesData.success) {
          setRecentInvoices(invoicesData.data);
        } else {
          console.error('❌ Invoices API returned success: false:', invoicesData.message);
        }
      } else {
        console.error('❌ Invoices API Error:', invoicesRes.status, invoicesRes.statusText);
        const errorText = await invoicesRes.text();
        console.error('❌ Error response:', errorText);
      }
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, change, changeType, color }) => (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-violet-100 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${color} shadow-md`}>
          {icon}
        </div>
        {change && (
          <div className={`flex items-center text-sm font-medium ${
            changeType === 'positive' ? 'text-green-600' : 'text-red-600'
          }`}>
            {changeType === 'positive' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            {change}
          </div>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-600 font-medium">{title}</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-violet-500 border-t-transparent"></div>
          <p className="mt-4 text-violet-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vendor Dashboard</h1>
          <p className="text-gray-600">Real-time overview of your business</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="dashboard-grid mb-6">
        <StatCard
          title="Total Invoices"
          value={stats.totalInvoices}
          icon={<FileText size={24} className="text-blue-600" />}
          color="bg-blue-100"
          change="+12%"
          changeType="positive"
        />
        <StatCard
          title="Pending Invoices"
          value={stats.pendingInvoices}
          icon={<Clock size={24} className="text-yellow-600" />}
          color="bg-yellow-100"
          change="+3"
          changeType="positive"
        />
        <StatCard
          title="Total Revenue"
          value={`₹${stats.totalRevenue.toLocaleString('en-IN')}`}
          icon={<TrendingUp size={24} className="text-green-600" />}
          color="bg-green-100"
          change="+23%"
          changeType="positive"
        />
      </div>

      {/* Charts and Tables Row */}
      <div className="responsive-card">
        <div className="responsive-card-content">
        {/* Recent Invoices */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-violet-600" size={24} />
              Recent Invoices
            </h3>
            <button className="text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors">View All</button>
          </div>
          <div className="space-y-3">
            {recentInvoices.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText size={56} className="mx-auto mb-4 text-violet-300" />
                <p className="text-lg font-medium">No invoices yet</p>
                <p className="text-sm text-gray-400 mt-2">Your invoices will appear here once you create them</p>
              </div>
            ) : (
              recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-100 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-full shadow-md ${
                      invoice.status === 'paid' ? 'bg-green-100' : 
                      invoice.status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      {invoice.status === 'paid' ? <CheckCircle size={20} className="text-green-600" /> :
                       invoice.status === 'pending' ? <Clock size={20} className="text-yellow-600" /> :
                       <AlertCircle size={20} className="text-red-600" />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-lg">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-gray-600">{new Date(invoice.issueDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-xl">₹{invoice.amount.toLocaleString('en-IN')}</p>
                    <p className={`text-sm font-medium ${
                      invoice.status === 'paid' ? 'text-green-600' : 
                      invoice.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                    }`}>{invoice.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default VendorDashboard;
