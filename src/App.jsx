// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  loadState, saveState,
  upsertEntity, upsertProject,
  newEntity, newProject,
  setActiveContact, addContact,
  copyAllOfferFilesForCustomerToProject
} from "../lib/storage";

function useStore() {
  const [state, setState] = useState(() => loadState());
  useEffect(() => { saveState(state); }, [state]);
  return [state, setState];
}

function entityLabel(t) { return t === "customer" ? "Kund" : t === "supplier" ? "Leverantör" : "Projekt"; }
function formatDate(iso) { if (!iso) return ""; const d = new Date(iso); return d.toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" }); }
function reminderStatus(r){ const today=new Date(); today.setHours(0,0,0,0); const due=new Date(r.dueDate); due.setHours(0,0,0,0); if(r.done) return "done"; if(due<today) return "overdue"; if(+due===+today) return "today"; return "upcoming"; }

export default function App() {
  const [state, setState] = useStore();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // { kind:'entity'|'project', id }
  const [edit, setEdit] = useState(false);
  const [remFilter, setRemFilter] = useState("all");

  const customers = useMemo(() => (state.entities||[]).filter(e => e.type==="customer"), [state.entities]);
  const suppliers = useMemo(() => (state.entities||[]).filter(e => e.type==="supplier"), [state.entities]);

  const filtered = (arr) => {
    const q = search.trim().toLowerCase();
    if (!q) return arr.sort((a,b)=> a.companyName.localeCompare(b.companyName,"sv"));
    return arr.filter(e=>{
      const inContacts = (e.contacts||[]).some(c=>`${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q));
      return `${e.companyName} ${e.email} ${e.phone} ${e.orgNo}`.toLowerCase().includes(q) || inContacts;
    }).sort((a,b)=> a.companyName.localeCompare(b.companyName,"sv"));
  };

  const allReminders = useMemo(()=>{
    const ent = (state.entities||[]).flatMap(e => (e.reminders||[]).map(r=>({...r, owner:e.companyName, ownerType:e.type, refId:e.id, refKind:"entity"})));
    const proj = (state.projects||[]).flatMap(p => (p.reminders||[]).map(r=>({...r, owner:p.name, ownerType:"project", refId:p.id, refKind:"project"})));
    return [...ent, ...proj];
  }, [state]);
  const pickedRem = useMemo(()=> allReminders.filter(r=> remFilter==="all" ? true : remFilter==="done" ? r.done : reminderStatus(r)===remFilter)
    .sort((a,b)=> new Date(a.dueDate)-new Date(b.dueDate)), [allReminders, remFilter]);

  function openEntity(id){ setModal({kind:"entity", id}); setEdit(false); }
  function openProject(id){ setModal({kind:"project", id}); setEdit(false); }
  function closeModal(){ setModal(null); setEdit(false); }

  function createEntity(type){
    const e = newEntity(type);
    setState(s => { const nxt = {...s}; upsertEntity(nxt, e); return nxt; });
    setTimeout(()=>{ openEntity(e.id); setEdit(true); }, 0);
  }
  function createProject(){
    const firstCust = (state.entities||[]).find(e=>e.type==="customer");
    const p = newProject(firstCust?.id);
    setState(s => { const nxt = {...s}; upsertProject(nxt, p); return nxt; });
    setTimeout(()=>{ openProject(p.id); setEdit(true); }, 0);
  }

  return (
    <div className="mx-auto max-w-7xl p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Mach CRM</h1>
        <div className="flex gap-2">
          <button className="border rounded-xl px-3 py-2" onClick={()=>createEntity("customer")}>+ Ny kund</button>
          <button className="border rounded-xl px-3 py-2" onClick={()=>createEntity("supplier")}>+ Ny leverantör</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="space-y-4">
          <input className="w-full border rounded-xl px-3 py-2" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Sök: företagsnamn eller kontaktperson…" />

          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-2"><h2 className="font-semibold">Kunder</h2><span className="text-xs text-gray-500">{customers.length} st</span></div>
            <ul className="divide-y">
              {filtered(customers).map(e=>{
                const hasOpen = (e.reminders||[]).some(r=>!r.done && ["today","overdue"].includes(reminderStatus(r)));
                return (
                  <li key={e.id} className="py-3 cursor-pointer hover:bg-gray-50 px-2 rounded-xl" onClick={()=>openEntity(e.id)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{e.companyName}</div>
                        <div className="text-xs text-gray-500">{[e.orgNo, e.email||e.phone].filter(Boolean).join(" • ")}</div>
                      </div>
                      <div className="text-xs text-gray-500">{hasOpen ? "• Påm." : ""}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-2"><h2 className="font-semibold">Leverantörer</h2><span className="text-xs text-gray-500">{suppliers.length} st</span></div>
            <ul className="divide-y">
              {filtered(suppliers).map(e=>{
                const hasOpen = (e.reminders||[]).some(r=>!r.done && ["today","overdue"].includes(reminderStatus(r)));
                return (
                  <li key={e.id} className="py-3 cursor-pointer hover:bg-gray-50 px-2 rounded-xl" onClick={()=>openEntity(e.id)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{e.companyName}</div>
                        <div className="text-xs text-gray-500">{[e.orgNo, e.email||e.phone].filter(Boolean).join(" • ")}</div>
                      </div>
                      <div className="text-xs text-gray-500">{hasOpen ? "• Påm." : ""}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="lg:col-span-2 space-y-4">
          <RemindersPanel items={pickedRem} onOpen={(r)=> r.refKind==="entity"? openEntity(r.refId): openProject(r.refId)} setFilter={setRemFilter} />
          <ProjectsPanel projects={state.projects} entities={state.entities} onOpen={openProject} onCreate={createProject} />
        </section>
      </div>

      {modal && (
        <Modal onClose={closeModal}>
          {modal.kind === "entity" ? (
            <EntityCard state={state} setState={setState} id={modal.id} edit={edit} setEdit={setEdit} />
          ) : (
            <ProjectCard state={state} setState={setState} id={modal.id} edit={edit} setEdit={setEdit} />
          )}
        </Modal>
      )}
    </div>
  );
}

// ----- UI bitar

function RemindersPanel({ items, onOpen, setFilter }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Påminnelser (alla)</h2>
        <select onChange={e=>setFilter(e.target.value)} className="border rounded-xl px-2 py-2">
          <option value="all">Alla</option><option value="today">Förfaller idag</option>
          <option value="overdue">Försenade</option><option value="upcoming">Kommande</option><option value="done">Klara</option>
        </select>
      </div>
      <ul className="divide-y">
        {items.map(r=>(
          <li key={`${r.refKind}-${r.refId}-${r.id}`} className="py-3 cursor-pointer" onClick={()=>onOpen(r)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{r.type}: {r.subject||""}</div>
                <div className="text-xs text-gray-500">{formatDate(r.dueDate)} • {r.owner} ({entityLabel(r.ownerType)})</div>
              </div>
              <div className="text-xs">{{today:"Idag",overdue:"Försenad",upcoming:"Kommande",done:"Klar"}[reminderStatus(r)]}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProjectsPanel({ projects, entities, onOpen, onCreate }) {
  const sorted = (projects||[]).slice().sort((a,b)=> a.name.localeCompare(b.name,"sv"));
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Projekt</h2>
        <button className="border rounded-xl px-3 py-2" onClick={onCreate}>+ Nytt projekt</button>
      </div>
      <ul className="divide-y">
        {sorted.map(p=>{
          const cust = entities?.find(e=>e.id===p.customerId);
          return (
            <li key={p.id} className="py-3 cursor-pointer hover:bg-gray-50 px-2 rounded-xl" onClick={()=>onOpen(p.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">{cust? cust.companyName : "—"} • {p.status||""}</div>
                </div>
                <div className="text-xs text-gray-500">{(p.files||[]).length} filer</div>
              </div>
            </li>
          );
        })}
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
            <button className="border rounded-xl px-3 py-2" onClick={onClose}>Stäng</button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function EntityCard({ state, setState, id, edit, setEdit }) {
  const e = state.entities.find(x=>x.id===id);
  const [local, setLocal] = useState(e);
  const [activeId, setActiveId] = useState(e?.activeContactId || e?.contacts?.[0]?.id || null);

  useEffect(()=>{ setLocal(e); setActiveId(e?.activeContactId || e?.contacts?.[0]?.id || null); }, [e?.id]);

  if (!e) return null;
  const active = (local.contacts||[]).find(c=>c.id===activeId) || null;

  function update(k, v){ setLocal(x=>({...x, [k]: v})); }
  function updateContact(id, k, v){
    setLocal(x=>({...x, contacts:(x.contacts||[]).map(c=> c.id===id ? {...c, [k]: v} : c)}));
  }
  function onSave(){
    const toSave = {...local, activeContactId: activeId, updatedAt: new Date().toISOString()};
    setState(s=>{ const nxt={...s}; upsertEntity(nxt, toSave); return nxt; });
    setEdit(false);
  }
  function onAddContact(){
    setState(s => {
      const nxt = {...s};
      const after = addContact(nxt, e.id);
      return {...after};
    });
    // uppdatera local från storage
    setTimeout(()=> {
      const fresh = loadState().entities.find(x=>x.id===e.id);
      setLocal(fresh);
      setActiveId(fresh.activeContactId || fresh.contacts?.[0]?.id || null);
      setEdit(true);
    }, 0);
  }
  function onSetActive(id){
    setActiveId(id);
    setState(s=> ({...setActiveContact({...s}, e.id, id)}));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{entityLabel(e.type)}: {e.companyName}</h3>
        <div className="flex gap-2">
          {!edit ? (
            <button className="border rounded-xl px-3 py-2" onClick={()=>setEdit(true)}>Redigera</button>
          ) : (
            <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Företag" value={local.companyName} disabled={!edit} onChange={v=>update("companyName", v)} />
          <Field label="Organisationsnummer" value={local.orgNo} disabled={!edit} onChange={v=>update("orgNo", v)} />
          <Field label="Telefon" value={local.phone} disabled={!edit} onChange={v=>update("phone", v)} />
          <Field label="E-post" value={local.email} disabled={!edit} onChange={v=>update("email", v)} />
          <Field label="Adress" value={local.address} disabled={!edit} onChange={v=>update("address", v)} colSpan={2} />
          <TextArea label="Anteckningar" value={local.notes} disabled={!edit} onChange={v=>update("notes", v)} />
        </div>
      </div>

      {/* Kontaktpersoner med rullista */}
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">Kontaktpersoner</h4>
          <div className="flex gap-2">
            <select className="border rounded-xl px-2 py-2"
              value={activeId || ""}
              onChange={e=>onSetActive(e.target.value)}
            >
              {(local.contacts||[]).map(c => <option key={c.id} value={c.id}>{c.name || "(namn saknas)"}</option>)}
            </select>
            <button className="border rounded-xl px-3 py-2" onClick={onAddContact}>+ Lägg till</button>
          </div>
        </div>

        {active ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Namn" value={active.name} disabled={!edit} onChange={v=>updateContact(active.id, "name", v)} />
            <Field label="Roll" value={active.role} disabled={!edit} onChange={v=>updateContact(active.id, "role", v)} />
            <Field label="Telefon" value={active.phone} disabled={!edit} onChange={v=>updateContact(active.id, "phone", v)} />
            <Field label="E-post" value={active.email} disabled={!edit} onChange={v=>updateContact(active.id, "email", v)} />
          </div>
        ) : (
          <div className="text-sm text-gray-500">Ingen kontakt vald. Lägg till en kontaktperson.</div>
        )}
      </div>

      {/* OBS: Ingen OneDrive här. Offerter hanteras i egen vy. */}
    </div>
  );
}

function ProjectCard({ state, setState, id, edit, setEdit }) {
  const p = state.projects.find(x=>x.id===id);
  const [local, setLocal] = useState(p);
  useEffect(()=> setLocal(p), [p?.id]);
  if (!p) return null;

  const cust = state.entities.find(e=>e.id===p.customerId);

  function update(k, v){ setLocal(x=>({...x, [k]: v})); }
  function onSave(){
    const toSave = {...local, updatedAt: new Date().toISOString()};
    setState(s=>{ const nxt={...s}; upsertProject(nxt, toSave); return nxt; });
    setEdit(false);
  }
  function copyOffers(){
    if (!p.customerId){ alert("Projekt saknar kopplad kund."); return; }
    setState(s=> ({...copyAllOfferFilesForCustomerToProject({...s}, p.customerId, p.id)}));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Projekt: {p.name}</h3>
        <div className="flex gap-2">
          {!edit ? (
            <button className="border rounded-xl px-3 py-2" onClick={()=>setEdit(true)}>Redigera</button>
          ) : (
            <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Projektnamn" value={local.name} disabled={!edit} onChange={v=>update("name", v)} />
          <Field label="Kund" value={cust? cust.companyName : "—"} disabled />
          <Field label="Status" value={local.status} disabled={!edit} onChange={v=>update("status", v)} />
          <input type="date" className="border rounded-xl px-3 py-2" value={local.startDate || ""} disabled={!edit} onChange={e=>update("startDate", e.target.value)} />
          <input type="date" className="border rounded-xl px-3 py-2" value={local.dueDate || ""} disabled={!edit} onChange={e=>update("dueDate", e.target.value)} />
          <TextArea label="Beskrivning" value={local.description || ""} disabled={!edit} onChange={v=>update("description", v)} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">Projektfiler</h4>
          <div className="flex gap-2">
            {/* Din befintliga OneDrive-uppladdning i Projekt kan ligga här om du redan har den i en annan komponent */}
            <button className="border rounded-xl px-3 py-2" onClick={copyOffers}>← Kopiera filer från Offerter (denna kund)</button>
          </div>
        </div>
        <ul className="space-y-2">
          {(local.files||[]).length ? (
            local.files.map(f=>(
              <li key={f.id} className="flex items-center justify-between">
                <a className="text-blue-600 hover:underline" href={f.link||f.webUrl} target="_blank" rel="noreferrer">{f.name}</a>
                <span className="text-xs text-gray-500">{typeof f.size==="number" ? (f.size/1024/1024).toFixed(2)+" MB" : ""}</span>
              </li>
            ))
          ) : (
            <li className="text-sm text-gray-500">Inga filer ännu.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

// Små inputkomponenter
function Field({ label, value, onChange, disabled, colSpan }) {
  return (
    <div className={colSpan===2 ? "col-span-2" : ""}>
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      <input className="w-full border rounded-xl px-3 py-2" value={value || ""} disabled={disabled} onChange={e=>onChange?.(e.target.value)} />
    </div>
  );
}
function TextArea({ label, value, onChange, disabled }) {
  return (
    <div className="col-span-2">
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      <textarea rows={3} className="w-full border rounded-xl px-3 py-2" value={value || ""} disabled={disabled} onChange={e=>onChange?.(e.target.value)} />
    </div>
  );
}
