import React, { useEffect, useMemo, useState } from "react";
import { customerCategoryBadge } from "../utils/categoryBadges";

export default function CustomersPanel({ entities = [], setState }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    const c = (entities || []).find((e) => e.type === "customer" && e._shouldOpen);
    if (!c) return;

    setOpenItem(c);
    setDraft({
      id: c.id,
      companyName: c.companyName || "",
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      orgNo: c.orgNo || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      zip: c.zip || "",
      city: c.city || "",
      customerCategory: c.customerCategory || "",
      notes: c.notes || "",
    });

    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === c.id ? { ...e, _shouldOpen: undefined } : e
      ),
    }));
  }, [entities, setState]);

  const list = useMemo(() => {
    let arr = (entities || []).filter((e) => e.type === "customer" && !e.deletedAt);

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
      arr = arr.filter((e) => (e.customerCategory || "") === cat);
    }

    const withUsed = arr.filter((e) => !!e.lastUsedAt);
    withUsed.sort((a, b) => (b.lastUsedAt || "").localeCompare(a.lastUsedAt || ""));
    const top3 = withUsed.slice(0, 3).map((e) => e.id);

    const topList = arr.filter((e) => top3.includes(e.id));
    const rest = arr.filter((e) => !top3.includes(e.id));
    rest.sort((a, b) => (a.companyName || "").localeCompare(b.companyName || ""));

    return [...topList, ...rest];
  }, [entities, q, cat]);

  const openEdit = (c) => {
    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === c.id ? { ...e, lastUsedAt: new Date().toISOString() } : e
      ),
    }));

    setOpenItem(c);
    setDraft({
      id: c.id,
      companyName: c.companyName || "",
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      orgNo: c.orgNo || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      zip: c.zip || "",
      city: c.city || "",
      customerCategory: c.customerCategory || "",
      notes: c.notes || "",
    });
  };

  const updateDraft = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const createSupplierFromCustomer = () => {
    if (!draft) return;

    const id = crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

    const sup = {
      id,
      type: "supplier",
      companyName: draft.companyName || "",
      firstName: draft.firstName || "",
      lastName: draft.lastName || "",
      orgNo: draft.orgNo || "",
      phone: draft.phone || "",
      email: draft.email || "",
      address: draft.address || "",
      zip: draft.zip || "",
      city: draft.city || "",
      supplierCategory: draft.customerCategory || "",
      notes: draft.notes || "",
      createdAt: new Date().toISOString(),
    };

    setState((s) => ({ ...s, entities: [...(s.entities || []), sup] }));
    alert("Leverantör skapad från kunden.");
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
              customerCategory: draft.customerCategory || "",
              notes: draft.notes || "",
              updatedAt: new Date().toISOString(),
            }
          : e
      ),
    }));

    setOpenItem(null);
    setDraft(null);
  };

  const softDelete = (c) => {
    if (
      !window.confirm(
        "Ta bort denna kund? Den hamnar i arkiv (kan återställas via Inställningar)."
      )
    )
      return;

    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === c.id ? { ...e, deletedAt: new Date().toISOString() } : e
      ),
    }));

    if (openItem?.id === c.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="font-semibold">Kunder</h2>
        <div className="flex gap-2">
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="Sök..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="border rounded-xl px-3 py-2"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="all">Alla kategorier</option>
            <option value="StålHall">Stålhall</option>
            <option value="Totalentreprenad">Totalentreprenad</option>
            <option value="Turbovex">Turbovex</option>
            <option value="Admin">Admin</option>
            <option value="Övrigt">Övrigt</option>
          </select>
        </div>
      </div>

      <ul className="divide-y">
        {list.map((c) => (
          <li key={c.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                onClick={() => openEdit(c)}
                type="button"
              >
                <div className="font-medium truncate">
                  {c.companyName || "(namnlös kund)"}
                  {(c.firstName || c.lastName) && (
                    <span className="text-sm text-gray-500 ml-1">
                      {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {[c.city || "", c.phone || ""].filter(Boolean).join(" · ")}
                </div>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <span className={customerCategoryBadge(c.customerCategory)}>
                  {c.customerCategory || "—"}
                </span>
                <button
                  className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                  onClick={() => softDelete(c)}
                  type="button"
                >
                  Ta bort
                </button>
              </div>
            </div>
          </li>
        ))}
        {list.length === 0 && <li className="py-6 text-sm text-gray-500">Inga kunder.</li>}
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
              <div className="font-semibold">Redigera kund</div>
              <button
                className="text-sm"
                onClick={() => {
                  setOpenItem(null);
                  setDraft(null);
                }}
                type="button"
              >
                Stäng
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Företag</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.companyName}
                  onChange={(e) => updateDraft("companyName", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Förnamn</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.firstName || ""}
                  onChange={(e) => updateDraft("firstName", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Efternamn</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.lastName || ""}
                  onChange={(e) => updateDraft("lastName", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">OrgNr</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.orgNo}
                  onChange={(e) => updateDraft("orgNo", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Telefon</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.phone}
                  onChange={(e) => updateDraft("phone", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Epost</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.email}
                  onChange={(e) => updateDraft("email", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Adress</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.address}
                  onChange={(e) => updateDraft("address", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Postnr</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.zip}
                  onChange={(e) => updateDraft("zip", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Ort</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.city}
                  onChange={(e) => updateDraft("city", e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Anteckningar</label>
                <textarea
                  className="w-full border rounded px-3 py-2 min-h-[80px]"
                  value={draft.notes || ""}
                  onChange={(e) => updateDraft("notes", e.target.value)}
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium">Kategori</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={draft.customerCategory}
                    onChange={(e) => updateDraft("customerCategory", e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="StålHall">Stålhall</option>
                    <option value="Totalentreprenad">Totalentreprenad</option>
                    <option value="Turbovex">Turbovex</option>
                    <option value="Admin">Admin</option>
                    <option value="Övrigt">Övrigt</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="text-xs px-2 py-2 rounded bg-slate-600 text-white whitespace-nowrap"
                  onClick={createSupplierFromCustomer}
                >
                  Gör till leverantör
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

              <button
                className="ml-auto px-3 py-2 rounded border"
                onClick={() => {
                  setOpenItem(null);
                  setDraft(null);
                }}
                type="button"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}