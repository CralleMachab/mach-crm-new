import React from 'react'
import { LS, load, save, defaultSettings } from './lib/storage.js'

/** UI-bitar (enkla, utan externa bibliotek) */
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
  return (
    <button type={type} onClick={onClick} className={[base, variants[variant], sizes[size], className].join(" ")}>
      {children}
    </button>
  )
}

/** Layout: Sidebar + skal */
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

/** Dashboard-kort */
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

/** Temporära platshållare – vi fyller på i nästa steg */
const Placeholder = ({ title }) => (
  <Card><CardContent>
    <div className="text-lg font-semibold">{title}</div>
    <div className="text-sm text-slate-600 mt-1">
      Detta är en platshållare. I nästa steg fyller vi på med riktig funktionalitet.
    </div>
  </CardContent></Card>
)

/** App */
export default function App() {
  // aktuell flik i vänstermenyn
  const [tab, setTab] = React.useState("dashboard")

  // inställningar + data (sparas i localStorage)
  const [settings, setSettings] = React.useState(load(LS.settings, defaultSettings))
  const [data, setData] = React.useState({
    customers: load(LS.customers, []),
    suppliers: load(LS.suppliers, []),
    offers: load(LS.offers, []),
    projects: load(LS.projects, []),
    activities: load(LS.activities, []),
  })

  // liten demo-seed vid första körningen (bara om allt är tomt)
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
      {tab === "kunder"        && <Placeholder title="Kunder" />}
      {tab === "leverantorer"  && <Placeholder title="Leverantörer" />}
      {tab === "settings"      && <Placeholder title="Inställningar" />}

      <div className="mt-10 text-xs text-slate-500">
        © Mach Entreprenad AB • Prototyp som körs i webbläsaren. Nästa steg: fyll på sidorna en i taget.
      </div>
    </Shell>
  )
}
