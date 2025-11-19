// src/panels/ActivitiesCalendarPanel.jsx
import React, { useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

const newId = () => Math.random().toString(36).slice(2);

export default function ActivitiesCalendarPanel({
  activities = [],
  setState,
  setView,
}) {
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

  // Dra & släpp till nytt datum
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

  // Klick på befintlig aktivitet => öppna samma popup som i aktivitetslistan
  const handleEventClick = (info) => {
    const id = info.event.id;
    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((a) =>
        a.id === id ? { ...a, _shouldOpen: true } : a
      ),
    }));
    setView("activities"); // hoppa till aktivitetsvyn där popupen redan finns
  };

  // Klick på datum => skapa ny aktivitet och öppna den i aktivitetsvyn
  const handleDateClick = (info) => {
    const dateStr = info.dateStr; // YYYY-MM-DD
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
      _shouldOpen: true, // exakt samma som "Ny aktivitet"-knappen
    };

    setState((s) => ({
      ...s,
      activities: [...(s.activities || []), a],
    }));

    setView("activities"); // gå till aktivitetsvyn => popupen öppnas
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
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
  );
}
