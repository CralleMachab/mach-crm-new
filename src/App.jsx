// src/App.jsx — Meny + Aktiviteter + Kunder/Leverantörer + OFFERTER (#31500, statusfärger, leverantörer, påminnelse)
// Flyttat: "Skapa nytt"-knappar till en verktygsrad ovanför stora rutan (inte i vänsterkolumnen)

import React, { useEffect, useMemo, useState } from "react";

/* ========= Lagring (localStorage) ========= */
const LS_KEY = "mach_crm_state_v1";
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : { entities: [], activities: [], offers: [], projects: [] };
  } catch {
    return { entities: [], activities: [], offers: [], projects: [] };
  }
}
function saveState(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

/* ========= Entities (Kunder/Leverantörer) ========= */
function newEntity(type) {
  const id = (crypto?.randomUUID?.() || String(Date.now() + Math.random()));
  return {
    id, type,
    companyName: "", orgNo: "", phone: "", email: "",
    address: "", zip: "", city: "", notes: "",
    customerCategory: null,  // 'stalhall' | 'totalentreprenad' | 'turbovex'
    supplierCategory: null,  // 'stalhallslev' | 'mark' | 'el' | 'vvs' | 'vent'
    contacts: [], activeContactId: null,
    createdAt: new Date().toISOString(),
  };
}
function upsertEntity(state, entity) {
  const i = state.entities.findIndex((e) => e.id === entity.id);
  if (i === -1) state.entities.push(entity);
  else state.entities[i] = entity;
}
function entityLabel(t) { return t === "customer" ? "Kund" : "Leverantör"; }

/* ========= Aktiviteter ========= */
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
  const id = (crypto?.randomUUID?.() || String(Date.now() + Math.random()));
  const now = new Date();
  const isoDate = now.toISOString().slice(0,10);
  const time = "09:00";
  return {
    id,
    createdAt: new Date().toISOString(),
    title: "",
    type: "uppgift",
    priority: "medium",
    dueDate: isoDate,
    dueTime: time,
    responsible: "Cralle",
    notes: "",
    linkKind: "customer",
    linkId: null,
  };
}
function upsertActivity(state, activity) {
  const i = state.activities.findIndex((a) => a.id === activity.id);
  if (i === -1) state.activities.push(activity);
  else state.activities[i] = activity;
}

/* ========= Kategori metadata ========= */
const CUSTOMER_CATS = [
  { key: "stalhall",        label: "Stålhall",        className: "bg-gray-100 text-gray-800" },
  { key: "totalentreprenad",label: "Totalentreprenad",className: "bg-orange-100 text-orange-800" },
  { key: "turbovex",        label: "Turbovex",        className: "bg-blue-100 text-blue-800" },
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

/* ========= Offerter ========= */
const OFFER_STATUS_META = {
  draft:   { label: "Utkast",   className: "bg-gray-100 text-gray-800" },
  sent:    { label: "Skickad",  className: "bg-orange-100 text-orange-800" },
  won:     { label: "Vunnen",   className: "bg-green-100 text-green-800" },
  lost:    { label: "Förlorad", className: "bg-rose-100 text-rose-800" },
};

function nextOfferNumber(state) {
  const base = 31500;
  const nums = (state.offers || [])
    .map(o => o.number || 0)
    .filter(n => typeof n === "number" && n >= base);
  if (nums.length === 0) return base;
  return Math.max(...nums) + 1;
}
function newOffer(state) {
  const id = (crypto?.randomUUID?.() || String(Date.now() + Math.random()));
  return {
    id,
    number: nextOfferNumber(state), // 31500++
    title: "",
    customerId: null,
    supplierItems: [], // [{supplierId, received:boolean}]
    status: "draft",   // draft|sent|won|lost
    reminderDate: "",  // YYYY-MM-DD
    reminderTime: "",  // HH:mm
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: null,
    activityId: null,  // kopplad aktivitet för påminnelse
  };
}
function upsertOffer(state, offer) {
  const i = state.offers.findIndex(o => o.id === offer.id);
  if (i === -1) state.offers.push(offer);
  else state.offers[i] = offer;
}

/* ========= (Stub) Projekt ========= */
// Knappen visas men är avstängd tills projektflödet implementeras i nästa steg.

/* ========= Hjälpare ========= */
function useStore() {
  const [state, setState] = useState(() => loadState());
  useEffect(() => { saveState(state); }, [state]);
  return [state, setState];
}
function formatDT(dateStr, timeStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
  return d.toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: timeStr ? "short" : undefined });
}
function withinNext7Days(a) {
  if (!a.dueDate) return false;
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const due = new Date(`${a.dueDate}T${a.dueTime || "00:00"}`);
  return due >= start && due <= end;
}

