import React, { useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "./lib/storage";
import { fetchRemoteState, pushRemoteState } from "./lib/cloud";

import OffersPanel from "./panels/OffersPanel.jsx";
import ProjectsPanel from "./panels/ProjectsPanel.jsx";
import ActivitiesCalendarPanel from "./panels/ActivitiesCalendarPanel.jsx";
import SettingsPanel from "./panels/SettingsPanel.jsx";

/* ===========================
   useStore — lokal + SharePoint
   =========================== */
function useStore() {
  const STORAGE_KEY = "machcrm_data_v3";

  const [state, setState] = useState(() => {
    const s = loadState();
    if (s && typeof s === "object") return s;
    return { activities: [], entities: [], offers: [], projects: [] };
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
        const withVersion = { ...state, _lastSavedAt: new Date().toISOString() };
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
      return `${base} bg-gray-500`;          // Grå
    case "Totalentreprenad":
    case "TotalEntreprenad":
      return `${base} bg-orange-500`;        // Orange
    case "Turbovex":
      return `${base} bg-blue-500`;          // Blå
    case "Admin":
      return `${base} bg-green-500`;          // Grön
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
      return `${base} bg-gray-500`;          // Grå
    case "Mark & Betong":
    case "Mark företag":
      return `${base} bg-amber-800`;         // Brun-ish
    case "EL leverantör":
      return `${base} bg-red-500`;           // Röd
    case "VVS Leverantör":
      return `${base} bg-purple-500`;        // Lila
    case "Vent Leverantör":
      return `${base} bg-blue-500`;          // Blå
    case "Bygg":
      return `${base} bg-orange-500`;
    case "Projektering":
      return `${base} bg-yellow-400 text-black`;
    case "Admin":
      return `${base} bg-green-500`;          // Grön
    case "Övrigt":
      return "text-xs px-2 py-1 rounded bg-white text-gray-700 border";
    default:
      return "text-xs px-2 py-1 rounded bg-gray-100 text-gray-700";
  }
}

/* ==========================================================
   Aktiviteter — lista + arkiv-läge
   ========================================================== */
function ActivitiesPanel({ activities = [], entities = [], setState }) {
  const [respFilter,   setRespFilter]   = useState("all");
  const [rangeFilter,  setRangeFilter]  = useState("7");
  const [dateFilter,   setDateFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mode, setMode] = useState("active"); // "active" | "archive"

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

  const fmt = (dateStr, timeStr) => {
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

  const isSameDay = (dateStr, ymd) => !!dateStr && dateStr.slice(0, 10) === ymd;

  const prBadge = (p) => {
    const base = "text-xs px-2 py-1 rounded";
    switch (p) {
      case "klar":
        return `${base} bg-green-200 text-green-800`;
      case "high":
        return `${base} bg-red-100 text-red-700`;
      case "medium":
        return `${base} bg-yellow-100 text-yellow-700`;
      default:
        return `${base} bg-gray-100 text-gray-700`;
    }
  };

  const respChip = (who) => {
    const base = "text-xs font-semibold px-2 py-1 rounded border";
    if (who === "Mattias") return `${base} border-purple-400 text-purple-700`;
    if (who === "Cralle")  return `${base} border-blue-400 text-blue-700`;
    return `${base} border-gray-300 text-gray-700`;
  };

  const statusBadge = (s) => {
    if (!s) return null;
    const base = "text-xs px-2 py-1 rounded";
    if (s === "återkoppling") return `${base} bg-orange-100 text-orange-700`;
    if (s === "klar")         return `${base} bg-green-100 text-green-700`;
    return `${base} bg-gray-100 text-gray-700`;
  };

  const isDone = (a) => a?.priority === "klar" || a?.status === "klar";
  const isFollow = (a) => a?.status === "återkoppling";

  const isOverdue = (a) => {
    if (!a?.dueDate) return false;
    const today = todayISO();
    return a.dueDate < today && !isDone(a);
  };

  // Öppna direkt om _shouldOpen är satt (nyss skapad)
  useEffect(() => {
    const a = (activities || []).find((x) => x?._shouldOpen);
    if (!a) return;
    setOpenItem(a);
    setDraft({
      id: a.id,
      title: a.title || "",
      responsible: a.responsible || "Övrig",
      dueDate: a.dueDate || "",
      dueTime: a.dueTime || "",
      priority: a.priority || "medium",
      status: a.status || "",
      description: a.description || "",
      customerId: a.customerId || "",
      supplierId: a.supplierId || "",
      contactName: a.contactName || "",
      isPhone: !!a.isPhone,
      isEmail: !!a.isEmail,
      isLunch: !!a.isLunch,
      isMeeting: !!a.isMeeting,
    });
    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((x) =>
        x.id === a.id ? { ...x, _shouldOpen: undefined } : x
      ),
    }));
  }, [activities, setState]);

  const list = useMemo(() => {
    let arr = Array.isArray(activities) ? activities.slice() : [];

    if (mode === "active") {
      arr = arr.filter((a) => !a?.deletedAt);
    } else {
      arr = arr.filter((a) => !!a?.deletedAt);
    }

    if (mode === "active") {
      if (statusFilter === "done") {
        arr = arr.filter(isDone);
      } else if (statusFilter === "followup") {
        arr = arr.filter(isFollow);
      } else if (statusFilter === "done_or_followup") {
        arr = arr.filter((a) => isDone(a) || isFollow(a));
      } else if (statusFilter === "all_except_done") {
        arr = arr.filter((a) => !isDone(a));
      } else if (statusFilter === "overdue") {
        arr = arr.filter((a) => isOverdue(a));
      }

      if (respFilter !== "all") {
        arr = arr.filter((a) => (a?.responsible || "Övrig") === respFilter);
      }

      if (rangeFilter === "today") {
        const ymd = todayISO();
        arr = arr.filter((a) => isSameDay(a?.dueDate, ymd));
      } else if (rangeFilter === "7") {
        arr = arr.filter((a) => inNext7(a?.dueDate, a?.dueTime));
      } else if (rangeFilter === "date" && dateFilter) {
        arr = arr.filter((a) => isSameDay(a?.dueDate, dateFilter));
      }
    }

    arr.sort((a, b) => {
      const ad = (a?.dueDate || "") + "T" + (a?.dueTime || "");
      const bd = (b?.dueDate || "") + "T" + (b?.dueTime || "");
      return ad.localeCompare(bd);
    });
    return arr;
  }, [activities, respFilter, rangeFilter, dateFilter, statusFilter, mode]);

  const softDelete = (a) => {
    if (
      !window.confirm(
        "Ta bort denna aktivitet? Den hamnar i Arkiv och kan tas bort permanent därifrån (Inställningar)."
      )
    )
      return;
    const upd = { ...a, deletedAt: new Date().toISOString() };
    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((x) => (x.id === a.id ? upd : x)),
    }));
    if (openItem?.id === a.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  const hardDelete = (a) => {
    if (
      !window.confirm(
        "Ta bort denna aktivitet PERMANENT? Detta går inte att ångra."
      )
    )
      return;
    setState((s) => ({
      ...s,
      activities: (s.activities || []).filter((x) => x.id !== a.id),
    }));
    if (openItem?.id === a.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  const openEdit = (a) => {
    setOpenItem(a);
    setDraft({
      id: a.id,
      title: a.title || "",
      responsible: a.responsible || "Övrig",
      dueDate: a.dueDate || "",
      dueTime: a.dueTime || "",
      priority: a.priority || "medium",
      status: a.status || "",
      description: a.description || "",
      customerId: a.customerId || "",
      supplierId: a.supplierId || "",
      contactName: a.contactName || "",
      isPhone: !!a.isPhone,
      isEmail: !!a.isEmail,
      isLunch: !!a.isLunch,
      isMeeting: !!a.isMeeting,
    });
  };

  const Icons = ({ a }) => (
    <div className="flex items-center gap-1 text-xs text-gray-600">
      {a.isPhone ? <span title="Telefon">📞</span> : null}
      {a.isEmail ? <span title="E-post">✉️</span> : null}
      {a.isLunch ? <span title="Lunch">🥪</span> : null}
      {a.isMeeting ? <span title="Möte">📅</span> : null}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      {/* rubrik + läge (Aktiva/Arkiv) + filter */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Aktiviteter</h2>
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

        {mode === "active" && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-xl overflow-hidden border">
              {[
                { k: "today", label: "Idag" },
                { k: "7",     label: "7 dagar" },
                { k: "all",   label: "Alla" },
              ].map((o) => (
                <button
                  key={o.k}
                  className={`px-3 py-2 ${
                    rangeFilter === o.k
                      ? "bg-black text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setRangeFilter(o.k);
                    if (o.k !== "date") setDateFilter("");
                  }}
                  title={o.label}
                  type="button"
                >
                  {o.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 border rounded-xl px-2 py-1">
              <label className="text-sm">Dag:</label>
              <input
                type="date"
                className="text-sm border rounded px-2 py-1"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setRangeFilter("date");
                }}
              />
              {dateFilter && (
                <button
                  className="text-xs underline"
                  onClick={() => {
                    setDateFilter("");
                    setRangeFilter("all");
                  }}
                  type="button"
                >
                  Rensa datum
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 border rounded-xl px-2 py-1">
              <label className="text-sm">Status:</label>
              <select
                className="text-sm border rounded px-2 py-1"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                title="Filtrera på status"
              >
                <option value="all">Alla</option>
                <option value="done">Endast klara</option>
                <option value="followup">Endast återkoppling</option>
                <option value="done_or_followup">Klara + Återkoppling</option>
                <option value="all_except_done">Alla utom klara</option>
                <option value="overdue">Försenade</option>
              </select>
            </div>

            <div className="flex rounded-xl overflow-hidden border">
              {["all", "Mattias", "Cralle", "Övrig"].map((r) => (
                <button
                  key={r}
                  className={`px-3 py-2 ${
                    respFilter === r
                      ? "bg-black text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => setRespFilter(r)}
                  title={r === "all" ? "Visa alla" : `Visa endast ${r}`}
                  type="button"
                >
                  {r === "all" ? "Alla" : r}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* lista */}
      <ul className="divide-y">
        {list.map((a) => (
          <li key={a.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                onClick={() => openEdit(a)}
                title="Öppna aktiviteten"
                type="button"
              >
                <div className="font-medium truncate">
                  {a.title || "Aktivitet"}
                  {mode === "archive" ? " (Arkiv)" : ""}
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={
                      isOverdue(a)
                        ? "text-xs text-red-600 font-semibold"
                        : "text-xs text-gray-500"
                    }
                  >
                    {fmt(a.dueDate, a.dueTime)}
                    {isOverdue(a) && " (försenad)"}
                  </div>
                  <Icons a={a} />
                </div>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <span className={prBadge(a.priority)}>
                  {a.priority || "normal"}
                </span>
                <span className={respChip(a.responsible)}>
                  {a.responsible || "Övrig"}
                </span>
                {a.status ? (
                  <span className={statusBadge(a.status)}>{a.status}</span>
                ) : null}

                {mode === "active" ? (
                  <button
                    className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                    onClick={() => softDelete(a)}
                    title="Ta bort (flyttas till Arkiv)"
                    type="button"
                  >
                    Ta bort
                  </button>
                ) : (
                  <button
                    className="text-xs px-2 py-1 rounded bg-rose-700 text-white"
                    onClick={() => hardDelete(a)}
                    title="Ta bort permanent"
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
              ? "Inga aktiviteter att visa."
              : "Inga arkiverade aktiviteter."}
          </li>
        )}
      </ul>

      {/* popup */}
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
              <div className="font-semibold">Redigera aktivitet</div>
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
                  placeholder="Vad handlar aktiviteten om?"
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
              <div>
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
                <div className="text-sm font-medium mb-1">Typ</div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!draft.isPhone}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, isPhone: e.target.checked }))
                      }
                    />
                    <span>📞 Telefon</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!draft.isEmail}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, isEmail: e.target.checked }))
                      }
                    />
                    <span>✉️ Mail</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!draft.isLunch}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, isLunch: e.target.checked }))
                      }
                    />
                    <span>🥪 Lunch</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!draft.isMeeting}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, isMeeting: e.target.checked }))
                      }
                    />
                    <span>📅 Möte</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Kund</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.customerId}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, customerId: e.target.value }))
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
                    setDraft((d) => ({ ...d, supplierId: e.target.value }))
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
                  value={draft.contactName}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, contactName: e.target.value }))
                  }
                  placeholder="Namn på kontaktperson"
                />
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Beskrivning</label>
                <textarea
                  className="w-full border rounded px-3 py-2 min-h-[100px]"
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
                onClick={() => {
                  const baseUpd = {
                    ...openItem,
                    ...draft,
                    updatedAt: new Date().toISOString(),
                    priority: "klar",
                    status: "klar",
                    completedAt: new Date().toISOString(),
                  };
                  setState((s) => ({
                    ...s,
                    activities: (s.activities || []).map((x) =>
                      x.id === baseUpd.id ? baseUpd : x
                    ),
                  }));
                  setOpenItem(null);
                  setDraft(null);
                }}
                type="button"
              >
                Spara & Markera Klar
              </button>
              <button
                className="px-3 py-2 rounded bg-orange-500 text-white"
                onClick={() => {
                  const baseUpd = {
                    ...openItem,
                    ...draft,
                    updatedAt: new Date().toISOString(),
                    status: "återkoppling",
                  };
                  setState((s) => ({
                    ...s,
                    activities: (s.activities || []).map((x) =>
                      x.id === baseUpd.id ? baseUpd : x
                    ),
                  }));
                  setOpenItem(null);
                  setDraft(null);
                }}
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
                onClick={() => {
                  const baseUpd = {
                    ...openItem,
                    ...draft,
                    updatedAt: new Date().toISOString(),
                  };
                  setState((s) => ({
                    ...s,
                    activities: (s.activities || []).map((x) =>
                      x.id === baseUpd.id ? baseUpd : x
                    ),
                  }));
                  setOpenItem(null);
                  setDraft(null);
                }}
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
    const c = (entities || []).find((e) => e.type === "customer" && e._shouldOpen);
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
    let arr = (entities || []).filter((e) => e.type === "customer" && !e.deletedAt);

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
                      (
                      {[c.firstName, c.lastName]
                        .filter(Boolean)
                        .join(" ")}
                      )
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {[c.city || "", c.phone || ""].filter(Boolean).join(" · ")}
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
                  onChange={(e) => updateDraft("address", e.target.value)}
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

              <div className="col-span-2">
                <label className="text-sm font-medium">Anteckningar</label>
                <textarea
                  className="w-full border rounded px-3 py-2 min-h-[80px]"
                  value={draft.notes || ""}
                  onChange={(e) => updateDraft("notes", e.target.value)}
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
  const [q, setQ]   = useState("");
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
      arr = arr.filter((e) => {
        const val = e.supplierCategory === "Mark företag"
          ? "Mark & Betong"
          : (e.supplierCategory || "");
        return val === cat;
      });
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
      supplierCategory:
        s.supplierCategory === "Mark företag"
          ? "Mark & Betong"
          : s.supplierCategory || "",
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
            <option value="Mark & Betong">Mark & Betong</option>
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
                      (
                      {[sup.firstName, sup.lastName]
                        .filter(Boolean)
                        .join(" ")}
                      )
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
                  {sup.supplierCategory === "Mark företag"
                    ? "Mark & Betong"
                    : sup.supplierCategory || "—"}
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
                  onChange={(e) => updateDraft("address", e.target.value)}
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
                    <option value="Mark & Betong">Mark & Betong</option>
                    <option value="EL leverantör">EL leverantör</option>
                    <option value="VVS Leverantör">VVS Leverantör</option>
                    <option value="Vent Leverantör">Vent Leverantör</option>
