// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";

/* ===================== ERROR BOUNDARY ===================== */
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(error, info){ console.error("🔥 Render error:", error, info); }
  render(){
    if (this.state.error) {
      return (
        <div style={{padding:"24px", fontFamily:"system-ui"}}>
          <div style={{background:"#fee2e2", border:"1px solid #ef4444", color:"#991b1b", padding:"16px", borderRadius:12}}>
            <h2 style={{margin:"0 0 8px 0"}}>❌ Ett fel uppstod i appen</h2>
            <pre style={{whiteSpace:"pre-wrap"}}>{String(this.state.error?.message || this.state.error)}</pre>
            <p style={{marginTop:8, fontSize:12, opacity:.8}}>
              Felet visas här i stället för vit sida. Vi fixar det när vi ser texten.
            </p>
          </div>
          <div style={{marginTop:16}}>
            <button onClick={()=>location.reload()} style={{padding:"8px 12px", border:"1px solid #000", borderRadius:8}}>Ladda om</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ===================== KONFIG ===================== */
// Ditt Entra "Application (client) ID" – MED citattecken:
const ONEDRIVE_CLIENT_ID = "48bd814b-47b9-4310-8c9d-af61d450cedc";

/* ===================== OneDrive helper ===================== */
function pickOneDriveFiles({ clientId, onSuccess, onError }) {
  try {
    if (typeof window === "undefined" || !window.OneDrive) {
      const err = new Error("OneDrive SDK ej laddad. Kontrollera index.html-skriptet.");
      onError?.(err);
      alert("❌ OneDrive SDK ej laddad. Kontrollera att index.html har js.live.net/v7.2/OneDrive.js");
      return;
    }
    if (!clientId) {
      const err = new Error("Saknar clientId (ONEDRIVE_CLIENT_ID).");
      onError?.(err);
      alert("❌ Saknar ONEDRIVE_CLIENT_ID i App.jsx");
      return;
    }
    window.OneDrive.open({
      clientId,
      action: "share",
      multiSelect: true,
      openInNewWindow: true,
      advanced: { redirectUri: window.location.origin },
      success: (files) => {
        const out = (files?.value || []).map((f) => ({
          id: f.id,
          name: f.name,
          link: f.links?.sharingLink?.webUrl || f.webUrl,
          webUrl: f.webUrl,
          size: f.size,
          isFolder: !!f.folder,
        }));
        onSuccess?.(out);
      },
      cancel: () => {},
      error: (e) => {
        console.error("OneDrive Picker error", e);
        alert("❌ Kunde inte hämta från OneDrive. Kontrollera behörigheter i Entra eller försök igen.");
        onError?.(e);
      },
    });
  } catch (e) {
    console.error(e);
    onError?.(e);
    alert("❌ Oväntat fel i OneDrive-hämtning.");
  }
}

/* ===================== LOKAL STORE (enkel) ===================== */
function uuid(){ if (typeof crypto!=="undefined" && crypto.randomUUID) return crypto.randomUUID(); return "id-"+Math.random().toString(36).slice(2)+Date.now().toString(36); }
function loadState(){ try { return JSON.parse(localStorage.getItem("machcrm") || "{}"); } catch { return {}; } }
function saveState(s){ localStorage.setItem("machcrm", JSON.stringify(s)); }

function newEntity(type){
  return { id: uuid(), type, companyName:"", orgNo:"", phone:"", email:"", address:"", notes:"",
    contacts:[], activeContactId:null, reminders:[], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
}
function upsertEntity(state, entity){
  if(!state.entities) state.entities = [];
  const i = state.entities.findIndex(e=>e.id===entity.id);
  if (i>=0) state.entities[i] = entity; else state.entities.push(entity);
  state.updatedAt = new Date().toISOString();
}
function setActiveContact(state, entityId, contactId){
  const e = (state.entities||[]).find(x=>x.id===entityId);
  if (e){ e.activeContactId = contactId; e.updatedAt = new Date().toISOString(); }
  return state;
}

function newOffer(customerId=null){
  return { id: uuid(), customerId, title:"Ny offert", status:"Utkast", amount:"", notes:"", files:[],
    createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
}
function upsertOffer(state, offer){
  if(!state.offers) state.offers = [];
  const i = state.offers.findIndex(o=>o.id===offer.id);
  if (i>=0) state.offers[i] = offer; else state.offers.push(offer);
  state.updatedAt = new Date().toISOString();
}

function newProject(customerId){
  return { id: uuid(), name:"Nytt projekt", customerId:customerId||null, status:"", description:"",
    startDate:"", dueDate:"", files:[], reminders:[], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
}
function upsertProject(state, proj){
  if(!state.projects) state.projects = [];
  const i = state.projects.findIndex(p=>p.id===proj.id);
  if (i>=0) state.projects[i] = proj; else state.projects.push(proj);
  state.updatedAt = new Date().toISOString();
}

/* ===================== UI HELPERS ===================== */
function entityLabel(t){ return t==="customer"?"Kund":t==="supplier"?"Leverantör":"Projekt"; }
function reminderStatus(r){const t=new Date();t.setHours(0,0,0,0);const d=new Date(r.dueDate||t);d.setHours(0,0,0,0);if(r.done)return"done";if(d<t)return"overdue";if(+d===+t)return"today";return"upcoming";}

/* ===================== STORE HOOK ===================== */
function useStore(){
  const initial = loadState();
  const [state,setState] = useState(()=>{
    if (initial && (initial.entities || initial.projects || initial.offers)) return initial;
    const s = { entities: [], projects: [], offers: [] };
    const c = newEntity("customer"); c.companyName="Exempel AB";
    c.contacts=[{id:uuid(),name:"Anna Andersson",role:"Inköp",phone:"",email:""}];
    c.activeContactId=c.contacts[0].id; upsertEntity(s,c);
    const sup = newEntity("supplier"); sup.type="supplier"; sup.companyName="Leverantören i Norden"; upsertEntity(s,sup);
    const off = newOffer(c.id); off.title="Offert #1001"; upsertOffer(s, off);
    const p = newProject(c.id); p.name="Exempelprojekt"; upsertProject(s,p);
    saveState(s);
    return s;
  });
  useEffect(()=>{ saveState(state); },[state]);
  return [state,setState];
}

/* ===================== APP (med ErrorBoundary) ===================== */
export default function App(){
  return (
    <ErrorBoundary>
      <AppInner/>
    </ErrorBoundary>
  );
}

function AppInner(){
  const [state,setState]=useStore();
  const [search,setSearch]=useState("");
  const [modal,setModal]=useState(null); // {kind:'entity'|'project'|'offer', id}
  const [remFilter,setRemFilter]=useState("all");

  const customers=useMemo(()=> (state.entities||[]).filter(e=>e.type==="customer").sort((a,b)=>a.companyName.localeCompare(b.companyName,"sv")), [state.entities]);
  const suppliers=useMemo(()=> (state.entities||[]).filter(e=>e.type==="supplier").sort((a,b)=>a.companyName.localeCompare(b.companyName,"sv")), [state.entities]);
  const offers=useMemo(()=> (state.offers||[]).slice().sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||"")), [state.offers]);

  const filterBy = (arr)=>{
    const q=search.trim().toLowerCase();
    if(!q) return arr;
    return arr.filter(e=>{
      const inContacts=(e.contacts||[]).some(c=>`${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q));
      return `${e.companyName} ${e.email} ${e.phone} ${e.orgNo}`.toLowerCase().includes(q) || inContacts;
    });
  };

  const allReminders = useMemo(()=>{
    const ent=(state.entities||[]).flatMap(e=>(e.reminders||[]).map(r=>({...r,owner:e.companyName,ownerType:e.type,refId:e.id,refKind:"entity"})));
    const proj=(state.projects||[]).flatMap(p=>(p.reminders||[]).map(r=>({...r,owner:p.name,ownerType:"project",refId:p.id,refKind:"project"})));
    return [...ent,...proj];
  },[state]);
  const pickedRem=useMemo(()=> allReminders
    .filter(r=> remFilter==="all"?true: remFilter==="done"?r.done: reminderStatus(r)===remFilter)
    .sort((a,b)=> new Date(a.dueDate||0)-new Date(b.dueDate||0)), [allReminders,remFilter]);

  function openEntity(id){ setModal({kind:"entity",id}); }
  function openProject(id){ setModal({kind:"project",id}); }
  function openOffer(id){ setModal({kind:"offer",id}); }
  function closeModal(){ setModal(null); }

  function createEntity(type){ const e=newEntity(type); setState(s=>{const nxt={...s}; upsertEntity(nxt,e); return nxt;}); setTimeout(()=>openEntity(e.id),0); }
  function createProject(){ const firstCust=(state.entities||[]).find(e=>e.type==="customer"); const p=newProject(firstCust?.id);
    setState(s=>{const nxt={...s}; upsertProject(nxt,p); return nxt;}); setTimeout(()=>openProject(p.id),0); }
  function createOffer(){ const firstCust=(state.entities||[]).find(e=>e.type==="customer"); const o=newOffer(firstCust?.id || null);
    setState(s=>{const nxt={...s}; upsertOffer(nxt,o); return nxt;}); setTimeout(()=>openOffer(o.id),0); }

  return (
    <div className="mx-auto max-w-7xl p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Mach CRM</h1>
        <div className="flex flex-wrap gap-2">
          <button className="border rounded-xl px-3 py-2" onClick={()=>createEntity("customer")}>+ Ny kund</button>
          <button className="border rounded-xl px-3 py-2" onClick={()=>createEntity("supplier")}>+ Ny leverantör</button>
          <button className="border rounded-xl px-3 py-2" onClick={createOffer}>+ Ny offert</button>
          <button className="border rounded-xl px-3 py-2" onClick={createProject}>+ Nytt projekt</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="space-y-4">
          <input className="w-full border rounded-xl px-3 py-2" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Sök: företagsnamn eller kontaktperson…"/>
          <ListCard title="Kunder" count={customers.length} items={filterBy(customers)} onOpen={openEntity}/>
          <ListCard title="Leverantörer" count={suppliers.length} items={filterBy(suppliers)} onOpen={openEntity}/>
        </section>

        <section className="lg:col-span-2 space-y-4">
          <RemindersPanel items={pickedRem} onOpen={r=> r.refKind==="entity"?openEntity(r.refId):openProject(r.refId)} setFilter={setRemFilter}/>
          <OffersPanel offers={offers} entities={state.entities} onOpen={openOffer} onCreate={createOffer}/>
          <ProjectsPanel projects={state.projects} entities={state.entities} onOpen={openProject} onCreate={createProject}/>
        </section>
      </div>

      {modal && (
        <Modal onClose={closeModal}>
          {modal.kind==="entity" && <EntityCard state={state} setState={setState} id={modal.id}/> }
          {modal.kind==="offer"  && <OfferCard state={state} setState={setState} id={modal.id}/> }
          {modal.kind==="project"&& <ProjectCard state={state} setState={setState} id={modal.id}/> }
        </Modal>
      )}
    </div>
  );
}

/* ===================== GEMENSAM UI ===================== */
function ListCard({title,count,items,onOpen}){
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-gray-500">{count} st</span>
      </div>
      <ul className="divide-y">
        {items.map(e=>(
          <li key={e.id} className="py-3 cursor-pointer hover:bg-gray-50 px-2 rounded-xl" onClick={()=>onOpen(e.id)}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{e.companyName || "(namnlös)"}</div>
                <div className="text-xs text-gray-500">{[e.orgNo, e.email || e.phone].filter(Boolean).join(" • ")}</div>
              </div>
              <div className="text-xs text-gray-500">
                {(e.reminders||[]).some(r=>!r.done && ["today","overdue"].includes(reminderStatus(r))) ? "• Påm." : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
function Field({label,value,onChange,disabled,colSpan}){
  return (
    <div className={colSpan===2 ? "col-span-2": ""}>
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      <input className="w-full border rounded-xl px-3 py-2" value={value || ""} disabled={disabled} onChange={e=>onChange?.(e.target.value)} />
    </div>
  );
}
function TextArea({label,value,onChange,disabled}){
  return (
    <div className="col-span-2">
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      <textarea rows={3} className="w-full border rounded-xl px-3 py-2" value={value || ""} disabled={disabled} onChange={e=>onChange?.(e.target.value)} />
    </div>
  );
}
function Modal({children,onClose}){
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
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

/* ===================== ENTITY CARD ===================== */
function EntityCard({state,setState,id}){
  const e=state.entities.find(x=>x.id===id);
  const [local,setLocal]=useState(e);
  const [isEdit,setIsEdit]=useState(false);
  const [activeId,setActiveId]=useState(e?.activeContactId || e?.contacts?.[0]?.id || null);

  useEffect(()=>{ setLocal(e); setActiveId(e?.activeContactId || e?.contacts?.[0]?.id || null); },[e?.id]);
  if(!e) return null;
  const active=(local.contacts||[]).find(c=>c.id===activeId) || null;

  function update(k,v){ setLocal(x=>({...x,[k]:v})); }
  function updateContact(id,k,v){ setLocal(x=>({...x,contacts:(x.contacts||[]).map(c=>c.id===id?{...c,[k]:v}:c)})); }
  function onSave(){ const toSave={...local,activeContactId:activeId,updatedAt:new Date().toISOString()};
    setState(s=>{const nxt={...s}; upsertEntity(nxt,toSave); return nxt;}); setIsEdit(false); }
  function onAddContact(){ setState(s=>{const nxt={...s}; const entity=nxt.entities.find(x=>x.id===e.id);
      if(!entity.contacts) entity.contacts=[]; const c={id:uuid(),name:"",role:"",phone:"",email:""};
      entity.contacts=[...entity.contacts,c]; if(!entity.activeContactId) entity.activeContactId=c.id; entity.updatedAt=new Date().toISOString();
      upsertEntity(nxt,entity); return nxt;});
    setTimeout(()=>{ const fresh=loadState().entities.find(x=>x.id===e.id); setLocal(fresh); setActiveId(fresh.activeContactId || fresh.contacts?.[0]?.id || null); setIsEdit(true); },0); }
  function onSetActive(id){ setActiveId(id); setState(s=>({...setActiveContact({...s},e.id,id)})); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{entityLabel(e.type)}: {e.companyName || "(namnlös)"}</h3>
        <div className="flex gap-2">
          {!isEdit ? <button className="border rounded-xl px-3 py-2" onClick={()=>setIsEdit(true)}>Redigera</button>
                   : <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Företag" value={local.companyName} disabled={!isEdit} onChange={v=>update("companyName",v)}/>
          <Field label="Organisationsnummer" value={local.orgNo} disabled={!isEdit} onChange={v=>update("orgNo",v)}/>
          <Field label="Telefon" value={local.phone} disabled={!isEdit} onChange={v=>update("phone",v)}/>
          <Field label="E-post" value={local.email} disabled={!isEdit} onChange={v=>update("email",v)}/>
          <Field label="Adress" value={local.address} disabled={!isEdit} onChange={v=>update("address",v)} colSpan={2}/>
          <TextArea label="Anteckningar" value={local.notes} disabled={!isEdit} onChange={v=>update("notes",v)}/>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">Kontaktpersoner</h4>
          <div className="flex gap-2">
            <select className="border rounded-xl px-2 py-2" value={activeId || ""} onChange={e=>onSetActive(e.target.value)}>
              {(local.contacts||[]).map(c=><option key={c.id} value={c.id}>{c.name || "(namn saknas)"}</option>)}
            </select>
            <button className="border rounded-xl px-3 py-2" onClick={onAddContact}>+ Lägg till</button>
          </div>
        </div>
        {active ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Namn" value={active.name} disabled={!isEdit} onChange={v=>updateContact(active.id,"name",v)}/>
            <Field label="Roll" value={active.role} disabled={!isEdit} onChange={v=>updateContact(active.id,"role",v)}/>
            <Field label="Telefon" value={active.phone} disabled={!isEdit} onChange={v=>updateContact(active.id,"phone",v)}/>
            <Field label="E-post" value={active.email} disabled={!isEdit} onChange={v=>updateContact(active.id,"email",v)}/>
          </div>
        ) : <div className="text-sm text-gray-500">Ingen kontakt vald. Lägg till en kontaktperson.</div>}
      </div>
    </div>
  );
}

/* ===================== OFFERS ===================== */
function OffersPanel({offers, entities, onOpen, onCreate}){
  const getCust = (id)=> entities?.find(e=>e.id===id);
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Offerter</h2>
        <button className="border rounded-xl px-3 py-2" onClick={onCreate}>+ Ny offert</button>
      </div>
      <ul className="divide-y">
        {(offers||[]).map(o=>{
          const cust = getCust(o.customerId);
          return (
            <li key={o.id} className="py-3 cursor-pointer hover:bg-gray-50 px-2 rounded-xl" onClick={()=>onOpen(o.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{o.title}</div>
                  <div className="text-xs text-gray-500">{cust ? cust.companyName : "—"} • {o.status}</div>
                </div>
                <div className="text-xs text-gray-500">{(o.files||[]).length} filer</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
function OfferCard({state,setState,id}){
  const o = (state.offers||[]).find(x=>x.id===id);
  const [local,setLocal]=useState(o);
  const [isEdit,setIsEdit]=useState(false);
  const customers=(state.entities||[]).filter(e=>e.type==="customer");

  useEffect(()=>{ setLocal(o); },[o?.id]);
  if(!o) return null;

  function update(k,v){ setLocal(x=>({...x,[k]:v})); }
  function onSave(){ const toSave={...local,updatedAt:new Date().toISOString()};
    setState(s=>{const nxt={...s}; upsertOffer(nxt,toSave); return nxt;}); setIsEdit(false); }

  function addFiles(){
    pickOneDriveFiles({
      clientId: ONEDRIVE_CLIENT_ID,
      onSuccess: (files)=>{
        const copy = { ...o, files: (o.files || []).concat(files), updatedAt: new Date().toISOString() };
        setState(s=>{ const nxt={...s}; upsertOffer(nxt,copy); return nxt; });
      }
    });
  }
  function removeFile(fileId){
    const copy = { ...o, files: (o.files || []).filter(x=>x.id!==fileId), updatedAt: new Date().toISOString() };
    setState(s=>{ const nxt={...s}; upsertOffer(nxt,copy); return nxt; });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Offert: {o.title}</h3>
        <div className="flex gap-2">
          {!isEdit ? <button className="border rounded-xl px-3 py-2" onClick={()=>setIsEdit(true)}>Redigera</button>
                   : <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Titel</div>
          <input className="w-full border rounded-xl px-3 py-2" value={local.title || ""} disabled={!isEdit} onChange={e=>update("title",e.target.value)}/>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Kund</div>
          <select className="w-full border rounded-xl px-2 py-2" value={local.customerId || ""} disabled={!isEdit} onChange={e=>update("customerId",e.target.value)}>
            <option value="">—</option>
            {customers.map(c=><option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Belopp</div>
          <input className="w-full border rounded-xl px-3 py-2" value={local.amount || ""} disabled={!isEdit} onChange={e=>update("amount",e.target.value)}/>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Status</div>
          <select className="w-full border rounded-xl px-2 py-2" value={local.status || "Utkast"} disabled={!isEdit} onChange={e=>update("status",e.target.value)}>
            {["Utkast","Skickad","Accepterad","Avslagen"].map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <TextArea label="Anteckningar" value={local.notes || ""} disabled={!isEdit} onChange={v=>update("notes",v)}/>
        </div>
      </div>

      {/* Offertfiler */}
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">Offertfiler (OneDrive)</h4>
          <button className="border rounded-xl px-3 py-2" onClick={addFiles}>+ Lägg till filer (OneDrive)</button>
        </div>
        <ul className="space-y-2">
          {(local.files||[]).length ? local.files.map(f=>(
            <li key={f.id} className="flex items-center justify-between">
              <a className="text-blue-600 hover:underline" href={f.link || f.webUrl} target="_blank" rel="noreferrer">{f.name}</a>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{typeof f.size==="number" ? (f.size/1024/1024).toFixed(2)+" MB" : ""}</span>
                {isEdit && <button className="text-red-600 text-sm" onClick={()=>removeFile(f.id)}>Ta bort</button>}
              </div>
            </li>
          )) : <li className="text-sm text-gray-500">Inga filer ännu.</li>}
        </ul>
      </div>
    </div>
  );
}

/* ===================== PROJECTS ===================== */
function ProjectsPanel({projects,entities,onOpen,onCreate}){
  const sorted=(projects||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,"sv"));
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Projekt</h2>
        <button className="border rounded-xl px-3 py-2" onClick={onCreate}>+ Nytt projekt</button>
      </div>
      <ul className="divide-y">
        {sorted.map(p=>{
          const cust=entities?.find(e=>e.id===p.customerId);
          return (
            <li key={p.id} className="py-3 cursor-pointer hover:bg-gray-50 px-2 rounded-xl" onClick={()=>onOpen(p.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">{cust ? cust.companyName : "—"} • {p.status || ""}</div>
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
function ProjectCard({state,setState,id}){
  const p=state.projects.find(x=>x.id===id);
  const [local,setLocal]=useState(p);
  const [isEdit,setIsEdit]=useState(false);
  const cust=state.entities.find(e=>e.id===p?.customerId);

  useEffect(()=>{ setLocal(p); },[p?.id]);
  if(!p) return null;

  function update(k,v){ setLocal(x=>({...x,[k]:v})); }
  function onSave(){ const toSave={...local,updatedAt:new Date().toISOString()};
    setState(s=>{const nxt={...s}; upsertProject(nxt,toSave); return nxt;}); setIsEdit(false); }

  function addProjectFiles(){
    pickOneDriveFiles({
      clientId: ONEDRIVE_CLIENT_ID,
      onSuccess: (files)=>{
        const copy = { ...p, files: (p.files || []).concat(files), updatedAt: new Date().toISOString() };
        setState(s=>{ const nxt={...s}; upsertProject(nxt,copy); return nxt; });
      }
    });
  }
  function removeProjectFile(fileId){
    const copy = { ...p, files: (p.files || []).filter(x=>x.id!==fileId), updatedAt: new Date().toISOString() };
    setState(s=>{ const nxt={...s}; upsertProject(nxt,copy); return nxt; });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Projekt: {p.name}</h3>
        <div className="flex gap-2">
          {!isEdit ? <button className="border rounded-xl px-3 py-2" onClick={()=>setIsEdit(true)}>Redigera</button>
                   : <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Projektnamn" value={local.name} disabled={!isEdit} onChange={v=>update("name",v)}/>
          <Field label="Kund" value={cust ? cust.companyName : "—"} disabled/>
          <Field label="Status" value={local.status} disabled={!isEdit} onChange={v=>update("status",v)}/>
          <input type="date" className="border rounded-xl px-3 py-2" value={local.startDate || ""} disabled={!isEdit} onChange={e=>update("startDate",e.target.value)}/>
          <input type="date" className="border rounded-xl px-3 py-2" value={local.dueDate || ""} disabled={!isEdit} onChange={e=>update("dueDate",e.target.value)}/>
          <TextArea label="Beskrivning" value={local.description || ""} disabled={!isEdit} onChange={v=>update("description",v)}/>
        </div>
      </div>

      {/* Projektfiler */}
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">Projektfiler</h4>
          <button className="border rounded-xl px-3 py-2" onClick={addProjectFiles}>+ Lägg till filer (OneDrive)</button>
        </div>
        <ul className="space-y-2">
          {(local.files||[]).length ? local.files.map(f=>(
            <li key={f.id} className="flex items-center justify-between">
              <a className="text-blue-600 hover:underline" href={f.link || f.webUrl} target="_blank" rel="noreferrer">{f.name}</a>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{typeof f.size==="number" ? (f.size/1024/1024).toFixed(2)+" MB" : ""}</span>
                {isEdit && <button className="text-red-600 text-sm" onClick={()=>removeProjectFile(f.id)}>Ta bort</button>}
              </div>
            </li>
          )) : <li className="text-sm text-gray-500">Inga filer ännu.</li>}
        </ul>
      </div>
    </div>
  );
}
