import React, { useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "./lib/storage";
import { fetchRemoteState, pushRemoteState } from "./lib/cloud";

import OffersPanel from "./panels/OffersPanel.jsx";
import ProjectsPanel from "./panels/ProjectsPanel.jsx";
import ActivitiesCalendarPanel from "./panels/ActivitiesCalendarPanel.jsx";
import SettingsPanel from "./panels/SettingsPanel.jsx";

// Hjälp-funktion för att visa svenskt datum/tid
function formatSwedishDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ===========================
   useStore — lokal + SharePoint
   =========================== */
function useStore() {
  const STORAGE_KEY = "machcrm_data_v3";

  const [state, setState] = useState(() => {
    const s = loadState();
    if (s && typeof s === "object") return s;
    return {
      activities: [],
      entities: [],
      offers: [],
      projects: [],
      _lastSavedAt: "",
    };
  });

  // Lokalt
  useEffect(() => {
    saveState(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  // Push till SharePoint (debounce)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const withVersion = {
          ...state,
          _lastSavedAt: new Date().toISOString(),
        };
        await pushRemoteState(withVersion);
      } catch (e) {
        console.warn("Kunde inte spara till SharePoint:", e);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [state]);

  // Poll från SharePoint
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const remote = await fetchRemoteState();
        if (remote && typeof remote === "object") {
          const lv = state?._lastSavedAt || "";
          const rv = remote?._lastSavedAt || "";
          if (rv && rv !== lv) {
            setState(remote);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
            } catch {}
          }
        }
      } catch {
      } finally {
        if (!stopped) setTimeout(tick, 5000);
      }
    };
    tick();
    return () => {
      stopped = true;
    };
  }, []); // bara första gången

  return [state, setState];
}

/* ======================================
   Färghelpers för kategorier
   ====================================== */
function customerCategoryBadge(cat) {
  const base = "text-xs px-2 py-1 rounded text-white";
  switch (cat) {
    case "StålHall":
    case "Stålhall":
      return `${base} bg-gray-500`; // Grå
    case "Totalentreprenad":
    case "TotalEntreprenad":
      return `${base} bg-orange-500`; // Orange
    case "Turbovex":
      return `${base} bg-blue-500`; // Blå
    case "Övrigt":
      return "text-xs px-2 py-1 rounded bg-white text-gray-700 border";
    default:
      return "text-xs px-2 py-1 rounded bg-gray-100 text-gray-700";
  }
}

function supplierCategoryBadge(cat) {
  const base = "text-xs px-2 py-1 rounded text-white";
  switch (cat) {
    case "Stålhalls leverantör":
      return `${base} bg-gray-500`; // Grå
    case "Mark företag":
      return `${base} bg-amber-800`; // Brun-ish
    case "EL leverantör":
      return `${base} bg-red-500`; // Röd
    case "VVS Leverantör":
      return `${base} bg-purple-500`; // Lila
    case "Vent Leverantör":
      return `${base} bg-blue-500`; // Blå
    case "Bygg":
      return `${base} bg-orange-500`;
    case "Projektering":
      return `${base} bg-yellow-400 text-black`;
    case "Övrigt":
      return "text-xs px-2 py-1 rounded bg-white text-gray-700 border";
    default:
      return "text-xs px-2 py-1 rounded bg-gray-100 text-gray-700";
  }
}

/* ==========================================================
   Aktiviteter — lista + arkiv-läge (NY VERSION)
   ========================================================== */
