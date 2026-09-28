import React, { useEffect, useState } from "react";
import StudentLayout from "../../components/StudentLayout";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import { Calendar, TrendingUp } from "lucide-react";

const StudentAttendance = () => {
  const { API, token } = useAuth();
  const { t } = useTranslation();
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total: 0,
    present: 0,
    absent: 0,
    percentage: 0
  });

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const studentId = localStorage.getItem('userId');
        
        // Fetch attendance records for this student (backend endpoint)
        const response = await fetch(`${API}/attendance/student`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch attendance');

        const data = await response.json();
        const records = data.data || data;

        // Server returns this student's attendance using /attendance/student
        const studentAttendance = Array.isArray(records) ? records : [];

        setAttendanceRecords(studentAttendance);

        // Calculate summary
        const total = studentAttendance.length;
        const present = studentAttendance.filter(r => (r.status || '').toLowerCase() === 'present').length;
        const absent = total - present;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        setSummary({ total, present, absent, percentage });
      } catch (error) {
        console.error('Error fetching attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [API, token]);

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex-1 overflow-y-auto scrollable-content p-3 sm:p-4 md:p-6">
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{t('my_attendance')}</h1>
          <p className="text-gray-600">{t('track_attendance_records')}</p>
        </div>

        {/* Summary Cards */}
        <div data-tour="attendance-summary" className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">{t('total_classes')}</p>
            <p className="text-2xl font-bold text-blue-600">{summary.total}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">{t('present')}</p>
            <p className="text-2xl font-bold text-green-600">{summary.present}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">{t('absent')}</p>
            <p className="text-2xl font-bold text-red-600">{summary.absent}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">{t('attendance_percentage')}</p>
            <p className="text-2xl font-bold text-purple-600">{summary.percentage}%</p>
          </div>
        </div>

        {/* Attendance Table */}
        {attendanceRecords.length > 0 ? (
          <div data-tour="attendance-records-log" className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    <Calendar className="inline mr-2" size={16} /> Date
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Classroom</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRecords.map((record, index) => (
                  <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      Classroom {record.classroomId}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        (record.status || '').toLowerCase() === 'present'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {(record.status || '').toLowerCase() === 'present' ? '✓ Present' : '✗ Absent'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div data-tour="attendance-records-log" className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <TrendingUp className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-500">No attendance records yet</p>
          </div>
        )}
      </div>
    </StudentLayout>
  );
};

export default StudentAttendance;
