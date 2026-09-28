const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { getCurrentConfig } = require('../config/razorpay-config');




// Helper function to get database from request context or fallback to master
function getDatabaseFromRequest(req) {
  return req.tenant?.database || require('../config/database-switch');
}


// Initialize Razorpay with current configuration
const razorpayConfig = getCurrentConfig();
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || razorpayConfig.KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET || razorpayConfig.KEY_SECRET
});

/**
 * GET /api/accountant/dashboard
 * Get accountant dashboard data for their university
 */
router.get('/dashboard', authMiddleware, (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Accountant not authenticated' });
    }

    // Get accountant's university_id from users table
    getDatabaseFromRequest(req).get('SELECT university_id FROM users WHERE id = ? AND role = "accountant"', [userId], (err, user) => {
      if (err) {
        console.error('Get accountant university error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ success: false, message: 'Accountant not found' });
      }

      const universityId = user.university_id || 1;
      console.log(' Accountant Dashboard - User ID:', userId, 'University ID:', universityId);

      // Get real dashboard stats from database
      const stats = {
        totalRevenue: 0,
        totalPayments: 0,
        pendingPayments: 0,
        totalExpenses: 0,
        universityName: '',
        universityId: universityId,
      };

      // Get revenue from payments table
      getDatabaseFromRequest(req).all('SELECT SUM(amount) as totalRevenue FROM payments WHERE status = "paid" AND university_id = ?', [universityId], (err, revenueResult) => {
        if (err) {
          console.error('Get revenue error:', err);
        } else {
          stats.totalRevenue = revenueResult[0]?.totalRevenue || 0;
        }

        // Get payment stats
        getDatabaseFromRequest(req).all('SELECT status, COUNT(*) as count FROM payments WHERE university_id = ?', [universityId], (err, paymentResults) => {
          if (err) {
            console.error('Get payment stats error:', err);
          } else {
            paymentResults.forEach(row => {
              stats.totalPayments += row.count;
              if (row.status === 'pending') stats.pendingPayments += row.count;
            });
          }

          // Get expense stats
          getDatabaseFromRequest(req).all('SELECT SUM(amount) as totalExpenses FROM expenses WHERE university_id = ?', [universityId], (err, expenseResult) => {
            if (err) {
              console.error('Get expenses error:', err);
            } else {
              stats.totalExpenses = expenseResult[0]?.totalExpenses || 0;
            }

            // Get university name
            getDatabaseFromRequest(req).get('SELECT name FROM universities WHERE id = ?', [universityId], (err, universityResult) => {
              if (err) {
                console.error('Get university name error:', err);
                stats.universityName = 'University';
              } else {
                stats.universityName = universityResult.name || 'University';
              }

              console.log(' Accountant Dashboard Stats:', stats);

              res.status(200).json({ 
                success: true, 
                data: stats
              });
            });
          });
        });
      });
    });
  } catch (error) {
    console.error('Accountant dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/accountant/payments
 * Get all payments for accountant's university
 */
router.get('/payments', authMiddleware, (req, res) => {
  try {
    // TODO: Get payments filtered by university_id
    const mockPayments = [
      { id: 1, studentName: 'Ali Ahmed', amount: 5000, date: '2026-01-15', status: 'Paid' },
      { id: 2, studentName: 'Sara Khan', amount: 5000, date: '2026-01-16', status: 'Pending' },
      { id: 3, studentName: 'Muhammad Hassan', amount: 5000, date: '2026-01-17', status: 'Paid' },
    ];

    res.status(200).json({ success: true, data: mockPayments });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to load payments' });
  }
});

/**
 * GET /api/accountant/expenses
 * Get all expenses for accountant's university
 */
router.get('/expenses', authMiddleware, (req, res) => {
  try {
    // TODO: Get expenses filtered by university_id
    const mockExpenses = [
      { id: 1, description: 'Staff Salaries', amount: 15000, date: '2026-01-01', category: 'Salaries' },
      { id: 2, description: 'Utilities Bill', amount: 2000, date: '2026-01-05', category: 'Utilities' },
      { id: 3, description: 'Office Supplies', amount: 500, date: '2026-01-10', category: 'Materials' },
    ];

    res.status(200).json({ success: true, data: mockExpenses });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ success: false, message: 'Failed to load expenses' });
  }
});

/**
 * GET /api/accountant/vendor-invoices
 * Get all vendor invoices for accountant's university
 */
router.get('/vendor-invoices', authMiddleware, (req, res) => {
  // Set response timeout for this specific route
  res.setTimeout(60000, () => {
    console.log('Vendor invoices request timeout');
    if (!res.headersSent) {
      res.status(408).json({ success: false, message: 'Request timeout' });
    }
  });

  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Accountant not authenticated' });
    }

    // Get accountant's university_id from users table
    getDatabaseFromRequest(req).get('SELECT university_id FROM users WHERE id = ? AND role = "accountant"', [userId], (err, user) => {
      if (err) {
        console.error('Get accountant university error:', err);
        if (!res.headersSent) {
          return res.status(500).json({ success: false, message: 'Database error' });
        }
      }

      if (!user) {
        if (!res.headersSent) {
          return res.status(404).json({ success: false, message: 'Accountant not found' });
        }
      }

      const universityId = user.university_id || 1;
      console.log(' Accountant Vendor Invoices - User ID:', userId, 'University ID:', universityId);

      // Get all invoices from database filtered by university with timeout
      getDatabaseFromRequest(req).all('SELECT * FROM invoices WHERE university_id = ? ORDER BY issueDate DESC', [universityId], (err, invoices) => {
        if (err) {
          console.error('Get vendor invoices error:', err);
          if (!res.headersSent) {
            return res.status(500).json({ success: false, message: 'Failed to load invoices' });
          }
        }

        console.log(' Accountant - Found invoices:', invoices.length);
        if (!res.headersSent) {
          res.status(200).json({ success: true, data: invoices });
        }
      });
    });
  } catch (error) {
    console.error('Accountant vendor invoices error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
});

/**
 * POST /api/accountant/pay-invoice/:invoiceId
 * Process payment for a vendor invoice
 */
router.post('/pay-invoice/:invoiceId', authMiddleware, (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user?.userId;
    
    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'Invoice ID is required' });
    }

    // First check if invoice exists and is pending
    getDatabaseFromRequest(req).get('SELECT * FROM invoices WHERE id = ?', [invoiceId], (err, invoice) => {
      if (err) {
        console.error('Check invoice error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (!invoice) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
      }

      if (invoice.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Invoice is already paid or processed' });
      }

      // Update invoice status to paid
      const paidDate = new Date().toISOString();
      getDatabaseFromRequest(req).run(
        'UPDATE invoices SET status = ?, paidDate = ?, updatedAt = ? WHERE id = ?',
        ['paid', paidDate, paidDate, invoiceId],
        function(err) {
          if (err) {
            console.error('Update invoice error:', err);
            return res.status(500).json({ success: false, message: 'Failed to process payment' });
          }

          // Log the payment transaction
          getDatabaseFromRequest(req).run(
            'INSERT INTO payment_transactions (invoice_id, user_id, amount, payment_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [invoiceId, userId, invoice.amount, paidDate, 'completed', paidDate],
            function(err) {
              if (err) {
                console.error('Log payment transaction error:', err);
                // Don't fail the whole operation if logging fails
              }
            }
          );

          console.log(`Invoice ${invoiceId} paid by accountant ${userId} on ${paidDate}`);
          
          res.status(200).json({ 
            success: true, 
            message: 'Payment processed successfully',
            data: {
              invoiceId: invoiceId,
              status: 'paid',
              paidDate: paidDate,
              amount: invoice.amount
            }
          });
        }
      );
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to process payment' });
  }
});

