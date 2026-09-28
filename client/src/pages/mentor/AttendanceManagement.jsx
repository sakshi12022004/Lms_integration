import { useEffect, useState } from "react";
import MentorLayout from "../../components/MentorLayout";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import { toast } from "react-toastify";
import { Download, Save } from "lucide-react";
import { useSearchParams } from "react-router-dom";

const AttendanceManagement = () => {
  const { API, token } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const classroomIdFromUrl = searchParams.get('classroomId');

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Unwrap API response
  const unwrapResponse = (data) => {
    if (data && typeof data === 'object') {
      if ('data' in data && 'success' in data) {
        return data.data; // Wrapped response
      }
      if (Array.isArray(data)) {
        return data; // Direct array response
      }
      return data; // Direct object response
    }
    return null;
  };

  // Fetch Assigned Classrooms
  const fetchClassrooms = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      console.log('Fetching classrooms from /classrooms/mentor/me');
      const res = await fetch(`${API}/classrooms/mentor/me`, {
        headers: headers,
      });

      if (!res.ok) {
        console.error('Response status:', res.status);
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log('Classrooms response:', data);
      const classroomsList = unwrapResponse(data);
      console.log('Unwrapped classrooms:', classroomsList);
      setClassrooms(Array.isArray(classroomsList) ? classroomsList : []);

      if (Array.isArray(classroomsList) && classroomsList.length > 0) {
        console.log('Setting first classroom:', classroomsList[0].id);
        setSelectedClassroom(classroomsList[0].id);
        fetchStudents(classroomsList[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch classrooms:", err);
      toast.error(t('failed_to_load_classrooms'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch All Students
  const fetchStudents = async (classroomId) => {
    try {
      console.log('Fetching all students for attendance...');
      const res = await fetch(`${API}/users?role=student`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        console.error('Students fetch response status:', res.status);
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log('Students response:', data);
      const studentList = unwrapResponse(data);
      console.log('Unwrapped students:', studentList);
      
      // Filter to only show students (not admins, mentors, etc.)
      const filteredStudents = Array.isArray(studentList) 
        ? studentList.filter(user => user.role === 'student')
        : [];
      
      console.log('Filtered students (role=student):', filteredStudents.length);
      
      // Ensure students have proper IDs
      const processedStudents = filteredStudents.map(s => ({
        ...s,
        id: s.id || s._id,
        _id: s._id || s.id
      }));
      
      setStudents(processedStudents);

      // Initialize attendance data
      const initialAttendance = {};
      processedStudents.forEach(student => {
        initialAttendance[student.id] = "present";
      });
      setAttendanceData(initialAttendance);

      // Fetch existing attendance for the date
      fetchAttendanceForDate(classroomId);
    } catch (err) {
      console.error("Failed to fetch students:", err);
      toast.error(t('failed_to_load_students'));
    }
  };

  // Fetch Existing Attendance
  const fetchAttendanceForDate = async (classroomId) => {
    try {
      const res = await fetch(
        `${API}/attendance/classroom/${classroomId}/date/${selectedDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        const existingAttendance = unwrapResponse(data);
        const attendanceMap = {};
        
        if (Array.isArray(existingAttendance)) {
          students.forEach(student => {
            const studentId = student.id || student._id;
            const record = existingAttendance.find(a => a.studentId === studentId || a.studentId?._id === studentId);
            attendanceMap[studentId] = record?.status || "present";
          });
        }

        setAttendanceData(attendanceMap);
      }
    } catch (err) {
      console.error("Failed to fetch attendance:", err);
    }
  };

  // Handle Classroom Change
  const handleClassroomChange = (classroomId) => {
    setSelectedClassroom(classroomId);
    fetchStudents(classroomId);
  };

  // Handle Attendance Change
  const handleAttendanceChange = (studentId, status) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Save Attendance
  const handleSaveAttendance = async () => {
    if (!selectedClassroom) {
      toast.error(t('please_select_classroom'));
      return;
    }

    try {
      setSaving(true);
      console.log('Saving attendance for classroom:', selectedClassroom, 'Date:', selectedDate);

      const attendanceArray = students.map(student => ({
        studentId: student.id || student._id,
        status: attendanceData[student.id || student._id] || "present"
      }));

      console.log('Attendance data to save:', attendanceArray);

      const res = await fetch(`${API}/attendance/mark`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          classroomId: selectedClassroom,
          date: selectedDate,
          attendanceData: attendanceArray,
        }),
      });

      const responseData = await res.json();
      console.log('Backend response:', responseData);

      if (!res.ok) throw new Error(responseData.message || t('failed_to_save_attendance'));

      // Show success with details
      const presentCount = attendanceArray.filter(a => a.status === 'present').length;
      const absentCount = attendanceArray.filter(a => a.status === 'absent').length;
      toast.success(t('attendance_saved_successfully_count', { present: presentCount, absent: absentCount }));
      
      // Refresh attendance data after successful save
      console.log('Refreshing attendance data...');
      fetchAttendanceForDate(selectedClassroom);
      
    } catch (err) {
      console.error("Error saving attendance:", err);
      toast.error(err.message || t('failed_to_save_attendance'));
    } finally {
      setSaving(false);
    }
  };

  // Download Attendance Excel
  const handleDownloadExcel = async () => {
    if (!selectedClassroom) {
      toast.error(t('please_select_classroom'));
      return;
    }

    try {
      const res = await fetch(
        `${API}/attendance/download?classroomId=${selectedClassroom}&startDate=${selectedDate}&endDate=${selectedDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || t('failed_to_download_file'));
      }

      // Get the blob from response
      const blob = await res.blob();
      
      // Check if response is actually an Excel file
      if (!blob.type.includes('spreadsheet') && !blob.type.includes('sheet')) {
        throw new Error(t('invalid_file_format'));
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance-${selectedDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      toast.success(t('file_downloaded_successfully'));
    } catch (err) {
      console.error("Error downloading file:", err);
      toast.error(err.message || t('failed_to_download_file'));
    }
  };

  useEffect(() => {
    if (classroomIdFromUrl) {
      // Auto-load classroom from URL parameter
      console.log('Classroom ID from URL:', classroomIdFromUrl);
      const classroomId = parseInt(classroomIdFromUrl, 10);
      setSelectedClassroom(classroomId);
      setClassrooms([{ id: classroomId, name: 'Current Classroom' }]);
      fetchStudents(classroomId);
      setLoading(false);
    } else {
      // Load all classrooms if no specific classroom is selected
      fetchClassrooms();
    }
  }, [classroomIdFromUrl, API, token]);

  useEffect(() => {
    if (selectedClassroom && selectedDate) {
      fetchAttendanceForDate(selectedClassroom);
    }
  }, [selectedDate]);

  if (loading) return <MentorLayout><div className="p-6">{t('loading')}</div></MentorLayout>;

  return (
    <MentorLayout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{t('attendance_management')}</h1>
          <p className="text-gray-600">{t('mark_manage_student_attendance')}</p>
        </div>

        {/* Controls */}
        <div data-tour="attendance-controls" className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('date')}
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2">
              <button
                onClick={handleSaveAttendance}
                disabled={!selectedClassroom || saving}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Attendance"}
              </button>
              <button
                onClick={handleDownloadExcel}
                disabled={!selectedClassroom}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        </div>

        {/* Attendance Table */}
        {selectedClassroom && students.length > 0 ? (
          <div data-tour="attendance-table" className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">S.No</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Student Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => {
                  const studentId = student.id || student._id;
                  return (
                    <tr
                      key={studentId}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-3 text-sm text-gray-600">{index + 1}</td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{student.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{student.email}</td>
                      <td data-tour={index === 0 ? 'attendance-present-absent' : undefined} className="px-6 py-3 text-center">
                        <div className="flex justify-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`attendance-${studentId}`}
                              value="present"
                              checked={attendanceData[studentId] === "present"}
                              onChange={() => handleAttendanceChange(studentId, "present")}
                              className="w-4 h-4 text-green-600"
                            />
                            <span className="text-sm font-medium text-green-600">Present</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`attendance-${studentId}`}
                              value="absent"
                              checked={attendanceData[studentId] === "absent"}
                              onChange={() => handleAttendanceChange(studentId, "absent")}
                              className="w-4 h-4 text-red-600"
                            />
                            <span className="text-sm font-medium text-red-600">Absent</span>
                          </label>
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

        {/* Summary */}
        {selectedClassroom && students.length > 0 && (
          <div data-tour="mentor-attendance-summary" className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Present Today</p>
              <p className="text-2xl font-bold text-green-600">
                {Object.values(attendanceData).filter(s => s === "present").length}
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Absent Today</p>
              <p className="text-2xl font-bold text-red-600">
                {Object.values(attendanceData).filter(s => s === "absent").length}
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Total Students</p>
              <p className="text-2xl font-bold text-blue-600">{students.length}</p>
            </div>
          </div>
        )}
      </div>
    </MentorLayout>
  );
};

export default AttendanceManagement;
