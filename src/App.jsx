import React from 'react'
import { LS, load, save, defaultSettings } from './lib/storage.js'

/* --- Små UI-bitar --- */
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
const Badge = ({children, className=""}) => (
  <span className={"inline-flex items-center px-2 py-1 text-xs rounded-xl bg-slate-900 text-white " + className}>{children}</span>
)

/* --- Layout --- */
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

/* --- Dashboard --- */
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

/* --- Kunder (med sök + flera kontaktpersoner) --- */
const Customers = ({ customers, setCustomers, settings }) => {
  const [q, setQ] = React.useState("")
  const [form, setForm] = React.useState({
    company: "",
    label: (settings.customerLabels||[])[0] || "Entreprenad",
    status: (settings.customerStatus||[])[0] || "Aktiv",
    primaryContact: { name: "", title: "", email: "", phone: "" },
    address: "",
    contacts: []
  })

  const add = () => {
    const next = [...customers, { id: crypto.randomUUID(), ...form }]
    setCustomers(next)
    save(LS.customers, next)
    setForm({
      company: "",
      label: (settings.customerLabels||[])[0] || "Entreprenad",
      status: (settings.customerStatus||[])[0] || "Aktiv",
      primaryContact: { name: "", title: "", email: "", phone: "" },
      address: "",
      contacts: []
    })
  }
  const addContactRow = () => setForm({ ...form, contacts: [...form.contacts, { id: crypto.randomUUID(), name: "", email: "", phone: "" }]})
  const filtered = customers.filter(c =>
    [c.company, c.primaryContact?.name, c.primaryContact?.email].join(" ").toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card><CardContent className="grid gap-3">
        <div className="text-lg font-semibold">Ny kund</div>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-600">Företag</span>
          <Input value={form.company} onChange={e=>setForm({...form, company:e.target.value})}/>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-600">Etikett</span>
          <Select value={form.label} onChange={v=>setForm({...form, label:v})}>
            {(settings.customerLabels||[]).map(x => <option key={x} value={x}>{x}</option>)}
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-600">Status</span>
          <Select value={form.status} onChange={v=>setForm({...form, status:v})}>
            {(settings.customerStatus||[]).map(x => <option key={x} value={x}>{x}</option>)}
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-600">Adress</span>
          <Input value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/>
        </label>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Kontaktperson</span>
            <Input value={form.primaryContact.name} onChange={e=>setForm({...form, primaryContact: {...form.primaryContact, name:e.target.value}})}/>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Titel</span>
            <Input value={form.primaryContact.title} onChange={e=>setForm({...form, primaryContact: {...form.primaryContact, title:e.target.value}})}/>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">E-post</span>
            <Input type="email" value={form.primaryContact.email} onChange={e=>setForm({...form, primaryContact: {...form.primaryContact, email:e.target.value}})}/>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Telefon</span>
            <Input value={form.primaryContact.phone} onChange={e=>setForm({...form, primaryContact: {...form.primaryContact, phone:e.target.value}})}/>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">Ytterligare kontaktpersoner</div>
          <Button variant="secondary" size="sm" onClick={addContactRow}>Lägg till</Button>
        </div>
        <div className="grid gap-2">
          {form.contacts.map((c, idx)=>(
            <div key={c.id} className="grid grid-cols-3 gap-2">
              <Input placeholder="Namn" value={c.name} onChange={e=>{ const copy=[...form.contacts]; copy[idx]={...copy[idx], name:e.target.value}; setForm({...form, contacts: copy}); }}/>
              <Input placeholder="E-post" value={c.email} onChange={e=>{ const copy=[...form.contacts]; copy[idx]={...copy[idx], email:e.target.value}; setForm({...form, contacts: copy}); }}/>
              <Input placeholder="Telefon" value={c.phone} onChange={e=>{ const copy=[...form.contacts]; copy[idx]={...copy[idx], phone:e.target.value}; setForm({...form, contacts: copy}); }}/>
            </div>
          ))}
        </div>

        <Button onClick={add}>Spara kund</Button>
      </CardContent></Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Input placeholder="Sök kund…" value={q} onChange={e=>setQ(e.target.value)} className="max-w-sm" />
        </div>
        <div className="grid gap-3">
          {filtered.map(c=>(
            <Card key={c.id}><CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{c.company}</div>
                  <div className="text-sm text-slate-500">{c.address}</div>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-white text-slate-700 border">{c.label}</Badge>
                  <Badge>{c.status}</Badge>
                </div>
              </div>
              {c.primaryContact?.name && (
                <div className="mt-2 text-sm">
                  Primär kontakt: <span className="font-medium">{c.primaryContact.name}</span> ({c.primaryContact.title}) · {c.primaryContact.email} · {c.primaryContact.phone}
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
  )
}

/* --- Leverantörer --- */
const Suppliers = ({ suppliers, setSuppliers, settings }) => {
  const [form, setForm] = React.useState({
    name:"", title:"", company:"", email:"", phone:"", address:"", notes:"", type:(settings.supplierTypes||[])[0] || ""
  })
  const add = () => {
    const next = [...suppliers, { id: crypto.randomUUID(), ...form }]
    setSuppliers(next)
    save(LS.suppliers, next)
    setForm({ name:"", title:"", company:"", email:"", phone:"", address:"", notes:"", type:(settings.supplierTypes||[])[0] || "" })
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card><CardContent className="grid gap-3">
        <div className="text-lg font-semibold">Ny leverantör</div>
        <label className="grid gap-1 text-sm"><span className="text-slate-600">Namn</span><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></label>
        <label className="grid gap-1 text-sm"><span className="text-slate-600">Titel</span><Input value={form.title} onChange={e=>setForm({...form, title:e.target.value})}/></label>
        <label className="grid gap-1 text-sm"><span className="text-slate-600">Företag</span><Input value={form.company} onChange={e=>setForm({...form, company:e.target.value})}/></label>
        <label className="grid gap-1 text-sm"><span className="text-slate-600">E-post</span><Input type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/></label>
        <label className="grid gap-1 text-sm"><span className="text-slate-600">Telefon</span><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></label>
        <label className="grid gap-1 text-sm"><span className="text-slate-600">Adress</span><Input value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/></label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-600">Kategori</span>
          <Select value={form.type} onChange={v=>setForm({...form, type:v})}>
            {(settings.supplierTypes||[]).map(x => <option key={x} value={x}>{x}</option>)}
          </Select>
        </label>
        <label className="grid gap-1 text-sm"><span className="text-slate-600">Övrig info</span><Textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/></label>
        <Button onClick={add}>Spara leverantör</Button>
      </CardContent></Card>

      <div className="grid gap-3">
        {suppliers.map(s => (
          <Card key={s.id}><CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-sm text-slate-500">{s.company} · {s.title}</div>
              </div>
              <Badge>{s.type}</Badge>
            </div>
            <div className="text-sm mt-2">{s.email} · {s.phone}</div>
            {s.address && <div className="text-xs text-slate-500">{s.address}</div>}
            {s.notes && <div className="text-sm mt-2">{s.notes}</div>}
          </CardContent></Card>
        ))}
      </div>
    </div>
  )
}

/* --- Platshållare (resterande fyller vi i nästa steg) --- */
const Placeholder = ({ title }) => (
  <Card><CardContent>
    <div className="text-lg font-semibold">{title}</div>
    <div className="text-sm text-slate-600 mt-1">Detta är en platshållare. Vi fyller på i nästa steg.</div>
  </CardContent></Card>
)

/* --- App --- */
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
        type: "Vent Leverantör"
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
      {tab === "kunder"        && <Customers customers={data.customers} setCustomers={(v)=>{ setData(d=>({...d, customers:v})); }} settings={settings} />}
      {tab === "leverantorer"  && <Suppliers suppliers={data.suppliers} setSuppliers={(v)=>{ setData(d=>({...d, suppliers:v})); }} settings={settings} />}
      {tab === "settings"      && <Placeholder title="Inställningar" />}

      <div className="mt-10 text-xs text-slate-500">
        © Mach Entreprenad AB • Prototyp. Data sparas lokalt i din webbläsare.
      </div>
    </Shell>
  )
}