/* ========= App ========= */
export default function App() {
  const [state, setState] = useStore();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // { kind:'entity'|'activity'|'offer', id, draft? }
  const [activeTab, setActiveTab] = useState("activities"); // activities|offers|projects|customers|suppliers

  // Skapa
  function createEntitySafe(type) {
    const e = newEntity(type);
    setState((s) => {
      const nxt = { ...s, entities: [...(s.entities || [])] };
      upsertEntity(nxt, e);
      return nxt;
    });
    setActiveTab(type === "customer" ? "customers" : "suppliers");
    setModal({ kind: "entity", id: e.id });
  }
  function createActivitySafe() {
    const a = newActivity();
    setState((s) => ({ ...s })); // draft i modal
    setActiveTab("activities");
    setModal({ kind: "activity", id: a.id, draft: a });
  }
  function createOfferSafe() {
    const o = newOffer(state);
    setState((s) => ({ ...s })); // draft i modal
    setActiveTab("offers");
    setModal({ kind: "offer", id: o.id, draft: o });
  }

  // Listor
  const customers = useMemo(
    () => (state.entities || []).filter((e) => e.type === "customer")
      .slice().sort((a,b)=>(a.companyName||"").localeCompare(b.companyName||"", "sv")),
    [state.entities]
  );
  const suppliers = useMemo(
    () => (state.entities || []).filter((e) => e.type === "supplier")
      .slice().sort((a,b)=>(a.companyName||"").localeCompare(b.companyName||"", "sv")),
    [state.entities]
  );
  const offers = useMemo(
    () => (state.offers || []).slice().sort((a,b)=>
      new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    ), [state.offers]
  );

  const filteredEntities = (arr) => {
    const q = search.trim().toLowerCase();
    if (!q) return arr;
    return arr.filter((e) => {
      const inContacts = (e.contacts || []).some((c) =>
        `${c.name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q)
      );
      return (
        `${e.companyName ?? ""} ${e.email ?? ""} ${e.phone ?? ""} ${e.orgNo ?? ""}`
          .toLowerCase()
          .includes(q) || inContacts
      );
    });
  };

  // Aktiviteter kommande 7 dagar
  const upcoming7 = useMemo(() => {
    const list = (state.activities || []).filter(withinNext7Days);
    return list.sort((a, b) => {
      const da = new Date(`${a.dueDate}T${a.dueTime || "00:00"}`).getTime();
      const db = new Date(`${b.dueDate}T${b.dueTime || "00:00"}`).getTime();
      return da - db;
    });
  }, [state.activities]);

  // Öppna/close
  function openEntity(id) { setModal({ kind: "entity", id }); }
  function openActivity(id) { setModal({ kind: "activity", id }); }
  function openOffer(id) { setModal({ kind: "offer", id }); }
  function closeModal() { setModal(null); }

  // Mittkolumn
  const renderMain = () => {
    if (activeTab === "activities") {
      return (
        <ActivitiesPanel
          activities={upcoming7}
          entities={state.entities}
          onOpen={openActivity}
        />
      );
    }
    if (activeTab === "offers") {
      return (
        <OffersPanel
          offers={offers}
          entities={state.entities}
          onOpen={openOffer}
        />
      );
    }
    if (activeTab === "customers") {
      const items = filteredEntities(customers);
      return <ListCard title="Kunder" count={items.length} items={items} onOpen={openEntity} />;
    }
    if (activeTab === "suppliers") {
      const items = filteredEntities(suppliers);
      return <ListCard title="Leverantörer" count={items.length} items={items} onOpen={openEntity} />;
    }
    if (activeTab === "projects") {
      return (
        <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-600">
          <div className="text-lg font-semibold mb-2">Projekt</div>
          <div>Kommer efter Offerter (med koppling till <span className="font-medium">Vunnen offert</span>).</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="mx-auto max-w-7xl p-4">
      {/* HEADER med meny */}
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Mach Entreprenad"
            className="h-8 w-auto"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <h1 className="text-xl font-semibold">Mach CRM</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="border rounded-xl px-3 py-2" onClick={() => setActiveTab("activities")}>Aktiviteter</button>
          <button className="border rounded-xl px-3 py-2" onClick={() => setActiveTab("offers")}>Offerter</button>
          <button className="border rounded-xl px-3 py-2" onClick={() => setActiveTab("projects")}>Projekt</button>
          <button className="border rounded-xl px-3 py-2" onClick={() => setActiveTab("customers")}>Kunder</button>
          <button className="border rounded-xl px-3 py-2" onClick={() => setActiveTab("suppliers")}>Leverantörer</button>
        </div>
      </header>

      {/* NY: Verktygsrad med "Skapa nytt" ovanför stora rutan */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="border rounded-xl px-3 py-2" onClick={() => createActivitySafe()}>+ Ny aktivitet</button>
        <button className="border rounded-xl px-3 py-2" onClick={() => createOfferSafe()}>+ Ny offert</button>
        <button
          className="border rounded-xl px-3 py-2 opacity-60 cursor-not-allowed"
          title="Kommer i nästa steg"
          disabled
        >
          + Nytt projekt
        </button>
        <button className="border rounded-xl px-3 py-2" onClick={() => createEntitySafe("customer")}>+ Ny kund</button>
        <button className="border rounded-xl px-3 py-2" onClick={() => createEntitySafe("supplier")}>+ Ny leverantör</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vänsterkolumn = meny/sök (OBS: ingen "Skapa nytt" här längre) */}
        <aside className="space-y-3">
          <nav className="bg-white rounded-2xl shadow p-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">Meny</div>
            <ul className="space-y-1">
              {[
                { key:"activities", label:"Aktiviteter" },
                { key:"offers",     label:"Offerter" },
                { key:"projects",   label:"Projekt" },
                { key:"customers",  label:"Kunder" },
                { key:"suppliers",  label:"Leverantörer" },
              ].map(item => (
                <li key={item.key}>
                  <button
                    onClick={() => setActiveTab(item.key)}
                    className={`w-full text-left px-3 py-2 rounded-xl border ${
                      activeTab === item.key ? "bg-black text-white" : "hover:bg-gray-50"
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="bg-white rounded-2xl shadow p-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">Sök</div>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Företagsnamn eller kontaktperson…"
            />
          </div>
        </aside>

        {/* Mittkolumn (2 spalter) växlar beroende på menyval */}
        <section className="lg:col-span-2 space-y-4">
          {renderMain()}
        </section>
      </div>

      {modal?.kind === "entity" && (
        <Modal onClose={() => setModal(null)}>
          <EntityCard state={state} setState={setState} id={modal.id} />
        </Modal>
      )}
      {modal?.kind === "activity" && (
        <Modal onClose={() => setModal(null)}>
          <ActivityCard state={state} setState={setState} id={modal.id} draft={modal.draft || null} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.kind === "offer" && (
        <Modal onClose={() => setModal(null)}>
          <OfferCard state={state} setState={setState} id={modal.id} draft={modal.draft || null} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ========= UI-komponenter ========= */

function ListCard({ title, count, items, onOpen }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-gray-500">{count} st</span>
      </div>
      <ul className="divide-y">
        {items.map((e) => (
          <li
            key={e.id}
            className="py-3 cursor-pointer hover:bg-gray-50 px-2 rounded-xl"
            onClick={() => onOpen(e.id)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{e.companyName || "(namn saknas)"}</div>
                <div className="text-xs text-gray-500 truncate">
                  {[e.orgNo, e.email || e.phone].filter(Boolean).join(" • ")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getCategoryBadge(e)}
                <span className="text-xs text-gray-500 shrink-0">
                  {e.type === "customer" ? "Kund" : "Lev."}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivitiesPanel({ activities, entities, onOpen }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Aktiviteter (nästa 7 dagar)</h2>
      </div>
      {activities.length === 0 ? (
        <div className="text-sm text-gray-500">Inga aktiviteter kommande vecka.</div>
      ) : (
        <ul className="divide-y">
          {activities.map((a) => {
            const ent = entities?.find((e) => e.id === a.linkId) || null;
            const type = ACTIVITY_TYPES.find((t) => t.key === a.type);
            const pr = PRIORITIES.find((p) => p.key === a.priority) || PRIORITIES[1];
            return (
              <li key={a.id} className="py-3 cursor-pointer" onClick={() => onOpen(a.id)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{type?.icon || "📝"}</span>
                    <div>
                      <div className="text-sm font-medium">
                        {type?.label || "Aktivitet"}: {a.title || "(utan titel)"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDT(a.dueDate, a.dueTime)} • {ent ? `${ent.companyName} (${entityLabel(ent.type)})` : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${pr.className}`}>{pr.label}</span>
                    <span className="text-xs text-gray-700">{a.responsible}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ========= Offert-panel & kort ========= */

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
                    <div className="font-medium truncate">#{o.number} — {o.title || "(utan titel)"}</div>
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

function OfferCard({ state, setState, id, draft, onClose }) {
  const fromState = (state.offers || []).find((x) => x.id === id) || null;
  const [local, setLocal] = useState(fromState || draft || newOffer(state));
  const [isEdit, setIsEdit] = useState(true);

  const customers = (state.entities || []).filter(e => e.type === "customer")
    .slice().sort((a,b)=>(a.companyName||"").localeCompare(b.companyName||"", "sv"));
  const suppliers = (state.entities || []).filter(e => e.type === "supplier")
    .slice().sort((a,b)=>(a.companyName||"").localeCompare(b.companyName||"", "sv"));

  function update(k, v) { setLocal((x) => ({ ...x, [k]: v })); }

  function toggleSupplier(supplierId, received) {
    setLocal((x) => {
      const exists = (x.supplierItems || []).find(si => si.supplierId === supplierId);
      if (exists) {
        return {
          ...x,
          supplierItems: x.supplierItems.map(si =>
            si.supplierId === supplierId ? { ...si, received } : si
          ),
        };
      }
      return {
        ...x,
        supplierItems: [...(x.supplierItems || []), { supplierId, received }],
      };
    });
  }
  function removeSupplier(supplierId) {
    setLocal(x => ({ ...x, supplierItems: (x.supplierItems || []).filter(si => si.supplierId !== supplierId) }));
  }

  function persistOffer(next) {
    setState((s) => {
      const nxt = { ...s, offers: [...(s.offers || [])] };
      upsertOffer(nxt, next);
      return nxt;
    });
  }
  function upsertReminderActivity(offer) {
    if (!offer.reminderDate) {
      if (offer.activityId) {
        setState((s) => ({
          ...s,
          activities: (s.activities || []).filter(a => a.id !== offer.activityId),
        }));
        persistOffer({ ...offer, activityId: null });
      }
      return;
    }
    const title = `Skicka offert #${offer.number} — ${offer.title || ""}`.trim();
    if (offer.activityId) {
      setState((s) => {
        const ex = (s.activities || []).find(a => a.id === offer.activityId);
        if (!ex) return s;
        const upd = {
          ...ex,
          title,
          type: "uppgift",
          priority: "medium",
          dueDate: offer.reminderDate,
          dueTime: offer.reminderTime || "09:00",
          responsible: ex.responsible || "Cralle",
          linkKind: "customer",
          linkId: offer.customerId || null,
          updatedAt: new Date().toISOString(),
        };
        const list = (s.activities || []).map(a => a.id === upd.id ? upd : a);
        return { ...s, activities: list };
      });
    } else {
      const a = newActivity();
      const ins = {
        ...a,
        title,
        dueDate: offer.reminderDate,
        dueTime: offer.reminderTime || "09:00",
        linkKind: "customer",
        linkId: offer.customerId || null,
      };
      setState((s) => {
        const nxt = { ...s, activities: [...(s.activities || []), ins] };
        const off = { ...offer, activityId: ins.id };
        upsertOffer(nxt, off);
        return nxt;
      });
    }
  }

  function onSave() {
    const toSave = { ...local, updatedAt: new Date().toISOString() };
    if (!toSave.number) toSave.number = nextOfferNumber(state);
    persistOffer(toSave);
    upsertReminderActivity(toSave);
    setIsEdit(false);
  }

  function setStatus(newStatus) {
    const upd = { ...local, status: newStatus, updatedAt: new Date().toISOString() };
    setLocal(upd);
    persistOffer(upd);
  }

  function onDelete() {
    if (!confirm(`Ta bort offert #${local.number}?`)) return;
    setState((s) => ({
      ...s,
      offers: (s.offers || []).filter(o => o.id !== local.id),
      activities: local.activityId
        ? (s.activities || []).filter(a => a.id !== local.activityId)
        : (s.activities || []),
    }));
    onClose?.();
  }

  const statusMeta = OFFER_STATUS_META[local.status || "draft"] || OFFER_STATUS_META.draft;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Offert #{local.number || "—"}</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${statusMeta.className}`}>{statusMeta.label}</span>
          {!isEdit ? (
            <button className="border rounded-xl px-3 py-2" onClick={() => setIsEdit(true)}>Redigera</button>
          ) : (
            <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>
          )}
          <button className="text-red-600 border rounded-xl px-3 py-2" onClick={onDelete}>Ta bort</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 space-y-6">
        {/* Rad 1: Titel + Kund + Statusknappar */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Titel" value={local.title} disabled={!isEdit} onChange={(v)=>update("title", v)} />
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Kund</div>
            <select
              className="border rounded-xl px-3 py-2 w-full"
              value={local.customerId || ""}
              disabled={!isEdit}
              onChange={(e) => update("customerId", e.target.value || null)}
            >
              <option value="">—</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.companyName || "(namn saknas)"}</option>)}
            </select>
          </div>
          <div className="col-span-2 flex flex-wrap gap-2">
            <button
              className={`px-3 py-2 rounded-xl border ${local.status==="sent" ? "bg-orange-500 text-white" : ""}`}
              disabled={!isEdit}
              onClick={()=>setStatus("sent")}
            >Skickad</button>
            <button
              className={`px-3 py-2 rounded-xl border ${local.status==="won" ? "bg-green-600 text-white" : ""}`}
              disabled={!isEdit}
              onClick={()=>setStatus("won")}
            >Vunnen</button>
            <button
              className={`px-3 py-2 rounded-xl border ${local.status==="lost" ? "bg-rose-600 text-white" : ""}`}
              disabled={!isEdit}
              onClick={()=>setStatus("lost")}
            >Förlorad</button>
            <button
              className="px-3 py-2 rounded-xl border ml-auto opacity-60 cursor-not-allowed"
              title="Kommer i nästa steg"
              disabled
            >
              Skapa projekt av denna offert
            </button>
          </div>
        </div>

        {/* Rad 2: Leverantörer (välja & markera mottagen) */}
        <div>
          <div className="text-sm font-semibold mb-2">Leverantörer</div>
          <div className="grid md:grid-cols-2 gap-2">
            {suppliers.map(sup => {
              const cur = (local.supplierItems || []).find(si => si.supplierId === sup.id);
              const checked = !!cur;
              const received = cur?.received || false;
              return (
                <div key={sup.id} className="flex items-center justify-between gap-3 border rounded-xl px-3 py-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={!isEdit}
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) toggleSupplier(sup.id, false);
                        else removeSupplier(sup.id);
                      }}
                    />
                    <span>{sup.companyName || "(namn saknas)"}</span>
                  </label>
                  {checked && (
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        disabled={!isEdit}
                        checked={received}
                        onChange={(e)=>toggleSupplier(sup.id, e.target.checked)}
                      />
                      <span className={received ? "text-green-700" : "text-rose-700"}>
                        {received ? "Offert mottagen" : "Ej mottagen"}
                      </span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rad 3: Påminnelse + Anteckningar */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Påminnelse (datum)</div>
              <input
                type="date"
                className="border rounded-xl px-3 py-2 w-full"
                value={local.reminderDate || ""}
                disabled={!isEdit}
                onChange={(e)=>update("reminderDate", e.target.value)}
              />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Tid</div>
              <input
                type="time"
                className="border rounded-xl px-3 py-2 w-full"
                value={local.reminderTime || ""}
                disabled={!isEdit}
                onChange={(e)=>update("reminderTime", e.target.value)}
              />
            </div>
          </div>
          <TextArea label="Anteckningar" value={local.notes} disabled={!isEdit} onChange={(v)=>update("notes", v)} />
        </div>
      </div>
    </div>
  );
}

/* ========= Modal ========= */
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

/* ========= Entity-kort ========= */
function EntityCard({ state, setState, id }) {
  const entity = (state.entities || []).find((x) => x.id === id);
  const [local, setLocal] = useState(entity || null);
  const [isEdit, setIsEdit] = useState(true); // starta i redigering
  const [activeId, setActiveId] = useState(entity?.activeContactId || entity?.contacts?.[0]?.id || null);

  useEffect(() => {
    setLocal(entity || null);
    setActiveId(entity?.activeContactId || entity?.contacts?.[0]?.id || null);
  }, [id]);

  if (!entity || !local) return null;
  const active = (local.contacts || []).find((c) => c.id === activeId) || null;

  function update(k, v) { setLocal((x) => ({ ...x, [k]: v })); }
  function updateContact(contactId, k, v) {
    setLocal((x) => ({
      ...x,
      contacts: (x.contacts || []).map((c) => (c.id === contactId ? { ...c, [k]: v } : c)),
    }));
  }
  function onSave() {
    const toSave = { ...local, activeContactId: activeId, updatedAt: new Date().toISOString() };
    setState((s) => {
      const nxt = { ...s, entities: [...(s.entities || [])] };
      upsertEntity(nxt, toSave);
      return nxt;
    });
    setIsEdit(false);
  }
  function onAddContact() {
    const id = (crypto?.randomUUID?.() || String(Date.now() + Math.random()));
    const newContact = { id, name: "", role: "", phone: "", email: "" };
    setLocal((x) => ({ ...x, contacts: [...(x.contacts || []), newContact] }));
    if (!activeId) setActiveId(id);
    setIsEdit(true);
  }
  function onDeleteEntity() {
    if (!confirm(`Ta bort ${entityLabel(entity.type).toLowerCase()} "${local.companyName || ""}"? Detta tar även bort kopplade aktiviteter och kopplingar i offerter.`)) return;
    setState((s) => ({
      ...s,
      entities: (s.entities || []).filter((e) => e.id !== entity.id),
      activities: (s.activities || []).filter((a) => a.linkId !== entity.id),
      offers: (s.offers || []).map(o => {
        const upd = { ...o };
        if (o.customerId === entity.id) upd.customerId = null;
        if ((o.supplierItems||[]).some(si => si.supplierId === entity.id)) {
          upd.supplierItems = (o.supplierItems||[]).filter(si => si.supplierId !== entity.id);
        }
        return upd;
      }),
    }));
  }

  const customerCatSel = (
    <div>
      <div className="text-xs font-medium text-gray-600 mb-1">Kategori (kund)</div>
      <select
        className="border rounded-xl px-3 py-2 w-full"
        value={local.customerCategory || ""}
        disabled={!isEdit}
        onChange={(e) => update("customerCategory", e.target.value || null)}
      >
        <option value="">—</option>
        {CUSTOMER_CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
    </div>
  );
  const supplierCatSel = (
    <div>
      <div className="text-xs font-medium text-gray-600 mb-1">Kategori (leverantör)</div>
      <select
        className="border rounded-xl px-3 py-2 w-full"
        value={local.supplierCategory || ""}
        disabled={!isEdit}
        onChange={(e) => update("supplierCategory", e.target.value || null)}
      >
        <option value="">—</option>
        {SUPPLIER_CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">
          {entityLabel(entity.type)}: {local.companyName || "(namn saknas)"}
        </h3>
        <div className="flex gap-2">
          {!isEdit ? (
            <button className="border rounded-xl px-3 py-2" onClick={() => setIsEdit(true)}>Redigera</button>
          ) : (
            <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>
          )}
          <button className="text-red-600 border rounded-xl px-3 py-2" onClick={onDeleteEntity}>Ta bort</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Företag" value={local.companyName} disabled={!isEdit} onChange={(v) => update("companyName", v)} />
          <Field label="Organisationsnummer" value={local.orgNo} disabled={!isEdit} onChange={(v) => update("orgNo", v)} />
          <Field label="Telefon" value={local.phone} disabled={!isEdit} onChange={(v) => update("phone", v)} />
          <Field label="E-post" value={local.email} disabled={!isEdit} onChange={(v) => update("email", v)} />
          <Field label="Adress" value={local.address} disabled={!isEdit} onChange={(v) => update("address", v)} colSpan={2} />
          <Field label="Postnummer" value={local.zip} disabled={!isEdit} onChange={(v) => update("zip", v)} />
          <Field label="Ort" value={local.city} disabled={!isEdit} onChange={(v) => update("city", v)} />
          {entity.type === "customer" ? customerCatSel : supplierCatSel}
          <TextArea label="Anteckningar" value={local.notes} disabled={!isEdit} onChange={(v) => update("notes", v)} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">Kontaktpersoner</h4>
          <div className="flex gap-2">
            <select className="border rounded-xl px-2 py-2" value={activeId || ""} onChange={(e) => setActiveId(e.target.value)}>
              {(local.contacts || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name || "(namn saknas)"}</option>
              ))}
            </select>
            <button className="border rounded-xl px-3 py-2" onClick={onAddContact}>+ Lägg till</button>
          </div>
        </div>

        {active ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Namn" value={active.name} disabled={!isEdit} onChange={(v) => updateContact(active.id, "name", v)} />
            <Field label="Roll" value={active.role} disabled={!isEdit} onChange={(v) => updateContact(active.id, "role", v)} />
            <Field label="Telefon" value={active.phone} disabled={!isEdit} onChange={(v) => updateContact(active.id, "phone", v)} />
            <Field label="E-post" value={active.email} disabled={!isEdit} onChange={(v) => updateContact(active.id, "email", v)} />
          </div>
        ) : <div className="text-sm text-gray-500">Ingen kontakt vald. Lägg till en kontaktperson.</div>}
      </div>
    </div>
  );
}

/* ========= Aktivitet-kort ========= */
function ActivityCard({ state, setState, id, draft, onClose }) {
  const fromState = (state.activities || []).find((a) => a.id === id) || null;
  const [local, setLocal] = useState(fromState || draft || newActivity());
  const [isEdit, setIsEdit] = useState(true);

  function update(k, v) { setLocal((x) => ({ ...x, [k]: v })); }
  function onSave() {
    const toSave = { ...local, updatedAt: new Date().toISOString() };
    setState((s) => {
      const nxt = { ...s, activities: [...(s.activities || [])] };
      upsertActivity(nxt, toSave);
      return nxt;
    });
    setIsEdit(false);
  }
  function onDelete() {
    if (!confirm("Ta bort aktiviteten?")) return;
    setState((s) => ({
      ...s,
      activities: (s.activities || []).filter((a) => a.id !== local.id),
    }));
    onClose?.();
  }

  const entities = state.entities || [];
  const linkedEntity = entities.find((e) => e.id === local.linkId) || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Aktivitet</h3>
        <div className="flex gap-2">
          {!isEdit ? (
            <button className="border rounded-xl px-3 py-2" onClick={() => setIsEdit(true)}>Redigera</button>
          ) : (
            <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>
          )}
          <button className="text-red-600 border rounded-xl px-3 py-2" onClick={onDelete}>Ta bort</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Titel" value={local.title} disabled={!isEdit} onChange={(v) => update("title", v)} />

          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Prioritet</div>
            <select
              className="border rounded-xl px-3 py-2 w-full"
              value={local.priority}
              disabled={!isEdit}
              onChange={(e) => update("priority", e.target.value)}
            >
              {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Datum</div>
              <input
                type="date"
                className="border rounded-xl px-3 py-2 w-full"
                value={local.dueDate || ""}
                disabled={!isEdit}
                onChange={(e) => update("dueDate", e.target.value)}
              />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Tid</div>
              <input
                type="time"
                className="border rounded-xl px-3 py-2 w-full"
                value={local.dueTime || ""}
                disabled={!isEdit}
                onChange={(e) => update("dueTime", e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Ansvarig</div>
            <select
              className="border rounded-xl px-3 py-2 w-full"
              value={local.responsible}
              disabled={!isEdit}
              onChange={(e) => update("responsible", e.target.value)}
            >
              {RESPONSIBLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Typ (koppling)</div>
              <select
                className="border rounded-xl px-3 py-2 w-full"
                value={local.linkKind}
                disabled={!isEdit}
                onChange={(e) => update("linkKind", e.target.value)}
              >
                <option value="customer">Kund</option>
                <option value="supplier">Leverantör</option>
              </select>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Välj {local.linkKind === "customer" ? "kund" : "leverantör"}</div>
              <select
                className="border rounded-xl px-3 py-2 w-full"
                value={local.linkId || ""}
                disabled={!isEdit}
                onChange={(e) => update("linkId", e.target.value || null)}
              >
                <option value="">—</option>
                {(state.entities || [])
                  .filter((e) => e.type === (local.linkKind === "customer" ? "customer" : "supplier"))
                  .map((e) => <option key={e.id} value={e.id}>{e.companyName || "(namn saknas)"}</option>)
                }
              </select>
            </div>
          </div>

          <TextArea label="Anteckningar" value={local.notes} disabled={!isEdit} onChange={(v) => update("notes", v)} />
        </div>

        <div className="text-xs text-gray-500">
          Skapad: {formatDT(local.createdAt?.slice(0,10), local.createdAt?.slice(11,16))} •
          { (state.entities || []).find((e)=>e.id===local.linkId)
            ? ` Kopplad till: ${(state.entities||[]).find((e)=>e.id===local.linkId).companyName} (${entityLabel((state.entities||[]).find((e)=>e.id===local.linkId).type)})`
            : " Ej kopplad" }
        </div>
      </div>
    </div>
  );
}

/* ========= Små inputs ========= */
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
