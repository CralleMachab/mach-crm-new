// src/App.jsx — Safe baseline som inte kan krascha på undefined handlers
import React, { useEffect, useMemo, useState } from "react";

/* === Minimal local storage (enkel & robust) === */
const LS_KEY = "mach_crm_state_v1";
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : { entities: [] };
  } catch {
    return { entities: [] };
  }
}
function saveState(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}
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

/* === UI helpers === */
function entityLabel(t) { return t === "customer" ? "Kund" : "Leverantör"; }
function useStore() {
  const [state, setState] = useState(() => loadState());
  useEffect(() => { saveState(state); }, [state]);
  return [state, setState];
}

export default function App() {
  const [state, setState] = useStore();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // { kind:'entity', id }

  // --- ENDA knapparna vi har: Ny kund / Ny leverantör
  function createEntitySafe(type) {
    const e = newEntity(type);
    setState((s) => {
      const nxt = { ...s, entities: [...(s.entities || [])] };
      upsertEntity(nxt, e);
      return nxt;
    });
    setModal({ kind: "entity", id: e.id });
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
    const base = arr.slice().sort((a, b) => a.companyName.localeCompare(b.companyName || "", "sv"));
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

  function openEntity(id) { setModal({ kind: "entity", id }); }
  function closeModal() { setModal(null); }

  return (
    <div className="mx-auto max-w-7xl p-4">
      {/* HEADER — endast säkra knappar */}
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
          <button className="border rounded-xl px-3 py-2" onClick={() => createEntitySafe("customer")}>
            + Ny kund
          </button>
          <button className="border rounded-xl px-3 py-2" onClick={() => createEntitySafe("supplier")}>
            + Ny leverantör
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="space-y-4">
          <input
            className="w-full border rounded-xl px-3 py-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök: företagsnamn eller kontaktperson…"
          />

          <ListCard
            title="Kunder"
            count={customers.length}
            items={filtered(customers)}
            onOpen={openEntity}
          />

          <ListCard
            title="Leverantörer"
            count={suppliers.length}
            items={filtered(suppliers)}
            onOpen={openEntity}
          />
        </section>

        {/* Högerdel kan fyllas senare (aktiviteter, projekt, offerter). Nu tom för att undvika #300 */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-600">
            Välkommen! Denna säkra basversion visar Kunder/Leverantörer. Vi lägger tillbaka
            Aktiviteter/Offerter/Projekt stegvis när grunden är stabil.
          </div>
        </section>
      </div>

      {modal && modal.kind === "entity" && (
        <Modal onClose={closeModal}>
          <EntityCard state={state} setState={setState} id={modal.id} />
        </Modal>
      )}
    </div>
  );
}

/* === UI-komponenter (enkla & säkra) === */

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

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl">
          <div className="p-4 border-b flex items-center justify-end sticky top-0 bg-white z-10">
            <button className="border rounded-xl px-3 py-2" onClick={onClose}>
              Stäng
            </button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function EntityCard({ state, setState, id }) {
  const entity = (state.entities || []).find((x) => x.id === id);
  const [local, setLocal] = useState(entity || null);
  const [isEdit, setIsEdit] = useState(true); // Ny: börja i redigeringsläge
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
      return {
        ...x,
        contacts,
      };
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
            <button className="border rounded-xl px-3 py-2" onClick={() => setIsEdit(true)}>
              Redigera
            </button>
          ) : (
            <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>
              Spara
            </button>
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
            <select
              className="border rounded-xl px-2 py-2"
              value={activeId || ""}
              onChange={(e) => setActiveId(e.target.value)}
            >
              {(local.contacts || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || "(namn saknas)"}
                </option>
              ))}
            </select>
            <button className="border rounded-xl px-3 py-2" onClick={onAddContact}>
              + Lägg till
            </button>
          </div>
        </div>

        {active ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Namn" value={active.name} disabled={!isEdit} onChange={(v) => updateContact(active.id, "name", v)} />
            <Field label="Roll" value={active.role} disabled={!isEdit} onChange={(v) => updateContact(active.id, "role", v)} />
            <Field label="Telefon" value={active.phone} disabled={!isEdit} onChange={(v) => updateContact(active.id, "phone", v)} />
            <Field label="E-post" value={active.email} disabled={!isEdit} onChange={(v) => updateContact(active.id, "email", v)} />
          </div>
        ) : (
          <div className="text-sm text-gray-500">Ingen kontakt vald. Lägg till en kontaktperson.</div>
        )}
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
