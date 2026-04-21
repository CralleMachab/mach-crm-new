import { useEffect, useMemo, useRef, useState } from "react";
import { addWorkdaysISO, isWorkingDayISO, addDaysISO, diffDaysISO } from "../utils/calendarMath";
const COLOR_PALETTE = [
  "#000000", "#1F2937", "#6B7280", "#9CA3AF", "#D1D5DB", "#F3F4F6", "#FFFFFF",
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E", "#10B981",
  "#06B6D4", "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#EC4899", "#F43F5E"
];


// ===== Datumhjälpare (för header-färg lör/sön) =====
function parseISO(d) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Räknar hur många arbetsdagar som finns från start (inkl) till end (exkl)
function countWorkdaysISO(startISO, endISO, calendar) {
  if (!startISO || !endISO) return 1;
  const total = Math.max(0, diffDaysISO(startISO, endISO));
  let count = 0;
  for (let i = 0; i < total; i++) {
    const d = addDaysISO(startISO, i);
    if (isWorkingDayISO(d, calendar)) count++;
  }
  return Math.max(1, count);
}

// ===== Range =====
function computeRange(tasks, calendar, masterStartISO) {
  const safeTasks = (tasks || []).filter((t) => t && t.start);

  const starts = safeTasks.map((t) => t.start);
  const ends = safeTasks.map((t) =>
    addWorkdaysISO(t.start, Math.max(1, Number(t.durationWorkdays || 1)), calendar)
  );

  const todayISO = toISO(new Date());
  const minTasksStart = starts[0]
    ? starts.reduce((a, b) => (a < b ? a : b), starts[0])
    : todayISO;

  const maxTasksEnd = ends[0]
    ? ends.reduce((a, b) => (a > b ? a : b), ends[0])
    : todayISO;

  const minStart = masterStartISO
    ? masterStartISO < minTasksStart
      ? masterStartISO
      : minTasksStart
    : minTasksStart;

  const maxEnd = maxTasksEnd;

  const rangeStart = addDaysISO(minStart, -7);
  const rangeEnd = addDaysISO(maxEnd, 21);
  return { rangeStart, rangeEnd, minStart, maxEnd };
}

function groupDaysByMonth(days) {
  const groups = [];
  let current = null;

  days.forEach((d) => {
    const key = d.slice(0, 7); // YYYY-MM
    if (!current || current.key !== key) {
      current = { key, days: [] };
      groups.push(current);
    }
    current.days.push(d);
  });

  return groups;
}

