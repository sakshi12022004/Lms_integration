import React, { useMemo, useState } from "react";
import { generateInvoicePdf } from "./invoice";
import PaymentModal from "./PaymentModal";
import { useTranslation } from "../context/TranslationContext";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Download, CreditCard } from 'lucide-react';
import { useTransactionStore } from "../store/transactionStore";

type PaymentStatus = "Paid" | "Partial" | "Pending";

interface Student {
  id: string;
  className: string;
  name: string;
  paymentStatus: PaymentStatus;
  feeStructure: { label: string; amount: number }[];
  transactions: { id: string; amount: number; date: string }[];
}

const sampleStudents: Student[] = [
  {
    id: "S1001",
    className: "1",
    name: "Alice Johnson",
    paymentStatus: "Paid",
    feeStructure: [
      { label: "Tuition", amount: 5000 },
      { label: "Transport", amount: 1000 },
    ],
    transactions: [{ id: "T1", amount: 6000, date: "2025-12-01" }],
  },
  {
    id: "S1002",
    className: "5",
    name: "Bob Kumar",
    paymentStatus: "Partial",
    feeStructure: [
      { label: "Tuition", amount: 8000 },
      { label: "Lab", amount: 2000 },
    ],
    transactions: [{ id: "T2", amount: 4000, date: "2026-01-05" }],
  },
  {
    id: "S1003",
    className: "2",
    name: "Charlie Singh",
    paymentStatus: "Pending",
    feeStructure: [
      { label: "Tuition", amount: 5000 },
      { label: "Library", amount: 500 },
    ],
    transactions: [],
  },
];

export default function FeesCollection({ category }: { category?: "Primary" | "Secondary" }) {
  const { t } = useTranslation();
  const [payFor, setPayFor] = useState<Student | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"Primary"|"Secondary">(category || "Primary");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { getPaymentStats, transactions } = useTransactionStore();

  // Get real-time payment statistics (updated when transactions change)
  const paymentStats = getPaymentStats();

  // Use sample students for display, charts/stats update from real transactions
  const students = useMemo(() => {
    const filtered = sampleStudents.filter((s) => {
      const cls = parseInt(s.className, 10);
      return activeCategory === "Primary" ? cls >= 1 && cls <= 4 : cls >= 5 && cls <= 12;
    });

    const searched = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.id.toLowerCase().includes(query.toLowerCase())
    );

    if (!sortKey) return searched;
    const sorted = [...searched].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [activeCategory, query, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function downloadInvoice(s: Student) {
    const doc = generateInvoicePdf({
      schoolName: "Demo School",
      student: { id: s.id, name: s.name, className: s.className },
      feeBreakdown: s.feeStructure,
      transactionId: s.transactions?.[0]?.id || "-",
      paymentDate: s.transactions?.[0]?.date || new Date().toISOString().slice(0, 10),
    });
    doc.save(`${s.id}-invoice.pdf`);
  }

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">{t('fees_collection')}</h1>
        <p className="text-slate-600">{t('manage_student_fee_payments')}</p>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveCategory('Primary')}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            activeCategory === 'Primary'
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
              : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-400'
          }`}
        >
          {t('primary')} (1-4)
        </button>
        <button
          onClick={() => setActiveCategory('Secondary')}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            activeCategory === 'Secondary'
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
              : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-400'
          }`}
        >
          {t('secondary')} (5-12)
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          className="w-full md:w-80 px-4 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
          placeholder="🔍 {t('search_items')}"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Summary Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">{t('total_students')}</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{students.length}</p>
            </div>
            <div className="text-blue-100 text-4xl">👥</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">{t('paid')}</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{paymentStats.paid}</p>
            </div>
            <div className="text-green-100 text-4xl">✓</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">{t('partial_payment')}</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{paymentStats.partial}</p>
            </div>
            <div className="text-yellow-100 text-4xl">⚠</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">{t('pending')}</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{paymentStats.pending}</p>
            </div>
            <div className="text-red-100 text-4xl">✕</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition">
          <h3 className="text-lg font-bold text-slate-800 mb-4">{t('payment_status')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={[
                  { name: t('paid'), value: paymentStats.paid },
                  { name: t('partial_payment'), value: paymentStats.partial },
                  { name: t('pending'), value: paymentStats.pending },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill="#00C49F" />
                <Cell fill="#FFBB28" />
                <Cell fill="#FF8042" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition">
          <h3 className="text-lg font-bold text-slate-800 mb-4">{t('students')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={students.reduce((acc, s) => {
                const cls = acc.find(c => c.class === s.className);
                if (cls) cls.count += 1;
                else acc.push({ class: `Class ${s.className}`, count: 1 });
                return acc;
              }, [])}
            >
              <XAxis dataKey="class" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
            <tr className="text-left">
              <th className="p-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-200" onClick={() => toggleSort("id")}>{t('student_name')}</th>
              <th className="p-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-200" onClick={() => toggleSort("className")}>{t('class')}</th>
              <th className="p-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-200" onClick={() => toggleSort("name")}>{t('name')}</th>
              <th className="p-3 font-semibold text-slate-700">{t('status')}</th>
              <th className="p-3 font-semibold text-slate-700">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-medium text-slate-900">{s.id}</td>
                <td className="p-3 text-slate-700">{s.className}</td>
                <td className="p-3 text-slate-700">{s.name}</td>
                <td className="p-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      s.paymentStatus === "Paid"
                        ? "bg-green-100 text-green-700"
                        : s.paymentStatus === "Partial"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {s.paymentStatus}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadInvoice(s)}
                      className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition font-medium text-sm"
                      title="Download Invoice"
                    >
                      <Download size={16} /> {t('invoice')}
                    </button>
                    <button
                      onClick={() => setPayFor(s)}
                      className="inline-flex items-center gap-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-3 py-1.5 rounded-lg transition font-medium text-sm"
                      title="Process Payment"
                    >
                      <CreditCard size={16} /> {t('place_order')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {payFor && <PaymentModal student={{ id: payFor.id, name: payFor.name }} onClose={() => setPayFor(null)} />}
    </div>
  );
}
