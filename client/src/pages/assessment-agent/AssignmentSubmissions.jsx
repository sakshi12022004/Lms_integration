import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Download, Loader2, Sparkles, Users, XCircle } from "lucide-react";
import { ASSIGNMENT_STATUS, Badge, Stepper, SUBMISSION_STATUS, apiError, downloadPdf, dueText, fmtBytes, fmtDateTime } from "./assignmentUi";

/*
 * AI Assessment Agent - Descriptive Assignments: teacher submission dashboard (Prompt 2).
 * Loading this page never calls an AI. "Evaluate with AI" is the ONLY trigger: one request per click
 * (a per-row lock ignores double-clicks; the server also answers 429 to a concurrent request).
 * AI results are SUGGESTIONS: "Accept suggestions" only pre-fills the final-marks form; nothing is
 * saved until the teacher clicks "Save final marks". Students never see AI suggestions.
 */

const FILTERS = [["all", "All"], ["not_submitted", "Not submitted"], ["submitted", "Awaiting evaluation"], ["evaluated", "Evaluated"], ["missed", "Missed"]];
const classLabel = (c) => (c ? `${c.name} (Grade ${c.grade}${c.section ? ` ${c.section}` : ""})` : "—");

function Stat({ label, value, tone = "text-gray-900", icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-1.5">{Icon && <Icon size={14} />}{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone}`}>{value}</div>
    </div>
  );
}

