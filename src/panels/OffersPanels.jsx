// src/panels/OffersPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { pickOneDriveFiles } from "../components/onedrive";

const FILE_CATS = ["Ritningar","Offerter","Kalkyler","KMA"];
const flattenFiles = (obj) => {
  if (!obj || typeof obj !== "object") return [];
  const out = [];
  FILE_CATS.forEach(cat => {
    const arr = Array.isArray(obj[cat]) ? obj[cat] : [];
    arr.forEach(f => out.push({
      id: f.id || Math.random().toString(36).slice(0,8),
      name: f.name||"fil",
      webUrl: f.webUrl || f.url || "#",
      category: cat
    }));
  });
  return out;
};
const groupFiles = (list=[]) => {
  const obj = { Ritningar:[], Offerter:[], Kalkyler:[], KMA:[] };
  list.forEach(f=>{
    const cat = FILE_CATS.includes(f.category) ? f.category : "Offerter";
    obj[cat].push({ id:f.id||Math.random().toString(36).slice(0,8), name:f.name||"fil", webUrl:f.webUrl||f.url||"#" });
  });
  return obj;
};

export default function OffersPanel({ offers = [], entities = [], setState }) {
  const [q, setQ] = useState("");
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  const customers  = useMemo(() => (entities || []).filter(e => e.type === "customer"), [entities]);
  const suppliers  = useMemo(() => (entities || []).filter(e => e.type === "supplier"), [entities]);
  const customerName = id => (customers.find(c=>c.id===id)?.companyName) || "—";

  // öppna nyss skapad offert
  useEffect(() => {
    const o = (offers || []).find(x => x?._shouldOpen);
    if (!o) return;
    const filesList = flattenFiles(o.files);
    setOpenItem(o);
    setDraft({
      id:o.id,
      title:o.title||"",
      customerId:o.customerId||"",
      value:o.value ?? 0,
      status:o.status||"utkast",
      note:o.note||"",
      filesList,
      supplierIds: Array.isArray(o.supplierIds) ? o.supplierIds.slice() : [],
    });
    setState(s => ({
      ...s,
      offers: (s.offers || []).map(x => x.id === o.id ? { ...x, _shouldOpen: undefined } : x),
    }));
  }, [offers, setState]);

  const list = useMemo(() => {
    let arr = (offers||[]).filter(o=>!o.deletedAt);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter(o => (o.title||"").toLowerCase().includes(s));
    }
    arr.sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""));
    return arr;
  }, [offers, q]);

  const openEdit = (o)=>{
    const filesList = flattenFiles(o.files);
    setOpenItem(o);
    setDraft({
      id:o.id,
      title:o.title||"",
      customerId:o.customerId||"",
      value:o.value ?? 0,
      status:o.status||"utkast",
      note:o.note||"",
      filesList,
      supplierIds: Array.isArray(o.supplierIds) ? o.supplierIds.slice() : [],
    });
  };

  const setFileField = (idx, field, value) => {
    setDraft(d=>{
      const copy = (d.filesList||[]).slice();
      copy[idx] = { ...copy[idx], [field]: value };
      return { ...d, filesList: copy };
    });
  };
  const addManualFile = () => {
    setDraft(d => ({
      ...d,
      filesList: [...(d.filesList||[]), { id: Math.random().toString(36).slice(0,8), name:"Ny fil", webUrl:"#", category:"Offerter" }]
    }));
  };
  const addFilesFromOneDrive = async () => {
    try{
      const picked = await pickOneDriveFiles();
      if (!picked || picked.length===0) return;
      setDraft(d => ({
        ...d,
        filesList: [...(d.filesList||[]),
          ...picked.map(p => ({
            id: p.id || Math.random().toString(36).slice(0,8),
            name: p.name || "fil",
            webUrl: p.webUrl || p.url || "#",
            category: "Offerter" // kan ändras i dropdown
          }))
        ]
      }));
    }catch(e){
      alert("Kunde inte hämta filer från OneDrive. Du kan lägga till manuellt med knappen nedan.");
    }
  };
  const removeFileRow = (idx) => {
    setDraft(d=>{
      const copy = (d.filesList||[]).slice();
      copy.splice(idx,1);
      return { ...d, filesList: copy };
    });
  };

  // leverantörer (flera)
  const addSupplierToOffer = (supplierId)=>{
    if (!supplierId) return;
    setDraft(d=>{
      const set = new Set(d.supplierIds||[]);
      set.add(supplierId);
      return { ...d, supplierIds: Array.from(set) };
    });
  };
  const removeSupplierFromOffer = (supplierId)=>{
    setDraft(d=> ({ ...d, supplierIds: (d.supplierIds||[]).filter(id=>id!==supplierId) }));
  };

  const saveDraft = ()=>{
    if (!draft) return;
    const files = groupFiles(draft.filesList||[]);
    setState(s=>({
      ...s,
      offers: (s.offers||[]).map(o=>o.id===draft.id ? {
        ...o,
        title: draft.title||"",
        customerId: draft.customerId||"",
        value: Number(draft.value)||0,
        status: draft.status||"utkast",
        note: draft.note||"",
        files,
        supplierIds: Array.isArray(draft.supplierIds) ? draft.supplierIds.slice() : [],
        updatedAt:new Date().toISOString()
      } : o)
    }));
    setOpenItem(null); setDraft(null);
  };

  const softDelete = (o)=>{
    setState(s=>({...s, offers:(s.offers||[]).map(x=>x.id===o.id?{...x,deletedAt:new Date().toISOString()}:x)}));
    if(openItem?.id===o.id){ setOpenItem(null); setDraft(null); }
  };

  // Skapa projekt från VUNNEN offert (ärver filer + leverantörer)
  function createProjectFromOffer() {
    if (!draft) return;
    const files = groupFiles(draft.filesList || []);
    const proj = {
      id: (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(0,8)),
      name: draft.title || "Projekt",
      customerId: draft.customerId || "",
      status: "pågående",
      budget: Number(draft.value) || 0,
      note: draft.note || "",
      files,
      originatingOfferId: draft.id,
      supplierIds: Array.isArray(draft.supplierIds) ? draft.supplierIds.slice() : [],
      createdAt: new Date().toISOString(),
    };
    setState(s=>({
      ...s,
      projects: [ ...(s.projects||[]), proj ],
      offers: (s.offers||[]).map(o=>o.id===draft.id ? { ...o, status:"vunnen", updatedAt:new Date().toISOString() } : o)
    }));
    setOpenItem(null); setDraft(null);
    alert("Projekt skapat från offert (öppnas inte automatiskt).");
  }

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Offerter</h2>
        <input className="border rounded-xl px-3 py-2" placeholder="Sök..." value={q} onChange={e=>setQ(e.target.value)} />
      </div>

      <ul className="divide-y">
        {list.map(o=>(
          <li key={o.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1" onClick={()=>openEdit(o)} type="button">
                <div className="font-medium truncate">{o.title||"Offert"}</div>
                <div className="text-xs text-gray-500">
                  Kund: {customerName(o.customerId)} · {o.status||"utkast"} · {(o.value||0).toLocaleString("sv-SE")} kr
                </div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <button className="text-xs px-2 py-1 rounded bg-rose-500 text-white" onClick={()=>softDelete(o)} type="button">Ta bort</button>
              </div>
            </div>
          </li>
        ))}
        {list.length===0 && <li className="py-6 text-sm text-gray-500">Inga offerter.</li>}
      </ul>

      {openItem && draft && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={()=>{ setOpenItem(null); setDraft(null); }}>
          <div className="bg-white rounded-2xl shadow p-4 w-full max-w-3xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Redigera offert</div>
              <button className="text-sm" onClick={()=>{ setOpenItem(null); setDraft(null); }} type="button">Stäng</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Titel</label>
                <input className="w-full border rounded px-3 py-2" value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} />
              </div>
              <div>
                <label className="text-sm font-medium">Kund</label>
                <select className="w-full border rounded px-3 py-2" value={draft.customerId} onChange={e=>setDraft(d=>({...d,customerId:e.target.value}))}>
                  <option value="">—</option>
                  {customers.map(c=><option key={c.id} value={c.id}>{c.companyName||c.id}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Belopp (kr)</label>
                <input type="number" className="w-full border rounded px-3 py-2" value={draft.value} onChange={e=>setDraft(d=>({...d,value:e.target.value}))} />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select className="w-full border rounded px-3 py-2" value={draft.status} onChange={e=>setDraft(d=>({...d,status:e.target.value}))}>
                  <option value="utkast">Utkast</option>
                  <option value="inskickad">Inskickad</option>
                  <option value="vunnen">Vunnen</option>
                  <option value="förlorad">Förlorad</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Anteckning</label>
                <textarea className="w-full border rounded px-3 py-2 min-h-[80px]" value={draft.note} onChange={e=>setDraft(d=>({...d,note:e.target.value}))} />
              </div>
            </div>

            {/* Leverantörer */}
            <div className="mt-4 border rounded-xl p-3">
              <div className="font-medium mb-2">Kopplade leverantörer</div>
              <div className="flex gap-2 mb-2">
                <select className="border rounded px-2 py-1" onChange={e=>{ addSupplierToOffer(e.target.value); e.target.value=""; }}>
                  <option value="">+ Lägg till leverantör…</option>
                  {suppliers
                    .filter(s=>!(draft.supplierIds||[]).includes(s.id))
                    .sort((a,b)=> (a.companyName||"").localeCompare(b.companyName||""))
                    .map(s=><option key={s.id} value={s.id}>{s.companyName||s.id}</option>)
                  }
                </select>
              </div>
              {(draft.supplierIds||[]).length===0 ? (
                <div className="text-xs text-gray-500">Inga leverantörer kopplade.</div>
              ) : (
                <ul className="text-sm space-y-1">
                  {draft.supplierIds.map(id=>{
                    const sup = suppliers.find(s=>s.id===id);
                    return (
                      <li key={id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{sup?.companyName || id}</span>
                        <button className="text-xs px-2 py-1 rounded bg-rose-500 text-white" onClick={()=>removeSupplierFromOffer(id)} type="button">Ta bort</button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Filer */}
            <div className="mt-4 border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">Filer</div>
                <div className="flex gap-2">
                  <button className="text-xs px-2 py-1 rounded border" onClick={addFilesFromOneDrive} type="button">+ Lägg till från OneDrive</button>
                  <button className="text-xs px-2 py-1 rounded border" onClick={addManualFile} type="button">+ Lägg till länk manuellt</button>
                </div>
              </div>

              {(draft.filesList||[]).length===0 ? (
                <div className="text-xs text-gray-500">Inga filer tillagda.</div>
              ) : (
                <div className="space-y-2">
                  {(draft.filesList||[]).map((f,idx)=>(
                    <div key={f.id||idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <select className="w-full border rounded px-2 py-1 text-sm" value={f.category||"Offerter"} onChange={e=>setFileField(idx,"category",e.target.value)}>
                          {FILE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="col-span-4">
                        <input className="w-full border rounded px-2 py-1 text-sm" value={f.name||""} onChange={e=>setFileField(idx,"name",e.target.value)} placeholder="Filnamn" />
                      </div>
                      <div className="col-span-4">
                        <input className="w-full border rounded px-2 py-1 text-sm" value={f.webUrl||""} onChange={e=>setFileField(idx,"webUrl",e.target.value)} placeholder="Länk (URL)" />
                      </div>
                      <div className="col-span-1 text-right">
                        <button className="text-xs px-2 py-1 rounded bg-rose-500 text-white" onClick={()=>removeFileRow(idx)} type="button">Ta bort</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={saveDraft} type="button">Spara</button>
              {draft.status==="vunnen" && (
                <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={createProjectFromOffer} type="button">
                  Skapa projekt från offert (ärver filer & leverantörer)
                </button>
              )}
              <button className="px-3 py-2 rounded bg-rose-600 text-white" onClick={()=>softDelete(openItem)} type="button">Ta bort</button>
              <button className="ml-auto px-3 py-2 rounded border" onClick={()=>{ setOpenItem(null); setDraft(null); }} type="button">Avbryt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
