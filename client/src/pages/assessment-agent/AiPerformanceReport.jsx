import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, Download, FileText, Info, Loader2, RefreshCw, Send, Sparkles, AlertCircle, Wand2,
} from "lucide-react";
import { toast } from "react-toastify";
import { downloadReportPdf } from "./reportPdf";

/*
 * AI Assessment Agent - AI Performance Report (teacher-only), shown under the factual metrics.
 * POST /api/assessment-agent/teacher/students/:id/performance/analysis  { focus?, instructions? }
 *
 * The LLM is called ONLY from the "Generate AI Report" / "Regenerate" / "Try again" buttons:
 * one request per click, a synchronous lock ignores double-clicks, and the button is disabled while
 * it runs. Nothing is generated on open, refresh, metric loading, chart rendering or student change
 * (the parent keys this component by student). The report lives in this component's state only.
 * Every sentence is the model's INTERPRETATION of the facts above; the server has already checked
 * each evidence reference, number and claim against the supplied data.
 */

const OVERALL = {
  strong: ["Strong", "bg-green-100 text-green-700"],
  on_track: ["On track", "bg-blue-50 text-blue-700"],
  needs_support: ["Needs support", "bg-amber-100 text-amber-800"],
  insufficient_evidence: ["Insufficient evidence", "bg-gray-100 text-gray-600"],
};
const PRIORITY = { high: "bg-red-50 text-red-700", medium: "bg-amber-50 text-amber-800", low: "bg-gray-100 text-gray-600" };
const STRENGTH = { strong: "Strong evidence", moderate: "Moderate evidence", limited: "Limited evidence" };
const METRIC = { overall: "Overall score", recent: "Recent performance", completion: "Completion", consistency: "Consistency", unanswered: "Unanswered questions", timed_out: "Timed-out attempts", retakes: "Retakes", trend: "Trend", timing: "Timing" };
const QTYPE = { single_mcq: "single-answer MCQ", multi_select: "multiple-select", numerical: "numerical", mixed: "mixed question types" };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Generated just now" / "Generated 5 minutes ago" / "Generated 2 hours ago". */
function ago(iso, now) {
  const mins = Math.floor((now - Date.parse(iso)) / 60000);
  if (mins < 1) return "Generated just now";
  if (mins < 60) return `Generated ${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  return `Generated ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/** Human-readable evidence label: A2, "A2 · Q3", "Subject: Maths", "Difficulty: Easy", "Metric: Timed-out attempts". */
export function evidenceLabel(ref) {
  const q = /^(A\d+)-Q(\d+)$/.exec(ref);
  if (q) return `${q[1]} · Q${q[2]}`;
  const [kind, value] = ref.split(/:(.*)/s);
  if (kind === "subject") return `Subject: ${value}`;
  if (kind === "difficulty") return `Difficulty: ${cap(value)}`;
  if (kind === "metric") return `Metric: ${METRIC[value] || value}`;
  return ref;
}

function Tag({ kind }) {
  const [label, cls] = {
    observed: ["Observed", "bg-slate-100 text-slate-700"],
    interpretation: ["Interpretation", "bg-indigo-50 text-indigo-700"],
    recommendation: ["Recommendation", "bg-emerald-50 text-emerald-700"],
    investigate: ["To investigate", "bg-amber-50 text-amber-800"],
  }[kind];
  return <span className={`inline-block text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded mr-2 align-middle ${cls}`}>{label}</span>;
}

function Line({ kind, children }) {
  return <p className="text-sm text-gray-700 leading-relaxed"><Tag kind={kind} />{children}</p>;
}

function Card({ title, icon: Icon, tone = "text-gray-700", children, testId }) {
  return (
    <div className="border rounded-xl p-5 bg-white" data-testid={testId}>
      <h3 className={`font-semibold flex items-center gap-2 mb-3 ${tone}`}>{Icon && <Icon size={18} />}{title}</h3>
      {children}
    </div>
  );
}

export default function AiPerformanceReport({ base, auth, sufficiency, titles, onEvidence, student, scope }) {
  const navigate = useNavigate();
  const [focuses, setFocuses] = useState([]);
  const [reportFocus, setReportFocus] = useState("overall_progress");
  const [instructions, setInstructions] = useState("");
  const [ai, setAi] = useState({ state: "idle" }); // idle | loading | ok | insufficient | error
  const [now, setNow] = useState(Date.now());
  const inFlight = useRef(false); // synchronous lock: a double-click in the same tick still sends ONE request
  // "Send to Student" (migration 008): shares the STORED report (ai.reportId). Never calls the AI.
  const [share, setShare] = useState({ state: "idle" }); // idle | sending | sent
  const shareLock = useRef(false);
  const teacherBase = base.replace(/\/students\/[^/]+\/performance$/, "");

  // Report focus options (read-only; no LLM call).
  useEffect(() => {
    axios.get(`${base.replace(/\/students\/[^/]+\/performance$/, "")}/ai/report-focuses`, auth)
      .then((res) => setFocuses(res.data.focuses))
      .catch(() => setFocuses([]));
  }, [base, auth]);

  // Keeps "Generated X minutes ago" current (display only).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // The ONLY place this page calls the LLM, and only from an explicit click.
  const generate = async () => {
    if (inFlight.current) return; // no duplicate requests
    inFlight.current = true;
    setAi({ state: "loading" });
    setShare({ state: "idle" }); // a new report must be sent again explicitly
    try {
      const body = { focus: reportFocus, ...(instructions.trim() ? { instructions: instructions.trim() } : {}) };
      const res = await axios.post(`${base}/analysis`, body, auth); // report options only: the student data comes from the server
      const a = res.data.analysis;
      setNow(Date.now());
      setAi(a.status === "ok" ? { state: "ok", ...a } : { state: "insufficient", message: a.message });
    } catch (err) {
      setAi({ state: "error", message: err?.response?.data?.error?.message || "The AI report could not be generated right now. The metrics above are unaffected." });
    } finally {
      inFlight.current = false;
    }
  };

  const sendToStudent = async () => {
    if (shareLock.current || share.state !== "idle" || !ai.reportId) return;
    if (!window.confirm(`Send this AI Performance Report to ${student?.name || "the student"}? They will get a notification and can download it as a PDF. It cannot be unsent.`)) return;
    shareLock.current = true;
    setShare({ state: "sending" });
    try {
      const res = await axios.post(`${teacherBase}/performance-reports/${ai.reportId}/share`, undefined, auth);
      setShare({ state: "sent", sharedAt: res.data.report.sharedAt });
      toast.success(`Report sent to ${student?.name || "the student"}.`);
    } catch (err) {
      setShare({ state: "idle" });
      toast.error(err?.response?.data?.error?.message || "The report could not be sent. Please try again.");
    } finally {
      shareLock.current = false;
    }
  };

  const Chips = ({ refs }) => (
    <div className="flex flex-wrap gap-1 mt-2">
      {refs.map((r) => {
        const assessment = /^(A\d+)/.exec(r)?.[1];
        return (
          <button key={r} type="button" onClick={() => onEvidence(r)} title={assessment ? titles[assessment] || r : evidenceLabel(r)}
            className="text-xs px-2 py-0.5 rounded-full border border-gray-300 text-gray-600 bg-white hover:bg-gray-50" data-testid="aia-evidence-chip">
            {evidenceLabel(r)}
          </button>
        );
      })}
    </div>
  );

  /**
   * "Generate this assessment": opens the EXISTING AI generator pre-filled with the suggestion (no AI call
   * here). Only data the generator already takes: topic, subject, class, type, difficulty, count.
   */
  const generateNext = (n) => {
    const subjectRef = (n.evidence || []).find((r) => r.startsWith("subject:"));
    const subject = subjectRef ? subjectRef.slice(8) : (scope.subjects || [])[0] || "";
    const classroomId = student?.classes?.length ? String(student.classes[0].id) : "";
    navigate("/teacher/assessments", {
      state: {
        aiPrefill: {
          topic: String(n.objective || "").slice(0, 200),
          subject,
          classroomId,
          count: Math.min(Math.max(Number(n.questionCount) || 10, 1), 20), // the generator's range is 1-20
          difficulty: n.difficulty || "medium",
          questionType: n.questionType && n.questionType !== "mixed" ? n.questionType : "single_mcq",
          source: `AI Performance Report for ${student?.name || "a student"}`,
          student: student ? { id: student.id, name: student.name } : null, // pre-selected recipient (a default, not a restriction)
        },
      },
    });
  };

  const selected = focuses.find((f) => f.id === reportFocus);
  const needsInstructions = reportFocus === "custom" && !instructions.trim();
  const loading = ai.state === "loading";
  const isPreview = ai.state === "ok" && ai.preview && ai.preview.validated === false; // TEMPORARY preview mode
  const status = loading ? "Generating..." : isPreview ? `PREVIEW / NOT VALIDATED · ${ago(ai.generatedAt, now)}` : ai.state === "ok" ? ago(ai.generatedAt, now) : "AI analysis not generated";
  const c = ai.content;

  return (
    <section className="bg-white rounded-xl shadow border-t-4 border-primary" data-testid="aia-ai-section">
      <div className="p-6 border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2"><FileText size={18} /> AI Performance Report</h2>
            <p className="text-sm text-gray-500">AI interpretation of the metrics above. It cannot change any score; review it with your own judgement.</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${isPreview ? "bg-amber-100 text-amber-900 font-semibold ring-1 ring-amber-300" : ai.state === "ok" ? "bg-green-50 text-green-700" : loading ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`} data-testid="aia-ai-status">
            {status}
          </span>
        </div>

        {sufficiency === "none" ? (
          <p className="mt-4 text-sm text-gray-500">The AI report becomes available after the first finished assessment.</p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
            <label className="text-sm">
              <span className="block font-medium text-gray-700 mb-1">Report focus</span>
              <select className="w-full p-2 border rounded-lg bg-white" value={reportFocus} onChange={(e) => setReportFocus(e.target.value)} disabled={loading} data-testid="aia-report-focus">
                {(focuses.length ? focuses : [{ id: "overall_progress", label: "Overall Academic Progress" }]).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              {selected && <span className="block text-xs text-gray-500 mt-1">{selected.description}</span>}
            </label>
            <label className="text-sm">
              <span className="block font-medium text-gray-700 mb-1">{reportFocus === "custom" ? "Instructions (required for Custom Focus)" : "Additional instructions (optional)"}</span>
              <textarea className="w-full p-2 border rounded-lg" rows={2} maxLength={500} disabled={loading} value={instructions} onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Keep recommendations to what can be done in the next two weeks." data-testid="aia-report-instructions" />
              <span className="block text-xs text-gray-400">These refine the focus; they cannot change the safety rules or the data used.</span>
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button onClick={generate} disabled={loading || needsInstructions} aria-busy={loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold disabled:opacity-60 disabled:cursor-not-allowed" data-testid="aia-ai-generate">
                {loading ? <Loader2 size={16} className="animate-spin" /> : ai.state === "ok" ? <RefreshCw size={16} /> : <Sparkles size={16} />}
                {loading ? "Generating..." : ai.state === "ok" ? "Regenerate" : "Generate AI Report"}
              </button>
              <span className="text-xs text-gray-500">Generated only when you click. Each click makes one request.</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-gray-50 rounded-b-xl">
        {sufficiency !== "none" && ai.state === "idle" && (
          <div className="p-5 rounded-lg border border-dashed border-gray-300 bg-white text-sm" data-testid="aia-ai-empty">
            <p className="font-medium text-gray-700">AI analysis has not been generated yet.</p>
            <p className="text-gray-500 mt-1">Choose a report focus and click "Generate AI Report" for an evidence-based interpretation with recommended mentor actions.</p>
          </div>
        )}
        {loading && <p className="text-sm text-gray-600 flex items-center gap-2" data-testid="aia-ai-loading"><Loader2 size={16} className="animate-spin" /> Preparing the report from the metrics above...</p>}
        {ai.state === "insufficient" && <p className="text-sm text-gray-600">{ai.message}</p>}
        {ai.state === "error" && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm" role="alert" data-testid="aia-ai-unavailable">
            <p className="text-red-700 font-medium flex items-center gap-2"><AlertTriangle size={16} /> {ai.message}</p>
            <button onClick={generate} disabled={needsInstructions} className="mt-3 px-3 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-60">Try again</button>
          </div>
        )}

        {ai.state === "ok" && (
          <div className="space-y-5" data-testid="aia-ai-content">
            {/* TEMPORARY PREVIEW MODE (AIA_REPORT_PREVIEW_MODE): remove with core/ai/reportPreview.js */}
            {isPreview && (
              <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4" role="alert" data-testid="aia-report-preview">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-amber-500 text-white">Preview / Not validated</span>
                  <p className="font-semibold text-amber-900">Preview mode: this AI report has not passed all quality checks. Verify the content before relying on it.</p>
                </div>
                {ai.preview.warnings?.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-amber-900 space-y-0.5" data-testid="aia-report-preview-warnings">
                    {ai.preview.warnings.map((w) => <li key={w.code}>{w.message}{w.sections?.length ? <span className="text-amber-700"> ({w.sections.join(", ")})</span> : null}</li>)}
                  </ul>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>Focus: <span className="font-medium text-gray-700">{ai.focus?.label}</span></span>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1"><Tag kind="observed" /><Tag kind="interpretation" /><Tag kind="recommendation" /></span>
              {student && scope && (
                <button type="button" onClick={() => downloadReportPdf({ student, scope, ai, evidenceLabel })}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white text-sm font-medium text-gray-700 hover:bg-gray-50" data-testid="aia-report-pdf">
                  <Download size={14} /> Download PDF
                </button>
              )}
              {student && (
                share.state === "sent" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium" data-testid="aia-report-sent">
                    <CheckCircle2 size={14} /> Sent to {student.name}
                  </span>
                ) : (
                  <button type="button" onClick={sendToStudent} disabled={!ai.reportId || share.state === "sending"}
                    title={ai.reportId ? `Share this report with ${student.name}` : "Sending reports is not available yet (a database update is pending)."}
                    className={`${scope ? "" : "ml-auto "}inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed`} data-testid="aia-report-send">
                    {share.state === "sending" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send to Student
                  </button>
                )
              )}
            </div>

            {/* A. Executive summary */}
            <div className="rounded-xl border-l-4 border-primary bg-white p-5 shadow-sm" data-testid="aia-report-summary">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="font-bold text-gray-900">Executive Summary</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${OVERALL[c.executiveSummary.overallStatus][1]}`}>{OVERALL[c.executiveSummary.overallStatus][0]}</span>
              </div>
              <div className="space-y-2">
                <Line kind="observed">{c.executiveSummary.observed}</Line>
                <Line kind="interpretation">{c.executiveSummary.interpretation}</Line>
              </div>
            </div>

            {/* B. Performance overview */}
            <Card title="Performance Overview" icon={ClipboardCheck} testId="aia-report-overview">
              <div className="grid gap-3 md:grid-cols-2">
                {c.performanceOverview.map((o) => (
                  <div key={o.metric} className="rounded-lg border p-3 bg-gray-50">
                    <div className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-1">{METRIC[o.metric]}</div>
                    <div className="space-y-1"><Line kind="observed">{o.observed}</Line><Line kind="interpretation">{o.interpretation}</Line></div>
                    <Chips refs={o.evidence} />
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* C. Strengths */}
              <Card title="Strengths" icon={CheckCircle2} tone="text-green-700" testId="aia-report-strengths">
                {c.strengths.length === 0 ? <p className="text-sm text-gray-500">No strengths can be stated with the available evidence.</p> : (
                  <ul className="space-y-4">
                    {c.strengths.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium text-gray-900">{s.area} <span className="ml-1 text-xs font-normal text-gray-500">{STRENGTH[s.evidenceStrength]}</span></div>
                          <Line kind="observed">{s.observed}</Line>
                          <Chips refs={s.evidence} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* D. Areas requiring attention */}
              <Card title="Areas Requiring Attention" icon={AlertCircle} tone="text-amber-700" testId="aia-report-focus-areas">
                {c.focusAreas.length === 0 ? <p className="text-sm text-gray-500">No areas requiring attention were identified in the available evidence.</p> : (
                  <ul className="space-y-4">
                    {c.focusAreas.map((f, i) => (
                      <li key={i} className="flex gap-3">
                        <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900 flex flex-wrap items-center gap-2">
                            {f.area}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY[f.priority]}`}>{f.priority} priority</span>
                            <span className="text-xs font-normal text-gray-500">{STRENGTH[f.evidenceStrength]}</span>
                          </div>
                          <Line kind="observed">{f.observed}</Line>
                          <Line kind="interpretation">{f.interpretation}</Line>
                          <Line kind="investigate">{f.investigate}</Line>
                          <Chips refs={f.evidence} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* E. Recommended mentor actions */}
            <Card title="Recommended Mentor Actions" icon={ArrowRight} tone="text-emerald-700" testId="aia-report-actions">
              <ol className="space-y-3">
                {c.mentorActions.map((a, i) => (
                  <li key={i} className="flex gap-3 rounded-lg border p-3 bg-white">
                    <ArrowRight size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-medium text-gray-900 flex flex-wrap items-center gap-2"><Tag kind="recommendation" />{a.action}<span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY[a.priority]}`}>{a.priority}</span></div>
                      <p className="text-sm text-gray-600">{a.rationale}</p>
                      <Chips refs={a.evidence} />
                    </div>
                  </li>
                ))}
              </ol>
            </Card>

            {/* F. Suggested next assessment */}
            {c.nextAssessment && (
            <Card title="Suggested Next Assessment" icon={Sparkles} tone="text-primary" testId="aia-report-next">
              <p className="text-sm text-gray-900 font-medium">{c.nextAssessment.objective}</p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                {[["Questions", c.nextAssessment.questionCount ?? "—"], ["Question type", c.nextAssessment.questionType ? cap(QTYPE[c.nextAssessment.questionType]) : "—"], ["Difficulty", c.nextAssessment.difficulty ? cap(c.nextAssessment.difficulty) : "—"]].map(([k, v]) => (
                  <div key={k} className="rounded-lg border bg-gray-50 p-2"><div className="text-xs text-gray-500">{k}</div><div className="font-semibold text-gray-800">{v}</div></div>
                ))}
              </div>
              <p className="mt-3 text-sm text-gray-600">{c.nextAssessment.rationale}</p>
              <Chips refs={c.nextAssessment.evidence} />
              {scope && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => generateNext(c.nextAssessment)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold" data-testid="aia-report-generate-next">
                    <Wand2 size={16} /> Generate this assessment
                  </button>
                  <span className="text-xs text-gray-500">Opens the AI generator pre-filled with this suggestion. Nothing is generated until you click "Generate Questions" there; after reviewing you can save it or assign it to the class.</span>
                </div>
              )}
              <p className="mt-2 text-xs text-gray-400">A suggestion only: no assessment is created. Use "Generate with AI" on the AI Assessments page if you want to build it.</p>
            </Card>
            )}

            {/* G. Data limitations */}
            <Card title="Data Limitations" icon={Info} tone="text-gray-700" testId="aia-report-limitations">
              {c.dataLimitations.length === 0 ? <p className="text-sm text-gray-500">No specific limitations were noted for this report.</p> : (
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">{c.dataLimitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
              )}
            </Card>

            <p className="text-xs text-gray-400">{new Date(ai.generatedAt).toLocaleString()} · provider: {ai.provider} · focus: {ai.focus?.label}</p>
          </div>
        )}
      </div>
    </section>
  );
}
