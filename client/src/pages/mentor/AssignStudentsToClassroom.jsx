import { useEffect, useState } from "react";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import MentorLayout from "../../components/MentorLayout";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const AssignStudentsToClassroom = () => {
  const { API, token, socket } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH STUDENTS ================= */
  const fetchStudents = async () => {
    try {
      const res = await fetch(`${API}/users/students-simple`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      setStudents(data);
    } catch {
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  /* ================= TOGGLE STUDENT ================= */
  const toggleStudent = (id) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : [...prev, id]
    );
  };

  /* ================= ASSIGN STUDENTS ================= */
  const handleAssign = async () => {
    if (selected.length === 0) {
      return toast.error("Please select at least one student");
    }

    try {
      const res = await fetch(
        `${API}/classrooms/assign-students`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            studentIds: selected,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Assignment failed");
      }
      toast.success("Students assigned successfully");

      // Trigger a lightweight refresh: call mentor classrooms to ensure backend updates are visible
      try {
        const teacherId = localStorage.getItem('userId') || 'me';
        await fetch(`${API}/classrooms/mentor/${teacherId}`, { headers: { Authorization: `Bearer ${token}` } });
      } catch (e) {
        // ignore
      }

      // Emit local socket event to refresh other windows/tabs (best-effort)
      if (socket && socket.connected) {
        try { socket.emit('student-assigned', { studentIds: selected }); } catch {}
      }

      /* ✅ REDIRECT TO MY CLASSROOM */
      navigate("/mentor/classroom");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <MentorLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Assign Students</h1>

        {loading ? (
          <p>Loading students...</p>
        ) : (
          <>
            {/* TABLE */}
            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3">Select</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                  </tr>
                </thead>

                <tbody>
                  {students.map((s) => (
                    <tr
                      key={s._id}
                      className="border-t hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(s._id)}
                          onChange={() => toggleStudent(s._id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {s.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {s.email}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ACTION BUTTON */}
            <div className="flex justify-end mt-6">
              <button
                onClick={handleAssign}
                className="bg-primary text-white px-6 py-2 rounded-lg"
              >
                Assign Selected Students
              </button>
            </div>
          </>
        )}
      </div>
    </MentorLayout>
  );
};

export default AssignStudentsToClassroom;
