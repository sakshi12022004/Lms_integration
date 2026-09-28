import React, { useState, useEffect } from 'react';
import { useAuth } from "../../auth/auth";
import { useTranslation } from '../../context/TranslationContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  CheckCircle, 
  AlertCircle,
  Clock,
  CreditCard,
  Download,
  RefreshCw,
  Eye,
  BarChart3,
  Database,
  Package,
  Building,
  UserCheck,
  Activity,
  FileCheck,
  Target
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const AccountantDashboard = () => {
  const { token, API } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Listen for payment events from VendorInvoiceManagement
  useEffect(() => {
    const handlePaymentSuccess = (event) => {
      console.log('🔔 Dashboard received payment event:', event.detail);
      
      // Refresh dashboard data to show updated stats
      fetchDashboardData();
      
      // Show success notification
      const invoiceNumber = event.detail?.invoiceNumber || 'Unknown';
      toast.success(`Payment received for Invoice #${invoiceNumber}`);
    };

    // Add event listener
    if (window.accountantPaymentEvents) {
      window.accountantPaymentEvents.addEventListener('paymentSuccess', handlePaymentSuccess);
    }

    // Cleanup on unmount
    return () => {
      if (window.accountantPaymentEvents) {
        window.accountantPaymentEvents.removeEventListener('paymentSuccess', handlePaymentSuccess);
      }
    };
  }, []);

  const [stats, setStats] = useState({
    totalFeesCollected: 0,
    totalStudents: 0,
    averageFeesPerStudent: 0,
    pendingVendorInvoices: 0,
    totalVendorInvoices: 0,
    totalRevenue: 0,
    totalPayments: 0,
    pendingPayments: 0,
    totalExpenses: 0,
    universityName: "",
    universityId: null,
  });

  const [chartData, setChartData] = useState({
    revenueByMonth: [],
    paymentStatus: [],
    feeCollection: [],
    expenseBreakdown: [],
  });

  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [error, setError] = useState(null);

  // Authentication check
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.role !== "accountant") {
      console.error('❌ Invalid user role:', user.role);
      toast.error("Access denied. Accountant role required.");
      navigate("/login");
      return;
    }
    // Load all transactions from database for accountant portal
    transactionStore.loadTransactions();
    loadAccountantData();

    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Enhanced data loading function with comprehensive error handling
  const loadAccountantData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 Loading Accountant Dashboard Data...');
      console.log('🔍 API URL:', API);
      console.log('🔍 Token Present:', !!token);

      // Validate API and token
      if (!API || !token) {
        console.error('❌ API URL or token missing');
        const errorMsg = 'API configuration error. Please check your connection.';
        setError(errorMsg);
        toast.error(errorMsg);
        setLoading(false);
        return;
      }

      // Create timeout controller for request cancellation
      const dashboardController = new AbortController();
      const dashboardTimeoutId = setTimeout(() => {
        dashboardController.abort();
        console.warn('⏰ Request timeout - aborting fetch');
        setError('Request timeout. Please check your connection.');
        toast.error('Request timeout. Please try again.');
      }, 10000); // 10 seconds

      // Main dashboard data fetch
      console.log('📊 Fetching dashboard data...');
      const res = await fetch(`${API}/accountant/dashboard`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: dashboardController.signal
      });

      // Clear timeout
      clearTimeout(dashboardTimeoutId);

      console.log('📡 Dashboard API Response Status:', res.status);
      console.log('📡 Dashboard API Response Headers:', Object.fromEntries(res.headers.entries()));

      if (!res.ok) {
        let errorText = 'Unknown error';
        try {
          errorText = await res.text();
          console.error('❌ Dashboard API Error:', res.status, errorText);

          // Enhanced error handling for different status codes
          if (res.status === 401) {
            const errorMsg = 'Session expired. Please login again.';
            setError(errorMsg);
            toast.error(errorMsg);
            setTimeout(() => navigate('/login'), 2000);
          } else if (res.status === 403) {
            const errorMsg = 'Access denied. Check your permissions.';
            setError(errorMsg);
            toast.error(errorMsg);
          } else if (res.status === 404) {
            const errorMsg = 'Dashboard endpoint not found.';
            setError(errorMsg);
            toast.error(errorMsg);
          } else if (res.status >= 500) {
            const errorMsg = 'Server error. Please try again later.';
            setError(errorMsg);
            toast.error(errorMsg);
          } else if (res.status === 0 || !navigator.onLine) {
            const errorMsg = 'Network error. Check your connection.';
            setError(errorMsg);
            toast.error(errorMsg);
          } else {
            const errorMsg = `Failed to load dashboard data: ${res.status}`;
            setError(errorMsg);
            toast.error(errorMsg);
          }
        } catch (textError) {
          console.error('❌ Error parsing error response:', textError);
          const errorMsg = 'Failed to parse server response.';
          setError(errorMsg);
          toast.error(errorMsg);
        }
        return;
      }

      const data = await res.json();
      console.log('📡 Dashboard API Response Data:', data);

      if (!data.success) {
        console.error('❌ Dashboard API returned success: false:', data.message);
        const errorMsg = data.message || 'Failed to load dashboard data.';
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      // Fee collection data fetch
      console.log('📊 Fetching fee stats...');
      const feesRes = await fetch(`${API}/accountant/fees-stats`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Fees API Response Status:', feesRes.status);

      let feesData = { totalFeesCollected: 0, totalStudents: 0, averageFeesPerStudent: 0 };
      if (feesRes.ok) {
        const feesResponse = await feesRes.json();
        console.log('📡 Fees API Response Data:', feesResponse);
        if (feesResponse.success) {
          feesData = feesResponse.data;
        } else {
          console.error('❌ Fees API returned success: false:', feesResponse.message);
        }
      } else {
        console.error('❌ Fees Network Error:', feesRes.status);
      }

      // Vendor invoices data fetch
      console.log('📋 Fetching vendor invoices...');
      
      // Create AbortController for timeout
      const invoicesController = new AbortController();
      const invoicesTimeoutId = setTimeout(() => invoicesController.abort(), 30000); // 30 second timeout
      
      const invoicesRes = await fetch(`${API}/accountant/vendor-invoices`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: invoicesController.signal
      });

      clearTimeout(invoicesTimeoutId);

      console.log('📡 Invoices API Response Status:', invoicesRes.status);

      let invoiceData = { totalVendorInvoices: 0, pendingVendorInvoices: 0 };
      if (invoicesRes.ok) {
        const invoicesResponse = await invoicesRes.json();
        console.log('📡 Invoices API Response Data:', invoicesResponse);
        if (invoicesResponse.success) {
          const invoices = invoicesResponse.data || [];
          invoiceData.totalVendorInvoices = invoices.length;
          invoiceData.pendingVendorInvoices = invoices.filter(inv => inv.status === 'pending').length;
        } else {
          console.error('❌ Invoices API returned success: false:', invoicesResponse.message);
        }
      } else {
        if (invoicesRes.status === 408) {
          console.error('❌ Invoices Request timeout');
        } else {
          console.error('❌ Invoices Network Error:', invoicesRes.status);
        }
      }

      // Update stats with comprehensive fallbacks
      setStats({
        totalFeesCollected: feesData.totalFeesCollected || 0,
        totalStudents: feesData.totalStudents || 0,
        averageFeesPerStudent: feesData.averageFeesPerStudent || 0,
        pendingVendorInvoices: invoiceData.pendingVendorInvoices,
        totalVendorInvoices: invoiceData.totalVendorInvoices,
        totalRevenue: data.totalRevenue || 0,
        totalPayments: data.totalPayments || 0,
        pendingPayments: data.pendingPayments || 0,
        totalExpenses: data.totalExpenses || 0,
        universityName: data.universityName || "University",
        universityId: data.universityId,
      });

      // Update chart data with comprehensive fallbacks
      setChartData({
        revenueByMonth: data.revenueByMonth || [
          { month: "Jan", revenue: 5000 },
          { month: "Feb", revenue: 7200 },
          { month: "Mar", revenue: 6800 },
          { month: "Apr", revenue: 8100 },
          { month: "May", revenue: 9500 },
          { month: "Jun", revenue: 10200 },
        ],
        paymentStatus: data.paymentStatus || [
          { name: "Paid", value: 65, color: "#10b981" },
          { name: "Pending", value: 25, color: "#f59e0b" },
          { name: "Failed", value: 10, color: "#ef4444" },
        ],
        feeCollection: data.feeCollection || [
          { grade: "Grade 1", collected: 25000, target: 30000 },
          { grade: "Grade 2", collected: 22000, target: 30000 },
          { grade: "Grade 3", collected: 28000, target: 30000 },
          { grade: "Grade 4", collected: 19000, target: 30000 },
        ],
        expenseBreakdown: data.expenseBreakdown || [
          { name: "Salaries", value: 40, color: "#3b82f6" },
          { name: "Utilities", value: 20, color: "#8b5cf6" },
          { name: "Materials", value: 25, color: "#ec4899" },
          { name: "Other", value: 15, color: "#14b8a6" },
        ],
      });

      console.log('✅ Accountant data loaded successfully');
      toast.success('Dashboard data loaded successfully');
      setError(null);

    } catch (error) {
      console.error('❌ Error loading accountant data:', error);
      const errorMsg = 'Failed to load dashboard data. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Utility functions
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const downloadReport = () => {
    toast.success("📥 Downloading financial report...");
    // TODO: Implement PDF generation
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Enhanced loading state with better UX
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-16 w-16 border-4 border-emerald-500 border-t-transparent rounded-full mb-4"></div>
          <div className="text-emerald-200 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Loading Accountant Dashboard</h2>
            <p className="text-emerald-300">Please wait while we fetch your data...</p>
            <div className="mt-4 p-4 bg-emerald-800/50 rounded-lg border border-emerald-700">
              <p className="text-sm text-emerald-300 mb-2">🔍 Connection Status</p>
              <p className="text-emerald-400 font-medium">
                {!API || !token ? '⚠️ API Configuration Error' : '🔄 Connecting to server...'}
              </p>
              {error && (
                <div className="mt-2 p-2 bg-red-900/50 rounded border border-red-700">
                  <p className="text-sm text-red-300 mb-1">❌ Error Detected</p>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AccountantLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">💰 Accountant Dashboard</h1>
            <p className="text-emerald-200">
              {stats.universityName} • Welcome {user.name}
            </p>
          </div>
          <button
            onClick={loadAccountantData}
            className="bg-emerald-600 hover:bg-emerald-700 px-6 py-2 rounded-lg font-bold transition flex items-center gap-2"
          >
            <RefreshCw size={20} />
            Refresh
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-7xl mx-auto p-4 bg-red-900/50 rounded-lg border border-red-700">
            <div className="flex items-center gap-3">
              <div className="text-red-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l-4-4m0 0-4m0 0-8m0 0-12 0-12" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-300 mb-1">Connection Error</h3>
                <p className="text-red-400">{error}</p>
                <button
                  onClick={loadAccountantData}
                  className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Fee Collection Stats */}
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <DollarSign size={24} />
              <span className="text-sm bg-white/20 px-2 py-1 rounded">Fees</span>
            </div>
            <h3 className="text-2xl font-bold mb-1">₹{stats.totalFeesCollected.toLocaleString('en-IN')}</h3>
            <p className="text-green-100">Total Fees Collected</p>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <Users size={24} />
              <span className="text-sm bg-white/20 px-2 py-1 rounded">Students</span>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stats.totalStudents}</h3>
            <p className="text-blue-100">Total Students</p>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp size={24} />
              <span className="text-sm bg-white/20 px-2 py-1 rounded">Average</span>
            </div>
            <h3 className="text-2xl font-bold mb-1">₹{stats.averageFeesPerStudent.toLocaleString('en-IN')}</h3>
            <p className="text-purple-100">Average Fees Per Student</p>
          </div>

          {/* Vendor Invoice Stats */}
          <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 text-white shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <FileText size={24} />
              <span className="text-sm bg-white/20 px-2 py-1 rounded">Pending</span>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stats.pendingVendorInvoices}</h3>
            <p className="text-orange-100">Pending Vendor Invoices</p>
          </div>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-emerald-500/30">
            <div className="flex items-center justify-between mb-4">
              <FileText className="text-emerald-400" size={24} />
              <span className="text-emerald-400 text-sm">Total</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">{stats.totalVendorInvoices}</h3>
            <p className="text-emerald-200">Total Vendor Invoices</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-blue-500/30">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="text-blue-400" size={24} />
              <span className="text-blue-400 text-sm">Revenue</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">₹{stats.totalRevenue.toLocaleString('en-IN')}</h3>
            <p className="text-blue-200">Total Revenue</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-red-500/30">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="text-red-400" size={24} />
              <span className="text-red-400 text-sm">Expenses</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">₹{stats.totalExpenses.toLocaleString('en-IN')}</h3>
            <p className="text-red-200">Total Expenses</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-emerald-500/30">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FileText size={20} className="text-emerald-400" />
              Vendor Invoices
            </h3>
            <p className="text-emerald-200 mb-4">
              {stats.pendingVendorInvoices} pending invoices awaiting payment
            </p>
            <button
              onClick={() => navigate('/accountant/vendor-invoices')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition"
            >
              Manage Vendor Invoices
            </button>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-blue-500/30">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <DollarSign size={20} className="text-blue-400" />
              Fee Collection
            </h3>
            <p className="text-blue-200 mb-4">
              Track student fee payments and collections
            </p>
            <button
              onClick={() => navigate('/accountant/fees')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              View Fee Collection
            </button>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fee Collection Chart */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-emerald-500/30">
            <h3 className="text-xl font-bold text-white mb-4">Fee Collection by Grade</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.feeCollection}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="grade" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#F3F4F6' }}
                />
                <Legend />
                <Bar dataKey="collected" fill="#10B981" name="Collected" />
                <Bar dataKey="target" fill="#6B7280" name="Target" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Payment Status Chart */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-blue-500/30">
            <h3 className="text-xl font-bold text-white mb-4">Payment Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.paymentStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.paymentStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer with Time Display */}
        <div className="max-w-7xl mx-auto mt-8 flex justify-between items-center text-emerald-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={20} />
              <span className="text-sm">{formatDate(currentTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={20} />
              <span className="text-sm">{formatTime(currentTime)}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <User size={20} />
            <span className="text-sm">{user.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <Building size={20} />
            <span className="text-sm">{stats.universityName}</span>
          </div>
        </div>
      </div>
    </AccountantLayout>
  );
};

export default AccountantDashboard;