// Marker-typ för kolumn-toning
function dayMarkerType(iso, calendar) {
  const dow = parseISO(iso).getDay(); // 0=sön ... 6=lör

  // Semester / enskild ledig dag (grå) vinner över helg
  if (calendar?.nonWorkingDates?.includes(iso)) return "vacation";
  for (const r of calendar?.vacationRanges || []) {
    if (!r?.start || !r?.end) continue;
    if (iso >= r.start && iso <= r.end) return "vacation";
  }

  // Helg/icke-arbetsdag (röd/gul)
  if (!isWorkingDayISO(iso, calendar)) {
    if (dow === 6) return "sat";
    if (dow === 0) return "sun";
    return "nonwork";
  }

  return "work";
}
function ColorSwatchPicker({ value, onChange, allowClear = false, clearLabel = "Återställ" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {COLOR_PALETTE.map((c) => {
          const isSelected = (value || "") === c;

          return (
            <button
              key={c}
              onClick={() => onChange(c)}
              title={c}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                border: isSelected ? "2px solid #111" : "1px solid #ccc",
                padding: 0,
                background: c,
                cursor: "pointer"
              }}
            />
          );
        })}
      </div>

      {allowClear ? (
        <button onClick={() => onChange(null)} style={{ padding: "8px 10px", alignSelf: "flex-start" }}>
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}


export default function GanttView({
  data,
  setData,
  selectedScheduleIds = [],
  masterStartISO = null,
  calendar = null,
  openTaskId = null,
  onOpenTaskHandled = null
}) {

  // ===== Konstanter =====
  const rowHeight = 44;
  const labelColWidth = 560;
  const dayWidth = 18;
  const headerHeight = 52;

  // ===== Drawer (informationsruta) =====
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const selectedTask = selectedTaskId ? data?.tasks?.[selectedTaskId] : null;

  function openDrawer(taskId) {
    setSelectedTaskId(taskId);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setSelectedTaskId(null);
  }
  useEffect(() => {
  if (!openTaskId) return;

  const t = data?.tasks?.[openTaskId];
  if (!t) return;

  setSelectedTaskId(openTaskId);
  setDrawerOpen(true);

  if (typeof onOpenTaskHandled === "function") {
    onOpenTaskHandled();
  }
}, [openTaskId, data, onOpenTaskHandled]);


  const selectedSchedule = useMemo(() => {
    if (!selectedTask?.scheduleId) return null;
    return data?.schedules?.[selectedTask.scheduleId] || null;
  }, [data, selectedTask?.scheduleId]);

  function updateSchedule(scheduleId, patch) {
    if (!scheduleId) return;
    setData((prev) => {
      const next = structuredClone(prev);
      next.schedules[scheduleId] = { ...next.schedules[scheduleId], ...patch };
      return next;
    });
  }

  // Kalender-key: gör att Gantt reagerar direkt när du lägger semester/ledigt/helgarbete
  const calendarKey = useMemo(() => {
    const c = calendar || {};
    return JSON.stringify({
      workingPattern: c.workingPattern || null,
      nonWorkingDates: c.nonWorkingDates || [],
      vacationRanges: c.vacationRanges || []
    });
  }, [calendar]);

  // Robust uppdatering av task
  function updateTask(taskId, patch) {
  setData((prev) => {
    const next = structuredClone(prev);

    const current = next.tasks[taskId] || {};
    const merged = { ...current, ...patch };

    // Om någon sätter color till null => ta bort fältet helt
    if (Object.prototype.hasOwnProperty.call(patch, "color") && patch.color == null) {
      delete merged.color;
    }

    next.tasks[taskId] = merged;
    return next;
  });
}

  function setTaskDuration(taskId, newValue) {
    const n = Math.max(1, Number(newValue || 1));
    updateTask(taskId, { durationWorkdays: n });
  }

  // Alla tasks som tillhör valda byggdelar
  const visibleTasks = useMemo(() => {
    const all = Object.values(data.tasks || {});
    const setIds = new Set(selectedScheduleIds);
    return all
      .filter((t) => setIds.has(t.scheduleId))
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  }, [data, selectedScheduleIds]);

  // Alla tasks i projektet (för master-total)
  const allProjectTasks = useMemo(() => {
    return Object.values(data.tasks || {}).slice();
  }, [data]);

  // Range baserat på ALLA tasks
  const { rangeStart, rangeEnd, minStart, maxEnd } = useMemo(() => {
    return computeRange(allProjectTasks, calendar, masterStartISO);
  }, [allProjectTasks, calendarKey, masterStartISO]);

  // Kalenderdagar som kolumner (så helg/semester syns)
  const totalDays = Math.max(1, diffDaysISO(rangeStart, rangeEnd));
  const days = useMemo(() => {
    const arr = [];
    for (let i = 0; i < totalDays; i++) arr.push(addDaysISO(rangeStart, i));
    return arr;
  }, [rangeStart, totalDays]);

  // Behåll workDays för vissa beräkningar/drag om du vill, men vyn bygger på "days"
  const workDays = useMemo(() => {
    return (days || []).filter((d) => isWorkingDayISO(d, calendar));
  }, [days, calendarKey]);

  const timelineWidth = days.length * dayWidth;
  const monthGroups = useMemo(() => groupDaysByMonth(days), [days]);

  // Master sammanfattning
  const masterStart = masterStartISO || minStart;
  const masterEnd = maxEnd;
  const totalCalendarDays = diffDaysISO(masterStart, masterEnd);
  const approxWeeks = Math.max(1, Math.round(totalCalendarDays / 7));

  // ===== Drag-logik (kalenderdagar i vyn, duration lagras som arbetsdagar) =====
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);

  function onMouseDown(e, taskId, mode) {
    e.preventDefault();
    e.stopPropagation();

    const t = data.tasks[taskId];
    if (!t) return;

    const originalStart = t.start;
    const originalDuration = Math.max(1, Number(t.durationWorkdays || 1));
    const originalEnd = addWorkdaysISO(originalStart, originalDuration, calendar); // dagen efter sista arbetsdagen

    dragRef.current = {
      taskId,
      mode,
      startX: e.clientX,
      originalStart,
      originalDuration,
      originalEnd
    };

    setDrag({ active: true });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e) {
    const d = dragRef.current;
    if (!d) return;

    const dx = e.clientX - d.startX;
    const deltaDays = Math.round(dx / dayWidth);
    if (deltaDays === 0) return;

    if (d.mode === "move") {
      const newStart = addDaysISO(d.originalStart, deltaDays);
      updateTask(d.taskId, { start: newStart });
      return;
    }

    if (d.mode === "left") {
      const newStart = addDaysISO(d.originalStart, deltaDays);
      const newDur = countWorkdaysISO(newStart, d.originalEnd, calendar);
      updateTask(d.taskId, { start: newStart, durationWorkdays: newDur });
      return;
    }

    if (d.mode === "right") {
      const newEnd = addDaysISO(d.originalEnd, deltaDays);
      const newDur = countWorkdaysISO(d.originalStart, newEnd, calendar);
      updateTask(d.taskId, { durationWorkdays: newDur });
      return;
    }
  }

  function onMouseUp() {
    dragRef.current = null;
    setDrag(null);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ color: "#ddd", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Masterplan (sammanfattning)</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
          <div>
            <span style={{ color: "#aaa" }}>Start:</span> <b>{masterStart}</b>
          </div>
          <div>
            <span style={{ color: "#aaa" }}>Slut (auto):</span> <b>{masterEnd}</b>
          </div>
          <div>
            <span style={{ color: "#aaa" }}>Total tid:</span> <b>{approxWeeks} veckor</b>
          </div>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #333",
          borderRadius: 8,
          overflow: "auto",
          background: "#111"
        }}
      >
        {/* Header-rad */}
        <div style={{ display: "flex", minWidth: labelColWidth + timelineWidth }}>
          {/* Vänster header */}
          <div
            style={{
              width: labelColWidth,
              position: "sticky",
              left: 0,
              zIndex: 3,
              background: "#111",
              borderRight: "1px solid #333",
              height: headerHeight
            }}
          >
            <div style={{ padding: "6px 10px", fontWeight: 700 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ width: 26 }}>#</div>
                <div style={{ width: 120 }}>Delplan</div>
                <div style={{ flex: 1 }}>Aktivitet</div>
                <div style={{ width: 150 }}>Start</div>
                <div style={{ width: 80, textAlign: "right" }}>Arb.dagar</div>
              </div>
            </div>
          </div>

          {/* Timeline header */}
          <div style={{ height: headerHeight }}>
            {/* Månadrad */}
            <div style={{ display: "flex", borderBottom: "1px solid #222" }}>
              {monthGroups.map((m) => (
                <div
                  key={m.key}
                  style={{
                    width: m.days.length * dayWidth,
                    borderRight: "1px solid #222",
                    color: "#ddd",
                    fontSize: 12,
                    fontWeight: 700,
                    paddingTop: 6,
                    textAlign: "center",
                    userSelect: "none"
                  }}
                  title={m.key}
                >
                  {new Date(m.key + "-01").toLocaleDateString("sv-SE", {
                    month: "long",
                    year: "numeric"
                  })}
                </div>
              ))}
            </div>

            {/* Dagrad: lör gul om icke-arbetsdag, annars röd för icke-arbetsdag */}
            <div style={{ display: "flex" }}>
              {days.map((d) => {
                const type = dayMarkerType(d, calendar);
                const dow = parseISO(d).getDay();

                let textColor = "#bbb";
                let bgColor = "transparent";

                if (type === "sat") {
                  textColor = "#ffd27a";
                  bgColor = "rgba(255, 210, 122, 0.10)";
                } else if (type === "sun" || type === "nonwork") {
                  textColor = "#ff6b6b";
                  bgColor = "rgba(255, 107, 107, 0.10)";
                } else if (type === "vacation") {
                  textColor = dow === 6 ? "#ffd27a" : "#ff6b6b"; // text kan följa helg, men grå bakgrund
                  bgColor = "rgba(180, 180, 180, 0.10)";
                }

                return (
                  <div
                    key={d}
                    style={{
                      width: dayWidth,
                      borderRight: "1px solid #222",
                      color: textColor,
                      fontSize: 11,
                      paddingTop: 4,
                      textAlign: "center",
                      userSelect: "none",
                      background: bgColor
                    }}
                    title={d}
                  >
                    {d.slice(8, 10)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rader */}
        {visibleTasks.map((t, idx) => {
          const dur = Math.max(1, Number(t.durationWorkdays || 1));

          // Vänsterposition i kalenderdagar
          const leftPx = Math.max(0, diffDaysISO(rangeStart, t.start)) * dayWidth;

          // Slutdatum (dagen efter sista arbetsdagen)
          const endISO = addWorkdaysISO(t.start, dur, calendar);

          // Bredd i kalenderdagar som krävs för att få "dur" arbetsdagar
          const spanDays = Math.max(1, diffDaysISO(t.start, endISO));
          const widthPx = spanDays * dayWidth;

          const schedule = data.schedules?.[t.scheduleId] || null;
const scheduleName = schedule?.name ?? "Okänd";
const barColor = t?.color || schedule?.color || "#2b8cff";


          return (
            <div
              key={t.id}
              style={{
                display: "flex",
                minWidth: labelColWidth + timelineWidth,
                borderTop: "1px solid #222",
                minHeight: rowHeight
              }}
            >
              {/* Vänster kolumn (sticky) */}
              <div
                style={{
                  width: labelColWidth,
                  position: "sticky",
                  left: 0,
                  zIndex: 5,
                  background: "#111",
                  borderRight: "1px solid #333",
                  padding: "4px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <div
  style={{
    display: "flex",
    alignItems: "flex-start",
    width: "100%",
    gap: 8,
    minHeight: 44
  }}
>
                  <div style={{ width: 26, color: "#888" }}>{idx + 1}</div>

                  <div style={{ width: 120, color: "#bbb", display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: barColor,
                        display: "inline-block"
                      }}
                      title="Byggdelens färg"
                    />
                    <span>{scheduleName}</span>
                  </div>

                  <div
  onClick={() => openDrawer(t.id)}
  style={{
    flex: "0 0 215px",
    color: "#eee",
    cursor: "pointer",
    whiteSpace: "normal",
    wordBreak: "break-word",
    lineHeight: "1.2",
    paddingRight: 8
  }}
  title="Klicka för att öppna info-rutan"
>
  {t.name}
</div>

                  {/* Startdatum */}
<div style={{ width: 165 }}>
  <input
    type="date"
    value={t.start}
    onMouseDown={(e) => e.stopPropagation()}
    onClick={(e) => e.stopPropagation()}
    onChange={(e) => updateTask(t.id, { start: e.target.value })}
    style={{
      width: 145,
      background: "#111",
      color: "#eee",
      border: "1px solid #333",
      borderRadius: 6,
      padding: "3px 6px"
    }}
  />
</div>

                  {/* Arbetsdagar */}
                  <div style={{ width: 80, textAlign: "right" }}>
                    <input
                      type="number"
                      min={1}
                      value={Number(t.durationWorkdays ?? 1)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setTaskDuration(t.id, e.target.value)}
                      style={{
                        width: 70,
                        textAlign: "right",
                        background: "#111",
                        color: "#eee",
                        border: "1px solid #333",
                        borderRadius: 6,
                        padding: "3px 6px"
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Timeline cell */}
              <div style={{ position: "relative", width: timelineWidth }}>
                {/* Vertikala dag-markeringar (lör gul, sön/röd dag röd, semester grå) */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: timelineWidth,
                    height: "100%",
                    pointerEvents: "none",
                    zIndex: 1
                  }}
                >
                  {days.map((d, i) => {
                    const type = dayMarkerType(d, calendar);

                    let bg = "transparent";
                    if (type === "sat") bg = "rgba(255, 210, 122, 0.14)";
                    else if (type === "sun" || type === "nonwork") bg = "rgba(255, 107, 107, 0.14)";
                    else if (type === "vacation") bg = "rgba(180, 180, 180, 0.14)";

                    if (bg === "transparent") return null;

                    return (
                      <div
                        key={d}
                        style={{
                          position: "absolute",
                          left: i * dayWidth,
                          top: 0,
                          width: dayWidth,
                          height: "100%",
                          background: bg
                        }}
                      />
                    );
                  })}
                </div>

                {/* Rutnät */}
                <div style={{ display: "flex", height: "100%", position: "relative", zIndex: 0 }}>
                  {days.map((d) => (
                    <div
                      key={d}
                      style={{
                        width: dayWidth,
                        borderRight: "1px solid #191919",
                        background: "transparent"
                      }}
                    />
                  ))}
                </div>

                {/* Stapel */}
                <div
                  onDoubleClick={() => openDrawer(t.id)}
                  style={{
                    position: "absolute",
                    left: leftPx,
                    top: 10,
bottom: 10,
height: "auto",
                    width: widthPx,
                    background: barColor,
                    borderRadius: 6,
                    cursor: "grab",
                    display: "flex",
                    alignItems: "center",
                    zIndex: 2
                  }}
                  title={`${t.start} (${dur} arbetsdagar)  Slut: ${endISO}`}
                >
                  <div
                    onMouseDown={(e) => onMouseDown(e, t.id, "left")}
                    style={{
                      width: 10,
                      height: "100%",
                      cursor: "ew-resize",
                      background: "rgba(0,0,0,0.25)",
                      borderTopLeftRadius: 6,
                      borderBottomLeftRadius: 6
                    }}
                    title="Dra för att ändra start"
                  />

                  <div
                    onMouseDown={(e) => onMouseDown(e, t.id, "move")}
                    style={{
                      flex: 1,
                      height: "100%",
                      cursor: "grab",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 8,
                      color: "#fff",
                      fontSize: 12,
                      userSelect: "none"
                    }}
                    title="Dra för att flytta"
                  >
                    {t.name}
                  </div>

                  <div
                    onMouseDown={(e) => onMouseDown(e, t.id, "right")}
                    style={{
                      width: 10,
                      height: "100%",
                      cursor: "ew-resize",
                      background: "rgba(0,0,0,0.25)",
                      borderTopRightRadius: 6,
                      borderBottomRightRadius: 6
                    }}
                    title="Dra för att ändra längd"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {visibleTasks.length === 0 ? (
          <div style={{ padding: 12, color: "#bbb" }}>Inga moment i valda byggdelar.</div>
        ) : null}
      </div>

      <div style={{ marginTop: 8, color: "#aaa", fontSize: 12 }}>
        Drag: vänster kant = ändra start, höger kant = ändra längd, remember: dubbelklick på stapeln öppnar info.
      </div>

      {/* ===== Informationsruta (Drawer) ===== */}
      {drawerOpen && selectedTask ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: 380,
            height: "100vh",
            background: "#fff",
            color: "#111",
            borderLeft: "1px solid #ddd",
            boxShadow: "-8px 0 24px rgba(0,0,0,0.15)",
            zIndex: 9999,
            padding: 14,
            overflow: "auto"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 800 }}>Informationsruta</div>
            <button onClick={closeDrawer}>Stäng</button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
            Dubbelklick på stapel eller klick på namn öppnar.
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Moment-namn</div>
            <input
              value={selectedTask.name || ""}
              onChange={(e) => updateTask(selectedTask.id, { name: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Startdatum</div>
            <input
              type="date"
              value={selectedTask.start || ""}
              onChange={(e) => updateTask(selectedTask.id, { start: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Arbetsdagar</div>
            <input
              type="number"
              min={1}
              value={Number(selectedTask.durationWorkdays ?? 1)}
              onChange={(e) =>
                updateTask(selectedTask.id, { durationWorkdays: Math.max(1, Number(e.target.value || 1)) })
              }
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
            />
          </div>


 {/* ===== Aktivitet ===== */}
<div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #eee" }}>
  <div style={{ fontWeight: 800, marginBottom: 8 }}>Aktivitet</div>

 <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
  Färg (bara denna stapel)
</div>

<ColorSwatchPicker
  value={selectedTask?.color || ""}
  onChange={(c) => updateTask(selectedTask.id, { color: c })}
  allowClear={true}
  clearLabel="Återställ (använd byggdel)"
/>


  <div style={{ marginTop: 12 }}>
    <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Anteckningar</div>
    <textarea
      value={selectedTask?.notes || ""}
      onChange={(e) => updateTask(selectedTask.id, { notes: e.target.value })}
      placeholder="Skriv anteckningar här..."
      rows={6}
      style={{
        width: "100%",
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid #ccc",
        fontFamily: "Arial, sans-serif",
        resize: "vertical"
      }}
    />
  </div>
</div>


{/* ===== Byggdel ===== */}
<div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #eee" }}>
  <div style={{ fontWeight: 800, marginBottom: 8 }}>Byggdel</div>

  <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Byggdelens namn</div>
  <input
    value={selectedSchedule?.name || ""}
    onChange={(e) => updateSchedule(selectedTask.scheduleId, { name: e.target.value })}
    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
  />

  <div style={{ marginTop: 10, fontSize: 12, color: "#555", marginBottom: 4 }}>Byggdelens färg</div>
  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
    <input
      type="color"
      value={selectedSchedule?.color || "#2b8cff"}
      onChange={(e) => updateSchedule(selectedTask.scheduleId, { color: e.target.value })}
      style={{ width: 56, height: 36, border: "1px solid #ccc", borderRadius: 8, padding: 0 }}
      title="Färg för hela byggdelen"
    />
    <div style={{ fontSize: 12, color: "#666" }}>{selectedSchedule?.color || "#2b8cff"}</div>
  </div>
</div>


          <div style={{ marginTop: 14, fontSize: 12, color: "#666" }}>
            Obs: Byggdelens färg används direkt på staplarna.
          </div>
        </div>
      ) : null}
    </div>
  );
}
