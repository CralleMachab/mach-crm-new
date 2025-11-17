import React, { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

export default function ActivitiesCalendarPanel({ activities = [], setState }) {
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  // Visa bara aktiva (ej arkiverade) i kalendern
  const events = useMemo(
    () =>
      (activities || [])
        .filter((a) => !a.deletedAt)
        .map((a) => {
          const date = a.dueDate || a.createdAt?.slice(0, 10) || "";
          const time = a.dueTime || "09:00";
          return {
            id: a.id,
            title: a.title || "Aktivitet",
            start: date ? `${date}T${time}` : undefined,
            allDay: !a.dueTime,
          };
        })
        .filter((e) => !!e.start),
    [activities]
  );

  const handleEventDrop = (info) => {
    const id = info.event.id;
    const date = info.event.start; // Date-objekt
    if (!date) return;

    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, "0");
    const d = `${date.getDate()}`.padStart(2, "0");
    const hh = `${date.getHours()}`.padStart(2, "0");
    const mm = `${date.getMinutes()}`.padStart(2, "0");

    const newDate = `${y}-${m}-${d}`;
    const newTime = `${hh}:${mm}`;

    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((a) =>
        a.id === id
          ? {
              ...a,
              dueDate: newDate,
              dueTime: newTime,
              updatedAt: new Date().toISOString(),
            }
          : a
      ),
    }));
  };

  const handleEventClick = (info) => {
    const id = info.event.id;
    const a = (activities || []).find((x) => x.id === id);
    if (!a) return;

    setOpenItem(a);
    setDraft({
      id: a.id,
      title: a.title || "",
      dueDate: a.dueDate || "",
      dueTime: a.dueTime || "",
      responsible: a.responsible || "Övrig",
      priority: a.priority || "medium",
      status: a.status || "",
      description: a.description || "",
    });
  };

  const saveDraft = () => {
    if (!draft) return;
    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((a) =>
        a.id === draft.id
          ? {
              ...a,
              title: draft.title,
              dueDate: draft.dueDate,
              dueTime: draft.dueTime,
              responsible: draft.responsible,
              priority: draft.priority,
              status: draft.status,
              description: draft.description,
              updatedAt: new Date().toISOString(),
            }
          : a
      ),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Aktiviteter – Kalender</h2>
        <div className="text-sm text-gray-500">
          Tips: Dra & släpp en aktivitet för att flytta datum.
          Klicka på en aktivitet för att öppna den.
        </div>
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="sv"
        height="auto"
        editable={true}
        droppable={false}
        eventStartEditable={true}
        eventDurationEditable={false}
        events={events}
        eventDrop={handleEventDrop}
        eventClick={handleEventClick}
      />

      {openItem && draft && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => {
            setOpenItem(null);
            setDraft(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow p-4 w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">
                Aktivitet ({openItem.title || "utan titel"})
              </div>
              <button
                className="text-sm"
                onClick={() => {
                  setOpenItem(null);
                  setDraft(null);
                }}
                type="button"
              >
                Stäng
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Titel</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Datum</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={draft.dueDate}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, dueDate: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tid</label>
                <input
                  type="time"
                  className="w-full border rounded px-3 py-2"
                  value={draft.dueTime}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, dueTime: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Ansvarig</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.responsible}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, responsible: e.target.value }))
                  }
                >
                  <option>Mattias</option>
                  <option>Cralle</option>
                  <option>Övrig</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Prioritet</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, priority: e.target.value }))
                  }
                >
                  <option value="low">Låg</option>
                  <option value="medium">Normal</option>
                  <option value="high">Hög</option>
                  <option value="klar">Klar</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, status: e.target.value }))
                  }
                >
                  <option value="">—</option>
                  <option value="återkoppling">Återkoppling</option>
                  <option value="klar">Klar</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Beskrivning</label>
                <textarea
                  className="w-full border rounded px-3 py-2 min-h-[80px]"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className="px-3 py-2 rounded bg-green-600 text-white"
                onClick={saveDraft}
                type="button"
              >
                Spara
              </button>
              <button
                className="ml-auto px-3 py-2 rounded border"
                onClick={() => {
                  setOpenItem(null);
                  setDraft(null);
                }}
                type="button"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
