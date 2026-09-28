const Razorpay = require('razorpay');

// Initialize Razorpay with test credentials
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_S7aUmYSaQyE0h6',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'DFei1Nk0mzEHm3ehq6Va5QhW'
});

// Create order
exports.createOrder = async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, classroomId, classroomName, feeType } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid amount' 
      });
    }

    const options = {
      amount: amount * 100, // Convert to paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      order,
      classroomId,
      classroomName,
      feeType,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

// Verify payment
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification parameters'
      });
    }

    // Generate signature for verification
    const crypto = require('crypto');
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'DFei1Nk0mzEHm3ehq6Va5QhW')
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Payment is verified - Save to database
      try {
        // Get payment details from Razorpay
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        
        // Save transaction to MongoDB
        const Transaction = require('../models/Transaction');
        const Student = require('../models/Student');
        
        const transaction = new Transaction({
          studentId: null, // Skip studentId for demo
          studentName: req.body.studentName || 'Student Name',
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          amount: payment.amount / 100, // convert from paise to rupees
          status: 'success',
          paymentMethod: payment.method,
          paymentOption: req.body.paymentOption || 'installment',
          classroomId: req.body.classroomId,
          classroomName: req.body.classroomName,
          feeType: req.body.feeType || 'class_fee',
          createdAt: new Date()
        });
        
        await transaction.save();
        
        // Skip student fees update for demo (no studentId)
        
        res.status(200).json({
          success: true,
          message: 'Payment verified successfully',
          payment_id: razorpay_payment_id,
          order_id: razorpay_order_id,
          transactionId: transaction._id
        });
      } catch (dbError) {
        console.error('Database error:', dbError);
        res.status(500).json({
          success: false,
          message: 'Payment verified but failed to save to database'
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

// Generate professional invoice
exports.generateInvoice = async (req, res) => {
  try {
    const { transaction, student, paymentOption, totalFees } = req.body;
    const path = require('path');
    const fs = require('fs');
    
    // Read and convert logo to base64
    let logoBase64 = '';
    try {
      const logoPath = path.join(__dirname, '../../core5 logo with hat.png');
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = logoBuffer.toString('base64');
    } catch (logoError) {
      console.log('Logo not found, continuing without logo');
    }
    
    // Create professional HTML invoice
    const invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Fee Receipt</title>
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
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }
            .header-top {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 20px;
                margin-bottom: 20px;
            }
            .logo-section {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            .logo-img {
                height: 60px;
                width: auto;
            }
            .company-info {
                text-align: left;
            }
            .company-info h2 {
                margin: 0;
                font-size: 1.8em;
                font-weight: 700;
                color: white;
            }
            .company-info p {
                margin: 3px 0 0 0;
                font-size: 0.8em;
                opacity: 0.95;
                color: white;
            }
            .header h1 {
                margin: 0;
                font-size: 2em;
                font-weight: 300;
            }
            .header p {
                margin: 5px 0 0 0;
                opacity: 0.9;
            }
            .content {
                padding: 40px;
            }
            .invoice-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
                border-bottom: 2px solid #eee;
                padding-bottom: 20px;
            }
            .invoice-info div {
                flex: 1;
            }
            .invoice-info h3 {
                margin: 0 0 10px 0;
                color: #333;
                font-size: 1.2em;
            }
            .invoice-info p {
                margin: 5px 0;
                color: #666;
            }
            .student-details {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            .student-details h3 {
                margin: 0 0 15px 0;
                color: #333;
                border-bottom: 2px solid #667eea;
                padding-bottom: 5px;
            }
            .details-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
            .detail-item {
                display: flex;
                justify-content: space-between;
            }
            .detail-label {
                font-weight: 600;
                color: #555;
            }
            .detail-value {
                color: #333;
            }
            .payment-details {
                background: #e8f5e8;
                border: 2px solid #4caf50;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 30px;
            }
            .payment-details h3 {
                margin: 0 0 15px 0;
                color: #2e7d32;
            }
            .amount-section {
                text-align: center;
                background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
                color: white;
                padding: 25px;
                border-radius: 8px;
                margin: 20px 0;
            }
            .amount-section .amount {
                font-size: 2.5em;
                font-weight: bold;
                margin: 10px 0;
            }
            .footer {
                text-align: center;
                padding: 30px;
                background: #f8f9fa;
                border-top: 2px solid #eee;
            }
            .footer p {
                margin: 5px 0;
                color: #666;
            }
            .watermark {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-45deg);
                font-size: 100px;
                color: rgba(0,0,0,0.05);
                font-weight: bold;
                pointer-events: none;
            }
            .status-badge {
                display: inline-block;
                background: #4caf50;
                color: white;
                padding: 5px 15px;
                border-radius: 20px;
                font-size: 0.9em;
                font-weight: 600;
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <div class="watermark">PAID</div>
            
            <div class="header">
                <div class="header-top">
                    <div class="logo-section">
                        ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Core5 Academy" class="logo-img" />` : ''}
                        <div class="company-info">
                            <h2>CORE5 ACADEMY</h2>
                            <p>9th floor, A Wing, KAILASH BUSINESS PARK</p>
                            <p>901/902, Park Site Rd, Vikhroli (W)</p>
                            <p>HMPL Surya Nagar, Vikhroli West</p>
                            <p>Mumbai, Maharashtra 400079</p>
                        </div>
                    </div>
                </div>
                <h1>Fee Receipt</h1>
                <p>Learning Management System</p>
                <p>Official Payment Confirmation</p>
            </div>
            
            <div class="content">
                <div class="invoice-info">
                    <div>
                        <h3>Receipt Details</h3>
                        <p><strong>Receipt No:</strong> ${transaction.id}</p>
                        <p><strong>Date:</strong> ${new Date(transaction.timestamp).toLocaleDateString('en-IN')}</p>
                        <p><strong>Time:</strong> ${new Date(transaction.timestamp).toLocaleTimeString('en-IN')}</p>
                        <p><strong>Status:</strong> <span class="status-badge">PAID</span></p>
                    </div>
                    <div>
                        <h3>Payment Method</h3>
                        <p><strong>Gateway:</strong> Razorpay</p>
                        <p><strong>Transaction ID:</strong> ${transaction.id}</p>
                        <p><strong>Payment Type:</strong> ${paymentOption.charAt(0).toUpperCase() + paymentOption.slice(1)}</p>
                        <p><strong>Mode:</strong> Online</p>
                    </div>
                </div>
                
                <div class="student-details">
                    <h3>Student Information</h3>
                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="detail-label">Student Name:</span>
                            <span class="detail-value">${student.name}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Student ID:</span>
                            <span class="detail-value">${student.id}</span>
                        </div>
                        <div class="detail-item">
                          <span class="detail-label">Email:</span>
                          <span class="detail-value">${student.email || 'student@example.com'}</span>
                        </div>
                        <div class="detail-item">
                          <span class="detail-label">Phone:</span>
                          <span class="detail-value">${student.phone || '+91 9876543210'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="payment-details">
                    <h3>Payment Breakdown</h3>
                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="detail-label">Total Annual Fees:</span>
                            <span class="detail-value">₹${totalFees.toLocaleString('en-IN')}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Payment Option:</span>
                            <span class="detail-value">${paymentOption.charAt(0).toUpperCase() + paymentOption.slice(1)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Amount Paid:</span>
                            <span class="detail-value">₹${transaction.amount.toLocaleString('en-IN')}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Balance Remaining:</span>
                            <span class="detail-value">₹${(totalFees - transaction.amount).toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                    
                    <div class="amount-section">
                        <p>Amount Paid Successfully</p>
                        <div class="amount">₹${transaction.amount.toLocaleString('en-IN')}</div>
                        <p>Thank you for your payment!</p>
                    </div>
                </div>
            </div>
            
            <div class="footer">
                <p><strong>CORE5 ACADEMY</strong></p>
                <p>9th floor, A Wing, KAILASH BUSINESS PARK</p>
                <p>901/902, Park Site Rd, Vikhroli (W)</p>
                <p>HMPL Surya Nagar, Vikhroli West, Mumbai, Maharashtra 400079</p>
                <p>Phone: +91 9876543210 | Email: accounts@core5academy.edu</p>
                <br>
                <p><em>This is a computer-generated receipt and does not require a signature.</em></p>
                <p><em>For any queries, please contact the accounts department.</em></p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Try to generate PDF with Puppeteer, fallback to HTML if it fails
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      await page.setContent(invoiceHTML, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      await browser.close();
      
      // Convert PDF to base64 for frontend download
      const base64Invoice = pdfBuffer.toString('base64');
      
      res.status(200).json({
        success: true,
        invoice: base64Invoice,
        type: 'pdf'
      });
    } catch (puppeteerError) {
      console.log('Puppeteer failed, attempting PDFKit fallback:', puppeteerError.message);
      // Fallback: generate a simple PDF using PDFKit to ensure accountant always receives a PDF
      try {
        const PDFDocument = require('pdfkit');

        const doc = new PDFDocument({ size: 'A4', margin: 40 });

        // Pipe PDF to buffer using get-stream
        let buffers = [];
        doc.on('data', (d) => buffers.push(d));
        const endPromise = new Promise((resolve, reject) => {
          doc.on('end', () => resolve());
          doc.on('error', reject);
        });

        // Header
        doc.fillColor('#ffffff').rect(0, 0, doc.page.width, 100).fill('#334155');
        doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('Fee Receipt', 40, 30);
        doc.moveDown();

        // Receipt / Payment info
        doc.fillColor('#000000').fontSize(10).font('Helvetica');
        doc.text(`Receipt No: ${transaction.id}`, 40, 120);
        doc.text(`Date: ${new Date(transaction.timestamp).toLocaleDateString('en-IN')}`, 40, 135);
        doc.text(`Time: ${new Date(transaction.timestamp).toLocaleTimeString('en-IN')}`, 40, 150);
        doc.text(`Transaction ID: ${transaction.id}`, 320, 120);
        doc.text(`Payment Type: ${paymentOption.charAt(0).toUpperCase() + paymentOption.slice(1)}`, 320, 135);

        // Student details
        doc.moveDown().moveDown();
        doc.font('Helvetica-Bold').text('Student Information', { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica').text(`Name: ${student.name}`);
        doc.text(`Student ID: ${student.id}`);
        doc.text(`Email: ${student.email || 'student@example.com'}`);
        doc.text(`Phone: ${student.phone || '+91 9876543210'}`);

        // Payment breakdown
        doc.moveDown();
        doc.font('Helvetica-Bold').text('Payment Breakdown');
        doc.moveDown(0.5);
        doc.font('Helvetica').text(`Total Annual Fees: ₹${totalFees.toLocaleString('en-IN')}`);
        doc.text(`Payment Option: ${paymentOption.charAt(0).toUpperCase() + paymentOption.slice(1)}`);
        doc.text(`Amount Paid: ₹${transaction.amount.toLocaleString('en-IN')}`);
        doc.text(`Balance Remaining: ₹${(totalFees - transaction.amount).toLocaleString('en-IN')}`);

        doc.moveDown(1);
        doc.fontSize(18).font('Helvetica-Bold').text(`Amount: ₹${transaction.amount.toLocaleString('en-IN')}`, { align: 'center' });

        doc.moveDown(2);
        doc.fontSize(9).font('Helvetica').text('This is a computer-generated receipt and does not require a signature.', { align: 'center' });

        doc.end();

        await endPromise;
        const pdfBuffer = Buffer.concat(buffers);
        const base64Invoice = pdfBuffer.toString('base64');

        return res.status(200).json({ success: true, invoice: base64Invoice, type: 'pdf' });
      } catch (pdfFallbackError) {
        console.error('PDFKit fallback failed:', pdfFallbackError);
        // As a last resort, return the HTML encoded invoice
        const base64Invoice = Buffer.from(invoiceHTML).toString('base64');
        return res.status(200).json({ success: true, invoice: base64Invoice, type: 'html' });
      }
    }
    
  } catch (error) {
    console.error('Invoice generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice'
    });
  }
};

// Get transaction history for a student
exports.getTransactionHistory = async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const studentId = req.params.studentId;
    
    let transactions;
    if (studentId && studentId !== 'demo') {
      // Fetch transactions for specific student
      transactions = await Transaction.find({ studentId })
        .sort({ createdAt: -1 });
    } else {
      // Fetch all transactions for demo
      transactions = await Transaction.find({})
        .sort({ createdAt: -1 });
    }
    
    res.status(200).json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions'
    });
  }
};

// Get all transactions for accountant portal
exports.getAllTransactions = async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    
    const transactions = await Transaction.find({})
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('Error fetching all transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions'
    });
  }
};
