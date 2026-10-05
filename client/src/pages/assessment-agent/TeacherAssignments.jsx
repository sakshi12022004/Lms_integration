import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import {
  ArrowDown, ArrowLeft, ArrowUp, CalendarClock, CheckCircle2, FileText, Inbox, Loader2, Lock, Plus, Send, Trash2,
} from "lucide-react";
import MentorLayout from "../../components/MentorLayout";
import AssignmentSubmissions from "./AssignmentSubmissions";
import { useAuth } from "../../auth/auth";
import {
  ASSIGNMENT_STATUS, Badge, Stepper, TEACHER_FLOW, apiError, dueText, toIso, toLocalInput,
} from "./assignmentUi";

/*
 * AI Assessment Agent - Descriptive Assignments (teacher). Backend: /api/assessment-agent/teacher/assignments.
 * Draft -> Publish (locks details + questions) -> Close. The submission dashboard shows who has and has
 * not submitted, lets the teacher download PDFs and record final marks. Nothing here calls an AI.
 */

const EMPTY = { title: "", instructions: "", classroomId: "", maxMarks: 10, dueAt: "" };
const newQuestion = () => ({ key: Math.random().toString(36).slice(2), text: "", maxMarks: 5 });
const classLabel = (c) => (c ? `${c.name} (Grade ${c.grade}${c.section ? ` ${c.section}` : ""})` : "—");

