import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { ArrowLeft, CheckCircle, FileText, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import MentorLayout from "../../components/MentorLayout";
import { useAuth } from "../../auth/auth";
import AiAssessmentGenerator from "./AiAssessmentGenerator";
import AssessmentReport from "./AssessmentReport";
import AssignToModal, { publishBody, recipientsText } from "./AssignToModal";
import QuestionEditor from "./QuestionEditor";
import { LETTERS, TYPE_LABEL, answerKeyText, blankQuestion, toBody, toEditable } from "./questionForm";

/*
 * AI Assessment Agent - teacher page (Step 1: manual MCQ tests; Step 2: "Generate with AI").
 * Backend: /api/assessment-agent (ai-modules/ai-assessment-agent). The server
 * owns school, owner, status and every rule; this page only sends what the
 * teacher typed and shows the server's answer. Remove this file and its route
 * in App.jsx to remove the UI.
 */

const EMPTY_DETAILS = { title: "", subject: "", description: "", classroomId: "", durationMinutes: "", opensAt: "", closesAt: "" };

/* Step 5: <input type="datetime-local"> works in the teacher's local time; the server stores UTC ISO. */
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toIso = (local) => (local ? new Date(local).toISOString() : null);
const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString() : "");
const EMPTY_QUESTION = blankQuestion();

const CODE_TEXT = {
  REQUIRED: "is required",
  TOO_LONG: "is too long",
  INVALID_ID: "is not valid",
  OUT_OF_RANGE: "must be between 1 and 600 minutes",
  CLASSROOM_NOT_FOUND: "is not a class in your school",
  NO_CORRECT_OPTION: "need a correct answer",
  MULTIPLE_CORRECT_OPTIONS: "need exactly one correct answer",
  TOO_FEW_CORRECT_OPTIONS: "need at least two correct answers for a multiple-select question",
  NOT_ALLOWED_FOR_TYPE: "is not used for this question type",
  INVALID_NUMBER: "must be a plain number (e.g. 42 or -3.5)",
  NOT_AN_INTEGER: "must be a whole number",
  TOO_MANY_DECIMALS: "can have at most 6 decimal places",
  TOO_MANY_DIGITS: "is too long",
  INVALID_NUMBER_FORMAT: "must be whole number or decimal",
  INVALID_QUESTION_TYPE: "is not a supported question type",
  UNSAFE_INSTRUCTIONS: "contain wording that tries to change how the AI works; please rephrase them",
  INVALID_TEMPLATE: "is not a known template",
  DUPLICATE_OPTIONS: "must all be different",
  WRONG_OPTION_COUNT: "must be exactly 4",
  NO_QUESTIONS: "add at least one question",
  INVALID_QUESTION: "is not valid",
  INVALID_DIFFICULTY: "must be easy, medium or hard",
  TOO_MANY_QUESTIONS: "has too many questions",
  MUST_BE_TEXT: "must be text",
  INVALID_DATETIME: "is not a valid date and time",
  CLOSES_BEFORE_OPENS: "must be after the opening time",
  CLOSES_IN_PAST: "is already in the past",
  NOT_IN_CLASS: "includes a student who is not in this class",
  SELECT_AT_LEAST_ONE: "needs at least one student",
  DUPLICATE: "lists a student twice",
};

/** Turns the server's { error: { message, details } } into one readable line. */
function errorText(err) {
  const e = err?.response?.data?.error;
  if (!e) return "Could not reach the server.";
  const parts = (e.details || []).map((d) => `${d.field || "request"} ${CODE_TEXT[d.code] || d.code}`);
  return parts.length ? `${e.message} ${parts.join("; ")}.` : e.message;
}

function classLabel(c) {
  return c ? `${c.name} (Grade ${c.grade}${c.section ? ` ${c.section}` : ""})` : "No class selected";
}

