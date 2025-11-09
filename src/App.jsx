import React, { useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "./lib/storage";
import { fetchRemoteState, pushRemoteState } from "./lib/cloud";

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

  useEffect(() => {
    saveState(state);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

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
   ActivitiesPanelNew — ikoner, popup, filter, "Ta bort" i listan
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
   CustomersPanel — sök + kategorifilter
   ====================================== */
function CustomersPanel({ entities = [], setState }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all"); // StålHall | Totalentreprenad | Turbovex | all

  const list = useMemo(() => {
    let arr = (entities || []).filter(e => e.type === "customer");
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

  const setCategory = (id, value) => {
    setState(s => ({
      ...s,
      entities: (s.entities||[]).map(e => e.id===id ? { ...e, customerCategory: value || "" } : e)
    }));
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
              <div className="min-w-0">
                <div className="font-medium truncate">{c.companyName || "(namnlös kund)"}</div>
                <div className="text-xs text-gray-500">{c.city || ""}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select className="text-sm border rounded px-2 py-1"
                        value={c.customerCategory||""}
                        onChange={e=>setCategory(c.id, e.target.value)}>
                  <option value="">— kategori —</option>
                  <option value="StålHall">StålHall</option>
                  <option value="Totalentreprenad">Totalentreprenad</option>
                  <option value="Turbovex">Turbovex</option>
                </select>
              </div>
            </div>
          </li>
        ))}
        {list.length===0 && <li className="py-6 text-sm text-gray-500">Inga kunder.</li>}
      </ul>
    </div>
  );
}

/* ==========================================
   SuppliersPanel — sök + kategorifilter
   ========================================== */
function SuppliersPanel({ entities = [], setState }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all"); // Stålhalls leverantör | Mark företag | EL leverantör | VVS Leverantör | Vent Leverantör | all

  const list = useMemo(() => {
    let arr = (entities || []).filter(e => e.type === "supplier");
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

  const setCategory = (id, value) => {
    setState(s => ({
      ...s,
      entities: (s.entities||[]).map(e => e.id===id ? { ...e, supplierCategory: value || "" } : e)
    }));
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
              <div className="min-w-0">
                <div className="font-medium truncate">{sup.companyName || "(namnlös leverantör)"}</div>
                <div className="text-xs text-gray-500">{sup.city || ""}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select className="text-sm border rounded px-2 py-1"
                        value={sup.supplierCategory||""}
                        onChange={e=>setCategory(sup.id, e.target.value)}>
                  <option value="">— kategori —</option>
                  <option value="Stålhalls leverantör">Stålhalls leverantör</option>
                  <option value="Mark företag">Mark företag</option>
                  <option value="EL leverantör">EL leverantör</option>
                  <option value="VVS Leverantör">VVS Leverantör</option>
                  <option value="Vent Leverantör">Vent Leverantör</option>
                </select>
              </div>
            </div>
          </li>
        ))}
        {list.length===0 && <li className="py-6 text-sm text-gray-500">Inga leverantörer.</li>}
      </ul>
    </div>
  );
}

/* ===========================
   App — default export
   =========================== */
export default function App() {
  const [state, setState] = useStore();
  const [view, setView] = useState("activities"); // activities | customers | suppliers | offers | projects | settings

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
      _shouldOpen: true,
    };
    setState(s => ({ ...s, activities: [...(s.activities || []), a] }));
    setView("activities");
  }

  function createOffer() {
    const id = newId();
    const o = { id, title: "Ny offert", customerId: "", value: 0, status: "utkast", createdAt: new Date().toISOString() };
    setState(s => ({ ...s, offers: [...(s.offers || []), o] }));
    setView("offers");
  }

  function createProjectEmpty() {
    const id = newId();
    const p = { id, name: "Nytt projekt", status: "pågående", createdAt: new Date().toISOString() };
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
      {/* HEADER med färgade knappar */}
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
        </div>
      </header>

      {/* TOPPMENY */}
      <nav className="mb-4">
        <div className="flex flex-wrap gap-2">
          {[
            ["activities","Aktiviteter"],
            ["customers","Kunder"],
            ["suppliers","Leverantörer"],
            ["offers","Offerter"],
            ["projects","Projekt"],
            ["settings","Inställningar"],
          ].map(([k,label])=>(
            <button
              key={k}
              className={`px-3 py-2 rounded-xl border ${view===k? "bg-black text-white":"bg-white text-gray-800 hover:bg-gray-50"}`}
              onClick={()=>setView(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* VYER */}
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
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-2">Offerter</h2>
          <p className="text-sm text-gray-600">Stub-vy (vi bygger detaljer i nästa steg).</p>
        </div>
      )}

      {view==="projects" && (
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-2">Projekt</h2>
          <p className="text-sm text-gray-600">Stub-vy (vi bygger detaljer i nästa steg).</p>
        </div>
      )}

      {view==="settings" && (
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-2">Inställningar</h2>
          <p className="text-sm text-gray-600">Stub-vy – export/import m.m. fyller vi på här.</p>
        </div>
      )}
    </div>
  );
}
