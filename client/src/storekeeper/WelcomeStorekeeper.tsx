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
    <div className="flex items-center justify-center min-h-screen bg-gray-50 overflow-y-auto">
      <div className="text-center p-8 max-w-4xl">
        {/* Logo and Welcome Message */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full mb-6 shadow-2xl">
            <span className="text-4xl font-bold text-white">SK</span>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            Welcome Storekeeper
          </h1>
          <p className="text-xl text-gray-700 mb-2">
            CORE5 ACADEMY - Inventory Management
          </p>
          <p className="text-lg text-gray-600">
            Hello, <span className="font-semibold text-orange-600">{user.name || "Storekeeper"}</span>
          </p>
        </div>

        {/* Date and Time Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Calendar size={24} />
              <span className="font-semibold">Today's Date</span>
            </div>
            <p className="text-2xl font-bold">{formatDate(currentTime)}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Clock size={24} />
              <span className="font-semibold">Current Time</span>
            </div>
            <p className="text-2xl font-bold">{formatTime(currentTime)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
