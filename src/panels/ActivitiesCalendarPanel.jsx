// src/panels/ActivitiesCalendarPanel.jsx
import React, { useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

export default function ActivitiesCalendarPanel({ activities = [], setState, setView }) {
  // Bygg event-lista från aktiviteter
  const events = useMemo(() => {
    return (activities || [])
      .filter(a => !a.deletedAt && a.dueDate) // bara de med datum
      .map(a => {
        const hasTime = !!a.dueTime;
        const start = hasTime
          ? `${a.dueDate}T${a.dueTime}`
          : a.dueDate;

        return {
          id: a.id,
          title: a.title || "Aktivitet",
          start,
          allDay: !hasTime,
          extendedProps: {
            responsible: a.responsible || "Övrig",
            status: a.status || "",
            priority: a.priority || "medium",
            description: a.description || "",
          }
        };
      });
  }, [activities]);

  // Uppdatera datum/tid när man drar en aktivitet
  const updateActivityDate = (id, dateObj) => {
    if (!dateObj) return;
    const year  = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day   = String(dateObj.getDate()).padStart(2, "0");
    const hour  = String(dateObj.getHours()).padStart(2, "0");
    const min   = String(dateObj.getMinutes()).padStart(2, "0");

    const dueDate = `${year}-${month}-${day}`;
    const dueTime = `${hour}:${min}`;

    setState(s => ({
      ...s,
      activities: (s.activities || []).map(a =>
        a.id === id
          ? { ...a, dueDate, dueTime, updatedAt: new Date().toISOString() }
          : a
      ),
    }));
  };

  // Drag & drop i kalendern
  const handleEventDrop = (info) => {
    if (!window.confirm("Flytta aktiviteten till detta datum?")) {
      info.revert();
      return;
    }
    updateActivityDate(info.event.id, info.event.start);
  };

  // Klick i kalendern -> flagga _shouldOpen + byt vy till Aktiviteter
  const handleEventClick = (info) => {
    const id = info.event.id;
    setState(s => ({
      ...s,
      activities: (s.activities || []).map(a =>
        a.id === id ? { ...a, _shouldOpen: true } : a
      ),
    }));
    setView("activities");
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Aktiviteter – Kalender</h2>
        <div className="text-xs text-gray-500">
          Dra en aktivitet för att flytta den. Klicka för att öppna.
        </div>
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="sv"
        firstDay={1}
        editable={true}
        droppable={false}
        eventDrop={handleEventDrop}
        eventClick={handleEventClick}
        events={events}
        height="auto"
      />
    </div>
  );
}

