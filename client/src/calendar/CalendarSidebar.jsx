import { useState } from "react";
import CreateEventModal from "./CreateEventModal";
import { Plus, Clock } from "lucide-react";

const CalendarSidebar = ({ role, onEventCreated }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <div className="w-64 border-r border-[#ebdcaa]/50 p-5 bg-[#fffdf4]/80 flex flex-col justify-between shrink-0">
      <div>
        {(role === "admin" || role === "mentor") && (
          <>
            <button
              data-tour="calendar-create-event"
              onClick={() => {
                setOpen(true);
                setMessage("");
              }}
              className="w-full mb-4 bg-[#B99652] hover:bg-[#a38241] text-white py-2.5 px-4 rounded-none font-semibold text-sm shadow-sm hover:shadow transition flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              <span>Create Event</span>
            </button>

            {message && (
              <div className="mb-4 p-2.5 bg-green-100/80 border border-green-200 text-green-800 text-xs rounded-lg font-medium animate-fade-in">
                {message}
              </div>
            )}

            {open && (
              <CreateEventModal
                role={role}
                onClose={() => setOpen(false)}
                onSuccess={() => {
                  setOpen(false);
                  setMessage("Event created successfully!");
                  onEventCreated();
                  setTimeout(() => setMessage(""), 3000);
                }}
              />
            )}
          </>
        )}

        <div className="space-y-4 mt-2">
          <div className="p-3.5 bg-white rounded-none border border-[#ebdcaa]/60 shadow-sm text-xs space-y-2">
            <div className="font-bold text-[#1e1b4b] flex items-center gap-1.5">
              <Clock size={14} className="text-[#B99652]" />
              <span>Event Categories</span>
            </div>
            <div className="space-y-1.5 text-gray-600">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#2563eb]"></span>
                <span>Live Class</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#10b981]"></span>
                <span>Assignment</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#ef4444]"></span>
                <span>Examination</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#8b5cf6]"></span>
                <span>Holiday / General</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 bg-amber-500/10 border border-amber-300/30 rounded-none text-[11px] text-amber-900 font-medium mt-4">
        {role === "student"
          ? "View scheduled classes, assignment deadlines, and exam dates."
          : role === "admin"
          ? "Schedule and manage events across all departments."
          : "Create classroom schedules and assessment deadlines."}
      </div>
    </div>
  );
};

export default CalendarSidebar;
