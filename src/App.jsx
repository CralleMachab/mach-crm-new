// src/App.jsx
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
    };
  });

  const [cloudStatus, setCloudStatus] = useState({
    lastSyncedAt: null,
    lastError: null,
  });

  useEffect(() => {
    try {
      saveState(state);
    } catch (err) {
      console.error("Kunde inte spara lokalt", err);
    }
  }, [state]);

  const loadFromCloud = async () => {
    try {
      const remote = await fetchRemoteState();
      if (remote && typeof remote === "object") {
        setState(remote);
        saveState(remote);
        setCloudStatus({
          lastSyncedAt: new Date().toISOString(),
          lastError: null,
        });
      }
    } catch (err) {
      console.error("Fel vid hämtning från moln", err);
      setCloudStatus((s) => ({
        ...s,
        lastError: err?.message || String(err),
      }));
    }
  };

  const pushToCloud = async () => {
    try {
      await pushRemoteState(state);
      setCloudStatus({
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
      });
    } catch (err) {
      console.error("Fel vid uppladdning till moln", err);
      setCloudStatus((s) => ({
        ...s,
        lastError: err?.message || String(err),
      }));
    }
  };

  return [state, setState, cloudStatus, loadFromCloud, pushToCloud];
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
    case "Bygg":
      return `${base} bg-orange-500`; // Orange
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

  const dateOnly = (iso) => {
    if (!iso) return "";
    return iso.slice(0, 10);
  };

  const todayString = () => {
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

    const [year, month, day] = dateStr.split("-").map((x) => parseInt(x, 10));
    const d = new Date(year, (month || 1) - 1, day || 1);

    if (d < start || d > end) return false;

    if (!timeStr) return true;
    return true;
  };

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

  // Öppna nyskapad aktivitet om _shouldOpen är satt (från huvudmenyn)
  useEffect(() => {
    const a = (activities || []).find((x) => x._shouldOpen);
    if (!a) return;

    const withDates = ensureDateAndTimes(a);
    setOpenItem(withDates);
    setDraft(withDates);

    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((x) =>
        x.id === a.id ? { ...x, _shouldOpen: undefined } : x
      ),
    }));
  }, [activities, setState]);

  const Icons = ({ a }) => (
    <div className="flex items-center gap-1 text-sm">
      {a.isPhone && (
        <span
          className="inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full bg-blue-100 text-blue-800"
          title="Telefon"
        >
          📞
        </span>
      )}
      {a.isMeeting && (
        <span
          className="inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full bg-purple-100 text-purple-800"
          title="Möte"
        >
          📅
        </span>
      )}
      {a.isEmail && (
        <span
          className="inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full bg-sky-100 text-sky-800"
          title="Mail"
        >
          ✉️
        </span>
      )}
      {a.isLunch && (
        <span
          className="inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full bg-amber-100 text-amber-800"
          title="Lunch"
        >
          🍽️
        </span>
      )}
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
      return `${date} ${start}–${end}`;
    }
    return `${date} ${start}`;
  };

  const filteredActivities = useMemo(() => {
    let arr = activities || [];

    if (mode === "active") {
      arr = arr.filter((a) => a.status !== "klar" && a.status !== "inställd");
    } else {
      arr = arr.filter((a) => a.status === "klar" || a.status === "inställd");
    }

    if (respFilter !== "all") {
      if (respFilter === "Annat") {
        arr = arr.filter(
          (a) => a.responsible && !["Cralle", "Mattias"].includes(a.responsible)
        );
      } else {
        arr = arr.filter((a) => (a.responsible || "") === respFilter);
      }
    }

    if (statusFilter !== "all") {
      arr = arr.filter((a) => (a.status || "planerad") === statusFilter);
    }

    if (rangeFilter === "today") {
      const t = todayString();
      arr = arr.filter((a) => (a.dueDate || a.date || "") === t);
    } else if (rangeFilter === "7") {
      arr = arr.filter((a) =>
        inNext7(a.dueDate || a.date || "", a.dueTime || a.time || "")
      );
    }

    if (dateFilter) {
      arr = arr.filter((a) => (a.dueDate || a.date || "") === dateFilter);
    }

    arr = arr.map((a) => {
      const d = new Date(a.dueDate || a.date || a.createdAt || Date.now());
      return {
        ...a,
        _sortKey: d.getTime(),
      };
    });

    arr.sort((a, b) => {
      if (a._sortKey !== b._sortKey) {
        return a._sortKey - b._sortKey;
      }
      return (a.title || "").localeCompare(b.title || "");
    });

    return arr;
  }, [activities, respFilter, rangeFilter, dateFilter, statusFilter, mode]);

  const statusLabel = (s) => {
    switch (s || "planerad") {
      case "planerad":
        return "Planerad";
      case "återkoppling":
        return "Återkoppling";
      case "klar":
        return "Klar";
      case "inställd":
        return "Inställd";
      default:
        return s || "Planerad";
    }
  };

  const statusBadge = (s) => {
    const base = "text-xs px-2 py-1 rounded";
    switch (s) {
      case "planerad":
        return `${base} bg-blue-100 text-blue-800`;
      case "återkoppling":
        return `${base} bg-amber-100 text-amber-800`;
      case "klar":
        return `${base} bg-green-100 text-green-800`;
      case "inställd":
        return `${base} bg-red-100 text-red-800`;
      default:
        return `${base} bg-slate-100 text-slate-800`;
    }
  };

  const priorityBadge = (p) => {
    const base = "text-xs px-2 py-1 rounded";
    switch (p || "medel") {
      case "hög":
        return `${base} bg-red-100 text-red-800`;
      case "medel":
        return `${base} bg-amber-100 text-amber-800`;
      case "låg":
        return `${base} bg-slate-200 text-slate-800`;
      case "klar":
        return `${base} bg-green-200 text-green-800`;
      default:
        return `${base} bg-slate-100 text-slate-700`;
    }
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
      isPhone: false,
      isEmail: false,
      isLunch: false,
      isMeeting: false,
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
      activities: (s.activities || []).map((a) =>
        a.id === openItem.id ? { ...a, ...updated } : a
      ),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  const saveOnly = () => {
    applyUpdateAndClose((merged) => merged);
  };

  const saveAndMarkDone = () => {
    applyUpdateAndClose((merged) => ({
      ...merged,
      status: "klar",
      doneAt: new Date().toISOString(),
    }));
  };

  const saveAndFollowUp = () => {
    applyUpdateAndClose((merged) => ({
      ...merged,
      status: "återkoppling",
    }));
  };

  const deleteActivity = () => {
    if (!openItem) return;
    if (!window.confirm("Ta bort denna aktivitet?")) return;
    setState((s) => ({
      ...s,
      activities: (s.activities || []).filter((a) => a.id !== openItem.id),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  const openEdit = (a) => {
    const merged = ensureDateAndTimes(a);
    setOpenItem(merged);
    setDraft({
      id: merged.id,
      title: merged.title || "",
      description: merged.description || "",
      responsible: merged.responsible || "",
      priority: merged.priority || "medel",
      status: merged.status || "planerad",
      dueDate: merged.dueDate || "",
      dueTime: merged.dueTime || "",
      endTime: merged.endTime || "",
      reminder: !!merged.reminder,
      isPhone: !!merged.isPhone,
      isEmail: !!merged.isEmail,
      isLunch: !!merged.isLunch,
      isMeeting: !!merged.isMeeting,
      customerId: merged.customerId || "",
      supplierId: merged.supplierId || "",
      contactName: merged.contactName || "",
      phone: merged.phone || "",
      email: merged.email || "",
    });
  };

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
          <label className="block text-xs text-gray-600">Datumintervall</label>
          <select
            className="border rounded-xl px-3 py-2"
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value)}
          >
            <option value="today">Endast idag</option>
            <option value="7">7 dagar framåt</option>
            <option value="all">Alla datum</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Specifikt datum</label>
          <input
            type="date"
            className="border rounded-xl px-3 py-2"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
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
            className={`px-3 py-2 rounded-xl text-sm ${
              mode === "active"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
            onClick={() => setMode("active")}
            type="button"
          >
            Aktiva
          </button>
          <button
            className={`px-3 py-2 rounded-xl text-sm ${
              mode === "archive"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
            onClick={() => setMode("archive")}
            type="button"
          >
            Arkiv
          </button>
          <button
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm"
            onClick={createNewDraft}
            type="button"
          >
            + Ny aktivitet
          </button>
        </div>
      </div>

      {/* Lista */}
      <ul className="divide-y rounded-xl border bg-white">
        {filteredActivities.map((a) => (
          <li key={a.id} className="p-3 hover:bg-gray-50 transition">
            <div className="flex items-center justify-between gap-3">
              <button
                className="text-left flex-1 min-w-0"
                onClick={() => openEdit(a)}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {a.title || "(Ingen titel)"}
                  </span>
                  <span className={priorityBadge(a.priority || "medel")}>
                    {a.priority || "medel"}
                  </span>
                  <span className={statusBadge(a.status || "planerad")}>
                    {statusLabel(a.status)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>{timeRangeLabel(a)}</span>
                  {a.customerId && (
                    <span>
                      ·{" "}
                      {
                        customers.find((c) => c.id === a.customerId)
                          ?.companyName
                      }
                    </span>
                  )}
                  {a.supplierId && (
                    <span>
                      ·{" "}
                      {
                        suppliers.find((s) => s.id === a.supplierId)
                          ?.companyName
                      }
                    </span>
                  )}
                  {a.contactName && <span>· {a.contactName}</span>}
                </div>
              </button>
              <Icons a={a} />
            </div>
          </li>
        ))}

        {filteredActivities.length === 0 && (
          <li className="p-4 text-center text-gray-500 text-sm">
            Inga aktiviteter matchar filtren.
          </li>
        )}
      </ul>

      {/* Popup för redigering */}
      {openItem && draft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-4 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">
                {draft.title ? "Redigera aktivitet" : "Ny aktivitet"}
              </h2>
              <button
                className="text-sm text-gray-500 hover:text-gray-800"
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
                  value={draft.title || ""}
                  onChange={(e) => updateDraft("title", e.target.value)}
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

              <div>
                <label className="text-sm font-medium">Ansvarig</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.responsible || ""}
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
                <label className="text-sm font-medium">Prioritet</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.priority || "medel"}
                  onChange={(e) =>
                    updateDraft("priority", e.target.value)
                  }
                >
                  <option value="hög">Hög</option>
                  <option value="medel">Medel</option>
                  <option value="låg">Låg</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.status || "planerad"}
                  onChange={(e) => updateDraft("status", e.target.value)}
                >
                  <option value="planerad">Planerad</option>
                  <option value="återkoppling">Återkoppling</option>
                  <option value="klar">Klar</option>
                  <option value="inställd">Inställd</option>
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

              <div className="col-span-2 flex flex-wrap items-center gap-4 mt-1 text-sm">
                <label className="text-xs font-medium text-gray-500">
                  Typ
                </label>

                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={!!draft.isPhone}
                    onChange={(e) =>
                      updateDraft("isPhone", e.target.checked)
                    }
                  />
                  <span title="Telefon">📞</span>
                  <span>Telefon</span>
                </label>

                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={!!draft.isMeeting}
                    onChange={(e) =>
                      updateDraft("isMeeting", e.target.checked)
                    }
                  />
                  <span title="Möte">📅</span>
                  <span>Möte</span>
                </label>

                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={!!draft.isEmail}
                    onChange={(e) =>
                      updateDraft("isEmail", e.target.checked)
                    }
                  />
                  <span title="Mail">✉️</span>
                  <span>Mail</span>
                </label>

                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={!!draft.isLunch}
                    onChange={(e) =>
                      updateDraft("isLunch", e.target.checked)
                    }
                  />
                  <span title="Lunch">🍽️</span>
                  <span>Lunch</span>
                </label>

                <label className="inline-flex items-center gap-1">
                  <input
                    id="reminder-checkbox"
                    type="checkbox"
                    className="w-4 h-4"
                    checked={!!draft.reminder}
                    onChange={(e) =>
                      updateDraft("reminder", e.target.checked)
                    }
                  />
                  <span title="Påminnelse">⏰</span>
                  <span>Påminnelse</span>
                </label>
              </div>

              <div>
                <label className="text-sm font-medium">Kund</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.customerId || ""}
                  onChange={(e) =>
                    updateDraft("customerId", e.target.value)
                  }
                >
                  <option value="">—</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Leverantör</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.supplierId || ""}
                  onChange={(e) =>
                    updateDraft("supplierId", e.target.value)
                  }
                >
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Kontaktperson (namn)
                </label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.contactName || ""}
                  onChange={(e) =>
                    updateDraft("contactName", e.target.value)
                  }
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
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className="px-2 py-1 rounded text-sm bg-green-600 text-white"
                onClick={saveAndMarkDone}
                type="button"
              >
                Spara & Markera Klar
              </button>
              <button
                className="px-2 py-1 rounded text-sm bg-orange-500 text-white"
                onClick={saveAndFollowUp}
                type="button"
              >
                Spara & Återkoppling
              </button>
              <button
                className="px-2 py-1 rounded text-sm bg-rose-600 text-white"
                onClick={deleteActivity}
                type="button"
              >
                Ta bort
              </button>
              <button
                className="ml-auto px-2 py-1 rounded border text-sm"
                onClick={saveOnly}
                type="button"
              >
                Spara
              </button>
              <button
                className="px-2 py-1 rounded border text-sm"
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

/* ==========================================================
   Kunder
   ========================================================== */
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
      arr = arr.filter((e) => {
        const company = (e.companyName || "").toLowerCase();
        const orgNo = (e.orgNo || "").toLowerCase();
        const city = (e.city || "").toLowerCase();
        const first = (e.firstName || "").toLowerCase();
        const last = (e.lastName || "").toLowerCase();
        const full = `${first} ${last}`.trim();

        return (
          company.includes(s) ||
          orgNo.includes(s) ||
          city.includes(s) ||
          first.includes(s) ||
          last.includes(s) ||
          full.includes(s)
        );
      });
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
    const rest = arr
      .filter((e) => !top3.includes(e.id))
      .sort((a, b) => (a.companyName || "").localeCompare(b.companyName || ""));

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

  const createNew = () => {
    const id =
      crypto?.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const c = {
      id,
      type: "customer",
      companyName: "",
      firstName: "",
      lastName: "",
      orgNo: "",
      phone: "",
      email: "",
      address: "",
      zip: "",
      city: "",
      customerCategory: "",
      notes: "",
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      entities: [...(s.entities || []), c],
    }));
    setOpenItem(c);
    setDraft({
      ...c,
    });
  };

  const softDelete = (c) => {
    if (!window.confirm("Arkivera kund?")) return;
    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === c.id ? { ...e, deletedAt: new Date().toISOString() } : e
      ),
    }));
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
      supplierCategory: "",
      notes: draft.notes || "",
      createdAt: new Date().toISOString(),
    };

    setState((s) => ({
      ...s,
      entities: [...(s.entities || []), sup],
    }));

    alert("Leverantör skapad från kunden.");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-600">Sök</label>
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="Företag / namn / orgnr / ort..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600">Kategori</label>
          <select
            className="border rounded-xl px-3 py-2"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="all">Alla kategorier</option>
            <option value="StålHall">Stålhall</option>
            <option value="Totalentreprenad">Totalentreprenad</option>
            <option value="Turbovex">Turbovex</option>
            <option value="Bygg">Bygg</option>
            <option value="Admin">Admin</option>
            <option value="Övrigt">Övrigt</option>
          </select>
        </div>

        <button
          className="ml-auto px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm"
          onClick={createNew}
          type="button"
        >
          + Ny kund
        </button>
      </div>

      <ul className="divide-y rounded-xl border bg-white">
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
                  Arkivera
                </button>
              </div>
            </div>
          </li>
        ))}

        {list.length === 0 && (
          <li className="p-4 text-center text-gray-500 text-sm">
            Inga kunder.
          </li>
        )}
      </ul>

      {openItem && draft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-4 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">
                {draft.companyName || "(namnlös kund)"}
              </h2>
              <button
                className="text-sm text-gray-500 hover:text-gray-800"
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
              <div>
                <label className="text-sm font-medium">Företag</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.companyName || ""}
                  onChange={(e) =>
                    updateDraft("companyName", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Org.nr</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.orgNo || ""}
                  onChange={(e) => updateDraft("orgNo", e.target.value)}
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
                <label className="text-sm font-medium">Adress</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.address || ""}
                  onChange={(e) =>
                    updateDraft("address", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Postnr</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.zip || ""}
                  onChange={(e) => updateDraft("zip", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Ort</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.city || ""}
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
                    <option value="Bygg">Bygg</option>
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
                className="px-3 py-2 rounded border"
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

/* ==========================================================
   Leverantörer
   ========================================================== */
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
      arr = arr.filter((e) => {
        const company = (e.companyName || "").toLowerCase();
        const orgNo = (e.orgNo || "").toLowerCase();
        const city = (e.city || "").toLowerCase();
        const first = (e.firstName || "").toLowerCase();
        const last = (e.lastName || "").toLowerCase();
        const full = `${first} ${last}`.trim();

        return (
          company.includes(s) ||
          orgNo.includes(s) ||
          city.includes(s) ||
          first.includes(s) ||
          last.includes(s) ||
          full.includes(s)
        );
      });
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

  const createNew = () => {
    const id =
      crypto?.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const s = {
      id,
      type: "supplier",
      companyName: "",
      firstName: "",
      lastName: "",
      orgNo: "",
      phone: "",
      email: "",
      address: "",
      zip: "",
      city: "",
      supplierCategory: "",
      notes: "",
      createdAt: new Date().toISOString(),
    };
    setState((st) => ({
      ...st,
      entities: [...(st.entities || []), s],
    }));
    setOpenItem(s);
    setDraft({
      ...s,
    });
  };

  const softDelete = (s) => {
    if (!window.confirm("Arkivera leverantör?")) return;
    setState((st) => ({
      ...st,
      entities: (st.entities || []).map((e) =>
        e.id === s.id ? { ...e, deletedAt: new Date().toISOString() } : e
      ),
    }));
  };

  const saveDraft = () => {
    if (!draft) return;
    setState((st) => ({
      ...st,
      entities: (st.entities || []).map((e) =>
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
      customerCategory: "",
      notes: draft.notes || "",
      createdAt: new Date().toISOString(),
    };

    setState((st) => ({
      ...st,
      entities: [...(st.entities || []), c],
    }));

    alert("Kund skapad från leverantören.");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-600">Sök</label>
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="Företag / namn / orgnr / ort..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600">Kategori</label>
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

        <div className="ml-auto flex gap-2">
          <button
            className={`px-3 py-2 rounded-xl text-sm ${
              mode === "active"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
            onClick={() => setMode("active")}
            type="button"
          >
            Aktiva
          </button>
          <button
            className={`px-3 py-2 rounded-xl text-sm ${
              mode === "archive"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
            onClick={() => setMode("archive")}
            type="button"
          >
            Arkiv
          </button>
          <button
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm"
            onClick={createNew}
            type="button"
          >
            + Ny leverantör
          </button>
        </div>
      </div>

      <ul className="divide-y rounded-xl border bg-white">
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
                </div>
                <div className="text-xs text-gray-500">
                  {[sup.city || "", sup.phone || ""]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={supplierCategoryBadge(sup.supplierCategory)}
                >
                  {sup.supplierCategory || "—"}
                </span>
                <button
                  className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                  onClick={() => softDelete(sup)}
                  type="button"
                >
                  Arkivera
                </button>
              </div>
            </div>
          </li>
        ))}

        {list.length === 0 && (
          <li className="p-4 text-center text-gray-500 text-sm">
            Inga leverantörer.
          </li>
        )}
      </ul>

      {openItem && draft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-4 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">
                {draft.companyName || "(namnlös leverantör)"}
              </h2>
              <button
                className="text-sm text-gray-500 hover:text-gray-800"
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
              <div>
                <label className="text-sm font-medium">Företag</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.companyName || ""}
                  onChange={(e) =>
                    updateDraft("companyName", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Org.nr</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.orgNo || ""}
                  onChange={(e) => updateDraft("orgNo", e.target.value)}
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
                <label className="text-sm font-medium">Adress</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.address || ""}
                  onChange={(e) =>
                    updateDraft("address", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Postnr</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.zip || ""}
                  onChange={(e) => updateDraft("zip", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Ort</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.city || ""}
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
                className="px-3 py-2 rounded border"
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

/* ==========================================================
   Huvud-App
   ========================================================== */
export default function App() {
  const [state, setState, cloudStatus, loadFromCloud, pushToCloud] =
    useStore();
  const [view, setView] = useState("activities");
  // views: activities | activitiesCalendar | customers | suppliers | offers | projects | settings

  const lastSyncedIso = cloudStatus.lastSyncedAt || "";
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
        Ordererkännande: [],
        Beställning: [],
        Övrigt: [],
      },
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, offers: [...(s.offers || []), o] }));
    setView("offers");
  }

  function createProjectFromScratch() {
    const id = newId();
    const p = {
      id,
      title: "",
      customerId: "",
      status: "pågående",
      value: 0,
      note: "",
      files: {
        Ritningar: [],
        Offerter: [],
        Ordererkännande: [],
        Beställning: [],
        Övrigt: [],
      },
      createdAt: new Date().toISOString(),
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
      orgNo: "",
      phone: "",
      email: "",
      address: "",
      zip: "",
      city: "",
      customerCategory: "",
      notes: "",
      createdAt: new Date().toISOString(),
      _shouldOpen: true,
    };
    setState((s) => ({ ...s, entities: [...(s.entities || []), c] }));
    setView("customers");
  }

  function createSupplier() {
    const id = newId();
    const s = {
      id,
      type: "supplier",
      companyName: "",
      firstName: "",
      lastName: "",
      orgNo: "",
      phone: "",
      email: "",
      address: "",
      zip: "",
      city: "",
      supplierCategory: "",
      notes: "",
      createdAt: new Date().toISOString(),
      _shouldOpen: true,
    };
    setState((st) => ({ ...st, entities: [...(st.entities || []), s] }));
    setView("suppliers");
  }

  const activities = state.activities || [];
  const entities = state.entities || [];
  const offers = state.offers || [];
  const projects = state.projects || [];

  return (
    <div className="min-h-screen bg-slate-100 text-gray-900">
      <header className="flex items-center justify-between mb-4 gap-3 flex-wrap p-4 bg-white shadow">
        <h1 className="text-xl font-semibold">Mach CRM</h1>

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
              className="border rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300"
              onClick={createCustomer}
              title="Skapa ny kund"
              type="button"
            >
              + Ny kund
            </button>

            <button
              className="border rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300"
              onClick={createSupplier}
              title="Skapa ny leverantör"
              type="button"
            >
              + Ny leverantör
            </button>

            <button
              className="border rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300"
              onClick={createOffer}
              title="Skapa ny offert"
              type="button"
            >
              + Ny offert
            </button>

            <button
              className="border rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300"
              onClick={createProjectFromScratch}
              title="Skapa nytt projekt"
              type="button"
            >
              + Nytt projekt
            </button>
          </div>

          {/* Sync-info */}
          <div className="text-xs text-right text-gray-500 flex items-center gap-2">
            <span>Molnsynk:</span>
            <span>{lastSyncedText}</span>
            {cloudStatus.lastError && (
              <span className="text-red-600">
                Fel: {cloudStatus.lastError}
              </span>
            )}
            <button
              className="px-2 py-1 border rounded text-xs bg-white hover:bg-gray-50"
              onClick={loadFromCloud}
              type="button"
            >
              Hämta från moln
            </button>
            <button
              className="px-2 py-1 border rounded text-xs bg-white hover:bg-gray-50"
              onClick={pushToCloud}
              type="button"
            >
              Ladda upp till moln
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 pb-4">
        {/* Menyrad */}
        <nav className="mb-4 flex flex-wrap gap-2">
          <button
            className={`px-3 py-2 rounded-xl text-sm ${
              view === "activities"
                ? "bg-blue-600 text-white"
                : "bg-white border text-gray-700"
            }`}
            onClick={() => setView("activities")}
            type="button"
          >
            Aktiviteter (lista)
          </button>
          <button
            className={`px-3 py-2 rounded-xl text-sm ${
              view === "activitiesCalendar"
                ? "bg-blue-600 text-white"
                : "bg-white border text-gray-700"
            }`}
            onClick={() => setView("activitiesCalendar")}
            type="button"
          >
            Aktiviteter (kalender)
          </button>
          <button
            className={`px-3 py-2 rounded-xl text-sm ${
              view === "customers"
                ? "bg-blue-600 text-white"
                : "bg-white border text-gray-700"
            }`}
            onClick={() => setView("customers")}
            type="button"
          >
            Kunder
          </button>
          <button
            className={`px-3 py-2 rounded-xl text-sm ${
              view === "suppliers"
                ? "bg-blue-600 text-white"
                : "bg-white border text-gray-700"
            }`}
            onClick={() => setView("suppliers")}
            type="button"
          >
            Leverantörer
          </button>
          <button
            className={`px-3 py-2 rounded-xl text-sm ${
              view === "offers"
                ? "bg-blue-600 text-white"
                : "bg-white border text-gray-700"
            }`}
            onClick={() => setView("offers")}
            type="button"
          >
            Offerter
          </button>
          <button
            className={`px-3 py-2 rounded-xl text-sm ${
              view === "projects"
                ? "bg-blue-600 text-white"
                : "bg-white border text-gray-700"
            }`}
            onClick={() => setView("projects")}
            type="button"
          >
            Projekt
          </button>
          <button
            className={`px-3 py-2 rounded-xl text-sm ${
              view === "settings"
                ? "bg-blue-600 text-white"
                : "bg-white border text-gray-700"
            }`}
            onClick={() => setView("settings")}
            type="button"
          >
            Export / inställningar
          </button>
        </nav>

        {/* Innehåll */}
        <main className="bg-white rounded-xl shadow p-4">
          {view === "activities" && (
            <ActivitiesPanel
              activities={activities}
              entities={entities}
              setState={setState}
            />
          )}

          {view === "activitiesCalendar" && (
            <ActivitiesCalendarPanel
              activities={activities}
              setState={setState}
              entities={entities}
              setView={setView}
            />
          )}

          {view === "customers" && (
            <CustomersPanel entities={entities} setState={setState} />
          )}

          {view === "suppliers" && (
            <SuppliersPanel entities={entities} setState={setState} />
          )}

          {view === "offers" && (
            <OffersPanel
              offers={offers}
              entities={entities}
              setState={setState}
            />
          )}

          {view === "projects" && (
            <ProjectsPanel
              projects={projects}
              entities={entities}
              setState={setState}
            />
          )}

          {view === "settings" && (
            <SettingsPanel
              activities={activities}
              entities={entities}
              offers={offers}
              projects={projects}
            />
          )}
        </main>
      </div>
    </div>
  );
}
