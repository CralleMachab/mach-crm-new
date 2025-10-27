import React from 'react'
import { LS, load, save, defaultSettings } from './lib/storage.js'

/* ---------- Små UI-komponenter ---------- */
const Card = ({children, className=""}) => (
  <div className={"rounded-2xl bg-white shadow-sm border " + className}>{children}</div>
)
const CardContent = ({children, className=""}) => (
  <div className={"p-4 " + className}>{children}</div>
)
const Button = ({children, className="", onClick, variant="default", size="md", type="button", disabled=false}) => {
  const base = "inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
  const variants = {
    default: "bg-black text-white hover:opacity-90",
    ghost: "hover:bg-slate-100",
    outline: "border hover:bg-slate-50",
    secondary: "bg-slate-800/10 hover:bg-slate-800/20"
  }
  const sizes = { sm: "px-2 py-1 text-xs", md: "", lg: "px-4 py-3" }
  return <button type={type} disabled={disabled} onClick={onClick} className={[base, variants[variant], sizes[size], className].join(" ")}>{children}</button>
}
const Input = (props) => <input {...props} className={"border rounded-xl px-3 py-2 text-sm w-full " + (props.className||"")} />
const Textarea = (props) => <textarea {...props} className={"border rounded-xl px-3 py-2 text-sm w-full min-h-[90px] " + (props.className||"")} />
const Select = ({value, onChange, children}) => (
  <select value={value} onChange={(e)=>onChange && onChange(e.target.value)} className="border rounded-xl px-3 py-2 text-sm w-full">{children}</select>
)// --- OneDrive Picker helper ---
function pickFromOneDrive({ onPicked, multi = true, filter = "folder,.pdf,.xlsx,.xls,.docx,.pptx,.dwg" }) {
  const clientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID;
  if (!clientId || !window.OneDrive) {
    alert("OneDrive Picker saknas eller VITE_ONEDRIVE_CLIENT_ID är inte satt.");
    return;
  }

  const odOptions = {
    clientId,
    action: "share",
    multiSelect: !!multi,
    viewType: "all",
    advanced: {
      filter,
    },
    success: (res) => {
      const urls = (res?.value || []).map(v => v.webUrl).filter(Boolean);
      if (urls.length && onPicked) onPicked(urls);
    },
    cancel: () => {},
    error: (e) => {
      console.error("OneDrive Picker error:", e);
      alert("Kunde inte hämta från OneDrive. Kontrollera behörigheter eller försök igen.");
    }
  };

  window.OneDrive.open(odOptions);
}


/* ---------- Badges & helpers ---------- */
const CustomerLabelBadge = ({label}) => {
  const map = {
    "Entreprenad": "bg-orange-100 text-orange-800 border border-orange-200",
    "Turbovex": "bg-green-100 text-green-800 border border-green-200",
    "Övrigt": "bg-gray-100 text-gray-700 border border-gray-200"
  }
  const cls = map[label] || "bg-gray-100 text-gray-700 border"
  return <span className={"inline-flex items-center px-2 py-1 text-xs rounded-xl " + cls}>{label}</span>
}

/* Statusfärger: Aktiv=orange, Vunnen=grön, Förlorad=grå */
const StatusBadge = ({status}) => {
  const key = (status || "").toString().toLowerCase()
  let cls = "bg-gray-100 text-gray-700"
  if (key.includes("aktiv")) cls = "bg-orange-500 text-white"
  if (key.includes("vunn")) cls = "bg-green-600 text-white"
  if (key.includes("förlor") || key.includes("forlor")) cls = "bg-gray-300 text-gray-900"
  return <span className={"inline-flex items-center px-2 py-1 text-xs rounded-xl " + cls}>{status}</span>
}

