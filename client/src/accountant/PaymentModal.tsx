import React, { useState } from 'react';
import { emitPayment } from './mockSocket';
import axios from 'axios';
import PaymentSuccess from '../components/PaymentSuccess';
import { useTranslation } from '../context/TranslationContext';

// Razorpay test configuration
const RAZORPAY_KEY_ID = 'rzp_test_S7aUmYSaQyE0h6'; // Correct test key

export default function PaymentModal({ 
  student, 
  onClose,
  classroom,
  feeStructure,
  totalFees: propTotalFees
}: { 
  student: { id: string; name: string }; 
  onClose?: () => void;
  classroom?: { id: number; name: string; grade: string; section: string };
  feeStructure?: any;
  totalFees?: number;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [paymentOption, setPaymentOption] = useState('');
  
  // Calculate total fees from feeStructure or use provided total
  const calculateTotalFees = () => {
    if (propTotalFees) return propTotalFees;
    if (feeStructure) {
      return (feeStructure.tuitionFee || 0) + 
             (feeStructure.transportFee || 0) + 
             (feeStructure.computerLabFee || 0) + 
             (feeStructure.libraryFee || 0) + 
             (feeStructure.sportsFee || 0) + 
             (feeStructure.examinationFee || 0) + 
             (feeStructure.miscellaneousFee || 0);
    }
    return 50000; // Default fallback
  };
  
  const [totalFees] = useState(calculateTotalFees());
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);

  // Calculate amount based on payment option
  const calculateAmount = (option: string) => {
    switch (option) {
      case 'full':
        return totalFees;
      case 'term':
        return Math.round(totalFees * 0.5);
      case 'installment':
        return ''; // User will enter amount
      default:
        return '';
    }
  };

  // Handle payment option change
  const handlePaymentOptionChange = (option: string) => {
    setPaymentOption(option);
    const calculatedAmount = calculateAmount(option);
    setAmount(calculatedAmount.toString());
    setError('');
  };

  // Generate and download invoice
  const generateInvoice = async (transactionData: any) => {
    try {
      const response = await axios.post('http://localhost:5000/api/payments/generate-invoice', {
        transaction: transactionData,
        student: student,
        paymentOption: paymentOption,
        totalFees: totalFees
      });

      if (response.data.success) {
        // Create download link for HTML
        const link = document.createElement('a');
        if (response.data.type === 'html') {
          // For HTML content, create an HTML file
          const htmlContent = atob(response.data.invoice);
          const blob = new Blob([htmlContent], { type: 'text/html' });
          link.href = URL.createObjectURL(blob);
          link.download = `Fee_Receipt_${transactionData.id}_${Date.now()}.html`;
        } else {
          // For PDF content
          link.href = `data:application/pdf;base64,${response.data.invoice}`;
          link.download = `Fee_Receipt_${transactionData.id}_${Date.now()}.pdf`;
        }
        link.click();
        
        // Clean up object URL if created
        if (response.data.type === 'html') {
          setTimeout(() => URL.revokeObjectURL(link.href), 100);
        }
      }
    } catch (error) {
      console.error('Invoice generation error:', error);
    }
  };

  async function proceed() {
    const numAmount = Number(amount);
    
    if (!paymentOption) {
      setError('Please select a payment option');
      return;
    }

    if (!amount || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    if (numAmount > 100000) {
      setError('Amount cannot exceed ₹1,00,000');
      return;
    }

    setError('');
    setLoading(true);
    
    try {
      // Step 1: Create order from backend
      const orderResponse = await axios.post(`${import.meta.env.VITE_BACKEND_URL || 'https://core5.io'}/api/payments/create-order`, {
        amount: numAmount,
        currency: 'INR',
        receipt: `fee_payment_${student.id}_${Date.now()}`,
        studentId: student.id,
        paymentOption: paymentOption,
        classroomId: classroom?.id,
        classroomName: classroom?.name,
        feeType: 'class_fee'
      });

      if (!orderResponse.data.success) {
        throw new Error(orderResponse.data.message || 'Failed to create payment order');
      }

      const order = orderResponse.data.order;

      // Step 2: Load Razorpay script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: order.currency,
          name: 'LMS Fee Payment',
          description: `Fee payment for ${student.name} - ${paymentOption.charAt(0).toUpperCase() + paymentOption.slice(1)}`,
          order_id: order.id,
          image: 'https://example.com/your-logo.png',
          prefill: {
            name: student.name,
            email: 'student@example.com',
            contact: '9999999999'
          },
          notes: {
            student_id: student.id,
            payment_type: 'fees',
            payment_option: paymentOption
          },
          handler: async function (response: any) {
            try {
              // Step 3: Verify payment with backend
              const verifyResponse = await axios.post(`${import.meta.env.VITE_BACKEND_URL || 'https://core5.io'}/api/payments/verify-payment`, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                studentId: student.id,
                studentName: student.name,
                paymentOption: paymentOption,
                amount: numAmount,
                classroomId: classroom?.id,
                classroomName: classroom?.name,
                feeType: 'class_fee'
              });

              if (verifyResponse.data.success) {
                // Payment successful and verified
                const tx = { 
                  id: response.razorpay_payment_id, 
                  studentId: student.id, 
                  amount: numAmount, 
                  type: 'Student Payment', 
                  status: 'Success', 
                  timestamp: new Date().toISOString(),
                  paymentOption: paymentOption,
                  studentName: student.name
                };
                
                emitPayment(tx as any);
                setLastTransaction(tx);
                setLoading(false);
                
                // Generate invoice
                await generateInvoice(tx);
                
                setShowSuccess(true);
                if (onClose) {
                  setTimeout(() => onClose(), 3000); // Auto close after 3 seconds
                }
              } else {
                throw new Error('Payment verification failed');
              }
            } catch (error) {
              console.error('Payment verification error:', error);
              setLoading(false);
              setError('Payment verification failed. Please try again.');
            }
          },
          modal: {
            ondismiss: function() {
              setLoading(false);
            },
            escape: false,
            backdropclose: false
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      };

      script.onerror = () => {
        setLoading(false);
        setError('Failed to load payment gateway. Please try again.');
      };

    } catch (error) {
      console.error('Payment error:', error);
      setLoading(false);
      setError(error.message || 'Payment failed. Please try again.');
    }
  }

  // Show success animation
  if (showSuccess) {
    return <PaymentSuccess />;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 transform transition-all max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800">{t('pay_fees')}</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Student Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-600">{t('student_name')}</p>
          <p className="font-semibold text-gray-800">{student.name}</p>
          <p className="text-sm text-gray-600 mt-1">{t('total_fees')}: ₹{totalFees.toLocaleString('en-IN')}</p>
        </div>

        {/* Payment Options */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('payment_option')}
          </label>
          <div className="space-y-2">
            <button
              onClick={() => handlePaymentOptionChange('full')}
              disabled={loading}
              className={`w-full p-3 border rounded-lg text-left transition-colors ${
                paymentOption === 'full' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:bg-gray-50'
              } disabled:opacity-50`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{t('full_payment')}</p>
                  <p className="text-sm text-gray-600">Complete payment at once</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-blue-600">₹{totalFees.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-green-600">Save 5%</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handlePaymentOptionChange('term')}
              disabled={loading}
              className={`w-full p-3 border rounded-lg text-left transition-colors ${
                paymentOption === 'term' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:bg-gray-50'
              } disabled:opacity-50`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{t('partial_payment')}</p>
                  <p className="text-sm text-gray-600">50% of total fees</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-blue-600">₹{Math.round(totalFees * 0.5).toLocaleString('en-IN')}</p>
                  <p className="text-xs text-gray-500">Per term</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handlePaymentOptionChange('installment')}
              disabled={loading}
              className={`w-full p-3 border rounded-lg text-left transition-colors ${
                paymentOption === 'installment' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:bg-gray-50'
              } disabled:opacity-50`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">Pay in Installments</p>
                  <p className="text-sm text-gray-600">Flexible payment amount</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-blue-600">Flexible</p>
                  <p className="text-xs text-gray-500">Min. ₹1000</p>
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
              placeholder={paymentOption === 'installment' ? 'Enter amount' : 'Amount auto-calculated'}
              value={amount}
              onChange={(e) => {
                if (paymentOption === 'installment') {
                  setAmount(e.target.value);
                }
                setError('');
              }}
              min="1"
              max="100000"
              disabled={loading || paymentOption !== 'installment'}
            />
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          )}
        </div>

        {/* Quick Amount Buttons for Installments */}
        {paymentOption === 'installment' && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">Quick Amounts</p>
            <div className="grid grid-cols-3 gap-2">
              {[1000, 2500, 5000, 7500, 10000, 15000].map((quickAmount) => (
                <button
                  key={quickAmount}
                  onClick={() => {
                    setAmount(quickAmount.toString());
                    setError('');
                  }}
                  disabled={loading}
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
            onClick={onClose} 
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {t('cancel')}
          </button>
          <button 
            onClick={proceed} 
            disabled={loading || !paymentOption || !amount || Number(amount) <= 0}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('processing')}
              </>
            ) : (
              <>{t('pay_now')}</>
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
              <p className="font-semibold mb-1">{t('test_mode_no_charges')}</p>
              <p className="text-xs">{t('test_card_info')}</p>
              <p className="text-xs mt-1">✓ {t('invoice_auto_download')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
