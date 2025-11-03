// src/App.jsx — Vänstermeny + Aktiviteter + Kunder/Leverantörer + Delete + Kategorier (stabil)
import React, { useEffect, useMemo, useState } from "react";

/* ========= Lagring (localStorage) ========= */
const LS_KEY = "mach_crm_state_v1";
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : { entities: [], activities: [] };
  } catch {
    return { entities: [], activities: [] };
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
    type: "telefon",
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

/* ========= App ========= */
export default function App() {
  const [state, setState] = useStore();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // { kind:'entity'|'activity', id, draft? }
  const [activeTab, setActiveTab] = useState("activities"); // activities|offers|projects|customers|suppliers

  // Skapa entiteter
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

  // Skapa aktivitet
  function createActivitySafe() {
    const a = newActivity();
    setState((s) => ({ ...s }));
    setActiveTab("activities");
    setModal({ kind: "activity", id: a.id, draft: a });
  }

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

  const filtered = (arr) => {
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

  function openEntity(id) { setModal({ kind: "entity", id }); }
  function openActivity(id) { setModal({ kind: "activity", id }); }
  function closeModal() { setModal(null); }

  /* ====== Mittinnehåll växlar på activeTab ====== */
  const renderMain = () => {
    if (activeTab === "activities") {
      return (
        <ActivitiesPanel
          activities={upcoming7}
          entities={state.entities}
          onOpen={openActivity}
          onCreate={createActivitySafe}
        />
      );
    }
    if (activeTab === "customers") {
      const items = filtered(customers);
      return <ListCard title="Kunder" count={items.length} items={items} onOpen={openEntity} />;
    }
    if (activeTab === "suppliers") {
      const items = filtered(suppliers);
      return <ListCard title="Leverantörer" count={items.length} items={items} onOpen={openEntity} />;
    }
    // Placeholder-paneler för att kunna växla redan nu
    if (activeTab === "offers") {
      return (
        <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-600">
          <div className="text-lg font-semibold mb-2">Offerter</div>
          <div>Denna sektion kopplas på i nästa steg (med #31500-serie och statusfärger).</div>
        </div>
      );
    }
    if (activeTab === "projects") {
      return (
        <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-600">
          <div className="text-lg font-semibold mb-2">Projekt</div>
          <div>Denna sektion kopplas på efter Offerter (med koppling till vunnen offert).</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="mx-auto max-w-7xl p-4">
      {/* HEADER */}
      <header className="flex items-center justify-between mb-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vänsterkolumn = din meny (alltid synlig) */}
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

          {/* Snabbknappar */}
          <div className="bg-white rounded-2xl shadow p-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">Skapa nytt</div>
            <div className="grid grid-cols-1 gap-2">
              <button className="border rounded-xl px-3 py-2" onClick={() => createActivitySafe()}>+ Ny aktivitet</button>
              <button className="border rounded-xl px-3 py-2" onClick={() => createEntitySafe("customer")}>+ Ny kund</button>
              <button className="border rounded-xl px-3 py-2" onClick={() => createEntitySafe("supplier")}>+ Ny leverantör</button>
            </div>
          </div>

          {/* Sökfält (påverkar Kunder/Leverantörer) */}
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

      {modal && modal.kind === "entity" && (
        <Modal onClose={closeModal}>
          <EntityCard state={state} setState={setState} id={modal.id} />
        </Modal>
      )}

      {modal && modal.kind === "activity" && (
        <Modal onClose={closeModal}>
          <ActivityCard
            state={state}
            setState={setState}
            id={modal.id}
            draft={modal.draft || null}
            onClose={closeModal}
          />
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

function ActivitiesPanel({ activities, entities, onOpen, onCreate }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Aktiviteter (nästa 7 dagar)</h2>
        <button className="border rounded-xl px-3 py-2" onClick={onCreate}>+ Ny aktivitet</button>
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

/* ========= Kort för Entitet ========= */
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
    setLocal((x) => {
      const contacts = [...(x.contacts || []), newContact];
      return { ...x, contacts };
    });
    if (!activeId) setActiveId(id);
    setIsEdit(true);
  }
  function onDeleteEntity() {
    if (!confirm(`Ta bort ${entityLabel(entity.type).toLowerCase()} "${local.companyName || ""}"? Detta tar även bort kopplade aktiviteter.`)) return;
    setState((s) => ({
      ...s,
      entities: (s.entities || []).filter((e) => e.id !== entity.id),
      activities: (s.activities || []).filter((a) => a.linkId !== entity.id),
    }));
  }

  // kund/leverantör kategori
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

/* ========= Kort för Aktivitet ========= */
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

          {/* Typ */}
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Typ</div>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_TYPES.map((t) => (
                <label key={t.key} className={`px-2 py-1 rounded border cursor-pointer ${local.type === t.key ? "bg-slate-800 text-white" : ""}`}>
                  <input
                    type="radio"
                    className="hidden"
                    checked={local.type === t.key}
                    disabled={!isEdit}
                    onChange={() => update("type", t.key)}
                  />
                  <span className="mr-1">{t.icon}</span>{t.label}
                </label>
              ))}
            </div>
          </div>

          {/* Prioritet */}
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

          {/* Datum + tid */}
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

          {/* Ansvarig */}
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

          {/* Koppling: Kund/Leverantör */}
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

          {/* Anteckningar */}
          <TextArea label="Anteckningar" value={local.notes} disabled={!isEdit} onChange={(v) => update("notes", v)} />
        </div>

        {/* Info-rad */}
        <div className="text-xs text-gray-500">
          Skapad: {formatDT(local.createdAt?.slice(0,10), local.createdAt?.slice(11,16))} •
          {linkedEntity ? ` Kopplad till: ${linkedEntity.companyName} (${entityLabel(linkedEntity.type)})` : " Ej kopplad"}
        </div>
      </div>
    </div>
  );
}

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