export default function TeacherAssessments() {
  const { token, API } = useAuth();
  const base = `${API}/assessment-agent/teacher`;
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [list, setList] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [current, setCurrent] = useState(null); // open assessment (detail)
  const [creating, setCreating] = useState(false); // "New test" form before the draft exists
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [question, setQuestion] = useState(EMPTY_QUESTION);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [aiMode, setAiMode] = useState(false); // Step 2: generate + review screen
  const [aiPrefill, setAiPrefill] = useState(null); // from the AI Performance Report's "Generate this assessment"
  const location = useLocation();
  const navigate = useNavigate();
  // Opening the pre-filled generator is NOT an AI call; generation still needs the "Generate Questions" click.
  // The navigation state is cleared at once, so a refresh or "back" never reopens it.
  useEffect(() => {
    const prefill = location.state?.aiPrefill;
    if (!prefill) return;
    setAiPrefill(prefill);
    setAiMode(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);
  const [showReport, setShowReport] = useState(false); // Step 3: results report
  const [assignOpen, setAssignOpen] = useState(false); // "Assign to" popup before publishing
  const [ai, setAi] = useState({ available: false, reason: null });
  const [typesAvailable, setTypesAvailable] = useState(["single_mcq"]); // which question types the server can store

  // Read-only (no LLM): which question types can be saved (multiple-select/numerical need migration 006).
  useEffect(() => {
    axios.get(`${base}/ai/templates`, auth)
      .then((res) => setTypesAvailable(res.data.questionTypesAvailable))
      .catch(() => setTypesAvailable(["single_mcq"]));
  }, [base, auth]);

  // AI availability is separate from the list: if it fails, manual creation still works.
  useEffect(() => {
    axios.get(`${base}/ai/status`, auth)
      .then((res) => setAi(res.data.ai))
      .catch(() => setAi({ available: false, reason: "AI_UNAVAILABLE" }));
  }, [base, auth]);

  const loadList = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([axios.get(`${base}/assessments`, auth), axios.get(`${base}/classrooms`, auth)]);
      setList(a.data.assessments);
      setClassrooms(c.data.classrooms);
    } catch (err) {
      toast.error(errorText(err));
    }
  }, [base, auth]);

  useEffect(() => { loadList(); }, [loadList]);

  const open = (assessment) => {
    if (!current || current.id !== assessment.id) setShowReport(false);
    setCurrent(assessment);
    setCreating(false);
    setAiMode(false);
    setDetails({
      title: assessment.title,
      subject: assessment.subject,
      description: assessment.description || "",
      classroomId: assessment.classroomId ?? "",
      durationMinutes: assessment.durationMinutes ?? "",
      opensAt: toLocalInput(assessment.opensAt),
      closesAt: toLocalInput(assessment.closesAt),
    });
    setQuestion(EMPTY_QUESTION);
    setEditingQuestionId(null);
  };

  const runLock = useRef(false); // synchronous lock: a double-click must not create two drafts
  const run = async (action, success) => {
    if (runLock.current) return null;
    runLock.current = true;
    setBusy(true);
    try {
      const res = await action();
      if (res?.data?.assessment) open(res.data.assessment);
      if (success) toast.success(success);
      return res;
    } catch (err) {
      toast.error(errorText(err));
      return null;
    } finally {
      runLock.current = false;
      setBusy(false);
    }
  };

  const detailsBody = () => ({
    title: details.title,
    subject: details.subject,
    description: details.description,
    classroomId: details.classroomId === "" ? null : Number(details.classroomId),
    durationMinutes: details.durationMinutes === "" ? null : Number(details.durationMinutes),
    opensAt: toIso(details.opensAt),
    closesAt: toIso(details.closesAt),
  });

  const saveDetails = () =>
    current
      ? run(() => axios.patch(`${base}/assessments/${current.id}`, detailsBody(), auth), "Details saved")
      : run(() => axios.post(`${base}/assessments`, detailsBody(), auth), "Draft created");

  const questionBody = () => toBody(question);

  const saveQuestion = async () => {
    const url = `${base}/assessments/${current.id}/questions`;
    const res = editingQuestionId
      // No success toast: the updated question list is the feedback (stacked toasts covered "Publish").
      ? await run(() => axios.put(`${url}/${editingQuestionId}`, questionBody(), auth))
      : await run(() => axios.post(url, questionBody(), auth));
    if (res) { setQuestion(EMPTY_QUESTION); setEditingQuestionId(null); }
  };

  const editQuestion = (q) => {
    setEditingQuestionId(q.id);
    setQuestion(toEditable(q));
  };

  const deleteQuestion = (q) => {
    if (window.confirm(`Delete question ${q.position}?`)) {
      run(() => axios.delete(`${base}/assessments/${current.id}/questions/${q.id}`, auth), "Question deleted");
    }
  };

  const publishClass = current ? classrooms.find((c) => String(c.id) === String(current.classroomId)) : null;
  const setStatus = (action) => {
    if (action === "publish") {
      // Choose the recipients first ("Assign to" popup); the server still checks class + questions.
      if (!publishClass) { toast.error("Choose the class for this test (and save the details) before publishing."); return; }
      setAssignOpen(true);
      return;
    }
    run(() => axios.post(`${base}/assessments/${current.id}/${action}`, undefined, auth), "Moved back to draft");
  };
  const confirmPublish = async (ids, wholeClass) => {
    const res = await run(() => axios.post(`${base}/assessments/${current.id}/publish`, publishBody(ids, wholeClass), auth),
      wholeClass ? "Published to the whole class" : `Published to ${ids.length} student${ids.length === 1 ? "" : "s"}`);
    if (res) setAssignOpen(false);
  };

  const back = () => { setCurrent(null); setCreating(false); setAiMode(false); setDetails(EMPTY_DETAILS); loadList(); };
  const startNew = () => { setCurrent(null); setDetails(EMPTY_DETAILS); setCreating(true); };
  const locked = current?.status === "published";
  const closed = !!current?.closedAt || (!!current?.closesAt && Date.parse(current.closesAt) <= Date.now()); // display only; the server decides

  const closeTest = () => {
    if (!window.confirm(`Close "${current.title}" now? Students can no longer start it, and any test in progress is submitted automatically with the answers saved so far. This cannot be undone.`)) return;
    run(() => axios.post(`${base}/assessments/${current.id}/close`, undefined, auth), "Test closed");
  };

  /* ---------- AI generate + review (Step 2) ---------- */
  if (aiMode) {
    return (
      <MentorLayout>
        <AiAssessmentGenerator
          base={base}
          auth={auth}
          classrooms={classrooms}
          classLabel={classLabel}
          errorText={errorText}
          prefill={aiPrefill}
          onCancel={() => { setAiPrefill(null); back(); }}
          onSaved={(assessment) => { setAiPrefill(null); open(assessment); loadList(); }}
        />
      </MentorLayout>
    );
  }

  /* ---------- list view ---------- */
  if (!current && !creating) {
    return (
      <MentorLayout>
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">AI Assessments</h1>
              <p className="text-sm text-gray-500">Create tests with single-answer, multiple-select and numerical questions, by hand or with AI suggestions you review first.</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Descriptive Assignments entry (remove with the feature) */}
              <Link to="/teacher/assessments/assignments" className="flex items-center gap-2 px-4 py-2 border rounded-lg font-semibold text-gray-700 hover:bg-gray-50" data-testid="aia-open-assignments">
                <FileText size={18} /> Descriptive Assignments
              </Link>
              <button
                onClick={() => setAiMode(true)}
                disabled={!ai.available}
                title={ai.available ? "Let AI suggest questions for you to review" : "AI generation is not available. You can still create tests manually."}
                className="flex items-center gap-2 px-4 py-2 border border-primary text-primary rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={18} /> Generate with AI
              </button>
              <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold">
                <Plus size={18} /> New test
              </button>
            </div>
          </div>
          {!ai.available && ai.reason && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm" data-testid="aia-ai-unavailable">
              AI question generation is not available right now. You can still create tests with "New test".
            </div>
          )}
          {list.length === 0 ? (
            <div className="p-8 bg-white rounded-xl shadow text-center text-gray-500">
              <p className="font-medium text-gray-700 mb-1">No tests yet</p>
              <p className="text-sm">Generate questions with AI or start a new test. Every test starts as a draft: review it, publish it for a class, then see results in its report.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow divide-y">
              {list.map((a) => (
                <button key={a.id} onClick={() => run(() => axios.get(`${base}/assessments/${a.id}`, auth))} className="w-full text-left p-4 hover:bg-gray-50 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">{a.title}</div>
                    <div className="text-sm text-gray-500">{a.subject} · {classLabel(a.classroom)}{a.status === "published" && a.recipients?.mode === "selected" ? ` · ${recipientsText(a.recipients)}` : ""} · {a.questionCount} question{a.questionCount === 1 ? "" : "s"}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${a.status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {a.status === "published" ? "Published" : "Draft"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </MentorLayout>
    );
  }

  /* ---------- create / edit view ---------- */
  return (
    <MentorLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <button onClick={back} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft size={16} /> All tests
        </button>

        <section className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{current ? current.title : "New test"}</h2>
            {current && (
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full ${locked ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{locked ? "Published" : "Draft"}</span>
                {locked && closed && <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700" data-testid="aia-closed-badge">Closed</span>}
                {locked && !current.closedAt && (
                  <button disabled={busy} onClick={closeTest} data-testid="aia-close-test" className="px-3 py-2 border border-red-300 text-red-600 rounded-lg text-sm">Close test</button>
                )}
                {locked && (
                  <button onClick={() => setShowReport((v) => !v)} data-testid="aia-toggle-report" className="px-3 py-2 border border-primary text-primary rounded-lg text-sm">
                    {showReport ? "Hide report" : "Report"}
                  </button>
                )}
                {locked ? (
                  <button disabled={busy} onClick={() => setStatus("unpublish")} className="px-3 py-2 border rounded-lg text-sm">Unpublish</button>
                ) : (
                  <button disabled={busy} onClick={() => setStatus("publish")} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm" data-testid="aia-publish">Publish…</button>
                )}
              </div>
            )}
          </div>
          {locked && (
            <p className="mb-4 text-sm text-amber-700 bg-amber-50 p-3 rounded">
              {current.closedAt
                ? `Closed on ${fmtWhen(current.closedAt)}. Students can no longer start it; see the report for results.`
                : current.recipients?.mode === "selected"
                  ? `Assigned to ${recipientsText(current.recipients)} of the class. Only they can see this test. Unpublish it to make changes.`
                  : "Students in the selected class can see this test. Unpublish it to make changes."}
              {!current.closedAt && (current.opensAt || current.closesAt) && (
                <span className="block mt-1">
                  {current.opensAt && `Opens ${fmtWhen(current.opensAt)}. `}
                  {current.closesAt && `Closes ${fmtWhen(current.closesAt)}.`}
                </span>
              )}
            </p>
          )}
          <fieldset disabled={locked || busy} className="grid gap-3 md:grid-cols-2">
            <input className="p-2 border rounded" placeholder="Title" value={details.title} onChange={(e) => setDetails({ ...details, title: e.target.value })} />
            <input className="p-2 border rounded" placeholder="Subject" value={details.subject} onChange={(e) => setDetails({ ...details, subject: e.target.value })} />
            <select className="p-2 border rounded" value={details.classroomId} onChange={(e) => setDetails({ ...details, classroomId: e.target.value })}>
              <option value="">Class (required to publish)</option>
              {classrooms.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
            </select>
            <input className="p-2 border rounded" type="number" min="1" max="600" placeholder="Duration in minutes (optional)" value={details.durationMinutes} onChange={(e) => setDetails({ ...details, durationMinutes: e.target.value })} />
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Opens at (optional)</span>
              <input className="w-full p-2 border rounded" type="datetime-local" value={details.opensAt} onChange={(e) => setDetails({ ...details, opensAt: e.target.value })} data-testid="aia-opens-at" />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Closes at (optional)</span>
              <input className="w-full p-2 border rounded" type="datetime-local" value={details.closesAt} onChange={(e) => setDetails({ ...details, closesAt: e.target.value })} data-testid="aia-closes-at" />
            </label>
            <p className="md:col-span-2 text-xs text-gray-500 -mt-1">Leave both empty to keep the test open until you close it. A running test ends at the closing time even if its duration is longer.</p>
            <textarea className="p-2 border rounded md:col-span-2" placeholder="Description (optional)" value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} />
            <div className="md:col-span-2">
              <button onClick={saveDetails} className="px-4 py-2 bg-primary text-white rounded-lg font-semibold">{current ? "Save details" : "Create draft"}</button>
            </div>
          </fieldset>
        </section>

        {current && locked && showReport && (
          <AssessmentReport base={base} auth={auth} assessmentId={current.id} errorText={errorText} />
        )}

        {current && (
          <section className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-bold mb-4">Questions ({current.questions.length})</h3>
            <ol className="space-y-4 mb-6">
              {current.questions.map((q) => (
                <li key={q.id} className="border rounded-lg p-4" data-testid="aia-question-row" data-type={q.type}>
                  <div className="flex justify-between gap-4">
                    <div className="font-medium">
                      {q.position}. {q.text}
                      <span className="ml-2 align-middle text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{TYPE_LABEL[q.type] || "Single MCQ"}</span>
                    </div>
                    {!locked && (
                      <div className="flex gap-2 shrink-0">
                        <button title="Edit" onClick={() => editQuestion(q)} className="text-gray-500 hover:text-gray-900"><Pencil size={16} /></button>
                        <button title="Delete" onClick={() => deleteQuestion(q)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>
                  {q.type === "numerical" ? (
                    <p className="mt-2 text-sm text-green-700 font-semibold flex items-center gap-2"><CheckCircle size={14} /> {answerKeyText(q)}</p>
                  ) : (
                    <ul className="mt-2 grid gap-1 md:grid-cols-2 text-sm">
                      {q.options.map((o) => (
                        <li key={o.position} className={`flex items-center gap-2 ${o.isCorrect ? "text-green-700 font-semibold" : "text-gray-700"}`}>
                          {LETTERS[o.position]}. {o.text} {o.isCorrect && <CheckCircle size={14} />}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.explanation && <p className="mt-2 text-xs text-gray-500">Explanation (teachers only): {q.explanation}</p>}
                </li>
              ))}
            </ol>

            {!locked && (
              <fieldset disabled={busy} className="border-t pt-4 space-y-3">
                <h4 className="font-semibold">{editingQuestionId ? "Edit question" : "Add a question"}</h4>
                <QuestionEditor value={question} onChange={setQuestion} idPrefix="aia-manual" availableTypes={typesAvailable} explanationPlaceholder="Explanation (optional; teachers only)" />
                <div className="flex gap-2">
                  <button onClick={saveQuestion} className="px-4 py-2 bg-primary text-white rounded-lg font-semibold">{editingQuestionId ? "Save question" : "Add question"}</button>
                  {editingQuestionId && <button onClick={() => { setEditingQuestionId(null); setQuestion(EMPTY_QUESTION); }} className="px-4 py-2 border rounded-lg">Cancel</button>}
                </div>
              </fieldset>
            )}
          </section>
        )}
      </div>
      {assignOpen && current && publishClass && (
        <AssignToModal base={base} auth={auth} classroom={publishClass} classLabel={classLabel} testTitle={current.title}
          busy={busy} onCancel={() => setAssignOpen(false)} onConfirm={confirmPublish} />
      )}
    </MentorLayout>
  );
}
