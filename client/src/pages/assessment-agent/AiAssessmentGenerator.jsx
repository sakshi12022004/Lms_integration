import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  ArrowLeft, BarChart3, Brain, Calculator, Compass, GraduationCap, Layers, Lightbulb, Loader2, PenLine, Plus, RefreshCw, Sparkles, Timer, Trash2, Trophy,
} from "lucide-react";
import QuestionEditor, { TypePicker } from "./QuestionEditor";
import AssignToModal, { publishBody } from "./AssignToModal";
import { TYPE_LABEL, blankQuestion, toBody, toEditable } from "./questionForm";

/*
 * AI Assessment Agent - "Generate with AI" + teacher review.
 * The server generates a PROPOSAL only (POST /teacher/assessments/generate) and
 * stores nothing. Proposed questions live in this component's state until the
 * teacher explicitly saves them (POST /teacher/assessments/from-review), which
 * creates a normal DRAFT. Publishing stays a separate, explicit action.
 *
 * Advanced generation: the teacher picks the question type (single MCQ, multiple select,
 * numerical), optionally an educational intent template (server-owned guidance; only its id
 * is sent), and optional instructions that refine it.
 */

const DIFFICULTIES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["mixed", "Mixed (easier to harder)"]];
const EMPTY_FORM = { topic: "", subject: "", classroomId: "", count: 5, difficulty: "medium", instructions: "", questionType: "single_mcq", numericFormat: "", template: null };
const TEMPLATE_ICON = {
  board_exam_practice: GraduationCap,
  concept_mastery: Lightbulb,
  fundamentals_first: Layers,
  application_reasoning: Compass,
  higher_order_thinking: Brain,
  competitive_exam_practice: Trophy,
  numerical_practice: Calculator,
  mixed_difficulty: BarChart3,
  revision_quick_test: Timer,
  teacher_custom: PenLine,
};

/** AI errors carry safe server messages; the quality-check detail codes are not useful to a teacher. */
function aiErrorText(err, errorText) {
  const e = err?.response?.data?.error;
  if (e && typeof e.code === "string" && (e.code.startsWith("AI_") || e.code.startsWith("GENERATION_") || e.code === "QUESTION_TYPES_NOT_READY")) return e.message;
  return errorText(err);
}

function Step({ n, title, hint, children }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">{n}</span>
          {title}
        </h3>
        {hint && <p className="text-sm text-gray-500 ml-8">{hint}</p>}
      </div>
      <div className="ml-8">{children}</div>
    </div>
  );
}