/* Leverantörskategori-färger */
const normalizeKey = (s) =>
  (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');

const SupplierTypeBadge = ({type}) => {
  const key = normalizeKey(type);
  let cls = "bg-gray-100 text-gray-700 border border-gray-200";          // default ljusgrå
  if (key.includes("stalhallsleverantor")) cls = "bg-gray-100 text-gray-700 border border-gray-200";   // ljusgrå
  else if (key.includes("markforetag"))    cls = "bg-amber-100 text-amber-800 border border-amber-200"; // mellanbrun
  else if (key.includes("elleverantor"))   cls = "bg-red-100 text-red-800 border border-red-200";       // ljusröd
  else if (key.includes("vvsleverantor"))  cls = "bg-sky-100 text-sky-800 border border-sky-200";       // ljusblå
  else if (key.includes("ventleverantor")) cls = "bg-green-100 text-green-800 border border-green-200"; // ljusgrön
  return <span className={"inline-flex items-center px-2 py-1 text-xs rounded-xl " + cls}>{type}</span>
}

/* Modal (popup) */
const Modal = ({ open, onClose, title, children, footer }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="text-lg font-semibold">{title}</div>
            <Button variant="ghost" onClick={onClose}>Stäng</Button>
          </div>
          <div className="p-5 max-h-[65vh] overflow-auto">{children}</div>
          {footer && <div className="px-5 py-4 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-2">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

/* ---------- Layout ---------- */
const Sidebar = ({ current, setCurrent, settings }) => {
  const items = [
    { id: "dashboard", label: "Översikt" },
    { id: "aktivitet", label: "Aktivitet" },
    { id: "offert", label: "Offert" },
    { id: "projekt", label: "Projekt" },
    { id: "kunder", label: "Kunder" },
    { id: "leverantorer", label: "Leverantörer" },
    { id: "settings", label: "Inställningar" },
  ]
  return (
    <div className="w-64 h-full p-4 border-r bg-white/60 backdrop-blur sticky top-0">
      <div className="flex items-center gap-2 mb-6">
        {settings.logoDataUrl
          ? <img src={settings.logoDataUrl} alt="Logo" className="h-10 w-auto rounded" />
          : <div className="w-10 h-10 rounded-2xl bg-black" />}
        <div>
          <div className="text-lg font-semibold">{settings.companyName || "Mach CRM"}</div>
          <div className="text-xs text-slate-500">Prototyp</div>
        </div>
      </div>
      <nav className="grid gap-2">
        {items.map(it => (
          <Button
            key={it.id}
            variant={current===it.id ? "default" : "ghost"}
            className="justify-start"
            onClick={() => setCurrent(it.id)}
          >
            {it.label}
          </Button>
        ))}
      </nav>
    </div>
  )
}

const Shell = ({ children, current, setCurrent, settings }) => (
  <div className="min-h-screen">
    <div className="max-w-7xl mx-auto grid grid-cols-[16rem,1fr] gap-0">
      <Sidebar current={current} setCurrent={setCurrent} settings={settings}/>
      <main className="p-6">{children}</main>
    </div>
  </div>
)

/* ---------- Dashboard ---------- */
const Dashboard = ({ offers, projects, activities }) => {
  const activeOffers = offers.filter(o => !o.lost && !o.converted)
  const won = offers.filter(o => o.converted)
  const lost = offers.filter(o => o.lost)
  const todayStr = new Date().toDateString()
  const todaysActs = activities.filter(a => (new Date(a.when)).toDateString() === todayStr)
  const stats = [
    { label: "Aktiva offerter", value: activeOffers.length },
    { label: "Vunna avtal", value: won.length },
    { label: "Förlorade", value: lost.length },
    { label: "Dagens aktiviteter", value: todaysActs.length },
    { label: "Aktiva projekt", value: projects.length },
  ]
  return (
    <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((s,i)=>(
        <Card key={i}><CardContent>
          <div className="text-sm text-slate-500">{s.label}</div>
          <div className="text-3xl font-bold">{s.value}</div>
        </CardContent></Card>
      ))}
    </div>
  )
}

/* ---------- Kunder (redigering + fler kontakter + popup) ---------- */
const Customers = ({ customers, setCustomers, settings }) => {
  const [q, setQ] = React.useState("");
  const emptyForm = React.useMemo(() => ({
    company: "",
    label: (settings.customerLabels||[])[0] || "Entreprenad",
    status: (settings.customerStatus||[])[0] || "Aktiv",
    primaryContact: { name: "", title: "", email: "", phone: "" },
    address: "",
    contacts: []
  }), [settings]);

  const [form, setForm] = React.useState(emptyForm);
  const [editingId, setEditingId] = React.useState(null);
  const [selected, setSelected] = React.useState(null);

  const startEdit = (id) => {
    const c = customers.find(x => x.id === id);
    if (!c) return;
    setForm(JSON.parse(JSON.stringify({
      company: c.company || "",
      label: c.label || (settings.customerLabels||[])[0] || "Entreprenad",
      status: c.status || (settings.customerStatus||[])[0] || "Aktiv",
      primaryContact: c.primaryContact || { name:"", title:"", email:"", phone:"" },
      address: c.address || "",
      contacts: Array.isArray(c.contacts) ? c.contacts.map(p => ({ id: p.id || crypto.randomUUID(), ...p })) : []
    })));
    setEditingId(id);
  };
  const cancelEdit = () => { setForm(emptyForm); setEditingId(null); };
  const add = () => { const next=[...customers, { id: crypto.randomUUID(), ...form }]; setCustomers(next); save(LS.customers,next); setForm(emptyForm); };
  const update = () => { const next=customers.map(c=>c.id===editingId?{...c,...form}:c); setCustomers(next); save(LS.customers,next); cancelEdit(); };
  const remove = (id) => {
    if (!confirm("Ta bort kunden?")) return;
    const next = customers.filter(c => c.id !== id);
    setCustomers(next); save(LS.customers, next);
    if (editingId === id) cancelEdit();
    if (selected?.id === id) setSelected(null);
  };
  const addContactRow = () => setForm({ ...form, contacts: [...form.contacts, { id: crypto.randomUUID(), name: "", email: "", phone: "" }]} );
  const removeContactRow = (idx) => { const copy=[...form.contacts]; copy.splice(idx,1); setForm({ ...form, contacts: copy }); };
  const filtered = customers.filter(c => [c.company, c.primaryContact?.name, c.primaryContact?.email].join(" ").toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        <Card><CardContent className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{editingId ? "Redigera kund" : "Ny kund"}</div>
            {editingId && <Button variant="ghost" size="sm" onClick={cancelEdit}>Avbryt</Button>}
          </div>
          <label className="grid gap-1 text-sm"><span className="text-slate-600">Företag</span>
            <Input value={form.company} onChange={e=>setForm({...form, company:e.target.value})}/></label>
          <label className="grid gap-1 text-sm"><span className="text-slate-600">Etikett</span>
            <Select value={form.label} onChange={v=>setForm({...form, label:v})}>
              {(settings.customerLabels||[]).map(x => <option key={x} value={x}>{x}</option>)}
            </Select></label>
          <label className="grid gap-1 text-sm"><span className="text-slate-600">Status</span>
            <Select value={form.status} onChange={v=>setForm({...form, status:v})}>
              {(settings.customerStatus||[]).map(x => <option key={x} value={x}>{x}</option>)}
            </Select></label>
          <label className="grid gap-1 text-sm"><span className="text-slate-600">Adress</span>
            <Input value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/></label>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm"><span className="text-slate-600">Kontaktperson</span>
              <Input value={form.primaryContact.name} onChange={e=>setForm({...form, primaryContact: {...form.primaryContact, name:e.target.value}})}/></label>
            <label className="grid gap-1 text-sm"><span className="text-slate-600">Titel</span>
              <Input value={form.primaryContact.title} onChange={e=>setForm({...form, primaryContact: {...form.primaryContact, title:e.target.value}})}/></label>
            <label className="grid gap-1 text-sm"><span className="text-slate-600">E-post</span>
              <Input type="email" value={form.primaryContact.email} onChange={e=>setForm({...form, primaryContact: {...form.primaryContact, email:e.target.value}})}/></label>
            <label className="grid gap-1 text-sm"><span className="text-slate-600">Telefon</span>
              <Input value={form.primaryContact.phone} onChange={e=>setForm({...form, primaryContact: {...form.primaryContact, phone:e.target.value}})}/></label>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">Ytterligare kontaktpersoner</div>
            <Button variant="secondary" size="sm" onClick={addContactRow}>Lägg till</Button>
          </div>
          <div className="grid gap-2">
            {form.contacts.map((c, idx)=>(
              <div key={c.id} className="grid grid-cols-12 gap-2">
                <div className="col-span-3"><Input placeholder="Namn" value={c.name} onChange={e=>{ const copy=[...form.contacts]; copy[idx]={...copy[idx], name:e.target.value}; setForm({...form, contacts: copy}); }}/></div>
                <div className="col-span-5"><Input placeholder="E-post" value={c.email} onChange={e=>{ const copy=[...form.contacts]; copy[idx]={...copy[idx], email:e.target.value}; setForm({...form, contacts: copy}); }}/></div>
                <div className="col-span-3"><Input placeholder="Telefon" value={c.phone} onChange={e=>{ const copy=[...form.contacts]; copy[idx]={...copy[idx], phone:e.target.value}; setForm({...form, contacts: copy}); }}/></div>
                <div className="col-span-1 flex items-center justify-end"><Button variant="ghost" size="sm" onClick={()=>{ const copy=[...form.contacts]; copy.splice(idx,1); setForm({...form, contacts: copy}); }}>✕</Button></div>
              </div>
            ))}
          </div>

          {editingId ? <Button onClick={update}>Spara ändringar</Button> : <Button onClick={add}>Spara kund</Button>}
        </CardContent></Card>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Input placeholder="Sök kund…" value={q} onChange={e=>setQ(e.target.value)} className="max-w-sm" />
          </div>
          <div className="grid gap-3">
            {customers.filter(c => [c.company, c.primaryContact?.name, c.primaryContact?.email].join(" ").toLowerCase().includes(q.toLowerCase()))
              .map(c=>(
              <Card key={c.id}><CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">{c.company}</div>
                    <div className="text-sm text-slate-500">{c.address}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CustomerLabelBadge label={c.label}/>
                    <StatusBadge status={c.status}/>
                  </div>
                </div>
                {c.primaryContact?.name && (
                  <div className="mt-2 text-sm">
                    Primär kontakt: <span className="font-medium">{c.primaryContact.name}</span>
                    {" "}{c.primaryContact.title ? `(${c.primaryContact.title}) · ` : " · "}
                    {c.primaryContact.email} · {c.primaryContact.phone}
                  </div>
                )}
                {(c.contacts||[]).length>0 && (
                  <div className="mt-2 text-sm text-slate-500">
                    Fler kontakter: {c.contacts.map(p=>p.name).filter(Boolean).join(", ")}
                  </div>
                )}
              </CardContent></Card>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

/* ---------- Leverantörer (redigering + popup + färger + sök) ---------- */
const Suppliers = ({ suppliers, setSuppliers, settings }) => {
  const empty = React.useMemo(()=>({
    name:"", title:"", company:"", email:"", phone:"", address:"", notes:"", type:(settings.supplierTypes||[])[0] || ""
  }), [settings]);

  const [form, setForm] = React.useState(empty);
  const [editingId, setEditingId] = React.useState(null);
  const [selected, setSelected] = React.useState(null);

  const [q, setQ] = React.useState("");
  const normQ = normalizeKey(q);
  const categoryKeyFromQuery = React.useMemo(() => {
    if (!normQ) return null;
    if (normQ.includes("stalhalls")) return "stalhallsleverantor";
    if (normQ.includes("mark"))      return "markforetag";
    if (normQ.includes("el"))        return "elleverantor";
    if (normQ.includes("vvs"))       return "vvsleverantor";
    if (normQ.includes("vent"))      return "ventleverantor";
    return null;
  }, [normQ]);

  const matchesFreeText = (s) => (s || "").toLowerCase().includes(q.toLowerCase());
  const supplierHasCategory = (s, key) => normalizeKey(s.type||"").includes(key);

  const filteredSuppliers = suppliers.filter(s => {
    if (!q) return true;
    if (categoryKeyFromQuery) return supplierHasCategory(s, categoryKeyFromQuery);
    return [s.name, s.company, s.title, s.email, s.phone, s.type].some(matchesFreeText);
  });

  const add = () => { const next=[...suppliers, { id: crypto.randomUUID(), ...form }]; setSuppliers(next); save(LS.suppliers,next); setForm(empty); };
  const startEdit = (id) => { const s=suppliers.find(x=>x.id===id); if(!s) return;
    setForm({ name:s.name||"", title:s.title||"", company:s.company||"", email:s.email||"", phone:s.phone||"", address:s.address||"", notes:s.notes||"", type:s.type|| (settings.supplierTypes||[])[0]||"" });
    setEditingId(id);
  };
  const update = () => { const next=suppliers.map(s=>s.id===editingId?{...s,...form}:s); setSuppliers(next); save(LS.suppliers,next); setForm(empty); setEditingId(null); };
  const cancel = () => { setForm(empty); setEditingId(null); };
  const remove = (id) => { if(!confirm("Ta bort leverantören?")) return; const next=suppliers.filter(s=>s.id!==id); setSuppliers(next); save(LS.suppliers,next); if(editingId===id) cancel(); if(selected?.id===id) setSelected(null); };

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        <Card><CardContent className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{editingId ? "Redigera leverantör" : "Ny leverantör"}</div>
            {editingId && <Button variant="ghost" size="sm" onClick={cancel}>Avbryt</Button>}
          </div>

          <label className="grid gap-1 text-sm"><span className="text-slate-600">Namn</span><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></label>
          <label className="grid gap-1 text-sm"><span className="text-slate-600">Titel</span><Input value={form.title} onChange={e=>setForm({...form, title:e.target.value})}/></label>
          <label className="grid gap-1 text-sm"><span className="text-slate-600">Företag</span><Input value={form.company} onChange={e=>setForm({...form, company:e.target.value})}/></label>
          <label className="grid gap-1 text-sm"><span className="text-slate-600">E-post</span><Input type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/></label>
          <label className="grid gap-1 text-sm"><span className="text-slate-600">Telefon</span><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></label>
          <label className="grid gap-1 text-sm"><span className="text-slate-600">Adress</span><Input value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/></label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Kategori</span>
            <Select value={form.type} onChange={v=>setForm({...form, type:v})}>
              {(settings.supplierTypes||[
                "Stålhallsleverantör","Markföretag","El leverantör","VVS leverantör","Vent leverantör"
              ]).map(x => <option key={x} value={x}>{x}</option>)}
            </Select>
          </label>
          <label className="grid gap-1 text-sm"><span className="text-slate-600">Övrig info</span><Textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/></label>

          {editingId ? <Button onClick={update}>Spara ändringar</Button> : <Button onClick={add}>Spara leverantör</Button>}
        </CardContent></Card>

        <div className="grid gap-3">
          <div className="mb-2">
            <Input placeholder="Sök leverantör… (namn, företag, 'vent', 'stålhalls', 'mark', 'el', 'vvs')" value={q} onChange={e=>setQ(e.target.value)} className="max-w-md" />
            {categoryKeyFromQuery && <div className="mt-1 text-xs text-slate-500">Visar kategori: <strong>{q}</strong></div>}
          </div>

          {filteredSuppliers.map(s => (
            <Card key={s.id}><CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-slate-500">{s.company} · {s.title}</div>
                </div>
                <SupplierTypeBadge type={s.type}/>
              </div>
              <div className="text-sm mt-2">{s.email} · {s.phone}</div>
              {s.address && <div className="text-xs text-slate-500">{s.address}</div>}
              {s.notes && <div className="text-sm mt-2">{s.notes}</div>}

              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={()=>setSelected(s)}>Öppna</Button>
                <Button size="sm" onClick={()=>startEdit(s.id)}>Redigera</Button>
                <Button size="sm" variant="outline" onClick={()=>remove(s.id)}>Ta bort</Button>
              </div>
            </CardContent></Card>
          ))}
        </div>
      </div>

      <Modal
        open={!!selected}
        onClose={()=>setSelected(null)}
        title={selected ? (selected.name || selected.company || "Leverantör") : ""}
        footer={selected && (<><Button variant="outline" onClick={()=>{ setSelected(null); startEdit(selected.id); }}>Redigera</Button><Button variant="outline" onClick={()=>remove(selected.id)}>Ta bort</Button><Button onClick={()=>setSelected(null)}>Stäng</Button></>)}
      >
        {selected && (
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2"><SupplierTypeBadge type={selected.type}/></div>
            {selected.company && <div><span className="text-slate-500">Företag:</span> {selected.company}</div>}
            {(selected.email || selected.phone) && <div><span className="text-slate-500">Kontakt:</span> {selected.email} · {selected.phone}</div>}
            {selected.address && <div><span className="text-slate-500">Adress:</span> {selected.address}</div>}
            {selected.notes && <div><span className="text-slate-500">Övrigt:</span> {selected.notes}</div>}
          </div>
        )}
      </Modal>
    </>
  )
}

/* ---------- Hjälpkomponent: Drag&Drop av LÄNKAR ---------- */
const DropLink = ({ onAddUrl }) => {
  const [highlight, setHighlight] = React.useState(false);
  const onDrop = (e) => {
    e.preventDefault(); setHighlight(false);
    // 1) Om användaren släpper text/URL
    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (text && /^https?:\/\//i.test(text.trim())) {
      onAddUrl(text.trim()); return;
    }
    // 2) Om användaren släpper filer: vi kan inte ta emot filer utan backend
    alert("För att bifoga filer här behöver vi en lagringstjänst (t.ex. OneDrive/SharePoint). Klistra in en DELNINGS-länk istället så länge.");
  };
  const onDragOver = (e) => { e.preventDefault(); setHighlight(true); }
  const onDragLeave = () => setHighlight(false);
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={"rounded-xl border text-xs p-3 " + (highlight ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200")}
      title="Dra in en länk (t.ex. OneDrive/SharePoint/Google Drive/Dropbox)…"
    >
      Dra & släpp en <b>länk</b> hit (OneDrive/SharePoint/Google Drive/Dropbox) eller klistra in i fältet ovan.
    </div>
  )
}

/* ---------- OFFERT (autonummer + koppling + bilagor + ritningar) ---------- */
const getNextOfferNumber = (offers) => {
  if (!offers || offers.length === 0) return 310050;
  const max = Math.max(...offers.map(o => Number(o.number || 0)));
  return isFinite(max) && max >= 310050 ? max + 1 : 310050;
};

const Offers = ({ offers, setOffers, customers, suppliers, projects, setProjects }) => {
  const [q, setQ] = React.useState("");
  const [editingId, setEditingId] = React.useState(null);

  const empty = React.useMemo(() => ({
    number: getNextOfferNumber(offers),
    name: "",
    address: "",
    customerId: "",
    supplierIds: [],
    notes: "",
    attachments: [], // {id,type:'Tidplan'|'Kalkyl'|'Ritning'|'Övrigt', url:string}
    lost: false,
    converted: false
  }), [offers]);

  const [form, setForm] = React.useState(empty);

  React.useEffect(()=>{ if (editingId===null) setForm(empty); }, [offers]); // uppdatera numret efter spar

  const startEdit = (id) => {
    const o = offers.find(x=>x.id===id); if(!o) return;
    setForm(JSON.parse(JSON.stringify(o)));
    setEditingId(id);
  };
  const cancel = () => { setForm(empty); setEditingId(null); };

  const addAttachment = (presetType="Tidplan") => {
    setForm({...form, attachments:[...form.attachments, { id: crypto.randomUUID(), type:presetType, url:"" }]});
  };
  const removeAttachment = (idx) => {
    const copy=[...form.attachments]; copy.splice(idx,1); setForm({...form, attachments: copy});
  };

  const addSupplierLink = (id) => {
    if(!id) return;
    if (form.supplierIds.includes(id)) return;
    setForm({...form, supplierIds:[...form.supplierIds, id]});
  };
  const removeSupplierLink = (id) => {
    setForm({...form, supplierIds: form.supplierIds.filter(x=>x!==id)});
  };

  const create = () => {
    const rec = { id: crypto.randomUUID(), ...form };
    const next = [...offers, rec];
    setOffers(next); save(LS.offers, next);
    setForm({...empty, number: getNextOfferNumber(next)});
  };
  const update = () => {
    const next = offers.map(o => o.id===editingId ? {...o, ...form} : o);
    setOffers(next); save(LS.offers, next); cancel();
  };
  const markLost = (id) => {
    const next = offers.map(o => o.id===id ? {...o, lost:true, converted:false} : o);
    setOffers(next); save(LS.offers, next);
  };

  const convertToProject = (id) => {
    const o = offers.find(x=>x.id===id); if(!o) return;
    if (o.converted) return;
    // skapa projekt
    const proj = {
      id: crypto.randomUUID(),
      name: o.name || `Projekt ${o.number}`,
      address: o.address || "",
      customerId: o.customerId || "",
      offerNumber: o.number,
      suppliers: o.supplierIds || [],
      startDate: "",
      endDate: "",
      budget: "",
      progress: 0,
      notes: "",
      attachments: [] // separata projektbilagor
    };
    const nextProjects = [...projects, proj];
    setProjects(nextProjects); save(LS.projects, nextProjects);
    const nextOffers = offers.map(x => x.id===id ? {...x, converted:true, lost:false} : x);
    setOffers(nextOffers); save(LS.offers, nextOffers);
    alert(`Projekt skapat från offert ${o.number}. Gå till fliken "Projekt" för att redigera.`);
  };

  const byText = (o) => {
    const c = customers.find(x=>x.id===o.customerId);
    const txt = [o.number, o.name, o.address, c?.company].join(" ").toLowerCase();
    return txt.includes(q.toLowerCase());
  };
  const filtered = offers.filter(byText);

  const customerOptions = [{id:"", company:"— välj kund —"}, ...customers];
  const supplierOptions = [{id:"", name:"— välj leverantör —", company:""}, ...suppliers];

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Form */}
      <Card><CardContent className="grid gap-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">{editingId ? `Redigera offert #${form.number}` : `Ny offert #${form.number}`}</div>
          {editingId && <Button variant="ghost" size="sm" onClick={cancel}>Avbryt</Button>}
        </div>

        <label className="grid gap-1 text-sm"><span className="text-slate-600">Projektnamn</span>
          <Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></label>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm"><span className="text-slate-600">Kund</span>
            <Select value={form.customerId} onChange={v=>setForm({...form, customerId:v})}>
              {customerOptions.map(c => <option key={c.id || 'none'} value={c.id}>{c.company}</option>)}
            </Select>
          </label>
          <label className="grid gap-1 text-sm"><span className="text-slate-600">Adress</span>
            <Input value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/></label>
        </div>

        <div className="grid gap-2">
          <div className="text-sm text-slate-600">Leverantörer</div>
          <div className="flex gap-2">
            <Select value="" onChange={addSupplierLink}>
              {supplierOptions.map(s => <option key={s.id || 'none'} value={s.id}>{s.name ? `${s.name} – ${s.company}` : s.name}</option>)}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.supplierIds.map(id => {
              const s = suppliers.find(x=>x.id===id);
              if (!s) return null;
              return (
                <span key={id} className="inline-flex items-center gap-2 border rounded-2xl px-2 py-1 text-xs">
                  {s.name} <SupplierTypeBadge type={s.type}/>
                  <button onClick={()=>removeSupplierLink(id)} title="Ta bort">✕</button>
                </span>
              )
            })}
          </div>
        </div>

        {/* Bilagor inkl. Ritning + Dropzone för LÄNKAR */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">Bilagor</div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={()=>addAttachment("Tidplan")}>+ Tidplan</Button>
              <Button size="sm" variant="secondary" onClick={()=>addAttachment("Kalkyl")}>+ Kalkyl</Button>
              <Button size="sm" variant="secondary" onClick={()=>addAttachment("Ritning")}>+ Ritning</Button>
              <Button size="sm" variant="secondary" onClick={()=>addAttachment("Övrigt")}>+ Övrigt</Button>
            </div>
          </div>

          {form.attachments.map((a, idx)=>(
            <div key={a.id} className="grid grid-cols-12 gap-2">
              <div className="col-span-3">
                <Select value={a.type} onChange={(v)=>{ const copy=[...form.attachments]; copy[idx]={...copy[idx], type:v}; setForm({...form, attachments: copy}); }}>
                  <option>Tidplan</option>
                  <option>Kalkyl</option>
                  <option>Ritning</option>
                  <option>Övrigt</option>
                </Select>
              </div>
              <div className="col-span-8">
                <Input placeholder="Klistra in DELNINGS-länk (PDF/Excel/Ritning)" value={a.url} onChange={e=>{ const copy=[...form.attachments]; copy[idx]={...copy[idx], url:e.target.value}; setForm({...form, attachments: copy}); }}/>
                <div className="mt-2"><DropLink onAddUrl={(u)=>{ const copy=[...form.attachments]; copy[idx]={...copy[idx], url:u}; setForm({...form, attachments: copy}); }} /></div>
              </div>
              <div className="col-span-1 flex items-center justify-end">
                <Button size="sm" variant="ghost" onClick={()=>removeAttachment(idx)}>✕</Button>
              </div>
            </div>
          ))}
        </div>

        <label className="grid gap-1 text-sm"><span className="text-slate-600">Anteckningar</span>
          <Textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/></label>

        <div className="flex gap-2">
          {editingId ? (
            <Button onClick={update}>Spara ändringar</Button>
          ) : (
            <Button onClick={create} disabled={!form.customerId || !form.name}>Spara offert</Button>
          )}
          {!editingId && <Button variant="outline" onClick={()=>setForm(empty)}>Rensa</Button>}
        </div>
      </CardContent></Card>

      {/* Lista */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Input className="max-w-sm" placeholder="Sök (nummer, namn, adress, kund)..." value={q} onChange={e=>setQ(e.target.value)} />
        </div>

        <div className="grid gap-3">
          {filtered.sort((a,b)=>Number(b.number)-Number(a.number)).map(o=>{
            const c = customers.find(x=>x.id===o.customerId);
            const status =
              o.converted ? "Vunnen" :
              o.lost ? "Förlorad" : "Aktiv";
            return (
              <Card key={o.id}><CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">#{o.number} · {o.name}</div>
                    <div className="text-sm text-slate-500">{c?.company || "—"} · {o.address || "Adress saknas"}</div>
                  </div>
                  <StatusBadge status={status}/>
                </div>

                {o.supplierIds.length>0 && (
                  <div className="mt-2 text-sm flex flex-wrap gap-2">
                    {o.supplierIds.map(id=>{
                      const s = suppliers.find(x=>x.id===id); if(!s) return null;
                      return <span key={id} className="inline-flex items-center gap-2 border rounded-2xl px-2 py-1">{s.name}<SupplierTypeBadge type={s.type}/></span>
                    })}
                  </div>
                )}
                {o.attachments.length>0 && (
                  <div className="mt-2 text-sm">
                    Bilagor:{" "}
                    {o.attachments.map(a=><a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="underline mr-2">{a.type}</a>)}
                  </div>
                )}
                {o.notes && <div className="mt-2 text-sm text-slate-700">{o.notes}</div>}

                <div className="mt-3 flex gap-2">
                  {!o.converted && !o.lost && (
                    <>
                      <Button size="sm" onClick={()=>startEdit(o.id)}>Redigera</Button>
                      <Button size="sm" onClick={()=>convertToProject(o.id)}>Markera som vunnen → Projekt</Button>
                      <Button size="sm" variant="outline" onClick={()=>markLost(o.id)}>Markera som förlorad</Button>
                    </>
                  )}
                  {(o.converted || o.lost) && <Button size="sm" onClick={()=>startEdit(o.id)}>Öppna</Button>}
                </div>
              </CardContent></Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ---------- PROJEKT (öppna & redigera i popup, inkl. bilagor + ritningar) ---------- */
const Projects = ({ projects, setProjects, customers, suppliers }) => {
  const [q, setQ] = React.useState("");
  const [openId, setOpenId] = React.useState(null);
  const proj = projects.find(p => p.id === openId) || null;

  const updateProject = (patch) => {
    if (!proj) return;
    const next = projects.map(p => p.id === proj.id ? { ...p, ...patch } : p);
    setProjects(next); save(LS.projects, next);
  };

  const addAttachment = (presetType="Ritning") => {
    const nextList = [...(proj.attachments||[]), { id: crypto.randomUUID(), type:presetType, url:"" }];
    updateProject({ attachments: nextList });
  };
  const removeAttachment = (idx) => {
    const copy = [...(proj.attachments||[])]; copy.splice(idx,1);
    updateProject({ attachments: copy });
  };

  const addSupplier = (id) => {
    if (!id) return;
    const set = new Set([...(proj.suppliers||[]), id]);
    updateProject({ suppliers: Array.from(set) });
  };
  const removeSupplier = (id) => {
    updateProject({ suppliers: (proj.suppliers||[]).filter(x=>x!==id) });
  };

  const filtered = projects.filter(p => {
    const c = customers.find(x=>x.id===p.customerId);
    const txt = [p.name, p.address, p.offerNumber, c?.company].join(" ").toLowerCase();
    return txt.includes(q.toLowerCase());
  });

  const supplierOptions = [{id:"", name:"— välj leverantör —", company:""}, ...suppliers];

  return (
    <>
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <Input className="max-w-sm" placeholder="Sök projekt (namn, kund, offertnr)..." value={q} onChange={e=>setQ(e.target.value)} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {filtered.sort((a,b)=>Number(b.offerNumber)-Number(a.offerNumber)).map(p=>{
            const c = customers.find(x=>x.id===p.customerId);
            return (
              <Card key={p.id}><CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-500">Offert #{p.offerNumber}</div>
                </div>
                <div className="text-sm text-slate-500">{c?.company || "—"} · {p.address || "Adress saknas"}</div>

                {p.suppliers && p.suppliers.length>0 && (
                  <div className="mt-2 text-sm flex flex-wrap gap-2">
                    {p.suppliers.map(id=>{
                      const s = suppliers.find(x=>x.id===id); if(!s) return null;
                      return <span key={id} className="inline-flex items-center gap-2 border rounded-2xl px-2 py-1">{s.name}<SupplierTypeBadge type={s.type}/></span>
                    })}
                  </div>
                )}

                <div className="mt-3">
                  <div className="text-xs text-slate-500 mb-1">Progress</div>
                  <div className="w-full h-2 rounded bg-slate-100 overflow-hidden">
                    <div className="h-2 bg-green-500" style={{width: `${Number(p.progress||0)}%`}} />
                  </div>
                </div>

                <div className="mt-3"><Button size="sm" onClick={()=>setOpenId(p.id)}>Öppna / Redigera</Button></div>
              </CardContent></Card>
            )
          })}
        </div>
      </div>

      {/* Edit-modal */}
      <Modal
        open={!!proj}
        onClose={()=>setOpenId(null)}
        title={proj ? `Projekt: ${proj.name}` : ""}
        footer={proj && (<Button onClick={()=>setOpenId(null)}>Stäng</Button>)}
      >
        {proj && (
          <div className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm"><span className="text-slate-600">Projektnamn</span>
                <Input value={proj.name} onChange={e=>updateProject({ name: e.target.value })}/></label>
              <label className="grid gap-1 text-sm"><span className="text-slate-600">Adress</span>
                <Input value={proj.address||""} onChange={e=>updateProject({ address: e.target.value })}/></label>
              <label className="grid gap-1 text-sm"><span className="text-slate-600">Startdatum</span>
                <Input type="date" value={proj.startDate||""} onChange={e=>updateProject({ startDate: e.target.value })}/></label>
              <label className="grid gap-1 text-sm"><span className="text-slate-600">Slutdatum</span>
                <Input type="date" value={proj.endDate||""} onChange={e=>updateProject({ endDate: e.target.value })}/></label>
              <label className="grid gap-1 text-sm"><span className="text-slate-600">Budget</span>
                <Input value={proj.budget||""} onChange={e=>updateProject({ budget: e.target.value })} placeholder="ex. 1 250 000 SEK"/></label>
              <label className="grid gap-1 text-sm"><span className="text-slate-600">Progress (%)</span>
                <Input type="number" min="0" max="100" value={proj.progress||0} onChange={e=>updateProject({ progress: Math.max(0, Math.min(100, Number(e.target.value)||0)) })}/></label>
            </div>

            <label className="grid gap-1 text-sm"><span className="text-slate-600">Anteckningar</span>
              <Textarea value={proj.notes||""} onChange={e=>updateProject({ notes: e.target.value })}/></label>

            <div className="grid gap-2">
              <div className="text-sm text-slate-600">Leverantörer</div>
              <Select value="" onChange={addSupplier}>
                {supplierOptions.map(s => <option key={s.id || 'none'} value={s.id}>{s.name ? `${s.name} – ${s.company}` : s.name}</option>)}
              </Select>
              <div className="flex flex-wrap gap-2">
                {(proj.suppliers||[]).map(id=>{
                  const s = suppliers.find(x=>x.id===id); if(!s) return null;
                  return <span key={id} className="inline-flex items-center gap-2 border rounded-2xl px-2 py-1 text-xs">{s.name}<SupplierTypeBadge type={s.type}/><button onClick={()=>removeSupplier(id)}>✕</button></span>
                })}
              </div>
            </div>

            {/* Bilagor inkl. Ritning + Dropzone för LÄNKAR */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">Projektbilagor</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={()=>addAttachment("Ritning")}>+ Ritning</Button>
                  <Button size="sm" variant="secondary" onClick={()=>addAttachment("Tidplan")}>+ Tidplan</Button>
                  <Button size="sm" variant="secondary" onClick={()=>addAttachment("Kalkyl")}>+ Kalkyl</Button>
                  <Button size="sm" variant="secondary" onClick={()=>addAttachment("Övrigt")}>+ Övrigt</Button>
                </div>
              </div>

              {(proj.attachments||[]).map((a, idx)=>(
                <div key={a.id} className="grid grid-cols-12 gap-2">
                  <div className="col-span-3">
                    <Select value={a.type} onChange={(v)=>{ const copy=[...(proj.attachments||[])]; copy[idx]={...copy[idx], type:v}; updateProject({ attachments: copy }); }}>
                      <option>Ritning</option>
                      <option>Tidplan</option>
                      <option>Kalkyl</option>
                      <option>Övrigt</option>
                    </Select>
                  </div>
                  <div className="col-span-8">
                    <Input placeholder="Klistra in DELNINGS-länk (PDF/ritning)" value={a.url} onChange={e=>{ const copy=[...(proj.attachments||[])]; copy[idx]={...copy[idx], url:e.target.value}; updateProject({ attachments: copy }); }}/>
                    <div className="mt-2"><DropLink onAddUrl={(u)=>{ const copy=[...(proj.attachments||[])]; copy[idx]={...copy[idx], url:u}; updateProject({ attachments: copy }); }} /></div>
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <Button size="sm" variant="ghost" onClick={()=>removeAttachment(idx)}>✕</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

/* ---------- Platshållare ---------- */
const Placeholder = ({ title }) => (
  <Card><CardContent>
    <div className="text-lg font-semibold">{title}</div>
    <div className="text-sm text-slate-600 mt-1">Detta är en platshållare. Vi kan bygga ut den när du vill.</div>
  </CardContent></Card>
)

/* ---------- App ---------- */
export default function App() {
  const [tab, setTab] = React.useState("dashboard")
  const [settings, setSettings] = React.useState(load(LS.settings, defaultSettings))
  const [data, setData] = React.useState({
    customers: load(LS.customers, []),
    suppliers: load(LS.suppliers, []),
    offers: load(LS.offers, []),
    projects: load(LS.projects, []),
    activities: load(LS.activities, []),
  })

  // Demo-data första gången (om allt är tomt)
  React.useEffect(() => {
    const isEmpty =
      data.customers.length===0 &&
      data.suppliers.length===0 &&
      data.offers.length===0 &&
      data.projects.length===0 &&
      data.activities.length===0
    if (isEmpty) {
      const demoCustomers = [{
        id: crypto.randomUUID(),
        company: "Exempel AB",
        label: "Entreprenad",
        status: "Aktiv",
        address: "Storgatan 1",
        primaryContact: { name: "Anna Andersson", title: "Inköp", email: "anna@exempel.se", phone: "070-000 00 00" },
        contacts: []
      }]
      const demoSuppliers = [{
        id: crypto.randomUUID(),
        name: "Bengt Bengtsson",
        title: "Sälj",
        company: "Vent & Co",
        email: "bengt@ventco.se",
        phone: "",
        address: "",
        notes: "",
        type: "Vent leverantör"
      }]
      save(LS.customers, demoCustomers)
      save(LS.suppliers, demoSuppliers)
      setData(d => ({ ...d, customers: demoCustomers, suppliers: demoSuppliers }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Shell current={tab} setCurrent={setTab} settings={settings}>
      {tab === "dashboard"     && <Dashboard offers={data.offers} projects={data.projects} activities={data.activities} />}
      {tab === "aktivitet"     && <Placeholder title="Aktivitet" />}
      {tab === "offert"        && (
        <Offers
          offers={data.offers}
          setOffers={(v)=>{ setData(d=>({...d, offers:v})); }}
          customers={data.customers}
          suppliers={data.suppliers}
          projects={data.projects}
          setProjects={(v)=>{ setData(d=>({...d, projects:v})); }}
        />
      )}
      {tab === "projekt"       && (
        <Projects
          projects={data.projects}
          setProjects={(v)=>{ setData(d=>({...d, projects:v})); }}
          customers={data.customers}
          suppliers={data.suppliers}
        />
      )}
      {tab === "kunder"        && (
        <Customers
          customers={data.customers}
          setCustomers={(v)=>{ setData(d=>({...d, customers:v})); }}
          settings={settings}
        />
      )}
      {tab === "leverantorer"  && (
        <Suppliers
          suppliers={data.suppliers}
          setSuppliers={(v)=>{ setData(d=>({...d, suppliers:v})); }}
          settings={settings}
        />
      )}
      {tab === "settings"      && <Placeholder title="Inställningar" />}

      <div className="mt-10 text-xs text-slate-500">
        © Mach Entreprenad AB • Prototyp. Data sparas lokalt i din webbläsare.
      </div>
    </Shell>
  )
}
