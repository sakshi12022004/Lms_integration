import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../auth/auth";
import { toast } from "react-toastify";

const AddStudentModal = ({ open, onClose, classrooms = [], onSuccess }) => {
  const { API, token } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    classroomId: "",
  });

  if (!open) return null;

  const submit = async () => {
    try {
      await fetch(`${API}/admin/create-student`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      toast.success("Student created");
      onSuccess?.();
      onClose();
    } catch {
      toast.error("Failed to create student");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl w-full max-w-md p-5">
        <div className="flex justify-between mb-4">
          <h2 className="font-semibold text-lg">Add Student</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <input className="input" placeholder="Full Name"
          onChange={e => setForm({ ...form, name: e.target.value })} />

        <input className="input mt-2" placeholder="Email"
          onChange={e => setForm({ ...form, email: e.target.value })} />

        <input className="input mt-2" placeholder="Password" type="password"
          onChange={e => setForm({ ...form, password: e.target.value })} />

        <select className="input mt-2"
          onChange={e => setForm({ ...form, classroomId: e.target.value })}>
          <option value="">Assign Classroom (optional)</option>
          {classrooms.map(c => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>

        <button onClick={submit}
          className="mt-4 w-full bg-primary text-white py-2 rounded">
          Create Student
        </button>
      </div>
    </div>
  );
};

export default AddStudentModal;
