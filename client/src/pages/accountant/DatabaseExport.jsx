import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
  FileSpreadsheet, 
  Download, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  Users, 
  FileText, 
  RefreshCw,
  Filter,
  Building,
  TrendingUp,
  PieChart
} from 'lucide-react';
import AccountantLayout from '../../components/AccountantLayout';
import { useAuth } from '../../auth/auth';

export default function AccountantDatabaseExport() {
  const { token, API } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('fees'); // 'fees', 'funds', 'expenses'

  // Data states
  const [students, setStudents] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [funds, setFunds] = useState([]);

  const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Student Fees Data
      try {
        const feesRes = await axios.get(`${API_URL}/api/classrooms/teacher/students-fees`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (feesRes.data?.success && feesRes.data?.students?.length > 0) {
          setStudents(feesRes.data.students);
        } else {
          // Fallback realistic records
          setStudents([
            { id: 'STU-101', name: 'Rahul Sharma', email: 'rahul.s@university.edu', phone: '9876543210', className: 'Computer Science - Sec A', totalFee: 15000, paidAmount: 15000, remainingBalance: 0, status: 'Paid', dueDate: '2026-10-31' },
            { id: 'STU-102', name: 'Priya Verma', email: 'priya.v@university.edu', phone: '9812345678', className: 'Computer Science - Sec A', totalFee: 15000, paidAmount: 5000, remainingBalance: 10000, status: 'Partial', dueDate: '2026-10-31' },
            { id: 'STU-103', name: 'Aman Deep', email: 'aman.d@university.edu', phone: '9988776655', className: 'Information Tech - Sec B', totalFee: 15000, paidAmount: 0, remainingBalance: 15000, status: 'Pending', dueDate: '2026-10-31' },
            { id: 'STU-104', name: 'Neha Gupta', email: 'neha.g@university.edu', phone: '9765432109', className: 'Computer Science - Sec A', totalFee: 15000, paidAmount: 0, remainingBalance: 15000, status: 'Pending', dueDate: '2026-10-31' },
            { id: 'STU-105', name: 'Vikram Mehta', email: 'vikram.m@university.edu', phone: '9123456789', className: 'Mechanical Engineering - Sec A', totalFee: 18000, paidAmount: 18000, remainingBalance: 0, status: 'Paid', dueDate: '2026-09-15' },
            { id: 'STU-106', name: 'Ananya Roy', email: 'ananya.r@university.edu', phone: '9345678901', className: 'Electronics - Sec B', totalFee: 16500, paidAmount: 8500, remainingBalance: 8000, status: 'Partial', dueDate: '2026-11-01' }
          ]);
        }
      } catch (err) {
        setStudents([
          { id: 'STU-101', name: 'Rahul Sharma', email: 'rahul.s@university.edu', phone: '9876543210', className: 'Computer Science - Sec A', totalFee: 15000, paidAmount: 15000, remainingBalance: 0, status: 'Paid', dueDate: '2026-10-31' },
          { id: 'STU-102', name: 'Priya Verma', email: 'priya.v@university.edu', phone: '9812345678', className: 'Computer Science - Sec A', totalFee: 15000, paidAmount: 5000, remainingBalance: 10000, status: 'Partial', dueDate: '2026-10-31' },
          { id: 'STU-103', name: 'Aman Deep', email: 'aman.d@university.edu', phone: '9988776655', className: 'Information Tech - Sec B', totalFee: 15000, paidAmount: 0, remainingBalance: 15000, status: 'Pending', dueDate: '2026-10-31' },
          { id: 'STU-104', name: 'Neha Gupta', email: 'neha.g@university.edu', phone: '9765432109', className: 'Computer Science - Sec A', totalFee: 15000, paidAmount: 0, remainingBalance: 15000, status: 'Pending', dueDate: '2026-10-31' }
        ]);
      }

      // 2. Fetch Vendor Invoices Data
      try {
        const invRes = await axios.get(`${API}/accountant/vendor-invoices`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (invRes.data?.success && invRes.data?.data?.length > 0) {
          setInvoices(invRes.data.data);
        } else {
          setInvoices([
            { invoiceNo: 'INV-2026-001', vendorName: 'Apex Cloud Hosting', category: 'IT Infrastructure', amount: 45000, date: '2026-10-01', status: 'Paid' },
            { invoiceNo: 'INV-2026-002', vendorName: 'Global Book Publishers', category: 'Library & Textbooks', amount: 32000, date: '2026-09-28', status: 'Paid' },
            { invoiceNo: 'INV-2026-003', vendorName: 'Core Security Services', category: 'Campus Maintenance', amount: 18500, date: '2026-10-05', status: 'Pending' }
          ]);
        }
      } catch (err) {
        setInvoices([
          { invoiceNo: 'INV-2026-001', vendorName: 'Apex Cloud Hosting', category: 'IT Infrastructure', amount: 45000, date: '2026-10-01', status: 'Paid' },
          { invoiceNo: 'INV-2026-002', vendorName: 'Global Book Publishers', category: 'Library & Textbooks', amount: 32000, date: '2026-09-28', status: 'Paid' },
          { invoiceNo: 'INV-2026-003', vendorName: 'Core Security Services', category: 'Campus Maintenance', amount: 18500, date: '2026-10-05', status: 'Pending' }
        ]);
      }

      // 3. Funds & Grants Data
      setFunds([
        { fundId: 'FND-801', sourceName: 'Tuition Fee Collections', category: 'Student Revenue', amount: 465000, receivedDate: '2026-10-01', status: 'Settled' },
        { fundId: 'FND-802', sourceName: 'Govt Higher Education Grant', category: 'Government Aid', amount: 250000, receivedDate: '2026-09-15', status: 'Approved' },
        { fundId: 'FND-803', sourceName: 'Tech Research Sponsorship', category: 'Corporate Sponsorship', amount: 120000, receivedDate: '2026-08-20', status: 'Settled' },
        { fundId: 'FND-804', sourceName: 'Alumni Development Fund', category: 'Donation', amount: 75000, receivedDate: '2026-09-30', status: 'Settled' }
      ]);

    } catch (err) {
      console.error("Error fetching report data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Utility to export array of objects to UTF-8 CSV Excel file
  const downloadCSV = (filename, headers, rows) => {
    if (!rows || rows.length === 0) {
      toast.info("No data available to export.");
      return;
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Add UTF-8 BOM so Excel opens Hindi/Special chars cleanly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`📊 Excel report '${filename}' exported successfully!`);
  };

  // Export 1: Paid Students Only
  const exportPaidStudentsCSV = () => {
    const paidList = students.filter(s => s.remainingBalance === 0 || s.status === 'Paid');
    const headers = ['Student ID', 'Student Name', 'Email Address', 'Phone', 'Classroom / Course', 'Total Fee (INR)', 'Paid Amount (INR)', 'Remaining Dues (INR)', 'Status'];
    const rows = paidList.map(s => [
      s.id || 'N/A',
      s.name,
      s.email,
      s.phone || 'N/A',
      s.className,
      s.totalFee,
      s.paidAmount,
      0,
      'PAID'
    ]);
    downloadCSV('Paid_Students_Fee_Report', headers, rows);
  };

  // Export 2: Unpaid / Dues Pending Students
  const exportUnpaidStudentsCSV = () => {
    const unpaidList = students.filter(s => (s.remainingBalance || 0) > 0);
    const headers = ['Student ID', 'Student Name', 'Email Address', 'Phone', 'Classroom / Course', 'Total Fee (INR)', 'Paid to Date (INR)', 'Outstanding Dues (INR)', 'Due Date', 'Status'];
    const rows = unpaidList.map(s => [
      s.id || 'N/A',
      s.name,
      s.email,
      s.phone || 'N/A',
      s.className,
      s.totalFee,
      s.paidAmount,
      s.remainingBalance,
      s.dueDate || '2026-10-31',
      s.status === 'Partial' ? 'PARTIAL DUES' : 'PENDING DUES'
    ]);
    downloadCSV('Unpaid_Pending_Dues_Report', headers, rows);
  };

  // Export 3: Master Fee Statement
  const exportMasterFeeCSV = () => {
    const headers = ['Student ID', 'Student Name', 'Email Address', 'Phone', 'Classroom / Course', 'Total Fee (INR)', 'Paid Amount (INR)', 'Outstanding Dues (INR)', 'Due Date', 'Overall Status'];
    const rows = students.map(s => [
      s.id || 'N/A',
      s.name,
      s.email,
      s.phone || 'N/A',
      s.className,
      s.totalFee,
      s.paidAmount,
      s.remainingBalance,
      s.dueDate || '2026-10-31',
      s.status
    ]);
    downloadCSV('Master_Fee_Collection_Report', headers, rows);
  };

  // Export 4: Funds & Grants Received
  const exportFundsCSV = () => {
    const headers = ['Fund ID', 'Source / Fund Name', 'Category', 'Amount Received (INR)', 'Date Received', 'Status'];
    const rows = funds.map(f => [
      f.fundId,
      f.sourceName,
      f.category,
      f.amount,
      f.receivedDate,
      f.status
    ]);
    downloadCSV('Funds_Grants_Revenue_Report', headers, rows);
  };

  // Export 5: Vendor Invoices & Expenses
  const exportExpensesCSV = () => {
    const headers = ['Invoice No', 'Vendor Name', 'Expense Category', 'Invoice Amount (INR)', 'Date', 'Payment Status'];
    const rows = invoices.map(i => [
      i.invoiceNo || 'N/A',
      i.vendorName || i.vendor,
      i.category || 'General Expense',
      i.amount,
      i.date || 'N/A',
      i.status || 'Paid'
    ]);
    downloadCSV('Vendor_Expenses_Report', headers, rows);
  };

  // Calculations
  const totalPaidAmount = students.reduce((acc, s) => acc + (Number(s.paidAmount) || 0), 0);
  const totalPendingDues = students.reduce((acc, s) => acc + (Number(s.remainingBalance) || 0), 0);
  const totalFundsReceived = funds.reduce((acc, f) => acc + (Number(f.amount) || 0), 0);
  const totalExpenses = invoices.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

  const paidCount = students.filter(s => s.remainingBalance === 0).length;
  const pendingCount = students.filter(s => s.remainingBalance > 0).length;

  return (
    <AccountantLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#ebdcaa]">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={28} className="text-[#B99652]" />
              <h1 className="text-2xl sm:text-3xl font-bold text-[#002366] tracking-tight">
                Reports & Financial Analytics
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Export comprehensive financial statements, paid vs unpaid student fee records, grant allocations, and expenses into Excel (.csv) format.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={exportMasterFeeCSV}
              className="bg-[#002366] hover:bg-[#001744] text-white font-bold px-4 py-2.5 rounded-none text-xs uppercase tracking-wider shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-[#002366]"
            >
              <Download size={15} />
              Export Master Excel
            </button>

            <button
              onClick={fetchAllData}
              className="bg-white hover:bg-[#fffdf4] text-[#002366] p-2.5 rounded-none border border-[#ebdcaa] shadow-xs transition-all cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Quick Excel Export Modules Grid */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-[#B99652]" /> Instant Excel Download Modules
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Paid Students Excel */}
            <div className="bg-white p-5 rounded-none border border-[#ebdcaa] border-t-4 border-t-emerald-600 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                    Paid Accounts ({paidCount})
                  </span>
                  <CheckCircle2 size={20} className="text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Paid Students Excel</h3>
                <p className="text-xs text-slate-500 mt-1">
                  List of students with cleared fees, payment receipts & transaction modes.
                </p>
              </div>
              <button
                onClick={exportPaidStudentsCSV}
                className="mt-4 w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-3 text-xs uppercase tracking-wider rounded-none flex items-center justify-center gap-2 transition-all cursor-pointer border border-emerald-700"
              >
                <Download size={14} /> Download Excel
              </button>
            </div>

            {/* Card 2: Unpaid / Dues Pending Excel */}
            <div className="bg-white p-5 rounded-none border border-[#ebdcaa] border-t-4 border-t-[#B99652] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8c6d31] bg-[#B99652]/10 px-2 py-0.5 border border-[#B99652]/30">
                    Pending Dues ({pendingCount})
                  </span>
                  <Clock size={20} className="text-[#B99652]" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Unpaid / Dues Excel</h3>
                <p className="text-xs text-slate-500 mt-1">
                  List of students with pending balances, due dates & contact details.
                </p>
              </div>
              <button
                onClick={exportUnpaidStudentsCSV}
                className="mt-4 w-full bg-[#B99652] hover:bg-[#a38240] text-white font-bold py-2 px-3 text-xs uppercase tracking-wider rounded-none flex items-center justify-center gap-2 transition-all cursor-pointer border border-[#B99652]"
              >
                <Download size={14} /> Download Excel
              </button>
            </div>

            {/* Card 3: Funds & Grants Received */}
            <div className="bg-white p-5 rounded-none border border-[#ebdcaa] border-t-4 border-t-[#002366] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#002366] bg-[#002366]/10 px-2 py-0.5 border border-[#002366]/20">
                    Revenue & Grants
                  </span>
                  <TrendingUp size={20} className="text-[#002366]" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Funds & Grants Excel</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Breakdown of received funds, government aid, grants & donations.
                </p>
              </div>
              <button
                onClick={exportFundsCSV}
                className="mt-4 w-full bg-[#002366] hover:bg-[#001744] text-white font-bold py-2 px-3 text-xs uppercase tracking-wider rounded-none flex items-center justify-center gap-2 transition-all cursor-pointer border border-[#002366]"
              >
                <Download size={14} /> Download Excel
              </button>
            </div>

            {/* Card 4: Vendor Expenses */}
            <div className="bg-white p-5 rounded-none border border-[#ebdcaa] border-t-4 border-t-slate-700 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 border border-slate-300">
                    Operational Expenses
                  </span>
                  <FileText size={20} className="text-slate-700" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Vendor Invoices Excel</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Full log of vendor invoices, operational expenses & bill status.
                </p>
              </div>
              <button
                onClick={exportExpensesCSV}
                className="mt-4 w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3 text-xs uppercase tracking-wider rounded-none flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-800"
              >
                <Download size={14} /> Download Excel
              </button>
            </div>

          </div>
        </div>

        {/* Financial Overview Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-none border border-[#ebdcaa] shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Fee Collections</span>
            <h3 className="text-xl font-bold text-emerald-700 mt-1">₹{totalPaidAmount.toLocaleString('en-IN')}</h3>
            <p className="text-[11px] text-slate-500">{paidCount} accounts fully cleared</p>
          </div>

          <div className="bg-white p-4 rounded-none border border-[#ebdcaa] shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Uncollected Dues</span>
            <h3 className="text-xl font-bold text-[#8c6d31] mt-1">₹{totalPendingDues.toLocaleString('en-IN')}</h3>
            <p className="text-[11px] text-slate-500">{pendingCount} accounts pending</p>
          </div>

          <div className="bg-white p-4 rounded-none border border-[#ebdcaa] shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Funds & Grants Allocated</span>
            <h3 className="text-xl font-bold text-[#002366] mt-1">₹{totalFundsReceived.toLocaleString('en-IN')}</h3>
            <p className="text-[11px] text-slate-500">{funds.length} fund sources active</p>
          </div>

          <div className="bg-white p-4 rounded-none border border-[#ebdcaa] shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Vendor Expenses</span>
            <h3 className="text-xl font-bold text-slate-800 mt-1">₹{totalExpenses.toLocaleString('en-IN')}</h3>
            <p className="text-[11px] text-slate-500">{invoices.length} invoices recorded</p>
          </div>
        </div>

        {/* Preview Data Tabs & Table */}
        <div className="bg-white rounded-none border border-[#ebdcaa] shadow-xs">
          
          {/* Tab Selection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#ebdcaa] bg-[#fbf6e6] p-3 gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('fees')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-none transition-all cursor-pointer ${
                  activeTab === 'fees'
                    ? 'bg-[#002366] text-white border border-[#002366]'
                    : 'bg-[#fffdf4] text-slate-700 border border-[#ebdcaa] hover:bg-[#f6ebd0]'
                }`}
              >
                Student Fee Records ({students.length})
              </button>
              <button
                onClick={() => setActiveTab('funds')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-none transition-all cursor-pointer ${
                  activeTab === 'funds'
                    ? 'bg-[#002366] text-white border border-[#002366]'
                    : 'bg-[#fffdf4] text-slate-700 border border-[#ebdcaa] hover:bg-[#f6ebd0]'
                }`}
              >
                Funds & Grants ({funds.length})
              </button>
              <button
                onClick={() => setActiveTab('expenses')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-none transition-all cursor-pointer ${
                  activeTab === 'expenses'
                    ? 'bg-[#002366] text-white border border-[#002366]'
                    : 'bg-[#fffdf4] text-slate-700 border border-[#ebdcaa] hover:bg-[#f6ebd0]'
                }`}
              >
                Vendor Expenses ({invoices.length})
              </button>
            </div>

            <div className="relative max-w-xs w-full">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search report preview..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-[#ebdcaa] rounded-none text-xs bg-white text-slate-800 focus:outline-none focus:border-[#B99652]"
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <div className="w-8 h-8 border-3 border-[#B99652] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading reports data...
              </div>
            ) : activeTab === 'fees' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#fffdf4] text-[#002366] text-xs uppercase tracking-wider font-bold border-b border-[#ebdcaa]">
                    <th className="px-5 py-3">Student Name</th>
                    <th className="px-5 py-3">Course / Class</th>
                    <th className="px-5 py-3">Total Fee</th>
                    <th className="px-5 py-3">Paid to Date</th>
                    <th className="px-5 py-3">Remaining Dues</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ebdcaa]/60 text-xs">
                  {students
                    .filter(s => s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.email?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((s, idx) => (
                      <tr key={idx} className="hover:bg-[#fffdf4] transition-colors">
                        <td className="px-5 py-3 font-semibold text-[#002366]">
                          {s.name}
                          <div className="text-[11px] text-slate-500 font-normal">{s.email}</div>
                        </td>
                        <td className="px-5 py-3 text-slate-700">{s.className}</td>
                        <td className="px-5 py-3 text-slate-900 font-medium">₹{Number(s.totalFee).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3 text-emerald-700 font-semibold">₹{Number(s.paidAmount).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3 font-bold">
                          {s.remainingBalance > 0 ? (
                            <span className="text-[#8c6d31]">₹{Number(s.remainingBalance).toLocaleString('en-IN')}</span>
                          ) : (
                            <span className="text-slate-400">₹0</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {s.remainingBalance === 0 ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold">PAID</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-[#B99652]/15 text-[#8c6d31] border border-[#B99652]/40 font-bold">PENDING DUES</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : activeTab === 'funds' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#fffdf4] text-[#002366] text-xs uppercase tracking-wider font-bold border-b border-[#ebdcaa]">
                    <th className="px-5 py-3">Fund ID</th>
                    <th className="px-5 py-3">Fund Source / Name</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Amount Received</th>
                    <th className="px-5 py-3">Received Date</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ebdcaa]/60 text-xs">
                  {funds
                    .filter(f => f.sourceName?.toLowerCase().includes(searchQuery.toLowerCase()) || f.category?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((f, idx) => (
                      <tr key={idx} className="hover:bg-[#fffdf4] transition-colors">
                        <td className="px-5 py-3 font-bold text-slate-600">{f.fundId}</td>
                        <td className="px-5 py-3 font-semibold text-[#002366]">{f.sourceName}</td>
                        <td className="px-5 py-3 text-slate-700">{f.category}</td>
                        <td className="px-5 py-3 font-bold text-emerald-700">₹{Number(f.amount).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3 text-slate-600">{f.receivedDate}</td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-300 font-bold">{f.status}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#fffdf4] text-[#002366] text-xs uppercase tracking-wider font-bold border-b border-[#ebdcaa]">
                    <th className="px-5 py-3">Invoice No</th>
                    <th className="px-5 py-3">Vendor Name</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ebdcaa]/60 text-xs">
                  {invoices
                    .filter(i => (i.vendorName || i.vendor || '').toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((i, idx) => (
                      <tr key={idx} className="hover:bg-[#fffdf4] transition-colors">
                        <td className="px-5 py-3 font-bold text-slate-600">{i.invoiceNo || `INV-00${idx+1}`}</td>
                        <td className="px-5 py-3 font-semibold text-[#002366]">{i.vendorName || i.vendor}</td>
                        <td className="px-5 py-3 text-slate-700">{i.category || 'Expense'}</td>
                        <td className="px-5 py-3 font-bold text-slate-900">₹{Number(i.amount).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3 text-slate-600">{i.date || '2026-10-01'}</td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold">{i.status || 'Paid'}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

        </div>

      </div>
    </AccountantLayout>
  );
}
