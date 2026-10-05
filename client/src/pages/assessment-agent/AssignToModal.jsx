import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Loader2, Search, Users, X } from "lucide-react";

/*
 * "Assign to" popup (migration 008): choose which students of the test's class receive it.
 * Works on its OWN copy of the selection: Cancel changes nothing. Loading the class list is a plain read
 * (no AI). Default selection: the whole class, or - for a test suggested by an AI Performance Report - only
 * the student it was suggested for (`suggested`); the teacher can change it freely before confirming.
 *
 * onConfirm(ids, wholeClass): wholeClass = every student selected (sent as "whole class", so students who
 * join the class later also get the test, as before).
 */
export default function AssignToModal({ base, auth, classroom, classLabel, testTitle, suggested = null, busy = false, onCancel, onConfirm }) {
  const [students, setStudents] = useState(null); // null = loading
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const suggestedId = suggested ? suggested.id : null; // the default selection depends on the id only

  useEffect(() => {
    let alive = true;
    axios.get(`${base}/classrooms/${classroom.id}/students`, auth)
      .then((res) => {
        if (!alive) return;
        const list = res.data.students;
        setStudents(list);
        const inClass = suggestedId !== null && list.some((s) => s.id === suggestedId);
        setSelected(new Set(inClass ? [suggestedId] : suggestedId !== null ? [] : list.map((s) => s.id)));
      })
      .catch(() => { if (alive) { setStudents([]); setLoadError("Could not load the students of this class."); } });
    return () => { alive = false; };
  }, [base, auth, classroom.id, suggestedId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (students || []).filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [students, query]);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const total = students ? students.length : 0;
  const count = selected.size;
  const wholeClass = total > 0 && count === total;
  const suggestedMissing = suggested && students && !students.some((s) => s.id === suggested.id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="aia-assign-title" data-testid="aia-assign-modal">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between gap-3 p-5 border-b">
          <div>
            <h3 id="aia-assign-title" className="text-lg font-bold flex items-center gap-2"><Users size={18} /> Assign to</h3>
            <p className="text-xs text-gray-500 mt-0.5">"{testTitle}" · {classLabel(classroom)}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cancel"><X size={18} /></button>
        </div>

        <div className="p-5 pb-3 space-y-3">
          {suggested && (
            <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-sm text-indigo-900" data-testid="aia-assign-suggested">
              Suggested for: <span className="font-semibold">{suggested.name}</span>
              {suggestedMissing && <span className="block text-xs text-indigo-700 mt-0.5">{suggested.name} is not in this class. Choose the students below.</span>}
            </div>
          )}
          <div className="relative">
            <Search size={16} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students..." aria-label="Search students"
              className="w-full pl-8 pr-2 py-2 border rounded-lg text-sm" data-testid="aia-assign-search" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button type="button" onClick={() => setSelected(new Set((students || []).map((s) => s.id)))} disabled={!total || busy}
              className="px-3 py-1.5 border rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50" data-testid="aia-assign-all">Select all</button>
            <button type="button" onClick={() => setSelected(new Set())} disabled={!count || busy}
              className="px-3 py-1.5 border rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50" data-testid="aia-assign-none">Deselect all</button>
          </div>
        </div>

        <div className="px-5 overflow-y-auto flex-1 min-h-[8rem]" data-testid="aia-assign-list">
          {students === null ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center"><Loader2 size={16} className="animate-spin" /> Loading students…</div>
          ) : loadError ? (
            <p className="text-sm text-red-600 py-4">{loadError}</p>
          ) : total === 0 ? (
            <p className="text-sm text-gray-500 py-4">This class has no students yet.</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No student matches "{query}".</p>
          ) : (
            <ul className="divide-y">
              {visible.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-3 py-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} disabled={busy} className="h-4 w-4" data-testid="aia-assign-student" data-student-id={s.id} />
                    <span className="flex-1">{s.name}</span>
                    {suggested && s.id === suggested.id && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">Suggested</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-5 border-t flex items-center justify-between gap-3">
          <span className="text-sm text-gray-600" data-testid="aia-assign-count">
            Selected: <span className="font-semibold">{count}</span> student{count === 1 ? "" : "s"}{wholeClass ? " (whole class)" : ""}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} disabled={busy} className="px-4 py-2 border rounded-lg text-sm font-medium" data-testid="aia-assign-cancel">Cancel</button>
            <button type="button" onClick={() => onConfirm([...selected].sort((a, b) => a - b), wholeClass)} disabled={busy || count === 0 || !!loadError}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50" data-testid="aia-assign-confirm">
              {busy && <Loader2 size={16} className="animate-spin" />} Assign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Publish body for the selection: whole class = no body (the pre-008 request); otherwise the chosen ids. */
export const publishBody = (ids, wholeClass) => (wholeClass ? undefined : { recipientIds: ids });

/** "Whole class" / "3 selected students" for a test's recipients (server field; absent before 008). */
export const recipientsText = (r) => (r && r.mode === "selected" ? `${r.studentIds.length} selected student${r.studentIds.length === 1 ? "" : "s"}` : "Whole class");
