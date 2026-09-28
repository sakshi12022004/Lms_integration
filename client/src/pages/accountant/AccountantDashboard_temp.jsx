import React, { useState, useEffect } from 'react';
import { useAuth } from "../../auth/auth";
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
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
  Target,
  TrendingDown
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
import AccountantLayout from "../../components/AccountantLayout";

const AccountantDashboard = () => {
  const { token, API } = useAuth();
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
    recentTransactions: [],
    feeCollectionData: [],
    expenseData: [],
    monthlyRevenueData: [],
    monthlyExpenseData: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch vendor invoices data
      const invoicesRes = await fetch(`${API}/accountant/vendor-invoices`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        if (invoicesData.success) {
          const invoices = invoicesData.data || [];
          const pendingCount = invoices.filter(inv => inv.status === 'pending').length;
          const totalCount = invoices.length;
          const paidInvoices = invoices.filter(inv => inv.status === 'paid');
          const totalPaidAmount = paidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
          
          // Group paid invoices by month for expense data
          const monthlyExpenseData = paidInvoices.reduce((acc, invoice) => {
            if (invoice.paidDate) {
              const date = new Date(invoice.paidDate);
              const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
              if (!acc[monthYear]) {
                acc[monthYear] = 0;
              }
              acc[monthYear] += invoice.amount || 0;
            }
            return acc;
          }, {});

          // Convert to array format for charts
          const monthlyExpenseArray = Object.entries(monthlyExpenseData).map(([month, amount]) => ({
            name: month,
            expenses: amount
          })).sort((a, b) => new Date(a.name) - new Date(b.name));
          
          setStats(prev => ({
            ...prev,
            pendingVendorInvoices: pendingCount,
            totalVendorInvoices: totalCount,
            totalExpenses: totalPaidAmount,
            monthlyExpenseData: monthlyExpenseArray
          }));
        }
      }

      // Fetch fees stats
      const feesRes = await fetch(`${API}/accountant/fees-stats`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (feesRes.ok) {
        const feesData = await feesRes.json();
        if (feesData.success) {
          const totalFees = feesData.data?.totalFeesCollected || 0;
          
          // Use the same fees data for monthly revenue calculation
          let monthlyRevenueArray = [];
          if (feesData.success && feesData.data?.recentPayments) {
            const payments = feesData.data.recentPayments;
            
            // Group payments by month for revenue data
            const monthlyRevenueData = payments.reduce((acc, payment) => {
              if (payment.paymentDate) {
                const date = new Date(payment.paymentDate);
                const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                if (!acc[monthYear]) {
                  acc[monthYear] = 0;
                }
                acc[monthYear] += payment.amount || 0;
              }
              return acc;
            }, {});

            // Convert to array format for charts
            monthlyRevenueArray = Object.entries(monthlyRevenueData).map(([month, amount]) => ({
              name: month,
              revenue: amount
            })).sort((a, b) => new Date(a.name) - new Date(b.name));
          }
          
          setStats(prev => ({
            ...prev,
            totalFeesCollected: totalFees,
            totalStudents: feesData.data?.totalStudents || 0,
            averageFeesPerStudent: feesData.data?.averageFeesPerStudent || 0,
            totalRevenue: totalFees,
            monthlyRevenueData: monthlyRevenueArray
          }));
        }
      }

    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-white text-lg mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AccountantLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Accountant Dashboard</h1>
            <p className="text-gray-400">Manage finances, invoices, and payments</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="h-8 w-8" />
                <span className="text-2xl font-bold">₹{stats.totalFeesCollected.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-blue-100">Total Fees Collected</p>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <FileText className="h-8 w-8" />
                <span className="text-2xl font-bold">{stats.pendingVendorInvoices}</span>
              </div>
              <p className="text-purple-100">Pending Invoices</p>
            </div>

            <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <TrendingDown className="h-8 w-8" />
                <span className="text-2xl font-bold">₹{stats.totalExpenses.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-red-100">Total Expenses</p>
            </div>
          </div>

          {/* Financial Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Revenue Overview</h2>
              <div className="h-64 flex items-center justify-center">
                {stats.monthlyRevenueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={stats.monthlyRevenueData}
                      margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                        labelStyle={{ color: '#F3F4F6' }}
                        formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#10B981" 
                        strokeWidth={2}
                        dot={{ fill: '#10B981', r: 4 }}
                        name="Revenue (₹)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No revenue data available</p>
                    <p className="text-gray-500 text-sm">Revenue will appear here once payments are recorded</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Expense Analysis</h2>
              <div className="h-64 flex items-center justify-center">
                {stats.monthlyExpenseData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthlyExpenseData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                        labelStyle={{ color: '#F3F4F6' }}
                        formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Expenses']}
                      />
                      <Legend />
                      <Bar 
                        dataKey="expenses" 
                        fill="#EF4444" 
                        name="Expenses (₹)"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center">
                    <TrendingDown className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No expense data available</p>
                    <p className="text-gray-500 text-sm">Expenses will appear here once invoices are paid</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AccountantLayout>
  );
};

export default AccountantDashboard;
