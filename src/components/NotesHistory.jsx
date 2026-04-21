import React, { useMemo, useState } from "react";

/**
 * NotesHistory
 * - notes: [{id, date (YYYY-MM-DD), text}]
 * - onChange: (nextNotes)=>void
 * Behavior:
 * - New note is added on top with today's date.
 * - Collapsed by default: shows 1-line ingress (first line, truncated).
 * - Click row to expand/collapse.
 */
export default function NotesHistory({
  label = "Anteckningar",
  notes = [],
  onChange,
  addLabel = "+ Lägg till anteckning",
  placeholder = "Skriv anteckningar...",
}) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const mkId = () =>
    crypto?.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const safeNotes = useMemo(() => (Array.isArray(notes) ? notes : []), [notes]);

  const toggle = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateNote = (id, patch) => {
    const next = safeNotes.map((n) => (n.id === id ? { ...n, ...patch } : n));
    onChange?.(next);
  };

  const addNew = () => {
    const next = [{ id: mkId(), date: todayISO(), text: "" }, ...safeNotes];
    onChange?.(next);
    // auto-expand new note
    setExpandedIds((prev) => {
      const s = new Set(Array.from(prev));
      s.add(next[0].id);
      return s;
    });
  };

  const oneLine = (txt) => {
    const t = (txt || "").replace(/\s+/g, " ").trim();
    if (!t) return "—";
    return t.length > 90 ? t.slice(0, 90) + "…" : t;
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <label className="block text-sm font-medium">{label}</label>
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 text-sm"
          onClick={addNew}
        >
          {addLabel}
        </button>
      </div>

      {safeNotes.length === 0 ? (
        <div className="mt-2 text-sm text-gray-500">Inga anteckningar ännu.</div>
      ) : (
        <div className="mt-2 space-y-2">
          {safeNotes.map((n) => {
            const expanded = expandedIds.has(n.id);
            return (
              <div
                key={n.id}
                className="border rounded-xl overflow-hidden bg-white"
              >
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 flex items-center justify-between gap-3 hover:bg-gray-50"
                  onClick={() => toggle(n.id)}
                  title="Klicka för att öppna/stänga"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500">
                      {n.date || ""}
                    </div>
                    <div className="text-sm text-gray-800 truncate">
                      {oneLine(n.text)}
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm">
                    {expanded ? "▾" : "▸"}
                  </div>
                </button>

                {expanded && (
                  <div className="px-3 pb-3">
                    <textarea
                      className="w-full border rounded-xl px-3 py-2 min-h-[90px]"
                      value={n.text || ""}
                      placeholder={placeholder}
                      onChange={(e) =>
                        updateNote(n.id, { text: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
