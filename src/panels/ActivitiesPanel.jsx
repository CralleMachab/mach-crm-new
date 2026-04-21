import React, { useEffect, useMemo, useRef, useState } from "react";
import NotesHistory from "../components/NotesHistory.jsx";
import { upsertActivity } from "../lib/storage.js";

export default function ActivitiesPanel({
  activities = [],
  entities = [],
  state,
  setState,
  openActivityId,
  setOpenActivityId,
  openActivitySource,
  setOpenActivitySource,
}) {
  const [respFilter, setRespFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("7"); // today | 7 | all
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | planerad | återkoppling | klar | inställd
  const [mode, setMode] = useState("active"); // active | archive
  const [activityQuery, setActivityQuery] = useState("");

  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);
 useEffect(() => {
  if (!openActivityId) return;

  const a = activities.find((x) => x.id === openActivityId);
  if (!a) return;

  openEdit(a);
}, [openActivityId, activities]);


  // När man klickar + Ny aktivitet i huvudmenyn ökas _newActivityRequestId.
  // Här plockar vi upp den signalen och skapar ett nytt utkast i popupen,
  // utan att lägga till aktiviteten i listan förrän den sparas.
  const newActivityRequestId = state._newActivityRequestId || 0;
  const lastHandledNewIdRef = useRef(0);

  useEffect(() => {
    if (!newActivityRequestId) return;

    // Viktigt: ActivitiesPanel kan monteras först EFTER att huvudmenyn har
    // ökat _newActivityRequestId. Därför får vi inte initiera "last handled"
    // med current value (då missar vi första signalen).
    if (newActivityRequestId === lastHandledNewIdRef.current) return;

    // Skapa ett nytt utkast endast när huvudmenyn uttryckligen begär det.
    // Viktigt: om ActivitiesPanel av-/på-monteras när man navigerar mellan vyer,
    // vill vi INTE att en gammal request-ID ska trigga en ny popup igen.
    // Därför nollställer vi request-ID i global state efter hantering.
    createNewDraft();
    lastHandledNewIdRef.current = newActivityRequestId;
    setState((s) => ({ ...s, _newActivityRequestId: 0 }));
  }, [newActivityRequestId]);

  // Öppna direkt om _shouldOpen är satt (skapad från huvudmenyn)
  useEffect(() => {
    const a = (activities || []).find((x) => x._shouldOpen);
    if (!a) return;
    // Öppna i popup
    openEdit(a);
    // Rensa flaggan så den inte öppnas igen
    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((x) =>
        x.id === a.id ? { ...x, _shouldOpen: undefined } : x
      ),
    }));
  }, [activities, setState]);

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

  const mkId = () =>
    crypto?.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  // Anteckningar (historik) för aktiviteter.
  // Bakåtkompatibilitet: om activity.description finns men notes saknas,
  // gör vi om den till en första anteckning.
  const normalizeNotes = (a) => {
    const raw = Array.isArray(a?.notes) ? a.notes : null;
    if (raw && raw.length) {
      return raw
        .map((n) => ({
          id: n?.id || mkId(),
          date: (n?.date || n?.dateISO || "").slice(0, 10),
          text: n?.text ?? n?.value ?? "",
        }))
        .filter((n) => (n.date || n.text) && typeof n.text === "string");
    }

    const legacyText = a?.description || "";
    if (legacyText && typeof legacyText === "string") {
      const legacyDate = (a?.updatedAt || a?.createdAt || "").slice(0, 10);
      return [{ id: mkId(), date: legacyDate, text: legacyText }];
    }
    return [];
  };

  const addNewNoteOnTop = () => {
    setDraft((d) => {
      const next = {
        id: mkId(),
        date: todayISO(),
        text: "",
      };
      return { ...d, notes: [next, ...(d?.notes || [])] };
    });
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

  const customerLabel = (id) => {
    if (!id) return "";
    const c = customers.find((x) => x.id === id);
    if (!c) return "";
    const parts = [c.companyName, c.firstName, c.lastName].filter(Boolean);
    return parts.join(" ") || "Kund";
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

  const normalizeResponsible = (r) => {
    if (!r) return "";
    if (r === "Annat") return "BÅDA";
    return r;
  };

  const respPillClass = (r) => {
    const base = "px-2 py-0.5 rounded-full text-[11px] font-medium";
    const rr = normalizeResponsible(r);
    if (rr === "Cralle") return base + " bg-blue-500 text-white";
    if (rr === "Mattias") return base + " bg-green-500 text-white";
    if (rr === "BÅDA") return base + " bg-purple-500 text-white";
    if (rr === "Övrigt") return base + " bg-gray-500 text-white";
    return base + " bg-slate-200 text-slate-800";
  };

  const respInitialClass = (r) => {
    const base =
      "inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full";
    const rr = normalizeResponsible(r);
    if (rr === "Cralle") return base + " bg-blue-500 text-white";
    if (rr === "Mattias") return base + " bg-green-500 text-white";
    if (rr === "BÅDA") return base + " bg-purple-500 text-white";
    if (rr === "Övrigt") return base + " bg-gray-500 text-white";
    return base + " bg-slate-200 text-slate-800";
  };

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
      list = list.filter(
        (a) => normalizeResponsible(a.responsible || "") === respFilter
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((a) => (a.status || "planerad") === statusFilter);
    }

    if (dateFilter) {
      list = list.filter((a) =>
        isSameDay(a.nextActionDate || a.dueDate || a.date, dateFilter.slice(0, 10))
      );
    } else if (rangeFilter === "today") {
      const today = todayISO();
      list = list.filter((a) =>
        isSameDay(a.nextActionDate || a.dueDate || a.date, today)
      );
    } else if (rangeFilter === "7") {
      const now = new Date();
      const day = now.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;

      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const start = monday.toISOString().slice(0, 10);
      const end = sunday.toISOString().slice(0, 10);

      list = list.filter((a) => {
        const d = a.nextActionDate || a.dueDate || a.date;
        return d && d >= start && d <= end;
      });
    }

    if (activityQuery.trim()) {
      const s = activityQuery.trim().toLowerCase();
      list = list.filter((a) => {
        const title = (a.title || "").toLowerCase();
        const desc = (a.description || "").toLowerCase();
        const custText = (a.customerId ? customerLabel(a.customerId) : "").toLowerCase();
        return (
          title.includes(s) ||
          desc.includes(s) ||
          custText.includes(s)
        );
      });
    }

    // sortera på datum + tid
    list.sort((a, b) => {
      const da = (a.nextActionDate || a.dueDate || a.date || "") + "T" + (a.dueTime || "");
const db = (b.nextActionDate || b.dueDate || b.date || "") + "T" + (b.dueTime || "");
      return da.localeCompare(db);
    });

    return list;
  }, [
    activities,
    mode,
    respFilter,
    statusFilter,
    rangeFilter,
    dateFilter,
    activityQuery,
  ]);

  const today = todayISO();

