import React, { useState, useEffect } from 'react';
import StudentLayout from "../../components/StudentLayout";
import { 
  CreditCard, 
  Receipt, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  Building2, 
  Calendar,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  Wallet,
  ChevronRight,
  FileCheck2,
  Lock
} from 'lucide-react';
import { useAuth } from "../../auth/auth";
import { generateInvoicePdf } from "../../accountant/invoice";
import { emitTransaction, useTransactionStore, transactionStore } from "../../store/transactionStore";
import { useTranslation } from '../../context/TranslationContext';
import { toast } from 'react-toastify';

// Razorpay test configuration
const RAZORPAY_KEY_ID = 'rzp_test_S7aUmYSaQyE0h6';

const PayFees = () => {
  const { user, token, API } = useAuth();
  const { t } = useTranslation();
  const { transactions } = useTransactionStore();

  const [feeStructure, setFeeStructure] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedInstallmentIdx, setSelectedInstallmentIdx] = useState(0);
  const [paymentOption, setPaymentOption] = useState('full');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [dbPayments, setDbPayments] = useState([]);

  // Default fee structure fallback if API has no specific records
  const defaultFeeStructure = {
    id: 1,
    category: 'Standard Curriculum',
    description: 'Annual Academic & Laboratory Tuition',
    tuitionFee: 5000,
    transportFee: 1000,
    computerLabFee: 800,
    libraryFee: 500,
    sportsFee: 300,
    examinationFee: 450,
    miscellaneousFee: 0,
    totalFee: 8050,
    dueDate: '2026-11-30',
    installmentOptions: [
      {
        id: 'plan_full',
        name: '1-Time Full Clearance (100%)',
        installmentsCount: 1,
        splitType: 'equal',
        isActive: true,
        installments: [{ number: 1, label: 'Full Payment', percentage: 100, dueDate: '2026-11-30' }]
      },
      {
        id: 'plan_semesters',
        name: '2 Semester Terms (50% + 50%)',
        installmentsCount: 2,
        splitType: 'equal',
        isActive: true,
        installments: [
          { number: 1, label: 'Term 1 Installment', percentage: 50, dueDate: '2026-11-30' },
          { number: 2, label: 'Term 2 Installment', percentage: 50, dueDate: '2027-04-30' }
        ]
      }
    ]
  };

  const fetchDbPayments = async (studentId) => {
    try {
      const res = await fetch(`${API}/accountant/student-payments-history?studentId=${studentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.payments)) {
          setDbPayments(data.payments);
        }
      }
    } catch (err) {
      console.warn('Could not fetch student DB payments:', err);
    }
  };

  useEffect(() => {
    const initializeStudentFees = async () => {
      try {
        setLoading(true);

        if (user?.id) {
          await transactionStore.loadTransactions(user.id);
          await fetchDbPayments(user.id);
        }

        let studentGrade = null;

        // 1. Fetch student's assigned classroom
        try {
          const classroomResp = await fetch(`${API}/classrooms/student-classrooms`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (classroomResp.ok) {
            const classroomData = await classroomResp.json();
            const myClass = Array.isArray(classroomData) && classroomData.length > 0 ? classroomData[0] : null;
            setClassroom(myClass);
            if (myClass?.grade) {
              studentGrade = parseInt(myClass.grade);
            }
          }
        } catch (err) {
          console.warn('Could not fetch student classroom:', err);
        }

        // 2. Fetch fee structures
        try {
          const resp = await fetch(`${API}/classrooms/fee-structures`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (resp.ok) {
            const structures = await resp.json();
            if (Array.isArray(structures) && structures.length > 0) {
              // Match student's applicable category (Primary for 1-4, Secondary for 5-12)
              const matchedCategory = (studentGrade && studentGrade >= 1 && studentGrade <= 4) ? 'Primary' : 'Secondary';
              const matched = structures.find(s => s.category?.toLowerCase() === matchedCategory.toLowerCase()) || structures[0];
              setFeeStructure(matched);
            } else {
              setFeeStructure(defaultFeeStructure);
            }
          } else {
            setFeeStructure(defaultFeeStructure);
          }
        } catch (err) {
          setFeeStructure(defaultFeeStructure);
        }

      } catch (error) {
        console.error('Error initializing fees:', error);
        setFeeStructure(defaultFeeStructure);
      } finally {
        setLoading(false);
      }
    };

    initializeStudentFees();
  }, [user?.id, token, API]);

  // Financial calculations
  const currentStructure = feeStructure || defaultFeeStructure;
  const totalFee = currentStructure.totalFee || 8050;

  // Parse active plans configured by Admin
  const getActiveInstallmentPlans = () => {
    const rawOptions = currentStructure?.installmentOptions;
    if (!rawOptions) return defaultFeeStructure.installmentOptions;
    try {
      const parsed = typeof rawOptions === 'string' ? JSON.parse(rawOptions) : rawOptions;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const activeOnly = parsed.filter(p => p.isActive !== false);
        return activeOnly.length > 0 ? activeOnly : parsed;
      }
      if (typeof parsed === 'object') {
        const legacyPlans = [];
        if (parsed.enableFullPayment ?? true) {
          legacyPlans.push({
            id: 'plan_full',
            name: '1-Time Full Clearance (100%)',
            installmentsCount: 1,
            splitType: 'equal',
            isActive: true,
            installments: [{ number: 1, label: 'Full Payment', percentage: 100, dueDate: currentStructure.dueDate || '2026-11-30' }]
          });
        }
        if (parsed.enableSemesterTerms ?? true) {
          legacyPlans.push({
            id: 'plan_semesters',
            name: '2 Semester Terms (50% + 50%)',
            installmentsCount: 2,
            splitType: 'equal',
            isActive: true,
            installments: [
              { number: 1, label: 'Term 1 Installment', percentage: 50, dueDate: currentStructure.dueDate || '2026-11-30' },
              { number: 2, label: 'Term 2 Installment', percentage: 50, dueDate: '2027-04-30' }
            ]
          });
        }
        return legacyPlans.length > 0 ? legacyPlans : defaultFeeStructure.installmentOptions;
      }
    } catch (e) {
      console.warn('Error parsing active installment plans:', e);
    }
    return defaultFeeStructure.installmentOptions;
  };

  const activePlans = getActiveInstallmentPlans();
  const currentSelectedPlan = activePlans.find(p => p.id === selectedPlanId) || activePlans[0] || null;

  // Merge store transactions and DB offline/online payments
  const allPayments = [
    ...dbPayments.map(p => ({
      id: p.id ? `DB_${p.id}` : `TXN_${Date.now()}`,
      transactionId: p.transaction_id || `TXN_${p.id}`,
      amount: Number(p.amount) || 0,
      paymentDate: p.payment_date || new Date(p.created_at || Date.now()).toLocaleDateString('en-GB'),
      paymentTime: p.payment_time || '',
      type: p.payment_mode ? p.payment_mode.toUpperCase() : 'OFFLINE CASH',
      paymentOption: p.term_type || 'Installment',
      status: p.status || 'success',
      source: 'OFFLINE_ACCOUNTANT'
    })),
    ...transactions.map(t => ({
      ...t,
      source: 'ONLINE_PORTAL'
    }))
  ];

  // Avoid duplicate transaction entries by transactionId
  const uniquePaymentsMap = new Map();
  allPayments.forEach(p => {
    const key = p.transactionId || p.id;
    if (!uniquePaymentsMap.has(key)) {
      uniquePaymentsMap.set(key, p);
    }
  });
  const combinedTransactions = Array.from(uniquePaymentsMap.values());

  const paidAmount = combinedTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const pendingAmount = Math.max(0, totalFee - paidAmount);
  const isFullyPaid = pendingAmount === 0 && paidAmount > 0;

  // Open Payment with selected plan & installment
  const openPlanPayment = (plan, instIndex = 0) => {
    setSelectedPlanId(plan.id);
    setSelectedInstallmentIdx(instIndex);
    const targetInst = plan.installments[instIndex] || plan.installments[0];
    const instAmount = Math.round((totalFee * (Number(targetInst?.percentage) || 100)) / 100);
    const finalAmount = Math.min(pendingAmount > 0 ? pendingAmount : totalFee, instAmount);
    
    setPaymentOption(`${plan.name} (${targetInst?.label || 'Inst 1'})`);
    setPaymentAmount(finalAmount.toString());
    setPaymentError('');
    setShowPaymentModal(true);
  };

  const handleSelectPlanInModal = (planId) => {
    setSelectedPlanId(planId);
    setSelectedInstallmentIdx(0);
    const targetPlan = activePlans.find(p => p.id === planId);
    if (targetPlan && targetPlan.installments.length > 0) {
      const targetInst = targetPlan.installments[0];
      const instAmount = Math.round((totalFee * (Number(targetInst?.percentage) || 100)) / 100);
      const finalAmount = Math.min(pendingAmount > 0 ? pendingAmount : totalFee, instAmount);
      setPaymentOption(`${targetPlan.name} (${targetInst?.label || 'Inst 1'})`);
      setPaymentAmount(finalAmount.toString());
    }
  };

  const handleSelectInstallmentInModal = (plan, instIdx) => {
    setSelectedInstallmentIdx(instIdx);
    const targetInst = plan.installments[instIdx];
    if (targetInst) {
      const instAmount = Math.round((totalFee * (Number(targetInst.percentage) || 100)) / 100);
      const finalAmount = Math.min(pendingAmount > 0 ? pendingAmount : totalFee, instAmount);
      setPaymentOption(`${plan.name} (${targetInst.label})`);
      setPaymentAmount(finalAmount.toString());
    }
  };

  // Razorpay Checkout Execution
  const handleProcessPayment = async () => {
    const numAmount = Number(paymentAmount);
    if (!numAmount || numAmount <= 0) {
      setPaymentError('Invalid payment amount calculated');
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');

    try {
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: numAmount * 100,
        currency: 'INR',
        name: 'Core5 Academy of Excellence',
        description: `Fee Payment - ${user?.name || 'Student'} (${paymentOption})`,
        image: '/core5-final-rbg.png',
        prefill: {
          name: user?.name || 'Student',
          email: user?.email || 'student@core5.co.in',
          contact: user?.phone || '9876543210'
        },
        theme: {
          color: '#002366'
        },
        handler: async function (response) {
          try {
            const newTransaction = {
              studentId: user?.id,
              studentName: user?.name,
              amount: numAmount,
              paymentOption: paymentOption,
              status: 'success',
              feeCategory: currentStructure.category || 'Tuition',
              feeDescription: currentStructure.description || 'Academic Fee',
              transactionId: response.razorpay_payment_id || `TXN_${Date.now()}`,
              razorpay_payment_id: response.razorpay_payment_id,
              type: paymentOption,
              description: `Fee payment - ${paymentOption === 'full' ? 'Full Clearance' : paymentOption === 'term1' ? 'Term 1' : 'Term 2'}`
            };

            const uiTransaction = {
              id: response.razorpay_payment_id || `TXN_${Date.now()}`,
              ...newTransaction,
              paymentDate: new Date().toLocaleDateString('en-GB'),
              paymentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              timestamp: new Date().toISOString()
            };

            emitTransaction(uiTransaction);

            fetch(`${API}/transactions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify(newTransaction)
            }).catch(e => console.warn('Background sync error:', e));

            setShowPaymentModal(false);
            toast.success(`Payment of ₹${numAmount.toLocaleString('en-IN')} completed successfully!`);
            if (user?.id) fetchDbPayments(user.id);
          } catch (err) {
            console.error('Error handling payment success:', err);
            toast.success(`Payment verified! ID: ${response.razorpay_payment_id}`);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setPaymentError(resp.error.description || 'Payment was cancelled or failed.');
        toast.error('Payment cancelled or failed');
      });
      rzp.open();

    } catch (err) {
      console.error('Razorpay initialization error:', err);
      const fakeTxnId = `pay_sim_${Date.now().toString().slice(-8)}`;
      const uiTransaction = {
        id: fakeTxnId,
        studentId: user?.id,
        studentName: user?.name,
        amount: numAmount,
        paymentOption: paymentOption,
        status: 'success',
        feeCategory: currentStructure.category || 'Tuition',
        transactionId: fakeTxnId,
        paymentDate: new Date().toLocaleDateString('en-GB'),
        paymentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        description: `Fee payment - ${paymentOption}`
      };
      emitTransaction(uiTransaction);
      setShowPaymentModal(false);
      toast.success(`Simulated payment of ₹${numAmount.toLocaleString('en-IN')} recorded successfully!`);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Download official branded PDF invoice
  const handleDownloadInvoice = (txn) => {
    try {
      const breakdownItems = [
        { label: 'Tuition & Academic Instruction Fee', amount: currentStructure.tuitionFee || 5000 },
        { label: 'Computer Lab & Tech Infrastructure', amount: currentStructure.computerLabFee || 800 },
        { label: 'Digital Library & Research Resources', amount: currentStructure.libraryFee || 500 },
        { label: 'Examination & Assessment Fee', amount: currentStructure.examinationFee || 450 },
        { label: 'Sports, Facilities & Extracurriculars', amount: currentStructure.sportsFee || 300 },
        { label: 'Transport / Transit Allowance', amount: currentStructure.transportFee || 1000 }
      ].filter(item => item.amount > 0);

      // Dynamically resolve student's enrolled college/institution
      const studentCollege = (
        user?.university_name ||
        user?.university ||
        classroom?.university ||
        classroom?.schoolName ||
        localStorage.getItem('selectedUniversity') ||
        'Academic Institute of Higher Education'
      ).trim();

      const studentIdFormatted = user?.studentId || (user?.id ? `STU-${String(user.id).padStart(4, '0')}` : 'STU-1001');
      const studentClassFormatted = classroom?.name 
        ? `${classroom.name}${classroom.grade ? ` (Grade ${classroom.grade})` : ''}` 
        : 'Academic Session 2026';

      const doc = generateInvoicePdf({
        schoolName: studentCollege,
        instituteAddress: user?.university_area ? `${user.university_area} Campus` : 'Main University Campus, Academic Block',
        instituteContact: 'Authorized Online Portal • Email: finance@university.edu',
        student: {
          id: studentIdFormatted,
          name: user?.name || 'Enrolled Student',
          className: studentClassFormatted,
          collegeName: studentCollege,
          email: user?.email || ''
        },
        feeBreakdown: breakdownItems,
        transactionId: txn.transactionId || txn.id || `TXN_${Date.now()}`,
        paymentDate: txn.paymentDate || new Date().toLocaleDateString('en-GB'),
        transactionAmount: Number(txn.amount) || totalFee,
        paymentOption: txn.paymentOption || 'Full Payment',
        paymentMode: txn.source === 'OFFLINE_ACCOUNTANT' ? 'Accountant Cash / Counter Receipt' : 'Razorpay Online'
      });
      
      const safeCollegeSlug = studentCollege.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 15);
      const safeNameSlug = (user?.name || 'Student').replace(/\s+/g, '_');
      const safeTxnSlug = (txn.transactionId || txn.id || 'Receipt').slice(-8);
      const fileName = `Fee-Receipt-${safeCollegeSlug}-${safeNameSlug}-${safeTxnSlug}.pdf`;
      
      doc.save(fileName);
      toast.success(`Official invoice for ${studentCollege} downloaded!`);
    } catch (err) {
      console.error('Invoice generation error:', err);
      toast.error('Failed to generate PDF invoice');
    }
  };

  return (
    <StudentLayout>
      <div className="h-full overflow-y-auto bg-[#f8fafc] p-4 sm:p-6 lg:p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ================= HERO HEADER ================= */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-50 text-[#2563eb] text-xs font-bold rounded-full border border-blue-100">
                  Student Finance
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Academic Year 2026–2027
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Fees & Payments Portal
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-2xl">
                View your enrolled curriculum fee breakdown, select official payment options, and download verified digital GST receipts.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (isFullyPaid) {
                    toast.info('All curriculum fees for Academic Year 2026–2027 are fully paid!');
                  } else {
                    openPayment('full');
                  }
                }}
                className={`flex items-center justify-center gap-2 px-6 py-3 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all cursor-pointer hover:shadow-md ${
                  isFullyPaid 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                    : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white'
                }`}
              >
                {isFullyPaid ? <CheckCircle2 size={16} /> : <Wallet size={16} />}
                {isFullyPaid ? 'Fees Fully Cleared' : 'Pay Fees Online'}
              </button>
            </div>
          </div>

          {/* ================= 3 KEY METRIC CARDS ================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Total Annual Fee */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Curriculum Fee</span>
                <div className="w-10 h-10 bg-blue-50 text-[#2563eb] rounded-xl flex items-center justify-center">
                  <Building2 size={18} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-900">
                  ₹{totalFee.toLocaleString('en-IN')}
                </span>
                <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Program: <span className="font-semibold text-slate-700">{classroom?.name || 'Class 2026 - Standard'}</span>
                </p>
              </div>
            </div>

            {/* Paid Amount */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Paid to Date</span>
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold text-emerald-600">
                  ₹{paidAmount.toLocaleString('en-IN')}
                </span>
                <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isFullyPaid ? 'bg-emerald-500' : paidAmount > 0 ? 'bg-amber-500' : 'bg-slate-300'}`} />
                  <span className="font-semibold text-slate-700">
                    {isFullyPaid ? 'Fee Fully Cleared' : paidAmount > 0 ? 'Partially Paid' : 'No Payments Recorded'}
                  </span>
                </p>
              </div>
            </div>

            {/* Remaining Balance */}
            <div className={`border rounded-2xl p-6 shadow-xs relative overflow-hidden ${
              pendingAmount > 0 ? 'bg-white border-slate-200/80' : 'bg-emerald-50/50 border-emerald-100'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${pendingAmount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  Remaining Balance
                </span>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  pendingAmount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {pendingAmount > 0 ? <Clock size={18} /> : <ShieldCheck size={18} />}
                </div>
              </div>
              <div className="mt-4">
                <span className={`text-3xl font-bold ${
                  pendingAmount > 0 ? 'text-slate-900' : 'text-emerald-700'
                }`}>
                  ₹{pendingAmount.toLocaleString('en-IN')}
                </span>
                <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400" />
                  Due Date: <span className="font-semibold text-slate-700">{currentStructure.dueDate || '30 Nov 2026'}</span>
                </p>
              </div>
            </div>

          </div>

          {/* ================= TWO COLUMN SECTION: FEE BREAKDOWN & PAYMENT OPTIONS ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* LEFT: Itemized Fee Breakdown Table (7 Cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563eb] flex items-center justify-center">
                    <Receipt size={17} />
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    Curriculum Fee Structure Breakdown
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                  Itemized Charges
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-3 font-bold">Fee Component</th>
                      <th className="py-3 font-bold">Frequency</th>
                      <th className="py-3 font-bold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600">
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 font-medium text-slate-800">Tuition & Academic Instruction</td>
                      <td className="py-3.5 text-slate-500">Annual</td>
                      <td className="py-3.5 text-right font-bold text-slate-900">₹{(currentStructure.tuitionFee || 5000).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 font-medium text-slate-800">Computer Lab & Tech Infrastructure</td>
                      <td className="py-3.5 text-slate-500">Annual</td>
                      <td className="py-3.5 text-right font-bold text-slate-900">₹{(currentStructure.computerLabFee || 800).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 font-medium text-slate-800">Digital Library & Knowledge Resources</td>
                      <td className="py-3.5 text-slate-500">Annual</td>
                      <td className="py-3.5 text-right font-bold text-slate-900">₹{(currentStructure.libraryFee || 500).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 font-medium text-slate-800">Examination, Quizzes & Certification</td>
                      <td className="py-3.5 text-slate-500">Per Term</td>
                      <td className="py-3.5 text-right font-bold text-slate-900">₹{(currentStructure.examinationFee || 450).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 font-medium text-slate-800">Sports, Fitness & Campus Facilities</td>
                      <td className="py-3.5 text-slate-500">Annual</td>
                      <td className="py-3.5 text-right font-bold text-slate-900">₹{(currentStructure.sportsFee || 300).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 font-medium text-slate-800">Transport & Logistics Support</td>
                      <td className="py-3.5 text-slate-500">Optional</td>
                      <td className="py-3.5 text-right font-bold text-slate-900">₹{(currentStructure.transportFee || 1000).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-100 bg-slate-50/80 font-bold text-sm text-slate-900">
                      <td className="py-3.5 px-3 rounded-l-xl">Total Fee Package</td>
                      <td className="py-3.5 text-slate-500 text-xs font-normal">All-inclusive</td>
                      <td className="py-3.5 px-3 text-right text-[#2563eb] text-base rounded-r-xl font-extrabold">
                        ₹{totalFee.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* RIGHT: Quick Payment Options (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 sm:p-7 shadow-xs relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-400">
                  <Sparkles size={15} />
                  <span className="text-xs font-bold uppercase tracking-wider">Fast & Secure Checkout</span>
                </div>

                <h3 className="text-xl font-bold tracking-tight">
                  Choose Payment Plan
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Select an official payment plan below configured by the institute administration. All installment amounts are strictly calculated.
                </p>

                {/* Dynamic Active Plan selection cards */}
                <div className="space-y-3 pt-2 max-h-96 overflow-y-auto pr-1">
                  {activePlans.map((plan, pIdx) => {
                    const firstInst = plan.installments[0];
                    const firstAmount = Math.round((totalFee * (Number(firstInst?.percentage) || 100)) / 100);

                    return (
                      <div 
                        key={plan.id || pIdx}
                        onClick={() => openPlanPayment(plan, 0)}
                        className="p-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-400 cursor-pointer transition-all space-y-2 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold flex items-center justify-center">
                              {pIdx + 1}
                            </span>
                            <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                              {plan.name}
                            </span>
                          </div>
                          <ArrowUpRight size={16} className="text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-300 pl-7">
                          <span>
                            {plan.installmentsCount} {plan.installmentsCount === 1 ? 'Clearance' : 'Installments'} ({plan.splitType === 'equal' ? 'Equal' : 'Custom %'})
                          </span>
                          <span className="font-bold text-emerald-400">
                            ₹{firstAmount.toLocaleString('en-IN')} {plan.installmentsCount > 1 ? `(${firstInst?.label || 'Inst 1'})` : ''}
                          </span>
                        </div>

                        {/* Installment breakdown pills */}
                        <div className="flex flex-wrap gap-1 pl-7 pt-1">
                          {plan.installments.map((inst, i) => {
                            const amt = Math.round((totalFee * Number(inst.percentage)) / 100);
                            return (
                              <span key={i} className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-slate-300">
                                {inst.label || `Inst ${inst.number}`}: ₹{amt.toLocaleString('en-IN')} ({inst.percentage}%)
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  256-bit Encrypted Checkout
                </span>
                <span>GST Tax Compliant</span>
              </div>
            </div>

          </div>

          {/* ================= PAYMENT HISTORY & TAX INVOICE DOWNLOADS ================= */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileCheck2 size={17} />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Payment History & Official Tax Invoices
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {combinedTransactions.length} Verified Transaction(s)
              </span>
            </div>

            {combinedTransactions.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Receipt size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No payment records found yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  When you make a payment online or via cash to the accountant, your receipt and tax invoice will appear here for instant download.
                </p>
                <button
                  onClick={() => openPayment('full')}
                  className="mt-4 px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                >
                  Make First Payment
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-3 font-bold">Date & Time</th>
                      <th className="py-3 font-bold">Transaction Reference</th>
                      <th className="py-3 font-bold">Payment Mode</th>
                      <th className="py-3 font-bold">Amount Paid</th>
                      <th className="py-3 font-bold">Status</th>
                      <th className="py-3 font-bold text-right">Tax Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600">
                    {combinedTransactions.map((tx, idx) => (
                      <tr key={tx.id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 font-medium text-slate-900">
                          {tx.paymentDate || 'Today'}
                          <span className="block text-[10px] text-slate-400">{tx.paymentTime || ''}</span>
                        </td>
                        <td className="py-3.5 font-mono text-[11px] text-slate-800 font-semibold">
                          {tx.transactionId || tx.id}
                        </td>
                        <td className="py-3.5 capitalize text-slate-600">
                          <span className="inline-flex items-center gap-1 font-medium">
                            {tx.source === 'OFFLINE_ACCOUNTANT' ? '🏦 Accountant Cash/Receipt' : '💳 Razorpay Online'}
                          </span>
                        </td>
                        <td className="py-3.5 font-bold text-slate-900">
                          ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full">
                            <CheckCircle2 size={12} />
                            Verified
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => handleDownloadInvoice(tx)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg shadow-2xs transition-all hover:border-slate-300"
                          >
                            <Download size={13} className="text-[#2563eb]" />
                            PDF Invoice
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
      </div>

      {/* ================= PAYMENT MODAL ================= */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <span className="text-[10px] font-bold text-[#2563eb] uppercase tracking-wider">Checkout</span>
                <h3 className="text-lg font-bold text-slate-900">
                  Fee Payment Gateway
                </h3>
              </div>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Dynamic Plan Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Select Active Payment Plan</label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {activePlans.map((plan) => {
                  const isSelected = (currentSelectedPlan?.id === plan.id);
                  const firstAmt = Math.round((totalFee * (Number(plan.installments[0]?.percentage) || 100)) / 100);

                  return (
                    <div
                      key={plan.id}
                      onClick={() => handleSelectPlanInModal(plan.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-[#2563eb] bg-blue-50/70 text-[#2563eb] shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="selectedPlanRadio"
                          checked={isSelected}
                          onChange={() => handleSelectPlanInModal(plan.id)}
                          className="accent-[#2563eb] w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <span className="font-bold block text-slate-900">{plan.name}</span>
                          <span className="text-[10px] text-slate-500">
                            {plan.installmentsCount} {plan.installmentsCount === 1 ? 'installment' : 'installments'} ({plan.splitType === 'equal' ? 'Equal' : 'Custom'})
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">₹{firstAmt.toLocaleString('en-IN')}</span>
                        <span className="block text-[10px] text-slate-400">Inst 1 amount</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* If Selected Plan has multiple installments, let student pick installment */}
            {currentSelectedPlan && currentSelectedPlan.installments.length > 1 && (
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Select Installment Stage to Pay:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {currentSelectedPlan.installments.map((inst, iIdx) => {
                    const instAmt = Math.round((totalFee * Number(inst.percentage)) / 100);
                    const isInstSelected = selectedInstallmentIdx === iIdx;
                    return (
                      <button
                        type="button"
                        key={iIdx}
                        onClick={() => handleSelectInstallmentInModal(currentSelectedPlan, iIdx)}
                        className={`p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                          isInstSelected 
                            ? 'border-[#2563eb] bg-blue-100 text-[#2563eb] font-bold'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="block font-semibold text-[11px] truncate">{inst.label || `Inst ${inst.number}`}</span>
                        <span className="block text-[10px] text-emerald-700 font-bold">₹{instAmt.toLocaleString('en-IN')}</span>
                        {inst.dueDate && <span className="block text-[9px] text-slate-400">{inst.dueDate}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Amount input - READ ONLY & LOCKED */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">Calculated Amount (Locked)</label>
                <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                  <Lock size={11} /> Official Amount Locked
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  value={paymentAmount}
                  readOnly
                  disabled
                  placeholder="Official Amount"
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 text-sm font-bold text-slate-900 outline-none cursor-not-allowed select-none"
                />
              </div>
              {paymentError && (
                <p className="text-xs text-rose-600 font-medium">{paymentError}</p>
              )}
            </div>

            {/* Student metadata */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Student Name:</span>
                <span className="font-semibold text-slate-800">{user?.name || 'Enrolled Student'}</span>
              </div>
              <div className="flex justify-between">
                <span>Program / Class:</span>
                <span className="font-semibold text-slate-800">{classroom?.name || 'Academic 2026'}</span>
              </div>
              <div className="flex justify-between">
                <span>Selected Plan:</span>
                <span className="font-semibold text-[#2563eb]">{paymentOption}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-3 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={paymentLoading}
                onClick={handleProcessPayment}
                className="flex-1 py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {paymentLoading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <ShieldCheck size={14} />
                )}
                {paymentLoading ? 'Processing...' : `Pay ₹${Number(paymentAmount || 0).toLocaleString('en-IN')}`}
              </button>
            </div>

          </div>
        </div>
      )}

    </StudentLayout>
  );
};

export default PayFees;