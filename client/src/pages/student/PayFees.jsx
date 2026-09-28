import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from 'recharts';
import { AlertCircle, CheckCircle, Download, Receipt } from 'lucide-react';
import { useAuth } from "../../auth/auth";
import { generateInvoicePdf } from "../../accountant/invoice";
import { emitTransaction, useTransactionStore, transactionStore } from "../../store/transactionStore";
import { useUniversalPersistence } from "../../hooks/useUniversalPersistenceSimple";
import { useTranslation } from '../../context/TranslationContext';
import { toast } from 'react-toastify';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

// Razorpay test configuration
const RAZORPAY_KEY_ID = 'rzp_test_S7aUmYSaQyE0h6';

const PayFees = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { transactions } = useTransactionStore();
  const [allFeeStructures, setAllFeeStructures] = useState([]);
  const [selectedFeeStructure, setSelectedFeeStructure] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentOption, setPaymentOption] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Default fee structures (fallback if API unavailable)
  const getDefaultFeeStructures = () => {
    return [
      {
        id: 1,
        category: 'Primary',
        description: 'For Grades 1-4',
        tuitionFee: 5000,
        transportFee: 1000,
        computerLabFee: 800,
        libraryFee: 500,
        sportsFee: 300,
        examinationFee: 700,
        miscellaneousFee: 200,
        totalFee: 8050,
        dueDate: '2026-01-31'
      },
      {
        id: 2,
        category: 'Secondary',
        description: 'For Grades 5-12',
        tuitionFee: 7000,
        transportFee: 1500,
        computerLabFee: 1200,
        libraryFee: 700,
        sportsFee: 500,
        examinationFee: 900,
        miscellaneousFee: 300,
        totalFee: 12100,
        dueDate: '2026-01-31'
      }
    ];
  };

  // Initialize by fetching all available fee structures and classroom
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);

        // Load current student's transactions only
        if (user?.id) {
          await transactionStore.loadTransactions(user.id);
        }

        // Fetch student's classroom
        const token = localStorage.getItem('token') || '';
        try {
          const classroomResp = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/students/${user?.id}/classroom`, {
            headers: {
              Authorization: token ? `Bearer ${token}` : ''
            }
          });
          if (classroomResp.ok) {
            const classroomData = await classroomResp.json();
            setClassroom(classroomData);
          }
        } catch (err) {
          console.warn('Could not fetch classroom:', err);
        }

        // Fetch all fee structures created by admin
        const resp = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/fee-structures`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        });

        if (resp.ok) {
          const structures = await resp.json();
          setAllFeeStructures(structures || []);
          // Auto-select first fee structure
          if (structures && structures.length > 0) {
            setSelectedFeeStructure(structures[0]);
          }
        } else {
          // Use default fee structures as fallback
          const defaults = getDefaultFeeStructures();
          setAllFeeStructures(defaults);
          if (defaults.length > 0) {
            setSelectedFeeStructure(defaults[0]);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching fee structures:', error);
        // Fallback to defaults
        const defaults = getDefaultFeeStructures();
        setAllFeeStructures(defaults);
        if (defaults.length > 0) {
          setSelectedFeeStructure(defaults[0]);
        }
        setLoading(false);
      }
    };

    initializeData();
  }, [user?.id]);

  const totalFee = selectedFeeStructure?.totalFee || 0;
  const paidAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const pendingAmount = totalFee - paidAmount;
  const paymentPercentage = totalFee > 0 ? (paidAmount / totalFee) * 100 : 0;

  const pieData = selectedFeeStructure ? 
    Object.entries(selectedFeeStructure)
      .filter(([key, value]) => key !== 'category' && key !== 'totalFee' && key !== 'dueDate' && key !== 'description' && typeof value === 'number')
      .map(([key, value]) => ({ 
        name: key.replace(/([A-Z])/g, ' $1').trim(), 
        value 
      })) : [];

  // Updated line data with actual payments
  const lineData = [
    { month: 'Aug', paid: 0 },
    { month: 'Sep', paid: paidAmount * 0.2 },
    { month: 'Oct', paid: paidAmount * 0.4 },
    { month: 'Nov', paid: paidAmount * 0.6 },
    { month: 'Dec', paid: paidAmount * 0.8 },
    { month: 'Jan', paid: paidAmount },
  ];

  const barData = [
    { term: 'Full Fees', paid: totalFee },
    { term: 'Term-wise', paid: totalFee * 0.5 },
    { term: 'Installments', paid: totalFee * 0.3 },
  ];

  const handlePayment = () => {
    setShowPayment(true);
    setPaymentOption('');
    setPaymentAmount('');
    setPaymentError('');
  };

  const closePayment = () => {
    setShowPayment(false);
    setPaymentOption('');
    setPaymentAmount('');
    setPaymentError('');
  };

  const calculateAmount = (option) => {
    switch (option) {
      case 'full':
        return totalFee;
      case 'term':
        return Math.round(totalFee * 0.5);
      case 'installment':
        return '';
      default:
        return '';
    }
  };

  const handlePaymentOptionChange = (option) => {
    setPaymentOption(option);
    const calculatedAmount = calculateAmount(option);
    setPaymentAmount(calculatedAmount.toString());
    setPaymentError('');
  };

  const processPayment = async () => {
    const numAmount = Number(paymentAmount);
    
    if (!paymentOption) {
      setPaymentError(t('please_select_payment_option'));
      return;
    }

    if (!paymentAmount || numAmount <= 0) {
      setPaymentError(t('please_enter_valid_amount'));
      return;
    }

    setPaymentError('');
    setPaymentLoading(true);

    try {
      // Load Razorpay script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: RAZORPAY_KEY_ID,
          amount: numAmount * 100, // Convert to paise
          currency: 'INR',
          name: t('lms_fee_payment'),
          description: `Fee payment for ${user?.name} - ${paymentOption.charAt(0).toUpperCase() + paymentOption.slice(1)}`,
          image: 'https://example.com/your-logo.png',
          prefill: {
            name: user?.name || t('student'),
            email: 'student@example.com',
            contact: '9999999999'
          },
          notes: {
            student_id: user?.id,
            payment_type: 'fees',
            payment_option: paymentOption,
            fee_category: selectedFeeStructure?.category,
            description: selectedFeeStructure?.description
          },
          handler: async function (response) {
            // Payment successful - save to database
            try {
              const token = localStorage.getItem('token') || '';
              const newTransaction = {
                studentId: user?.id,
                studentName: user?.name,
                amount: numAmount,
                paymentOption: paymentOption,
                status: 'success',
                feeCategory: selectedFeeStructure?.category,
                feeDescription: selectedFeeStructure?.description,
                transactionId: response.razorpay_payment_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                type: paymentOption,
                description: `Fee payment - ${paymentOption.charAt(0).toUpperCase() + paymentOption.slice(1)}`
              };

              // Immediately add to UI for instant feedback
              const uiTransaction = {
                id: response.razorpay_payment_id,
                ...newTransaction,
                paymentDate: new Date().toLocaleDateString(),
                paymentTime: new Date().toLocaleTimeString(),
                timestamp: new Date().toISOString()
              };
              
              // Emit to store immediately for real-time UI update
              emitTransaction(uiTransaction);

              // Save transaction to database in background
              const saveResp = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/transactions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(newTransaction)
              });

              if (saveResp.ok) {
                // Transaction saved successfully to database
                console.log('✅ Transaction saved to database');
                
                // Reload transactions from database
                if (user?.id) {
                  await transactionStore.loadTransactions(user.id);
                }

                toast.success(`${t('payment_successful')}: ${response.razorpay_payment_id}`);
              } else {
                // Get error details from backend
                const errorData = await saveResp.json().catch(() => ({}));
                const errorMsg = errorData.message || `Server error: ${saveResp.status}`;
                console.error('❌ Failed to save to database:', errorMsg);
                
                // Still show success since payment went through and UI is updated
                toast.warning(`Payment successful but database sync pending: ${response.razorpay_payment_id}`);
              }
            } catch (error) {
              console.error('❌ Error saving transaction:', error);
              // Even with error, payment succeeded and is showing in UI
              toast.warning(`Payment successful! (${error.message})`);
            }

            setPaymentLoading(false);
            closePayment();
          },
          modal: {
            ondismiss: function() {
              setPaymentLoading(false);
            },
            escape: false,
            backdropclose: false
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      };

      script.onerror = () => {
        setPaymentLoading(false);
        setPaymentError(t('failed_to_load_payment_gateway'));
      };

    } catch (error) {
      console.error('Payment error:', error);
      setPaymentLoading(false);
      setPaymentError(t('payment_failed'));
    }
  };

  // Generate and download invoice PDF
  const downloadInvoice = (transaction) => {
    try {
      // Create fee breakdown for invoice
      const feeBreakdown = selectedFeeStructure ? 
        Object.entries(selectedFeeStructure)
          .filter(([key, value]) => key !== 'category' && key !== 'totalFee' && key !== 'dueDate' && typeof value === 'number')
          .map(([key, value]) => ({
            label: key.replace(/([A-Z])/g, ' $1').trim(),
            amount: value
          })) : [];

      // Generate PDF invoice with transaction-specific details
      const doc = generateInvoicePdf({
        schoolName: 'EDUMentor LMS',
        student: {
          id: transaction.studentId,
          name: transaction.studentName,
          className: `${classroom?.name} (${classroom?.grade})`
        },
        feeBreakdown: feeBreakdown,
        transactionId: transaction.id,
        paymentDate: transaction.paymentDate,
        transactionAmount: transaction.amount, // Pass the actual transaction amount
        paymentOption: transaction.paymentOption // Pass the payment option
      });

      // Download the PDF
      doc.save(`Receipt_${transaction.studentName}_${transaction.id}.pdf`);
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast.error(t('failed_generate_invoice'));
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading_fees')}</p>
        </div>
      </div>
    );
  }

  // If student has no classroom assigned, show empty state
  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg">{t('loading')} ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 h-screen overflow-y-auto">
      <h1 className="text-2xl font-bold mb-6">{t('pay_fees')}</h1>

      {/* Available Fee Structures - Select One to Pay */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Select Fee Structure to Pay</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allFeeStructures.map((structure) => (
            <div
              key={structure.id}
              onClick={() => setSelectedFeeStructure(structure)}
              className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                selectedFeeStructure?.id === structure.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
            >
              <h3 className="text-lg font-bold text-gray-800">{structure.category}</h3>
              <p className="text-sm text-gray-600 mb-3">{structure.description}</p>
              <div className="bg-blue-50 p-3 rounded mb-4">
                <p className="text-2xl font-bold text-blue-600">₹{structure.totalFee.toLocaleString()}</p>
                <p className="text-xs text-gray-600">Total Fee</p>
              </div>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Due Date:</strong> {structure.dueDate}
              </p>
              {selectedFeeStructure?.id === structure.id && (
                <div className="mt-3 p-2 bg-green-100 rounded text-green-700 text-sm font-semibold">
                  ✓ Selected
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedFeeStructure && (
        <>
          {/* Fee Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold">{t('total_fees')}</h3>
              <p className="text-2xl font-bold text-blue-600">₹{totalFee.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold">{t('due_date')}</h3>
              <p className="text-2xl font-bold text-red-600">{selectedFeeStructure?.dueDate || 'January 31, 2026'}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold">{t('payment_status')}</h3>
              <p className="text-sm text-gray-600 mt-2">
                <strong>{t('status')}: </strong>{paidAmount === 0 ? (t('unpaid') || 'Unpaid') : (paymentPercentage >= 100 ? (t('paid') || 'Paid') : (t('partial') || 'Partial'))}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
                <div className="bg-green-600 h-4 rounded-full transition-all duration-500" style={{ width: `${paymentPercentage}%` }}></div>
              </div>
              <p className="text-sm mt-2">{t('paid')}: ₹{paidAmount.toLocaleString()} / {t('pending')}: ₹{pendingAmount.toLocaleString()}</p>
            </div>
          </div>

          {/* Selected Fee Structure Details */}
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h3 className="text-lg font-semibold mb-4">Fee Structure Details - {selectedFeeStructure?.category}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(selectedFeeStructure)
                .filter(([key, value]) => key !== 'category' && key !== 'totalFee' && key !== 'dueDate' && key !== 'description' && key !== 'id' && typeof value === 'number')
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                    <span className="font-bold text-blue-600">₹{value.toLocaleString()}</span>
                  </div>
                ))}
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded font-semibold col-span-2">
                <span>Total:</span>
                <span className="text-blue-700">₹{totalFee.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">{t('fee_distribution')}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">{t('payment_timeline')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="paid" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h3 className="text-lg font-semibold mb-4">{t('payment_options')}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData}>
            <XAxis dataKey="term" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="paid" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Transaction History */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t('transaction_history')}</h3>
          {transactions.length > 0 && (
            <button
              onClick={() => {
                // Download all invoices
                transactions.forEach((tx, index) => {
                  setTimeout(() => downloadInvoice(tx), index * 1000);
                });
              }}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Download size={16} className="mr-2" />
              {t('download_all_invoices')}
            </button>
          )}
        </div>
        
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Receipt size={48} className="mx-auto mb-2 text-gray-300" />
            <p>{t('no_transactions')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction, index) => (
              <div key={transaction.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      <span className="font-semibold text-gray-800">{t('payment_successful')}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p><strong>{t('student')}:</strong> {transaction.studentName}</p>
                      <p><strong>{t('class')}:</strong> {transaction.classroom}</p>
                      <p><strong>{t('option')}:</strong> {transaction.paymentOption.charAt(0).toUpperCase() + transaction.paymentOption.slice(1)}</p>
                      <p><strong>{t('date')}:</strong> {transaction.paymentDate} at {transaction.paymentTime}</p>
                      <p><strong>{t('transaction_id')}:</strong> {transaction.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-bold text-green-600">₹{transaction.amount.toLocaleString()}</span>
                    <button
                      onClick={() => downloadInvoice(transaction)}
                      className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <Download size={16} className="mr-1" />
                      {t('invoice')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Button */}
      <div className="text-center">
        <button 
          onClick={handlePayment}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
        >
          {t('proceed_to_payment')}
        </button>
      </div>
        </>
      )}

      {/* Razorpay Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 transform transition-all max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">{t('pay_fees')}</h3>
              <button 
                onClick={closePayment}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={paymentLoading}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Student Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600">{t('student_name')}</p>
              <p className="font-semibold text-gray-800">{user?.name || t('student')}</p>
              <p className="text-sm text-gray-600 mt-1">{t('class')}: {classroom?.name}</p>
              <p className="text-sm text-gray-600">{t('total_fees')}: ₹{totalFee.toLocaleString('en-IN')}</p>
            </div>

            {/* Payment Options */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('payment_option')}
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => handlePaymentOptionChange('full')}
                  disabled={paymentLoading}
                  className={`w-full p-3 border rounded-lg text-left transition-colors ${
                    paymentOption === 'full' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{t('pay_full_fees')}</p>
                      <p className="text-sm text-gray-600">{t('complete_payment_once')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">₹{totalFee.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-green-600">{t('save')} 5%</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handlePaymentOptionChange('term')}
                  disabled={paymentLoading}
                  className={`w-full p-3 border rounded-lg text-left transition-colors ${
                    paymentOption === 'term' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{t('pay_termwise')}</p>
                      <p className="text-sm text-gray-600">50% {t('of')} {t('total_fees').toLowerCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">₹{Math.round(totalFee * 0.5).toLocaleString('en-IN')}</p>
                      <p className="text-xs text-gray-500">{t('per')} {t('term')}</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handlePaymentOptionChange('installment')}
                  disabled={paymentLoading}
                  className={`w-full p-3 border rounded-lg text-left transition-colors ${
                    paymentOption === 'installment' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{t('pay_installments')}</p>
                      <p className="text-sm text-gray-600">{t('flexible_payment')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">{t('flexible')}</p>
                      <p className="text-xs text-gray-500">{t('min')}. ₹1000</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('payment_amount')} (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                <input 
                  type="number" 
                  className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  placeholder={paymentOption === 'installment' ? t('enter_amount') : t('amount_auto_calculated')}
                  value={paymentAmount}
                  onChange={(e) => {
                    if (paymentOption === 'installment') {
                      setPaymentAmount(e.target.value);
                    }
                    setPaymentError('');
                  }}
                  min="1"
                  max="100000"
                  disabled={paymentLoading || paymentOption !== 'installment'}
                />
              </div>
              {paymentError && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {paymentError}
                </p>
              )}
            </div>

            {/* Quick Amount Buttons for Installments */}
            {paymentOption === 'installment' && (
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">{t('quick_amounts')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[1000, 2500, 5000, 7500, 10000, 15000].map((quickAmount) => (
                    <button
                      key={quickAmount}
                      onClick={() => {
                        setPaymentAmount(quickAmount.toString());
                        setPaymentError('');
                      }}
                      disabled={paymentLoading}
                      className="py-2 px-3 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-500 transition-colors disabled:opacity-50"
                    >
                      ₹{quickAmount}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button 
                onClick={closePayment} 
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                disabled={paymentLoading}
              >
                {t('cancel')}
              </button>
              <button 
                onClick={processPayment} 
                disabled={paymentLoading || !paymentOption || !paymentAmount || Number(paymentAmount) <= 0}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {paymentLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('processing')}
                  </>
                ) : (
                  t('pay_now')
                )}
              </button>
            </div>

            {/* Test Mode Info */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">{t('test_mode')} - {t('no_real_charges')}</p>
                  <p className="text-xs">{t('test_card')}: 4111 1111 1111 1111 | Any future expiry | Any 3-digit CVV</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayFees;