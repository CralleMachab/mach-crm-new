// src/App.jsx
<img
  src="/logo.png"
  alt="Mach Entreprenad"
  className="h-8 w-auto"
  onError={(e) => { e.currentTarget.style.display = 'none'; }}
/>

import React, { useEffect, useMemo, useRef, useState } from "react";
import { initAuth, ensureLoginPopup, loadCloud, saveCloud, getAuthStatus, logout } from "./lib/cloud";

/* ============== ERROR BOUNDARY (så vi ser fel istället för vit sida) ============== */
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
// Entra Application (client) ID används i OneDrive File Picker popupen.
// (File Picker läser från index.html global OneDrive SDK; här använder vi den bara via helper-funktion.)
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

/* ===================== STORE ===================== */
function uuid(){ if (typeof crypto!=="undefined" && crypto.randomUUID) return crypto.randomUUID(); return "id-"+Math.random().toString(36).slice(2)+Date.now().toString(36); }
function loadState(){ try { return JSON.parse(localStorage.getItem("machcrm") || "{}"); } catch { return {}; } }
function saveState(s){ localStorage.setItem("machcrm", JSON.stringify(s)); }

/* Datamodeller */
const CUSTOMER_TYPES = [
  { value: "Stålhall",          badge: "bg-gray-100 text-gray-800 border border-gray-200" },
  { value: "Totalentreprenad",  badge: "bg-orange-100 text-orange-800 border border-orange-200" },
  { value: "Turbovex",          badge: "bg-blue-100 text-blue-800 border border-blue-200" },
];

const SUPPLIER_TYPES = [
  { value: "Stålhalls leverantör", badge: "bg-gray-100 text-gray-800 border border-gray-200" },
  { value: "Mark företag",         badge: "bg-amber-100 text-amber-800 border border-amber-200" },
  { value: "EL leverantör",        badge: "bg-rose-100 text-rose-800 border border-rose-200" },
  { value: "VVS Leverantör",       badge: "bg-violet-100 text-violet-800 border border-violet-200" },
  { value: "Vent Leverantör",      badge: "bg-sky-100 text-sky-800 border border-sky-200" },
];

function newEntity(type){
  return {
    id: uuid(), type,
    companyName:"", orgNo:"", phone:"", email:"",
    address:"", postalCode:"", city:"",
    isOrderingCustomer: false,
    customerType: "",
    supplierType: "",
    notes:"",
    contacts:[], activeContactId:null,
    reminders:[],
    createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
  };
}
function upsertEntity(state, entity){
  if(!state.entities) state.entities = [];
  const i = state.entities.findIndex(e=>e.id===entity.id);
  if (i>=0) state.entities[i] = entity; else state.entities.push(entity);
  state.updatedAt = new Date().toISOString();
}
function deleteEntity(state, entityId){
  state.entities = (state.entities||[]).filter(e=>e.id!==entityId);
  (state.offers||[]).forEach(o=>{ if(o.customerId===entityId) o.customerId=null; });
  (state.projects||[]).forEach(p=>{ if(p.customerId===entityId) p.customerId=null; });
  (state.activities||[]).forEach(a=>{ if(a.entityId===entityId) a.entityId=null; });
  state.updatedAt = new Date().toISOString();
}
function setActiveContact(state, entityId, contactId){
  const e = (state.entities||[]).find(x=>x.id===entityId);
  if (e){ e.activeContactId = contactId; e.updatedAt = new Date().toISOString(); }
  return state;
}

