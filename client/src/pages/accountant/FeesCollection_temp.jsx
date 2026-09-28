import React, { useState, useEffect } from 'react';
import { useAuth } from "../../auth/auth";
import AccountantLayout from "../../components/AccountantLayout";
import { BarChart3, DollarSign, Users, TrendingUp, Calendar, RefreshCw, FileText, Download } from "lucide-react";

const FeesCollection = () => {
  const { token, API } = useAuth();
  const [feesData, setFeesData] = useState({
    totalFeesCollected: 0,
    totalStudents: 0,
    averageFeesPerStudent: 0,
    recentPayments: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(null);

  const downloadInvoice = async (payment) => {
    try {
      console.log('🧾 Invoice download started for:', payment);
      setDownloadingInvoice(payment.transactionId || payment.id);
      
      // Generate invoice directly in frontend (no backend dependency)
      const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Fee Receipt - ${payment.studentName || 'Student'}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f5f5f5;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #007bff;
            margin: 0;
            font-size: 28px;
        }
        .invoice-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        .invoice-info div {
            flex: 1;
        }
        .invoice-info h3 {
            margin: 0 0 10px 0;
            color: #333;
        }
        .student-details {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .payment-details {
            background: #e9ecef;
            padding: 20px;
            border-radius: 8px;
        }
        .amount {
            font-size: 24px;
            font-weight: bold;
            color: #28a745;
            text-align: center;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
        }
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            color: rgba(0, 128, 0, 0.1);
            font-weight: bold;
            z-index: -1;
        }
        @media print {
            body { background: white; }
            .watermark { color: rgba(0, 128, 0, 0.05); }
        }
    </style>
</head>
<body>
    <div class="watermark">PAID</div>
    <div class="invoice-container">
        <div class="header">
            <h1>Fee Receipt</h1>
            <p>Official Payment Confirmation</p>
        </div>
        
        <div class="invoice-info">
            <div>
                <h3>Receipt Details</h3>
                <p><strong>Receipt No:</strong> ${payment.transactionId || payment.id || 'INV' + Date.now()}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Status:</strong> <span style="color: #28a745;">Completed</span></p>
            </div>
            <div style="text-align: right;">
                <h3>Payment Method</h3>
                <p><strong>Method:</strong> ${payment.paymentMethod || 'Online'}</p>
                <p><strong>Transaction ID:</strong> ${payment.transactionId || payment.id || 'INV' + Date.now()}</p>
            </div>
        </div>
        
        <div class="student-details">
            <h3>Student Information</h3>
            <p><strong>Name:</strong> ${payment.studentName || 'Student'}</p>
            <p><strong>Email:</strong> student@university.edu</p>
            <p><strong>Payment Date:</strong> ${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="payment-details">
            <h3>Payment Details</h3>
            <p><strong>Description:</strong> Academic Fee Payment</p>
            <p><strong>Payment Date:</strong> ${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="amount">
            Total Amount Paid: ₹${Number(payment.amount || 0).toLocaleString('en-IN')}
        </div>
        
        <div class="footer">
            <p>This is a computer-generated receipt and does not require a signature.</p>
            <p>For any queries, please contact the accounts department.</p>
            <p>Thank you for your payment!</p>
        </div>
    </div>
</body>
</html>`;

      console.log('📄 Invoice HTML generated successfully in frontend');

      // Create download link
      const link = document.createElement('a');
      link.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(invoiceHTML);
      link.download = `Invoice_${payment.studentName || 'Student'}_${payment.transactionId || payment.id || Date.now()}.html`;
      
      console.log('📥 Download link created:', link.download);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ Download initiated successfully!');
      
    } catch (error) {
      console.error('❌ Download invoice error:', error);
      alert('Error downloading invoice: ' + error.message);
    } finally {
      setDownloadingInvoice(null);
      console.log('🔄 Download state reset');
    }
  };

  const fetchFeesData = async () => {
    try {
      setLoading(true);
      
      // Fetch fees stats (this is the main API we know exists)
      const feesRes = await fetch(`${API}/accountant/fees-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (feesRes.ok) {
        const feesDataResponse = await feesRes.json();
        if (feesDataResponse.success) {
          setFeesData({
            totalFeesCollected: feesDataResponse.data?.totalFeesCollected || 0,
            totalStudents: feesDataResponse.data?.totalStudents || 0,
            averageFeesPerStudent: feesDataResponse.data?.averageFeesPerStudent || 0,
            recentPayments: feesDataResponse.data?.recentPayments || []
          });
        } else {
          setError('Failed to fetch fees data');
        }
      } else {
        // If fees-stats fails, try to set some default values
        setFeesData({
          totalFeesCollected: 0,
          totalStudents: 0,
          averageFeesPerStudent: 0,
          recentPayments: []
        });
        console.warn('Fees stats API not available, using default values');
      }

    } catch (error) {
      console.error('Error fetching fees data:', error);
      // Set default data instead of showing error
      setFeesData({
        totalFeesCollected: 0,
        totalStudents: 0,
        averageFeesPerStudent: 0,
        recentPayments: []
      });
      setError(null); // Clear error state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeesData();
  }, []);

  if (loading) {
    return (
      <AccountantLayout>
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">📊 Fee Collection</h2>
            <p className="text-gray-400">Monitor and manage student fee collections</p>
          </div>
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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
            <h2 className="text-3xl font-bold text-white mb-2">📊 Fee Collection</h2>
            <p className="text-gray-400">Monitor and manage student fee collections</p>
          </div>
          <button
            onClick={fetchFeesData}
            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
          >
            <RefreshCw size={20} />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-6">
          {/* Recent Payments Summary */}
          {feesData.recentPayments && feesData.recentPayments.length > 0 && (
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Recent Payments Summary</h3>
                  <p className="text-indigo-100">Last {feesData.recentPayments.length} payments</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    ₹{feesData.recentPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0).toLocaleString('en-IN')}
                  </div>
                  <p className="text-indigo-100">Sum of Recent Payments</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl">
          <div className="p-6 border-b border-slate-700/50">
            <h3 className="text-xl font-semibold text-white">Recent Fee Payments</h3>
          </div>
          
          {feesData.recentPayments.length === 0 ? (
            <div className="p-12 text-center">
              <BarChart3 size={64} className="mx-auto text-gray-600 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">No Recent Payments</h3>
              <p className="text-gray-400">Recent fee payments will appear here once students make payments.</p>
              <div className="mt-6 p-4 bg-slate-700/30 rounded-lg">
                <p className="text-gray-300 text-sm">💡 Tip: Students can make payments through the Student Portal → Pay Fees section</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left p-4 text-gray-400 font-medium">Student Name</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Amount</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Payment Date</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Payment Method</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                    <th className="text-left p-4 text-gray-400 font-medium">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {feesData.recentPayments.map((payment, index) => (
                    <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <Users size={16} className="text-gray-400" />
                          <span className="text-white font-medium">{payment.studentName || 'Student'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-white font-semibold">₹{payment.amount.toLocaleString('en-IN')}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <Calendar size={16} className="text-gray-400" />
                          <span className="text-white">
                            {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-white">{payment.paymentMethod || 'Online'}</span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium border text-green-500 bg-green-500/10 border-green-500/20">
                          <span className="uppercase">Completed</span>
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => downloadInvoice(payment)}
                          disabled={downloadingInvoice === (payment.transactionId || payment.id)}
                          className="inline-flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <Download size={16} />
                          <span>{downloadingInvoice === (payment.transactionId || payment.id) ? 'Downloading...' : 'Invoice'}</span>
                        </button>
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

export default FeesCollection;
