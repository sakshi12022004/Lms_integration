import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ArrowLeft, Info, Loader2, Minus, TrendingDown, TrendingUp } from "lucide-react";
import MentorLayout from "../../components/MentorLayout";
import { useAuth } from "../../auth/auth";
import AiPerformanceReport from "./AiPerformanceReport";

/*
 * AI Assessment Agent - Student Performance Analyst (teacher-only).
 * Backend: GET  /api/assessment-agent/teacher/students/:id/performance           (facts; never uses AI)
 *          POST /api/assessment-agent/teacher/students/:id/performance/analysis  (AI report; see AiPerformanceReport.jsx)
 * Every number on this page comes from the server. The AI section only interprets those numbers
 * and is clearly separated from them. Scope: the signed-in teacher's own assessments.
 *
 * API-call efficiency: this page never calls the LLM. Only AiPerformanceReport does, from an explicit
 * "Generate AI Report" / "Regenerate" click (one request per click). It is keyed by student, so
 * changing student resets it without any call; refreshing or returning never regenerates.
 */

const AXIS = "#64748b";
const GRID = "#e2e8f0";
const BLUE = "#3b82f6";
const MUTED = "#94a3b8";

const STATE_LABEL = {
  finished: { submitted: ["Submitted", "bg-green-100 text-green-700"], expired: ["Auto-submitted", "bg-gray-200 text-gray-700"] },
  in_progress: ["In progress", "bg-amber-100 text-amber-800"],
  missed: ["Missed", "bg-red-50 text-red-600"],
  pending: ["Not started", "bg-gray-100 text-gray-500"],
  upcoming: ["Upcoming", "bg-blue-50 text-blue-700"],
};
const TREND = {
  improving: ["Improving", TrendingUp, "text-green-700"],
  declining: ["Declining", TrendingDown, "text-red-600"],
  stable: ["Stable", Minus, "text-gray-700"],
  insufficient_data: ["Not enough data", Minus, "text-gray-400"],
};
const CONSISTENCY = { consistent: "Consistent", moderate: "Moderately variable", variable: "Highly variable", insufficient_data: "Not enough data" };
const FIXED_LIMITATIONS = [
  "Only objective questions (single MCQ, multiple select, numerical) are graded here; descriptive or written work is not part of this data.",
  "Only your own assessments are included; other teachers' tests are not part of this report.",
];

const fmt = (v, suffix = "") => (v === null || v === undefined ? "–" : `${v}${suffix}`);
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "–");
const fmtDuration = (s) => (s === null || s === undefined ? "–" : `${Math.floor(s / 60)}m ${s % 60}s`);
const safeError = (err, fallback) => err?.response?.data?.error?.message || fallback;