function newOffer(customerId=null, offerNo=31500){
  return { id: uuid(), offerNo, customerId, title:`Offert #${offerNo}`, status:"Utkast", amount:"", notes:"",
    files:[], suppliers:[], sendDueDate:"", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
}
function upsertOffer(state, offer){
  if(!state.offers) state.offers = [];
  const i = state.offers.findIndex(o=>o.id===offer.id);
  if (i>=0) state.offers[i] = offer; else state.offers.push(offer);
  state.updatedAt = new Date().toISOString();
}

function newProject(customerId){
  return { id: uuid(), name:"", customerId:customerId||null, status:"", description:"",
    startDate:"", dueDate:"", files:[], reminders:[], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
}
function upsertProject(state, proj){
  if(!state.projects) state.projects = [];
  const i = state.projects.findIndex(p=>p.id===proj.id);
  if (i>=0) state.projects[i] = proj; else state.projects.push(proj);
  state.updatedAt = new Date().toISOString();
}

const ACT_TYPES = ["Telefon","Mail","Lunch","Möte","Uppgift"];
const ACT_ASSIGNEES = ["Cralle","Mattias","Övrig"];
function newActivity(){
  return {
    id: uuid(),
    createdAt: new Date().toISOString(),
    types: [],
    priority: "Low",
    dueAt: "",
    assignee: "Cralle",
    notes: "",
    entityId: null,
    files: [],
    done: false,
    updatedAt: new Date().toISOString(),
  };
}
function upsertActivity(state, activity){
  if(!state.activities) state.activities = [];
  const i = state.activities.findIndex(a=>a.id===activity.id);
  if (i>=0) state.activities[i] = activity; else state.activities.push(activity);
  state.updatedAt = new Date().toISOString();
}
function deleteActivity(state, id){
  state.activities = (state.activities||[]).filter(a=>a.id!==id);
  state.updatedAt = new Date().toISOString();
}

/* ===================== HELPERS ===================== */
function entityLabel(t){ return t==="customer"?"Kund":t==="supplier"?"Leverantör":"Projekt"; }
function formatDate(iso){ if(!iso) return ""; const d=new Date(iso); return d.toLocaleDateString("sv-SE",{year:"numeric",month:"short",day:"numeric"}); }
function formatDateTime(iso){ if(!iso) return ""; const d=new Date(iso); return d.toLocaleString("sv-SE",{year:"numeric",month:"short",day:"numeric", hour:"2-digit", minute:"2-digit"}); }
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function percentBetween(today, start, end){
  const t=today.getTime(), a=new Date(start).getTime(), b=new Date(end).getTime();
  if(!start || !end || isNaN(a) || isNaN(b) || b<=a) return 0;
  return clamp01((t-a)/(b-a));
}
const PRIORITY_BADGE = {
  High:   "bg-red-100 text-red-800 border border-red-200",
  Medium: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  Low:    "bg-sky-100 text-sky-800 border border-sky-200",
};
const TYPE_ICON = { Telefon:"📞", Mail:"✉️", Lunch:"🍽️", Möte:"📅", Uppgift:"✅" };
const OFFER_STATUS_BADGE = {
  "Utkast":     "bg-gray-100 text-gray-800 border border-gray-200",
  "Skickad":    "bg-orange-100 text-orange-800 border border-orange-200",
  "Accepterad": "bg-green-100 text-green-800 border border-green-200",
  "Avslagen":   "bg-rose-100 text-rose-800 border border-rose-200",
};

/* ===================== useStore ===================== */
function useStore(){
  const initial = loadState();
  const [state,setState] = useState(()=>{
    if (initial && (initial.entities || initial.projects || initial.offers || initial.activities)) {
      if (initial.nextOfferNo == null) initial.nextOfferNo = 31500;
      if (!initial.activities) initial.activities = [];
      return initial;
    }
    const s = { entities: [], projects: [], offers: [], activities: [], nextOfferNo: 31501 };
    const c = newEntity("customer"); c.companyName="Exempel AB";
    c.contacts=[{id:uuid(),name:"Anna Andersson",role:"Inköp",phone:"",email:""}];
    c.activeContactId=c.contacts[0].id; upsertEntity(s,c);
    const sup = newEntity("supplier"); sup.type="supplier"; sup.companyName="Leverantören i Norden"; upsertEntity(s,sup);
    const off = newOffer(c.id, 31500); upsertOffer(s, off);
    const p = newProject(c.id); p.name="Exempelprojekt"; upsertProject(s,p);
    const a = newActivity(); a.types=["Telefon"]; a.priority="Medium"; a.entityId=c.id; a.dueAt=new Date(Date.now()+36e5).toISOString(); upsertActivity(s,a);
    saveState(s);
    return s;
  });
  useEffect(()=>{ saveState(state); },[state]);
  return [state,setState];
}

/* ===================== APP ===================== */
export default function App(){
  // --- Tillfälliga stubbar så knappar/JSX inte kraschar om funktioner saknas ---
function createOffer()   { console.log("TEMP: createOffer klickad"); }
function createProject() { console.log("TEMP: createProject klickad"); }
function createActivity(){ console.log("TEMP: createActivity klickad"); }
function openSettings()  { console.log("TEMP: openSettings klickad"); }
// -------------------------------------------------------------------------------
  return (
    <ErrorBoundary>
      <AppInner/>
    </ErrorBoundary>
  );
}

function AppInner(){
  const [state,setState]=useStore();

  // Cloud (manuell) – initera MSAL så knappen i Inställningar funkar direkt
  useEffect(()=>{ initAuth(); },[]);

  const [view,setView] = useState("activities");
  const [search,setSearch]=useState("");
  const [modal,setModal]=useState(null);
  const [weekOnly,setWeekOnly]=useState(true);

  const customers=useMemo(()=> (state.entities||[])
    .filter(e=>e.type==="customer")
    .sort((a,b)=>a.companyName.localeCompare(b.companyName,"sv")), [state.entities]);
  const suppliers=useMemo(()=> (state.entities||[])
    .filter(e=>e.type==="supplier")
    .sort((a,b)=>a.companyName.localeCompare(b.companyName,"sv")), [state.entities]);
  const offers=useMemo(()=> (state.offers||[]).slice().sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||"")), [state.offers]);
  const projects=useMemo(()=> (state.projects||[]).slice().sort((a,b)=> a.name.localeCompare(b.name,"sv")), [state.projects]);

  const filterBy = (arr)=>{
    const q=search.trim().toLowerCase();
    if(!q) return arr;
    return arr.filter(e=>{
      if (e.companyName !== undefined) {
        const inContacts=(e.contacts||[]).some(c=>`${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q));
        return `${e.companyName} ${e.email} ${e.phone} ${e.orgNo}`.toLowerCase().includes(q) || inContacts;
      }
      if (e.title !== undefined) return `${e.title} ${e.status} ${e.amount}`.toLowerCase().includes(q);
      if (e.name !== undefined) return `${e.name} ${e.status} ${e.description}`.toLowerCase().includes(q);
      return true;
    });
  };

  const activitiesAll = state.activities || [];
  const activitiesWeek = useMemo(()=>{
    if (!weekOnly) return activitiesAll.slice().sort((a,b)=> new Date(a.dueAt||0) - new Date(b.dueAt||0));
    const now = new Date();
    const max = new Date(now.getTime() + 7*24*60*60*1000);
    return activitiesAll
      .filter(a => a.dueAt && new Date(a.dueAt) >= now && new Date(a.dueAt) <= max)
      .sort((a,b)=> new Date(a.dueAt) - new Date(b.dueAt));
  }, [activitiesAll, weekOnly]);

  function openEntity(id, edit=false){ setModal({kind:"entity",id,edit}); }
  function openProject(id, edit=false){ setModal({kind:"project",id,edit}); }
  function openOffer(id, edit=false){ setModal({kind:"offer",id,edit}); }
  function openActivity(id, edit=false){ setModal({kind:"activity",id,edit}); }
  function openSettings(){ setModal({kind:"settings"}); }
  function closeModal(){ setModal(null); }

  function createEntity(type){
    const e=newEntity(type);
    setState(s=>{const nxt={...s}; upsertEntity(nxt,e); return nxt;});
    setSearch(""); setView(type==="customer"?"customers":"suppliers");
    setTimeout(()=>openEntity(e.id, true),0);
  }
  function createOffer(){
    const firstCust=(state.entities||[]).find(e=>e.type==="customer");
    const no = state.nextOfferNo ?? 31500;
    const o=newOffer(firstCust?.id || null, no);
    setState(s=>{const nxt={...s, nextOfferNo: no+1}; upsertOffer(nxt,o); return nxt;});
    setSearch(""); setView("offers");
    setTimeout(()=>openOffer(o.id, true),0);
  }
  function createProject(){
    const firstCust=(state.entities||[]).find(e=>e.type==="customer");
    const p=newProject(firstCust?.id || null);
    setState(s=>{const nxt={...s}; upsertProject(nxt,p); return nxt;});
    setSearch(""); setView("projects");
    setTimeout(()=>openProject(p.id, true),0);
  }
  function createActivity(){
    const a=newActivity();
    setState(s=>{const nxt={...s}; upsertActivity(nxt,a); return nxt;});
    setView("activities");
    setTimeout(()=>openActivity(a.id, true),0);
  }

  const MenuButton = ({id, label}) => (
    <button
      className={`w-full text-left px-3 py-2 rounded-xl ${view===id ? "bg-black text-white" : "hover:bg-gray-100"}`}
      onClick={()=>setView(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl p-4">
     <header className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-3">
    <img
      src="/logo.png"
      alt="Mach Entreprenad"
      className="h-8 w-auto"
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
    <h1 className="text-xl font-semibold">Mach CRM</h1>
  </div>
  <div className="flex flex-wrap gap-2">
    <button className="border rounded-xl px-3 py-2" onClick={() => createEntity("customer")}>
      + Ny kund
    </button>
    <button className="border rounded-xl px-3 py-2" onClick={() => createEntity("supplier")}>
      + Ny leverantör
    </button>

    {/* Temporärt: ta bort knappar som kallar funktioner som inte är definierade ännu
    <button className="border rounded-xl px-3 py-2" onClick={createOffer}>+ Ny offert</button>
    <button className="border rounded-xl px-3 py-2" onClick={createProject}>+ Nytt projekt</button>
    <button className="border rounded-xl px-3 py-2" onClick={createActivity}>+ Ny aktivitet</button>
    <button className="border rounded-xl px-3 py-2" onClick={openSettings}>⚙️ Inställningar</button>
    */}
  </div>
</header>


      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <aside className="bg-white rounded-2xl shadow p-3 space-y-2 h-max">
          <MenuButton id="activities"   label="Aktiviteter" />
          <MenuButton id="customers"    label="Kunder" />
          <MenuButton id="suppliers"    label="Leverantörer" />
          <MenuButton id="offers"       label="Offerter" />
          <MenuButton id="projects"     label="Projekt" />
        </aside>

        <main className="lg:col-span-3 space-y-4">
          {view!=="activities" && (
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
              placeholder={
                view==="customers" ? "Sök kund…" :
                view==="suppliers" ? "Sök leverantör…" :
                view==="offers"    ? "Sök offert…" :
                "Sök projekt…"
              }
            />
          )}

          {view==="activities" && (
            <ActivitiesPanel
              items={useWeek(weekOnly, state.activities)}
              all={state.activities||[]}
              weekOnly={weekOnly}
              setWeekOnly={setWeekOnly}
              onOpen={(id)=>openActivity(id)}
            />
          )}

          {view==="customers"   && <ListCard title="Kunder"        count={customers.length}  items={filterBy(customers)}  onOpen={(id)=>openEntity(id)} />}
          {view==="suppliers"   && <ListCard title="Leverantörer"  count={suppliers.length}  items={filterBy(suppliers)}  onOpen={(id)=>openEntity(id)} />}
          {view==="offers"      && <OffersPanel offers={filterBy(offers)} entities={state.entities} onOpen={(id)=>openOffer(id)} onCreate={createOffer} />}
          {view==="projects"    && <ProjectsPanel projects={filterBy(projects)} entities={state.entities} onOpen={(id)=>openProject(id)} onCreate={createProject} />}
        </main>
      </div>

      {modal && (
        <Modal onClose={closeModal}>
          {modal.kind==="entity"   && <EntityCard    state={state} setState={setState} id={modal.id} forceEdit={!!modal.edit}/> }
          {modal.kind==="offer"    && <OfferCard     state={state} setState={setState} id={modal.id} forceEdit={!!modal.edit}/> }
          {modal.kind==="project"  && <ProjectCard   state={state} setState={setState} id={modal.id} forceEdit={!!modal.edit}/> }
          {modal.kind==="activity" && <ActivityCard  state={state} setState={setState} id={modal.id} forceEdit={!!modal.edit}/> }
          {modal.kind==="settings" && <SettingsCard  state={state} setState={setState} onCloudLoad={async ()=>{
            try{
              const cloud = await loadCloud();
              if (cloud) { saveState(cloud); setState(cloud); alert("✅ Läste in data från molnet."); }
              else { alert("ℹ️ Ingen molnfil hittades ännu. Spara först så skapas den."); }
            }catch(e){ alert("❌ Kunde inte läsa från molnet. Kolla inloggning/behörigheter."); }
          }} onCloudSave={async ()=>{
            try{
              const ok = await saveCloud(loadState());
              alert(ok ? "✅ Synk klar (uppladdad till molnet)." : "❌ Synk misslyckades.");
            }catch(e){ alert("❌ Synk-fel. Kolla inloggning/behörigheter."); }
          }} onCloudLogin={async ()=>{
            try{ await ensureLoginPopup(); alert("✅ Inloggad."); }catch(e){ alert("❌ Inloggning misslyckades."); }
          }} onCloudLogout={()=>{
            logout(); alert("Utloggad från Microsoft-kontot i denna flik.");
          }}/>}
        </Modal>
      )}
    </div>
  );
}

/* Hjälp: filtrera vecka */
function useWeek(weekOnly, activities){
  return useMemo(()=>{
    const all = activities || [];
    if (!weekOnly) return all.slice().sort((a,b)=> new Date(a.dueAt||0) - new Date(b.dueAt||0));
    const now = new Date();
    const max = new Date(now.getTime() + 7*24*60*60*1000);
    return all
      .filter(a => a.dueAt && new Date(a.dueAt) >= now && new Date(a.dueAt) <= max)
      .sort((a,b)=> new Date(a.dueAt) - new Date(b.dueAt));
  }, [activities, weekOnly]);
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
                <div className="font-medium">{e.companyName || e.name || e.title || "(namnlös)"}</div>
                <div className="text-xs text-gray-500">
                  {e.companyName !== undefined && [e.orgNo, e.email || e.phone].filter(Boolean).join(" • ")}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {(e.reminders||[]).some(r=>!r.done) ? "• Påm." : ""}
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

/* ===================== AKTIVITETER ===================== */
function ActivitiesPanel({ items, all, weekOnly, setWeekOnly, onOpen }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Aktiviteter {weekOnly ? "– kommande 7 dagar" : "– alla"}</h2>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={weekOnly} onChange={(e)=>setWeekOnly(e.target.checked)} />
          Visa bara kommande 7 dagar
        </label>
      </div>
      <ul className="divide-y">
        {items?.length ? items.map(a=>(
          <li key={a.id} className="py-3 cursor-pointer hover:bg-gray-50 px-2 rounded-xl" onClick={()=>onOpen(a.id)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <PriorityBadge value={a.priority}/>
                <div className="text-sm font-medium truncate">{formatDateTime(a.dueAt)}</div>
                <TypeChips types={a.types}/>
                {a.entityId && (
                  <span className="text-xs text-gray-500 truncate max-w-[240px]">
                    • {(() => {
                      const ent = (loadState().entities||[]).find(e=>e.id===a.entityId);
                      return ent ? `${ent.companyName} (${ent.type==="customer"?"kund":"leverantör"})` : "—";
                    })()}
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold">{a.assignee}</div>
            </div>
            {a.notes ? <div className="text-xs text-gray-600 mt-1">{a.notes}</div> : null}
          </li>
        )) : (
          <li className="py-6 text-sm text-gray-500 text-center">Inga aktiviteter i vald vy.</li>
        )}
      </ul>
    </div>
  );
}
function PriorityBadge({value}){
  return <span className={`text-[11px] px-2 py-1 rounded ${PRIORITY_BADGE[value||"Low"] || PRIORITY_BADGE.Low}`}>{value||"Low"}</span>;
}
function TypeChips({types}){
  if (!types?.length) return <span className="text-xs text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {types.map(t=>(
        <span key={t} className="text-[11px] px-2 py-1 rounded border bg-gray-50">{TYPE_ICON[t]} {t}</span>
      ))}
    </div>
  );
}

function ActivityCard({state,setState,id,forceEdit=false}){
  const a=(state.activities||[]).find(x=>x.id===id);
  const [local,setLocal]=useState(a);
  const [isEdit,setIsEdit]=useState(forceEdit);

  const entities = (state.entities||[]);
  const allEntities = useMemo(()=> entities.slice().sort((a,b)=> a.companyName.localeCompare(b.companyName,"sv")), [entities]);

  useEffect(()=>{ setLocal(a); },[a]);
  if(!a) return null;

  function update(k,v){ setLocal(x=>({...x,[k]:v, updatedAt:new Date().toISOString()})); }
  function toggleType(t){
    setLocal(x=>{
      const has = (x.types||[]).includes(t);
      return { ...x, types: has ? x.types.filter(y=>y!==t) : [...(x.types||[]), t], updatedAt:new Date().toISOString() };
    });
  }
  function onSave(){
    const toSave={...local, updatedAt:new Date().toISOString()};
    setState(s=>{const nxt={...s}; upsertActivity(nxt,toSave); return nxt;});
    setIsEdit(false);
  }
  function onDelete(){
    if(!confirm("Ta bort denna aktivitet?")) return;
    setState(s=>{ const nxt={...s}; deleteActivity(nxt, local.id); return nxt; });
  }
  function addFiles(){
    pickOneDriveFiles({
      clientId: ONEDRIVE_CLIENT_ID,
      onSuccess: (files)=>{
        const copy = { ...local, files: (local.files || []).concat(files), updatedAt: new Date().toISOString() };
        setLocal(copy);
        setState(s=>{ const nxt={...s}; upsertActivity(nxt,copy); return nxt; });
      }
    });
  }
  function removeFile(fileId){
    const copy = { ...local, files: (local.files || []).filter(x=>x.id!==fileId), updatedAt: new Date().toISOString() };
    setLocal(copy);
    setState(s=>{ const nxt={...s}; upsertActivity(nxt,copy); return nxt; });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Aktivitet</h3>
        <div className="flex gap-2">
          <button className="text-red-600 border rounded-xl px-3 py-2" onClick={onDelete}>Ta bort</button>
          {!isEdit ? <button className="border rounded-xl px-3 py-2" onClick={()=>setIsEdit(true)}>Redigera</button>
                   : <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 grid grid-cols-2 gap-3">
        <Field label="Skapad" value={formatDateTime(local.createdAt)} disabled />
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Datum & tid (att göra)</div>
          <input
            type="datetime-local"
            className="w-full border rounded-xl px-3 py-2"
            value={local.dueAt ? local.dueAt.slice(0,16) : ""}
            disabled={!isEdit}
            onChange={(e)=>update("dueAt", new Date(e.target.value).toISOString())}
          />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Ansvarig</div>
          <select className="w-full border rounded-xl px-2 py-2"
                  value={local.assignee || "Cralle"}
                  disabled={!isEdit}
                  onChange={(e)=>update("assignee", e.target.value)}>
            {ACT_ASSIGNEES.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Prioritet</div>
          <select className="w-full border rounded-xl px-2 py-2"
                  value={local.priority || "Low"}
                  disabled={!isEdit}
                  onChange={(e)=>update("priority", e.target.value)}>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="text-xs font-medium text-gray-600 mb-2">Vad ska göras?</div>
        <div className="flex flex-wrap gap-2">
          {ACT_TYPES.map(t=>(
            <label key={t} className={`flex items-center gap-2 border rounded-xl px-3 py-2 ${ (local.types||[]).includes(t) ? "bg-gray-100" : ""}`}>
              <input type="checkbox"
                     checked={(local.types||[]).includes(t)}
                     disabled={!isEdit}
                     onChange={()=>toggleType(t)} />
              <span>{TYPE_ICON[t]} {t}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="text-xs font-medium text-gray-600 mb-1">Kund eller leverantör</div>
        <select className="w-full border rounded-xl px-2 py-2"
                value={local.entityId || ""}
                disabled={!isEdit}
                onChange={(e)=>update("entityId", e.target.value || null)}>
          <option value="">—</option>
          {allEntities.map(ent=>(
            <option key={ent.id} value={ent.id}>
              {ent.companyName} ({entityLabel(ent.type)})
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <TextArea label="Anteckningar" value={local.notes || ""} disabled={!isEdit} onChange={(v)=>update("notes",v)}/>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">Filer (OneDrive)</h4>
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

/* ===================== ENTITY CARD (kund/leverantör) ===================== */
function EntityCard({state,setState,id,forceEdit=false}){
  const e=state.entities.find(x=>x.id===id);
  const [local,setLocal]=useState(e);
  const [isEdit,setIsEdit]=useState(forceEdit);
  const [activeId,setActiveId]=useState(e?.activeContactId || e?.contacts?.[0]?.id || null);
  const history = useMemo(()=> (state.activities||[]).filter(a=>a.entityId===id).sort((a,b)=> new Date(b.dueAt||b.createdAt) - new Date(a.dueAt||a.createdAt)), [state.activities, id]);

  useEffect(()=>{ setLocal(e); setActiveId(e?.activeContactId || e?.contacts?.[0]?.id || null); },[e]);
  if(!e) return null;
  const active=(local.contacts||[]).find(c=>c.id===activeId) || null;

  function update(k,v){ setLocal(x=>({...x,[k]:v})); }
  function updateContact(id,k,v){ setLocal(x=>({...x,contacts:(x.contacts||[]).map(c=>c.id===id?{...c,[k]:v}:c)})); }
  function onSave(){
    const toSave={...local,activeContactId:activeId,updatedAt:new Date().toISOString()};
    setState(s=>{const nxt={...s}; upsertEntity(nxt,toSave); return nxt;});
    setIsEdit(false);
  }
  function onAddContact(){
    const c={id:uuid(),name:"",role:"",phone:"",email:""};
    const copy={...local, contacts:[...(local.contacts||[]), c]};
    if(!copy.activeContactId) copy.activeContactId=c.id;
    setLocal(copy);
    setIsEdit(true);
  }
  function onDeleteContact(id){
    const list=(local.contacts||[]).filter(c=>c.id!==id);
    const copy={...local, contacts:list, activeContactId: list.find(c=>c.id===local.activeContactId) ? local.activeContactId : (list[0]?.id || null)};
    setLocal(copy);
    setIsEdit(true);
  }
  function onSetActive(id){ setActiveId(id); setState(s=>({...setActiveContact({...s},e.id,id)})); }
  function onDelete(){
    if(!confirm("Ta bort denna posten? Detta går inte att ångra.")) return;
    setState(s=>{ const nxt={...s}; deleteEntity(nxt, e.id); return nxt; });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{entityLabel(e.type)}: {local.companyName || "(namnlös)"}</h3>
        <div className="flex gap-2">
          <button className="text-red-600 border rounded-xl px-3 py-2" onClick={onDelete}>Ta bort</button>
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
          <Field label="Adress" value={local.address} disabled={!isEdit} onChange={v=>update("address",v)} />
          <Field label="Postnummer" value={local.postalCode} disabled={!isEdit} onChange={v=>update("postalCode",v)} />
          <Field label="Ort" value={local.city} disabled={!isEdit} onChange={v=>update("city",v)} />
          <div className="col-span-2 flex items-center justify-between">
            {e.type==="customer" && (
              <button
                type="button"
                disabled={!isEdit}
                onClick={()=>update("isOrderingCustomer", !local.isOrderingCustomer)}
                className={`px-3 py-2 rounded-xl border ${local.isOrderingCustomer ? "bg-green-600 text-white border-green-600" : "bg-white"}`}
              >
                {local.isOrderingCustomer ? "Beställande kund ✓" : "Markera som beställande kund"}
              </button>
            )}
            <div className="flex items-center gap-2">
              {e.type==="customer" && (
                <>
                  <label className="text-xs text-gray-600">Kundtyp</label>
                  <select
                    className="border rounded-xl px-2 py-2"
                    value={local.customerType || ""}
                    disabled={!isEdit}
                    onChange={(ev)=>update("customerType", ev.target.value)}
                  >
                    <option value="">—</option>
                    {CUSTOMER_TYPES.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                  </select>
                  {!!local.customerType && (
                    <span className={`text-[11px] px-2 py-1 rounded ${CUSTOMER_TYPES.find(t=>t.value===local.customerType)?.badge}`}>
                      {local.customerType}
                    </span>
                  )}
                </>
              )}
              {e.type==="supplier" && (
                <>
                  <label className="text-xs text-gray-600">Leverantörstyp</label>
                  <select
                    className="border rounded-xl px-2 py-2"
                    value={local.supplierType || ""}
                    disabled={!isEdit}
                    onChange={(ev)=>update("supplierType", ev.target.value)}
                  >
                    <option value="">—</option>
                    {SUPPLIER_TYPES.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                  </select>
                  {!!local.supplierType && (
                    <span className={`text-[11px] px-2 py-1 rounded ${SUPPLIER_TYPES.find(t=>t.value===local.supplierType)?.badge}`}>
                      {local.supplierType}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <TextArea label="Anteckningar" value={local.notes} disabled={!isEdit} onChange={v=>update("notes",v)}/>
        </div>
      </div>

      {/* Kontakter */}
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
            <div className="flex items-end gap-2">
              <Field label="E-post" value={active.email} disabled={!isEdit} onChange={v=>updateContact(active.id,"email",v)}/>
              {isEdit && (
                <button className="text-red-600 text-sm border rounded px-2 py-1 h-10" onClick={()=>onDeleteContact(active.id)}>
                  Ta bort
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Ingen kontakt vald. Lägg till en kontaktperson.</div>
        )}
      </div>

      {/* Historik */}
      <div className="bg-white rounded-2xl shadow p-4">
        <h4 className="font-semibold mb-2">Historik (aktiviteter)</h4>
        {history.length ? (
          <ul className="space-y-2">
            {history.map(h=>(
              <li key={h.id} className="text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PriorityBadge value={h.priority}/>
                  <span>{formatDateTime(h.dueAt || h.createdAt)}</span>
                  <TypeChips types={h.types}/>
                </div>
                <span className="text-xs text-gray-500">{h.assignee}</span>
              </li>
            ))}
          </ul>
        ) : <div className="text-sm text-gray-500">Ingen historik ännu.</div>}
      </div>
    </div>
  );
}

/* ===================== OFFERTER ===================== */
function OffersPanel({offers, entities, onOpen, onCreate}){
  const getCust = (id)=> entities?.find(e=>e.id===id);
  const active = offers.filter(o=>o.status!=="Avslagen");
  const lost   = offers.filter(o=>o.status==="Avslagen");

  const Row = ({o})=>{
    const cust = getCust(o.customerId);
    return (
      <li className="py-3 cursor-pointer hover:bg-gray-50 px-2 rounded-xl" onClick={()=>onOpen(o.id)}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="font-medium truncate">{cust ? cust.companyName : "—"}</div>
            <div className="text-xs text-gray-500 truncate">#{o.offerNo} • {o.title}</div>
          </div>
          <span className={`text-[11px] px-2 py-1 rounded ${OFFER_STATUS_BADGE[o.status] || OFFER_STATUS_BADGE["Utkast"]}`}>
            {o.status}
          </span>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Offerter</h2>
          <button className="border rounded-xl px-3 py-2" onClick={onCreate}>+ Ny offert</button>
        </div>
        <ul className="divide-y">
          {active.map(o=> <Row key={o.id} o={o}/>)}
        </ul>
      </div>

      {!!lost.length && (
        <div className="bg-white rounded-2xl shadow p-4">
          <h3 className="font-semibold mb-3">Förlorade offerter</h3>
          <ul className="divide-y">
            {lost.map(o=> <Row key={o.id} o={o}/>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function OfferCard({state,setState,id,forceEdit=false}){
  const o = (state.offers||[]).find(x=>x.id===id);
  const [local,setLocal]=useState(o);
  const [isEdit,setIsEdit]=useState(forceEdit);
  const customers=(state.entities||[]).filter(e=>e.type==="customer");

  useEffect(()=>{ setLocal(o); },[o]);
  if(!o) return null;

  function update(k,v){ setLocal(x=>({...x,[k]:v})); }

  function onSave(){
    const toSave={...local,updatedAt:new Date().toISOString()};
    setState(s=>{
      const nxt={...s};
      upsertOffer(nxt,toSave);

      // Skapa/uppdatera aktivitet kopplad till “Skicka offert”
      if (toSave.sendDueDate) {
        const title = `Skicka offert #${toSave.offerNo}`;
        const existing = (nxt.activities||[]).find(a => a.notes===title && a.entityId===toSave.customerId);
        const act = existing || newActivity();
        act.types = ["Uppgift","Mail"];
        act.priority = existing?.priority || "Medium";
        act.dueAt = new Date(toSave.sendDueDate).toISOString();
        act.assignee = existing?.assignee || "Cralle";
        act.notes = title;
        act.entityId = toSave.customerId || null;
        act.done = false;
        act.updatedAt = new Date().toISOString();
        upsertActivity(nxt, act);
      }
      return nxt;
    });
    setIsEdit(false);
  }

  function markLost(){ setLocal(x=>({...x,status:"Avslagen"})); }
  function markWon(){ setLocal(x=>({...x,status:"Accepterad"})); }

  function addFiles(){
    pickOneDriveFiles({
      clientId: ONEDRIVE_CLIENT_ID,
      onSuccess: (files)=>{
        const copy = { ...local, files: (local.files || []).concat(files), updatedAt: new Date().toISOString() };
        setLocal(copy);
        setState(s=>{ const nxt={...s}; upsertOffer(nxt,copy); return nxt; });
      }
    });
  }
  function removeFile(fileId){
    const copy = { ...local, files: (local.files || []).filter(x=>x.id!==fileId), updatedAt: new Date().toISOString() };
    setLocal(copy);
    setState(s=>{ const nxt={...s}; upsertOffer(nxt,copy); return nxt; });
  }

  const won = local.status==="Accepterad";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Offert: #{local.offerNo} – {local.title}</h3>
        <div className="flex flex-wrap gap-2">
          <button className="border rounded-xl px-3 py-2" onClick={markLost}>Förlorad offert</button>
          <button className={`rounded-xl px-3 py-2 border ${won ? "bg-green-600 text-white border-green-600" : ""}`} onClick={markWon}>
            Vunnen offert
          </button>
          {won && (
            <button className="border rounded-xl px-3 py-2" onClick={()=>{
              const p = newProject(local.customerId || null);
              p.name = local.title || `Projekt från offert #${local.offerNo}`;
              p.description = local.notes || "";
              p.files = (local.files || []).slice();
              setState(s=>{ const nxt={...s}; upsertProject(nxt,p); return nxt; });
              alert("Projekt skapat från offert.");
            }}>
              Skapa projekt från offert
            </button>
          )}
          {!isEdit
            ? <button className="border rounded-xl px-3 py-2" onClick={()=>setIsEdit(true)}>Redigera</button>
            : <button className="bg-black text-white rounded-xl px-3 py-2" onClick={onSave}>Spara</button>}
        </div>
      </div>

      {/* Grunddata – kund överst, offertnr låst, titel under */}
      <div className="bg-white rounded-2xl shadow p-4 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Kund</div>
          <select className="w-full border rounded-xl px-2 py-2" value={local.customerId || ""} disabled={!isEdit} onChange={e=>update("customerId",e.target.value)}>
            <option value="">—</option>
            {customers.map(c=><option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Offertnr</div>
          <input className="w-full border rounded-xl px-3 py-2 bg-gray-50" value={"#"+(local.offerNo ?? "")} disabled />
        </div>
        <div className="col-span-2">
          <div className="text-xs font-medium text-gray-600 mb-1">Titel</div>
          <input className="w-full border rounded-xl px-3 py-2" value={local.title || ""} disabled={!isEdit} onChange={e=>update("title",e.target.value)}/>
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

      {/* Påminnelsedatum */}
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Skicka till kund – påminnelsedatum</h4>
            <div className="text-xs text-gray-500">Skapar aktivitet som syns i Aktiviteter.</div>
          </div>
          <input type="date" className="border rounded-xl px-3 py-2"
                 value={local.sendDueDate || ""} disabled={!isEdit}
                 onChange={(e)=>update("sendDueDate", e.target.value)} />
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

/* ===================== PROJEKT ===================== */
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
                  <div className="font-medium">{p.name || "(namnlöst projekt)"}</div>
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

function ProjectCard({state,setState,id,forceEdit=false}){
  const p=state.projects.find(x=>x.id===id);
  const [local,setLocal]=useState(p);
  const [isEdit,setIsEdit]=useState(forceEdit);
  const cust=state.entities.find(e=>e.id===p?.customerId);

  useEffect(()=>{ setLocal(p); },[p]);
  if(!p) return null;

  function update(k,v){ setLocal(x=>({...x,[k]:v})); }
  function onSave(){
    const toSave={...local,updatedAt:new Date().toISOString()};
    setState(s=>{const nxt={...s}; upsertProject(nxt,toSave); return nxt;});
    setIsEdit(false);
  }

  const wonOffers = (state.offers||[]).filter(o=>o.status==="Accepterad" && (o.customerId ? o.customerId===p.customerId : true));
  function importFromOffer(offerId){
    const o = (state.offers||[]).find(x=>x.id===offerId);
    if(!o) return;
    const copy = {
      ...local,
      name: local.name || o.title || `Projekt från offert #${o.offerNo}`,
      description: local.description || o.notes || "",
      files: [ ...(local.files||[]), ...(o.files||[]) ],
      updatedAt: new Date().toISOString(),
    };
    setLocal(copy);
    setState(s=>{ const nxt={...s}; upsertProject(nxt,copy); return nxt; });
  }

  function addProjectFiles(){
    pickOneDriveFiles({
      clientId: ONEDRIVE_CLIENT_ID,
      onSuccess: (files)=>{
        const copy = { ...local, files: (local.files || []).concat(files), updatedAt: new Date().toISOString() };
        setLocal(copy);
        setState(s=>{ const nxt={...s}; upsertProject(nxt,copy); return nxt; });
      }
    });
  }
  function removeProjectFile(fileId){
    const copy = { ...local, files: (local.files || []).filter(x=>x.id!==fileId), updatedAt: new Date().toISOString() };
    setLocal(copy);
    setState(s=>{ const nxt={...s}; upsertProject(nxt,copy); return nxt; });
  }

  const prog = (local.startDate && local.dueDate)
    ? Math.round(percentBetween(new Date(), local.startDate, local.dueDate)*100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Projekt: {local.name || "(namnlöst projekt)"}</h3>
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
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Startdatum</div>
            <input type="date" className="w-full border rounded-xl px-3 py-2" value={local.startDate || ""} disabled={!isEdit} onChange={e=>update("startDate",e.target.value)}/>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Slutdatum</div>
            <input type="date" className="w-full border rounded-xl px-3 py-2" value={local.dueDate || ""} disabled={!isEdit} onChange={e=>update("dueDate",e.target.value)}/>
          </div>
          <TextArea label="Beskrivning" value={local.description || ""} disabled={!isEdit} onChange={v=>update("description",v)}/>
        </div>
        <div className="mt-4">
          <div className="text-xs text-gray-600 mb-1">Projektförlopp {prog}%</div>
          <div className="w-full h-3 bg-gray-200 rounded-xl overflow-hidden">
            <div className="h-3 bg-black" style={{width: `${prog}%`}}/>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Importera vunnen offert</span>
          <select className="border rounded-xl px-2 py-2"
                  onChange={(e)=>{ if(e.target.value) { importFromOffer(e.target.value); e.target.value=""; }}}>
            <option value="">Välj offert…</option>
            {wonOffers.map(o=> <option key={o.id} value={o.id}>#{o.offerNo} – {o.title}</option>)}
          </select>
        </div>
        <div className="text-xs text-gray-500 mt-1">Import kopierar titel→namn (om tomt), anteckningar→beskrivning (om tomt) och alla filer.</div>
      </div>

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

/* ===================== INSTÄLLNINGAR – Export/Import + Moln ===================== */
function SettingsCard({state,setState, onCloudLoad, onCloudSave, onCloudLogin, onCloudLogout}){
  const fileRef = useRef(null);
  const status = getAuthStatus();

  function exportAll(){
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `machcrm-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importAll(e){
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (typeof obj !== "object") throw new Error("Ogiltig fil.");
        saveState(obj);
        setState(obj);
        alert("✅ Import klar!");
      } catch (err) {
        console.error(err);
        alert("❌ Kunde inte läsa filen. Är det en giltig JSON-export?");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold">Inställningar</h3>

      <div className="bg-white rounded-2xl shadow p-4">
        <h4 className="font-semibold mb-2">Backup & återställning</h4>
        <div className="flex flex-wrap gap-2">
          <button className="border rounded-xl px-3 py-2" onClick={exportAll}>⬇️ Exportera data (JSON)</button>
          <button className="border rounded-xl px-3 py-2" onClick={()=>fileRef.current?.click()}>⬆️ Importera data (JSON)</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importAll}/>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Tips: Spara exportfilen i en delad OneDrive-mapp för manuell backup.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 space-y-3">
        <h4 className="font-semibold">Moln-synk (OneDrive/SharePoint)</h4>
        <div className="text-sm">
          <div>Status: {status.signedIn ? `Inloggad som ${status.account?.name || status.account?.username}` : "Inte inloggad"}</div>
          <div>Molnfil: <code>{status.cloudPath}</code></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!status.signedIn
            ? <button className="border rounded-xl px-3 py-2" onClick={onCloudLogin}>Logga in mot Microsoft</button>
            : <button className="border rounded-xl px-3 py-2" onClick={onCloudLogout}>Logga ut</button>}
          <button className="border rounded-xl px-3 py-2" onClick={onCloudLoad}>Hämta från molnet</button>
          <button className="border rounded-xl px-3 py-2" onClick={onCloudSave}>Synka nu (ladda upp)</button>
        </div>
        <p className="text-xs text-gray-500">
          För flera användare: Skapa mappen <code>MachCRM</code> i OneDrive hos en av er, dela den med redigeringsrätt och be de andra klicka “Add to my OneDrive”.
          Då ligger filen på samma stig hos alla. Vill ni istället använda en SharePoint-site direkt, säg till så byter jag mål i koden.
        </p>
      </div>
    </div>
  );
}
