import React from 'react'
import { LS, load, save, defaultSettings } from './lib/storage.js'

/* ---------- Små UI-komponenter ---------- */
const Card = ({children, className=""}) => (
  <div className={"rounded-2xl bg-white shadow-sm border " + className}>{children}</div>
)
const CardContent = ({children, className=""}) => (
  <div className={"p-4 " + className}>{children}</div>
)
const Button = ({children, className="", onClick, variant="default", size="md", type="button"}) => {
  const base = "inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-medium transition"
  const variants = {
    default: "bg-black text-white hover:opacity-90",
    ghost: "hover:bg-slate-100",
    outline: "border hover:bg-slate-50",
    secondary: "bg-slate-800/10 hover:bg-slate-800/20"
  }
  const sizes = { sm: "px-2 py-1 text-xs", md: "", lg: "px-4 py-3" }
  return <button type={type} onClick={onClick} className={[base, variants[variant], sizes[size], className].join(" ")}>{children}</button>
}
const Input = (props) => <input {...props} className={"border rounded-xl px-3 py-2 text-sm w-full " + (props.className||"")} />
const Textarea = (props) => <textarea {...props} className={"border rounded-xl px-3 py-2 text-sm w-full min-h-[90px] " + (props.className||"")} />
const Select = ({value, onChange, children}) => (
  <select value={value} onChange={(e)=>onChange && onChange(e.target.value)} className="border rounded-xl px-3 py-2 text-sm w-full">{children}</select>
)

/* Etikettfärger för kunder */
const CustomerLabelBadge = ({label}) => {
  const map = {
    "Entreprenad": "bg-orange-100 text-orange-800 border border-orange-200",
    "Turbovex": "bg-green-100 text-green-800 border border-green-200",
    "Övrigt": "bg-gray-100 text-gray-700 border border-gray-200"
  }
  const cls = map[label] || "bg-gray-100 text-gray-700 border"
  return <span className={"inline-flex items-center px-2 py-1 text-xs rounded-xl " + cls}>{label}</span>
}
const StatusBadge = ({status}) => (
  <span className="inline-flex items-center px-2 py-1 text-xs rounded-xl bg-slate-900 text-white">{status}</span>
)

