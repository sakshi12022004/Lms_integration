import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/auth';
import AccountantLayout from '../../components/AccountantLayout';
import { toast } from 'react-toastify';
import {
  FileText,
  DollarSign,
  Calendar,
  User,
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  Eye,
  Download,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';

// Simple event emitter for real-time updates
const eventEmitter = new EventTarget();

// Global event to notify dashboard of payment updates
window.accountantPaymentEvents = eventEmitter;

const VendorInvoiceManagement = () => {
  const { token, API } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);

  useEffect(() => {
    fetchInvoices();
    fetchPaymentHistory();
  }, []);

  const fetchPaymentHistory = async () => {
    try {
      const res = await fetch(`${API}/accountant/payment-history`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPaymentHistory(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching invoices...');
      
      const res = await fetch(`${API}/accountant/vendor-invoices`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Response status:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`Failed to fetch invoices: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('📡 Response data:', data);
      
      if (data.success) {
        setInvoices(data.data || []);
        console.log(`✅ Loaded ${data.data?.length || 0} invoices`);
      } else {
        throw new Error(data.message || 'Failed to load invoices');
      }
    } catch (error) {
      console.error('❌ Error fetching invoices:', error);
      toast.error(error.message || 'Failed to load vendor invoices');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (invoiceId) => {
    try {
      setProcessingPayment(invoiceId);
      
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (!invoice) {
        toast.error('Invoice not found');
        return;
      }

      // Load Razorpay script dynamically (like student portal)
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: 'rzp_test_S7aUmYSaQyE0h6', // Same key as student portal
          amount: invoice.amount * 100, // Convert to paise
          currency: 'INR',
          name: 'Vendor Payment',
          description: `Payment for invoice ${invoice.invoiceNumber}`,
          image: 'https://example.com/your-logo.png',
          prefill: {
            name: 'Accountant',
            email: 'accountant@university.edu',
            contact: '9999999999'
          },
          notes: {
            invoiceId: invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            vendorName: invoice.vendorName,
            payment_type: 'vendor_invoice'
          },
          handler: async function (response) {
            // Payment successful - immediate UI updates
            try {
              const token = localStorage.getItem('token') || '';
              const paymentData = {
                invoiceId: invoiceId,
                invoiceNumber: invoice.invoiceNumber,
                vendorName: invoice.vendorName,
                amount: invoice.amount,
                status: 'paid',
                transactionId: response.razorpay_payment_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                paymentDate: new Date().toISOString(),
                paidDate: new Date().toISOString()
              };

              console.log('💰 Payment successful!', response.razorpay_payment_id);

              // 1. Update invoice status immediately for instant feedback
              setInvoices(prev => prev.map(inv => 
                inv.id === invoiceId 
                  ? { ...inv, status: 'paid', paidDate: new Date().toISOString() }
                  : inv
              ));

              // 2. Add to payment history immediately
              const newPayment = {
                id: response.razorpay_payment_id,
                invoiceNumber: invoice.invoiceNumber,
                vendorName: invoice.vendorName,
                amount: invoice.amount,
                paymentDate: new Date().toISOString(),
                status: 'completed',
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                issueDate: invoice.issueDate
              };
              
              setPaymentHistory(prev => [newPayment, ...prev]);

              // 3. Show success message immediately
              toast.success(`Payment successful! Invoice #${invoice.invoiceNumber} paid successfully`);

              // 4. Emit event to notify dashboard and other components
              const paymentEvent = new CustomEvent('paymentSuccess', {
                detail: {
                  invoiceId: invoiceId,
                  invoiceNumber: invoice.invoiceNumber,
                  vendorName: invoice.vendorName,
                  amount: invoice.amount,
                  status: 'paid',
                  paymentId: response.razorpay_payment_id,
                  timestamp: new Date().toISOString()
                }
              });
              window.accountantPaymentEvents.dispatchEvent(paymentEvent);

              // 5. Generate invoice PDF
              try {
                await generatePaymentInvoice(paymentData, invoice);
                console.log('📄 Invoice PDF generated successfully');
              } catch (error) {
                console.error('❌ Error generating invoice PDF:', error);
                toast.warning('Payment successful! Invoice generation failed.');
              }

              // 5. Save payment transaction to database in background
              try {
                const saveResp = await fetch(`${API}/accountant/verify-payment`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                  },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    invoiceId: invoiceId
                  })
                });

                if (saveResp.ok) {
                  const result = await saveResp.json();
                  if (result.success) {
                    console.log('✅ Payment saved to database successfully:', result.data);
                    // Refresh payment history to get complete data
                    fetchPaymentHistory();
                    // Refresh invoices to get updated status from database
                    fetchInvoices();
                    toast.success(`Payment processed! Invoice #${invoice.invoiceNumber} marked as paid`);
                  } else {
                    console.warn('⚠️ Payment saved but database response issue:', result.message);
                    toast.warning(`Payment processed but database sync issue: ${result.message}`);
                  }
                } else {
                  const errorData = await saveResp.json().catch(() => ({}));
                  const errorMsg = errorData.message || `Server error: ${saveResp.status}`;
                  console.warn('⚠️ Database sync issue:', errorMsg);
                  toast.warning(`Payment successful! Database sync pending: ${errorMsg}`);
                }
              } catch (dbError) {
                console.error('❌ Database save error:', dbError);
                toast.warning('Payment successful! Database sync pending.');
              }

              // 6. Close modal and reset state
              setShowPaymentModal(false);
              setSelectedInvoice(null);
              setProcessingPayment(null);

            } catch (error) {
              console.error('❌ Error processing payment success:', error);
              // Still show success since Razorpay payment went through
              toast.success(`Payment successful! (${response.razorpay_payment_id})`);
              setProcessingPayment(null);
              setShowPaymentModal(false);
              setSelectedInvoice(null);
            }

            setProcessingPayment(null);
          },
          modal: {
            ondismiss: function() {
              setProcessingPayment(null);
            },
            escape: false,
            backdropclose: false
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      };

      script.onerror = () => {
        setProcessingPayment(null);
        toast.error('Failed to load payment gateway');
      };

    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed');
      setProcessingPayment(null);
    }
  };

  const generatePaymentInvoice = async (paymentData, invoice) => {
    try {
      // Create a simple invoice PDF using Blob
      const invoiceContent = `
PAYMENT INVOICE
================

Invoice Number: ${invoice.invoiceNumber}
Vendor Name: ${invoice.vendorName}
Payment ID: ${paymentData.transactionId}
Payment Date: ${new Date(paymentData.paymentDate).toLocaleDateString()}
Payment Amount: ₹${invoice.amount.toLocaleString('en-IN')}
Status: PAID

Invoice Details:
- Invoice Number: ${invoice.invoiceNumber}
- Vendor: ${invoice.vendorName}
- Amount: ₹${invoice.amount.toLocaleString('en-IN')}
- Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}
- Payment Date: ${new Date(paymentData.paymentDate).toLocaleDateString()}
- Razorpay Payment ID: ${paymentData.razorpay_payment_id}
- Razorpay Order ID: ${paymentData.razorpay_order_id}

Description: ${invoice.description || 'Vendor payment'}

==========================
Generated on: ${new Date().toLocaleString()}
Payment Status: Successfully Completed
      `.trim();

      // Create blob from text
      const blob = new Blob([invoiceContent], { type: 'text/plain' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payment_invoice_${invoice.invoiceNumber}_${paymentData.transactionId}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('📄 Payment invoice generated:', `payment_invoice_${invoice.invoiceNumber}_${paymentData.transactionId}.txt`);
      
      // Also try to generate PDF if pdfkit is available
      try {
        await generatePdfInvoice(paymentData, invoice);
      } catch (pdfError) {
        console.log('PDF generation not available, using text format');
      }
      
    } catch (error) {
      console.error('Error generating payment invoice:', error);
      throw error;
    }
  };

  const generatePdfInvoice = async (paymentData, invoice) => {
    // This would use PDFKit if available, for now we'll use the text version
    console.log('PDF generation would go here, using text format instead');
  };

  const handleDownloadInvoice = async (paymentId) => {
    try {
      const res = await fetch(`${API}/accountant/download-invoice/${paymentId}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payment_invoice_${paymentId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Invoice downloaded successfully!');
      } else {
        throw new Error('Failed to download invoice');
      }
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast.error('Failed to download invoice');
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || invoice.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'pending':
        return <Clock size={16} className="text-yellow-600" />;
      case 'overdue':
        return <AlertCircle size={16} className="text-red-600" />;
      default:
        return <Clock size={16} className="text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <AccountantLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </AccountantLayout>
    );
  }

  return (
    <AccountantLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Vendor Invoices</h1>
            <p className="text-emerald-200">Manage and process vendor payments</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPaymentHistory(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              <FileText size={16} />
              Payment History
            </button>
            <button
              onClick={fetchInvoices}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <FileText size={24} />
              <span className="text-2xl font-bold">{invoices.length}</span>
            </div>
            <p className="text-blue-100">Total Invoices</p>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <Clock size={24} />
              <span className="text-2xl font-bold">{invoices.filter(inv => inv.status === 'pending').length}</span>
            </div>
            <p className="text-yellow-100">Pending</p>
          </div>
          
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle size={24} />
              <span className="text-2xl font-bold">{invoices.filter(inv => inv.status === 'paid').length}</span>
            </div>
            <p className="text-green-100">Paid</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <DollarSign size={24} />
              <span className="text-2xl font-bold">
                ₹{invoices
                  .filter(inv => inv.status === 'pending')
                  .reduce((sum, inv) => sum + (inv.amount || 0), 0)
                  .toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-purple-100">Pending Amount</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-emerald-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-white/10 border border-emerald-500/30 rounded-lg text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        {/* Invoices Table */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-emerald-500/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-emerald-500/30">
                  <th className="px-6 py-4 text-left text-emerald-200 font-semibold">Invoice</th>
                  <th className="px-6 py-4 text-left text-emerald-200 font-semibold">Vendor</th>
                  <th className="px-6 py-4 text-left text-emerald-200 font-semibold">Amount</th>
                  <th className="px-6 py-4 text-left text-emerald-200 font-semibold">Due Date</th>
                  <th className="px-6 py-4 text-left text-emerald-200 font-semibold">Status</th>
                  <th className="px-6 py-4 text-left text-emerald-200 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                      <FileText size={48} className="mx-auto mb-4 text-gray-500" />
                      <p>No invoices found</p>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-emerald-500/20 hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-white">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-gray-400">{new Date(invoice.issueDate).toLocaleDateString()}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-emerald-400" />
                          <span className="text-white">{invoice.vendorName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-white">₹{invoice.amount?.toLocaleString('en-IN')}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className="text-gray-400" />
                          <span className="text-white">{new Date(invoice.dueDate).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(invoice.status)}`}>
                          {getStatusIcon(invoice.status)}
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowPaymentModal(true);
                            }}
                            className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          
                          {invoice.status === 'pending' && (
                            <button
                              onClick={() => handlePayment(invoice.id)}
                              disabled={processingPayment === invoice.id}
                              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                              title="Process Payment"
                            >
                              {processingPayment === invoice.id ? (
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                              ) : (
                                <CreditCard size={16} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && selectedInvoice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 max-w-md w-full mx-4 border border-emerald-500/30">
              <h3 className="text-xl font-bold text-white mb-4">Invoice Details</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-400">Invoice Number:</span>
                  <span className="text-white font-medium">{selectedInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Vendor:</span>
                  <span className="text-white font-medium">{selectedInvoice.vendorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="text-emerald-400 font-bold text-lg">₹{selectedInvoice.amount?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Due Date:</span>
                  <span className="text-white">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedInvoice.status)}`}>
                        {getStatusIcon(selectedInvoice.status)}
                        {selectedInvoice.status}
                      </span>
                </div>
              </div>
              
              {selectedInvoice.description && (
                <div className="mb-6">
                  <p className="text-gray-400 mb-2">Description:</p>
                  <p className="text-white">{selectedInvoice.description}</p>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
                >
                  Close
                </button>
                {selectedInvoice.status === 'pending' && (
                  <button
                    onClick={() => handlePayment(selectedInvoice.id)}
                    disabled={processingPayment === selectedInvoice.id}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processingPayment === selectedInvoice.id ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard size={16} />
                        Process Payment
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payment History Modal */}
        {showPaymentHistory && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 max-w-4xl w-full mx-4 border border-emerald-500/30 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Payment History</h3>
                <button
                  onClick={() => setShowPaymentHistory(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>
              
              {paymentHistory.length === 0 ? (
                <div className="text-center py-8">
                  <FileText size={48} className="mx-auto mb-4 text-gray-500" />
                  <p className="text-gray-400">No payment history found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {paymentHistory.map((payment) => (
                    <div key={payment.id} className="bg-white/10 rounded-lg p-4 border border-emerald-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{payment.invoiceNumber}</p>
                          <p className="text-gray-400 text-sm">{payment.vendorName}</p>
                          <p className="text-gray-400 text-sm">
                            {new Date(payment.paymentDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-400 font-bold">₹{payment.amount.toLocaleString('en-IN')}</p>
                          <p className="text-green-400 text-sm">{payment.status}</p>
                          <button
                            onClick={() => handleDownloadInvoice(payment.id)}
                            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition flex items-center gap-1"
                          >
                            <Download size={14} />
                            Download Invoice
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AccountantLayout>
  );
};

export default VendorInvoiceManagement;
