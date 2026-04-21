import React, { useEffect, useMemo, useState } from "react";
import { supplierCategoryBadge } from "../utils/categoryBadges";

export default function SuppliersPanel({ entities = [], setState }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [mode, setMode] = useState("active"); // active | archive
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    const s = (entities || []).find((e) => e.type === "supplier" && e._shouldOpen);
    if (!s) return;

    setOpenItem(s);
    setDraft({
      id: s.id,
      companyName: s.companyName || "",
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      orgNo: s.orgNo || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      zip: s.zip || "",
      city: s.city || "",
      supplierCategory: s.supplierCategory || "",
      notes: s.notes || "",
    });

    setState((st) => ({
      ...st,
      entities: (st.entities || []).map((e) =>
        e.id === s.id ? { ...e, _shouldOpen: undefined } : e
      ),
    }));
  }, [entities, setState]);

  const list = useMemo(() => {
    let arr = (entities || []).filter((e) => e.type === "supplier");
    arr = mode === "active" ? arr.filter((e) => !e.deletedAt) : arr.filter((e) => !!e.deletedAt);

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter(
        (e) =>
          (e.companyName || "").toLowerCase().includes(s) ||
          (e.orgNo || "").toLowerCase().includes(s) ||
          (e.city || "").toLowerCase().includes(s) ||
          (e.firstName || "").toLowerCase().includes(s) ||
          (e.lastName || "").toLowerCase().includes(s) ||
          `${e.firstName || ""} ${e.lastName || ""}`.toLowerCase().includes(s)
      );
    }

    if (cat !== "all") {
      arr = arr.filter((e) => (e.supplierCategory || "") === cat);
    }

    arr.sort((a, b) => (a.companyName || "").localeCompare(b.companyName || ""));
    return arr;
  }, [entities, q, cat, mode]);

  const openEdit = (s) => {
    setState((st) => ({
      ...st,
      entities: (st.entities || []).map((e) =>
        e.id === s.id ? { ...e, lastUsedAt: new Date().toISOString() } : e
      ),
    }));

    setOpenItem(s);
    setDraft({
      id: s.id,
      companyName: s.companyName || "",
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      orgNo: s.orgNo || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      zip: s.zip || "",
      city: s.city || "",
      supplierCategory: s.supplierCategory || "",
      notes: s.notes || "",
    });
  };

  const updateDraft = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const createCustomerFromSupplier = () => {
    if (!draft) return;

    const id = crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

    const c = {
      id,
      type: "customer",
      companyName: draft.companyName || "",
      firstName: draft.firstName || "",
      lastName: draft.lastName || "",
      orgNo: draft.orgNo || "",
      phone: draft.phone || "",
      email: draft.email || "",
      address: draft.address || "",
      zip: draft.zip || "",
      city: draft.city || "",
      customerCategory: draft.supplierCategory || "",
      notes: draft.notes || "",
      createdAt: new Date().toISOString(),
    };

    setState((s) => ({ ...s, entities: [...(s.entities || []), c] }));
    alert("Kund skapad från leverantören.");
  };

  const saveDraft = () => {
    if (!draft) return;

    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === draft.id
          ? {
              ...e,
              companyName: draft.companyName || "",
              firstName: draft.firstName || "",
              lastName: draft.lastName || "",
              orgNo: draft.orgNo || "",
              phone: draft.phone || "",
              email: draft.email || "",
              address: draft.address || "",
              zip: draft.zip || "",
              city: draft.city || "",
              supplierCategory: draft.supplierCategory || "",
              notes: draft.notes || "",
              updatedAt: new Date().toISOString(),
            }
          : e
      ),
    }));

    setOpenItem(null);
    setDraft(null);
  };

  const softDelete = (sup) => {
    if (
      !window.confirm(
        "Ta bort denna leverantör? Den hamnar i arkiv (kan återställas via Inställningar)."
      )
    )
      return;

    setState((s0) => ({
      ...s0,
      entities: (s0.entities || []).map((e) =>
        e.id === sup.id ? { ...e, deletedAt: new Date().toISOString() } : e
      ),
    }));

    if (openItem?.id === sup.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  const hardDelete = (sup) => {
    if (!window.confirm("Ta bort denna leverantör PERMANENT? Detta går inte att ångra.")) return;

    setState((s0) => ({
      ...s0,
      entities: (s0.entities || []).filter((e) => e.id !== sup.id),
    }));

    if (openItem?.id === sup.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Leverantörer</h2>
          <div className="flex rounded-xl overflow-hidden border">
            <button
              type="button"
              className={`px-3 py-1 text-sm ${
                mode === "active" ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setMode("active")}
            >
              Aktiva
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-sm ${
                mode === "archive" ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setMode("archive")}
            >
              Arkiv
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <input className="border rounded-xl px-3 py-2" placeholder="Sök..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="border rounded-xl px-3 py-2" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">Alla kategorier</option>
            <option value="Stålhalls leverantör">Stålhalls leverantör</option>
            <option value="Mark företag">Mark företag</option>
            <option value="EL leverantör">EL leverantör</option>
            <option value="VVS Leverantör">VVS Leverantör</option>
            <option value="Vent Leverantör">Vent Leverantör</option>
            <option value="Bygg">Bygg</option>
            <option value="Projektering">Projektering</option>
            <option value="Admin">Admin</option>
            <option value="Övrigt">Övrigt</option>
          </select>
        </div>
      </div>

      <ul className="divide-y">
        {list.map((sup) => (
          <li key={sup.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                onClick={() => openEdit(sup)}
                type="button"
              >
                <div className="font-medium truncate">
                  {sup.companyName || "(namnlös leverantör)"}
                  {(sup.firstName || sup.lastName) && (
                    <span className="text-sm text-gray-500 ml-1">
                      {[sup.firstName, sup.lastName].filter(Boolean).join(" ")}
                    </span>
                  )}
                  {mode === "archive" ? " (Arkiv)" : ""}
                </div>
                <div className="text-xs text-gray-500">
                  {[sup.city || "", sup.phone || ""].filter(Boolean).join(" · ")}
                </div>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <span className={supplierCategoryBadge(sup.supplierCategory)}>
                  {sup.supplierCategory || "—"}
                </span>

                {mode === "active" ? (
                  <button
                    className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                    onClick={() => softDelete(sup)}
                    type="button"
                  >
                    Ta bort
                  </button>
                ) : (
                  <button
                    className="text-xs px-2 py-1 rounded bg-rose-700 text-white"
                    onClick={() => hardDelete(sup)}
                    type="button"
                  >
                    Ta bort permanent
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}

        {list.length === 0 && (
          <li className="py-6 text-sm text-gray-500">
            {mode === "active" ? "Inga leverantörer." : "Inga arkiverade leverantörer."}
          </li>
        )}
      </ul>

      {openItem && draft && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => {
            setOpenItem(null);
            setDraft(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow p-4 w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Redigera leverantör</div>
              <button className="text-sm" onClick={() => { setOpenItem(null); setDraft(null); }} type="button">
                Stäng
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Företag</label>
                <input className="w-full border rounded px-3 py-2" value={draft.companyName} onChange={(e) => updateDraft("companyName", e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">Förnamn</label>
                <input className="w-full border rounded px-3 py-2" value={draft.firstName || ""} onChange={(e) => updateDraft("firstName", e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">Efternamn</label>
                <input className="w-full border rounded px-3 py-2" value={draft.lastName || ""} onChange={(e) => updateDraft("lastName", e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">OrgNr</label>
                <input className="w-full border rounded px-3 py-2" value={draft.orgNo} onChange={(e) => updateDraft("orgNo", e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">Telefon</label>
                <input className="w-full border rounded px-3 py-2" value={draft.phone} onChange={(e) => updateDraft("phone", e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">Epost</label>
                <input className="w-full border rounded px-3 py-2" value={draft.email} onChange={(e) => updateDraft("email", e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">Adress</label>
                <input className="w-full border rounded px-3 py-2" value={draft.address} onChange={(e) => updateDraft("address", e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">Postnr</label>
                <input className="w-full border rounded px-3 py-2" value={draft.zip} onChange={(e) => updateDraft("zip", e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">Ort</label>
                <input className="w-full border rounded px-3 py-2" value={draft.city} onChange={(e) => updateDraft("city", e.target.value)} />
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Anteckningar</label>
                <textarea className="w-full border rounded px-3 py-2 min-h-[80px]" value={draft.notes || ""} onChange={(e) => updateDraft("notes", e.target.value)} />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium">Kategori</label>
                  <select className="w-full border rounded px-3 py-2" value={draft.supplierCategory} onChange={(e) => updateDraft("supplierCategory", e.target.value)}>
                    <option value="">—</option>
                    <option value="Stålhalls leverantör">Stålhalls leverantör</option>
                    <option value="Mark företag">Mark företag</option>
                    <option value="EL leverantör">EL leverantör</option>
                    <option value="VVS Leverantör">VVS Leverantör</option>
                    <option value="Vent Leverantör">Vent Leverantör</option>
                    <option value="Bygg">Bygg</option>
                    <option value="Projektering">Projektering</option>
                    <option value="Admin">Admin</option>
                    <option value="Övrigt">Övrigt</option>
                  </select>
                </div>

                <button type="button" className="text-xs px-2 py-2 rounded bg-slate-600 text-white whitespace-nowrap" onClick={createCustomerFromSupplier}>
                  Gör till kund
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={saveDraft} type="button">
                Spara
              </button>

              <button className="px-3 py-2 rounded bg-rose-600 text-white" onClick={() => softDelete(openItem)} type="button">
                Ta bort
              </button>

              <button className="ml-auto px-3 py-2 rounded border" onClick={() => { setOpenItem(null); setDraft(null); }} type="button">
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}