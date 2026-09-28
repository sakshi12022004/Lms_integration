import { useEffect, useState } from "react";
import axios from "axios";

const CreateEventModal = ({ role, onClose, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [publishFor, setPublishFor] = useState("student");
  const [courseId, setCourseId] = useState("");
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔐 Get token (matches your authMiddleware)
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("unstop_token");

  // ================= LOAD MENTOR COURSES =================
  useEffect(() => {
    if (role === "mentor" && token) {
      const apiUrl = import.meta.env.VITE_BACKEND_URL || "https://core5.io";
      // Ensure we don't double the /api prefix
      const baseUrl = apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl;
      
      axios
        .get(`${baseUrl}/api/courses/mentor`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        .then((res) => {
          console.log('📚 Mentor courses loaded:', res.data.length, 'courses');
          setCourses(res.data);
        })
        .catch((err) => {
          console.error("Failed to load mentor courses", err);
        });
    }
  }, [role, token]);

  // ================= CREATE EVENT =================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      alert("Authentication token missing. Please login again.");
      return;
    }

    if (role === "mentor" && !courseId) {
      alert("Please select a course");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        title,
        description,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      };

      if (role === "admin") {
        payload.publishFor = publishFor;
        console.log(`📅 Creating admin event with publishFor: ${publishFor}`);
      }

      if (role === "mentor") {
        payload.courseId = courseId;
        console.log(`📅 Creating mentor event for course: ${courseId}`);
      }

      const apiUrl = import.meta.env.VITE_BACKEND_URL || "https://core5.io";
      // Ensure we don't double the /api prefix
      const baseUrl = apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl;
      
      const res = await axios.post(
        `${baseUrl}/api/calendar`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log(`✅ Calendar event created:`, res.data);

      // Observed by GuideBot (ActionGuard) only — fires strictly after the
      // create request has succeeded.
      window.dispatchEvent(
        new CustomEvent('guidebot:action-success', { detail: { actionId: 'calendar-event-created' } })
      );

      onSuccess(); // refresh calendar
      onClose();   // close modal
    } catch (error) {
      console.error("CREATE EVENT ERROR:", error.response?.data || error);
      alert(
        error.response?.data?.message ||
          "Failed to create event. Check backend logs."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div data-tour="calendar-create-event-modal" className="bg-white rounded-lg w-full max-w-lg p-6">
        <h2 className="text-xl font-bold mb-4">Create Calendar Event</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* TITLE */}
          <input
            type="text"
            placeholder="Event Title"
            className="w-full border rounded px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {/* DESCRIPTION */}
          <textarea
            placeholder="Description (optional)"
            className="w-full border rounded px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* DATES */}
          <div className="grid grid-cols-2 gap-3">
            <input
              type="datetime-local"
              className="border rounded px-3 py-2"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />

            <input
              type="datetime-local"
              className="border rounded px-3 py-2"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          {/* ADMIN OPTIONS */}
          {role === "admin" && (
            <div>
              <label className="block text-sm font-medium mb-2">Display for:</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={publishFor}
                onChange={(e) => setPublishFor(e.target.value)}
                required
              >
                <option value="student">Students Only</option>
                <option value="faculty">Faculty/Mentors Only</option>
                <option value="both">Both Students & Faculty</option>
              </select>
            </div>
          )}

          {/* MENTOR OPTIONS */}
          {role === "mentor" && (
            <select
              className="w-full border rounded px-3 py-2"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            >
              <option value="">Select Course</option>
              {courses.map((course) => (
                <option key={course.id || course._id} value={course.id || course._id}>
                  {course.title}
                </option>
              ))}
            </select>
          )}

          {/* ACTIONS */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-200"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded bg-primary text-white"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEventModal;
