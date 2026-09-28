import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import MentorLayout from "../../components/MentorLayout";
import { toast } from "react-toastify";

const CreateAssessment = () => {
  const { API, token } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { t } = useTranslation();
  const courseId = state?.courseId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Reset form on mount
  useEffect(() => {
    setTitle("");
    setDescription("");
    setStartTime("");
    setEndTime("");
  }, []);

  const handleCreate = async () => {
    if (!title || !startTime || !endTime) {
      toast.error(t('please_fill_all_required_fields'));
      return;
    }

    try {
      const res = await fetch(`${API}/assessments/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          courseId,
          title,
          description,
          startTime,
          endTime
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success("Assessment created");
      navigate(`/mentor/assessment/${data.assessment._id}`);
    } catch (err) {
      toast.error("Failed to create assessment");
    }
  };

  return (
    <MentorLayout>
      <div className="max-w-xl mx-auto p-6 bg-white rounded-xl shadow">
        <h2 className="text-xl font-bold mb-4">Create Assessment</h2>

        <input
          type="text"
          placeholder="Assessment Title"
          className="w-full mb-3 p-2 border rounded"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <textarea
          placeholder="Description"
          className="w-full mb-3 p-2 border rounded"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        <label className="block mb-2 text-sm font-medium">
          Start Date & Time
        </label>
        <input
          type="datetime-local"
          className="w-full mb-4 p-2 border rounded"
          value={startTime}
          onChange={e => setStartTime(e.target.value)}
        />

        <label className="block mb-2 text-sm font-medium">
          End Date & Time
        </label>
        <input
          type="datetime-local"
          className="w-full mb-6 p-2 border rounded"
          value={endTime}
          onChange={e => setEndTime(e.target.value)}
        />

        <button
          onClick={handleCreate}
          className="w-full py-3 bg-primary text-white rounded-lg font-semibold"
        >
          Create Assessment
        </button>
      </div>
    </MentorLayout>
  );
};

export default CreateAssessment;
