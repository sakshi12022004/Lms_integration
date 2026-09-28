import React from 'react';
import { useAuth } from "../../auth/auth";
import AccountantLayout from "../../components/AccountantLayout";
import { FileText } from "lucide-react";

const PaymentHistory = () => {
  const { user } = useAuth();

  return (
    <AccountantLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">💳 Payment History</h2>
          <p className="text-gray-400">View all student payment records and transaction history</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-12 text-center">
          <FileText size={64} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">No Payments Yet</h3>
          <p className="text-gray-400">Payment history will appear here once students make payments.</p>
        </div>
      </div>
    </AccountantLayout>
  );
};

export default PaymentHistory;
