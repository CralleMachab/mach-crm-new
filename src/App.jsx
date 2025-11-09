import React, { useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "./lib/storage";
import { fetchRemoteState, pushRemoteState } from "./lib/cloud";
import { pickOneDriveFiles } from "./components/onedrive";

/* ===========================
   useStore — lokal + SharePoint
   =========================== */
function useStore() {
  const STORAGE_KEY = "machcrm_data_v3";

  const [state, setState] = useState(() => {
    const s = loadState();
    if (s && typeof s === "object") return s;
    return { activities: [], entities: [], offers: [], projects: [], _lastSavedAt: "" };
  });

  // Lokalt
  useEffect(() => {
    saveState(state);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
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
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(remote)); } catch {}
          }
        }
      } catch {
      } finally {
        if (!stopped) setTimeout(tick, 5000);
      }
    };
    tick();
    return () => { stopped = true; };
  }, []);

  return [state, setState];
}

/* ==========================================================
   ActivitiesPanelNew — popup, ikoner, filter, Ta bort
   (Låt denna vara — det är samma variant som du gillade)
   ========================================================== */
function ActivitiesPanelNew({ activities = [], entities = [], setState }) {
  const [respFilter, setRespFilter]   = useState("all");
  const [rangeFilter, setRangeFilter] = useState("7");
  const [dateFilter, setDateFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft]       = useState(null);

  const customers = useMemo(() => (entities || []).filter(e => e?.type === "customer"), [entities]);
  const suppliers = useMemo(() => (entities || []).filter(e => e?.type === "supplier"), [entities]);

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

  // Öppna direkt om _shouldOpen är satt (nyss skapad)
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
      isPhone: !!a.isPhone,
      isEmail: !!a.isEmail,
      isLunch: !!a.isLunch,
      isMeeting: !!a.isMeeting,
    });
    setState(s => ({
      ...s,
      activities: (s.activities || []).map(x => x.id === a.id ? { ...x, _shouldOpen: undefined } : x),
    }));
  }, [activities, setState]);

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

  const markKlar = (aOrId) => {
    const a = typeof aOrId === "string" ? (activities||[]).find(x=>x.id===aOrId) : aOrId;
    if (!a) return;
    const upd = { ...a, priority: "klar", status: "klar", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setState(s => ({ ...s, activities: (s.activities || []).map(x => x.id === a.id ? upd : x) }));
  };
  const markAterkoppling = (aOrId) => {
    const a = typeof aOrId === "string" ? (activities||[]).find(x=>x.id===aOrId) : aOrId;
    if (!a) return;
    const upd = { ...a, status: "återkoppling", updatedAt: new Date().toISOString() };
    setState(s => ({ ...s, activities: (s.activities || []).map(x => x.id === a.id ? upd : x) }));
  };
  const softDelete = (a) => {
    const upd = { ...a, deletedAt: new Date().toISOString() };
    setState(s => ({ ...s, activities: (s.activities || []).map(x => x.id === a.id ? upd : x) }));
    if (openItem?.id === a.id) { setOpenItem(null); setDraft(null); }
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
  const updateDraft = (field, val) => setDraft(d => ({ ...d, [field]: val }));
  const saveDraft = () => {
    if (!draft) return;
    const baseUpd = {
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
      isPhone: !!draft.isPhone,
      isEmail: !!draft.isEmail,
      isLunch: !!draft.isLunch,
      isMeeting: !!draft.isMeeting,
      updatedAt: new Date().toISOString(),
    };
    setState(s => ({
      ...s,
      activities: (s.activities || []).map(x => x.id === baseUpd.id ? baseUpd : x),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  const Icons = ({ a }) => (
    <div className="flex items-center gap-1 text-xs text-gray-600">
      {a.isPhone   ? <span title="Telefon">📞</span> : null}
      {a.isEmail   ? <span title="E-post">✉️</span> : null}
      {a.isLunch   ? <span title="Lunch">🥪</span> : null}
      {a.isMeeting ? <span title="Möte">📅</span> : null}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="font-semibold">Aktiviteter</h2>

        <div className="flex items-center gap-2 flex-wrap">
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

      <ul className="divide-y">
        {list.map(a => (
          <li key={a.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                onClick={()=>openEdit(a)}
                title="Öppna aktiviteten"
              >
                <div className="font-medium truncate">{a.title || "Aktivitet"}</div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500">{fmt(a.dueDate, a.dueTime)}</div>
                  <Icons a={a} />
                </div>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <span className={prBadge(a.priority)}>{a.priority || "normal"}</span>
                <span className={respChip(a.responsible)}>{a.responsible || "Övrig"}</span>
                {a.status ? <span className={statusBadge(a.status)}>{a.status}</span> : null}

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

      {openItem && draft && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={()=>{ setOpenItem(null); setDraft(null); }}>
          <div className="bg-white rounded-2xl shadow p-4 w-full max-w-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Redigera aktivitet</div>
              <button className="text-sm" onClick={()=>{ setOpenItem(null); setDraft(null); }}>Stäng</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <select className="w-full border rounded px-3 py-2" value={draft.responsible} onChange={e=>updateDraft("responsible", e.target.value)}>
                  <option>Mattias</option>
                  <option>Cralle</option>
                  <option>Övrig</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Datum</label>
                <input type="date" className="w-full border rounded px-3 py-2" value={draft.dueDate} onChange={e=>updateDraft("dueDate", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Tid</label>
                <input type="time" className="w-full border rounded px-3 py-2" value={draft.dueTime} onChange={e=>updateDraft("dueTime", e.target.value)} />
              </div>

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

              <div className="col-span-2">
                <div className="text-sm font-medium mb-1">Typ</div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!draft.isPhone} onChange={e=>updateDraft("isPhone", e.target.checked)} />
                    <span>📞 Telefon</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!draft.isEmail} onChange={e=>updateDraft("isEmail", e.target.checked)} />
                    <span>✉️ Mail</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!draft.isLunch} onChange={e=>updateDraft("isLunch", e.target.checked)} />
                    <span>🥪 Lunch</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!draft.isMeeting} onChange={e=>updateDraft("isMeeting", e.target.checked)} />
                    <span>📅 Möte</span>
                  </label>
                </div>
              </div>

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

              <div className="col-span-2">
                <label className="text-sm font-medium">Beskrivning</label>
                <textarea className="w-full border rounded px-3 py-2 min-h-[100px]" value={draft.description} onChange={e=>updateDraft("description", e.target.value)} />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={()=>{ saveDraft(); markKlar(draft.id); }}>
                Spara & Markera Klar
              </button>
              <button className="px-3 py-2 rounded bg-orange-500 text-white" onClick={()=>{ saveDraft(); markAterkoppling(draft.id); }}>
                Spara & Återkoppling
              </button>
              <button className="px-3 py-2 rounded bg-rose-600 text-white" onClick={()=>softDelete(openItem)}>
                Ta bort
              </button>

              <button className="ml-auto px-3 py-2 rounded border" onClick={saveDraft}>
                Spara
              </button>
              <button className="px-3 py-2 rounded border" onClick={()=>{ setOpenItem(null); setDraft(null); }}>
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
   CustomersPanel — sök + kategorifilter + pop-up
   ====================================== */
function CustomersPanel({ entities = [], setState }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all"); // StålHall | Totalentreprenad | Turbovex | all

  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  const list = useMemo(() => {
    let arr = (entities || []).filter(e => e.type === "customer" && !e.deletedAt);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter(e =>
        (e.companyName||"").toLowerCase().includes(s) ||
        (e.orgNo||"").toLowerCase().includes(s) ||
        (e.city||"").toLowerCase().includes(s)
      );
    }
    if (cat !== "all") {
      arr = arr.filter(e => (e.customerCategory||"") === cat);
    }
    arr.sort((a,b)=> (a.companyName||"").localeCompare(b.companyName||""));
    return arr;
  }, [entities, q, cat]);

  const openEdit = (c) => {
    setOpenItem(c);
    setDraft({
      id: c.id,
      companyName: c.companyName||"",
      orgNo: c.orgNo||"",
      phone: c.phone||"",
      email: c.email||"",
      address: c.address||"",
      zip: c.zip||"",
      city: c.city||"",
      customerCategory: c.customerCategory||"",
    });
  };
  const updateDraft = (k,v)=> setDraft(d=>({ ...d, [k]: v }));
  const saveDraft = ()=>{
    if (!draft) return;
    setState(s=>({
      ...s,
      entities: (s.entities||[]).map(e => e.id===draft.id ? {
        ...e,
        companyName: draft.companyName||"",
        orgNo: draft.orgNo||"",
        phone: draft.phone||"",
        email: draft.email||"",
        address: draft.address||"",
        zip: draft.zip||"",
        city: draft.city||"",
        customerCategory: draft.customerCategory||"",
        updatedAt: new Date().toISOString(),
      } : e)
    }));
    setOpenItem(null); setDraft(null);
  };
  const softDelete = (c)=>{
    setState(s=>({
      ...s,
      entities: (s.entities||[]).map(e => e.id===c.id ? { ...e, deletedAt: new Date().toISOString() } : e)
    }));
    if (openItem?.id===c.id){ setOpenItem(null); setDraft(null); }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="font-semibold">Kunder</h2>
        <div className="flex gap-2">
          <input className="border rounded-xl px-3 py-2" placeholder="Sök..." value={q} onChange={e=>setQ(e.target.value)} />
          <select className="border rounded-xl px-3 py-2" value={cat} onChange={e=>setCat(e.target.value)}>
            <option value="all">Alla kategorier</option>
            <option value="StålHall">StålHall</option>
            <option value="Totalentreprenad">Totalentreprenad</option>
            <option value="Turbovex">Turbovex</option>
          </select>
        </div>
      </div>

      <ul className="divide-y">
        {list.map(c => (
          <li key={c.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1" onClick={()=>openEdit(c)}>
                <div className="font-medium truncate">{c.companyName || "(namnlös kund)"}</div>
                <div className="text-xs text-gray-500">{c.city || ""}</div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{c.customerCategory || "—"}</span>
                <button className="text-xs px-2 py-1 rounded bg-rose-500 text-white" onClick={()=>softDelete(c)}>
                  Ta bort
                </button>
              </div>
            </div>
          </li>
        ))}
        {list.length===0 && <li className="py-6 text-sm text-gray-500">Inga kunder.</li>}
      </ul>

      {openItem && draft && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={()=>{ setOpenItem(null); setDraft(null); }}>
          <div className="bg-white rounded-2xl shadow p-4 w-full max-w-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Redigera kund</div>
              <button className="text-sm" onClick={()=>{ setOpenItem(null); setDraft(null); }}>Stäng</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Företag</label>
                <input className="w-full border rounded px-3 py-2" value={draft.companyName} onChange={e=>updateDraft("companyName", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">OrgNr</label>
                <input className="w-full border rounded px-3 py-2" value={draft.orgNo} onChange={e=>updateDraft("orgNo", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Telefon</label>
                <input className="w-full border rounded px-3 py-2" value={draft.phone} onChange={e=>updateDraft("phone", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Epost</label>
                <input className="w-full border rounded px-3 py-2" value={draft.email} onChange={e=>updateDraft("email", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Adress</label>
                <input className="w-full border rounded px-3 py-2" value={draft.address} onChange={e=>updateDraft("address", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Postnr</label>
                <input className="w-full border rounded px-3 py-2" value={draft.zip} onChange={e=>updateDraft("zip", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Ort</label>
                <input className="w-full border rounded px-3 py-2" value={draft.city} onChange={e=>updateDraft("city", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Kategori</label>
                <select className="w-full border rounded px-3 py-2" value={draft.customerCategory} onChange={e=>updateDraft("customerCategory", e.target.value)}>
                  <option value="">—</option>
                  <option value="StålHall">StålHall</option>
                  <option value="Totalentreprenad">Totalentreprenad</option>
                  <option value="Turbovex">Turbovex</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={saveDraft}>
                Spara
              </button>
              <button className="px-3 py-2 rounded bg-rose-600 text-white" onClick={()=>softDelete(openItem)}>
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

/* ==========================================
   SuppliersPanel — sök + kategorifilter + pop-up
   ========================================== */
function SuppliersPanel({ entities = [], setState }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  const list = useMemo(() => {
    let arr = (entities || []).filter(e => e.type === "supplier" && !e.deletedAt);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter(e =>
        (e.companyName||"").toLowerCase().includes(s) ||
        (e.orgNo||"").toLowerCase().includes(s) ||
        (e.city||"").toLowerCase().includes(s)
      );
    }
    if (cat !== "all") {
      arr = arr.filter(e => (e.supplierCategory||"") === cat);
    }
    arr.sort((a,b)=> (a.companyName||"").localeCompare(b.companyName||""));
    return arr;
  }, [entities, q, cat]);

  const openEdit = (s) => {
    setOpenItem(s);
    setDraft({
      id: s.id,
      companyName: s.companyName||"",
      orgNo: s.orgNo||"",
      phone: s.phone||"",
      email: s.email||"",
      address: s.address||"",
      zip: s.zip||"",
      city: s.city||"",
      supplierCategory: s.supplierCategory||"",
    });
  };
  const updateDraft = (k,v)=> setDraft(d=>({ ...d, [k]: v }));
  const saveDraft = ()=>{
    if (!draft) return;
    setState(s=>({
      ...s,
      entities: (s.entities||[]).map(e => e.id===draft.id ? {
        ...e,
        companyName: draft.companyName||"",
        orgNo: draft.orgNo||"",
        phone: draft.phone||"",
        email: draft.email||"",
        address: draft.address||"",
        zip: draft.zip||"",
        city: draft.city||"",
        supplierCategory: draft.supplierCategory||"",
        updatedAt: new Date().toISOString(),
      } : e)
    }));
    setOpenItem(null); setDraft(null);
  };
  const softDelete = (s)=>{
    setState(s0=>({
      ...s0,
      entities: (s0.entities||[]).map(e => e.id===s.id ? { ...e, deletedAt: new Date().toISOString() } : e)
    }));
    if (openItem?.id===s.id){ setOpenItem(null); setDraft(null); }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="font-semibold">Leverantörer</h2>
        <div className="flex gap-2">
          <input className="border rounded-xl px-3 py-2" placeholder="Sök..." value={q} onChange={e=>setQ(e.target.value)} />
          <select className="border rounded-xl px-3 py-2" value={cat} onChange={e=>setCat(e.target.value)}>
            <option value="all">Alla kategorier</option>
            <option value="Stålhalls leverantör">Stålhalls leverantör</option>
            <option value="Mark företag">Mark företag</option>
            <option value="EL leverantör">EL leverantör</option>
            <option value="VVS Leverantör">VVS Leverantör</option>
            <option value="Vent Leverantör">Vent Leverantör</option>
          </select>
        </div>
      </div>

      <ul className="divide-y">
        {list.map(sup => (
          <li key={sup.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1" onClick={()=>openEdit(sup)}>
                <div className="font-medium truncate">{sup.companyName || "(namnlös leverantör)"}</div>
                <div className="text-xs text-gray-500">{sup.city || ""}</div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{sup.supplierCategory || "—"}</span>
                <button className="text-xs px-2 py-1 rounded bg-rose-500 text-white" onClick={()=>softDelete(sup)}>
                  Ta bort
                </button>
              </div>
            </div>
          </li>
        ))}
        {list.length===0 && <li className="py-6 text-sm text-gray-500">Inga leverantörer.</li>}
      </ul>

      {openItem && draft && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={()=>{ setOpenItem(null); setDraft(null); }}>
          <div className="bg-white rounded-2xl shadow p-4 w-full max-w-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Redigera leverantör</div>
              <button className="text-sm" onClick={()=>{ setOpenItem(null); setDraft(null); }}>Stäng</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Företag</label>
                <input className="w-full border rounded px-3 py-2" value={draft.companyName} onChange={e=>updateDraft("companyName", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">OrgNr</label>
                <input className="w-full border rounded px-3 py-2" value={draft.orgNo} onChange={e=>updateDraft("orgNo", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Telefon</label>
                <input className="w-full border rounded px-3 py-2" value={draft.phone} onChange={e=>updateDraft("phone", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Epost</label>
                <input className="w-full border rounded px-3 py-2" value={draft.email} onChange={e=>updateDraft("email", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Adress</label>
                <input className="w-full border rounded px-3 py-2" value={draft.address} onChange={e=>updateDraft("address", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Postnr</label>
                <input className="w-full border rounded px-3 py-2" value={draft.zip} onChange={e=>updateDraft("zip", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Ort</label>
                <input className="w-full border rounded px-3 py-2" value={draft.city} onChange={e=>updateDraft("city", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Kategori</label>
                <select className="w-full border rounded px-3 py-2" value={draft.supplierCategory} onChange={e=>updateDraft("supplierCategory", e.target.value)}>
                  <option value="">—</option>
                  <option value="Stålhalls leverantör">Stålhalls leverantör</option>
                  <option value="Mark företag">Mark företag</option>
                  <option value="EL leverantör">EL leverantör</option>
                  <option value="VVS Leverantör">VVS Leverantör</option>
                  <option value="Vent Leverantör">Vent Leverantör</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={saveDraft}>
                Spara
              </button>
              <button className="px-3 py-2 rounded bg-rose-600 text-white" onClick={()=>softDelete(openItem)}>
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

/* ======================================
   OffersPanel — list + pop-up + OneDrive
   ====================================== */
function OffersPanel({ offers = [], entities = [], setState }) {
  const [q, setQ] = useState("");
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  const CATS = ["Ritningar", "Offerter", "Kalkyler", "KMA"];
  const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

  const customers = useMemo(() => (entities || []).filter(e => e.type === "customer"), [entities]);
  const customerName = id => (customers.find(c=>c.id===id)?.companyName) || "—";

  // Öppna direkt om _shouldOpen är satt (nyss skapad)
  useEffect(() => {
    const o = (offers || []).find(x => x?._shouldOpen);
    if (!o) return;
    const files = o.files && typeof o.files === "object" ? o.files : { Ritningar:[], Offerter:[], Kalkyler:[], KMA:[] };
    setOpenItem(o);
    setDraft({
      id:o.id,
      title:o.title||"",
      customerId:o.customerId||"",
      value:o.value ?? 0,
      status:o.status||"utkast",
      note:o.note||"",
      files: {
        Ritningar: Array.isArray(files.Ritningar)? files.Ritningar.slice():[],
        Offerter:  Array.isArray(files.Offerter)?  files.Offerter.slice():[],
        Kalkyler:  Array.isArray(files.Kalkyler)?  files.Kalkyler.slice():[],
        KMA:       Array.isArray(files.KMA)?       files.KMA.slice():[],
      },
    });
    setState(s => ({
      ...s,
      offers: (s.offers || []).map(x => x.id === o.id ? { ...x, _shouldOpen: undefined } : x),
    }));
  }, [offers, setState]);

  const list = useMemo(() => {
    let arr = (offers||[]).filter(o=>!o.deletedAt);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter(o => (o.title||"").toLowerCase().includes(s));
    }
    arr.sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""));
    return arr;
  }, [offers, q]);

  const openEdit = (o)=>{
    const files = o.files && typeof o.files === "object" ? o.files : { Ritningar:[], Offerter:[], Kalkyler:[], KMA:[] };
    setOpenItem(o);
    setDraft({
      id:o.id,
      title:o.title||"",
      customerId:o.customerId||"",
      value:o.value ?? 0,
      status:o.status||"utkast",
      note:o.note||"",
      files: {
        Ritningar: Array.isArray(files.Ritningar)? files.Ritningar.slice():[],
        Offerter:  Array.isArray(files.Offerter)?  files.Offerter.slice():[],
        Kalkyler:  Array.isArray(files.Kalkyler)?  files.Kalkyler.slice():[],
        KMA:       Array.isArray(files.KMA)?       files.KMA.slice():[],
      },
    });
  };
  const updateDraft = (k,v)=> setDraft(d=>({ ...d, [k]: v }));
  const updateFiles = (cat, files)=> setDraft(d=>({ ...d, files: { ...d.files, [cat]: files }}));

  const addFiles = async (cat)=>{
    try{
      const picked = await pickOneDriveFiles();
      if (!picked || picked.length===0) return;
      const next = (draft.files[cat]||[]).concat(
        picked.map(p=>({ id:p.id||newId(), name:p.name||"fil", webUrl:p.webUrl||p.url||"#" }))
      );
      updateFiles(cat, next);
    }catch(e){
      alert("Kunde inte hämta filer från OneDrive.");
      console.warn(e);
    }
  };
  const removeFile = (cat, idx)=>{
    const next = (draft.files[cat]||[]).slice();
    next.splice(idx,1);
    updateFiles(cat, next);
  };

  const saveDraft = ()=>{
    if (!draft) return;
    setState(s=>({
      ...s,
      offers: (s.offers||[]).map(o=>o.id===draft.id ? {
        ...o,
        title: draft.title||"",
        customerId: draft.customerId||"",
        value: Number(draft.value)||0,
        status: draft.status||"utkast",
        note: draft.note||"",
        files: {
          Ritningar: draft.files.Ritningar||[],
          Offerter:  draft.files.Offerter||[],
          Kalkyler:  draft.files.Kalkyler||[],
          KMA:       draft.files.KMA||[],
        },
        updatedAt:new Date().toISOString()
      } : o)
    }));
    setOpenItem(null); setDraft(null);
  };

  const softDelete = (o)=>{
    setState(s=>({...s, offers:(s.offers||[]).map(x=>x.id===o.id?{...x,deletedAt:new Date().toISOString()}:x)}));
    if(openItem?.id===o.id){ setOpenItem(null); setDraft(null); }
  };

  const createProjectFromOffer = ()=>{
    if (!draft) return;
    const proj = {
      id: (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
      name: draft.title || "Projekt",
      customerId: draft.customerId || "",
      status: "pågående",
      budget: Number(draft.value)||0,
      note: (draft.note||""),
      files: {
        Ritningar: draft.files.Ritningar||[],
        Offerter:  draft.files.Offerter||[],
        Kalkyler:  draft.files.Kalkyler||[],
        KMA:       draft.files.KMA||[],
      },
      originatingOfferId: draft.id,
      createdAt: new Date().toISOString(),
    };
    setState(s=>({
      ...s,
      projects: [ ...(s.projects||[]), proj ],
      offers: (s.offers||[]).map(o=>o.id===draft.id ? { ...o, status:"vunnen", updatedAt:new Date().toISOString() } : o)
    }));
    setOpenItem(null); setDraft(null);
    alert("Projekt skapat från offert.");
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Offerter</h2>
        <input className="border rounded-xl px-3 py-2" placeholder="Sök..." value={q} onChange={e=>setQ(e.target.value)} />
      </div>

      <ul className="divide-y">
        {list.map(o=>(
          <li key={o.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1" onClick={()=>openEdit(o)}>
                <div className="font-medium truncate">{o.title||"Offert"}</div>
                <div className="text-xs text-gray-500">Kund: {customerName(o.customerId)} · {o.status||"utkast"}</div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{(o.value||0).toLocaleString("sv-SE")} kr</span>
                <button className="text-xs px-2 py-1 rounded bg-rose-500 text-white" onClick={()=>softDelete(o)}>Ta bort</button>
              </div>
            </div>
          </li>
        ))}
        {list.length===0 && <li className="py-6 text-sm text-gray-500">Inga offerter.</li>}
      </ul>

      {openItem && draft && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={()=>{ setOpenItem(null); setDraft(null); }}>
          <div className="bg-white rounded-2xl shadow p-4 w-full max-w-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Redigera offert</div>
              <button className="text-sm" onClick={()=>{ setOpenItem(null); setDraft(null); }}>Stäng</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Titel</label>
                <input className="w-full border rounded px-3 py-2" value={draft.title} onChange={e=>updateDraft("title", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Kund</label>
                <select className="w-full border rounded px-3 py-2" value={draft.customerId} onChange={e=>updateDraft("customerId", e.target.value)}>
                  <option value="">—</option>
                  {customers.map(c=><option key={c.id} value={c.id}>{c.companyName||c.id}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Belopp (kr)</label>
                <input type="number" className="w-full border rounded px-3 py-2" value={draft.value} onChange={e=>updateDraft("value", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select className="w-full border rounded px-3 py-2" value={draft.status} onChange={e=>updateDraft("status", e.target.value)}>
                  <option value="utkast">Utkast</option>
                  <option value="inskickad">Inskickad</option>
                  <option value="vunnen">Vunnen</option>
                  <option value="förlorad">Förlorad</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Anteckning</label>
                <textarea className="w-full border rounded px-3 py-2 min-h-[80px]" value={draft.note} onChange={e=>updateDraft("note", e.target.value)} />
              </div>
            </div>

            {/* Filer per kategori */}
            <div className="mt-4 space-y-3">
              {CATS.map(cat=>(
                <div key={cat} className="border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{cat}</div>
                    <button className="text-xs px-2 py-1 rounded border" onClick={()=>addFiles(cat)}>+ Lägg till från OneDrive</button>
                  </div>
                  {(draft.files[cat]||[]).length===0 ? (
                    <div className="text-xs text-gray-500">Inga filer.</div>
                  ) : (
                    <ul className="text-sm space-y-1">
                      {draft.files[cat].map((f,idx)=>(
                        <li key={f.id||idx} className="flex items-center justify-between gap-2">
                          <a className="underline truncate" href={f.webUrl||"#"} target="_blank" rel="noreferrer">{f.name||"fil"}</a>
                          <button className="text-xs px-2 py-1 rounded bg-rose-500 text-white" onClick={()=>removeFile(cat, idx)}>Ta bort</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={saveDraft}>
                Spara
              </button>
              {draft.status==="vunnen" && (
                <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={createProjectFromOffer}>
                  Skapa projekt från offert (ärver filer)
                </button>
              )}
              <button className="px-3 py-2 rounded bg-rose-600 text-white" onClick={()=>softDelete(openItem)}>
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

/* ======================================
   ProjectsPanel — list + pop-up + OneDrive
   ====================================== */
function ProjectsPanel({ projects = [], setState, entities = [] }) {
  const [q, setQ] = useState("");
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  const CATS = ["Ritningar", "Offerter", "Kalkyler", "KMA"];
  const customers = useMemo(() => (entities || []).filter(e => e.type === "customer"), [entities]);
  const customerName = id => (customers.find(c=>c.id===id)?.companyName) || "—";

  useEffect(() => {
    const p = (projects || []).find(x => x?._shouldOpen);
    if (!p) return;
    const files = p.files && typeof p.files === "object" ? p.files : { Ritningar:[], Offerter:[], Kalkyler:[], KMA:[] };
    setOpenItem(p);
    setDraft({
      id:p.id,
      name:p.name||"",
      customerId:p.customerId||"",
      status:p.status||"pågående",
      budget: p.budget ?? 0,
      startDate: p.startDate || "",
      endDate: p.endDate || "",
      note:p.note||"",
      files: {
        Ritningar: Array.isArray(files.Ritningar)? files.Ritningar.slice():[],
        Offerter:  Array.isArray(files.Offerter)?  files.Offerter.slice():[],
        Kalkyler:  Array.isArray(files.Kalkyler)?  files.Kalkyler.slice():[],
        KMA:       Array.isArray(files.KMA)?       files.KMA.slice():[],
      },
      originatingOfferId: p.originatingOfferId || "",
    });
    setState(s => ({
      ...s,
      projects: (s.projects || []).map(x => x.id === p.id ? { ...x, _shouldOpen: undefined } : x),
    }));
  }, [projects, setState]);

  const list = useMemo(()=>{
    let arr = (projects||[]).filter(p=>!p.deletedAt);
    if (q.trim()){
      const s = q.trim().toLowerCase();
      arr = arr.filter(p => (p.name||"").toLowerCase().includes(s));
    }
    arr.sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""));
    return arr;
  },[projects,q]);

  const openEdit = (p)=>{
    const files = p.files && typeof p.files === "object" ? p.files : { Ritningar:[], Offerter:[], Kalkyler:[], KMA:[] };
    setOpenItem(p);
    setDraft({
      id:p.id,
      name:p.name||"",
      customerId:p.customerId||"",
      status:p.status||"pågående",
      budget: p.budget ?? 0,
      startDate: p.startDate || "",
      endDate: p.endDate || "",
      note:p.note||"",
      files: {
        Ritningar: Array.isArray(files.Ritningar)? files.Ritningar.slice():[],
        Offerter:  Array.isArray(files.Offerter)?  files.Offerter.slice():[],
        Kalkyler:  Array.isArray(files.Kalkyler)?  files.Kalkyler.slice():[],
        KMA:       Array.isArray(files.KMA)?       files.KMA.slice():[],
      },
      originatingOfferId: p.originatingOfferId || "",
    });
  };
  const updateDraft = (k,v)=> setDraft(d=>({ ...d, [k]: v }));
  const updateFiles = (cat, files)=> setDraft(d=>({ ...d, files: { ...d.files, [cat]: files }}));

  const addFiles = async (cat)=>{
    try{
      const picked = await pickOneDriveFiles();
      if (!picked || picked.length===0) return;
      const next = (draft.files[cat]||[]).concat(
        picked.map(p=>({ id:p.id||Math.random().toString(36).slice(2), name:p.name||"fil", webUrl:p.webUrl||p.url||"#" }))
      );
      updateFiles(cat, next);
    }catch(e){
      alert("Kunde inte hämta filer från OneDrive.");
      console.warn(e);
    }
  };
  const removeFile = (cat, idx)=>{
    const next = (draft.files[cat]||[]).slice();
    next.splice(idx,1);
    updateFiles(cat, next);
  };

  const saveDraft = ()=>{
    if(!draft) return;
    setState(s=>({
      ...s,
      projects:(s.projects||[]).map(p=>p.id===draft.id ? {
        ...p,
        name:draft.name||"",
        customerId:draft.customerId||"",
        status:draft.status||"pågående",
        budget:Number(draft.budget)||0,
        startDate: draft.startDate||"",
        endDate: draft.endDate||"",
        note:draft.note||"",
        files:{
          Ritningar: draft.files.Ritningar||[],
          Offerter:  draft.files.Offerter||[],
          Kalkyler:  draft.files.Kalkyler||[],
          KMA:       draft.files.KMA||[],
        },
        originatingOfferId: draft.originatingOfferId||"",
        updatedAt:new Date().toISOString()
      } : p)
    }));
    setOpenItem(null); setDraft(null);
  };

  const softDelete = (p)=>{
    setState(s=>({...s, projects:(s.projects||[]).map(x=>x.id===p.id?{...x,deletedAt:new Date().toISOString()}:x)}));
    if(openItem?.id===p.id){ setOpenItem(null); setDraft(null); }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Projekt</h2>
        <input className="border rounded-xl px-3 py-2" placeholder="Sök..." value={q} onChange={e=>setQ(e.target.value)} />
      </div>

      <ul className="divide-y">
        {list.map(p=>(
          <li key={p.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1" onClick={()=>openEdit(p)}>
                <div className="font-medium truncate">{p.name||"Projekt"}</div>
                <div className="text-xs text-gray-500">Kund: {customerName(p.customerId)} · {p.status||"pågående"}</div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{(p.budget||0).toLocaleString("sv-SE")} kr</span>
                <button className="text-xs px-2 py-1 rounded bg-rose-500 text-white" onClick={()=>softDelete(p)}>Ta bort</button>
              </div>
            </div>
          </li>
        ))}
        {list.length===0 && <li className="py-6 text-sm text-gray-500">Inga projekt.</li>}
      </ul>

      {openItem && draft && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={()=>{ setOpenItem(null); setDraft(null); }}>
          <div className="bg-white rounded-2xl shadow p-4 w-full max-w-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Redigera projekt</div>
              <button className="text-sm" onClick={()=>{ setOpenItem(null); setDraft(null); }}>Stäng</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Namn</label>
                <input className="w-full border rounded px-3 py-2" value={draft.name} onChange={e=>updateDraft("name", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Kund</label>
                <select className="w-full border rounded px-3 py-2" value={draft.customerId} onChange={e=>updateDraft("customerId", e.target.value)}>
                  <option value="">—</option>
                  {customers.map(c=><option key={c.id} value={c.id}>{c.companyName||c.id}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select className="w-full border rounded px-3 py-2" value={draft.status} onChange={e=>updateDraft("status", e.target.value)}>
                  <option value="pågående">pågående</option>
                  <option value="klar">klar</option>
                  <option value="pausad">pausad</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Budget (kr)</label>
                <input type="number" className="w-full border rounded px-3 py-2" value={draft.budget} onChange={e=>updateDraft("budget", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Start</label>
                <input type="date" className="w-full border rounded px-3 py-2" value={draft.startDate} onChange={e=>updateDraft("startDate", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Slut</label>
                <input type="date" className="w-full border rounded px-3 py-2" value={draft.endDate} onChange={e=>updateDraft("endDate", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Anteckning</label>
                <textarea className="w-full border rounded px-3 py-2 min-h-[80px]" value={draft.note} onChange={e=>updateDraft("note", e.target.value)} />
              </div>
            </div>

            {/* Filer per kategori */}
            <div className="mt-4 space-y-3">
              {CATS.map(cat=>(
                <div key={cat} className="border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{cat}</div>
                    <button className="text-xs px-2 py-1 rounded border" onClick={()=>addFiles(cat)}>+ Lägg till från OneDrive</button>
                  </div>
                  {(draft.files[cat]||[]).length===0 ? (
                    <div className="text-xs text-gray-500">Inga filer.</div>
                  ) : (
                    <ul className="text-sm space-y-1">
                      {draft.files[cat].map((f,idx)=>(
                        <li key={f.id||idx} className="flex items-center justify-between gap-2">
                          <a className="underline truncate" href={f.webUrl||"#"} target="_blank" rel="noreferrer">{f.name||"fil"}</a>
                          <button className="text-xs px-2 py-1 rounded bg-rose-500 text-white" onClick={()=>removeFile(cat, idx)}>Ta bort</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={saveDraft}>Spara</button>
              <button className="px-3 py-2 rounded bg-rose-600 text-white" onClick={()=>softDelete(openItem)}>Ta bort</button>
              <button className="ml-auto px-3 py-2 rounded border" onClick={()=>{ setOpenItem(null); setDraft(null); }}>Avbryt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===========================
   App — default export med layout
   =========================== */
export default function App() {
  const [state, setState] = useStore();
  const [view, setView] = useState("activities"); // activities | customers | suppliers | offers | projects

  const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

  function createActivity() {
    const id = newId();
    const a = {
      id,
      title: "",
      responsible: "Övrig",
      priority: "medium",
      status: "",
      dueDate: "",
      dueTime: "",
      description: "",
      customerId: "",
      supplierId: "",
      contactName: "",
      isPhone: false,
      isEmail: false,
      isLunch: false,
      isMeeting: false,
      createdAt: new Date().toISOString(),
      _shouldOpen: true, // öppna popup direkt
    };
    setState(s => ({ ...s, activities: [...(s.activities || []), a] }));
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
      files: { Ritningar:[], Offerter:[], Kalkyler:[], KMA:[] },
      createdAt: new Date().toISOString(),
      _shouldOpen: true, // öppna popup direkt
    };
    setState(s => ({ ...s, offers: [...(s.offers || []), o] }));
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
      files: { Ritningar:[], Offerter:[], Kalkyler:[], KMA:[] },
      createdAt: new Date().toISOString(),
      _shouldOpen: true, // öppna popup direkt
    };
    setState(s => ({ ...s, projects: [...(s.projects || []), p] }));
    setView("projects");
  }

  function createCustomer() {
    const id = newId();
    const c = { id, type: "customer", companyName: "Ny kund", createdAt: new Date().toISOString(), customerCategory:"" };
    setState(s => ({ ...s, entities: [...(s.entities || []), c] }));
    setView("customers");
  }

  function createSupplier() {
    const id = newId();
    const sup = { id, type: "supplier", companyName: "Ny leverantör", createdAt: new Date().toISOString(), supplierCategory:"" };
    setState(s => ({ ...s, entities: [...(s.entities || []), sup] }));
    setView("suppliers");
  }

  return (
    <div className="mx-auto max-w-7xl p-4">
      {/* HEADER med färgade knappar + inställningsikon */}
      <header className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Mach CRM</h1>
        <div className="flex items-center gap-2">
          <button className="border rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300" onClick={createActivity} title="Skapa ny aktivitet">
            + Ny aktivitet
          </button>
          <button className="border rounded-xl px-3 py-2 bg-orange-300 hover:bg-orange-400" onClick={createOffer} title="Skapa ny offert">
            + Ny offert
          </button>
          <button className="border rounded-xl px-3 py-2 bg-green-200 hover:bg-green-300" onClick={createProjectEmpty} title="Skapa nytt projekt">
            + Nytt projekt
          </button>
          <button className="border rounded-xl px-3 py-2 bg-blue-200 hover:bg-blue-300" onClick={createCustomer} title="Lägg till kund">
            + Ny kund
          </button>
          <button className="border rounded-xl px-3 py-2 bg-amber-200 hover:bg-amber-300" onClick={createSupplier} title="Lägg till leverantör">
            + Ny leverantör
          </button>

          {/* Inställningar som ikon */}
          <button
            className="ml-2 border rounded-xl px-3 py-2 hover:bg-gray-50"
            onClick={()=>alert("Inställningar flyttas hit i nästa steg (backup, import/export, OneDrive mm).")}
            title="Inställningar"
          >
            🛠️
          </button>
        </div>
      </header>

      {/* LAYOUT: vänster sidomeny + höger innehåll */}
      <div className="grid grid-cols-12 gap-4">
        {/* SIDOMENY (vänster) */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <div className="bg-white rounded-2xl shadow p-3 space-y-2">
            {[
              ["activities","Aktiviteter"],
              ["customers","Kunder"],
              ["suppliers","Leverantörer"],
              ["offers","Offerter"],
              ["projects","Projekt"],
            ].map(([k,label])=>(
              <button
                key={k}
                className={`w-full text-left px-3 py-2 rounded-xl border ${view===k? "bg-black text-white":"bg-white text-gray-800 hover:bg-gray-50"}`}
                onClick={()=>setView(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </aside>

        {/* INNEHÅLL (höger) */}
        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          {view==="activities" && (
            <ActivitiesPanelNew
              activities={state.activities || []}
              entities={state.entities || []}
              setState={setState}
            />
          )}

          {view==="customers" && (
            <CustomersPanel
              entities={state.entities || []}
              setState={setState}
            />
          )}

          {view==="suppliers" && (
            <SuppliersPanel
              entities={state.entities || []}
              setState={setState}
            />
          )}

          {view==="offers" && (
            <OffersPanel
              offers={state.offers || []}
              entities={state.entities || []}
              setState={setState}
            />
          )}

          {view==="projects" && (
            <ProjectsPanel
              projects={state.projects || []}
              setState={setState}
              entities={state.entities || []} // för kundnamn i listan
            />
          )}
        </main>
      </div>
    </div>
  );
}
