import { CircleDot, Hash, ListChecks } from "lucide-react";
import { LETTERS, NUMERIC_FORMATS, QUESTION_TYPES, withType } from "./questionForm";

/*
 * AI Assessment Agent - one question's editor for all three types, used by the AI review
 * screen and the manual "Add a question" form. Controlled: `value` is the editable state from
 * questionForm.js; `onChange` receives the next state.
 */

const TYPE_ICON = { single_mcq: CircleDot, multi_select: ListChecks, numerical: Hash };

export function TypePicker({ value, onChange, available, size = "md", testId }) {
  return (
    <div className="inline-flex flex-wrap gap-2" role="radiogroup" aria-label="Question type" data-testid={testId}>
      {QUESTION_TYPES.map((t) => {
        const Icon = TYPE_ICON[t.id];
        const enabled = !available || available.includes(t.id);
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={!enabled}
            title={enabled ? t.hint : "Not available yet (a database update is pending)"}
            onClick={() => onChange(t.id)}
            data-type={t.id}
            className={`flex items-center gap-2 rounded-lg border text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${size === "lg" ? "px-4 py-3" : "px-3 py-1.5 text-sm"} ${active ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "border-gray-200 text-gray-700 hover:border-gray-400"}`}
          >
            <Icon size={size === "lg" ? 20 : 16} className="shrink-0" />
            <span>
              <span className="block font-semibold leading-tight">{t.label}</span>
              {size === "lg" && <span className="block text-xs text-gray-500 font-normal">{t.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function QuestionEditor({ value: q, onChange, idPrefix, availableTypes, allowTypeChange = true, explanationPlaceholder = "Explanation (teachers only; students never see it)" }) {
  const set = (patch) => onChange({ ...q, ...patch });
  const setOption = (j, text) => set({ options: q.options.map((o, k) => (k === j ? text : o)) });
  const toggleCorrect = (j) => {
    if (q.type === "single_mcq") return set({ correct: [j] });
    return set({ correct: q.correct.includes(j) ? q.correct.filter((k) => k !== j) : [...q.correct, j].sort() });
  };

  return (
    <div className="space-y-3">
      {allowTypeChange && (
        <TypePicker value={q.type} onChange={(type) => onChange(withType(q, type))} available={availableTypes} testId={`${idPrefix}-type`} />
      )}
      <textarea className="w-full p-2 border rounded" placeholder="Question text" value={q.text} onChange={(e) => set({ text: e.target.value })} />

      {q.type === "numerical" ? (
        <div className="grid gap-3 sm:grid-cols-[auto_1fr] items-end p-3 rounded-lg bg-gray-50 border">
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Answer format</span>
            <select className="p-2 border rounded bg-white" value={q.numericFormat} onChange={(e) => set({ numericFormat: e.target.value })} data-testid={`${idPrefix}-format`}>
              {NUMERIC_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Correct answer (exact)</span>
            <input
              className="w-full p-2 border rounded border-green-500 bg-white font-mono"
              inputMode="decimal"
              placeholder={q.numericFormat === "integer" ? "e.g. 42" : "e.g. 12.5"}
              value={q.numericValue}
              onChange={(e) => set({ numericValue: e.target.value })}
              data-testid={`${idPrefix}-answer`}
            />
          </label>
          <p className="sm:col-span-2 text-xs text-gray-500">
            Plain digits only (a leading minus and a decimal point are allowed; no units or commas). Students must enter exactly this value; 2.50 and 2.5 count as the same number.
            {q.numericFormat === "integer" ? " Whole-number questions do not accept decimals." : ""}
          </p>
        </div>
      ) : (
        <>
          {q.options.map((opt, j) => {
            const isRight = q.correct.includes(j);
            return (
              <label key={j} className="flex items-center gap-3">
                <input
                  type={q.type === "multi_select" ? "checkbox" : "radio"}
                  name={`${idPrefix}-correct`}
                  checked={isRight}
                  onChange={() => toggleCorrect(j)}
                  title="Correct answer"
                />
                <span className={`w-5 text-sm font-semibold ${isRight ? "text-green-700" : ""}`}>{LETTERS[j]}</span>
                <input className={`flex-1 p-2 border rounded ${isRight ? "border-green-500" : ""}`} placeholder={`Option ${LETTERS[j]}`} value={opt} onChange={(e) => setOption(j, e.target.value)} />
              </label>
            );
          })}
          <p className="text-xs text-gray-500">
            {q.type === "multi_select"
              ? `Tick every correct answer (at least two). Students get the mark only if they select exactly these.${q.correct.length < 2 ? ` ${q.correct.length} ticked so far.` : ""}`
              : "Select the one correct answer."}
          </p>
        </>
      )}

      <textarea className="w-full p-2 border rounded text-sm" placeholder={explanationPlaceholder} value={q.explanation} onChange={(e) => set({ explanation: e.target.value })} />
    </div>
  );
}