function Card({ title, subtitle, children, right }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {(title || right) && (
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}


export default function TeacherAssignments() {
  const { token, API } = useAuth();
  const base = `${API}/assessment-agent/teacher`;
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [view, setView] = useState({ name: "list" }); // list | edit { id? } | submissions { id }
  const [list, setList] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [notReady, setNotReady] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([axios.get(`${base}/assignments`, auth), axios.get(`${base}/classrooms`, auth)]);
      setList(a.data.assignments);
      setClassrooms(c.data.classrooms);
    } catch (err) {
      if (err?.response?.data?.error?.code === "ASSIGNMENTS_NOT_READY") setNotReady(true);
      else toast.error(apiError(err, "Could not load assignments."));
      setList([]);
    }
  }, [base, auth]);
  useEffect(() => { loadList(); }, [loadList]);

  const back = () => { setView({ name: "list" }); loadList(); };

  if (view.name === "edit") return <MentorLayout><Editor base={base} auth={auth} classrooms={classrooms} id={view.id} onBack={back} onOpenSubmissions={(id) => setView({ name: "submissions", id })} /></MentorLayout>;
  if (view.name === "submissions") return <MentorLayout><AssignmentSubmissions base={base} auth={auth} id={view.id} onBack={back} onOpen={(id) => setView({ name: "edit", id })} /></MentorLayout>;

  return (
    <MentorLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <Link to="/teacher/assessments" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft size={16} /> AI Assessments</Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileText size={24} /> Descriptive Assignments</h1>
            <p className="text-sm text-gray-500">Written assignments your students answer in a PDF. Create a draft, publish it to a class, then follow submissions.</p>
            <div className="mt-3"><Stepper steps={TEACHER_FLOW} optional={[3]} testId="aia-asg-flow" /></div>
            <p className="mt-2 text-xs text-gray-500">AI evaluation only suggests marks. You review them, and only the final marks you save are shown to students.</p>
          </div>
          {!notReady && (
            <button onClick={() => setView({ name: "edit" })} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-semibold shadow-sm" data-testid="aia-asg-new">
              <Plus size={18} /> New assignment
            </button>
          )}
        </div>

        {notReady ? (
          <div className="p-6 rounded-2xl bg-amber-50 text-amber-800 text-sm">Descriptive assignments are not available yet (a database update is pending).</div>
        ) : list === null ? (
          <div className="p-10 text-center text-gray-500"><Loader2 className="inline animate-spin" /> Loading...</div>
        ) : list.length === 0 ? (
          <div className="p-12 bg-white rounded-2xl border border-dashed border-gray-300 text-center">
            <Inbox size={36} className="mx-auto text-gray-400" />
            <p className="mt-3 font-semibold text-gray-800">No assignments yet</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">Create your first descriptive assignment: add instructions and questions with marks, then publish it to a class.</p>
            <button onClick={() => setView({ name: "edit" })} className="mt-5 px-4 py-2 bg-primary text-white rounded-lg font-semibold">Create assignment</button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {list.map((a) => (
              <article key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow" data-testid="aia-asg-row" data-title={a.title}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{a.title}</h3>
                    <p className="text-sm text-gray-500">{classLabel(a.classroom)} · {a.maxMarks} marks · {a.questionCount} question{a.questionCount === 1 ? "" : "s"}</p>
                  </div>
                  <Badge map={ASSIGNMENT_STATUS} value={a.status} />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600"><CalendarClock size={16} className="text-gray-400" /> {dueText(a.dueAt)}</div>
                {a.status !== "draft" && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{a.submittedCount} of {a.studentsInClass} submitted</span><span>{a.evaluatedCount} evaluated</span></div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${a.studentsInClass ? Math.min(100, (a.submittedCount / a.studentsInClass) * 100) : 0}%` }} /></div>
                  </div>
                )}
                <div className="flex gap-2 mt-auto">
                  <button onClick={() => setView({ name: "edit", id: a.id })} className="px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50" data-testid="aia-asg-open">
                    {a.status === "draft" ? "Edit draft" : "View"}
                  </button>
                  {a.status !== "draft" && (
                    <button onClick={() => setView({ name: "submissions", id: a.id })} className="px-3 py-2 bg-primary/10 text-primary rounded-lg text-sm font-semibold" data-testid="aia-asg-view-submissions">Submissions</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </MentorLayout>
  );
}

/* ---------------- draft editor / read-only view ---------------- */
function Editor({ base, auth, classrooms, id, onBack, onOpenSubmissions }) {
  const [assignment, setAssignment] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [questions, setQuestions] = useState([newQuestion()]);
  const [busy, setBusy] = useState(false);

  const accept = (a) => {
    setAssignment(a);
    setForm({ title: a.title, instructions: a.instructions, classroomId: String(a.classroomId), maxMarks: a.maxMarks, dueAt: toLocalInput(a.dueAt) });
    setQuestions(a.questions.length ? a.questions.map((q) => ({ key: String(q.id), text: q.text, maxMarks: q.maxMarks })) : [newQuestion()]);
  };
  useEffect(() => {
    if (!id) return;
    axios.get(`${base}/assignments/${id}`, auth).then((r) => accept(r.data.assignment)).catch((err) => toast.error(apiError(err, "Could not load the assignment.")));
  }, [id, base, auth]);

  const locked = assignment && assignment.status !== "draft";
  const total = questions.reduce((s, q) => s + (Number(q.maxMarks) || 0), 0);
  const maxMarks = Number(form.maxMarks) || 0;
  const setQ = (i, patch) => setQuestions((qs) => qs.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const move = (i, d) => setQuestions((qs) => { const n = [...qs]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });

  const save = async () => {
    const details = { title: form.title, instructions: form.instructions, classroomId: form.classroomId === "" ? null : Number(form.classroomId), maxMarks: Number(form.maxMarks), dueAt: toIso(form.dueAt) };
    const body = { questions: questions.filter((q) => q.text.trim() !== "").map((q) => ({ text: q.text, maxMarks: Number(q.maxMarks) })) };
    let a = assignment;
    a = a ? (await axios.patch(`${base}/assignments/${a.id}`, details, auth)).data.assignment : (await axios.post(`${base}/assignments`, details, auth)).data.assignment;
    a = (await axios.put(`${base}/assignments/${a.id}/questions`, body, auth)).data.assignment;
    accept(a);
    return a;
  };

  // Synchronous lock: a double-click (same tick) must not create two drafts or publish twice.
  const inFlight = useRef(false);
  const run = async (fn, success) => {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
    } catch (err) {
      const e = err?.response?.data?.error;
      const extra = (e?.details || []).map((d) => (d.code === "MARKS_MISMATCH" ? `question marks add up to ${d.received}, not ${d.expected}` : `${d.field || "request"}: ${d.code}`)).join("; ");
      toast.error(`${apiError(err, "Could not save.")}${extra ? ` (${extra})` : ""}`);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const publish = () => run(async () => {
    const a = await save();
    if (!window.confirm(`Publish "${a.title}"? Students in the class can see it and submit, and it can no longer be edited.`)) return;
    accept((await axios.post(`${base}/assignments/${a.id}/publish`, undefined, auth)).data.assignment);
  }, null);
  const close = () => run(async () => {
    if (!window.confirm(`Close "${assignment.title}"? Students can no longer submit or replace their PDFs.`)) return;
    accept((await axios.post(`${base}/assignments/${assignment.id}/close`, undefined, auth)).data.assignment);
  }, "Assignment closed");

  if (id && !assignment) return <div className="max-w-5xl mx-auto p-6 text-gray-500"><Loader2 className="inline animate-spin" /> Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft size={16} /> All assignments</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{assignment ? assignment.title : "New assignment"}</h1>
          <div className="my-2"><Stepper steps={TEACHER_FLOW} current={!assignment || assignment.status === "draft" ? 0 : 2} optional={[3]} testId="aia-asg-editor-flow" /></div>
          <p className="text-sm text-gray-500">{locked ? "Published assignments are locked so every student answers the same questions." : "Drafts are private. Save as often as you like, then publish."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {assignment && <Badge map={ASSIGNMENT_STATUS} value={assignment.status} testId="aia-asg-status" />}
          {!locked && <button disabled={busy} onClick={() => run(save, "Draft saved")} className="px-4 py-2 border rounded-lg font-medium disabled:opacity-60" data-testid="aia-asg-save">Save draft</button>}
          {!locked && (
            <button disabled={busy} onClick={publish} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold disabled:opacity-60" data-testid="aia-asg-publish">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Publish
            </button>
          )}
          {locked && <button onClick={() => onOpenSubmissions(assignment.id)} className="px-4 py-2 bg-primary text-white rounded-lg font-semibold" data-testid="aia-asg-view-submissions">View submissions</button>}
          {assignment?.status === "published" && <button disabled={busy} onClick={close} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium" data-testid="aia-asg-close">Close assignment</button>}
        </div>
      </div>

      <Card title="Assignment details" right={locked && <span className="flex items-center gap-1 text-xs text-gray-500"><Lock size={14} /> Locked</span>}>
        <fieldset disabled={locked || busy} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            <span className="block font-medium text-gray-700 mb-1">Title</span>
            <input className="w-full p-2.5 border rounded-lg" placeholder="e.g. Photosynthesis: explain in your own words" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="aia-asg-title" />
          </label>
          <label className="text-sm">
            <span className="block font-medium text-gray-700 mb-1">Class</span>
            <select className="w-full p-2.5 border rounded-lg bg-white" value={form.classroomId} onChange={(e) => setForm({ ...form, classroomId: e.target.value })} data-testid="aia-asg-class">
              <option value="">Select a class</option>
              {classrooms.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="block font-medium text-gray-700 mb-1">Total marks</span>
              <input className="w-full p-2.5 border rounded-lg" type="number" min="1" max="1000" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} data-testid="aia-asg-marks" />
            </label>
            <label className="text-sm">
              <span className="block font-medium text-gray-700 mb-1">Due (optional)</span>
              <input className="w-full p-2.5 border rounded-lg" type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} data-testid="aia-asg-due" />
            </label>
          </div>
          <label className="text-sm md:col-span-2">
            <span className="block font-medium text-gray-700 mb-1">Instructions for students</span>
            <textarea className="w-full p-2.5 border rounded-lg" rows={4} placeholder="What should students do? How should the PDF be structured?" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} data-testid="aia-asg-instructions" />
          </label>
          <p className="md:col-span-2 text-xs text-gray-500">Submissions are accepted until the due date or until you close the assignment, whichever comes first. Late submissions are not accepted.</p>
        </fieldset>
      </Card>

      <Card
        title="Questions"
        subtitle="Students answer these in their PDF. Question marks must add up to the total."
        right={(
          <div className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${total === maxMarks ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`} data-testid="aia-asg-tally">
            {total} / {maxMarks} marks {total === maxMarks ? <CheckCircle2 size={14} className="inline" /> : ""}
          </div>
        )}
      >
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <li key={q.key} className="flex gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50/60">
              <span className="w-8 h-8 shrink-0 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-sm">{i + 1}</span>
              <div className="flex-1 space-y-2">
                <textarea disabled={locked || busy} className="w-full p-2.5 border rounded-lg bg-white" rows={2} placeholder="Write the question or prompt" value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} data-testid="aia-asg-question" />
                <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                  Marks
                  <input disabled={locked || busy} type="number" min="1" max="1000" className="w-24 p-1.5 border rounded-lg bg-white" value={q.maxMarks} onChange={(e) => setQ(i, { maxMarks: e.target.value })} data-testid="aia-asg-question-marks" />
                </label>
              </div>
              {!locked && (
                <div className="flex flex-col gap-1">
                  <button disabled={busy || i === 0} title="Move up" onClick={() => move(i, -1)} className="p-1.5 rounded hover:bg-white disabled:opacity-30"><ArrowUp size={16} /></button>
                  <button disabled={busy || i === questions.length - 1} title="Move down" onClick={() => move(i, 1)} className="p-1.5 rounded hover:bg-white disabled:opacity-30"><ArrowDown size={16} /></button>
                  <button disabled={busy || questions.length === 1} title="Remove" onClick={() => setQuestions((qs) => qs.filter((_, k) => k !== i))} className="p-1.5 rounded text-red-500 hover:bg-white disabled:opacity-30"><Trash2 size={16} /></button>
                </div>
              )}
            </li>
          ))}
        </ol>
        {!locked && (
          <button disabled={busy} onClick={() => setQuestions((qs) => [...qs, newQuestion()])} className="mt-4 flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg text-sm text-gray-700 hover:bg-gray-50" data-testid="aia-asg-add-question">
            <Plus size={16} /> Add question
          </button>
        )}
      </Card>
    </div>
  );
}
