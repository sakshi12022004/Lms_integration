import axios from "axios";

/*
 * AI Assessment Agent - Descriptive Assignments: small shared UI helpers (badges, dates, sizes,
 * safe download). Used only by the assignment pages.
 */

export const ASSIGNMENT_STATUS = {
  draft: ["Draft", "bg-gray-100 text-gray-600"],
  published: ["Published", "bg-green-100 text-green-700"],
  closed: ["Closed", "bg-slate-200 text-slate-700"],
};

/** Per-student submission status (server-computed). */
export const SUBMISSION_STATUS = {
  not_submitted: ["Not submitted", "bg-amber-50 text-amber-800 ring-1 ring-amber-200"],
  submitted: ["Submitted — awaiting evaluation", "bg-blue-50 text-blue-700 ring-1 ring-blue-200"],
  evaluated: ["Evaluated", "bg-green-50 text-green-700 ring-1 ring-green-200"],
  missed: ["Missed", "bg-red-50 text-red-700 ring-1 ring-red-200"],
};
export const STUDENT_STATUS = { ...SUBMISSION_STATUS, submitted: ["Submitted · awaiting evaluation", "bg-blue-50 text-blue-700 ring-1 ring-blue-200"] };

/** The teacher's assignment workflow, shown on the list and in the editor. */
export const TEACHER_FLOW = ["Draft", "Publish", "Submissions", "AI evaluation", "Review", "Final marks"];

export function Badge({ map, value, testId }) {
  const [label, cls] = map[value] || [value, "bg-gray-100 text-gray-600"];
  return <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`} data-testid={testId} data-status={value}>{label}</span>;
}

/**
 * Horizontal workflow tracker. `current` = index of the active step (earlier steps show as done);
 * `optional` step indexes are labelled as such. Purely visual.
 */
export function Stepper({ steps, current = -1, optional = [], testId }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs" data-testid={testId}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${active ? "bg-primary text-white" : done ? "bg-green-50 text-green-700 ring-1 ring-green-200" : "bg-gray-100 text-gray-500"}`}>
              <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${active ? "bg-white/25" : done ? "bg-green-600 text-white" : "bg-white text-gray-500"}`}>{done ? "✓" : i + 1}</span>
              {label}{optional.includes(i) && <span className="font-normal opacity-75">(optional)</span>}
            </span>
            {i < steps.length - 1 && <span className="text-gray-300" aria-hidden>→</span>}
          </li>
        );
      })}
    </ol>
  );
}

export const fmtDateTime =(iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
export const fmtBytes = (n) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

/** Due-date wording relative to now ("Due in 3 days", "Overdue"). Display only; the server decides. */
export function dueText(iso) {
  if (!iso) return "No due date";
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return `Was due ${fmtDateTime(iso)}`;
  const days = Math.floor(ms / 86400000);
  if (days >= 2) return `Due in ${days} days · ${fmtDateTime(iso)}`;
  const hours = Math.max(1, Math.floor(ms / 3600000));
  return `Due in ${hours} hour${hours === 1 ? "" : "s"} · ${fmtDateTime(iso)}`;
}

/* <input type="datetime-local"> works in local time; the server stores UTC ISO. */
export const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const toIso = (local) => (local ? new Date(local).toISOString() : null);

/** Downloads an authenticated PDF as a file (never rendered inside the app). */
export async function downloadPdf(url, auth, filename) {
  const res = await axios.get(url, { ...auth, responseType: "blob" });
  const href = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = href;
  a.download = filename || "submission.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const apiError = (err, fallback) => err?.response?.data?.error?.message || fallback;
