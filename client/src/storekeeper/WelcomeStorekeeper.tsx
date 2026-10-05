import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/auth";
import { useTranslation } from "../context/TranslationContext";
import {
  Calendar,
  Clock,
} from "lucide-react";

export default function WelcomeStorekeeper() {
  const { token, API } = useAuth();
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#fffdf4] overflow-y-auto p-6">
      <div className="text-center p-8 max-w-3xl w-full bg-white border border-[#ebdcaa] rounded-none shadow-sm">
        {/* Logo and Welcome Message */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#B99652]/10 text-[#B99652] border border-[#ebdcaa] rounded-none mb-6">
            <span className="text-3xl font-bold font-['DM_Serif_Display',serif]">SK</span>
          </div>
          <h1 className="text-4xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-2">
            Storekeeper Portal
          </h1>
          <p className="text-xs uppercase tracking-wider text-[#B99652] font-semibold mb-3">
            Core5 Academy — Inventory & Logistics Management
          </p>
          <p className="text-sm text-slate-600">
            Welcome back, <span className="font-semibold text-[#1e1b4b]">{user.name || "Storekeeper"}</span>
          </p>
        </div>

        {/* Date and Time Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto mb-4">
          <div className="bg-[#fffdf4] text-[#1e1b4b] border border-[#ebdcaa] rounded-none p-5 text-left">
            <div className="flex items-center gap-2 mb-2 text-[#B99652]">
              <Calendar size={18} />
              <span className="text-xs uppercase tracking-wider font-semibold">Today's Date</span>
            </div>
            <p className="text-lg font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b]">{formatDate(currentTime)}</p>
          </div>
          <div className="bg-[#fffdf4] text-[#1e1b4b] border border-[#ebdcaa] rounded-none p-5 text-left">
            <div className="flex items-center gap-2 mb-2 text-[#B99652]">
              <Clock size={18} />
              <span className="text-xs uppercase tracking-wider font-semibold">Current Time</span>
            </div>
            <p className="text-lg font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b]">{formatTime(currentTime)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
