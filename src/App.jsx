// src/App.jsx
// Ändringar:
// - Sökfältet flyttat ovanför vänstermenyn
// - “Kommande 7 dagar”-ruta i sidomenyn borttagen
// - Liten “Inställningar”-knapp i headern med Export/Import (JSON + CSV)
// - Övrigt oförändrat i funktion

import React, { useEffect, useMemo, useState } from "react";
import { pickOneDriveFiles } from "./components/onedrive";
import { fetchRemoteState, pushRemoteState } from "./lib/cloud";

/* ========== Persistence (localStorage) ========== */
const LS_KEY = "mach_crm_state_v2";
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw
      ? JSON.parse(raw)
      : { entities: [], activities: [], offers: [], projects: [] };
  } catch {
    return { entities: [], activities: [], offers: [], projects: [] };
  }
}
function saveState(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

/* ========== Helpers ========== */
function entityLabel(t) { return t === "customer" ? "Kund" : "Leverantör"; }
function formatDT(dateStr, timeStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
  return d.toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: timeStr ? "short" : undefined });
}
function byName(a,b){ return (a.companyName||"").localeCompare(b.companyName||"","sv"); }

/* ========== Kategorier (oförändrat) ========== */
const CUSTOMER_CATS = [
  { key: "stalhall",         label: "Stålhall",         className: "bg-gray-100 text-gray-800" },
  { key: "totalentreprenad", label: "Totalentreprenad", className: "bg-orange-100 text-orange-800" },
  { key: "turbovex",         label: "Turbovex",         className: "bg-blue-100 text-blue-800" },
];
const SUPPLIER_CATS = [
  { key: "stalhallslev", label: "Stålhalls leverantör", className: "bg-gray-100 text-gray-800" },
  { key: "mark",         label: "Mark företag",         className: "bg-amber-100 text-amber-800" },
  { key: "el",           label: "EL leverantör",        className: "bg-rose-100 text-rose-800" },
  { key: "vvs",          label: "VVS Leverantör",       className: "bg-violet-100 text-violet-800" },
  { key: "vent",         label: "Vent Leverantör",      className: "bg-sky-100 text-sky-800" },
];
function getCategoryBadge(entity) {
  if (entity.type === "customer") {
    const meta = CUSTOMER_CATS.find(c => c.key === entity.customerCategory);
    return meta ? (<span className={`text-xs px-2 py-1 rounded ${meta.className}`}>{meta.label}</span>) : null;
  } else {
    const meta = SUPPLIER_CATS.find(c => c.key === entity.supplierCategory);
    return meta ? (<span className={`text-xs px-2 py-1 rounded ${meta.className}`}>{meta.label}</span>) : null;
  }
}

/* ========== Entities ========== */
function newEntity(type) {
  const id = crypto?.randomUUID?.() || String(Date.now() + Math.random());
  return {
    id, type,
    companyName: "", orgNo: "", phone: "", email: "",
    address: "", zip: "", city: "", notes: "",
    customerCategory: null,
    supplierCategory: null,
    contacts: [], activeContactId: null,
    createdAt: new Date().toISOString(),
  };
}
function upsertEntity(state, e) {
  const i = state.entities.findIndex(x => x.id === e.id);
  if (i === -1) state.entities.push(e); else state.entities[i] = e;
}

/* ========== Activities (oförändrat i logik) ========== */
const ACTIVITY_TYPES = [
  { key: "telefon", label: "Telefon", icon: "📞" },
  { key: "mail",    label: "Mail",    icon: "✉️" },
  { key: "lunch",   label: "Lunch",   icon: "🍽️" },
  { key: "möte",    label: "Möte",    icon: "📅" },
  { key: "uppgift", label: "Uppgift", icon: "📝" },
];
const PRIORITIES = [
  { key: "high",   label: "High",   className: "bg-red-100 text-red-800" },
  { key: "medium", label: "Medium", className: "bg-yellow-100 text-yellow-800" },
  { key: "low",    label: "Low",    className: "bg-sky-100 text-sky-800" },
];
const RESPONSIBLES = ["Cralle", "Mattias", "Övrig"];

function newActivity() {
  const id = crypto?.randomUUID?.() || String(Date.now() + Math.random());
  const now = new Date();
  const isoDate = now.toISOString().slice(0,10);
  return {
    id,
    createdAt: new Date().toISOString(),
    types: [],
    priority: "medium",
    dueDate: isoDate,
    dueTime: "09:00",
    responsible: "Cralle",
    notes: "",
    linkKind: "customer",
    linkId: null,
  };
}
function upsertActivity(state, a) {
  const i = state.activities.findIndex(x => x.id === a.id);
  if (i === -1) state.activities.push(a); else state.activities[i] = a;
}
function withinNext7Days(a) {
  if (!a.dueDate) return false;
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const due = new Date(`${a.dueDate}T${a.dueTime || "00:00"}`);
  return due >= start && due <= end;
}

/* ========== Offers (oförändrat i logik) ========== */
const OFFER_STATUS_META = {
  draft:   { label: "Utkast",   className: "bg-gray-100 text-gray-800" },
  sent:    { label: "Skickad",  className: "bg-orange-100 text-orange-800" },
  won:     { label: "Vunnen",   className: "bg-green-100 text-green-800" },
  lost:    { label: "Förlorad", className: "bg-rose-100 text-rose-800" },
};
function nextOfferNumber(state) {
  const base = 31500;
  const nums = (state.offers||[]).map(o=>o.number||0).filter(n=>n>=base);
  return nums.length? Math.max(...nums)+1 : base;
}
function newOffer(state) {
  const id = crypto?.randomUUID?.() || String(Date.now() + Math.random());
  return {
    id,
    number: nextOfferNumber(state),
    title: "",
    customerId: null,
    supplierItems: [],
    status: "draft",
    reminderDate: "",
    reminderTime: "",
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: null,
    activityId: null,
  };
}
function upsertOffer(state, o) {
  const i = state.offers.findIndex(x => x.id === o.id);
  if (i === -1) state.offers.push(o); else state.offers[i] = o;
}

