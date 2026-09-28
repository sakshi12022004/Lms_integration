import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/auth";

const CreateAnnouncementModal = ({
  open,
  onClose,
  courses = [],
  onSuccess,
  onQuotaExceeded,
}) => {
  const { user, token, API } = useAuth();

  const [form, setForm] = useState({
    title: "",
    message: "",
    publishFor: "students",
    courseId: "",
  });

  const [loading, setLoading] = useState(false);

  if (!open) return null;

  /* ================= HANDLE INPUT ================= */
  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      return toast.error("Title and message are required");
    }

    if (user.role === "mentor" && !form.courseId) {
      return toast.error("Please select a course");
    }

    try {
      setLoading(true);

      // 🔒 FOR MENTORS: CHECK ANNOUNCEMENT LIMIT ON FREE PLAN
      if (user.role === "mentor") {
        try {
          const featureRes = await fetch(`${API}/api/subscriptions/check-feature-access`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (featureRes.ok) {
            const featureData = await featureRes.json();
            const maxAnnouncements = featureData?.features?.announcements?.max || 0;

            // If on free plan, check announcement count
            if (featureData.currentPlan === 'free' && maxAnnouncements > 0) {
              const announcementRes = await fetch(`${API}/announcements`, {
                headers: { Authorization: `Bearer ${token}` }
              });

              if (announcementRes.ok) {
                const allAnnouncements = await announcementRes.json();
                
                // Count only announcements created by this mentor
                const mentorAnnouncements = allAnnouncements.filter(
                  ann => ann.createdByRole === 'mentor'
                );
                
                const currentCount = mentorAnnouncements.length;

                // Check if limit is reached
                if (currentCount >= maxAnnouncements) {
                  onQuotaExceeded?.({
                    type: 'quota',
                    resourceType: 'announcements',
                    currentUsage: currentCount,
                    limit: maxAnnouncements,
                    message: `Your account is on the Free plan — upgrade to post more than ${maxAnnouncements} announcement(s).`
                  });
                  return;
                }
              }
            }
          }
        } catch (err) {
          console.error('Feature check error:', err);
        }
      }

      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
      };

      // ADMIN PAYLOAD
      if (user.role === "admin") {
        payload.publishFor = form.publishFor;
      }

      // MENTOR PAYLOAD
      if (user.role === "mentor") {
        payload.courseId = form.courseId;
      }

      const res = await fetch(`${API}/announcements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Publish failed");
      }

      toast.success("Announcement published");

      // RESET FORM
      setForm({
        title: "",
        message: "",
        publishFor: "students",
        courseId: "",
      });

      onSuccess?.(); // 🔔 refresh bell instantly
      onClose();
    } catch (err) {
      toast.error("Failed to publish announcement");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-5">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">New Announcement</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* TITLE */}
        <input
          type="text"
          name="title"
          placeholder="Announcement title"
          className="w-full border rounded px-3 py-2 mb-3"
          value={form.title}
          onChange={handleChange}
        />

        {/* MESSAGE */}
        <textarea
          name="message"
          placeholder="Write announcement..."
          rows={4}
          className="w-full border rounded px-3 py-2 mb-3"
          value={form.message}
          onChange={handleChange}
        />

        {/* ADMIN OPTIONS */}
        {user.role === "admin" && (
          <select
              name="publishFor"
              value={form.publishFor}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 mb-3"
            >
              <option value="students">Students</option>
              <option value="mentors">Faculty</option>
              <option value="both">Both</option>
            </select>
        )}

        {/* MENTOR OPTIONS */}
        {user.role === "mentor" && (
          <select
            name="courseId"
            value={form.courseId}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 mb-3"
          >
            <option value="">Select Course</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.title}
              </option>
            ))}
          </select>
        )}

        {/* ACTIONS */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm bg-primary text-white rounded"
          >
            {loading ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateAnnouncementModal;