function Kpi({ label, value, sub, icon: Icon, tone = "" }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 flex items-center gap-2 ${tone}`}>{Icon && <Icon size={20} />}{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Section({ id, title, subtitle, children, highlighted }) {
  return (
    <section id={id} className={`bg-white rounded-xl shadow p-6 transition-shadow ${highlighted ? "ring-2 ring-primary" : ""}`}>
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

export default function StudentPerformance() {
  const { studentId } = useParams();
  const { token, API } = useAuth();
  const base = `${API}/assessment-agent/teacher/students/${studentId}/performance`;
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [focus, setFocus] = useState(null); // highlighted evidence, e.g. "A2", "subject:Biology"

  const load = useCallback(async () => {
    try {
      const res = await axios.get(base, auth);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(safeError(err, "Could not load this student's performance."));
    }
  }, [base, auth]);
  useEffect(() => { load(); }, [load]);

  const titles = useMemo(() => Object.fromEntries((data?.metrics.history || []).map((h) => [h.label, h.title])), [data]);

  // Evidence references from the AI report: highlight + scroll to the history row (A2, or A2-Q3 -> row A2)
  // or to the subject / difficulty / headline-metrics section.
  const showEvidence = (ref) => {
    const assessment = /^(A\d+)(-Q\d+)?$/.exec(ref)?.[1];
    const key = assessment || ref;
    setFocus(key);
    const target = assessment ? `hist-${assessment}` : ref.startsWith("subject:") ? "perf-subjects" : ref.startsWith("difficulty:") ? "perf-difficulty" : "perf-kpis";
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setFocus((f) => (f === key ? null : f)), 4000);
  };

  if (error) {
    return (
      <MentorLayout>
        <div className="max-w-6xl mx-auto p-6">
          <Link to="/teacher/assessments" className="flex items-center gap-2 text-sm text-gray-600 mb-4"><ArrowLeft size={16} /> AI Assessments</Link>
          <div className="p-6 bg-white rounded-xl shadow text-red-600">{error}</div>
        </div>
      </MentorLayout>
    );
  }
  if (!data) return <MentorLayout><div className="max-w-6xl mx-auto p-6 text-gray-500"><Loader2 className="inline animate-spin" /> Loading performance...</div></MentorLayout>;

  const { student, scope, metrics: m, dataSufficiency: ds } = data;
  const finishedChart = m.history
    .filter((h) => h.state === "finished")
    .sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt))
    .map((h) => ({ label: h.label, Student: h.percentage, "Class average": h.classAveragePercentage }));
  const [trendLabel, TrendIcon, trendTone] = TREND[m.trend.label] || TREND.insufficient_data;
  const recentDelta = m.scores.lastThreeAverage !== null && m.scores.average !== null ? Math.round((m.scores.lastThreeAverage - m.scores.average) * 100) / 100 : null;

  return (
    <MentorLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6" data-testid="aia-performance">
        <Link to="/teacher/assessments" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft size={16} /> AI Assessments</Link>

        {/* 1. Student header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Student performance report</p>
            <h1 className="text-2xl font-bold">{student.name}</h1>
            <p className="text-sm text-gray-500">
              {student.classes.map((c) => c.name).join(", ") || "No class"}
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div>Your assessments · {scope.assessments} test{scope.assessments === 1 ? "" : "s"} · {scope.subjects.join(", ")}</div>
            <div>Updated {new Date(scope.generatedAt).toLocaleString()}</div>
          </div>
        </header>

        {/* 2. Data sufficiency */}
        {ds.level !== "adequate" && (
          <div className={`flex items-start gap-3 p-4 rounded-lg text-sm ${ds.level === "none" ? "bg-gray-100 text-gray-700" : "bg-amber-50 text-amber-800"}`} data-testid="aia-sufficiency">
            <Info size={18} className="shrink-0 mt-0.5" />
            {ds.level === "none"
              ? "No finished assessments yet. Metrics will appear once the student completes a test."
              : `Based on ${ds.finishedAssessments} finished assessment${ds.finishedAssessments === 1 ? "" : "s"}. Trend, consistency and recent average need at least 3.`}
          </div>
        )}

        {/* 3. KPIs */}
        <div id="perf-kpis" className={`grid grid-cols-2 md:grid-cols-4 gap-4 rounded-xl ${focus?.startsWith("metric:") ? "ring-2 ring-primary" : ""}`}>
          <Kpi label="Overall score" value={fmt(m.scores.average, "%")} sub={m.scores.best !== null ? `Best ${m.scores.best}% · Lowest ${m.scores.worst}% · Median ${m.scores.median}%` : "No finished tests"} />
          <Kpi label="Trend" value={trendLabel} icon={TrendIcon} tone={trendTone} sub={m.trend.slopePerAssessment === null ? "Needs 3 finished tests" : `${m.trend.slopePerAssessment} pts per test`} />
          <Kpi label="Completion" value={fmt(m.completionRate, "%")} sub={`${m.counts.attempted} done · ${m.counts.missed} missed · ${m.counts.pending} not started${m.counts.inProgress ? ` · ${m.counts.inProgress} in progress` : ""}`} />
          <Kpi label="Consistency" value={CONSISTENCY[m.consistency.label]} sub={m.consistency.standardDeviation === null ? "Needs 3 finished tests" : `Spread ±${m.consistency.standardDeviation} pts`} />
          <Kpi label="Last 3 tests" value={fmt(m.scores.lastThreeAverage, "%")} sub={recentDelta === null ? "Needs 3 finished tests" : `${recentDelta >= 0 ? "+" : ""}${recentDelta} pts vs overall`} />
          <Kpi label="Unanswered" value={fmt(m.timing.unansweredRate, "%")} sub="of questions in finished tests" />
          <Kpi label="Timed out" value={fmt(m.timing.timedOutRate, "%")} sub={m.timing.averageTimeUsedPercent === null ? "No timed tests" : `Avg. ${m.timing.averageTimeUsedPercent}% of time used`} />
          <Kpi label="Retakes" value={m.retakes.count} sub={m.retakes.averageChange === null ? "No retaken tests finished" : `Avg. change ${m.retakes.averageChange >= 0 ? "+" : ""}${m.retakes.averageChange} pts`} />
        </div>

        {/* 4. Score trend */}
        <Section title="Score trend" subtitle="Student score per finished test, with the class average for the same test">
          {finishedChart.length === 0 ? <p className="text-sm text-gray-500">No finished tests yet.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={finishedChart} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="label" stroke={AXIS} />
                <YAxis domain={[0, 100]} stroke={AXIS} unit="%" />
                <Tooltip formatter={(v) => (v === null ? "–" : `${v}%`)} labelFormatter={(l) => `${l} · ${titles[l] || ""}`} />
                <Legend />
                <Line type="monotone" dataKey="Student" stroke={BLUE} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Class average" stroke={MUTED} strokeDasharray="5 5" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Section>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 5. Subject performance */}
          <Section id="perf-subjects" title="Subject performance" subtitle="Correct answers across finished tests" highlighted={focus?.startsWith("subject:")}>
            {m.bySubject.length === 0 ? <p className="text-sm text-gray-500">No finished tests yet.</p> : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(120, m.bySubject.length * 48)}>
                  <BarChart data={m.bySubject} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                    <XAxis type="number" domain={[0, 100]} stroke={AXIS} unit="%" />
                    <YAxis type="category" dataKey="subject" stroke={AXIS} width={90} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="percentage" name="Correct" fill={BLUE} radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  {m.bySubject.map((s) => (
                    <li key={s.subject} className={focus === `subject:${s.subject}` ? "font-semibold text-gray-900" : ""}>{s.subject}: {s.correct}/{s.questions} correct · {s.assessments} test{s.assessments === 1 ? "" : "s"}</li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          {/* 6. Difficulty performance */}
          <Section id="perf-difficulty" title="Difficulty performance" subtitle="Correct answers by question difficulty" highlighted={focus?.startsWith("difficulty:")}>
            {m.byDifficulty.length === 0 ? <p className="text-sm text-gray-500">No finished tests yet.</p> : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(120, m.byDifficulty.length * 48)}>
                  <BarChart data={m.byDifficulty} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                    <XAxis type="number" domain={[0, 100]} stroke={AXIS} unit="%" />
                    <YAxis type="category" dataKey="difficulty" stroke={AXIS} width={90} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="percentage" name="Correct" fill={BLUE} radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  {m.byDifficulty.map((d) => (
                    <li key={d.difficulty} className={focus === `difficulty:${d.difficulty}` ? "font-semibold text-gray-900" : ""}>{d.difficulty}: {d.correct}/{d.questions} correct · {d.questions - d.answered} unanswered</li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        </div>

        {/* 7. Assessment history */}
        <Section title="Assessment history" subtitle="Current attempt per test; earlier attempts (before a reset) are shown as history only">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Ref</th><th className="pr-3">Test</th><th className="pr-3">Subject</th><th className="pr-3">Status</th><th className="pr-3">Score</th>
                  <th className="pr-3">%</th><th className="pr-3">Class avg</th><th className="pr-3">Time used</th><th className="pr-3">Attempt</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {m.history.map((h) => {
                  const [label, cls] = h.state === "finished" ? STATE_LABEL.finished[h.attemptStatus] : STATE_LABEL[h.state];
                  return (
                    <tr key={h.label} id={`hist-${h.label}`} className={`border-b last:border-0 transition-colors ${focus === h.label ? "bg-blue-50" : ""}`} data-testid="aia-history-row">
                      <td className="py-2 pr-3 font-mono text-xs">{h.label}</td>
                      <td className="pr-3 font-medium">{h.title}</td>
                      <td className="pr-3">{h.subject}</td>
                      <td className="pr-3"><span className={`text-xs px-2 py-1 rounded-full ${cls}`}>{label}</span></td>
                      <td className="pr-3">{h.score === null ? "–" : `${h.score}/${h.totalQuestions}`}</td>
                      <td className="pr-3">{fmt(h.percentage, "%")}</td>
                      <td className="pr-3 text-gray-500">{fmt(h.classAveragePercentage, "%")}</td>
                      <td className="pr-3">{h.timeUsedSeconds === null ? "–" : `${fmtDuration(h.timeUsedSeconds)}${h.allowedSeconds ? ` / ${Math.round(h.allowedSeconds / 60)}m` : ""}`}</td>
                      <td className="pr-3">
                        {h.attemptNumber || "–"}
                        {h.previousAttempts.length > 0 && <span className="block text-xs text-gray-500">Earlier: {h.previousAttempts.map((p) => `${p.percentage}%`).join(", ")}</span>}
                      </td>
                      <td>{fmtDate(h.finishedAt || h.publishedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 8. AI Performance Report (explicit Generate only; reset per student) */}
        <AiPerformanceReport key={studentId} base={base} auth={auth} sufficiency={ds.level} titles={titles} onEvidence={showEvidence} student={student} scope={scope} />

        {/* 13. Data limitations */}
        <Section title="About this data" subtitle="What the metrics on this page cannot tell you reliably">
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700" data-testid="aia-limitations">
            {ds.level !== "adequate" && <li>Only {ds.finishedAssessments} finished assessment{ds.finishedAssessments === 1 ? "" : "s"}; trend and consistency need at least 3.</li>}
            {FIXED_LIMITATIONS.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </Section>
      </div>
    </MentorLayout>
  );
}