/* ========== Projects (oförändrat i logik) ========== */
function newProjectFromOffer(offer, _customer) {
  const id = crypto?.randomUUID?.() || String(Date.now() + Math.random());
  return {
    id,
    name: offer?.title || `Projekt #${offer?.number || ""}`,
    customerId: offer?.customerId || null,
    offerId: offer?.id || null,
    status: "Planering",
    startDate: "",
    endDate: "",
    progress: 0,
    description: "",
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
}
function upsertProject(state, p) {
  const i = (state.projects||[]).findIndex(x => x.id === p.id);
  if (i === -1) state.projects.push(p); else state.projects[i] = p;
}

/* ========== Store hook ========== */
// === BEGIN useStore (autospar + realtid mellan flikar via BroadcastChannel + storage + fallback) ===
/* === useStore – SharePoint-synk (skriv direkt, läs via polling) === */
/* === useStore — SharePoint-synk (skriv direkt, läs via polling) === */
/* === useStore — SharePoint-synk (skriv direkt, läs utan att trampa lokala ändringar) === */
function useStore() {
  // Viktigt: måste matcha nyckeln i src/lib/storage.js
  const STORAGE_KEY = "machcrm_data_v3";

  const [state, setState] = useState(() => loadState());

  // 1) Skriv lokalt direkt vid ändring
  useEffect(() => {
    saveState(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  // 2) Skriv till SharePoint efter liten debounce (0.8s)
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

  // 3) Läs från SharePoint periodiskt och ersätt ENDAST om remote är nyare än lokalt
  useEffect(() => {
    let stopped = false;

    const tick = async () => {
      try {
        const remote = await fetchRemoteState();
        if (remote && typeof remote === "object") {
          setState((prev) => {
            // jämför mot SENASTE lokala värdet (inte en gammal closure)
            const lv = prev?._lastSavedAt || "";
            const rv = remote?._lastSavedAt || "";

            // Om remote saknar version → ersätt inte.
            if (!rv) return prev;

            // ISO-tidsstämplar kan jämföras lexikografiskt (“större” är nyare)
            if (rv > lv) {
              try { localStorage.setItem(STORAGE_KEY, JSON.stringify(remote)); } catch {}
              return remote; // remote är nyare → ersätt
            }

            return prev; // lokalt är nyare eller lika → behåll dina ändringar
          });
        }
      } catch {
        // tyst fel → försök igen på nästa tick
      } finally {
        if (!stopped) setTimeout(tick, 5000); // läs var 5:e sekund
      }
    };

    tick();
    return () => { stopped = true; };
  }, []);

  return [state, setState];
}
/* === slut useStore === */

/* === ActivitiesPanel — pop-up vid ny aktivitet, kund/leverantör/kontakt, statusfilter inkl. "Alla utom klara" === */
/* === ActivitiesPanel — pop-up vid ny aktivitet, kund/leverantör/kontakt, statusfilter inkl. "Alla utom klara" === */
function ActivitiesPanel({ activities = [], entities = [], setState }) {
  const [respFilter, setRespFilter]   = useState("all");     // Alla / Mattias / Cralle / Övrig
  const [rangeFilter, setRangeFilter] = useState("7");       // today | 7 | all | date
  const [dateFilter, setDateFilter]   = useState("");        // YYYY-MM-DD när rangeFilter === "date"

  // statusFilter:
  //  - all = visa allt
  //  - done = endast klara (priority === "klar" eller status === "klar")
  //  - followup = endast status "återkoppling"
  //  - done_or_followup = klara + återkoppling
  //  - all_except_done = alla utom klara (efterfrågad)
  const [statusFilter, setStatusFilter] = useState("all");

  const [openItem, setOpenItem] = useState(null); // vald aktivitet i modal
  const [draft, setDraft]       = useState(null); // redigeringskopia

  // Kund/leverantörslistor från entities
  const customers   = useMemo(() => (entities || []).filter(e => e?.type === "customer"), [entities]);
  const suppliers   = useMemo(() => (entities || []).filter(e => e?.type === "supplier"), [entities]);

  const fmt = (dateStr, timeStr) => {
    if (!dateStr) return "";
    const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
    try {
      return d.toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: timeStr ? "short" : undefined });
    } catch { return `${dateStr} ${timeStr || ""}`; }
  };
  const todayISO = () => {
    const d = new Date(); const m = `${d.getMonth()+1}`.padStart(2,"0"); const day = `${d.getDate()}`.padStart(2,"0");
    return `${d.getFullYear()}-${m}-${day}`;
  };
  const inNext7 = (dateStr, timeStr) => {
    if (!dateStr) return true;
    const now = new Date();
    const end7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
    return d >= now && d <= end7;
  };
  const isSameDay = (dateStr, ymd) => !!dateStr && dateStr.slice(0,10) === ymd;

  const prBadge = (p) => {
    const base = "text-xs px-2 py-1 rounded";
    switch (p) {
      case "klar":   return `${base} bg-green-200 text-green-800`;
      case "high":   return `${base} bg-red-100 text-red-700`;
      case "medium": return `${base} bg-yellow-100 text-yellow-700`;
      default:       return `${base} bg-gray-100 text-gray-700`;
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

  // Auto-öppna ny aktivitet markerad med _shouldOpen
  useEffect(() => {
    const a = (activities || []).find(x => x?._shouldOpen);
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
    });
    // plocka bort flaggan så det inte öppnas igen varje render
    setState(s => ({
      ...s,
      activities: (s.activities || []).map(x => x.id === a.id ? { ...x, _shouldOpen: undefined } : x),
    }));
  }, [activities, setState]);

  // Filtrering
  const list = useMemo(() => {
    let arr = Array.isArray(activities) ? activities.slice() : [];
    arr = arr.filter(a => !a?.deletedAt);

    const isDone   = a => (a?.priority === "klar") || (a?.status === "klar");
    const isFollow = a => (a?.status === "återkoppling");

    if (statusFilter === "done") {
      arr = arr.filter(isDone);
    } else if (statusFilter === "followup") {
      arr = arr.filter(isFollow);
    } else if (statusFilter === "done_or_followup") {
      arr = arr.filter(a => isDone(a) || isFollow(a));
    } else if (statusFilter === "all_except_done") {
      arr = arr.filter(a => !isDone(a));
    }
    // "all" = ingen extra statusfiltrering

    if (respFilter !== "all") {
      arr = arr.filter(a => (a?.responsible || "Övrig") === respFilter);
    }

    if (rangeFilter === "today") {
      const ymd = todayISO();
      arr = arr.filter(a => isSameDay(a?.dueDate, ymd));
    } else if (rangeFilter === "7") {
      arr = arr.filter(a => inNext7(a?.dueDate, a?.dueTime));
    } else if (rangeFilter === "date" && dateFilter) {
      arr = arr.filter(a => isSameDay(a?.dueDate, dateFilter));
    }

    arr.sort((a, b) => {
      const ad = (a?.dueDate || "") + "T" + (a?.dueTime || "");
      const bd = (b?.dueDate || "") + "T" + (b?.dueTime || "");
      return ad.localeCompare(bd);
    });
    return arr;
  }, [activities, respFilter, rangeFilter, dateFilter, statusFilter]);

  // Åtgärder
  const markKlar = (a) => {
    const upd = { ...a, priority: "klar", status: "klar", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setState(s => ({ ...s, activities: (s.activities || []).map(x => x.id === a.id ? upd : x) }));
  };
  const markAterkoppling = (a) => {
    const upd = { ...a, status: "återkoppling", updatedAt: new Date().toISOString() };
    setState(s => ({ ...s, activities: (s.activities || []).map(x => x.id === a.id ? upd : x) }));
  };
  const softDelete = (a) => {
    const upd = { ...a, deletedAt: new Date().toISOString() };
    setState(s => ({ ...s, activities: (s.activities || []).map(x => x.id === a.id ? upd : x) }));
    if (openItem?.id === a.id) { setOpenItem(null); setDraft(null); }
  };

  // Redigering
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
    });
  };
  const updateDraft = (field, val) => setDraft(d => ({ ...d, [field]: val }));
  const saveDraft = () => {
    if (!draft) return;
    const upd = {
      ...openItem,
      title: draft.title || "",
      responsible: draft.responsible || "Övrig",
      dueDate: draft.dueDate || "",
      dueTime: draft.dueTime || "",
      priority: draft.priority || "medium",
      status: draft.status || "",
      description: draft.description || "",
      customerId: draft.customerId || "",
      supplierId: draft.supplierId || "",
      contactName: draft.contactName || "",
      updatedAt: new Date().toISOString(),
    };
    setState(s => ({
      ...s,
      activities: (s.activities || []).map(x => x.id === upd.id ? upd : x),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      {/* Header + filter */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="font-semibold">Aktiviteter</h2>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Snabbfilter: Idag / 7 dagar / Alla */}
          <div className="flex rounded-xl overflow-hidden border">
            {[
              {k:"today", label:"Idag"},
              {k:"7",     label:"7 dagar"},
              {k:"all",   label:"Alla"},
            ].map(o => (
              <button
                key={o.k}
                className={`px-3 py-2 ${rangeFilter===o.k ? "bg-black text-white":"bg-white text-gray-700 hover:bg-gray-50"}`}
                onClick={()=>{ setRangeFilter(o.k); if (o.k!=="date") setDateFilter(""); }}
                title={o.label}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Exakt dag */}
          <div className="flex items-center gap-2 border rounded-xl px-2 py-1">
            <label className="text-sm">Dag:</label>
            <input
              type="date"
              className="text-sm border rounded px-2 py-1"
              value={dateFilter}
              onChange={e=>{ setDateFilter(e.target.value); setRangeFilter("date"); }}
            />
            {dateFilter && (
              <button className="text-xs underline" onClick={()=>{ setDateFilter(""); setRangeFilter("all"); }}>
                Rensa datum
              </button>
            )}
          </div>

          {/* Statusfilter inkl. "Alla utom klara" */}
          <div className="flex items-center gap-2 border rounded-xl px-2 py-1">
            <label className="text-sm">Status:</label>
            <select
              className="text-sm border rounded px-2 py-1"
              value={statusFilter}
              onChange={e=>setStatusFilter(e.target.value)}
              title="Filtrera på status"
            >
              <option value="all">Alla</option>
              <option value="done">Endast klara</option>
              <option value="followup">Endast återkoppling</option>
              <option value="done_or_followup">Klara + Återkoppling</option>
              <option value="all_except_done">Alla utom klara</option>
            </select>
          </div>

          {/* Ansvarig-filter */}
          <div className="flex rounded-xl overflow-hidden border">
            {["all","Mattias","Cralle","Övrig"].map(r => (
              <button
                key={r}
                className={`px-3 py-2 ${respFilter===r ? "bg-black text-white":"bg-white text-gray-700 hover:bg-gray-50"}`}
                onClick={()=>setRespFilter(r)}
                title={r==="all" ? "Visa alla" : `Visa endast ${r}`}
              >
                {r==="all" ? "Alla" : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista */}
      <ul className="divide-y">
        {list.map(a => (
          <li key={a.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              {/* Klick öppnar redigeringsmodalen */}
              <button
                className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                onClick={()=>openEdit(a)}
                title="Öppna aktiviteten"
              >
                <div className="font-medium truncate">{a.title || "Aktivitet"}</div>
                <div className="text-xs text-gray-500">{fmt(a.dueDate, a.dueTime)}</div>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <span className={prBadge(a.priority)}>{a.priority || "normal"}</span>
                <span className={respChip(a.responsible)}>{a.responsible || "Övrig"}</span>
                {/* Visa status-chip endast om satt */}
                {a.status ? <span className={statusBadge(a.status)}>{a.status}</span> : null}

                <button className="text-xs px-2 py-1 rounded bg-green-500 text-white" onClick={()=>markKlar(a)} title="Markera som klar">
                  Klar
                </button>
                <button className="text-xs px-2 py-1 rounded bg-orange-400 text-white" onClick={()=>markAterkoppling(a)} title="Återkoppling">
                  Återkoppling
                </button>
                <button className="text-xs px-2 py-1 rounded bg-rose-500 text-white" onClick={()=>softDelete(a)} title="Ta bort (sparas historiskt)">
                  Ta bort
                </button>
              </div>
            </div>
          </li>
        ))}

        {list.length === 0 && (
          <li className="py-6 text-sm text-gray-500">Inga aktiviteter att visa.</li>
        )}
      </ul>

      {/* Redigeringsmodal: inkluderar Titel, Kund, Leverantör, Kontakt */}
      {openItem && draft && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={()=>{ setOpenItem(null); setDraft(null); }}>
          <div className="bg-white rounded-2xl shadow p-4 w-full max-w-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Redigera aktivitet</div>
              <button className="text-sm" onClick={()=>{ setOpenItem(null); setDraft(null); }}>Stäng</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* TITEL */}
              <div className="col-span-2">
                <label className="text-sm font-medium">Titel</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.title}
                  onChange={e=>updateDraft("title", e.target.value)}
                  placeholder="Vad handlar aktiviteten om?"
                />
              </div>

              {/* ANSVARIG */}
              <div>
                <label className="text-sm font-medium">Ansvarig</label>
                <select className="w-full border rounded px-3 py-2" value={draft.responsible} onChange={e=>updateDraft("responsible", e.target.value)}>
                  <option>Mattias</option>
                  <option>Cralle</option>
                  <option>Övrig</option>
                </select>
              </div>

              {/* DATUM/TID */}
              <div>
                <label className="text-sm font-medium">Datum</label>
                <input type="date" className="w-full border rounded px-3 py-2" value={draft.dueDate} onChange={e=>updateDraft("dueDate", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Tid</label>
                <input type="time" className="w-full border rounded px-3 py-2" value={draft.dueTime} onChange={e=>updateDraft("dueTime", e.target.value)} />
              </div>

              {/* PRIORITET/STATUS */}
              <div>
                <label className="text-sm font-medium">Prioritet</label>
                <select className="w-full border rounded px-3 py-2" value={draft.priority} onChange={e=>updateDraft("priority", e.target.value)}>
                  <option value="low">Låg</option>
                  <option value="medium">Normal</option>
                  <option value="high">Hög</option>
                  <option value="klar">Klar</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select className="w-full border rounded px-3 py-2" value={draft.status} onChange={e=>updateDraft("status", e.target.value)}>
                  <option value="">—</option>
                  <option value="återkoppling">Återkoppling</option>
                  <option value="klar">Klar</option>
                </select>
              </div>

              {/* KUND / LEVERANTÖR / KONTAKT */}
              <div>
                <label className="text-sm font-medium">Kund</label>
                <select className="w-full border rounded px-3 py-2" value={draft.customerId} onChange={e=>updateDraft("customerId", e.target.value)}>
                  <option value="">—</option>
                  {customers.map(c => (<option key={c.id} value={c.id}>{c.companyName || c.name || c.id}</option>))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Leverantör</label>
                <select className="w-full border rounded px-3 py-2" value={draft.supplierId} onChange={e=>updateDraft("supplierId", e.target.value)}>
                  <option value="">—</option>
                  {suppliers.map(s => (<option key={s.id} value={s.id}>{s.companyName || s.name || s.id}</option>))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Kontakt</label>
                <input className="w-full border rounded px-3 py-2" value={draft.contactName} onChange={e=>updateDraft("contactName", e.target.value)} placeholder="Namn på kontaktperson" />
              </div>

              {/* BESKRIVNING */}
              <div className="col-span-2">
                <label className="text-sm font-medium">Beskrivning</label>
                <textarea className="w-full border rounded px-3 py-2 min-h-[100px]" value={draft.description} onChange={e=>updateDraft("description", e.target.value)} />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={saveDraft}>
                Spara
              </button>
              <button className="px-3 py-2 rounded bg-rose-500 text-white" onClick={()=>softDelete(openItem)}>
                Ta bort
              </button>
              <button className="ml-auto px-3 py-2 rounded border" onClick={()=>{ setOpenItem(null); setDraft(null); }}>
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* === ActivitiesPanel — dagfilter, “visa klara” (endast klara), redigera befintliga, tydlig titel === */
function ActivitiesPanelNew({ activities = [], entities = [], setState }) {
  const [respFilter, setRespFilter] = useState("all");   // Alla / Mattias / Cralle / Övrig
  const [rangeFilter, setRangeFilter] = useState("7");   // "today" | "7" | "all" | "date"
  const [dateFilter, setDateFilter] = useState("");      // YYYY-MM-DD när rangeFilter === "date"
  const [showDoneOnly, setShowDoneOnly] = useState(false);
  const [openItem, setOpenItem] = useState(null);        // aktiv aktivitet i redigeringsmodal
  const [draft, setDraft] = useState(null);              // kopia för redigering

  // Hjälpare
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
    const d = new Date(); const m = `${d.getMonth()+1}`.padStart(2,"0"); const day = `${d.getDate()}`.padStart(2,"0");
    return `${d.getFullYear()}-${m}-${day}`;
  };
  const inNext7 = (dateStr, timeStr) => {
    if (!dateStr) return true; // utan datum: visa
    const now = new Date();
    const end7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
    return d >= now && d <= end7;
  };
  const isSameDay = (dateStr, ymd) => !!dateStr && dateStr.slice(0,10) === ymd;

  // Badgefärger
  const prBadge = (p) => {
    const base = "text-xs px-2 py-1 rounded";
    switch (p) {
      case "klar":   return `${base} bg-green-200 text-green-800`;
      case "high":   return `${base} bg-red-100 text-red-700`;
      case "medium": return `${base} bg-yellow-100 text-yellow-700`;
      default:       return `${base} bg-gray-100 text-gray-700`;
    }
  };
  const respChip = (who) => {
    const base = "text-xs font-semibold px-2 py-1 rounded border";
    if (who === "Mattias") return `${base} border-purple-400 text-purple-700`;
    if (who === "Cralle")  return `${base} border-blue-400 text-blue-700`;
    return `${base} border-gray-300 text-gray-700`;
  };

  // Filtrera lista
  const list = useMemo(() => {
    let arr = Array.isArray(activities) ? activities.slice() : [];
    // mjuk-raderade ska inte visas
    arr = arr.filter(a => !a?.deletedAt);

    // Visa endast klara om togglad
    if (showDoneOnly) {
      arr = arr.filter(a => (a?.priority || "") === "klar");
    } else {
      // annars: exkludera klara
      arr = arr.filter(a => (a?.priority || "") !== "klar");
    }

    // Filter på ansvarig
    if (respFilter !== "all") {
      arr = arr.filter(a => (a?.responsible || "Övrig") === respFilter);
    }

    // Tidsfilter
    if (rangeFilter === "today") {
      const ymd = todayISO();
      arr = arr.filter(a => isSameDay(a?.dueDate, ymd));
    } else if (rangeFilter === "7") {
      arr = arr.filter(a => inNext7(a?.dueDate, a?.dueTime));
    } else if (rangeFilter === "date" && dateFilter) {
      arr = arr.filter(a => isSameDay(a?.dueDate, dateFilter));
    } // "all" = ingen extra filter

    // Sortera på datum + tid
    arr.sort((a, b) => {
      const ad = (a?.dueDate || "") + "T" + (a?.dueTime || "");
      const bd = (b?.dueDate || "") + "T" + (b?.dueTime || "");
      return ad.localeCompare(bd);
    });

    return arr;
  }, [activities, respFilter, rangeFilter, dateFilter, showDoneOnly]);

  // Åtgärder
  const markKlar = (a) => {
    const upd = {
      ...a,
      priority: "klar",
      status: "klar",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setState(s => ({
      ...s,
      activities: (s.activities || []).map(x => x.id === a.id ? upd : x),
    }));
  };
  const markAterkoppling = (a) => {
    const upd = { ...a, status: "återkoppling", updatedAt: new Date().toISOString() };
    setState(s => ({
      ...s,
      activities: (s.activities || []).map(x => x.id === a.id ? upd : x),
    }));
  };
  const softDelete = (a) => {
    const upd = { ...a, deletedAt: new Date().toISOString() };
    setState(s => ({
      ...s,
      activities: (s.activities || []).map(x => x.id === a.id ? upd : x),
    }));
    if (openItem?.id === a.id) setOpenItem(null);
  };

  // Öppna/redigera befintlig aktivitet
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
      description: a.description || ""
    });
  };
  const updateDraft = (field, val) => setDraft(d => ({ ...d, [field]: val }));
  const saveDraft = () => {
    if (!draft) return;
    const upd = {
      ...openItem,
      title: draft.title || "",
      responsible: draft.responsible || "Övrig",
      dueDate: draft.dueDate || "",
      dueTime: draft.dueTime || "",
      priority: draft.priority || "medium",
      status: draft.status || "",
      description: draft.description || "",
      updatedAt: new Date().toISOString()
    };
    setState(s => ({
      ...s,
      activities: (s.activities || []).map(x => x.id === upd.id ? upd : x),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      {/* Header + filter */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="font-semibold">Aktiviteter</h2>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Snabbfilter: Idag / 7 dagar / Alla */}
          <div className="flex rounded-xl overflow-hidden border">
            {[
              {k:"today", label:"Idag"},
              {k:"7", label:"7 dagar"},
              {k:"all", label:"Alla"},
            ].map(o => (
              <button
                key={o.k}
                className={`px-3 py-2 ${rangeFilter===o.k ? "bg-black text-white":"bg-white text-gray-700 hover:bg-gray-50"}`}
                onClick={()=>{ setRangeFilter(o.k); if (o.k!=="date") setDateFilter(""); }}
                title={o.label}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Exakt dag */}
          <div className="flex items-center gap-2 border rounded-xl px-2 py-1">
            <label className="text-sm">Dag:</label>
            <input
              type="date"
              className="text-sm border rounded px-2 py-1"
              value={dateFilter}
              onChange={e=>{ setDateFilter(e.target.value); setRangeFilter("date"); }}
            />
            {dateFilter && (
              <button className="text-xs underline" onClick={()=>{ setDateFilter(""); setRangeFilter("all"); }}>
                Rensa datum
              </button>
            )}
          </div>

          {/* Visa endast klara */}
          <label className="inline-flex items-center gap-2 text-sm border rounded-xl px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDoneOnly}
              onChange={e=>setShowDoneOnly(e.target.checked)}
            />
            Visa endast klara
          </label>

          {/* Ansvarig-filter */}
          <div className="flex rounded-xl overflow-hidden border">
            {["all","Mattias","Cralle","Övrig"].map(r => (
              <button
                key={r}
                className={`px-3 py-2 ${respFilter===r ? "bg-black text-white":"bg-white text-gray-700 hover:bg-gray-50"}`}
                onClick={()=>setRespFilter(r)}
                title={r==="all" ? "Visa alla" : `Visa endast ${r}`}
              >
                {r==="all" ? "Alla" : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista */}
      <ul className="divide-y">
        {list.map(a => (
          <li key={a.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              {/* Klick öppnar redigeringsvy */}
              <button
                className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                onClick={()=>openEdit(a)}
                title="Öppna aktiviteten"
              >
                <div className="font-medium truncate">{a.title || "Aktivitet"}</div>
                <div className="text-xs text-gray-500">{fmt(a.dueDate, a.dueTime)}</div>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <span className={prBadge(a.priority)}>{a.priority || "normal"}</span>
                <span className={respChip(a.responsible)}>{a.responsible || "Övrig"}</span>

                <button
                  className="text-xs px-2 py-1 rounded bg-green-500 text-white"
                  title="Markera som klar"
                  onClick={()=>markKlar(a)}
                >
                  Klar
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-orange-400 text-white"
                  title="Återkoppling"
                  onClick={()=>markAterkoppling(a)}
                >
                  Återkoppling
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                  title="Ta bort (sparas som historik)"
                  onClick={()=>softDelete(a)}
                >
                  Ta bort
                </button>
              </div>
            </div>
          </li>
        ))}

        {list.length === 0 && (
          <li className="py-6 text-sm text-gray-500">Inga aktiviteter att visa.</li>
        )}
      </ul>

      {/* Redigeringsmodal (samma struktur som vid skapande, med TITEL högst upp) */}
      {openItem && draft && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={()=>{ setOpenItem(null); setDraft(null); }}>
          <div className="bg-white rounded-2xl shadow p-4 w-full max-w-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Redigera aktivitet</div>
              <button className="text-sm" onClick={()=>{ setOpenItem(null); setDraft(null); }}>Stäng</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* TITEL överst (tydligt) */}
              <div className="col-span-2">
                <label className="text-sm font-medium">Titel</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.title}
                  onChange={e=>updateDraft("title", e.target.value)}
                  placeholder="Vad handlar aktiviteten om?"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Ansvarig</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.responsible}
                  onChange={e=>updateDraft("responsible", e.target.value)}
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
                  onChange={e=>updateDraft("dueDate", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Tid</label>
                <input
                  type="time"
                  className="w-full border rounded px-3 py-2"
                  value={draft.dueTime}
                  onChange={e=>updateDraft("dueTime", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Prioritet</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.priority}
                  onChange={e=>updateDraft("priority", e.target.value)}
                >
                  <option value="low">Låg</option>
                  <option value="medium">Normal</option>
                  <option value="high">Hög</option>
                  <option value="klar">Klar</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Status</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.status}
                  onChange={e=>updateDraft("status", e.target.value)}
                  placeholder="t.ex. 'återkoppling'"
                />
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Beskrivning</label>
                <textarea
                  className="w-full border rounded px-3 py-2 min-h-[100px]"
                  value={draft.description}
                  onChange={e=>updateDraft("description", e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={saveDraft}>
                Spara ändringar
              </button>
              <button className="px-3 py-2 rounded bg-rose-500 text-white" onClick={()=>softDelete(openItem)}>
                Ta bort
              </button>
              <button className="ml-auto px-3 py-2 rounded border" onClick={()=>{ setOpenItem(null); setDraft(null); }}>
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OffersPanel({ offers, entities, onOpen }) {
  const getCustomer = (id) => (entities || []).find((e) => e.id === id);
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Offerter</h2>
      </div>
      {offers.length === 0 ? (
        <div className="text-sm text-gray-500">Inga offerter ännu.</div>
      ) : (
        <ul className="divide-y">
          {offers.map((o) => {
            const cust = getCustomer(o.customerId);
            const meta = OFFER_STATUS_META[o.status || "draft"] || OFFER_STATUS_META.draft;
            return (
              <li key={o.id} className="py-3 px-2 hover:bg-gray-50 rounded-xl cursor-pointer" onClick={() => onOpen(o.id)}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">#{o.number} — {o.title || "(Projekt saknas)"}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {cust ? cust.companyName : "—"} • {new Date(o.createdAt).toLocaleDateString("sv-SE")}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${meta.className}`}>{meta.label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProjectsPanel({ projects, wonOffers, entities, onOpen, onCreateFromOffer }) {
  const getCustomer = (id) => (entities || []).find((e) => e.id === id);
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Vunna offerter</h2>
        </div>
        {wonOffers.length === 0 ? (
          <div className="text-sm text-gray-500">Inga vunna offerter ännu.</div>
        ) : (
          <ul className="divide-y">
            {wonOffers.map((o) => {
              const cust = getCustomer(o.customerId);
              return (
                <li key={o.id} className="py-3 px-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">#{o.number} — {o.title || "(Projekt saknas)"}</div>
                    <div className="text-xs text-gray-500 truncate">{cust ? cust.companyName : "—"}</div>
                  </div>
                  <button className="border rounded-xl px-3 py-2" onClick={()=>onCreateFromOffer(o)}>Skapa projekt</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Projekt</h2>
        </div>
        {projects.length === 0 ? (
          <div className="text-sm text-gray-500">Inga projekt ännu.</div>
        ) : (
          <ul className="divide-y">
            {projects.map((p) => {
              const cust = getCustomer(p.customerId);
              return (
                <li key={p.id} className="py-3 px-2 hover:bg-gray-50 rounded-xl cursor-pointer" onClick={() => onOpen(p.id)}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name || "(namn saknas)"}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {cust ? cust.companyName : "—"} • {p.status || ""}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {p.startDate || "—"} → {p.endDate || "—"} ({p.progress||0}%)
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ========== Settings (Export/Import) ========== */
function SettingsPanel({ state, setState }) {
  // Export
  function exportJSON() {
    downloadText(`mach-crm-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(state, null, 2));
  }
  function exportCSV() {
    // kunder
    const customers = (state.entities||[]).filter(e=>e.type==="customer").slice().sort(byName);
    const suppliers = (state.entities||[]).filter(e=>e.type==="supplier").slice().sort(byName);

    const headers = [
      { label:"Typ",           get:r=>r.type },
      { label:"Företag",       get:r=>r.companyName },
      { label:"OrgNr",         get:r=>r.orgNo },
      { label:"Telefon",       get:r=>r.phone },
      { label:"Epost",         get:r=>r.email },
      { label:"Adress",        get:r=>r.address },
      { label:"Postnr",        get:r=>r.zip },
      { label:"Ort",           get:r=>r.city },
      { label:"Kategori",      get:r=> r.type==="customer" ? (r.customerCategory||"") : (r.supplierCategory||"") },
    ];

    const csvC = toCSV(customers, headers);
    const csvS = toCSV(suppliers, headers);
    downloadText(`mach-crm-kunder-${new Date().toISOString().slice(0,10)}.csv`, csvC);
    downloadText(`mach-crm-leverantorer-${new Date().toISOString().slice(0,10)}.csv`, csvS);
  }

  // Import (JSON eller CSV – CSV: kunder/leverantörer)
  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isJSON = file.name.toLowerCase().endsWith(".json");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (isJSON) {
          const next = JSON.parse(String(reader.result||"{}"));
          if (!next || typeof next !== "object") throw new Error("Ogiltig JSON");
          // Minimal validering
          const merged = {
            entities: Array.isArray(next.entities)? next.entities : (state.entities||[]),
            activities: Array.isArray(next.activities)? next.activities : (state.activities||[]),
            offers: Array.isArray(next.offers)? next.offers : (state.offers||[]),
            projects: Array.isArray(next.projects)? next.projects : (state.projects||[]),
          };
          setState(merged);
          alert("Import (JSON) klart!");
        } else {
          // CSV -> vi läser rader och skapar kunder/leverantörer (kräver kolumnen 'Typ')
          const { headers, rows } = parseCSV(String(reader.result||""));
          const idx = (name)=> headers.findIndex(h=>h.toLowerCase()===name.toLowerCase());
          const iTyp = idx("Typ"), iBolag = idx("Företag"), iOrg=idx("OrgNr"), iTel=idx("Telefon"),
                iMail=idx("Epost"), iAdr=idx("Adress"), iZip=idx("Postnr"), iCity=idx("Ort"), iKat=idx("Kategori");
          if (iTyp<0 || iBolag<0) throw new Error("CSV saknar nödvändiga kolumner (Typ, Företag).");

          const toIns = rows.map(cols=>{
            const type = (cols[iTyp]||"").toLowerCase()==="kund" ? "customer" : "supplier";
            const e = newEntity(type);
            e.companyName = cols[iBolag]||"";
            e.orgNo = iOrg>=0? cols[iOrg]||"" : "";
            e.phone = iTel>=0? cols[iTel]||"" : "";
            e.email = iMail>=0? cols[iMail]||"" : "";
            e.address = iAdr>=0? cols[iAdr]||"" : "";
            e.zip = iZip>=0? cols[iZip]||"" : "";
            e.city = iCity>=0? cols[iCity]||"" : "";
            const kat = iKat>=0? (cols[iKat]||"") : "";
            if (type==="customer") e.customerCategory = kat ? kat : null;
            else e.supplierCategory = kat ? kat : null;
            return e;
          });

          setState(s=> ({ ...s, entities: [...(s.entities||[]), ...toIns] }));
          alert(`Import (CSV) klart! Lades till ${toIns.length} rader.`);
        }
      } catch (err) {
        console.error(err);
        alert("Kunde inte importera filen: " + (err?.message||err));
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold">Inställningar</h3>

      <div className="bg-white rounded-2xl shadow p-4 space-y-3">
        <div className="font-medium">Backup / Export</div>
        <div className="flex gap-2">
          <button className="border rounded-xl px-3 py-2" onClick={exportJSON}>Exportera allt (JSON)</button>
          <button className="border rounded-xl px-3 py-2" onClick={exportCSV}>Exportera kunder/leverantörer (CSV)</button>
        </div>
        <div className="text-xs text-gray-500">
          JSON innehåller allt (kunder, leverantörer, aktiviteter, offerter, projekt).
          CSV exporterar endast kunder/leverantörer för t.ex. Excel.
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 space-y-3">
        <div className="font-medium">Import</div>
        <input type="file" accept=".json,.csv" onChange={handleImportFile} />
        <div className="text-xs text-gray-500">
          • JSON ersätter/integrerar hela datamodellen.{" "}
          • CSV lägger till kunder/leverantörer (kräver kolumnerna: Typ, Företag).
        </div>
      </div>
    </div>
  );
}

/* ========== Modal & kort-komponenter (oförändrat) ========== */
function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl">
          <div className="p-4 border-b flex items-center justify-end sticky top-0 bg-white z-10">
            <button className="border rounded-xl px-3 py-2" onClick={onClose}>Stäng</button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function EntityCard({ state, setState, id }) {
  const entity = (state.entities || []).find(x => x.id === id);
  const [local, setLocal] = useState(entity || null);
  const [isEdit, setIsEdit] = useState(true);
  const [activeId, setActiveId] = useState(entity?.activeContactId || entity?.contacts?.[0]?.id || null);

  useEffect(()=>{ setLocal(entity||null); setActiveId(entity?.activeContactId || entity?.contacts?.[0]?.id || null); },[id]);
  if(!entity || !local) return null;

  const active = (local.contacts||[]).find(c=>c.id===activeId) || null;

  function update(k, v){ setLocal(x=>({...x,[k]:v})); }
  function updateContact(cid, k, v){
    setLocal(x=>({...x, contacts:(x.contacts||[]).map(c=>c.id===cid?{...c,[k]:v}:c)}));
  }
  function onSave(){
    const toSave = { ...local, activeContactId: activeId, updatedAt: new Date().toISOString() };
    setState(s=>{ const nxt={...s}; upsertEntity(nxt,toSave); return nxt; });
    setIsEdit(false);
  }
  function onAddContact(){
    const id = crypto?.randomUUID?.() || String(Date.now()+Math.random());
    const c = { id, name:"", role:"", phone:"", email:"" };
    setLocal(x=>({...x, contacts:[...(x.contacts||[]), c]}));
    if(!activeId) setActiveId(id);
    setIsEdit(true);
  }
  function onDeleteEntity(){
    if(!confirm(`Ta bort ${entityLabel(entity.type).toLowerCase()} "${local.companyName || ""}"?`)) return;
    setState(s=>({
      ...s,
      entities: (s.entities||[]).filter(e=>e.id!==entity.id),
      activities: (s.activities||[]).filter(a=>a.linkId!==entity.id),
      offers: (s.offers||[]).map(o=>{
        const upd = {...o};
        if(o.customerId===entity.id) upd.customerId=null;
        if((o.supplierItems||[]).some(si=>si.supplierId===entity.id)){
          upd.supplierItems = (o.supplierItems||[]).filter(si=>si.supplierId!==entity.id);
        }
        return upd;
      }),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{entityLabel(entity.type)}: {local.companyName || "(namn saknas)"}</h3>
        <div className="flex gap-2">
          {!isEdit ? <button className="border rounded-xl px-3 py-2" onClick={()=>setIsEdit(true)}>Redigera</button>
                   : <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>}
          <button className="text-red-600 border rounded-xl px-3 py-2" onClick={onDeleteEntity}>Ta bort</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Företag" value={local.companyName} disabled={!isEdit} onChange={v=>update("companyName",v)} />
          <Field label="Organisationsnummer" value={local.orgNo} disabled={!isEdit} onChange={v=>update("orgNo",v)} />
          <Field label="Telefon" value={local.phone} disabled={!isEdit} onChange={v=>update("phone",v)} />
          <Field label="E-post" value={local.email} disabled={!isEdit} onChange={v=>update("email",v)} />
          <Field label="Adress" value={local.address} disabled={!isEdit} onChange={v=>update("address",v)} colSpan={2} />
          <Field label="Postnummer" value={local.zip} disabled={!isEdit} onChange={v=>update("zip",v)} />
          <Field label="Ort" value={local.city} disabled={!isEdit} onChange={v=>update("city",v)} />
          {entity.type==="customer" ? (
            <SelectCat label="Kategori (kund)" value={local.customerCategory} onChange={v=>update("customerCategory",v)} options={CUSTOMER_CATS}/>
          ) : (
            <SelectCat label="Kategori (leverantör)" value={local.supplierCategory} onChange={v=>update("supplierCategory",v)} options={SUPPLIER_CATS}/>
          )}
          <TextArea label="Anteckningar" value={local.notes} disabled={!isEdit} onChange={v=>update("notes",v)} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">Kontaktpersoner</h4>
          <div className="flex gap-2">
            <select className="border rounded-xl px-2 py-2" value={activeId || ""} onChange={e=>setActiveId(e.target.value)}>
              {(local.contacts||[]).map(c=><option key={c.id} value={c.id}>{c.name || "(namn saknas)"}</option>)}
            </select>
            <button className="border rounded-xl px-3 py-2" onClick={onAddContact}>+ Lägg till</button>
          </div>
        </div>
        {active ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Namn"   value={active.name}  disabled={!isEdit} onChange={v=>updateContact(active.id,"name",v)} />
            <Field label="Roll"   value={active.role}  disabled={!isEdit} onChange={v=>updateContact(active.id,"role",v)} />
            <Field label="Telefon" value={active.phone} disabled={!isEdit} onChange={v=>updateContact(active.id,"phone",v)} />
            <Field label="E-post"  value={active.email} disabled={!isEdit} onChange={v=>updateContact(active.id,"email",v)} />
          </div>
        ) : <div className="text-sm text-gray-500">Ingen kontakt vald. Lägg till en kontaktperson.</div>}
      </div>
    </div>
  );
}

function SelectCat({label,value,onChange,options}) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      <select className="border rounded-xl px-3 py-2 w-full" value={value || ""} onChange={(e)=>onChange(e.target.value||null)}>
        <option value="">—</option>
        {options.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ActivityCard({ state, setState, id, draft, onClose }) {
  const fromState = (state.activities || []).find(a=>a.id===id) || null;
  const [local, setLocal] = useState(fromState || draft || newActivity());
  const [isEdit, setIsEdit] = useState(true);
  const entities = state.entities || [];
  const linkedEntity = entities.find(e=>e.id===local.linkId) || null;

  function update(k,v){ setLocal(x=>({...x,[k]:v})); }
  function toggleType(t){
    setLocal(x=>{
      const has = (x.types||[]).includes(t);
      return { ...x, types: has ? x.types.filter(k=>k!==t) : [...(x.types||[]), t] };
    });
  }
  function onSave(){
    const toSave = { ...local, updatedAt: new Date().toISOString() };
    setState(s=>{ const nxt={...s}; upsertActivity(nxt,toSave); return nxt; });
    setIsEdit(false);
  }
  function onDelete(){
    if(!confirm("Ta bort aktiviteten?")) return;
    setState(s=>({ ...s, activities:(s.activities||[]).filter(a=>a.id!==local.id) }));
    onClose?.();
  }

  const prMeta = PRIORITIES.find(p=>p.key===local.priority) || PRIORITIES[1];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Aktivitet</h3>
        <div className="flex gap-2">
          {!isEdit ? <button className="border rounded-xl px-3 py-2" onClick={()=>setIsEdit(true)}>Redigera</button>
                   : <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>}
          <button className="text-red-600 border rounded-xl px-3 py-2" onClick={onDelete}>Ta bort</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 space-y-4">
        <div className="text-xs text-gray-500">
          Skapad: {formatDT(local.createdAt?.slice(0,10), local.createdAt?.slice(11,16))}
        </div>

        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Vad ska göras?</div>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TYPES.map(t=>(
              <label key={t.key} className="flex items-center gap-2 border rounded-xl px-3 py-2">
                <input type="checkbox" disabled={!isEdit} checked={(local.types||[]).includes(t.key)} onChange={()=>toggleType(t.key)}/>
                <span className="text-lg">{t.icon}</span>
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Prioritet</div>
          <select className="border rounded-xl px-3 py-2" value={local.priority} disabled={!isEdit} onChange={e=>update("priority",e.target.value)}>
            {PRIORITIES.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <span className={`ml-2 text-xs px-2 py-1 rounded ${prMeta.className}`}>{prMeta.label}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Datum</div>
            <input type="date" className="border rounded-xl px-3 py-2 w-full" value={local.dueDate||""} disabled={!isEdit} onChange={e=>update("dueDate",e.target.value)}/>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Tid</div>
            <input type="time" className="border rounded-xl px-3 py-2 w-full" value={local.dueTime||""} disabled={!isEdit} onChange={e=>update("dueTime",e.target.value)}/>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Ansvarig</div>
          <select className="border rounded-xl px-3 py-2" value={local.responsible} disabled={!isEdit} onChange={e=>update("responsible",e.target.value)}>
            {RESPONSIBLES.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <TextArea label="Anteckningar" value={local.notes} disabled={!isEdit} onChange={v=>update("notes", v)} />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Koppling</div>
            <select className="border rounded-xl px-3 py-2 w-full" value={local.linkKind} disabled={!isEdit} onChange={(e)=>update("linkKind",e.target.value)}>
              <option value="customer">Kund</option>
              <option value="supplier">Leverantör</option>
              <option value="other">Övrigt</option>
            </select>
          </div>
          {local.linkKind!=="other" ? (
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Välj {local.linkKind==="customer"?"kund":"leverantör"}</div>
              <select className="border rounded-xl px-3 py-2 w-full" value={local.linkId||""} disabled={!isEdit} onChange={e=>update("linkId", e.target.value||null)}>
                <option value="">—</option>
                {(state.entities||[])
                  .filter(e=>e.type===(local.linkKind==="customer"?"customer":"supplier"))
                  .slice().sort(byName)
                  .map(e=><option key={e.id} value={e.id}>{e.companyName||"(namn saknas)"}</option>)}
              </select>
            </div>
          ) : (
            <div className="text-sm text-gray-500 flex items-end">Ingen koppling vald.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function OfferCard({ state, setState, id, draft, onClose }) {
  const fromState = (state.offers||[]).find(x=>x.id===id) || null;
  const [local, setLocal] = useState(fromState || draft || newOffer(state));
  const [isEdit, setIsEdit] = useState(true);

  const customers = (state.entities||[]).filter(e=>e.type==="customer").slice().sort(byName);
  const suppliers = (state.entities||[]).filter(e=>e.type==="supplier").slice().sort(byName);

  function update(k,v){ setLocal(x=>({...x,[k]:v})); }
  function persist(next){ setState(s=>{const nxt={...s}; upsertOffer(nxt,next); return nxt;}); }

  const [supSearch, setSupSearch] = useState("");
  const pickedIds = new Set((local.supplierItems||[]).map(si=>si.supplierId));
  const filteredSup = suppliers.filter(s => (s.companyName||"").toLowerCase().includes(supSearch.toLowerCase()) && !pickedIds.has(s.id));

  function addSupplier(supId){
    setLocal(x=>({ ...x, supplierItems:[...(x.supplierItems||[]), {supplierId: supId, sent:false, received:false}] }));
    setSupSearch("");
  }
  function setSupplierFlag(supId, key, val){
    setLocal(x=>({
      ...x,
      supplierItems:(x.supplierItems||[]).map(si=> si.supplierId===supId ? {...si, [key]:val} : si )
    }));
  }
  function removeSupplier(supId){
    setLocal(x=>({ ...x, supplierItems:(x.supplierItems||[]).filter(si=>si.supplierId!==supId) }));
  }

  function upsertReminderActivity(offer) {
    if (!offer.reminderDate) {
      if (offer.activityId) {
        setState(s => ({ ...s, activities:(s.activities||[]).filter(a=>a.id!==offer.activityId) }));
        persist({ ...offer, activityId: null });
      }
      return;
    }
    const title = `Skicka offert #${offer.number} — ${offer.title || ""}`.trim();
    if (offer.activityId) {
      setState(s=>{
        const ex = (s.activities||[]).find(a=>a.id===offer.activityId);
        if(!ex) return s;
        const upd = { ...ex,
          title, type: "uppgift", priority:"medium",
          dueDate: offer.reminderDate, dueTime: offer.reminderTime||"09:00",
          linkKind:"customer", linkId: offer.customerId||null,
          updatedAt: new Date().toISOString(),
        };
        const list = (s.activities||[]).map(a=>a.id===upd.id?upd:a);
        return { ...s, activities:list };
      });
    } else {
      const id = crypto?.randomUUID?.() || String(Date.now()+Math.random());
      const ins = {
        id, createdAt:new Date().toISOString(), types:["uppgift"],
        priority:"medium",
        title,
        dueDate: offer.reminderDate, dueTime: offer.reminderTime||"09:00",
        responsible:"Cralle",
        notes:"",
        linkKind:"customer", linkId: offer.customerId||null,
      };
      setState(s=>{
        const nxt = { ...s, activities:[...(s.activities||[]), ins] };
        const off = { ...offer, activityId: id };
        upsertOffer(nxt, off);
        return nxt;
      });
    }
  }

  function onSave(){
    const toSave = { ...local, updatedAt:new Date().toISOString() };
    if(!toSave.number) toSave.number = nextOfferNumber(state);
    persist(toSave);
    upsertReminderActivity(toSave);
    setIsEdit(false);
  }
  function setStatus(st){
    const upd = { ...local, status: st, updatedAt:new Date().toISOString() };
    setLocal(upd); persist(upd);
  }
  function onDelete(){
    if(!confirm(`Ta bort offert #${local.number}?`)) return;
    setState(s=>({
      ...s,
      offers:(s.offers||[]).filter(o=>o.id!==local.id),
      activities: local.activityId ? (s.activities||[]).filter(a=>a.id!==local.activityId) : (s.activities||[])
    }));
    onClose?.();
  }

  const statusMeta = OFFER_STATUS_META[local.status||"draft"] || OFFER_STATUS_META.draft;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Offert #{local.number || "—"}</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${statusMeta.className}`}>{statusMeta.label}</span>
          {!isEdit ? <button className="border rounded-xl px-3 py-2" onClick={()=>setIsEdit(true)}>Redigera</button>
                   : <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>}
          <button className="text-red-600 border rounded-xl px-3 py-2" onClick={onDelete}>Ta bort</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Projekt" value={local.title} disabled={!isEdit} onChange={v=>update("title",v)} />
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Kund</div>
            <select className="border rounded-xl px-3 py-2 w-full" value={local.customerId || ""} disabled={!isEdit} onChange={e=>update("customerId", e.target.value || null)}>
              <option value="">—</option>
              {customers.map(c=><option key={c.id} value={c.id}>{c.companyName || "(namn saknas)"}</option>)}
            </select>
          </div>
          <div className="col-span-2 flex flex-wrap gap-2">
            <button className={`px-3 py-2 rounded-xl border ${local.status==="draft" ? "bg-gray-700 text-white" : ""}`}  disabled={!isEdit} onClick={()=>setStatus("draft")}>Utkast</button>
            <button className={`px-3 py-2 rounded-xl border ${local.status==="sent" ? "bg-orange-500 text-white" : ""}`} disabled={!isEdit} onClick={()=>setStatus("sent")}>Skickad</button>
            <button className={`px-3 py-2 rounded-xl border ${local.status==="won" ? "bg-green-600 text-white" : ""}`}   disabled={!isEdit} onClick={()=>setStatus("won")}>Vunnen</button>
            <button className={`px-3 py-2 rounded-xl border ${local.status==="lost" ? "bg-rose-600 text-white" : ""}`}    disabled={!isEdit} onClick={()=>setStatus("lost")}>Förlorad</button>
          </div>
        </div>

        {/* Leverantörer – sök/klicklista (popup inom rutan) */}
        <div className="space-y-2">
          <div className="text-sm font-semibold">Leverantörer</div>
          <div className="flex gap-2 items-center relative">
            <input
              className="border rounded-xl px-3 py-2 w-full"
              placeholder="Sök leverantör…"
              value={supSearch}
              disabled={!isEdit}
              onChange={(e)=>setSupSearch(e.target.value)}
            />
            {isEdit && supSearch && (
              <div className="absolute top-12 left-0 right-0 z-10 bg-white border rounded-xl shadow max-h-60 overflow-auto">
                {filteredSup.length ? filteredSup.map(s=>(
                  <button key={s.id} className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={()=>addSupplier(s.id)}>
                    {s.companyName}
                  </button>
                )) : <div className="px-3 py-2 text-sm text-gray-500">Inga träffar</div>}
              </div>
            )}
          </div>

          <ul className="space-y-2">
            {(local.supplierItems||[]).map(si=>{
              const sup = suppliers.find(s=>s.id===si.supplierId);
              if(!sup) return null;
              return (
                <li key={si.supplierId} className="flex items-center justify-between gap-3 border rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{sup.companyName}</div>
                    <div className="text-xs text-gray-500 truncate">{sup.email || sup.phone || "—"}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm flex items-center gap-1">
                      <input type="checkbox" disabled={!isEdit} checked={!!si.sent} onChange={e=>setSupplierFlag(si.supplierId,"sent", e.target.checked)}/>
                      Skickad
                    </label>
                    <label className="text-sm flex items-center gap-1">
                      <input type="checkbox" disabled={!isEdit} checked={!!si.received} onChange={e=>setSupplierFlag(si.supplierId,"received", e.target.checked)}/>
                      Mottaget
                    </label>
                    {isEdit && <button className="text-rose-600 text-sm" onClick={()=>removeSupplier(si.supplierId)}>Ta bort</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Påminnelse (datum)</div>
              <input type="date" className="border rounded-xl px-3 py-2 w-full" value={local.reminderDate || ""} disabled={!isEdit} onChange={e=>update("reminderDate",e.target.value)}/>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Tid</div>
              <input type="time" className="border rounded-xl px-3 py-2 w-full" value={local.reminderTime || ""} disabled={!isEdit} onChange={e=>update("reminderTime",e.target.value)}/>
            </div>
          </div>
          <TextArea label="Anteckningar" value={local.notes} disabled={!isEdit} onChange={v=>update("notes", v)} />
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ state, setState, id, onClose }) {
  const p = (state.projects||[]).find(x=>x.id===id);
  const [local, setLocal] = useState(p || null);
  const [isEdit, setIsEdit] = useState(true);
  const customers = (state.entities||[]).filter(e=>e.type==="customer").slice().sort(byName);

  useEffect(()=>{ setLocal(p||null); },[id]);
  if(!p || !local) return null;

  function update(k,v){ setLocal(x=>({...x,[k]:v})); }
  function onSave(){
    const toSave = { ...local, updatedAt:new Date().toISOString() };
    setState(s=>{ const nxt={...s}; upsertProject(nxt,toSave); return nxt; });
    setIsEdit(false);
  }
  function onDelete(){
    if(!confirm("Ta bort projektet?")) return;
    setState(s=>({ ...s, projects:(s.projects||[]).filter(x=>x.id!==local.id) }));
    onClose?.();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Projekt: {local.name || "(namn saknas)"}</h3>
        <div className="flex gap-2">
          {!isEdit ? <button className="border rounded-xl px-3 py-2" onClick={()=>setIsEdit(true)}>Redigera</button>
                   : <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>}
          <button className="text-red-600 border rounded-xl px-3 py-2" onClick={onDelete}>Ta bort</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Projektnamn" value={local.name} disabled={!isEdit} onChange={v=>update("name",v)} />
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Kund</div>
            <select className="border rounded-xl px-3 py-2 w-full" value={local.customerId || ""} disabled={!isEdit} onChange={e=>update("customerId", e.target.value || null)}>
              <option value="">—</option>
              {customers.map(c=><option key={c.id} value={c.id}>{c.companyName||"(namn saknas)"}</option>)}
            </select>
          </div>
          <Field label="Status" value={local.status} disabled={!isEdit} onChange={v=>update("status",v)} />
          <input type="date" className="border rounded-xl px-3 py-2" value={local.startDate || ""} disabled={!isEdit} onChange={e=>update("startDate",e.target.value)} />
          <input type="date" className="border rounded-xl px-3 py-2" value={local.endDate || ""} disabled={!isEdit} onChange={e=>update("endDate",e.target.value)} />
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Progress (%)</div>
            <input type="number" className="border rounded-xl px-3 py-2 w-full" value={local.progress||0} disabled={!isEdit} onChange={e=>update("progress", Number(e.target.value||0))}/>
          </div>
          <TextArea label="Beskrivning" value={local.description||""} disabled={!isEdit} onChange={v=>update("description",v)} />
        </div>
      </div>
    </div>
  );
}

/* ========== Inputs ========== */
function Field({ label, value, onChange, disabled, colSpan }) {
  return (
    <div className={colSpan === 2 ? "col-span-2" : ""}>
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      <input
        className="w-full border rounded-xl px-3 py-2"
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}
function TextArea({ label, value, onChange, disabled }) {
  return (
    <div className="col-span-2">
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      <textarea
        rows={3}
        className="w-full border rounded-xl px-3 py-2"
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}
