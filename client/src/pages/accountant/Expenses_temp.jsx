import React, { useState, useEffect } from 'react';
import { useAuth } from "../../auth/auth";
import AccountantLayout from "../../components/AccountantLayout";
import { TrendingDown, FileText, Calendar, DollarSign, CheckCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";

const Expenses = () => {
  const { token, API } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/accountant/vendor-invoices`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setInvoices(data.data || []);
        } else {
          setError('Failed to fetch invoices');
        }
      } else {
        setError('Failed to fetch invoices');
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'pending':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'overdue':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return <CheckCircle size={16} />;
      case 'pending':
        return <Clock size={16} />;
      case 'overdue':
        return <AlertCircle size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  const totalExpenses = invoices.reduce((sum, invoice) => {
    return invoice.status === 'paid' ? sum + (invoice.amount || 0) : sum;
  }, 0);

  const pendingExpenses = invoices.reduce((sum, invoice) => {
    return invoice.status === 'pending' ? sum + (invoice.amount || 0) : sum;
  }, 0);

  if (loading) {
    return (
      <AccountantLayout>
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">💰 Expenses</h2>
            <p className="text-gray-400">Track all school and institutional expenses</p>
          </div>
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </AccountantLayout>
    );
  }

  if (error) {
    return (
      <AccountantLayout>
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">💰 Expenses</h2>
            <p className="text-gray-400">Track all school and institutional expenses</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-400">{error}</p>
            <button
              onClick={fetchInvoices}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </AccountantLayout>
    );
  }

  return (
    <AccountantLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">💰 Expenses</h2>
            <p className="text-gray-400">Track all school and institutional expenses</p>
          </div>
          <button
            onClick={fetchInvoices}
            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
          >
            <RefreshCw size={20} />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <TrendingDown className="h-8 w-8" />
              <span className="text-2xl font-bold">₹{totalExpenses.toLocaleString('en-IN')}</span>
            </div>
            <p className="text-red-100">Total Expenses</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <Clock className="h-8 w-8" />
              <span className="text-2xl font-bold">₹{pendingExpenses.toLocaleString('en-IN')}</span>
            </div>
            <p className="text-yellow-100">Pending Expenses</p>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <FileText className="h-8 w-8" />
              <span className="text-2xl font-bold">{invoices.length}</span>
            </div>
            <p className="text-blue-100">Total Invoices</p>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl">
          <div className="p-6 border-b border-slate-700/50">
            <h3 className="text-xl font-semibold text-white">All Invoices</h3>
          </div>
          
          {invoices.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={64} className="mx-auto text-gray-600 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">No Invoices Found</h3>
              <p className="text-gray-400">No invoices have been created yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left p-4 text-gray-400 font-medium">Invoice #</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Vendor</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Amount</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Due Date</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <FileText size={16} className="text-gray-400" />
                          <span className="text-white font-medium">{invoice.invoiceNumber}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="text-white">{invoice.vendorName}</p>
                          <p className="text-gray-400 text-sm">{invoice.description}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-white font-semibold">₹{invoice.amount.toLocaleString('en-IN')}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <Calendar size={16} className="text-gray-400" />
                          <span className="text-white">{new Date(invoice.dueDate).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(invoice.status)}`}>
                          {getStatusIcon(invoice.status)}
                          <span className="uppercase">{invoice.status}</span>
                        </span>
                      </td>
                      <td className="p-4">
                        {invoice.paidDate ? (
                          <div className="flex items-center space-x-2">
                            <CheckCircle size={16} className="text-green-500" />
                            <span className="text-white">{new Date(invoice.paidDate).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AccountantLayout>
  );
};

export default Expenses;
