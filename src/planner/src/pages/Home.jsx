import { useEffect, useMemo, useState } from "react";
import { createEmptySandboxProject } from "../models/scheduleModels";
import { loadProjectData, resetProjectData, saveProjectData } from "../adapters/localStorageAdapter";
import GanttView from "./GanttView";
import { addDaysISO, isWorkingDayISO } from "../utils/calendarMath";

function getProjectIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("projectId") || "sandbox";
}

function findMasterScheduleId(schedulesArr, projectId) {
  // 1) Försök på type === "master"
  const byType = schedulesArr.find((x) => x?.type === "master");
  if (byType?.id) return byType.id;

  // 2) Fallback: standard-id i din sandbox
  const expectedId = `sch_${projectId}_master`;
  const byId = schedulesArr.find((x) => x?.id === expectedId);
  if (byId?.id) return byId.id;

  return null;
}
function makeId(prefix = "sch") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function randomColor() {
  const colors = [
    "#2b8cff", "#ff6b6b", "#ffd27a", "#22c55e", "#a78bfa",
    "#06b6d4", "#f97316", "#84cc16", "#f43f5e", "#14b8a6"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
const COLOR_PALETTE = [
  "#2b8cff", "#ff6b6b", "#ffd27a", "#22c55e", "#a78bfa",
  "#06b6d4", "#f97316", "#84cc16", "#f43f5e", "#14b8a6",
  "#111827", "#6b7280"
];


function diffDaysISO(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const A = new Date(ay, am - 1, ad);
  const B = new Date(by, bm - 1, bd);
  return Math.round((B.getTime() - A.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Home() {
  const projectId = useMemo(() => getProjectIdFromUrl(), []);
  const [data, setData] = useState(null);
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false);
const [selectedScheduleIdForEdit, setSelectedScheduleIdForEdit] = useState(null);
const [openTaskId, setOpenTaskId] = useState(null);


  // Flera valda delplaner (scheduleId)
  const [selectedScheduleIds, setSelectedScheduleIds] = useState([]);

  // Master-start (manuellt)
  const [masterStartISO, setMasterStartISO] = useState("");

  // Lediga dagar / semester inputs
  const [newNonWorkDate, setNewNonWorkDate] = useState("");
  const [vacStart, setVacStart] = useState("");
  const [vacEnd, setVacEnd] = useState("");

  function setDataAndSave(nextOrUpdater) {
    setData((prev) => {
      const next = typeof nextOrUpdater === "function" ? nextOrUpdater(prev) : nextOrUpdater;
      saveProjectData(projectId, next);
      return next;
    });
  }

  useEffect(() => {
    const loaded = loadProjectData(projectId);
    if (loaded) {
      setData(loaded);

      const schedulesArr = Object.values(loaded.schedules || {});
      const tradeSchedules = schedulesArr.filter((s) => s.type !== "master");

      // Välj alla byggdelar som default
      setSelectedScheduleIds(tradeSchedules.map((s) => s.id));

      const masterId = findMasterScheduleId(schedulesArr, projectId);
      const existingStart = masterId ? loaded.schedules?.[masterId]?.frame?.start : null;
      setMasterStartISO(existingStart || "");
      return;
    }

    const fresh = createEmptySandboxProject(projectId);
    saveProjectData(projectId, fresh);
    setData(fresh);

    const schedulesArr2 = Object.values(fresh.schedules || {});
    const tradeSchedules2 = schedulesArr2.filter((s) => s.type !== "master");
    setSelectedScheduleIds(tradeSchedules2.map((s) => s.id));

    setMasterStartISO("");
  }, [projectId]);

  if (!data) return <div style={{ padding: 16 }}>Laddar...</div>;

  const schedulesArr = Object.values(data.schedules || {});
  const masterScheduleId = findMasterScheduleId(schedulesArr, projectId);

  const calendar = data.calendarId ? data.calendars?.[data.calendarId] : null;
  const tradeSchedules = schedulesArr.filter((s) => s.type !== "master");

  const satIsWork = Boolean(calendar?.workingPattern?.sat);
  const sunIsWork = Boolean(calendar?.workingPattern?.sun);

  function toggleSchedule(id) {
    setSelectedScheduleIds((prev) => {
      const has = prev.includes(id);
      return has ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }

  function selectAllTrades() {
    setSelectedScheduleIds(tradeSchedules.map((s) => s.id));
  }

  function clearAllTrades() {
    setSelectedScheduleIds([]);
  }
function openScheduleDrawer(scheduleId) {
  setSelectedScheduleIdForEdit(scheduleId);
  setScheduleDrawerOpen(true);
}

function closeScheduleDrawer() {
  setScheduleDrawerOpen(false);
  setSelectedScheduleIdForEdit(null);
}

function addTaskToSchedule(scheduleId) {
  if (!scheduleId) return;

  const newTaskId = makeId("task");

  const todayISO = new Date().toISOString().slice(0, 10);
  const startISO = masterStartISO || todayISO;

  setDataAndSave((prev) => {
    const next = structuredClone(prev);

    // Hitta nästa sortIndex inom byggdelen
    const tasksArr = Object.values(next.tasks || {}).filter((t) => t?.scheduleId === scheduleId);
    const maxSort = tasksArr.length ? Math.max(...tasksArr.map((t) => Number(t.sortIndex ?? 0))) : 0;
    const nextSort = maxSort + 1;

    next.tasks[newTaskId] = {
      id: newTaskId,
      name: "Ny aktivitet",
      start: startISO,
      durationWorkdays: 1,
      scheduleId: scheduleId,
      notes: ""
      // color: (lämnas tomt => använder byggdelens färg)
    };

    return next;
  });

  // Se till att byggdelen är vald så den syns i vyn
  setSelectedScheduleIds((prev) => (prev.includes(scheduleId) ? prev : [...prev, scheduleId]));

  // Säg åt GanttView att öppna drawer för denna task
  setOpenTaskId(newTaskId);
}


  function addNewTradeSchedule() {
  const newId = makeId("sch");
  const nextName = `Ny byggdel ${tradeSchedules.length + 1}`;

  // Skapa byggdelen
  setDataAndSave((prev) => {
    const next = structuredClone(prev);

    next.schedules[newId] = {
      id: newId,
      type: "trade",
      name: nextName,
      color: randomColor()
    };

    return next;
  });

  // Markera den så den syns
  setSelectedScheduleIds((prev) => (prev.includes(newId) ? prev : [...prev, newId]));

  // Öppna byggdel-drawern (om du vill behålla det beteendet)
  openScheduleDrawer(newId);

  // Skapa en aktivitet direkt i byggdelen + öppna aktivitetens informationsruta
  addTaskToSchedule(newId);
}


  // ===== Hjälp: bygg lista av arbetsdagar mellan två datum =====
  function buildWorkDays(startISO, endISO, cal) {
    const out = [];
    let d = startISO;
    let guard = 0;

    while (d <= endISO && guard < 5000) {
      if (isWorkingDayISO(d, cal)) out.push(d);
      d = addDaysISO(d, 1);
      guard++;
    }
    return out;
  }

  // ===== Hjälp: flytta ALLA tasks så de behåller samma arbetsdags-offset från masterStart =====
  function shiftAllTasksByWorkdayOffsets(prevData, nextCalendar) {
    const tasks = prevData.tasks || {};
    const oldCalendar = prevData.calendarId ? prevData.calendars?.[prevData.calendarId] : null;

    // Master-start: använd state om satt, annars master-schedule, annars tidigaste task-start
    const schedulesA = Object.values(prevData.schedules || {});
    const master = schedulesA.find((s) => s?.type === "master");
    const masterStart =
      masterStartISO ||
      (master?.id ? prevData.schedules?.[master.id]?.frame?.start : null) ||
      (() => {
        const starts = Object.values(tasks).map((t) => t?.start).filter(Boolean).sort();
        return starts[0] || null;
      })();

    if (!masterStart) return tasks;

    // Horizon: bygg ett datum långt fram (senaste start + 2 år) så listor räcker
    const allStarts = Object.values(tasks).map((t) => t?.start).filter(Boolean).sort();
    const latestStart = allStarts[allStarts.length - 1] || masterStart;
    const endISO = addDaysISO(latestStart, 730);

    const oldWorkDays = buildWorkDays(masterStart, endISO, oldCalendar);
    const newWorkDays = buildWorkDays(masterStart, endISO, nextCalendar);

    if (oldWorkDays.length === 0 || newWorkDays.length === 0) return tasks;

    const nextTasks = { ...tasks };

    for (const [taskId, t] of Object.entries(tasks)) {
      if (!t?.start) continue;

      // Snappa till nästa arbetsdag i gamla kalendern om start ligger på icke-arbetsdag
      let snap = t.start;
      if (!isWorkingDayISO(snap, oldCalendar)) {
        const i = oldWorkDays.findIndex((d) => d >= snap);
        if (i >= 0) snap = oldWorkDays[i];
      }

      const offset = oldWorkDays.findIndex((d) => d === snap);
      if (offset < 0) continue;

      const newStart = newWorkDays[offset] || snap;
      nextTasks[taskId] = { ...t, start: newStart };
    }

    return nextTasks;
  }

  // ===== Master-start styrande (flytta alla tasks i kalenderdagar) =====
  function onChangeMasterStart(newISO) {
    setMasterStartISO(newISO);

    setDataAndSave((prev) => {
      if (!prev) return prev;

      const schedulesA = Object.values(prev.schedules || {});
      const masterId = findMasterScheduleId(schedulesA, projectId);

      // Om användaren tömmer datum: spara bara (flytta inte tasks)
      if (!newISO) {
        if (!masterId) return prev;

        return {
          ...prev,
          schedules: {
            ...prev.schedules,
            [masterId]: {
              ...prev.schedules[masterId],
              frame: {
                ...(prev.schedules[masterId].frame || {}),
                mode: "manual",
                start: null
              }
            }
          }
        };
      }

      // Flytta från gamla master-start, annars från tidigaste task-start
      const oldISO = (masterId ? prev?.schedules?.[masterId]?.frame?.start : "") || "";
      let baseISO = oldISO;

      if (!baseISO) {
        const starts = Object.values(prev.tasks || {})
          .map((t) => t?.start)
          .filter(Boolean)
          .sort();
        baseISO = starts[0] || newISO;
      }

      const deltaDays = diffDaysISO(baseISO, newISO);

      const nextTasks = { ...(prev.tasks || {}) };
      if (deltaDays !== 0) {
        for (const [taskId, t] of Object.entries(nextTasks)) {
          if (!t?.start) continue;
          nextTasks[taskId] = { ...t, start: addDaysISO(t.start, deltaDays) };
        }
      }

      const next = {
        ...prev,
        tasks: nextTasks
      };

      if (masterId) {
        next.schedules = {
          ...prev.schedules,
          [masterId]: {
            ...prev.schedules[masterId],
            frame: {
              ...(prev.schedules[masterId].frame || {}),
              mode: "manual",
              start: newISO
            }
          }
        };
      }

      return next;
    });
  }

  // ===== Uppdatera workingPattern och flytta alla tasks via arbetsdags-offset =====
  function updateWorkingPattern(patch) {
    const calId = data.calendarId;
    if (!calId) return;

    setDataAndSave((prev) => {
      const current = prev.calendars?.[calId];
      const wp = current?.workingPattern || {
        mon: true,
        tue: true,
        wed: true,
        thu: true,
        fri: true,
        sat: false,
        sun: false
      };

      const nextWp = { ...wp, ...patch };
      const nextCalendar = { ...current, workingPattern: nextWp };

      const nextTasks = shiftAllTasksByWorkdayOffsets(prev, nextCalendar);

      return {
        ...prev,
        tasks: nextTasks,
        calendars: {
          ...prev.calendars,
          [calId]: nextCalendar
        }
      };
    });
  }

  return (
    <div style={{ padding: 16, fontFamily: "Arial, sans-serif", background: "#fff", color: "#111", minHeight: "100vh" }}>
      <h2>Tidplan (Sandbox)</h2>
      <p>
        Projekt-ID: <b>{projectId}</b>
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => {
            resetProjectData(projectId);
            const fresh = createEmptySandboxProject(projectId);
            saveProjectData(projectId, fresh);
            setData(fresh);

            const schedulesArr2 = Object.values(fresh.schedules || {});
            const tradeSchedules2 = schedulesArr2.filter((s) => s.type !== "master");
            setSelectedScheduleIds(tradeSchedules2.map((s) => s.id));

            setMasterStartISO("");
            setNewNonWorkDate("");
            setVacStart("");
            setVacEnd("");
          }}
        >
          Nollställ sandbox
        </button>

        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `tidplan-${projectId}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Exportera JSON
        </button>
      </div>

      {/* MASTER-INFO / INSTÄLLNINGAR */}
      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Masterplan – Inställningar</div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Projektstart (Master)</div>
            <input
              type="date"
              value={masterStartISO || ""}
              onChange={(e) => onChangeMasterStart(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ccc" }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Arbetsdagar (Master)</div>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginRight: 12 }}>
              <input type="checkbox" checked={satIsWork} onChange={(e) => updateWorkingPattern({ sat: e.target.checked })} />
              Lördag är arbetsdag
            </label>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={sunIsWork} onChange={(e) => updateWorkingPattern({ sun: e.target.checked })} />
              Söndag är arbetsdag
            </label>
          </div>
        </div>

        {/* Lediga dagar / semester */}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #eee" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Lediga dagar (Master)</div>

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Enskild ledig dag */}
            <div style={{ minWidth: 300 }}>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Enskild ledig dag</div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="date"
                  value={newNonWorkDate}
                  onChange={(e) => setNewNonWorkDate(e.target.value)}
                  style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ccc" }}
                />

                <button
                  onClick={() => {
                    if (!newNonWorkDate) return;
                    const calId = data.calendarId;
                    if (!calId) return;

                    setDataAndSave((prev) => {
                      const cur = prev.calendars?.[calId];
                      const list = cur?.nonWorkingDates || [];
                      if (list.includes(newNonWorkDate)) return prev;

                      const nextCalendar = {
                        ...cur,
                        nonWorkingDates: [...list, newNonWorkDate].sort()
                      };

                      const nextTasks = shiftAllTasksByWorkdayOffsets(prev, nextCalendar);

                      return {
                        ...prev,
                        tasks: nextTasks,
                        calendars: {
                          ...prev.calendars,
                          [calId]: nextCalendar
                        }
                      };
                    });

                    setNewNonWorkDate("");
                  }}
                >
                  Lägg till
                </button>
              </div>

              {/* Lista enskilda lediga dagar + Ta bort */}
              <div style={{ marginTop: 10, fontSize: 13 }}>
                {(calendar?.nonWorkingDates || []).length === 0 ? (
                  <div style={{ color: "#777" }}>Inga enskilda lediga dagar</div>
                ) : (
                  (calendar?.nonWorkingDates || []).map((d) => (
                    <div
                      key={d}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "2px 0",
                        alignItems: "center"
                      }}
                    >
                      <span>{d}</span>

                      <button
                        onClick={() => {
                          const calId = data.calendarId;
                          if (!calId) return;

                          setDataAndSave((prev) => {
                            const cur = prev.calendars?.[calId];
                            const list = cur?.nonWorkingDates || [];

                            const nextCalendar = {
                              ...cur,
                              nonWorkingDates: list.filter((x) => x !== d)
                            };

                            const nextTasks = shiftAllTasksByWorkdayOffsets(prev, nextCalendar);

                            return {
                              ...prev,
                              tasks: nextTasks,
                              calendars: {
                                ...prev.calendars,
                                [calId]: nextCalendar
                              }
                            };
                          });
                        }}
                      >
                        Ta bort
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Semesterintervall */}
            <div style={{ minWidth: 360 }}>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Semesterintervall</div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="date"
                  value={vacStart}
                  onChange={(e) => setVacStart(e.target.value)}
                  style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ccc" }}
                />
                <span style={{ color: "#666" }}>→</span>
                <input
                  type="date"
                  value={vacEnd}
                  onChange={(e) => setVacEnd(e.target.value)}
                  style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ccc" }}
                />

                <button
                  onClick={() => {
                    if (!vacStart || !vacEnd) return;
                    if (vacEnd < vacStart) return;

                    const calId = data.calendarId;
                    if (!calId) return;

                    setDataAndSave((prev) => {
                      const cur = prev.calendars?.[calId];
                      const ranges = cur?.vacationRanges || [];

                      const nextCalendar = {
                        ...cur,
                        vacationRanges: [...ranges, { start: vacStart, end: vacEnd }]
                      };

                      const nextTasks = shiftAllTasksByWorkdayOffsets(prev, nextCalendar);

                      return {
                        ...prev,
                        tasks: nextTasks,
                        calendars: {
                          ...prev.calendars,
                          [calId]: nextCalendar
                        }
                      };
                    });

                    setVacStart("");
                    setVacEnd("");
                  }}
                >
                  Lägg till
                </button>
              </div>

              {/* Lista semesterintervall + Ta bort */}
              <div style={{ marginTop: 10, fontSize: 13 }}>
                {(calendar?.vacationRanges || []).length === 0 ? (
                  <div style={{ color: "#777" }}>Inga semesterintervall</div>
                ) : (
                  (calendar?.vacationRanges || []).map((r, i) => (
                    <div
                      key={`${r.start}-${r.end}-${i}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "2px 0",
                        alignItems: "center"
                      }}
                    >
                      <span>
                        {r.start} → {r.end}
                      </span>

                      <button
                        onClick={() => {
                          const calId = data.calendarId;
                          if (!calId) return;

                          setDataAndSave((prev) => {
                            const cur = prev.calendars?.[calId];
                            const ranges = cur?.vacationRanges || [];

                            const nextCalendar = {
                              ...cur,
                              vacationRanges: ranges.filter((_, idx) => idx !== i)
                            };

                            const nextTasks = shiftAllTasksByWorkdayOffsets(prev, nextCalendar);

                            return {
                              ...prev,
                              tasks: nextTasks,
                              calendars: {
                                ...prev.calendars,
                                [calId]: nextCalendar
                              }
                            };
                          });
                        }}
                      >
                        Ta bort
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
            Masterplanens slut och total tid räknas automatiskt på hela projektet (alla byggdelar).
          </div>
        </div>
      </div>

      {/* VÄLJ VILKA BYGGDELAR SOM SYNS */}
      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>Visa byggdelar</div>
          <div style={{ display: "flex", gap: 8 }}>
  <button onClick={selectAllTrades}>Visa alla</button>
  <button onClick={clearAllTrades}>Rensa</button>
  <button onClick={addNewTradeSchedule}>+ Ny byggdel</button>
</div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
          {tradeSchedules.map((s) => (
  <div key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <input type="checkbox" checked={selectedScheduleIds.includes(s.id)} onChange={() => toggleSchedule(s.id)} />
      {s.name}
    </label>

    <button
      onClick={() => openScheduleDrawer(s.id)}
      style={{ padding: "2px 8px" }}
      title="Redigera byggdelen"
    >
      ⚙
    </button>

    <button
      onClick={() => deleteSchedule(s.id)}
      style={{ padding: "2px 8px" }}
      title="Radera byggdelen"
    >
      🗑
    </button>
  </div>
))}

        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
          Tips: bocka i Mark + Bygg + Vent samtidigt för att se överlapp.
        </div>
      </div>

      {/* TIDPLANVY */}
      {selectedScheduleIds.length > 0 ? (
        <GanttView
  data={data}
  setData={setDataAndSave}
  selectedScheduleIds={selectedScheduleIds}
  masterStartISO={masterStartISO || null}
  calendar={calendar}
  openTaskId={openTaskId}
  onOpenTaskHandled={() => setOpenTaskId(null)}
/>
      ) : (
        <div style={{ padding: 12, color: "#666" }}>
          Inga byggdelar valda. Bocka i minst en byggdel ovan.
        </div>
      )}

      <p style={{ marginTop: 16 }}>
        Testa ett annat projekt genom att ändra adressen till t.ex.:<br />
        <code>?projectId=220316</code>
      </p>

            <h3>Data (för kontroll)</h3>
      <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 8, overflow: "auto" }}>
        {JSON.stringify(data, null, 2)}
      </pre>

      {/* ===== Byggdel – informationsruta ===== */}
      {scheduleDrawerOpen && selectedScheduleIdForEdit ? (
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
            <div style={{ fontWeight: 800 }}>Byggdel</div>
            <button onClick={closeScheduleDrawer}>Stäng</button>
          </div>

          {(() => {
            const s = data?.schedules?.[selectedScheduleIdForEdit];
            if (!s) return <div style={{ marginTop: 10, color: "#666" }}>Hittar inte byggdelen.</div>;

            return (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Byggdelens namn</div>
                <input
                  value={s.name || ""}
                  onChange={(e) =>
                    setDataAndSave((prev) => {
                      const next = structuredClone(prev);
                      next.schedules[selectedScheduleIdForEdit] = {
                        ...next.schedules[selectedScheduleIdForEdit],
                        name: e.target.value
                      };
                      return next;
                    })
                  }
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
                />

                <div style={{ marginTop: 12, fontSize: 12, color: "#555", marginBottom: 6 }}>Byggdelens färg</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() =>
                        setDataAndSave((prev) => {
                          const next = structuredClone(prev);
                          next.schedules[selectedScheduleIdForEdit] = {
                            ...next.schedules[selectedScheduleIdForEdit],
                            color: c
                          };
                          return next;
                        })
                      }
                      title={c}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: c === (s.color || "") ? "2px solid #111" : "1px solid #ccc",
                        background: c,
                        cursor: "pointer"
                      }}
                    />
                  ))}
                </div>

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #eee" }}>
                  <button
                    onClick={() => deleteSchedule(selectedScheduleIdForEdit)}
                    style={{ width: "100%", padding: "10px 12px" }}
                    title="Radera byggdelen"
                  >
                    🗑 Radera byggdel
                  </button>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                  Radering tar bort byggdelen och alla aktiviteter i byggdelen.
                </div>
              </div>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}