/* Etikettfärger för leverantörers kategori (robust mot stavning/versaler/åäö) */
const normalizeKey = (s) =>
  (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')                 // dela diakrit
    .replace(/[\u0300-\u036f]/g, '')  // ta bort diakrit
    .replace(/\s+/g, '');             // ta bort mellanslag

const SupplierTypeBadge = ({type}) => {
  const key = normalizeKey(type);
  // Nycklar vi matchar: stalhallsleverantor, markforetag, elleverantor, vvsleverantor, ventleverantor
  let cls = "bg-gray-100 text-gray-700 border border-gray-200"; // default ljusgrå
  if (key.includes("stalhallsleverantor")) cls = "bg-gray-100 text-gray-700 border border-gray-200";          // ljusgrå
  else if (key.includes("markforetag"))    cls = "bg-amber-100 text-amber-800 border border-amber-200";       // mellanbrun (amber)
  else if (key.includes("elleverantor"))   cls = "bg-red-100 text-red-800 border border-red-200";             // ljusröd
  else if (key.includes("vvsleverantor"))  cls = "bg-sky-100 text-sky-800 border border-sky-200";             // ljusblå
  else if (key.includes("ventleverantor")) cls = "bg-green-100 text-green-800 border border-green-200";       // ljusgrön

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

/* ---------- Kunder (med redigering + flera kontakter + popup) ---------- */
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

  const add = () => {
    const next = [...customers, { id: crypto.randomUUID(), ...form }];
    setCustomers(next);
    save(LS.customers, next);
    setForm(emptyForm);
  };

  const update = () => {
    const next = customers.map(c => c.id === editingId ? { ...c, ...form } : c);
    setCustomers(next);
    save(LS.customers, next);
    cancelEdit();
  };

  const remove = (id) => {
    if (!confirm("Ta bort kunden?")) return;
    const next = customers.filter(c => c.id !== id);
    setCustomers(next);
    save(LS.customers, next);
    if (editingId === id) cancelEdit();
    if (selected?.id === id) setSelected(null);
  };

  const addContactRow = () => {
    setForm({ ...form, contacts: [...form.contacts, { id: crypto.randomUUID(), name: "", email: "", phone: "" }]});
  };
  const removeContactRow = (idx) => {
    const copy = [...form.contacts];
    copy.splice(idx, 1);
    setForm({ ...form, contacts: copy });
  };

  const filtered = customers.filter(c =>
    [c.company, c.primaryContact?.name, c.primaryContact?.email].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        <Card><CardContent className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{editingId ? "Redigera kund" : "Ny kund"}</div>
            {editingId && <Button variant="ghost" size="sm" onClick={cancelEdit}>Avbryt</Button>}
          </div>

          <label className="grid gap-1 text-sm"><span className="text-slate-600">Företag</span>
            <Input value={form.company} onChange={e=>setForm({...form, company:e.target.value})}/>
          </label>

          <label className="grid gap-1 text-sm"><span className="text-slate-600">Etikett</span>
            <Select value={form.label} onChange={v=>setForm({...form, label:v})}>
              {(settings.customerLabels||[]).map(x => <option key={x} value={x}>{x}</option>)}
            </Select>
          </label>

          <label className="grid gap-1 text-sm"><span className="text-slate-600">Status</span>
            <Select value={form.status} onChange={v=>setForm({...form, status:v})}>
              {(settings.customerStatus||[]).map(x => <option key={x} value={x}>{x}</option>)}
            </Select>
          </label>

          <label className="grid gap-1 text-sm"><span className="text-slate-600">Adress</span>
            <Input value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/>
          </label>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm"><span className="text-slate-600">Kontaktperson</span>
              <Input value={form.primaryContact.name} onChange={e=>setForm({...form, primaryContact: {...form.primaryContact, name:e.target.value}})}/>
            </label>
            <label className="grid gap-1 text-sm"><span className="text-slate-600">Titel</span>
              <Input value={form.primaryContact.title} onChange={e=>setForm({...form, primaryContact: {...form.primaryContact, title:e.target.value}})}/>
            </label>
            <label className="grid gap-1 text-sm"><span className="text-slate-600">E-post</span>
              <Input type="email" value={form.primaryContact.email} onChange={e=>setForm({...form, primaryContact: {...form.primaryContact, email:e.target.value}})}/>
            </label>
            <label className="grid gap-1 text-sm"><span className="text-slate-600">Telefon</span>
              <Input value={form.primaryContact.phone} onChange={e=>setForm({...form, primaryContact: {...form.primaryContact, phone:e.target.value}})}/>
            </label>
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

          {editingId
            ? <Button onClick={update}>Spara ändringar</Button>
            : <Button onClick={add}>Spara kund</Button>
          }
        </CardContent></Card>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Input placeholder="Sök kund…" value={q} onChange={e=>setQ(e.target.value)} className="max-w-sm" />
          </div>
          <div className="grid gap-3">
            {filtered.map(c=>(
              <Card key={c.id}>
                <CardContent>
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

                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={()=>setSelected(c)}>Öppna</Button>
                    <Button size="sm" onClick={()=>startEdit(c.id)}>Redigera</Button>
                    <Button size="sm" variant="outline" onClick={()=>remove(c.id)}>Ta bort</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={!!selected}
        onClose={()=>setSelected(null)}
        title={selected ? selected.company : ""}
        footer={
          selected && (
            <>
              <Button variant="outline" onClick={()=>{ setSelected(null); startEdit(selected.id); }}>Redigera</Button>
              <Button variant="outline" onClick={()=>remove(selected.id)}>Ta bort</Button>
              <Button onClick={()=>setSelected(null)}>Stäng</Button>
            </>
          )
        }
      >
        {selected && (
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <CustomerLabelBadge label={selected.label}/>
              <StatusBadge status={selected.status}/>
            </div>
            {selected.address && <div><span className="text-slate-500">Adress:</span> {selected.address}</div>}
            {selected.primaryContact?.name && (
              <div>
                <span className="text-slate-500">Primär kontakt:</span> {selected.primaryContact.name}
                {selected.primaryContact.title ? ` (${selected.primaryContact.title})` : ""} · {selected.primaryContact.email} · {selected.primaryContact.phone}
              </div>
            )}
            {(selected.contacts||[]).length>0 && (
              <div>
                <div className="text-slate-500">Fler kontaktpersoner:</div>
                <ul className="list-disc ml-5">
                  {selected.contacts.map(p=>(
                    <li key={p.id || p.email}>{[p.name, p.email, p.phone].filter(Boolean).join(" · ")}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

/* ---------- Leverantörer (med redigering + popup + färger) ---------- */
const Suppliers = ({ suppliers, setSuppliers, settings }) => {
  const empty = React.useMemo(()=>({
    name:"", title:"", company:"", email:"", phone:"", address:"", notes:"", type:(settings.supplierTypes||[])[0] || ""
  }), [settings]);

  const [form, setForm] = React.useState(empty);
  const [editingId, setEditingId] = React.useState(null);
  const [selected, setSelected] = React.useState(null);

  const add = () => {
    const next = [...suppliers, { id: crypto.randomUUID(), ...form }];
    setSuppliers(next);
    save(LS.suppliers, next);
    setForm(empty);
  };
  const startEdit = (id) => {
    const s = suppliers.find(x=>x.id===id);
    if (!s) return;
    setForm({
      name: s.name || "", title: s.title || "", company: s.company || "",
      email: s.email || "", phone: s.phone || "", address: s.address || "",
      notes: s.notes || "", type: s.type || (settings.supplierTypes||[])[0] || ""
    });
    setEditingId(id);
  };
  const update = () => {
    const next = suppliers.map(s => s.id===editingId ? { ...s, ...form } : s);
    setSuppliers(next);
    save(LS.suppliers, next);
    setForm(empty);
    setEditingId(null);
  };
  const cancel = () => { setForm(empty); setEditingId(null); };
  const remove = (id) => {
    if (!confirm("Ta bort leverantören?")) return;
    const next = suppliers.filter(s => s.id !== id);
    setSuppliers(next);
    save(LS.suppliers, next);
    if (editingId === id) cancel();
    if (selected?.id === id) setSelected(null);
  };

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
                "Stålhallsleverantör",
                "Markföretag",
                "El leverantör",
                "VVS leverantör",
                "Vent leverantör"
              ]).map(x => <option key={x} value={x}>{x}</option>)}
            </Select>
          </label>
          <label className="grid gap-1 text-sm"><span className="text-slate-600">Övrig info</span><Textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/></label>

          {editingId
            ? <Button onClick={update}>Spara ändringar</Button>
            : <Button onClick={add}>Spara leverantör</Button>
          }
        </CardContent></Card>

        <div className="grid gap-3">
          {suppliers.map(s => (
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
        footer={
          selected && (
            <>
              <Button variant="outline" onClick={()=>{ setSelected(null); startEdit(selected.id); }}>Redigera</Button>
              <Button variant="outline" onClick={()=>remove(selected.id)}>Ta bort</Button>
              <Button onClick={()=>setSelected(null)}>Stäng</Button>
            </>
          )
        }
      >
        {selected && (
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <SupplierTypeBadge type={selected.type}/>
            </div>
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

/* ---------- Platshållare (vi fyller på i nästa steg) ---------- */
const Placeholder = ({ title }) => (
  <Card><CardContent>
    <div className="text-lg font-semibold">{title}</div>
    <div className="text-sm text-slate-600 mt-1">Detta är en platshållare. Vi fyller på i nästa steg.</div>
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
      {tab === "offert"        && <Placeholder title="Offert" />}
      {tab === "projekt"       && <Placeholder title="Projekt" />}
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
