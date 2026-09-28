import { useEffect, useState } from "react";
import { useAuth } from "../../auth/auth";
import StudentLayout from "../../components/StudentLayout";
import { useTranslation } from '../../context/TranslationContext';
import { Trophy, Frown, FileText, CheckCircle, AlertCircle } from "lucide-react";

const StudentResults = () => {
  const { API, token } = useAuth();
  const { t } = useTranslation();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const studentId = localStorage.getItem('userId');
      const res = await fetch(`${API}/results/student/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const resultsList = data.success ? data.data : (Array.isArray(data) ? data : []);
      setResults(resultsList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex-1 overflow-y-auto scrollable-content p-3 sm:p-4 md:p-6">
          <div className="flex justify-center items-center h-96">
            <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
            <p className="ml-4 text-text/60">{t('loading_courses')}</p>
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div data-tour="results-page" className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <FileText className="text-primary" /> {t('my_results')}
        </h1>

        {results.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
            <Trophy className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600">{t('no_results_yet')}</h3>
            <p className="text-gray-400">{t('results_will_appear')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {results.map((result, resultIndex) => (
              <div key={result.id || result._id} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                
                {/* Header */}
                <div data-tour={resultIndex === 0 ? 'results-cards' : undefined} className={`p-6 ${result.overallStatus === "PASS" ? "bg-gradient-to-r from-green-50 to-emerald-50" : "bg-gradient-to-r from-red-50 to-pink-50"}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">{result.term || "General"}</h2>
                      <p className="text-gray-500 text-sm mt-1">Classroom: <span className="font-medium">{result.classroomName || 'N/A'} {result.section ? `- ${result.section}` : ''}</span></p>
                      <p className="text-gray-500 text-sm">Grade {result.grade || 'N/A'}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 ${result.overallStatus === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {result.overallStatus === "PASS" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                      {result.overallStatus}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex gap-6">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold">Overall Percentage</p>
                      <p className={`text-4xl font-bold ${result.overallStatus === "PASS" ? "text-green-600" : "text-red-600"}`}>
                        {result.overallPercentage}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div data-tour={resultIndex === 0 ? 'results-subject-breakdown' : undefined} className="p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Subject-wise Marks</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">{t('subject')}</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">{t('marks')}</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">{t('total')}</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">{t('percentage')}</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">{t('status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(result.subjects) && result.subjects.length > 0 ? (
                          result.subjects.map((sub, index) => {
                            const percentage = sub.total > 0 ? ((sub.marks / sub.total) * 100).toFixed(2) : 0;
                            return (
                              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                <td className="py-4 px-4 font-medium text-gray-800">{sub.name}</td>
                                <td className="py-4 px-4 text-center font-bold text-gray-700">{sub.marks}</td>
                                <td className="py-4 px-4 text-center text-gray-600">{sub.total}</td>
                                <td className="py-4 px-4 text-center font-semibold text-gray-700">{percentage}%</td>
                                <td className="py-4 px-4 text-center">
                                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${sub.status === "PASS" ? "text-green-700 bg-green-100" : "text-red-700 bg-red-100"}`}>
                                    {sub.status === "PASS" ? "✓ PASS" : "✗ FAIL"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="5" className="py-4 px-4 text-center text-gray-500">{t('no_subjects_yet')}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {result.comments && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-semibold text-blue-900 mb-1">📝 {t('teacher_comments')}:</p>
                      <p className="text-blue-800 italic">"{result.comments}"</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  );
};

export default StudentResults;
