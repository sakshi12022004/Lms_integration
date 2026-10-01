import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar as CalendarIcon } from "lucide-react";

const CalendarHeader = ({ role }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (role === "admin") navigate("/admin/dashboard");
    else if (role === "mentor") navigate("/mentor/dashboard");
    else if (role === "student") navigate("/student/dashboard");
    else navigate(-1);
  };

  return (
    <header className="bg-[#fffdf4]/95 backdrop-blur-md border-b border-[#ebdcaa]/50 px-6 py-3.5 flex items-center justify-between shadow-sm sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-none bg-white hover:bg-gray-100 text-gray-700 font-medium text-xs transition border border-gray-200 shadow-sm"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-[#B99652] text-white flex items-center justify-center shadow-sm">
            <CalendarIcon size={18} />
          </div>
          <h1 className="text-xl font-['DM_Serif_Display',serif] text-[#1e1b4b] tracking-wide">Academic Calendar</h1>
        </div>
      </div>
      <div className="text-xs font-semibold text-[#1e1b4b]/60 uppercase tracking-wider">
        {role ? `${role.toUpperCase()} PORTAL` : "CALENDAR"}
      </div>
    </header>
  );
};

export default CalendarHeader;
