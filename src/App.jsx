// src/App.jsx — Bas + Aktiviteter (stabil)
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
    id, type, companyName: "", orgNo: "", phone: "", email: "",
    address: "", zip: "", city: "", notes: "",
    contacts: [], activeContactId: null, createdAt: new Date().toISOString(),
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
    // koppling
    linkKind: "customer", // "customer" | "supplier"
    linkId: null,         // entity.id
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

/* ========= App ========= */
export default function App() {
  const [state, setState] = useStore();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // { kind:'entity'|'activity', id }

  // Skapa entiteter (säkra)
  function createEntitySafe(type) {
    const e = newEntity(type);
    setState((s) => {
      const nxt = { ...s, entities: [...(s.entities || [])] };
      upsertEntity(nxt, e);
      return nxt;
    });
    setModal({ kind: "entity", id: e.id });
  }

  // Skapa aktivitet
  function createActivitySafe() {
    const a = newActivity();
    setState((s) => ({ ...s })); // inget att spara ännu
    setModal({ kind: "activity", id: a.id, draft: a }); // draft hålls i modal tills "Spara"
  }

  const customers = useMemo(
    () => (state.entities || []).filter((e) => e.type === "customer"),
    [state.entities]
  );
  const suppliers = useMemo(
    () => (state.entities || []).filter((e) => e.type === "supplier"),
    [state.entities]
  );

  const filtered = (arr) => {
    const q = search.trim().toLowerCase();
    const base = arr.slice().sort((a, b) => (a.companyName || "").localeCompare(b.companyName || "", "sv"));
    if (!q) return base;
    return base.filter((e) => {
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

  // Aktiviteter: kommande 7 dagar, sorterade
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

  return (
    <div className="mx-auto max-w-7xl p-4">
      {/* HEADER — säkra knappar */}
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
          <button className="border rounded-xl px-3 py-2" onClick={() => createActivitySafe()}>+ Ny aktivitet</button>
          <button className="border rounded-xl px-3 py-2" onClick={() => createEntitySafe("customer")}>+ Ny kund</button>
          <button className="border rounded-xl px-3 py-2" onClick={() => createEntitySafe("supplier")}>+ Ny leverantör</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vänster: Sök + listor */}
        <section className="space-y-4">
          <input
            className="w-full border rounded-xl px-3 py-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök: företagsnamn eller kontaktperson…"
          />

          <ListCard title="Kunder" count={customers.length} items={filtered(customers)} onOpen={openEntity} />
          <ListCard title="Leverantörer" count={suppliers.length} items={filtered(suppliers)} onOpen={openEntity} />
        </section>

        {/* Höger: Aktiviteter (kommande 7 dagar) */}
        <section className="lg:col-span-2 space-y-4">
          <ActivitiesPanel
            activities={upcoming7}
            entities={state.entities}
            onOpen={openActivity}
            onCreate={createActivitySafe}
          />
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
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{e.companyName || "(namn saknas)"}</div>
                <div className="text-xs text-gray-500">
                  {[e.orgNo, e.email || e.phone].filter(Boolean).join(" • ")}
                </div>
              </div>
              <div className="text-xs text-gray-500">{e.type === "customer" ? "Kund" : "Lev."}</div>
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
  // draft används när man skapar ny – annars finns i state.activities
  const fromState = (state.activities || []).find((a) => a.id === id) || null;
  const [local, setLocal] = useState(fromState || draft || newActivity());
  const [isEdit, setIsEdit] = useState(true); // skapa/redigera direkt

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

          {/* Typ (ikoner) */}
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
