import { useState } from "react";
import CreateEventModal from "./CreateEventModal";

const CalendarSidebar = ({ role, onEventCreated }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <div className="w-64 border-r p-4 bg-gray-50">
      {(role === "admin" || role === "mentor") && (
        <>
          <button
            data-tour="calendar-create-event"
            onClick={() => {
              setOpen(true);
              setMessage("");
            }}
            className="w-full mb-4 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            + Create Event
          </button>

          {message && (
            <div className="mb-4 p-2 bg-green-100 text-green-700 text-sm rounded">
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
                onEventCreated(); // 🔥 REFRESH CALENDAR
                setTimeout(() => setMessage(""), 3000);
              }}
            />
          )}
        </>
      )}

      <p className="text-sm text-gray-500 mt-4">
        {role === "student"
          ? "📅 You can view calendar events"
          : role === "admin"
          ? "📅 Create events for specific roles"
          : "📅 Create course-specific events"}
      </p>
    </div>
  );
};

export default CalendarSidebar;
