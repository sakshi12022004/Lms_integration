import React, { useState } from 'react';
import { ShieldCheck, CheckCircle, FileText, Lock } from 'lucide-react';

const ControlledTermsModal = ({ isOpen, onAccept }) => {
  if (!isOpen) return null;

  const ModalContent = () => {
    const [acknowledged, setAcknowledged] = useState(false);

    const handleAccept = () => {
      if (acknowledged) {
        localStorage.setItem('termsAccepted', 'true');
        localStorage.setItem('termsAcceptedDate', new Date().toISOString());
        onAccept();
      }
    };

    return (
      <div className="fixed inset-0 bg-[#0b1026]/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
        <div className="bg-[#fffdf4] rounded-none max-w-4xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-[0_0_60px_rgba(0,35,102,0.45)] border-2 border-[#B99652] overflow-hidden">
          
          {/* Top Gold Bar */}
          <div className="h-1 bg-[#B99652]" />

          {/* Header */}
          <div className="bg-[#002366] text-white px-6 sm:px-8 py-5 flex justify-between items-center gap-4 flex-shrink-0 border-b border-[#B99652]/40">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-11 h-11 bg-[#B99652]/20 border border-[#B99652] text-[#B99652] flex items-center justify-center flex-shrink-0 rounded-none">
                <ShieldCheck size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold tracking-wide text-white">
                  Core5 LMS — Terms & Conditions
                </h2>
                <p className="text-[11px] sm:text-xs text-[#d9bf85] font-medium mt-0.5 uppercase tracking-[0.14em]">
                  Institutional Master Service & Usage Agreement
                </p>
              </div>
            </div>
            <div className="hidden sm:block px-3 py-1.5 border border-[#B99652] bg-[#B99652]/15 text-[#e6cf9c] text-[11px] font-semibold tracking-[0.14em] uppercase whitespace-nowrap rounded-none">
              Mandatory Review
            </div>
          </div>
          <div className="h-[2px] flex-shrink-0 bg-gradient-to-r from-[#B99652]/20 via-[#B99652] to-[#B99652]/20" />

          {/* Content Body */}
          <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 text-slate-700 text-sm leading-relaxed scrollable-content bg-[#fffdf4]">
            
            {/* Welcome Banner */}
            <div className="bg-white p-5 border border-[#ebdcaa] border-l-4 border-l-[#B99652] shadow-xs space-y-2 rounded-none">
              <h3 className="text-lg sm:text-xl text-[#002366] font-bold flex items-center gap-2.5">
                <FileText size={20} className="text-[#B99652] flex-shrink-0" />
                Welcome to Core5 LMS Enterprise Ecosystem
              </h3>
              <p className="text-slate-600 text-sm">
                Please read and review our Terms & Conditions carefully before using our institutional Learning Management System.
              </p>
            </div>

            {/* Terms Summary Notice */}
            <div className="p-4 bg-[#B99652]/10 border border-[#B99652]/30 border-l-4 border-l-[#B99652] text-[#5c4718] text-xs sm:text-sm font-medium rounded-none">
              PLEASE READ THESE TERMS AND CONDITIONS CAREFULLY BEFORE ACCESSING OR USING THE PLATFORM. BY REGISTERING, SUBSCRIBING, OR USING ANY PART OF OUR SERVICES, YOU AGREE TO BE BOUND BY THESE TERMS. IF YOU DO NOT AGREE, PLEASE DISCONTINUE USE IMMEDIATELY.
            </div>

            {/* Terms Content */}
            <div className="space-y-4">
              <div className="bg-white p-5 border border-[#ebdcaa] shadow-xs space-y-3 rounded-none">
                <h4 className="font-bold text-[#002366] text-base flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#B99652] text-white text-xs flex items-center justify-center font-bold rounded-none shrink-0">1</span>
                  Definitions & Scope
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 pl-8">
                  • <strong>Company / Platform:</strong> Core5 Technologies LMS accessible via web and mobile platforms.<br />
                  • <strong>User:</strong> Any authorized student, mentor, teacher, admin, or staff member.<br />
                  • <strong>Services:</strong> Courseware, live lectures, assignments, fee management, and performance analytics.
                </p>
              </div>

              <div className="bg-white p-5 border border-[#ebdcaa] shadow-xs space-y-3 rounded-none">
                <h4 className="font-bold text-[#002366] text-base flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#B99652] text-white text-xs flex items-center justify-center font-bold rounded-none shrink-0">2</span>
                  Acceptance & Institutional Compliance
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 pl-8">
                  By logging in, you confirm that you have provided authentic credentials, possess authority to access enrolled courses, and pledge to adhere to academic integrity standards.
                </p>
              </div>

              <div className="bg-white p-5 border border-[#ebdcaa] shadow-xs space-y-3 rounded-none">
                <h4 className="font-bold text-[#002366] text-base flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#B99652] text-white text-xs flex items-center justify-center font-bold rounded-none shrink-0">3</span>
                  Account Security & Privacy
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 pl-8">
                  You are responsible for keeping your login password confidential. Password sharing or unauthorized account access is strictly prohibited. Report security concerns to support@core5.co.in.
                </p>
              </div>

              <div className="bg-white p-5 border border-[#ebdcaa] shadow-xs space-y-3 rounded-none">
                <h4 className="font-bold text-[#002366] text-base flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#B99652] text-white text-xs flex items-center justify-center font-bold rounded-none shrink-0">4</span>
                  Fee Payments & Invoices
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 pl-8">
                  All fee payments (online & offline) generate official tax invoices. Tuition fees and payment dues are managed as per institutional fee schedules.
                </p>
              </div>
            </div>
          </div>

          {/* Footer & Acknowledgment */}
          <div className="border-t border-[#B99652]/40 p-5 sm:p-6 bg-[#fbf6e6] flex-shrink-0 space-y-4">
            <label
              htmlFor="acknowledge"
              className={`flex items-start bg-white p-3.5 border cursor-pointer transition-colors rounded-none ${
                acknowledged ? 'border-[#B99652]' : 'border-[#ebdcaa] hover:border-[#B99652]/70'
              }`}
            >
              <input
                type="checkbox"
                id="acknowledge"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#B99652] shrink-0 cursor-pointer rounded-none"
              />
              <span className="ml-3 text-xs sm:text-sm text-slate-700 leading-snug">
                <strong className="text-[#1e1b4b]">I acknowledge</strong> that I have read, understood, and agree to be bound by the Terms & Conditions of <strong className="text-[#1e1b4b]">Core5 LMS</strong>. I accept all user responsibilities outlined herein.
              </span>
            </label>

            <div className="flex justify-end">
              <button
                onClick={handleAccept}
                disabled={!acknowledged}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-none font-bold text-xs sm:text-sm uppercase tracking-[0.12em] transition-all active:scale-95 border ${
                  acknowledged
                    ? 'bg-[#B99652] hover:bg-[#a58342] border-[#B99652] text-white cursor-pointer shadow-[0_4px_14px_rgba(185,150,82,0.35)]'
                    : 'bg-[#ebe4cf] border-[#d8cea3] text-[#a89f85] cursor-not-allowed'
                }`}
              >
                <CheckCircle size={18} />
                Accept & Continue to Dashboard
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return <ModalContent />;
};

export default ControlledTermsModal;
