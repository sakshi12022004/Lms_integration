import { useEffect, useState } from "react";
import MentorLayout from "../../components/MentorLayout";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import { toast } from "react-toastify";
import { Plus, Save, Edit, Trash2, X } from "lucide-react";

const ClassResults = () => {
  const { API, token } = useAuth();
  const { t } = useTranslation();

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [students, setStudents] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddResultModal, setShowAddResultModal] = useState(false);
  const [editingResult, setEditingResult] = useState(null);

  const [resultForm, setResultForm] = useState({
    studentId: "",
    subjects: [{ name: "", marks: "", total: 100, status: "PASS" }],
    term: "General",
    comments: "",
  });

  // Fetch Assigned Classrooms
  const fetchClassrooms = async () => {
    try {
      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API}/classrooms/mentor/me`, {
        headers: headers,
      });

      const data = await res.json();
      const classroomsList = data.data || data;
      setClassrooms(Array.isArray(classroomsList) ? classroomsList : []);

      if (Array.isArray(classroomsList) && classroomsList.length > 0) {
        setSelectedClassroom(classroomsList[0].id);
        fetchStudents(classroomsList[0].id);
        fetchResults(classroomsList[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch classrooms:", err);
      toast.error("Failed to load classrooms");
    } finally {
      setLoading(false);
    }
  };

  // Fetch All Students
  const fetchStudents = async (classroomId) => {
    try {
      console.log('Fetching all students for results...');
      const res = await fetch(`${API}/users?role=student`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      const studentsList = data.data || data;
      console.log('All students fetched:', studentsList);
      
      // Filter to only show students (not admins, mentors, etc.)
      const filteredStudents = Array.isArray(studentsList) 
        ? studentsList.filter(user => user.role === 'student')
        : [];
      
      console.log('Filtered students (role=student):', filteredStudents.length);
      setStudents(filteredStudents);
    } catch (err) {
      console.error("Failed to fetch students:", err);
      toast.error("Failed to load students");
    }
  };

  // Fetch Results for Classroom
  const fetchResults = async (classroomId) => {
    try {
      const res = await fetch(`${API}/results/classroom/${classroomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const resultsList = data.success ? data.data : (Array.isArray(data) ? data : []);
        setResults(resultsList);
      }
    } catch (err) {
      console.error("Failed to fetch results:", err);
    }
  };

  // Handle Classroom Change
  const handleClassroomChange = (classroomId) => {
    setSelectedClassroom(classroomId);
    fetchStudents(classroomId);
    fetchResults(classroomId);
  };

  // Add new subject row
  const addSubject = () => {
    setResultForm(prev => ({
      ...prev,
      subjects: [...prev.subjects, { name: "", marks: "", total: 100, status: "PASS" }]
    }));
  };

  // Remove subject row
  const removeSubject = (index) => {
    setResultForm(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index)
    }));
  };

  // Update subject field
  const updateSubject = (index, field, value) => {
    setResultForm(prev => {
      const updatedSubjects = [...prev.subjects];
      updatedSubjects[index] = { ...updatedSubjects[index], [field]: value };
      return { ...prev, subjects: updatedSubjects };
    });
  };

  // Open Add Result Modal
  const handleOpenAddModal = (student = null) => {
    if (student) {
      setEditingResult(student);
      const existingResult = results.find(r => r.studentId === (student._id || student.id));
      if (existingResult && existingResult.subjects) {
        setResultForm({
          studentId: String(student._id || student.id),
          subjects: existingResult.subjects || [{ name: "", marks: "", total: 100, status: "PASS" }],
          term: existingResult.term || "General",
          comments: existingResult.comments || "",
        });
      } else {
        setResultForm({
          studentId: String(student._id || student.id),
          subjects: [{ name: "", marks: "", total: 100, status: "PASS" }],
          term: "General",
          comments: "",
        });
      }
    } else {
      setEditingResult(null);
      setResultForm({
        studentId: "",
        subjects: [{ name: "", marks: "", total: 100, status: "PASS" }],
        term: "General",
        comments: "",
      });
    }
    setShowAddResultModal(true);
  };

  // Save Result
  const handleSaveResult = async (e) => {
    e.preventDefault();

    if (!resultForm.studentId) {
      toast.error(t('please_select_student'));
      return;
    }

    const validSubjects = resultForm.subjects.filter(s => s.name && s.marks);
    if (validSubjects.length === 0) {
      toast.error(t('please_add_subject_with_marks'));
      return;
    }

    for (let subject of validSubjects) {
      const marks = Number(subject.marks);
      const total = Number(subject.total) || 100;
      if (marks < 0 || marks > total) {
        toast.error(t('marks_validation_error', { subject: subject.name, total }));
        return;
      }
    }

    try {
      setSaving(true);

      // Filter out empty subjects
      const subjects = resultForm.subjects.filter(s => s.name && s.marks);
      
      if (subjects.length === 0) {
        toast.error(t('please_add_subject_with_marks'));
        return;
      }

      const res = await fetch(`${API}/results`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          classroomId: Number(selectedClassroom),
          studentId: Number(resultForm.studentId),
          subjects: subjects,
          term: resultForm.term,
          comments: resultForm.comments
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data?.message || t('failed_to_save_result'));
      }

      toast.success(editingResult ? t('result_updated_successfully') : t('result_added_successfully'));
      // Observed by GuideBot (ActionGuard) only — fires strictly after the request succeeded.
      if (editingResult) window.dispatchEvent(new CustomEvent('guidebot:action-success', { detail: { actionId: 'result-updated' } }));
      setShowAddResultModal(false);
      setEditingResult(null);
      setResultForm({ 
        studentId: "", 
        subjects: [{ name: "", marks: "", total: 100, status: "PASS" }], 
        term: "General",
        comments: ""
      });
      fetchResults(selectedClassroom);
    } catch (err) {
      console.error("Error saving result:", err);
      toast.error(err.message || t('failed_to_save_result'));
    } finally {
      setSaving(false);
    }
  };

  // Delete Result
  const handleDeleteResult = async (resultId) => {
    if (window.confirm(t('confirm_delete_result'))) {
      try {
        const res = await fetch(`${API}/results/${resultId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(t('failed_to_delete_result'));

        toast.success(t('result_deleted_successfully'));
        fetchResults(selectedClassroom);
      } catch (err) {
        console.error("Error deleting result:", err);
        toast.error(t('failed_to_delete_result'));
      }
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);


  if (loading) return <MentorLayout><div className="p-6">{t('loading')}</div></MentorLayout>;

  return (
    <MentorLayout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{t('results_management')}</h1>
          <p className="text-gray-600">{t('add_manage_student_results')}</p>
        </div>

        {/* Controls */}
        <div data-tour="results-controls" className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('select_classroom')}
              </label>
              <select
                value={String(selectedClassroom || "")}
                onChange={(e) => handleClassroomChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('choose_classroom')}</option>
                {classrooms.map(classroom => (
                  <option key={classroom.id} value={String(classroom.id)}>
                    {classroom.name} (Grade {classroom.grade})
                  </option>
                ))}
              </select>
            </div>

            <button
              data-tour="results-add-button"
              onClick={() => handleOpenAddModal()}
              disabled={!selectedClassroom}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('add_result')}
            </button>
          </div>
        </div>

        {/* Results Table */}
        {selectedClassroom && students.length > 0 ? (
          <div data-tour="results-table" className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('serial_no')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('student_name')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('email_address')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('course')}</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">{t('marks')}</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">{t('status')}</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => {
                  const studentId = student._id || student.id;
                  // Find result - handle both SQLite numeric IDs and MongoDB ObjectIDs
                  const result = results.find(r => {
                    const resultStudentId = r.studentId;
                    return resultStudentId === studentId || resultStudentId === String(studentId) || resultStudentId === Number(studentId);
                  });
                  
                  // Get subject name from result if available
                  const subjectName = result?.subjects && result.subjects.length > 0 ? result.subjects[0].name : (result?.courseId || "Not assigned");
                  const marks = result?.subjects && result.subjects.length > 0 ? result.subjects[0].marks : result?.marks;
                  const resultStatus = result?.overallStatus?.toLowerCase() || result?.status?.toLowerCase();
                  
                  return (
                    <tr key={studentId} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-sm text-gray-600">{index + 1}</td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{student.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{student.email}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {subjectName || <span className="text-gray-400">{t('not_assigned')}</span>}
                      </td>
                      <td className="px-6 py-3 text-center text-sm font-medium text-gray-900">
                        {marks !== undefined ? `${marks}/100` : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-3 text-center">
                        {resultStatus === "pass" ? (
                          <span className="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-medium">
                            {t('pass')}
                          </span>
                        ) : resultStatus === "fail" ? (
                          <span className="bg-red-100 text-red-800 text-xs px-2.5 py-1 rounded-full font-medium">
                            {t('fail')}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div data-tour={index === 0 ? 'results-first-action' : undefined} className="flex justify-center gap-2">
                          <button
                            onClick={() => handleOpenAddModal(student)}
                            data-tour={index === 0 ? 'results-first-edit' : undefined}
                            className="text-blue-600 hover:text-blue-700 p-1"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {result && (
                            <button
                              onClick={() => handleDeleteResult(result.id)}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-500">
              {!selectedClassroom ? "Please select a classroom" : "No students in this classroom"}
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Result Modal */}
      {showAddResultModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div data-tour="results-edit-form" className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold">
                {editingResult ? "Edit Result" : "Add Result"}
              </h3>
              <button onClick={() => setShowAddResultModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveResult} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student *
                </label>
                <select
                  value={resultForm.studentId}
                  onChange={(e) => setResultForm({ ...resultForm, studentId: e.target.value })}
                  disabled={!!editingResult}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  required
                >
                  <option value="">Select Student</option>
                  {students.map(student => (
                    <option key={student._id || student.id} value={String(student._id || student.id)}>
                      {student.name} ({student.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Term
                </label>
                <input
                  type="text"
                  value={resultForm.term}
                  onChange={(e) => setResultForm({ ...resultForm, term: e.target.value })}
                  placeholder="e.g., First Term"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Subjects *
                  </label>
                  <button
                    type="button"
                    onClick={addSubject}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add Subject
                  </button>
                </div>

                <div className="space-y-3">
                  {resultForm.subjects.map((subject, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={subject.name}
                          onChange={(e) => updateSubject(index, 'name', e.target.value)}
                          placeholder="Subject name"
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                          required
                        />
                        {resultForm.subjects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSubject(index)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium px-2"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          value={subject.marks}
                          onChange={(e) => updateSubject(index, 'marks', e.target.value)}
                          placeholder="Marks"
                          min="0"
                          className="px-2 py-1 text-sm border border-gray-300 rounded"
                          required
                        />
                        <input
                          type="number"
                          value={subject.total}
                          onChange={(e) => updateSubject(index, 'total', e.target.value)}
                          placeholder="Total"
                          min="0"
                          className="px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                        <select
                          value={subject.status}
                          onChange={(e) => updateSubject(index, 'status', e.target.value)}
                          className="px-2 py-1 text-sm border border-gray-300 rounded"
                        >
                          <option value="PASS">Pass</option>
                          <option value="FAIL">Fail</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comments
                </label>
                <textarea
                  value={resultForm.comments}
                  onChange={(e) => setResultForm({ ...resultForm, comments: e.target.value })}
                  placeholder="Optional comments"
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddResultModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Result"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MentorLayout>
  );
};

export default ClassResults;
