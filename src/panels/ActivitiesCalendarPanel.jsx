import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

// Enkel id-generator utan crypto (för att undvika problem i vissa miljöer)
const newId = () => Math.random().toString(36).slice(2);

export default function ActivitiesCalendarPanel({ activities = [], setState }) {
  const [selected, setSelected] = useState(null); // valt aktivitet-objekt
  const [draft, setDraft] = useState(null);       // redigerbar kopia

  // Bygg events till kalendern
  const events = useMemo(() => {
    return (activities || [])
      .filter((a) => !a.deletedAt)
      .map((a) => {
        const dateStr =
          a.dueDate && a.dueDate.length >= 10
            ? a.dueDate.slice(0, 10)
            : a.createdAt
            ? a.createdAt.slice(0, 10)
            : null;

        if (!dateStr) return null;

        return {
          id: a.id,
          title: a.title || "Aktivitet",
          start: dateStr,
          allDay: true,
        };
      })
      .filter(Boolean);
  }, [activities]);

  // När man drar & släpper en aktivitet till nytt datum
  const handleEventDrop = (info) => {
    const ev = info.event;
    const id = ev.id;
    const start = ev.start;
    if (!start) return;

    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, "0");
    const d = String(start.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;

    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((a) =>
        a.id === id
          ? {
              ...a,
              dueDate: dateStr,
              updatedAt: new Date().toISOString(),
            }
          : a
      ),
    }));
  };

  // Klick på en befintlig aktivitet
  const handleEventClick = (info) => {
    const id = info.event.id;
    const a = (activities || []).find((x) => x.id === id);
    if (a) {
      setSelected(a);
    }
  };

  // Klick på ett datum i kalendern => skapa ny aktivitet där
  const handleDateClick = (info) => {
    const dateStr = info.dateStr; // "YYYY-MM-DD"
    const nowIso = new Date().toISOString();
    const a = {
      id: newId(),
      title: "",
      responsible: "Övrig",
      priority: "medium",
      status: "",
      dueDate: dateStr,
      dueTime: "",
      description: "",
      customerId: "",
      supplierId: "",
      contactName: "",
      isPhone: false,
      isEmail: false,
      isLunch: false,
      isMeeting: false,
      createdAt: nowIso,
    };

    setState((s) => ({
      ...s,
      activities: [...(s.activities || []), a],
    }));

    // Öppna direkt i redigeringspanelen
    setSelected(a);
  };

  // När selected ändras => uppdatera draft
  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft({ ...selected });
  }, [selected]);

  const updateDraft = (k, v) =>
    setDraft((d) => ({
      ...d,
      [k]: v,
    }));

  const saveDraft = () => {
    if (!draft) return;
    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((a) =>
        a.id === draft.id
          ? {
              ...a,
              ...draft,
              updatedAt: new Date().toISOString(),
            }
          : a
      ),
    }));
    setSelected(null);
  };

  const markDone = () => {
    if (!draft) return;
    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((a) =>
        a.id === draft.id
          ? {
              ...a,
              ...draft,
              priority: "klar",
              status: "klar",
              completedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : a
      ),
    }));
    setSelected(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-start gap-4 flex-col lg:flex-row">
        {/* KALENDERN */}
        <div className="flex-1 min-w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Aktiviteter – Kalender</h2>
            <p className="text-xs text-gray-500">
              Klicka på en dag för att skapa ny aktivitet. Dra &amp; släpp för att flytta.
            </p>
          </div>

          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="auto"
            events={events}
            editable={true}
            eventDrop={handleEventDrop}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
          />
        </div>

        {/* SIDOPANEL FÖR VALD AKTIVITET */}
        <div className="w-full lg:w-80 border rounded-2xl p-3 bg-gray-50 min-h-[200px]">
          {!draft && (
            <div className="text-sm text-gray-500">
              Klicka på en aktivitet eller på en dag i kalendern för att skapa/öppna.
            </div>
          )}

          {draft && (
            <div className="space-y-3 text-sm">
              <div>
                <label className="font-medium block mb-1">Titel</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={draft.title}
                  onChange={(e) => updateDraft("title", e.target.value)}
                  placeholder="Vad handlar aktiviteten om?"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-medium block mb-1">Datum</label>
                  <input
                    type="date"
                    className="w-full border rounded px-2 py-1"
                    value={draft.dueDate || ""}
                    onChange={(e) => updateDraft("dueDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-medium block mb-1">Tid</label>
                  <input
                    type="time"
                    className="w-full border rounded px-2 py-1"
                    value={draft.dueTime || ""}
                    onChange={(e) => updateDraft("dueTime", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="font-medium block mb-1">Ansvarig</label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={draft.responsible || "Övrig"}
                  onChange={(e) => updateDraft("responsible", e.target.value)}
                >
                  <option>Mattias</option>
                  <option>Cralle</option>
                  <option>Övrig</option>
                </select>
              </div>

              <div>
                <label className="font-medium block mb-1">Prioritet</label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={draft.priority || "medium"}
                  onChange={(e) => updateDraft("priority", e.target.value)}
                >
                  <option value="low">Låg</option>
                  <option value="medium">Normal</option>
                  <option value="high">Hög</option>
                  <option value="klar">Klar</option>
                </select>
              </div>

              <div>
                <label className="font-medium block mb-1">Beskrivning</label>
                <textarea
                  className="w-full border rounded px-2 py-1 min-h-[80px]"
                  value={draft.description || ""}
                  onChange={(e) => updateDraft("description", e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="px-3 py-1 rounded bg-green-600 text-white text-sm"
                  onClick={saveDraft}
                >
                  Spara
                </button>
                <button
                  type="button"
                  className="px-3 py-1 rounded bg-emerald-600 text-white text-sm"
                  onClick={markDone}
                >
                  Spara & Klar
                </button>
                <button
                  type="button"
                  className="ml-auto px-3 py-1 rounded border text-sm"
                  onClick={() => setSelected(null)}
                >
                  Stäng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