export default function AiAssessmentGenerator({ base, auth, classrooms, classLabel, errorText, onCancel, onSaved, prefill = null }) {
  // prefill: from the AI Performance Report's suggested next assessment (form values only; no AI call).
  const [form, setForm] = useState(() => (prefill ? {
    ...EMPTY_FORM,
    topic: prefill.topic || "", subject: prefill.subject || "", classroomId: prefill.classroomId || "",
    count: prefill.count || EMPTY_FORM.count, difficulty: prefill.difficulty || EMPTY_FORM.difficulty, questionType: prefill.questionType || EMPTY_FORM.questionType,
  } : EMPTY_FORM));
  const [assigning, setAssigning] = useState(false);
  const [assignClass, setAssignClass] = useState(null); // open "Assign to" popup (class object)
  // A suggested next assessment is pre-selected for the student it was suggested for (a default only).
  const suggestedStudent = prefill && prefill.student && Number.isInteger(prefill.student.id) ? prefill.student : null;
  const [questions, setQuestions] = useState(null); // null = not generated yet
  const [details, setDetails] = useState({ title: "", description: "", durationMinutes: "" });
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(null); // index being regenerated
  const [saving, setSaving] = useState(false);
  const [aiError, setAiError] = useState(null); // safe server message; shown with a Try again button
  const [elapsed, setElapsed] = useState(0); // seconds while generating (display only)
  const [catalog, setCatalog] = useState({ templates: [], questionTypesAvailable: ["single_mcq"] });
  const busy = generating || saving || assigning || regenerating !== null;
  // Synchronous lock: two clicks in the same tick (before React re-renders) still send ONE request.
  const inFlight = useRef(false);
  const locked = async (fn) => {
    if (inFlight.current || busy) return;
    inFlight.current = true;
    try { await fn(); } finally { inFlight.current = false; }
  };

  // Template list + which question types the server can save (read-only; no LLM call).
  useEffect(() => {
    axios.get(`${base}/ai/templates`, auth)
      .then((res) => setCatalog({ templates: res.data.templates, questionTypesAvailable: res.data.questionTypesAvailable }))
      .catch(() => setCatalog({ templates: [], questionTypesAvailable: ["single_mcq"] }));
  }, [base, auth]);

  useEffect(() => {
    if (!generating) return undefined;
    setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [generating]);

  const selectedTemplate = catalog.templates.find((t) => t.id === form.template) || null;
  const chooseTemplate = (id) => setForm((f) => {
    const template = f.template === id ? null : id; // clicking the selected template clears it
    return { ...f, template, difficulty: template === "mixed_difficulty" ? "mixed" : f.difficulty === "mixed" && template !== "mixed_difficulty" ? "medium" : f.difficulty };
  });

  const request = (count, avoidQuestions, type = form.questionType) => ({
    topic: form.topic,
    subject: form.subject,
    classroomId: form.classroomId === "" ? null : Number(form.classroomId),
    count,
    difficulty: form.difficulty,
    instructions: form.instructions,
    questionType: type,
    ...(type === "numerical" && form.numericFormat ? { numericFormat: form.numericFormat } : {}),
    ...(form.template ? { template: form.template } : {}),
    ...(avoidQuestions && avoidQuestions.length ? { avoidQuestions } : {}),
  });

  const generate = () => locked(async () => { // explicit click only; one request per click
    setGenerating(true);
    setAiError(null);
    try {
      const res = await axios.post(`${base}/assessments/generate`, request(Number(form.count)), auth);
      setQuestions(res.data.proposal.questions.map(toEditable));
      setDetails((d) => ({ ...d, title: d.title || form.topic }));
      toast.success("Questions generated. Review them before saving.");
    } catch (err) {
      setAiError(aiErrorText(err, errorText)); // safe message from the server; never raw provider details
    } finally {
      setGenerating(false);
    }
  });

  const regenerate = (index) => locked(async () => {
    setRegenerating(index);
    try {
      const others = questions.filter((_, i) => i !== index).map((q) => q.text.trim()).filter(Boolean).slice(0, 50);
      const res = await axios.post(`${base}/assessments/generate`, request(1, others, questions[index].type), auth);
      const [replacement] = res.data.proposal.questions.map(toEditable);
      setQuestions((qs) => qs.map((q, i) => (i === index ? replacement : q)));
    } catch (err) {
      toast.error(aiErrorText(err, errorText));
    } finally {
      setRegenerating(null);
    }
  });

  const replaceAt = (index, next) => setQuestions((qs) => qs.map((q, i) => (i === index ? next : q)));
  const remove = (index) => setQuestions((qs) => qs.filter((_, i) => i !== index));

  /** "Save & assign": opens the "Assign to" popup. Nothing is saved until the teacher confirms recipients there. */
  const saveAndAssign = () => {
    if (busy) return;
    if (!questions.length) { toast.error("Add at least one question before assigning."); return; }
    const cls = classrooms.find((c) => String(c.id) === String(form.classroomId));
    if (!cls) { toast.error("Choose the class to assign this test to (in the form above)."); return; }
    setAssignClass(cls);
  };

  /** Confirmed in the popup: save the reviewed questions + publish to exactly the chosen students. */
  const confirmAssign = (ids, wholeClass) => locked(async () => {
    const cls = assignClass;
    setAssigning(true);
    let draft = null;
    try {
      draft = (await axios.post(`${base}/assessments/from-review`, {
        assessment: {
          title: details.title, subject: form.subject, description: details.description,
          classroomId: Number(form.classroomId),
          durationMinutes: details.durationMinutes === "" ? null : Number(details.durationMinutes),
        },
        questions: questions.map(toBody),
      }, auth)).data.assessment;
      const published = (await axios.post(`${base}/assessments/${draft.id}/publish`, publishBody(ids, wholeClass), auth)).data.assessment;
      toast.success(wholeClass ? `Assigned to ${classLabel(cls)}.` : `Assigned to ${ids.length} student${ids.length === 1 ? "" : "s"} in ${classLabel(cls)}.`);
      setAssignClass(null);
      onSaved(published);
    } catch (err) {
      setAssignClass(null);
      if (draft) { toast.error(`Saved as a draft, but it could not be assigned: ${errorText(err)}`); onSaved(draft); }
      else toast.error(errorText(err));
    } finally {
      setAssigning(false);
    }
  });

  const save = () => locked(async () => { // also prevents a double-click from creating two drafts
    if (!questions.length) { toast.error("Add at least one question before saving."); return; }
    setSaving(true);
    try {
      const res = await axios.post(`${base}/assessments/from-review`, {
        assessment: {
          title: details.title,
          subject: form.subject,
          description: details.description,
          classroomId: form.classroomId === "" ? null : Number(form.classroomId),
          durationMinutes: details.durationMinutes === "" ? null : Number(details.durationMinutes),
        },
        questions: questions.map(toBody),
      }, auth);
      toast.success("Saved as a draft. Check it and publish when ready.");
      onSaved(res.data.assessment);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  });

  const discard = () => {
    if (!questions || window.confirm("Discard the generated questions? Nothing has been saved.")) onCancel();
  };

  const customNeedsText = form.template === "teacher_custom" && !form.instructions.trim();

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <button onClick={discard} disabled={busy} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={16} /> All tests
      </button>

      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><Sparkles size={20} /> Generate with AI</h2>
        {prefill && (
          <div className="mb-3 p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-sm text-indigo-900" data-testid="aia-gen-prefill">
            Pre-filled from the {prefill.source || "AI Performance Report"}'s suggested next assessment. Check the details, then click "Generate Questions".
            {suggestedStudent && <span className="block mt-1">Suggested for: <span className="font-semibold">{suggestedStudent.name}</span> (pre-selected when you assign it; you can add other students or the whole class).</span>}
          </div>
        )}
        <p className="text-sm text-gray-500 mb-6">The AI suggests questions. Nothing is saved until you review them and click "Save as draft".</p>
        <fieldset disabled={busy} className="space-y-7">
          <Step n={1} title="What to assess">
            <div className="grid gap-3 md:grid-cols-2">
              <input className="p-2 border rounded" placeholder="Topic (e.g. Photosynthesis)" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
              <input className="p-2 border rounded" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              <select className="p-2 border rounded" value={form.classroomId} onChange={(e) => setForm({ ...form, classroomId: e.target.value })}>
                <option value="">Class (optional; required to publish)</option>
                {classrooms.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
              </select>
              <div className="flex gap-3">
                <label className="flex-1 text-sm">
                  <span className="block text-gray-600 mb-1">Number of questions</span>
                  <input className="w-full p-2 border rounded" type="number" min="1" max="20" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} />
                </label>
                <label className="flex-1 text-sm">
                  <span className="block text-gray-600 mb-1">Difficulty</span>
                  <select className="w-full p-2 border rounded" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} data-testid="aia-gen-difficulty">
                    {DIFFICULTIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </Step>

          <Step n={2} title="Question type" hint="How students will answer.">
            <TypePicker size="lg" value={form.questionType} onChange={(questionType) => setForm({ ...form, questionType })} available={catalog.questionTypesAvailable} testId="aia-gen-type" />
            {form.questionType === "numerical" && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" data-testid="aia-gen-numeric-format">
                <span className="text-gray-600">Answers should be:</span>
                {[["", "Whole numbers or decimals"], ["integer", "Whole numbers only"], ["decimal", "Decimals"]].map(([id, label]) => (
                  <button key={id || "any"} type="button" onClick={() => setForm({ ...form, numericFormat: id })}
                    className={`px-3 py-1 rounded-full border ${form.numericFormat === id ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </Step>

          <Step n={3} title="Educational intent (optional)" hint="The kind of learning outcome you want. It guides the style of the questions; it is practice, not a prediction of any exam.">
            {catalog.templates.length === 0 ? (
              <p className="text-sm text-gray-500">Templates are not available right now. You can still describe what you want below.</p>
            ) : (
              <>
                <div className="grid gap-2 grid-cols-2 md:grid-cols-5" role="radiogroup" aria-label="Educational intent" data-testid="aia-gen-templates">
                  {catalog.templates.map((t) => {
                    const Icon = TEMPLATE_ICON[t.id] || Sparkles;
                    const active = form.template === t.id;
                    return (
                      <button key={t.id} type="button" role="radio" aria-checked={active} onClick={() => chooseTemplate(t.id)} data-template={t.id}
                        className={`flex flex-col items-start gap-2 p-3 rounded-lg border text-left text-sm transition-colors ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-gray-200 hover:border-gray-400"}`}>
                        <Icon size={18} className={active ? "text-primary" : "text-gray-500"} />
                        <span className={`font-semibold leading-tight ${active ? "text-primary" : "text-gray-800"}`}>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-sm text-gray-600 min-h-[1.25rem]" data-testid="aia-gen-template-description">
                  {selectedTemplate ? <><span className="font-medium text-gray-800">{selectedTemplate.label}:</span> {selectedTemplate.description} <span className="text-gray-400">(click again to clear)</span></> : "No template selected: the AI follows your topic and instructions only."}
                </p>
              </>
            )}
          </Step>

          <Step n={4} title={form.template === "teacher_custom" ? "Your instructions (required for Teacher Custom)" : "Additional instructions (optional)"}
            hint="How you want the questions customised: focus areas, contexts, examples or style. They refine the intent above; they cannot change the question type, the number of questions or the answer format.">
            <textarea className="w-full p-2 border rounded" rows={3} maxLength={500} placeholder="e.g. Focus on Newton's laws and use real-world examples." value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })} data-testid="aia-gen-instructions" />
            <div className="text-xs text-gray-400 text-right">{form.instructions.length}/500</div>
          </Step>

          <div className="flex flex-wrap items-center gap-3 border-t pt-5">
            <button onClick={generate} disabled={customNeedsText} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold disabled:opacity-60">
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {generating ? "Generating..." : questions ? "Generate again" : "Generate Questions"}
            </button>
            <span className="text-sm text-gray-500">{TYPE_LABEL[form.questionType]}{selectedTemplate ? ` · ${selectedTemplate.label}` : ""} · {form.count} question{Number(form.count) === 1 ? "" : "s"}</span>
            {generating && <span className="text-sm text-gray-500" data-testid="aia-generating">Generating questions with AI... {elapsed}s (this can take up to a minute)</span>}
            {questions && !generating && <span className="text-sm text-amber-700">Generating again replaces the questions below.</span>}
          </div>
        </fieldset>
        {aiError && !generating && (
          <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-sm" data-testid="aia-ai-error" role="alert">
            <p className="text-red-700 font-medium">{aiError}</p>
            <p className="text-gray-600 mt-1">Your inputs are kept. You can try again, or go back and create the test manually.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={generate} className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-semibold">Try again</button>
              <button onClick={onCancel} className="px-3 py-2 border rounded-lg text-sm">Create manually instead</button>
            </div>
          </div>
        )}
      </section>

      {questions && (
        <>
          <section className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Review questions ({questions.length})</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">Not saved</span>
            </div>
            <ol className="space-y-4">
              {questions.map((q, i) => (
                <li key={i} className="border rounded-lg p-4 space-y-3" data-testid="aia-review-question" data-type={q.type}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold flex items-center gap-2">
                      Question {i + 1}
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{TYPE_LABEL[q.type]}</span>
                      {q.difficulty && <span className="text-xs font-normal text-gray-500">{q.difficulty}</span>}
                    </span>
                    <div className="flex gap-3">
                      <button disabled={busy} title="Regenerate this question" onClick={() => regenerate(i)} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50">
                        <RefreshCw size={14} className={regenerating === i ? "animate-spin" : ""} /> Regenerate
                      </button>
                      <button disabled={busy} title="Remove" onClick={() => remove(i)} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 disabled:opacity-50">
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>
                  <fieldset disabled={busy}>
                    <QuestionEditor value={q} onChange={(next) => replaceAt(i, next)} idPrefix={`aia-review-${i}`} availableTypes={catalog.questionTypesAvailable} allowTypeChange={false} />
                  </fieldset>
                </li>
              ))}
            </ol>
            <button disabled={busy} onClick={() => setQuestions((qs) => [...qs, blankQuestion(form.questionType)])} className="mt-4 flex items-center gap-2 px-3 py-2 border rounded-lg text-sm">
              <Plus size={16} /> Add a question manually
            </button>
          </section>

          <section className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-bold mb-4">Save as a draft test</h3>
            <fieldset disabled={busy} className="grid gap-3 md:grid-cols-2">
              <input className="p-2 border rounded" placeholder="Title" value={details.title} onChange={(e) => setDetails({ ...details, title: e.target.value })} />
              <input className="p-2 border rounded" type="number" min="1" max="600" placeholder="Duration in minutes (optional)" value={details.durationMinutes} onChange={(e) => setDetails({ ...details, durationMinutes: e.target.value })} />
              <textarea className="p-2 border rounded md:col-span-2" placeholder="Description (optional)" value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} />
              <p className="md:col-span-2 text-xs text-gray-500">Subject and class are taken from the form above. "Save as draft" keeps it private; "Save & assign" lets you choose who in the class receives it, then publishes it.</p>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button onClick={save} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold disabled:opacity-60">
                  {saving && <Loader2 size={18} className="animate-spin" />} Save as draft
                </button>
                <button onClick={saveAndAssign} disabled={assigning} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold disabled:opacity-60" data-testid="aia-gen-save-assign">
                  {assigning && <Loader2 size={18} className="animate-spin" />} Save & assign…
                </button>
                <button onClick={discard} className="px-4 py-2 border rounded-lg">Discard</button>
              </div>
            </fieldset>
          </section>
        </>
      )}
      {assignClass && (
        <AssignToModal base={base} auth={auth} classroom={assignClass} classLabel={classLabel} testTitle={details.title || form.topic}
          suggested={suggestedStudent} busy={assigning} onCancel={() => setAssignClass(null)} onConfirm={confirmAssign} />
      )}
    </div>
  );
}