const getWeekNumber = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const currentWeek = getWeekNumber();

  const overdue = visible.filter(
    (a) =>
      !a.deletedAt &&
      (a.status || "planerad") !== "klar" &&
      (a.dueDate || a.date) &&
      (a.dueDate || a.date) < today
  );

  // En aktivitet som har passerat dagens datum (och inte är "klar")
  // En aktivitet är försenad om:
// - den inte är arkiverad
// - den inte är "klar"
// - den har ett nästa datum (dueDate)
// - och det datumet har passerat
const isActivityOverdue = (a) => {
  if (!a) return false;
  if (a.deletedAt) return false;
  if ((a.status || "planerad") === "klar") return false;

  if (!a.dueDate) return false; // inget nästa datum = inte försenad

  return a.dueDate < today;
};

  const todayActivities = visible.filter((a) =>
  isSameDay(a.nextActionDate || a.dueDate || a.date, today)
);

  const upcoming7 = visible.filter(
    (a) =>
      (a.nextActionDate || a.dueDate || a.date) &&
(a.nextActionDate || a.dueDate || a.date) > today &&
inNext7(a.nextActionDate || a.dueDate || a.date, a.dueTime || a.time)
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

  const add30Min = (time) => {
    if (!time) return "";
    const [h, m] = time.split(":").map((n) => parseInt(n || "0", 10));
    const d = new Date(2000, 0, 1, h, m || 0);
    d.setMinutes(d.getMinutes() + 30);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const openEdit = (a) => {
    setOpenItem(a);
    const notes = normalizeNotes(a);
    setDraft({
      id: a.id,
      title: a.title || "",
      // Bakåtkompatibilitet: behåll description men redigera via notes
      description: a.description || "",
      notes,
      responsible: normalizeResponsible(a.responsible) || "Cralle",
      priority: a.priority || "medel",
      status: a.status || "planerad",
      dueDate: a.dueDate || a.date || todayISO(),
      dueTime: a.dueTime || a.time || "",
      endTime: a.endTime || "",
      nextActionDate: a.nextActionDate || "",
      reminder: !!a.reminder,
      isPhone: !!a.isPhone,
      isMeeting: !!a.isMeeting,
      isEmail: !!a.isEmail,
      isLunch: !!a.isLunch,
      isDrawing: !!a.isDrawing,
      customerId: a.customerId || "",
      supplierId: a.supplierId || "",
      suppliers: Array.isArray(a.suppliers) ? a.suppliers.map((x)=>({id:x.id, sent:!!x.sent, responded:!!x.responded, sentDate:x.sentDate||""})) : [],
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

    const ts = new Date().toISOString();
    const updated = { ...a, deletedAt: ts };

    setState((s) => {
      const next = { ...s };
      return upsertActivity(next, updated);
    });
    if (openItem?.id === a.id) {
      setOpenItem(null);
      setDraft(null);
      setOpenActivityId(null);
    }
  };

  const Icons = ({ a }) => (
    <div className="flex items-center gap-1 text-sm">
      {isActivityOverdue(a) && (
        <span
          className="inline-flex items-center justify-center w-6 h-6 text-[12px] rounded-full bg-red-600 text-white ring-2 ring-red-300 animate-pulse"
          title="Försenad aktivitet (datum har passerat)"
        >
          ⚠️
        </span>
      )}
      {a.isPhone && (
        <span className="inline-block text-gray-700" title="Telefon">
          📞
        </span>
      )}
      {a.isMeeting && (
        <span className="inline-block text-gray-700" title="Möte">
          📅
        </span>
      )}
      {a.isEmail && (
        <span className="inline-block text-gray-700" title="Mail">
          ✉️
        </span>
      )}
      {a.isLunch && (
        <span className="inline-block text-gray-700" title="Lunch">
          🍽️
        </span>
      )}
      {a.isDrawing && (
        <span className="inline-block text-gray-700" title="Ritning">
          📐
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
          className={respInitialClass(normalizeResponsible(a.responsible))}
          title={normalizeResponsible(a.responsible)}
        >
          {normalizeResponsible(a.responsible).slice(0, 1)}
        </span>
      )}
    </div>
  );

  const timeRangeLabel = (a) => {
    const date = a.nextActionDate || a.dueDate || a.createdAt?.slice(0, 10);
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
      description: "", // legacy
      notes: [{ id: mkId(), date: todayISO(), text: "" }],
      responsible: "Cralle",
      priority: "medel",
      status: "planerad",
      dueDate: date,
      dueTime: `${h}:00`,
      endTime: "",
      nextActionDate: "",
      reminder: false,
      isPhone: false,
      isMeeting: false,
      isEmail: false,
      isLunch: false,
      isDrawing: false,
      customerId: "",
      supplierId: "",
      suppliers: [],
      contactName: "",
      phone: "",
      email: "",
      createdAt: new Date().toISOString(),
    };

    // Lägg INTE till i listan ännu – vänta tills användaren sparar.
    // Vi använder newItem som openItem + draft, och räknar ut i save-funktionerna
    // om posten ska läggas till eller uppdateras.
    setOpenItem(newItem);
    setDraft(newItem);
  };

  const updateDraft = (key, value) =>
    setDraft((d) => ({
      ...d,
      [key]: value,
    }));


  const addSupplierToActivity = (supplierId) => {
    if (!supplierId) return;
    setDraft((d) => {
      const existing = Array.isArray(d?.suppliers) ? d.suppliers : [];
      if (existing.some((x) => x.id === supplierId)) return d;
      return {
        ...d,
        suppliers: [
          ...existing,
          { id: supplierId, sent: false, responded: false, sentDate: "" },
        ],
      };
    });
  };

  const removeSupplierFromActivity = (supplierId) => {
    setDraft((d) => ({
      ...d,
      suppliers: (d.suppliers || []).filter((x) => x.id !== supplierId),
    }));
  };

  const setSupplierFlag = (supplierId, field, value) => {
    const today = new Date().toISOString().slice(0, 10);
    setDraft((d) => ({
      ...d,
      suppliers: (d.suppliers || []).map((x) => {
        if (x.id !== supplierId) return x;
        if (field === "sent") {
          return { ...x, sent: !!value, sentDate: value ? today : "" };
        }
        return { ...x, [field]: !!value };
      }),
    }));
  };

  const applyUpdateAndClose = (mutator) => {
    if (!draft) return;

    // Om vi redigerar en befintlig aktivitet finns openItem.
    // Om vi skapar en ny är openItem null och vi använder draft som bas.
    const base = openItem || {
      id:
        draft.id ||
        (crypto?.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2)),
      createdAt: new Date().toISOString(),
    };

    const merged = ensureDateAndTimes({ ...base, ...draft });

    const finalNotes = (Array.isArray(merged.notes) ? merged.notes : [])
      .map((n) => ({
        id: n?.id || mkId(),
        date: (n?.date || n?.dateISO || "").slice(0, 10),
        text: (n?.text ?? "").toString(),
      }))
      .filter((n) => n.date || n.text);

    const normalized = {
      ...merged,
      // Spara anteckningshistorik
      notes: finalNotes,
      // Bakåtkompatibilitet / sök: håll description synkad med senaste anteckningen
      description: finalNotes.length ? finalNotes[0].text : (merged.description || ""),
      suppliers: (Array.isArray(merged.suppliers) ? merged.suppliers : []).map((x)=>({id:x?.id, sent:!!x?.sent, responded:!!x?.responded, sentDate: x?.sentDate || ""})).filter((x)=>x.id),
      responsible: normalizeResponsible(merged.responsible),
    };
    const updated = mutator(normalized);

    setState((s) => {
      const list = s.activities || [];
      const exists = list.some((x) => x.id === updated.id);
      return {
        ...s,
        activities: exists
          ? list.map((x) => (x.id === updated.id ? updated : x))
          : [...list, updated],
      };
    });

    setOpenItem(null);
    setDraft(null);
    setOpenActivityId(null);
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
            <option value="BÅDA">BÅDA</option>
                  <option value="Övrigt">Övrigt</option>
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
            <option value="7">{`Arbetsvecka v. ${currentWeek}`}</option>
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

        <div>
          <label className="block text-xs text-gray-600">Sök</label>
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="Sök..."
            value={activityQuery}
            onChange={(e) => setActivityQuery(e.target.value)}
          />
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
            <option value="7">{`Arbetsvecka v. ${currentWeek}`}</option>
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
            className={
  "w-full text-left border rounded-xl px-3 py-2 flex flex-col gap-1 hover:bg-gray-50 " +
  ((a.status || "planerad") === "klar"
    ? "border-green-300 bg-green-50 "
    : (a.nextActionDate && a.nextActionDate < today
        ? "border-red-400 bg-red-50 "
        : ""))
}
          >
            <div className="flex items-center gap-2">
              <div className="font-medium truncate">
                {a.title || "(ingen titel)"}
              </div>
              {a.customerId && (
                <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {customerLabel(a.customerId)}
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
              <span className="ml-auto flex items-center gap-1 text-[11px] text-gray-500">
                <span>Ansvarig:</span>
                {a.responsible ? (
                  <span className={respPillClass(a.responsible)}>
                    {normalizeResponsible(a.responsible)}
                  </span>
                ) : (
                  <span>—</span>
                )}
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
  <div>
    <div className="font-semibold text-lg">Redigera aktivitet</div>
    <div className="text-xs text-gray-500">
  Skapad: {draft?.createdAt?.slice(0, 10) || openItem?.createdAt?.slice(0, 10) || "—"}
</div>
  </div>

  <button
    className="text-sm text-gray-500"
    onClick={() => {
      setOpenItem(null);
      setDraft(null);
      setOpenActivityId(null);
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
                  <option value="BÅDA">BÅDA</option>
                  <option value="Övrigt">Övrigt</option>
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
                  onChange={(e) =>
                    setDraft((d) => {
                      const nextStart = e.target.value;
                      const autoEnd = !d.endTime || d.endTime === add30Min(d.dueTime);
                      return {
                        ...d,
                        dueTime: nextStart,
                        endTime: autoEnd ? add30Min(nextStart) : d.endTime,
                      };
                    })
                  }
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


              <div>
                <label className="text-sm font-medium">Nästa händelse</label>
                <input
                  type="date"
                  className={
                    "w-full border rounded px-3 py-2 " +
                    (draft.nextActionDate &&
                    draft.nextActionDate < new Date().toISOString().slice(0, 10)
                      ? "border-red-400 bg-red-50"
                      : "")
                  }
                  value={draft.nextActionDate || ""}
                  onChange={(e) => updateDraft("nextActionDate", e.target.value)}
                />
              </div>

              <div className="col-span-2 flex items-center flex-wrap gap-4 mt-1">
                <label className="flex items-center gap-1 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={!!draft.isPhone}
                    onChange={(e) => updateDraft("isPhone", e.target.checked)}
                  />
                  📞 Telefon
                </label>

                <label className="flex items-center gap-1 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={!!draft.isMeeting}
                    onChange={(e) => updateDraft("isMeeting", e.target.checked)}
                  />
                  📅 Möte
                </label>

                <label className="flex items-center gap-1 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={!!draft.isEmail}
                    onChange={(e) => updateDraft("isEmail", e.target.checked)}
                  />
                  ✉️ Mail
                </label>

                <label className="flex items-center gap-1 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={!!draft.isLunch}
                    onChange={(e) => updateDraft("isLunch", e.target.checked)}
                  />
                  🍽️ Lunch
                </label>


                <label className="flex items-center gap-1 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={!!draft.isDrawing}
                    onChange={(e) => updateDraft("isDrawing", e.target.checked)}
                  />
                  📐 Ritning
                </label>

                <label className="flex items-center gap-1 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={!!draft.reminder}
                    onChange={(e) => updateDraft("reminder", e.target.checked)}
                  />
                  ⏰ Påminnelse
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


              <div className="col-span-2 mt-2">
                <label className="text-sm font-medium">Kopplade leverantörer</label>

                <div className="mt-1 flex items-center gap-2">
                  <select
                    className="flex-1 border rounded px-3 py-2"
                    value=""
                    onChange={(e) => addSupplierToActivity(e.target.value)}
                  >
                    <option value="">+ Lägg till leverantör…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.companyName || s.name || "(namnlös leverantör)"}
                      </option>
                    ))}
                  </select>
                </div>

                {(draft.suppliers || []).length ? (
                  <div className="mt-2 space-y-2">
                    {(draft.suppliers || []).map((row) => {
                      const s = suppliers.find((x) => x.id === row.id);
                      const label = s?.companyName || s?.name || row.id;
                      return (
                        <div
                          key={row.id}
                          className="grid grid-cols-12 gap-2 items-center border rounded-xl p-2"
                        >
                          <div className="col-span-5 text-sm text-gray-800 truncate">
                            {label}
                          </div>

                          <div className="col-span-3 flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="w-4 h-4"
                              checked={!!row.sent}
                              onChange={(e) =>
                                setSupplierFlag(row.id, "sent", e.target.checked)
                              }
                            />
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              Skickad
                            </span>
                            {row.sent && row.sentDate ? (
                              <span className="text-xs text-gray-600">
                                ({row.sentDate})
                              </span>
                            ) : null}
                          </div>

                          <div className="col-span-3 flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="w-4 h-4"
                              checked={!!row.responded}
                              onChange={(e) =>
                                setSupplierFlag(row.id, "responded", e.target.checked)
                              }
                            />
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Återkopplad
                            </span>
                          </div>

                          <div className="col-span-1 text-right">
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                              onClick={() => removeSupplierFromActivity(row.id)}
                              title="Ta bort leverantör"
                            >
                              Ta bort
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-500">
                    Inga leverantörer kopplade.
                  </div>
                )}
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
                <NotesHistory
                  notes={draft.notes || []}
                  onChange={(next) =>
                    setDraft((d) => ({
                      ...d,
                      notes: next,
                    }))
                  }
                />
              </div>

              <div className="col-span-2 mt-4 flex gap-2">
                <button
                  className="px-2 py-1 text-sm rounded bg-green-600 text-white"
                  onClick={saveAndMarkDone}
                  type="button"
                >
                  Spara & Markera Klar
                </button>
                <button
                  className="px-2 py-1 text-sm rounded bg-orange-500 text-white"
                  onClick={saveAndFollowUp}
                  type="button"
                >
                  Spara & Återkoppling
                </button>
                <button
                  className="px-2 py-1 text-sm rounded bg-rose-600 text-white"
                  onClick={() => softDelete(openItem)}
                  type="button"
                >
                  Ta bort
                </button>
                <button
                  className="ml-auto px-2 py-1 text-sm rounded bg-blue-500 text-white"
                  onClick={saveOnly}
                  type="button"
                >
                  Spara
                </button>
                <button
                  className="px-2 py-1 text-sm rounded border"
                  onClick={() => {
                    setOpenItem(null);
                    setDraft(null);
                    setOpenActivityId(null);
                  }}
                  type="button"
                >
                  Avbryt utan att spara
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}