function AiStatus({ state, seconds }) {
  if (state === "evaluating") return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700" data-testid="aia-asg-ai-status" data-state="evaluating"><Loader2 size={14} className="animate-spin" /> Evaluating... {seconds}s</span>;
  const [label, cls] = {
    ready: ["AI suggestion ready", "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"],
    failed: ["AI evaluation failed", "bg-red-50 text-red-700 ring-1 ring-red-200"],
    none: ["Not evaluated", "bg-gray-100 text-gray-600"],
  }[state];
  return <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${cls}`} data-testid="aia-asg-ai-status" data-state={state}>{label}</span>;
}

export default function AssignmentSubmissions({ base, auth, id, onBack, onOpen }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [evaluating, setEvaluating] = useState({}); // submissionId -> start ms
  const [failed, setFailed] = useState({}); // submissionId -> safe message
  const [panel, setPanel] = useState(null); // { submissionId, mode: 'ai' | 'review', form?: { marks: { Q1: '' }, feedback, fromAi } }
  const [saving, setSaving] = useState(false);
  const [, setTick] = useState(0);
  const inFlight = useRef(new Set()); // synchronous per-row lock
  const saveLock = useRef(false); // synchronous lock: "Save final marks" writes once per click

  const load = useCallback(async () => {
    try {
      setData((await axios.get(`${base}/assignments/${id}/submissions`, auth)).data); // facts only; no AI call
    } catch (err) {
      toast.error(apiError(err, "Could not load submissions."));
    }
  }, [base, auth, id]);
  useEffect(() => { load(); }, [load]);

  const busyCount = Object.keys(evaluating).length;
  useEffect(() => {
    if (!busyCount) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [busyCount]);

  const replaceSubmission = (submission) => setData((d) => ({ ...d, students: d.students.map((r) => (r.submission && r.submission.id === submission.id ? { ...r, submission, status: submission.status === "evaluated" ? "evaluated" : r.status } : r)) }));

  /** The ONLY AI trigger on this page. */
  const evaluate = async (submissionId) => {
    if (inFlight.current.has(submissionId)) return; // double-click: ignored
    inFlight.current.add(submissionId);
    setEvaluating((e) => ({ ...e, [submissionId]: Date.now() }));
    setFailed((f) => { const n = { ...f }; delete n[submissionId]; return n; });
    try {
      const res = await axios.post(`${base}/assignments/${id}/submissions/${submissionId}/evaluate-ai`, undefined, auth);
      replaceSubmission(res.data.submission);
      setPanel({ submissionId, mode: "ai" });
    } catch (err) {
      setFailed((f) => ({ ...f, [submissionId]: apiError(err, "The AI evaluation could not be completed. You can mark this submission manually.") }));
    } finally {
      inFlight.current.delete(submissionId);
      setEvaluating((e) => { const n = { ...e }; delete n[submissionId]; return n; });
    }
  };

  const openReview = (sub, fromAi) => {
    const marks = {};
    for (const q of data.questions) {
      const ai = fromAi ? sub.aiEvaluation.questions.find((x) => x.questionId === q.questionId) : null;
      const final = !fromAi && sub.questionMarks ? sub.questionMarks.find((x) => x.questionId === q.questionId) : null;
      marks[q.questionId] = ai ? String(ai.marksAwarded) : final ? String(final.marks) : "";
    }
    const feedback = fromAi ? (sub.aiEvaluation.overallFeedback || "") : (sub.teacherFeedback || "");
    setPanel({ submissionId: sub.id, mode: "review", form: { marks, feedback, fromAi } });
  };

  const save = async (a) => {
    if (saving || saveLock.current) return;
    const { form, submissionId } = panel;
    const questionMarks = data.questions.map((q) => ({ questionId: q.questionId, marks: Number(form.marks[q.questionId]) }));
    if (data.questions.some((q) => form.marks[q.questionId] === "" || Number.isNaN(Number(form.marks[q.questionId])))) { toast.error("Enter marks for every question."); return; }
    // Name the question instead of the server's generic "marks are not valid" (the server still validates).
    const bad = data.questions.find((q) => { const m = Number(form.marks[q.questionId]); return m < 0 || m > q.maxMarks || Math.round(m * 2) !== m * 2; });
    if (bad) { toast.error(`${bad.questionId}: enter a mark from 0 to ${bad.maxMarks}, in steps of 0.5.`); return; }
    saveLock.current = true;
    setSaving(true);
    try {
      const res = await axios.put(`${base}/assignments/${id}/submissions/${submissionId}/evaluation`, { questionMarks, teacherFeedback: form.feedback }, auth);
      replaceSubmission(res.data.submission);
      toast.success(`Final marks saved: ${res.data.submission.finalMarks} / ${a.maxMarks}`);
      setPanel(null);
      load();
    } catch (err) {
      toast.error(apiError(err, "Could not save the marks."));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  if (!data) return <div className="max-w-6xl mx-auto p-6 text-gray-500"><Loader2 className="inline animate-spin" /> Loading...</div>;
  const { assignment: a, summary: s } = data;
  const rows = data.students.filter((r) => filter === "all" || r.status === filter);
  const aiState = (sub) => (evaluating[sub.id] ? "evaluating" : failed[sub.id] ? "failed" : sub.aiEvaluation ? "ready" : "none");
  const qText = (qid) => data.questions.find((q) => q.questionId === qid)?.text || "";

  const AiPanel = ({ sub }) => {
    const ev = sub.aiEvaluation;
    return (
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-4" data-testid="aia-asg-ai-panel">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Sparkles size={16} className="text-indigo-600" /> AI Suggested Evaluation</h3>
            <p className="text-xs text-gray-500">Generated {fmtDateTime(ev.generatedAt)} · a suggestion only; nothing is saved until you save final marks.</p>
          </div>
          <div className="text-right"><span className="inline-block mb-1 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200">Not final · hidden from the student</span><div className="text-xs text-gray-500">AI suggested total</div><div className="text-xl font-bold text-gray-900" data-testid="aia-asg-ai-total">{ev.suggestedTotal} / {a.maxMarks}</div></div>
        </div>
        <ol className="space-y-3">
          {ev.questions.map((q) => (
            <li key={q.questionId} className="rounded-lg bg-white border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-gray-900">{q.questionId} <span className="font-normal text-gray-500 text-sm">{qText(q.questionId)}</span></span>
                <span className="text-sm font-semibold text-indigo-700">Suggested: {q.marksAwarded} / {q.maxMarks}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1"><span className="text-gray-500">Feedback:</span> {q.feedback}</p>
            </li>
          ))}
        </ol>
        {ev.overallFeedback && <div><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Overall feedback</div><p className="text-sm text-gray-800 mt-1">{ev.overallFeedback}</p></div>}
        {ev.limitations.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-800 flex items-center gap-1"><AlertTriangle size={12} /> Limitations</div>
            <ul className="list-disc pl-5 text-sm text-amber-900 mt-1 space-y-0.5">{ev.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => openReview(sub, true)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold" data-testid="aia-asg-ai-accept">Accept suggestions</button>
          <button onClick={() => openReview(sub, false)} className="px-4 py-2 border rounded-lg text-sm bg-white" data-testid="aia-asg-ai-edit">Edit evaluation</button>
          <button onClick={() => setPanel(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <span className="text-xs text-gray-500">"Accept" copies these marks into the review form. Nothing is saved until you click "Save final marks".</span>
        </div>
      </div>
    );
  };

  const ReviewForm = ({ sub }) => {
    const { form } = panel;
    const set = (patch) => setPanel((p) => ({ ...p, form: { ...p.form, ...patch } }));
    const total = data.questions.reduce((t, q) => t + (Number(form.marks[q.questionId]) || 0), 0);
    return (
      <div className="rounded-xl border p-5 bg-white space-y-4" data-testid="aia-asg-review">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900">Final marks</h3>
            <p className="text-xs text-gray-500">Your decision. Saving makes these marks and your feedback visible to the student.</p>
          </div>
          {form.fromAi && <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">Pre-filled from the AI suggestion: review before saving</span>}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {data.questions.map((q) => {
            const ai = sub.aiEvaluation?.questions.find((x) => x.questionId === q.questionId);
            return (
              <label key={q.questionId} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <span className="min-w-0"><span className="font-semibold">{q.questionId}</span> <span className="text-gray-500 truncate">{q.text}</span>{ai && <span className="block text-xs text-indigo-700">AI suggested {ai.marksAwarded}</span>}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <input type="number" min="0" max={q.maxMarks} step="0.5" className="w-20 p-1.5 border rounded" value={form.marks[q.questionId]}
                    onChange={(e) => set({ marks: { ...form.marks, [q.questionId]: e.target.value } })} data-testid={`aia-asg-mark-${q.questionId}`} />
                  / {q.maxMarks}
                </span>
              </label>
            );
          })}
        </div>
        <div className="text-sm">Total: <span className="font-bold" data-testid="aia-asg-review-total">{total} / {a.maxMarks}</span></div>
        <textarea className="w-full p-2.5 border rounded-lg text-sm" rows={3} placeholder="Feedback for the student (optional)" value={form.feedback} onChange={(e) => set({ feedback: e.target.value })} data-testid="aia-asg-review-feedback" />
        <div className="flex gap-2">
          <button disabled={saving} onClick={() => save(a)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-60" data-testid="aia-asg-save-final">{saving ? "Saving..." : "Save final marks"}</button>
          <button onClick={() => setPanel(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6" data-testid="aia-asg-submissions">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft size={16} /> All assignments</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Submissions</p>
          <h1 className="text-2xl font-bold">{a.title}</h1>
          <p className="text-sm text-gray-500">{classLabel(a.classroom)} · {a.maxMarks} marks · {dueText(a.dueAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge map={ASSIGNMENT_STATUS} value={a.status} />
          <button onClick={() => onOpen(a.id)} className="px-3 py-2 border rounded-lg text-sm">View assignment</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Students" value={s.students} icon={Users} />
        <Stat label="Submitted" value={s.submitted + s.evaluated} tone="text-blue-700" icon={CheckCircle2} />
        <Stat label="Not submitted" value={s.notSubmitted} tone="text-amber-700" icon={ClipboardList} />
        <Stat label="Evaluated" value={s.evaluated} tone="text-green-700" icon={CheckCircle2} />
        <Stat label="Missed" value={s.missed} tone="text-red-600" icon={XCircle} />
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="aia-asg-marking-flow">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">How marking works</span>
        <Stepper steps={["AI suggests marks", "You review", "You save final marks", "Student sees the final result"]} optional={[0]} />
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-wrap gap-2 mb-4" role="tablist">
          {FILTERS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-sm border ${filter === k ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {label} <span className="opacity-70">{k === "all" ? s.students : k === "not_submitted" ? s.notSubmitted : k === "submitted" ? s.submitted : k === "evaluated" ? s.evaluated : s.missed}</span>
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{s.students === 0 ? "No students are in this class yet." : "No students in this view."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b">
                  <th className="py-3 pr-4">Student</th><th className="pr-4">Submission</th><th className="pr-4">AI suggestion</th><th className="pr-4">Final marks <span className="normal-case font-normal">(student sees)</span></th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const sub = r.submission;
                  const open = sub && panel?.submissionId === sub.id;
                  return (
                    <Fragment key={r.studentId}>
                      <tr className={`border-b align-top ${open ? "bg-gray-50/60" : ""}`} data-testid="aia-asg-sub-row" data-student={r.studentName} data-status={r.status}>
                        <td className="py-3 pr-4 font-medium text-gray-900">{r.studentName}</td>
                        <td className="py-3 pr-4">
                          <Badge map={SUBMISSION_STATUS} value={r.status} testId="aia-asg-sub-status" />
                          {sub && (
                            <div className="mt-1.5 text-xs text-gray-500">
                              {fmtDateTime(sub.submittedAt)} ·{" "}
                              <button onClick={() => downloadPdf(`${base}/assignments/${id}/submissions/${sub.id}/file`, auth, sub.originalFilename).catch(() => toast.error("Could not download the file."))}
                                className="inline-flex items-center gap-1 text-primary hover:underline" title="Download PDF">
                                <Download size={12} /> <span className="max-w-[10rem] truncate">{sub.originalFilename}</span>
                              </button>{" "}· {fmtBytes(sub.fileSize)}{sub.version > 1 ? ` · v${sub.version}` : ""}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {sub ? <AiStatus state={aiState(sub)} seconds={evaluating[sub.id] ? Math.floor((Date.now() - evaluating[sub.id]) / 1000) : 0} /> : <span className="text-gray-400">—</span>}
                          {sub && failed[sub.id] && <p className="text-xs text-red-600 mt-1 max-w-[14rem]" data-testid="aia-asg-ai-error">{failed[sub.id]}</p>}
                          {sub?.aiEvaluation && !evaluating[sub.id] && <p className="text-xs text-indigo-700 mt-1" data-testid="aia-asg-ai-suggested">AI suggested {sub.aiEvaluation.suggestedTotal} / {a.maxMarks}</p>}
                        </td>
                        <td className="py-3 pr-4 font-semibold" data-testid="aia-asg-final-marks">{sub?.finalMarks != null ? `${sub.finalMarks} / ${a.maxMarks}` : <span className="text-gray-400 font-normal">— / {a.maxMarks}</span>}</td>
                        <td className="py-3">
                          {sub && (
                            <div className="flex flex-wrap gap-2">
                              <button disabled={!!evaluating[sub.id]} onClick={() => evaluate(sub.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed" data-testid="aia-asg-evaluate-ai">
                                {evaluating[sub.id] ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {sub.aiEvaluation ? "Re-evaluate" : "Evaluate with AI"}
                              </button>
                              {sub.aiEvaluation && <button onClick={() => setPanel(open && panel.mode === "ai" ? null : { submissionId: sub.id, mode: "ai" })} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50" data-testid="aia-asg-view-ai">View AI evaluation</button>}
                              <button onClick={() => openReview(sub, false)} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50" data-testid="aia-asg-review-open">Review / edit</button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b">
                          <td colSpan={5} className="py-4">{/* called as functions (not <Components/>) so inputs keep focus while typing */}{panel.mode === "ai" && sub.aiEvaluation ? AiPanel({ sub }) : panel.mode === "review" ? ReviewForm({ sub }) : null}</td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
