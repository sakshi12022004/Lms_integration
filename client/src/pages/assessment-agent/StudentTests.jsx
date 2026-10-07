import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { ClipboardList, Clock, FileText, Loader2 } from "lucide-react";
import StudentLayout from "../../components/StudentLayout";
import { useAuth } from "../../auth/auth";
import StudentReportNotifications from "./StudentReportNotifications";

/*
 * AI Assessment Agent (Step 3) - student list of published tests for their class.
 * Backend: /api/assessment-agent/student (ai-modules/ai-assessment-agent). The server
 * decides which tests are visible, creates the attempt and owns the timer.
 */

const STATUS = {
  in_progress: { label: "In progress", cls: "bg-amber-100 text-amber-800", action: "Resume" },
  submitted: { label: "Submitted", cls: "bg-green-100 text-green-700", action: "View result" },
  expired: { label: "Time up", cls: "bg-gray-200 text-gray-700", action: "View result" },
};
const fmtWhen = (iso) => new Date(iso).toLocaleString();

export default function StudentTests() {
  const { token, API } = useAuth();
  const navigate = useNavigate();
  const base = `${API}/assessment-agent/student`;
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [tests, setTests] = useState(null);
  const [starting, setStarting] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${base}/assessments`, auth);
      setTests(res.data.assessments);
    } catch (err) {
      setTests([]);
      toast.error(err?.response?.data?.error?.message || "Could not load tests.");
    }
  }, [base, auth]);

  useEffect(() => { load(); }, [load]);

  const open = async (test) => {
    if (test.attempt) { navigate(`/student/assessment-agent/attempts/${test.attempt.id}`); return; }
    const mins = test.durationMinutes ? `${test.durationMinutes} minutes` : "no time limit";
    if (!window.confirm(`Start "${test.title}"? You get one attempt (${mins}). The timer starts now and keeps running even if you close the page.`)) return;
    setStarting(test.id);
    try {
      const res = await axios.post(`${base}/assessments/${test.id}/attempt`, undefined, auth);
      navigate(`/student/assessment-agent/attempts/${res.data.attempt.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || "Could not start the test.");
    } finally {
      setStarting(null);
    }
  };

  return (
    <StudentLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2"><ClipboardList size={24} /> My Tests</h1>
          {/* Descriptive Assignments entry (remove with the feature) */}
          <Link to="/student/assessment-agent/assignments" className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50" data-testid="aia-open-assignments">
            <FileText size={16} /> My Assignments
          </Link>
        </div>
        <p className="text-sm text-gray-500 mb-6">Multiple-choice tests your teachers have published for your class.</p>
        {/* Shared AI Performance Reports (migration 008; remove with the feature) */}
        <StudentReportNotifications base={base} auth={auth} />
        {tests === null ? (
          <div className="p-8 bg-white rounded-xl shadow text-center text-gray-500"><Loader2 className="inline animate-spin" /> Loading...</div>
        ) : tests.length === 0 ? (
          <div className="p-8 bg-white rounded-xl shadow text-center text-gray-500" data-testid="aia-no-tests">No tests are available right now.</div>
        ) : (
          <div className="bg-white rounded-xl shadow divide-y">
            {tests.map((t) => {
              const s = t.attempt ? STATUS[t.attempt.status] : null;
              // Step 5 window (the server enforces it; this is display only).
              const upcoming = !t.attempt && t.availability === "upcoming";
              const closedNoAttempt = !t.attempt && t.availability === "closed";
              return (
                <div key={t.id} className="p-4 flex items-center justify-between gap-4" data-testid="aia-test-row" data-title={t.title}>
                  <div>
                    <div className="font-semibold">{t.title}</div>
                    <div className="text-sm text-gray-500 flex flex-wrap gap-x-2">
                      <span>{t.subject}</span>
                      {t.classroom && <span>· {t.classroom.name}</span>}
                      <span>· {t.questionCount} question{t.questionCount === 1 ? "" : "s"}</span>
                      <span className="flex items-center gap-1">· <Clock size={12} /> {t.durationMinutes ? `${t.durationMinutes} min` : "No time limit"}</span>
                    </div>
                    {t.attempt && t.attempt.status !== "in_progress" && (
                      <div className="text-sm mt-1">Score: <b>{t.attempt.score}/{t.questionCount}</b> ({t.attempt.percentage}%)</div>
                    )}
                    {upcoming && t.opensAt && <div className="text-sm mt-1 text-gray-600" data-testid="aia-opens">Opens {fmtWhen(t.opensAt)}</div>}
                    {!t.attempt && t.availability === "open" && t.closesAt && <div className="text-sm mt-1 text-gray-600">Closes {fmtWhen(t.closesAt)}</div>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s && <span className={`text-xs px-2 py-1 rounded-full ${s.cls}`}>{s.label}</span>}
                    {upcoming && <span className="text-xs px-2.5 py-1 rounded-none bg-[#fff8e7] text-[#92400e] border border-[#fde68a] font-bold">Not open yet</span>}
                    {closedNoAttempt && <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700" data-testid="aia-test-closed">Closed</span>}
                    {!upcoming && !closedNoAttempt && (
                      <button
                        onClick={() => open(t)}
                        disabled={starting !== null}
                        data-testid="aia-open-test"
                        className="px-4 py-2 bg-primary text-white rounded-lg font-semibold disabled:opacity-60"
                      >
                        {starting === t.id ? "Starting..." : s ? s.action : "Start"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