/**
 * POST /api/accountant/download-invoice
 * Download invoice for a fee payment transaction
 */
router.post('/download-invoice', authMiddleware, async (req, res) => {
  try {
    console.log('🧾 Invoice download request received');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User ID:', req.user?.userId);
    console.log('🔍 Headers:', Object.keys(req.headers));
    
    const { paymentId, studentName, amount, paymentDate, paymentMethod } = req.body;
    const userId = req.user?.userId;
    
    if (!userId) {
      console.log('❌ Accountant not authenticated');
      return res.status(401).json({ success: false, message: 'Accountant not authenticated' });
    }

    if (!paymentId || !studentName || !amount) {
      console.log('❌ Missing required payment details');
      console.log('  - paymentId:', paymentId);
      console.log('  - studentName:', studentName);
      console.log('  - amount:', amount);
      return res.status(400).json({ success: false, message: 'Missing required payment details' });
    }

    console.log('✅ Validation passed, generating invoice...');
    console.log('📄 Invoice details:', { paymentId, studentName, amount, paymentDate, paymentMethod });

    // Generate simple HTML invoice directly (avoiding dependency issues)
    try {
      console.log('🔄 Starting invoice HTML generation...');
      
      const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Fee Receipt - ${studentName}</title>
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
                <p><strong>Receipt No:</strong> ${paymentId}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Status:</strong> <span style="color: #28a745;">Completed</span></p>
            </div>
            <div style="text-align: right;">
                <h3>Payment Method</h3>
                <p><strong>Method:</strong> ${paymentMethod || 'Online'}</p>
                <p><strong>Transaction ID:</strong> ${paymentId}</p>
            </div>
        </div>
        
        <div class="student-details">
            <h3>Student Information</h3>
            <p><strong>Name:</strong> ${studentName}</p>
            <p><strong>Email:</strong> student@university.edu</p>
            <p><strong>Payment Date:</strong> ${paymentDate ? new Date(paymentDate).toLocaleDateString() : new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="payment-details">
            <h3>Payment Details</h3>
            <p><strong>Description:</strong> Academic Fee Payment</p>
            <p><strong>Payment Date:</strong> ${paymentDate ? new Date(paymentDate).toLocaleDateString() : new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="amount">
            Total Amount Paid: ₹${Number(amount).toLocaleString('en-IN')}
        </div>
        
        <div class="footer">
            <p>This is a computer-generated receipt and does not require a signature.</p>
            <p>For any queries, please contact the accounts department.</p>
            <p>Thank you for your payment!</p>
        </div>
    </div>
</body>
</html>`;

      console.log('✅ Invoice HTML generated successfully, length:', invoiceHTML.length);

      // Convert HTML to base64 for download
      const base64Invoice = Buffer.from(invoiceHTML).toString('base64');
      
      console.log('✅ Base64 conversion successful, length:', base64Invoice.length);
      console.log('📤 Sending invoice response...');

      // Send response
      const responseData = {
        success: true,
        invoice: base64Invoice,
        type: 'html'
      };
      
      console.log('📊 Response data keys:', Object.keys(responseData));
      console.log('📊 Response success:', responseData.success);
      console.log('📊 Response invoice length:', responseData.invoice ? responseData.invoice.length : 'null');
      
      res.status(200).json(responseData);
      console.log('✅ Response sent successfully');

    } catch (invoiceError) {
      console.error('❌ Error generating invoice:', invoiceError);
      console.error('❌ Error stack:', invoiceError.stack);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to generate invoice: ' + invoiceError.message 
      });
    }

  } catch (error) {
    console.error('❌ Download invoice error:', error);
    console.error('❌ Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate invoice' });
    }
  }
});

/**
 * GET /api/accountant/fees-stats
 * Get fee collection statistics
 */
router.get('/fees-stats', authMiddleware, (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Accountant not authenticated' });
    }

    // Get accountant's university_id from users table
    getDatabaseFromRequest(req).get('SELECT university_id FROM users WHERE id = ? AND role = "accountant"', [userId], (err, user) => {
      if (err) {
        console.error('Get accountant university error:', err);
        // If users table doesn't exist, use default university_id
        const universityId = 1;
        console.log('Users table not found, using default university_id:', universityId);
        fetchFeesStats(universityId, res);
      } else if (!user) {
        const universityId = 1;
        console.log('Accountant user not found, using default university_id:', universityId);
        fetchFeesStats(universityId, res);
      } else {
        const universityId = user.university_id || 1;
        console.log(' Accountant Fees Stats - User ID:', userId, 'University ID:', universityId);
        fetchFeesStats(universityId, res);
      }
    });
  } catch (error) {
    console.error('Accountant fees stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to load fee statistics' });
  }
});

function fetchFeesStats(universityId, res) {
  // Get fee collection statistics from database
  const stats = {
    totalFeesCollected: 0,
    totalStudents: 0,
    averageFeesPerStudent: 0
  };

  // Get total fees collected from payments table
  getDatabaseFromRequest(req).all('SELECT SUM(amount) as totalFeesCollected FROM payments WHERE status = "success"', [universityId], (err, feesResult) => {
    if (err) {
      console.error('Get paid fees error:', err);
    } else {
      stats.totalFeesCollected = feesResult[0]?.totalFeesCollected || 0;
    }

    // Get total students count - try users table first, then fallback
    getDatabaseFromRequest(req).all('SELECT COUNT(*) as totalStudents FROM users WHERE role = "student" AND university_id = ?', [universityId], (err, studentResult) => {
      if (err) {
        console.error('Get student count error:', err);
        // Fallback: count unique studentIds from payments table
        getDatabaseFromRequest(req).all('SELECT COUNT(DISTINCT studentId) as totalStudents FROM payments', [], (err, paymentStudentResult) => {
          if (err) {
            console.error('Get student count from payments error:', err);
            stats.totalStudents = 0;
          } else {
            stats.totalStudents = paymentStudentResult[0]?.totalStudents || 0;
          }
          calculateAverageAndRespond();
        });
      } else {
        stats.totalStudents = studentResult[0]?.total || 0;
        calculateAverageAndRespond();
      }
    });

    function calculateAverageAndRespond() {
      // Calculate average fees per student
      stats.averageFeesPerStudent = stats.totalStudents > 0 ? Math.round(stats.totalFeesCollected / stats.totalStudents) : 0;

      // Get recent payments from payments table
      getDatabaseFromRequest(req).all('SELECT p.*, "Student " || p.studentId as studentName, "student@demo.com" as studentEmail FROM payments p WHERE p.status = "success" ORDER BY p.createdAt DESC LIMIT 10', [], (err, paymentsResult) => {
        if (err) {
          console.error('Get recent payments error:', err);
          stats.recentPayments = [];
        } else {
          stats.recentPayments = paymentsResult.map(payment => ({
            studentName: payment.studentName || 'Unknown Student',
            amount: payment.amount || 0,
            paymentDate: payment.createdAt,
            paymentMethod: payment.type || 'Online',
            transactionId: payment.transactionId || payment.id
          }));
        }

        console.log(' Accountant Fees Stats:', stats);

        res.status(200).json({ 
          success: true, 
          data: stats
        });
      });
    }
  });
}

module.exports = router;
