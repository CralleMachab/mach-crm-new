// src/App.jsx — Vänstermeny kvar, toppmeny bort, "+ Ny"-knappar i headern.
// Aktiviteter: ikoner + kryss, prioritetfärger, skapad-datum, datum+tid, ansvarig, anteckningar, koppling (kund/leverantör/övrigt).
// Offerter: "Projekt"-namn, sökbar lev-rullista (multi), per lev: Skickad + Mottaget, status alltid ändringsbar.
// Projekt: visar Vunna offerter + skapa projekt; lista & redigering av projekt.

import React, { useEffect, useMemo, useState } from "react";

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

/* ========== Categories ========== */
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

/* ========== Activities ========== */
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
    types: [], // flera val (telefon/mail/lunch/möte/uppgift)
    priority: "medium",
    dueDate: isoDate,
    dueTime: "09:00",
    responsible: "Cralle",
    notes: "",
    linkKind: "customer", // customer|supplier|other
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

/* ========== Offers ========== */
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
    title: "",            // visas som "Projekt" i UI
    customerId: null,
    supplierItems: [],    // [{supplierId, sent:boolean, received:boolean}]
    status: "draft",      // draft|sent|won|lost
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

/* ========== Projects (enkel MVP) ========== */
function newProjectFromOffer(offer, customer) {
  const id = crypto?.randomUUID?.() || String(Date.now() + Math.random());
  return {
    id,
    name: offer?.title || `Projekt #${offer?.number || ""}`,
    customerId: offer?.customerId || null,
    offerId: offer?.id || null,
    status: "Planering",
    startDate: "",
    endDate: "",
    progress: 0, // %
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
function useStore() {
  const [state, setState] = useState(() => loadState());
  useEffect(() => { saveState(state); }, [state]);
  return [state, setState];
}

/* ========== App ========== */
export default function App() {
  const [state, setState] = useStore();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // {kind:'entity'|'activity'|'offer'|'project', id, draft?}
  const [activeTab, setActiveTab] = useState("activities"); // vänstermenyn styr

  // Skapa-knappar
  function createActivity() {
    const a = newActivity();
    setModal({ kind: "activity", id: a.id, draft: a });
  }
  function createOffer() {
    const o = newOffer(state);
    setModal({ kind: "offer", id: o.id, draft: o });
  }
  function createCustomer(){ const e=newEntity("customer"); setState(s=>{const nxt={...s}; upsertEntity(nxt,e); return nxt;}); setModal({kind:"entity", id:e.id}); }
  function createSupplier(){ const e=newEntity("supplier"); setState(s=>{const nxt={...s}; upsertEntity(nxt,e); return nxt;}); setModal({kind:"entity", id:e.id}); }
  function createProjectEmpty(){
    const p = newProjectFromOffer(null,null);
    setState(s=>{const nxt={...s, projects:[...(s.projects||[]), p]}; return nxt;});
    setModal({kind:"project", id:p.id});
  }

  // Listor
  const customers = useMemo(()=> (state.entities||[]).filter(e=>e.type==="customer").slice().sort(byName), [state.entities]);
  const suppliers = useMemo(()=> (state.entities||[]).filter(e=>e.type==="supplier").slice().sort(byName), [state.entities]);
  const offers = useMemo(()=> (state.offers||[]).slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)), [state.offers]);
  const wonOffers = useMemo(()=> (state.offers||[]).filter(o=>o.status==="won").slice().sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)), [state.offers]);
  const projects = useMemo(()=> (state.projects||[]).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"","sv")), [state.projects]);

  // Sök filter för listor (kunder/leverantörer)
  const filteredEntities = (arr) => {
    const q = search.trim().toLowerCase();
    if (!q) return arr;
    return arr.filter((e) => {
      const inContacts = (e.contacts || []).some((c) =>
        `${c.name??""} ${c.email??""} ${c.phone??""}`.toLowerCase().includes(q)
      );
      return (
        `${e.companyName??""} ${e.email??""} ${e.phone??""} ${e.orgNo??""}`.toLowerCase().includes(q) || inContacts
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

  // Öppnare
  function openEntity(id){ setModal({kind:"entity", id}); }
  function openActivity(id){ setModal({kind:"activity", id}); }
  function openOffer(id){ setModal({kind:"offer", id}); }
  function openProject(id){ setModal({kind:"project", id}); }
  function closeModal(){ setModal(null); }

  // Mittpanel
  const renderMain = () => {
    if (activeTab === "activities") {
      return <ActivitiesPanel activities={upcoming7} entities={state.entities} onOpen={openActivity} />;
    }
    if (activeTab === "offers") {
      return <OffersPanel offers={offers} entities={state.entities} onOpen={openOffer} />;
    }
    if (activeTab === "projects") {
      return (
        <ProjectsPanel
          projects={projects}
          wonOffers={wonOffers}
          entities={state.entities}
          onOpen={openProject}
          onCreateFromOffer={(offer) => {
            const p = newProjectFromOffer(offer, null);
            setState(s=>{const nxt={...s}; upsertProject(nxt,p); return nxt;});
            setModal({kind:"project", id:p.id});
          }}
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
    return null;
  };

  return (
    <div className="mx-auto max-w-7xl p-4">
      {/* HEADER: logo + "Skapa nytt"-knappar (flyttade hit) */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Mach" className="h-8 w-auto" onError={(e)=>{e.currentTarget.style.display="none";}} />
          <h1 className="text-xl font-semibold">Mach CRM</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="border rounded-xl px-3 py-2" onClick={createActivity}>+ Ny aktivitet</button>
          <button className="border rounded-xl px-3 py-2" onClick={createOffer}>+ Ny offert</button>
          <button className="border rounded-xl px-3 py-2" onClick={createProjectEmpty}>+ Nytt projekt</button>
          <button className="border rounded-xl px-3 py-2" onClick={createCustomer}>+ Ny kund</button>
          <button className="border rounded-xl px-3 py-2" onClick={createSupplier}>+ Ny leverantör</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vänster: meny + sök (toppmenyn är borta) */}
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
                    className={`w-full text-left px-3 py-2 rounded-xl border ${activeTab===item.key ? "bg-black text-white" : "hover:bg-gray-50"}`}
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

        {/* Mitten: 2 kolumner */}
        <section className="lg:col-span-2 space-y-4">
          {renderMain()}
        </section>
      </div>

      {/* Modaler */}
      {modal?.kind === "entity"   && <Modal onClose={closeModal}><EntityCard   state={state} setState={setState} id={modal.id} /></Modal>}
      {modal?.kind === "activity" && <Modal onClose={closeModal}><ActivityCard state={state} setState={setState} id={modal.id} draft={modal.draft||null} onClose={closeModal} /></Modal>}
      {modal?.kind === "offer"    && <Modal onClose={closeModal}><OfferCard    state={state} setState={setState} id={modal.id} draft={modal.draft||null} onClose={closeModal} /></Modal>}
      {modal?.kind === "project"  && <Modal onClose={closeModal}><ProjectCard  state={state} setState={setState} id={modal.id} onClose={closeModal} /></Modal>}
    </div>
  );
}

/* ========== Panels ========== */
function ListCard({ title, count, items, onOpen }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-gray-500">{count} st</span>
      </div>
      <ul className="divide-y">
        {items.map((e) => (
          <li key={e.id} className="py-3 cursor-pointer hover:bg-gray-50 px-2 rounded-xl" onClick={() => onOpen(e.id)}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{e.companyName || "(namn saknas)"}</div>
                <div className="text-xs text-gray-500 truncate">
                  {[e.orgNo, e.email || e.phone].filter(Boolean).join(" • ")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getCategoryBadge(e)}
                <span className="text-xs text-gray-500 shrink-0">{e.type === "customer" ? "Kund" : "Lev."}</span>
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
            const pr = PRIORITIES.find((p) => p.key === a.priority) || PRIORITIES[1];
            return (
              <li key={a.id} className="py-3 cursor-pointer" onClick={() => onOpen(a.id)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1 text-lg">
                      {(a.types || []).map(t => {
                        const m = ACTIVITY_TYPES.find(x=>x.key===t);
                        return <span key={t} title={m?.label || t}>{m?.icon || "📝"}</span>;
                      })}
                      {(a.types || []).length===0 && <span className="text-gray-400">—</span>}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {ent ? `${ent.companyName} (${entityLabel(ent.type)})` : "Övrigt"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDT(a.dueDate, a.dueTime)} • Skapad {formatDT(a.createdAt?.slice(0,10), a.createdAt?.slice(11,16))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${pr.className}`}>{pr.label}</span>
                    <span className="text-xs font-semibold text-gray-700">{a.responsible}</span>
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

/* ========== Modals ========== */
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

/* ========== Entity card ========== */
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

/* ========== Activity card ========== */
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
        {/* 1. Datum då aktiviteten skapades */}
        <div className="text-xs text-gray-500">
          Skapad: {formatDT(local.createdAt?.slice(0,10), local.createdAt?.slice(11,16))}
        </div>

        {/* 2. Vad som ska göras (ikoner med kryss) */}
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

        {/* 3. Prioritet */}
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Prioritet</div>
          <select className="border rounded-xl px-3 py-2" value={local.priority} disabled={!isEdit} onChange={e=>update("priority",e.target.value)}>
            {PRIORITIES.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <span className={`ml-2 text-xs px-2 py-1 rounded ${prMeta.className}`}>{prMeta.label}</span>
        </div>

        {/* 4. Datum + tid */}
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

        {/* 5. Ansvarig */}
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Ansvarig</div>
          <select className="border rounded-xl px-3 py-2" value={local.responsible} disabled={!isEdit} onChange={e=>update("responsible",e.target.value)}>
            {RESPONSIBLES.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* 6. Anteckningar */}
        <TextArea label="Anteckningar" value={local.notes} disabled={!isEdit} onChange={v=>update("notes", v)} />

        {/* 7. Koppling */}
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

/* ========== Offer card ========== */
function OfferCard({ state, setState, id, draft, onClose }) {
  const fromState = (state.offers||[]).find(x=>x.id===id) || null;
  const [local, setLocal] = useState(fromState || draft || newOffer(state));
  const [isEdit, setIsEdit] = useState(true);

  const customers = (state.entities||[]).filter(e=>e.type==="customer").slice().sort(byName);
  const suppliers = (state.entities||[]).filter(e=>e.type==="supplier").slice().sort(byName);

  function update(k,v){ setLocal(x=>({...x,[k]:v})); }
  function persist(next){ setState(s=>{const nxt={...s}; upsertOffer(nxt,next); return nxt;}); }

  // Sökbar multi-select för leverantörer
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

  // Påminnelse → aktivitet
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
        {/* Rad 1: Projekt + Kund + Statusknappar */}
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

        {/* Rad 2: Leverantörer — sökbar rullista, fler kan läggas till; per lev: Skickad + Mottaget */}
        <div className="space-y-2">
          <div className="text-sm font-semibold">Leverantörer</div>
          <div className="flex gap-2 items-center">
            <input
              className="border rounded-xl px-3 py-2 w-full"
              placeholder="Sök leverantör…"
              value={supSearch}
              disabled={!isEdit}
              onChange={(e)=>setSupSearch(e.target.value)}
            />
            <div className="relative">
              {isEdit && supSearch && (
                <div className="absolute z-10 bg-white border rounded-xl shadow max-h-48 overflow-auto w-64">
                  {filteredSup.length ? filteredSup.map(s=>(
                    <button key={s.id} className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={()=>addSupplier(s.id)}>
                      {s.companyName}
                    </button>
                  )) : <div className="px-3 py-2 text-sm text-gray-500">Inga träffar</div>}
                </div>
              )}
            </div>
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

        {/* Rad 3: Påminnelse + Anteckningar */}
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

/* ========== Project card (enkel) ========== */
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

/* ========== Small inputs ========== */
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
