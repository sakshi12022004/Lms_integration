import { useEffect, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import axios from "axios";
import { io } from 'socket.io-client';

import CalendarHeader from "./CalendarHeader";
import CalendarSidebar from "./CalendarSidebar";
import EditEventModal from "./EditEventModal";
import QuotaLimitModal from "../components/QuotaLimitModal";
import { useNavigate } from 'react-router-dom';
import "./calendar.css";

const CalendarPage = ({ role }) => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [error, setError] = useState(null);

  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("unstop_token");

  // Socket connection for real-time plan changes
  const [socket, setSocket] = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      if (!token) {
        setError("Please login first");
        return;
      }

      const apiUrl = import.meta.env.VITE_BACKEND_URL || "https://core5.io";
      // Ensure we don't double the /api prefix
      const baseUrl = apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl;
      
      const res = await axios.get(`${baseUrl}/api/calendar`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const formatted = res.data.map((e) => ({
        id: e.id || e._id,
        title: e.title,
        start: new Date(e.startDate),
        end: new Date(e.endDate),
        extendedProps: {
          createdByUser: e.createdByUser,
          createdByRole: e.createdByRole,
          publishFor: e.publishFor,
        },
        backgroundColor:
          e.createdByRole === "admin" ? "#2563eb" : "#16a34a",
      }));

      setEvents(formatted);
      setError(null);
      console.log(`✅ Fetched ${formatted.length} calendar events`);
    } catch (err) {
      console.error("Fetch events error", err);
      setError(err.response?.data?.message || "Failed to load events");
    }
  }, [token]);

  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaDetails, setQuotaDetails] = useState(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const navigate = useNavigate();

  const checkFeatureAccess = async () => {
    // DISABLED: Allow all users to access calendar without restrictions
    setIsCheckingAccess(false);
    return true;
  };

  useEffect(() => {
    // DISABLED: Simplified calendar access - no socket or periodic checks
    (async () => {
      console.log('🚀 Starting calendar page - direct access...');
      const ok = await checkFeatureAccess();
      if (ok) {
        console.log('✅ Access granted - fetching events...');
        await fetchEvents();
      }
    })();
  }, [fetchEvents]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <CalendarHeader />

      {error && (
        <div style={{ padding: "10px", backgroundColor: "#fee2e2", color: "#991b1b", borderBottom: "1px solid #fca5a5" }}>
          ⚠️ {error}
        </div>
      )}

      <QuotaLimitModal isOpen={showQuotaModal} onClose={() => { setShowQuotaModal(false); navigate(role === 'admin' ? '/admin/dashboard' : '/'); }} quotaDetails={quotaDetails} />

      <div style={{ flex: 1, display: "flex" }}>
        <CalendarSidebar role={role} onEventCreated={fetchEvents} />

        <div style={{ flex: 1, padding: "12px" }}>
          {isCheckingAccess ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#374151' }}>
              <p style={{ fontSize: 18 }}>Checking calendar access...</p>
              <p style={{ marginTop: 8 }}>Please wait while we verify your subscription.</p>
            </div>
          ) : showQuotaModal ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#374151' }}>
              <p style={{ fontSize: 18 }}>Access to the calendar is restricted on your current plan.</p>
              <p style={{ marginTop: 8 }}>Please upgrade your plan to use this feature.</p>
            </div>
          ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            events={events}
            eventClick={(info) => setSelectedEvent(info.event)}
            height="100%"
          />
          )}
        </div>
      </div>

      {/* EDIT / DELETE MODAL */}
      {selectedEvent && (
        <EditEventModal
          event={selectedEvent}
          role={role}
          onClose={() => setSelectedEvent(null)}
          onRefresh={fetchEvents}
        />
      )}
    </div>
  );
};

export default CalendarPage;