function ActivitiesPanel({ activities = [], entities = [], setState }) {
  const [respFilter, setRespFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("7"); // today | 7 | all
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | planerad | återkoppling | klar | inställd
  const [mode, setMode] = useState("active"); // active | archive

  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  const customers = useMemo(
    () => (entities || []).filter((e) => e?.type === "customer"),
    [entities]
  );
  const suppliers = useMemo(
    () => (entities || []).filter((e) => e?.type === "supplier"),
    [entities]
  );

  const fmtDateTime = (dateStr, timeStr) => {
    if (!dateStr) return "";
    const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
    try {
      return d.toLocaleString("sv-SE", {
        dateStyle: "medium",
        timeStyle: timeStr ? "short" : undefined,
      });
    } catch {
      return `${dateStr} ${timeStr || ""}`;
    }
  };

  const todayISO = () => {
    const d = new Date();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  };

  const inNext7 = (dateStr, timeStr) => {
    if (!dateStr) return true;

    const today = new Date();
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const end = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 6
    );

    const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
    return d >= start && d <= end;
  };

  const isSameDay = (dateStr, ymd) =>
    !!dateStr && dateStr.slice(0, 10) === ymd;

  const prBadge = (p) => {
    const base = "text-xs px-2 py-1 rounded";
    switch (p) {
      case "hög":
        return `${base} bg-rose-200 text-rose-800`;
      case "medel":
        return `${base} bg-amber-200 text-amber-800`;
      case "låg":
        return `${base} bg-slate-200 text-slate-800`;
      case "klar":
        return `${base} bg-green-200 text-green-800`;
      default:
        return `${base} bg-slate-100 text-slate-700`;
    }
  };

  const statusBadge = (s) => {
    const base = "text-xs px-2 py-1 rounded";
    switch (s) {
      case "planerad":
        return `${base} bg-blue-100 text-blue-800`;
      case "återkoppling":
        return `${base} bg-orange-100 text-orange-800`;
      case "klar":
        return `${base} bg-green-100 text-green-800`;
      case "inställd":
        return `${base} bg-slate-200 text-slate-800`;
      default:
        return `${base} bg-slate-100 text-slate-700`;
    }
  };

  const respLabel = (r) => r || "—";

  // Normaliserad lista med filter
  const visible = useMemo(() => {
    let list = (activities || []).slice();

    if (mode === "active") {
      // ej borttagna
      list = list.filter((a) => !a.deletedAt);
    } else {
      // arkiv-läge
      list = list.filter((a) => !!a.deletedAt);
    }

    if (respFilter !== "all") {
      list = list.filter((a) => (a.responsible || "") === respFilter);
    }

    if (statusFilter !== "all") {
      list = list.filter((a) => (a.status || "planerad") === statusFilter);
    }

    if (dateFilter) {
      list = list.filter((a) =>
        isSameDay(a.dueDate || a.date, dateFilter.slice(0, 10))
      );
    } else if (rangeFilter === "today") {
      const today = todayISO();
      list = list.filter((a) =>
        isSameDay(a.dueDate || a.date, today)
      );
    } else if (rangeFilter === "7") {
      list = list.filter((a) =>
        inNext7(a.dueDate || a.date, a.dueTime || a.time)
      );
    } // rangeFilter === "all" => ingen extra datum-filtrering

    // sortera på datum + tid
    list.sort((a, b) => {
      const da = (a.dueDate || a.date || "") + "T" + (a.dueTime || "");
      const db = (b.dueDate || b.date || "") + "T" + (b.dueTime || "");
      return da.localeCompare(db);
    });

    return list;
  }, [activities, mode, respFilter, statusFilter, rangeFilter, dateFilter]);

  const today = todayISO();

  const overdue = visible.filter(
    (a) =>
      !a.deletedAt &&
      (a.status || "planerad") !== "klar" &&
      (a.dueDate || a.date) &&
      (a.dueDate || a.date) < today
  );

  const todayActivities = visible.filter((a) =>
    isSameDay(a.dueDate || a.date, today)
  );

  const upcoming7 = visible.filter(
    (a) =>
      (a.dueDate || a.date) &&
      (a.dueDate || a.date) > today &&
      inNext7(a.dueDate || a.date, a.dueTime || a.time)
  );

  const ensureDateAndTimes = (obj) => {
    const now = new Date();
    let date = obj.dueDate || obj.date;
    let startTime = obj.dueTime || obj.time;
    let endTime = obj.endTime;

    if (!date) {
      const m = `${now.getMonth() + 1}`.padStart(2, "0");
      const d = `${now.getDate()}`.padStart(2, "0");
      date = `${now.getFullYear()}-${m}-${d}`;
    }

    if (!startTime) {
      // närmaste hel timme, minuter = 00
      const h = `${now.getHours()}`.padStart(2, "0");
      startTime = `${h}:00`;
    }

    if (!endTime && startTime) {
      // default 30 min efter start
      const [hh, mm] = startTime.split(":").map((x) => parseInt(x || "0", 10));
      const startDt = new Date(2000, 0, 1, hh, mm || 0);
      const endDt = new Date(startDt.getTime() + 30 * 60 * 1000);
      const eh = `${endDt.getHours()}`.padStart(2, "0");
      const em = `${endDt.getMinutes()}`.padStart(2, "0");
      endTime = `${eh}:${em}`;
    }

    return {
      ...obj,
      dueDate: date,
      dueTime: startTime,
      endTime,
    };
  };

  const openEdit = (a) => {
    setOpenItem(a);
    setDraft({
      id: a.id,
      title: a.title || "",
      description: a.description || "",
      responsible: a.responsible || "",
      priority: a.priority || "medel",
      status: a.status || "planerad",
      dueDate: a.dueDate || a.date || "",
      dueTime: a.dueTime || a.time || "",
      endTime: a.endTime || "",
      reminder: !!a.reminder,
      customerId: a.customerId || "",
      supplierId: a.supplierId || "",
      contactName: a.contactName || "",
      phone: a.phone || "",
      email: a.email || "",
    });
  };

  const softDelete = (a) => {
    if (
      !window.confirm(
        "Ta bort denna aktivitet? Den hamnar i arkiv (kan återställas via Inställningar)."
      )
    )
      return;

    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((x) =>
        x.id === a.id ? { ...x, deletedAt: new Date().toISOString() } : x
      ),
    }));
    if (openItem?.id === a.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  const Icons = ({ a }) => (
    <div className="flex items-center gap-1 text-sm">
      {a.reminder && (
        <span
          className="inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full bg-yellow-200 text-yellow-900"
          title="Påminnelse"
        >
          ⏰
        </span>
      )}
      {a.responsible && (
        <span
          className="inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full bg-slate-200 text-slate-800"
          title={a.responsible}
        >
          {a.responsible.slice(0, 1)}
        </span>
      )}
    </div>
  );

  const timeRangeLabel = (a) => {
    const date = a.dueDate || a.date;
    if (!date) return "";
    const start = a.dueTime || a.time || "00:00";
    let end = a.endTime;
    if (!end && (a.dueTime || a.time)) {
      const [hh, mm] = start.split(":").map((x) => parseInt(x || "0", 10));
      const startDt = new Date(2000, 0, 1, hh, mm || 0);
      const endDt = new Date(startDt.getTime() + 30 * 60 * 1000);
      const eh = `${endDt.getHours()}`.padStart(2, "0");
      const em = `${endDt.getMinutes()}`.padStart(2, "0");
      end = `${eh}:${em}`;
    }
    if (end) {
      return `${fmtDateTime(date, start)} – ${end}`;
    }
    return fmtDateTime(date, start);
  };

  const createNewDraft = () => {
    const now = new Date();
    const m = `${now.getMonth() + 1}`.padStart(2, "0");
    const d = `${now.getDate()}`.padStart(2, "0");
    const date = `${now.getFullYear()}-${m}-${d}`;
    const h = `${now.getHours()}`.padStart(2, "0");

    const newItem = {
      id: crypto?.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
      title: "",
      description: "",
      responsible: "",
      priority: "medel",
      status: "planerad",
      dueDate: date,
      dueTime: `${h}:00`,
      endTime: "",
      reminder: false,
      customerId: "",
      supplierId: "",
      contactName: "",
      phone: "",
      email: "",
      createdAt: new Date().toISOString(),
    };

    setState((s) => ({
      ...s,
      activities: [...(s.activities || []), newItem],
    }));
    setOpenItem(newItem);
    setDraft(newItem);
  };

  const updateDraft = (key, value) =>
    setDraft((d) => ({
      ...d,
      [key]: value,
    }));

  const applyUpdateAndClose = (mutator) => {
    if (!openItem || !draft) return;
    const merged = ensureDateAndTimes({ ...openItem, ...draft });
    const updated = mutator(merged);

    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((x) =>
        x.id === updated.id ? updated : x
      ),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  const saveAndMarkDone = () =>
    applyUpdateAndClose((obj) => ({
      ...obj,
      priority: "klar",
      status: "klar",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

  const saveAndFollowUp = () =>
    applyUpdateAndClose((obj) => ({
      ...obj,
      status: "återkoppling",
      updatedAt: new Date().toISOString(),
    }));

  const saveOnly = () =>
    applyUpdateAndClose((obj) => ({
      ...obj,
      updatedAt: new Date().toISOString(),
    }));

  return (
    <div className="space-y-4">
      {/* Filterrad */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-600">Ansvarig</label>
          <select
            className="border rounded-xl px-3 py-2"
            value={respFilter}
            onChange={(e) => setRespFilter(e.target.value)}
          >
            <option value="all">Alla</option>
            <option value="Cralle">Cralle</option>
            <option value="Mattias">Mattias</option>
            <option value="Annat">Annat</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Datum</label>
          <input
            type="date"
            className="border rounded-xl px-3 py-2"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600">Tidsspann</label>
          <select
            className="border rounded-xl px-3 py-2"
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value)}
          >
            <option value="today">Idag</option>
            <option value="7">7 dagar</option>
            <option value="all">Alla</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Status</label>
          <select
            className="border rounded-xl px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Alla</option>
            <option value="planerad">Planerad</option>
            <option value="återkoppling">Återkoppling</option>
            <option value="klar">Klar</option>
            <option value="inställd">Inställd</option>
          </select>
        </div>

        <div className="ml-auto flex gap-2">
          <button
            className={`px-3 py-2 rounded-xl border text-sm ${
              mode === "active"
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-700"
            }`}
            onClick={() => setMode("active")}
            type="button"
          >
            Aktiva
          </button>
          <button
            className={`px-3 py-2 rounded-xl border text-sm ${
              mode === "archive"
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-700"
            }`}
            onClick={() => setMode("archive")}
            type="button"
          >
            Arkiv
          </button>
          <button
            className="px-3 py-2 rounded-xl border text-sm bg-gray-200 hover:bg-gray-300"
            onClick={createNewDraft}
            type="button"
          >
            + Ny aktivitet
          </button>
        </div>
      </div>

      {/* Små sammanfattningar – Kommande 7 dagar bara när filtret = Alla */}
      {mode === "active" && rangeFilter === "all" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-700">
          <div className="border rounded-xl p-2">
            <div className="font-semibold mb-1">Försenade</div>
            <div>{overdue.length} st</div>
          </div>
          <div className="border rounded-xl p-2">
            <div className="font-semibold mb-1">Idag</div>
            <div>{todayActivities.length} st</div>
          </div>
          <div className="border rounded-xl p-2">
            <div className="font-semibold mb-1">Kommande 7 dagar</div>
            <div>{upcoming7.length} st</div>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-3">
        {visible.length === 0 && (
          <div className="text-sm text-gray-500">
            Inga aktiviteter matchar filtren.
          </div>
        )}

        {visible.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => openEdit(a)}
            className="w-full text-left border rounded-xl px-3 py-2 flex flex-col gap-1 hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <div className="font-medium truncate">
                {a.title || "(ingen titel)"}
              </div>
              {a.customerId && (
                <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  Kund kopplad
                </span>
              )}
              {a.supplierId && (
                <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                  Leverantör kopplad
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <span className={prBadge(a.priority)}>{a.priority}</span>
                <span className={statusBadge(a.status || "planerad")}>
                  {a.status || "planerad"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Icons a={a} />
              <span className="truncate">
                {timeRangeLabel(a)}
              </span>
              <span className="ml-auto text-[11px] text-gray-500">
                Ansvarig: {respLabel(a.responsible)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Popup */}
      {openItem && draft && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-lg">Redigera aktivitet</div>
              <button
                className="text-sm text-gray-500"
                onClick={() => {
                  setOpenItem(null);
                  setDraft(null);
                }}
                type="button"
              >
                Stäng ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Titel</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.title}
                  onChange={(e) => updateDraft("title", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Prioritet</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.priority}
                  onChange={(e) => updateDraft("priority", e.target.value)}
                >
                  <option value="hög">Hög</option>
                  <option value="medel">Medel</option>
                  <option value="låg">Låg</option>
                  <option value="klar">Klar</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Ansvarig</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.responsible}
                  onChange={(e) =>
                    updateDraft("responsible", e.target.value)
                  }
                >
                  <option value="">—</option>
                  <option value="Cralle">Cralle</option>
                  <option value="Mattias">Mattias</option>
                  <option value="Annat">Annat</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Datum</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={draft.dueDate || ""}
                  onChange={(e) => updateDraft("dueDate", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Starttid</label>
                <input
                  type="time"
                  className="w-full border rounded px-3 py-2"
                  value={draft.dueTime || ""}
                  onChange={(e) => updateDraft("dueTime", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Sluttid</label>
                <input
                  type="time"
                  className="w-full border rounded px-3 py-2"
                  value={draft.endTime || ""}
                  onChange={(e) => updateDraft("endTime", e.target.value)}
                />
              </div>

              <div className="col-span-2 flex items-center gap-2 mt-1">
                <input
                  id="reminder-checkbox"
                  type="checkbox"
                  className="w-4 h-4"
                  checked={!!draft.reminder}
                  onChange={(e) =>
                    updateDraft("reminder", e.target.checked)
                  }
                />
                <label
                  htmlFor="reminder-checkbox"
                  className="text-sm text-gray-700"
                >
                  Påminnelse
                </label>
              </div>

              <div>
                <label className="text-sm font-medium">Kund</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.customerId}
                  onChange={(e) =>
                    updateDraft("customerId", e.target.value)
                  }
                >
                  <option value="">—</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName || c.name || c.id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Leverantör</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.supplierId}
                  onChange={(e) =>
                    updateDraft("supplierId", e.target.value)
                  }
                >
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName || s.name || s.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Kontakt</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.contactName || ""}
                  onChange={(e) =>
                    updateDraft("contactName", e.target.value)
                  }
                  placeholder="Namn på kontaktperson"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Telefon</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.phone || ""}
                  onChange={(e) => updateDraft("phone", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">E-post</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.email || ""}
                  onChange={(e) => updateDraft("email", e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Beskrivning</label>
                <textarea
                  className="w-full border rounded px-3 py-2 min-h-[100px]"
                  value={draft.description || ""}
                  onChange={(e) =>
                    updateDraft("description", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className="px-3 py-2 rounded bg-green-600 text-white"
                onClick={saveAndMarkDone}
                type="button"
              >
                Spara & Markera Klar
              </button>
              <button
                className="px-3 py-2 rounded bg-orange-500 text-white"
                onClick={saveAndFollowUp}
                type="button"
              >
                Spara & Återkoppling
              </button>
              <button
                className="px-3 py-2 rounded bg-rose-600 text-white"
                onClick={() => softDelete(openItem)}
                type="button"
              >
                Ta bort
              </button>
              <button
                className="ml-auto px-3 py-2 rounded border"
                onClick={saveOnly}
                type="button"
              >
                Spara
              </button>
              <button
                className="px-3 py-2 rounded border"
                onClick={() => {
                  setOpenItem(null);
                  setDraft(null);
                }}
                type="button"
              >
                Avbryt utan att spara
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================================
   Kunder
   ====================================== */
function CustomersPanel({ entities = [], setState }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  // Öppna direkt om _shouldOpen är satt
  useEffect(() => {
    const c = (entities || []).find(
      (e) => e.type === "customer" && e._shouldOpen
    );
    if (!c) return;
    setOpenItem(c);
    setDraft({
      id: c.id,
      companyName: c.companyName || "",
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      orgNo: c.orgNo || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      zip: c.zip || "",
      city: c.city || "",
      customerCategory: c.customerCategory || "",
      notes: c.notes || "",
    });
    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === c.id ? { ...e, _shouldOpen: undefined } : e
      ),
    }));
  }, [entities, setState]);

  const list = useMemo(() => {
    let arr = (entities || []).filter(
      (e) => e.type === "customer" && !e.deletedAt
    );

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter(
        (e) =>
          (e.companyName || "").toLowerCase().includes(s) ||
          (e.orgNo || "").toLowerCase().includes(s) ||
          (e.city || "").toLowerCase().includes(s)
      );
    }
    if (cat !== "all") {
      arr = arr.filter((e) => (e.customerCategory || "") === cat);
    }

    // Sortering: 3 senaste med lastUsedAt först, sedan resten alfabetiskt
    const withUsed = arr.filter((e) => !!e.lastUsedAt);
    withUsed.sort((a, b) =>
      (b.lastUsedAt || "").localeCompare(a.lastUsedAt || "")
    );
    const top3 = withUsed.slice(0, 3).map((e) => e.id);

    const topList = arr.filter((e) => top3.includes(e.id));
    const rest = arr.filter((e) => !top3.includes(e.id));
    rest.sort((a, b) =>
      (a.companyName || "").localeCompare(b.companyName || "")
    );

    return [...topList, ...rest];
  }, [entities, q, cat]);

  const openEdit = (c) => {
    // uppdatera lastUsedAt
    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === c.id ? { ...e, lastUsedAt: new Date().toISOString() } : e
      ),
    }));
    setOpenItem(c);
    setDraft({
      id: c.id,
      companyName: c.companyName || "",
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      orgNo: c.orgNo || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      zip: c.zip || "",
      city: c.city || "",
      customerCategory: c.customerCategory || "",
      notes: c.notes || "",
    });
  };

  const updateDraft = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const createSupplierFromCustomer = () => {
    if (!draft) return;
    const id =
      crypto?.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const sup = {
      id,
      type: "supplier",
      companyName: draft.companyName || "",
      firstName: draft.firstName || "",
      lastName: draft.lastName || "",
      orgNo: draft.orgNo || "",
      phone: draft.phone || "",
      email: draft.email || "",
      address: draft.address || "",
      zip: draft.zip || "",
      city: draft.city || "",
      supplierCategory: draft.customerCategory || "",
      notes: draft.notes || "",
      createdAt: new Date().toISOString(),
    };

    setState((s) => ({
      ...s,
      entities: [...(s.entities || []), sup],
    }));

    alert("Leverantör skapad från kunden.");
  };

  const saveDraft = () => {
    if (!draft) return;
    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === draft.id
          ? {
              ...e,
              companyName: draft.companyName || "",
              firstName: draft.firstName || "",
              lastName: draft.lastName || "",
              orgNo: draft.orgNo || "",
              phone: draft.phone || "",
              email: draft.email || "",
              address: draft.address || "",
              zip: draft.zip || "",
              city: draft.city || "",
              customerCategory: draft.customerCategory || "",
              notes: draft.notes || "",
              updatedAt: new Date().toISOString(),
            }
          : e
      ),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  const softDelete = (c) => {
    if (
      !window.confirm(
        "Ta bort denna kund? Den hamnar i arkiv (kan återställas via Inställningar)."
      )
    )
      return;
    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === c.id ? { ...e, deletedAt: new Date().toISOString() } : e
      ),
    }));
    if (openItem?.id === c.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="font-semibold">Kunder</h2>
        <div className="flex gap-2">
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="Sök..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="border rounded-xl px-3 py-2"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="all">Alla kategorier</option>
            <option value="StålHall">Stålhall</option>
            <option value="Totalentreprenad">Totalentreprenad</option>
            <option value="Turbovex">Turbovex</option>
            <option value="Admin">Admin</option>
            <option value="Övrigt">Övrigt</option>
          </select>
        </div>
      </div>

      <ul className="divide-y">
        {list.map((c) => (
          <li key={c.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                onClick={() => openEdit(c)}
                type="button"
              >
                <div className="font-medium truncate">
                  {c.companyName || "(namnlös kund)"}
                  {(c.firstName || c.lastName) && (
                    <span className="text-sm text-gray-500 ml-1">
                      {[
                        c.firstName,
                        c.lastName,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {[c.city || "", c.phone || ""]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className={customerCategoryBadge(c.customerCategory)}>
                  {c.customerCategory || "—"}
                </span>
                <button
                  className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                  onClick={() => softDelete(c)}
                  type="button"
                >
                  Ta bort
                </button>
              </div>
            </div>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-6 text-sm text-gray-500">Inga kunder.</li>
        )}
      </ul>

      {openItem && draft && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => {
            setOpenItem(null);
            setDraft(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow p-4 w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Redigera kund</div>
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
                <label className="text-sm font-medium">Företag</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.companyName}
                  onChange={(e) =>
                    updateDraft("companyName", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Förnamn</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.firstName || ""}
                  onChange={(e) =>
                    updateDraft("firstName", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Efternamn</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.lastName || ""}
                  onChange={(e) =>
                    updateDraft("lastName", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">OrgNr</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.orgNo}
                  onChange={(e) => updateDraft("orgNo", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Telefon</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.phone}
                  onChange={(e) => updateDraft("phone", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Epost</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.email}
                  onChange={(e) => updateDraft("email", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Adress</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.address}
                  onChange={(e) =>
                    updateDraft("address", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Postnr</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.zip}
                  onChange={(e) => updateDraft("zip", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Ort</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.city}
                  onChange={(e) => updateDraft("city", e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Anteckningar</label>
                <textarea
                  className="w-full border rounded px-3 py-2 min-h-[80px]"
                  value={draft.notes || ""}
                  onChange={(e) =>
                    updateDraft("notes", e.target.value)
                  }
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium">Kategori</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={draft.customerCategory}
                    onChange={(e) =>
                      updateDraft("customerCategory", e.target.value)
                    }
                  >
                    <option value="">—</option>
                    <option value="StålHall">Stålhall</option>
                    <option value="Totalentreprenad">
                      Totalentreprenad
                    </option>
                    <option value="Turbovex">Turbovex</option>
                    <option value="Admin">Admin</option>
                    <option value="Övrigt">Övrigt</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="text-xs px-2 py-2 rounded bg-slate-600 text-white whitespace-nowrap"
                  onClick={createSupplierFromCustomer}
                >
                  Gör till leverantör
                </button>
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
                className="px-3 py-2 rounded bg-rose-600 text-white"
                onClick={() => softDelete(openItem)}
                type="button"
              >
                Ta bort
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

/* ======================================
   Leverantörer
   ====================================== */
function SuppliersPanel({ entities = [], setState }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [mode, setMode] = useState("active"); // active | archive
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  // Öppna direkt om _shouldOpen är satt
  useEffect(() => {
    const s = (entities || []).find(
      (e) => e.type === "supplier" && e._shouldOpen
    );
    if (!s) return;
    setOpenItem(s);
    setDraft({
      id: s.id,
      companyName: s.companyName || "",
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      orgNo: s.orgNo || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      zip: s.zip || "",
      city: s.city || "",
      supplierCategory: s.supplierCategory || "",
      notes: s.notes || "",
    });
    setState((st) => ({
      ...st,
      entities: (st.entities || []).map((e) =>
        e.id === s.id ? { ...e, _shouldOpen: undefined } : e
      ),
    }));
  }, [entities, setState]);

  const list = useMemo(() => {
    let arr = (entities || []).filter((e) => e.type === "supplier");
    if (mode === "active") {
      arr = arr.filter((e) => !e.deletedAt);
    } else {
      arr = arr.filter((e) => !!e.deletedAt);
    }

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter(
        (e) =>
          (e.companyName || "").toLowerCase().includes(s) ||
          (e.orgNo || "").toLowerCase().includes(s) ||
          (e.city || "").toLowerCase().includes(s)
      );
    }

    if (cat !== "all") {
      arr = arr.filter((e) => (e.supplierCategory || "") === cat);
    }

    arr.sort((a, b) =>
      (a.companyName || "").localeCompare(b.companyName || "")
    );
    return arr;
  }, [entities, q, cat, mode]);

  const openEdit = (s) => {
    setState((st) => ({
      ...st,
      entities: (st.entities || []).map((e) =>
        e.id === s.id ? { ...e, lastUsedAt: new Date().toISOString() } : e
      ),
    }));
    setOpenItem(s);
    setDraft({
      id: s.id,
      companyName: s.companyName || "",
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      orgNo: s.orgNo || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      zip: s.zip || "",
      city: s.city || "",
      supplierCategory: s.supplierCategory || "",
      notes: s.notes || "",
    });
  };

  const updateDraft = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const createCustomerFromSupplier = () => {
    if (!draft) return;
    const id =
      crypto?.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const c = {
      id,
      type: "customer",
      companyName: draft.companyName || "",
      firstName: draft.firstName || "",
      lastName: draft.lastName || "",
      orgNo: draft.orgNo || "",
      phone: draft.phone || "",
      email: draft.email || "",
      address: draft.address || "",
      zip: draft.zip || "",
      city: draft.city || "",
      customerCategory: draft.supplierCategory || "",
      notes: draft.notes || "",
      createdAt: new Date().toISOString(),
    };

    setState((s) => ({
      ...s,
      entities: [...(s.entities || []), c],
    }));

    alert("Kund skapad från leverantören.");
  };

  const saveDraft = () => {
    if (!draft) return;
    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === draft.id
          ? {
              ...e,
              companyName: draft.companyName || "",
              firstName: draft.firstName || "",
              lastName: draft.lastName || "",
              orgNo: draft.orgNo || "",
              phone: draft.phone || "",
              email: draft.email || "",
              address: draft.address || "",
              zip: draft.zip || "",
              city: draft.city || "",
              supplierCategory: draft.supplierCategory || "",
              notes: draft.notes || "",
              updatedAt: new Date().toISOString(),
            }
          : e
      ),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  const softDelete = (sup) => {
    if (
      !window.confirm(
        "Ta bort denna leverantör? Den hamnar i arkiv (kan återställas via Inställningar)."
      )
    )
      return;
    setState((s0) => ({
      ...s0,
      entities: (s0.entities || []).map((e) =>
        e.id === sup.id ? { ...e, deletedAt: new Date().toISOString() } : e
      ),
    }));
    if (openItem?.id === sup.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  const hardDelete = (sup) => {
    if (
      !window.confirm(
        "Ta bort denna leverantör PERMANENT? Detta går inte att ångra."
      )
    )
      return;
    setState((s0) => ({
      ...s0,
      entities: (s0.entities || []).filter((e) => e.id !== sup.id),
    }));
    if (openItem?.id === sup.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Leverantörer</h2>
          <div className="flex rounded-xl overflow-hidden border">
            <button
              type="button"
              className={`px-3 py-1 text-sm ${
                mode === "active"
                  ? "bg-black text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setMode("active")}
            >
              Aktiva
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-sm ${
                mode === "archive"
                  ? "bg-black text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setMode("archive")}
            >
              Arkiv
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="Sök..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="border rounded-xl px-3 py-2"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="all">Alla kategorier</option>
            <option value="Stålhalls leverantör">
              Stålhalls leverantör
            </option>
            <option value="Mark företag">Mark företag</option>
            <option value="EL leverantör">EL leverantör</option>
            <option value="VVS Leverantör">VVS Leverantör</option>
            <option value="Vent Leverantör">Vent Leverantör</option>
            <option value="Bygg">Bygg</option>
            <option value="Projektering">Projektering</option>
            <option value="Admin">Admin</option>
            <option value="Övrigt">Övrigt</option>
          </select>
        </div>
      </div>

      <ul className="divide-y">
        {list.map((sup) => (
          <li key={sup.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                onClick={() => openEdit(sup)}
                type="button"
              >
                <div className="font-medium truncate">
                  {sup.companyName || "(namnlös leverantör)"}
                  {(sup.firstName || sup.lastName) && (
                    <span className="text-sm text-gray-500 ml-1">
                      {[
                        sup.firstName,
                        sup.lastName,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  )}
                  {mode === "archive" ? " (Arkiv)" : ""}
                </div>
                <div className="text-xs text-gray-500">
                  {[sup.city || "", sup.phone || ""]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <span className={supplierCategoryBadge(sup.supplierCategory)}>
                  {sup.supplierCategory || "—"}
                </span>

                {mode === "active" ? (
                  <button
                    className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                    onClick={() => softDelete(sup)}
                    type="button"
                  >
                    Ta bort
                  </button>
                ) : (
                  <button
                    className="text-xs px-2 py-1 rounded bg-rose-700 text-white"
                    onClick={() => hardDelete(sup)}
                    type="button"
                  >
                    Ta bort permanent
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}

        {list.length === 0 && (
          <li className="py-6 text-sm text-gray-500">
            {mode === "active"
              ? "Inga leverantörer."
              : "Inga arkiverade leverantörer."}
          </li>
        )}
      </ul>

      {openItem && draft && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => {
            setOpenItem(null);
            setDraft(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow p-4 w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Redigera leverantör</div>
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
                <label className="text-sm font-medium">Företag</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.companyName}
                  onChange={(e) =>
                    updateDraft("companyName", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Förnamn</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.firstName || ""}
                  onChange={(e) =>
                    updateDraft("firstName", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Efternamn</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.lastName || ""}
                  onChange={(e) =>
                    updateDraft("lastName", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">OrgNr</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.orgNo}
                  onChange={(e) => updateDraft("orgNo", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Telefon</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.phone}
                  onChange={(e) => updateDraft("phone", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Epost</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.email}
                  onChange={(e) => updateDraft("email", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Adress</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.address}
                  onChange={(e) =>
                    updateDraft("address", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Postnr</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.zip}
                  onChange={(e) => updateDraft("zip", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Ort</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.city}
                  onChange={(e) => updateDraft("city", e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Anteckningar</label>
                <textarea
                  className="w-full border rounded px-3 py-2 min-h-[80px]"
                  value={draft.notes || ""}
                  onChange={(e) =>
                    updateDraft("notes", e.target.value)
                  }
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium">Kategori</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={draft.supplierCategory}
                    onChange={(e) =>
                      updateDraft("supplierCategory", e.target.value)
                    }
                  >
                    <option value="">—</option>
                    <option value="Stålhalls leverantör">
                      Stålhalls leverantör
                    </option>
                    <option value="Mark företag">Mark företag</option>
                    <option value="EL leverantör">EL leverantör</option>
                    <option value="VVS Leverantör">VVS Leverantör</option>
                    <option value="Vent Leverantör">Vent Leverantör</option>
                    <option value="Bygg">Bygg</option>
                    <option value="Projektering">Projektering</option>
                    <option value="Admin">Admin</option>
                    <option value="Övrigt">Övrigt</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="text-xs px-2 py-2 rounded bg-slate-600 text-white whitespace-nowrap"
                  onClick={createCustomerFromSupplier}
                >
                  Gör till kund
                </button>
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
                className="px-3 py-2 rounded bg-rose-600 text-white"
                onClick={() => softDelete(openItem)}
                type="button"
              >
                Ta bort
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

/* ===========================
   App — layout + meny
   =========================== */
export default function App() {
  const [state, setState] = useStore();
  const [view, setView] = useState("activities");
  // views: activities | activitiesCalendar | customers | suppliers | offers | projects | settings

  const lastSyncedIso = state?._lastSavedAt || "";
  const lastSyncedText = lastSyncedIso
    ? formatSwedishDateTime(lastSyncedIso)
    : "Ingen synk ännu";

  const newId = () =>
    crypto?.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  function createActivity() {
    const id = newId();
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const defaultTime = `${hh}:00`;
    const a = {
      id,
      title: "",
      responsible: "Cralle",
      priority: "medium",
      status: "",
      dueDate: "",
      dueTime: defaultTime,
      description: "",
      customerId: "",
      supplierId: "",
      contactName: "",
      isPhone: false,
      isEmail: false,
      isLunch: false,
      isMeeting: false,
      createdAt: new Date().toISOString(),
      _shouldOpen: true,
    };
    setState((s) => ({ ...s, activities: [...(s.activities || []), a] }));
    setView("activities");
  }

  function createOffer() {
    const id = newId();
    const o = {
      id,
      title: "",
      customerId: "",
      value: 0,
      status: "utkast",
      note: "",
      nextActionDate: "",
      files: {
        Ritningar: [],
        Offerter: [],
        Kalkyler: [],
        KMA: [],
      },
      supplierIds: [],
      createdAt: new Date().toISOString(),
      _shouldOpen: true,
    };

    setState((s) => ({ ...s, offers: [...(s.offers || []), o] }));
    setView("offers");
  }

  function createProjectEmpty() {
    const id = newId();
    const p = {
      id,
      name: "",
      customerId: "",
      status: "pågående",
      budget: 0,
      startDate: "",
      endDate: "",
      note: "",
      files: {
        Ritningar: [],
        Offerter: [],
        Kalkyler: [],
        KMA: [],
      },
      createdAt: new Date().toISOString(),
      _shouldOpen: true,
    };

    setState((s) => ({ ...s, projects: [...(s.projects || []), p] }));
    setView("projects");
  }

  function createCustomer() {
    const id = newId();
    const c = {
      id,
      type: "customer",
      companyName: "",
      firstName: "",
      lastName: "",
      notes: "",
      createdAt: new Date().toISOString(),
      customerCategory: "",
      _shouldOpen: true,
    };
    setState((s) => ({ ...s, entities: [...(s.entities || []), c] }));
    setView("customers");
  }

  function createSupplier() {
    const id = newId();
    const sup = {
      id,
      type: "supplier",
      companyName: "",
      firstName: "",
      lastName: "",
      notes: "",
      createdAt: new Date().toISOString(),
      supplierCategory: "",
      _shouldOpen: true,
    };
    setState((s) => ({ ...s, entities: [...(s.entities || []), sup] }));
    setView("suppliers");
  }

  return (
<header className="flex items-center justify-between mb-4 gap-3 flex-wrap">
  <h1 className="text-xl font-semibold">Mach CRM</h1>

  {/* HÖGER DEL – KNAPPAR + SENAST SYNKAD */}
  <div className="flex flex-col items-end gap-1">
    {/* Knapprad */}
    <div className="flex items-center gap-2 flex-wrap">

      <button
        className="border rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300"
        onClick={createActivity}
        title="Skapa ny aktivitet"
        type="button"
      >
        + Ny aktivitet
      </button>

      <button
        className="border rounded-xl px-3 py-2 bg-orange-300 hover:bg-orange-400"
        onClick={createOffer}
        title="Skapa ny offert"
        type="button"
      >
        + Ny offert
      </button>

      <button
        className="border rounded-xl px-3 py-2 bg-green-200 hover:bg-green-300"
        onClick={createProjectEmpty}
        title="Skapa nytt projekt"
        type="button"
      >
        + Nytt projekt
      </button>

      <button
        className="border rounded-xl px-3 py-2 bg-blue-200 hover:bg-blue-300"
        onClick={createCustomer}
        title="Lägg till kund"
        type="button"
      >
        + Ny kund
      </button>

      <button
        className="border rounded-xl px-3 py-2 bg-amber-200 hover:bg-amber-300"
        onClick={createSupplier}
        title="Lägg till leverantör"
        type="button"
      >
        + Ny leverantör
      </button>

      <button
        className="ml-2 border rounded-xl px-3 py-2 hover:bg-gray-50"
        onClick={() => setView("settings")}
        title="Inställningar"
        type="button"
      >
        🛠️
      </button>

    </div>

    {/* NY RAD – SENAST SYNKAD */}
    <div className="text-xs text-gray-500">
      Senast synkad: {lastSyncedText}
    </div>
  </div>
</header>

      {/* NY LAYOUT: menyrad överst, innehåll under */}
      <div className="flex flex-col gap-4">
        {/* Meny-knappar (ersätter sidomenyn) */}
        <div className="flex flex-wrap gap-2">
  {/* Aktiviteter – ljusgrå som + Ny aktivitet */}
  <button
    type="button"
    onClick={() => setView("activities")}
    className={
      "px-3 py-2 rounded-full text-sm border " +
      (view === "activities"
        ? "bg-gray-300 text-black"
        : "bg-gray-200 text-black hover:bg-gray-300")
    }
  >
    Aktiviteter
  </button>

  {/* Kalender – grå */}
  <button
    type="button"
    onClick={() => setView("activitiesCalendar")}
    className={
      "px-3 py-2 rounded-full text-sm border " +
      (view === "activitiesCalendar"
        ? "bg-gray-300 text-black"
        : "bg-gray-200 text-black hover:bg-gray-300")
    }
  >
    Kalender
  </button>

  {/* Kunder – samma ljusblå som + Ny kund */}
  <button
    type="button"
    onClick={() => setView("customers")}
    className={
      "px-3 py-2 rounded-full text-sm border " +
      (view === "customers"
        ? "bg-blue-300 text-black"
        : "bg-blue-200 text-black hover:bg-blue-300")
    }
  >
    Kunder
  </button>

  {/* Leverantörer – samma gul som + Ny leverantör */}
  <button
    type="button"
    onClick={() => setView("suppliers")}
    className={
      "px-3 py-2 rounded-full text-sm border " +
      (view === "suppliers"
        ? "bg-amber-300 text-black"
        : "bg-amber-200 text-black hover:bg-amber-300")
    }
  >
    Leverantörer
  </button>

  {/* Offerter – samma orange som + Ny offert */}
  <button
    type="button"
    onClick={() => setView("offers")}
    className={
      "px-3 py-2 rounded-full text-sm border " +
      (view === "offers"
        ? "bg-orange-400 text-black"
        : "bg-orange-300 text-black hover:bg-orange-400")
    }
  >
    Offerter
  </button>

  {/* Projekt – samma grön som + Nytt projekt */}
  <button
    type="button"
    onClick={() => setView("projects")}
    className={
      "px-3 py-2 rounded-full text-sm border " +
      (view === "projects"
        ? "bg-green-300 text-black"
        : "bg-green-200 text-black hover:bg-green-300")
    }
  >
    Projekt
  </button>
</div>

        {/* Innehåll */}
        <main className="space-y-4">
          {view === "activities" && (
            <ActivitiesPanel
              activities={state.activities || []}
              entities={state.entities || []}
              setState={setState}
            />
          )}

          {view === "activitiesCalendar" && (
            <ActivitiesCalendarPanel
              activities={state.activities || []}
              setState={setState}
              setView={setView}
            />
          )}

          {view === "customers" && (
            <CustomersPanel
              entities={state.entities || []}
              setState={setState}
            />
          )}

          {view === "suppliers" && (
            <SuppliersPanel
              entities={state.entities || []}
              setState={setState}
            />
          )}

          {view === "offers" && (
            <OffersPanel
              offers={state.offers || []}
              entities={state.entities || []}
              setState={setState}
            />
          )}

          {view === "projects" && (
            <ProjectsPanel
              projects={state.projects || []}
              setState={setState}
              entities={state.entities || []}
              offers={state.offers || []}
            />
          )}

          {view === "settings" && (
            <SettingsPanel
              entities={state.entities || []}
              offers={state.offers || []}
              projects={state.projects || []}
              activities={state.activities || []}
              setState={setState}
            />
          )}
        </main>
      </div>
    </div>
  );
}
