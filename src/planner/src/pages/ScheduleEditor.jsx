import { useMemo } from "react";

function scheduleName(data, scheduleId) {
  return data?.schedules?.[scheduleId]?.name || scheduleId;
}

function makeId() {
  return `tsk_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export default function ScheduleEditor({ data, setData, projectId, selectedScheduleId }) {
  const tasks = useMemo(() => {
    const all = Object.values(data.tasks || {});
    return all
      .filter((t) => t.scheduleId === selectedScheduleId)
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  }, [data, selectedScheduleId]);

  function updateTask(taskId, changes) {
    const next = structuredClone(data);
    next.tasks[taskId] = { ...next.tasks[taskId], ...changes };
    setData(next);
  }

  function addTask() {
    const next = structuredClone(data);
    const id = makeId();
    const maxSort = Math.max(0, ...Object.values(next.tasks).map((t) => t.sortIndex ?? 0));
    next.tasks[id] = {
      id,
      scheduleId: selectedScheduleId,
      sortIndex: maxSort + 10,
      name: "Nytt moment",
      note: "",
      dateMode: "WORKDAYS",
      start: new Date().toISOString().slice(0, 10),
      durationWorkdays: 1
    };
    setData(next);
  }

  function deleteTask(taskId) {
    const next = structuredClone(data);
    delete next.tasks[taskId];
    setData(next);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <h3>
        Redigera: <b>{scheduleName(data, selectedScheduleId)}</b>
      </h3>

      <button onClick={addTask}>Lägg till moment</button>

      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table cellPadding="8" style={{ borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th align="left">Namn</th>
              <th align="left">Notering</th>
              <th align="left">Startdatum</th>
              <th align="left">Arbetsdagar</th>
              <th align="left">Ta bort</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid #ddd" }}>
                <td style={{ width: 260 }}>
                  <input
                    style={{ width: "100%" }}
                    value={t.name}
                    onChange={(e) => updateTask(t.id, { name: e.target.value })}
                  />
                </td>

                <td style={{ width: 260 }}>
                  <input
                    style={{ width: "100%" }}
                    value={t.note || ""}
                    onChange={(e) => updateTask(t.id, { note: e.target.value })}
                  />
                </td>

                <td style={{ width: 170 }}>
                  <input
                    type="date"
                    value={t.start}
                    onChange={(e) => updateTask(t.id, { start: e.target.value })}
                  />
                </td>

                <td style={{ width: 140 }}>
                  <input
                    type="number"
                    min="1"
                    value={t.durationWorkdays}
                    onChange={(e) =>
                      updateTask(t.id, { durationWorkdays: Math.max(1, Number(e.target.value || 1)) })
                    }
                    style={{ width: 90 }}
                  />
                </td>

                <td style={{ width: 100 }}>
                  <button onClick={() => deleteTask(t.id)}>Ta bort</button>
                </td>
              </tr>
            ))}

            {tasks.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: 16, color: "#666" }}>
                  Inga moment ännu.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 10, color: "#555" }}>
        Tips: Ändringar sparas i sandboxen när vi kopplar på autospar i nästa steg.
      </p>
    </div>
  );
}