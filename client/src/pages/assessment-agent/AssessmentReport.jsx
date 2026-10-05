import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { BarChart3, Loader2, RefreshCw, RotateCcw } from "lucide-react";

/*
 * AI Assessment Agent (Step 3) - teacher report for one of the teacher's own tests.
 * All numbers come from the server (graded there). Sorted by name; no ranking.
 */

const STATUS = {
  submitted: ["Submitted", "bg-green-100 text-green-700"],
  expired: ["Auto-submitted (time up / closed)", "bg-gray-200 text-gray-700"],
  in_progress: ["In progress", "bg-amber-100 text-amber-800"],
  not_started: ["Not started", "bg-gray-100 text-gray-500"],
  missed: ["Missed (test closed)", "bg-red-50 text-red-600"], // Step 5
};

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : "-");
const fmtDuration = (s) => (s === null || s === undefined ? "-" : `${Math.floor(s / 60)}m ${s % 60}s`);
const show = (v, suffix = "") => (v === null || v === undefined ? "-" : `${v}${suffix}`);

export default function AssessmentReport({ base, auth, assessmentId, errorText }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${base}/assessments/${assessmentId}/report`, auth);
      setReport(res.data.report);
      setError(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [base, auth, assessmentId, errorText]);

  useEffect(() => { load(); }, [load]);

  // Step 6: the server decides (owner-only, finished attempt, test not closed, reset limit).
  const [resetting, setResetting] = useState(null);
  const resetStudent = async (row) => {
    if (!window.confirm(`Reset ${row.studentName}'s attempt? Their current result (${row.score}/${row.totalQuestions}) is kept as history, and they can take the test again with a fresh timer.`)) return;
    setResetting(row.studentId);
    try {
      const res = await axios.post(`${base}/assessments/${assessmentId}/students/${row.studentId}/reset`, undefined, auth);
      const left = res.data.reset.resetsRemaining;
      toast.success(`Attempt reset. ${row.studentName} can retake the test (${left} reset${left === 1 ? "" : "s"} left for this student).`);
      await load();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setResetting(null);
    }
  };

  if (error) return <section className="bg-white rounded-xl shadow p-6 text-red-600">{error}</section>;
  if (!report) return <section className="bg-white rounded-xl shadow p-6 text-gray-500"><Loader2 className="inline animate-spin" /> Loading report...</section>;

  const s = report.summary;
  const q = report.assessment.questionCount;
  return (
    <section className="bg-white rounded-xl shadow p-6" data-testid="aia-report">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Results report</h3>
        <button onClick={load} disabled={loading} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-6">
        {[
          ["Attempted", `${s.studentsAttempted}${s.studentsInClass ? ` / ${s.studentsInClass}` : ""}`],
          ["Submissions", s.totalSubmissions],
          ["Average", s.averageScore === null ? "-" : `${s.averageScore}/${q} (${s.averagePercentage}%)`],
          ["Highest / Lowest", s.highestScore === null ? "-" : `${s.highestScore} / ${s.lowestScore}`],
        ].map(([label, value]) => (
          <div key={label} className="border rounded-lg p-3"><div className="text-xl font-bold">{value}</div><div className="text-xs text-gray-500">{label}</div></div>
        ))}
      </div>
      {report.students.length === 0 ? (
        <p className="text-sm text-gray-500">No students in this class have started the test yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Student</th><th className="pr-3">Status</th><th className="pr-3">Score</th><th className="pr-3">%</th>
                <th className="pr-3">Correct</th><th className="pr-3">Incorrect</th><th className="pr-3">Unattempted</th><th className="pr-3">Submitted</th><th className="pr-3">Time taken</th><th></th>
              </tr>
            </thead>
            <tbody>
              {report.students.map((r) => {
                const [label, cls] = STATUS[r.status] || [r.status, ""];
                return (
                  <tr key={r.studentId} className="border-b last:border-0" data-testid="aia-report-row" data-student={r.studentName}>
                    <td className="py-2 pr-3 font-medium">
                      {r.studentName}
                      {r.attemptNumber > 1 && <span className="block text-xs text-gray-500 font-normal">Attempt {r.attemptNumber}</span>}
                      {r.previousAttempts && r.previousAttempts.length > 0 && (
                        <span className="block text-xs text-gray-500 font-normal" data-testid="aia-report-previous">
                          Previous: {r.previousAttempts.map((p) => `${p.score}/${p.totalQuestions} (${p.percentage}%)`).join(", ")}
                        </span>
                      )}
                      <Link
                        to={`/teacher/assessments/students/${r.studentId}`}
                        data-testid="aia-report-performance"
                        className="inline-flex items-center gap-1 text-xs font-normal text-primary hover:underline mt-1"
                      >
                        <BarChart3 size={12} /> View performance
                      </Link>
                    </td>
                    <td className="pr-3"><span className={`text-xs px-2 py-1 rounded-full ${cls}`}>{label}</span></td>
                    <td className="pr-3" data-testid="aia-report-score">{r.score === undefined ? "-" : `${r.score}/${r.totalQuestions}`}</td>
                    <td className="pr-3" data-testid="aia-report-percentage">{show(r.percentage, "%")}</td>
                    <td className="pr-3">{show(r.correct)}</td>
                    <td className="pr-3">{show(r.incorrect)}</td>
                    <td className="pr-3">{show(r.unattempted)}</td>
                    <td className="pr-3">{fmtTime(r.submittedAt)}</td>
                    <td className="pr-3">{fmtDuration(r.timeTakenSeconds)}</td>
                    <td>
                      {(r.status === "submitted" || r.status === "expired") && report.assessment.availability !== "closed" && (
                        <button
                          onClick={() => resetStudent(r)}
                          disabled={resetting !== null}
                          data-testid="aia-report-reset"
                          title="Let this student take the test again"
                          className="flex items-center gap-1 text-xs px-2 py-1 border rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RotateCcw size={12} /> {resetting === r.studentId ? "Resetting..." : "Reset"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
