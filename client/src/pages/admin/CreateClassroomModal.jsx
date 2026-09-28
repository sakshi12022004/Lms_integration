import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import { toast } from "react-toastify";

const CreateClassroomModal = ({ open, onClose, onSuccess }) => {
  const { API, token } = useAuth();
  const { t } = useTranslation();

  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [classTeacher, setClassTeacher] = useState("");
  const [studentIds, setStudentIds] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [students, setStudents] = useState([]);
  const [loadingMentors, setLoadingMentors] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [timetable, setTimetable] = useState(null);

  /* ================= FETCH MENTORS AND STUDENTS ================= */
  useEffect(() => {
    if (open) {
      fetchMentors();
      fetchStudents();
    }
  }, [open]);

  const fetchMentors = async () => {
    try {
      setLoadingMentors(true);
      const res = await fetch(`${API}/admin/mentors`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error();

      setMentors(Array.isArray(data) ? data : []);
    } catch {
      toast.error(t('failed_to_load_teachers'));
    } finally {
      setLoadingMentors(false);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoadingStudents(true);
      const res = await fetch(`${API}/users/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error();

      const studentList = Array.isArray(data) ? data.filter(u => u.role === "student") : [];
      setStudents(studentList);
    } catch {
      toast.error(t('failed_to_load_students'));
    } finally {
      setLoadingStudents(false);
    }
  };

  /* ================= CREATE CLASSROOM ================= */
  const handleCreate = async () => {
    if (!grade) {
      return toast.error(t('grade_required'));
    }
    
    if (!section) {
      return toast.error(t('section_required'));
    }

    try {
      // Get teacher's name from selected ID
      const selectedTeacher = mentors.find(m => m.id === classTeacher);
      const teacherName = selectedTeacher ? selectedTeacher.name : "";

      const requestData = {
        name: `Grade ${grade} - Section ${section}`,
        grade,
        section,
        classTeacher: teacherName,
        classTeacherId: classTeacher ? parseInt(classTeacher) : null,
        studentIds: studentIds.length > 0 ? studentIds.map(id => parseInt(id)) : []
      };

      console.log('Creating classroom with data:', requestData);

      // Create classroom (with students assigned in the same request)
      const res = await fetch(`${API}/classrooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || t('failed_to_create_classroom'));
      }

      // Get the created classroom - handle both wrapped and unwrapped responses
      const createdClassroom = data.classroom || data.data || data;

      toast.success(t('classroom_created_successfully'));
      onSuccess();
      onClose();

      // reset form
      setGrade("");
      setSection("");
      setClassTeacher("");
      setStudentIds([]);
      setPhoto(null);
      setTimetable(null);
    } catch (err) {
      console.error('Create classroom error:', err);
      toast.error(err.message || t('failed_to_create_classroom'));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-xl p-5 max-h-[90vh] overflow-y-auto">

        {/* HEADER */}
        <div className="flex justify-between mb-4">
          <h2 className="font-semibold text-lg">{t('create_classroom_button')}</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* FORM */}
        <div className="space-y-3">
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('grade_level')} <span className="text-red-500">*</span>
            </label>
              <select
              className="w-full border rounded px-3 py-2"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              required
            >
              <option value="">{t('select_grade_placeholder')}</option>
              <option value="1">Grade 1 (Primary)</option>
              <option value="2">Grade 2 (Primary)</option>
              <option value="3">Grade 3 (Primary)</option>
              <option value="4">Grade 4 (Primary)</option>
              <option value="5">Grade 5 (Secondary)</option>
              <option value="6">Grade 6 (Secondary)</option>
              <option value="7">Grade 7 (Secondary)</option>
              <option value="8">Grade 8 (Secondary)</option>
              <option value="9">Grade 9 (Secondary)</option>
              <option value="10">Grade 10 (Secondary)</option>
              <option value="11">Grade 11 (Secondary)</option>
              <option value="12">Grade 12 (Secondary)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('section')} <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder={t('section_placeholder')}
              value={section}
              onChange={(e) => setSection(e.target.value)}
              required
            />
          </div>

          {/* ✅ CLASS TEACHER DROPDOWN */}
          <select
            className="w-full border rounded px-3 py-2"
            value={classTeacher}
            onChange={(e) => setClassTeacher(e.target.value)}
            disabled={loadingMentors}
          >
            <option value="">{t('assign_class_teacher_optional')}</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.email})
              </option>
            ))}
          </select>

          {/* ✅ STUDENT SELECTION */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('assign_students_optional')}</label>
            <select
              className="w-full border rounded px-3 py-2"
              multiple
              value={studentIds}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setStudentIds(selected);
              }}
              disabled={loadingStudents}
              size={5}
            >
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('hold_ctrl_to_select_multiple')}</p>
          </div>

          {/* ✅ PHOTO UPLOAD */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('classroom_photo_optional')}</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files[0])}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* ✅ TIMETABLE UPLOAD */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('timetable_optional')}</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setTimetable(e.target.files[0])}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="border px-4 py-2 rounded">
            {t('cancel')}
          </button>
          <button
            onClick={handleCreate}
            className="bg-primary text-white px-4 py-2 rounded"
          >
            {t('create')}
          </button>
        </div>

      </div>
    </div>
  );
};

export default CreateClassroomModal;
