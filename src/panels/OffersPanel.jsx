import React, { useEffect, useMemo, useState } from "react";

/**
 * Hjälpare för att hitta kundnamn
 */
function getCustomerName(entities, customerId) {
  if (!customerId) return "";
  const c = (entities || []).find(
    (e) => e.type === "customer" && e.id === customerId
  );
  return c?.companyName || c?.name || "";
}

/**
 * Badges
 */
function statusClass(status) {
  const base = "text-xs px-2 py-1 rounded";
  switch (status) {
    case "utkast":
      return `${base} bg-gray-100 text-gray-700`;
    case "skickad":
      return `${base} bg-blue-100 text-blue-700`;
    case "vunnet":
      return `${base} bg-green-100 text-green-700`;
    case "förlorad":
      return `${base} bg-rose-100 text-rose-700`;
    default:
      return `${base} bg-gray-100 text-gray-700`;
  }
}

function typeBadge(isEntreprenad, isTurbovex) {
  const out = [];
  if (isEntreprenad) {
    out.push(
      <span
        key="e"
        className="text-xs px-2 py-1 rounded bg-orange-200 text-orange-900"
      >
        Entreprenad
      </span>
    );
  }
  if (isTurbovex) {
    out.push(
      <span
        key="t"
        className="text-xs px-2 py-1 rounded bg-sky-200 text-sky-900"
      >
        Turbovex
      </span>
    );
  }
  return out;
}

/* ======================================
   Offerter — lista + popup + Arkiv/Återställ
   ====================================== */

export default function OffersPanel({ offers = [], entities = [], setState }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mode, setMode] = useState("active"); // "active" | "archive"
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  // Öppna direkt om _shouldOpen är satt
  useEffect(() => {
    const o = (offers || []).find((x) => x?._shouldOpen);
    if (!o) return;
    setOpenItem(o);
    setDraft({
      id: o.id,
      title: o.title || "",
      customerId: o.customerId || "",
      value: o.value || 0,
      status: o.status || "utkast",
      note: o.note || "",
      isEntreprenad: !!o.isEntreprenad,
      isTurbovex: !!o.isTurbovex,
    });
    setState((s) => ({
      ...s,
      offers: (s.offers || []).map((x) =>
        x.id === o.id ? { ...x, _shouldOpen: undefined } : x
      ),
    }));
  }, [offers, setState]);

  const customers = useMemo(
    () => (entities || []).filter((e) => e.type === "customer"),
    [entities]
  );

  const list = useMemo(() => {
    let arr = Array.isArray(offers) ? offers.slice() : [];

    if (mode === "active") {
      arr = arr.filter((o) => !o.deletedAt);
    } else {
      arr = arr.filter((o) => !!o.deletedAt);
    }

    if (statusFilter !== "all") {
      arr = arr.filter(
        (o) => (o.status || "utkast") === statusFilter
      );
    }

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter((o) => {
        const title = (o.title || "").toLowerCase();
        const custName = getCustomerName(entities, o.customerId).toLowerCase();
        return title.includes(s) || custName.includes(s);
      });
    }

    arr.sort((a, b) => {
      const ad = a.createdAt || "";
      const bd = b.createdAt || "";
      return bd.localeCompare(ad); // senaste först
    });

    return arr;
  }, [offers, entities, q, statusFilter, mode]);

  const openEdit = (o) => {
    setOpenItem(o);
    setDraft({
      id: o.id,
      title: o.title || "",
      customerId: o.customerId || "",
      value: o.value || 0,
      status: o.status || "utkast",
      note: o.note || "",
      isEntreprenad: !!o.isEntreprenad,
      isTurbovex: !!o.isTurbovex,
    });
  };

  const saveDraft = () => {
    if (!draft) return;
    setState((s) => ({
      ...s,
      offers: (s.offers || []).map((o) =>
        o.id === draft.id
          ? {
              ...o,
              title: draft.title || "",
              customerId: draft.customerId || "",
              value: Number(draft.value) || 0,
              status: draft.status || "utkast",
              note: draft.note || "",
              isEntreprenad: !!draft.isEntreprenad,
              isTurbovex: !!draft.isTurbovex,
              updatedAt: new Date().toISOString(),
            }
          : o
      ),
    }));
    // Stäng popup när vi sparar
    setOpenItem(null);
    setDraft(null);
  };

  const softDelete = (offer) => {
    if (
      !window.confirm(
        "Ta bort denna offert? Den hamnar i Arkiv och kan tas bort permanent därifrån."
      )
    )
      return;
    setState((s) => ({
      ...s,
      offers: (s.offers || []).map((o) =>
        o.id === offer.id
          ? { ...o, deletedAt: new Date().toISOString() }
          : o
      ),
    }));
    if (openItem?.id === offer.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  const restoreOffer = (offer) => {
    if (!window.confirm("Återställa denna offert till Aktiva?")) return;
    setState((s) => ({
      ...s,
      offers: (s.offers || []).map((o) =>
        o.id === offer.id ? { ...o, deletedAt: undefined } : o
      ),
    }));
    if (openItem?.id === offer.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  const hardDelete = (offer) => {
    if (
      !window.confirm(
        "Ta bort denna offert PERMANENT? Detta går inte att ångra."
      )
    )
      return;
    setState((s) => ({
      ...s,
      offers: (s.offers || []).filter((o) => o.id !== offer.id),
    }));
    if (openItem?.id === offer.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  const handlePrint = () => {
    if (!draft) return;
    window.print();
  };

  const handleMail = () => {
    if (!draft) return;
    const customerName = getCustomerName(entities, draft.customerId);
    const subject = encodeURIComponent(
      `Offert ${draft.title || ""}`.trim()
    );
    const lines = [];

    if (customerName) lines.push(`Kund: ${customerName}`);
    if (draft.value) lines.push(`Belopp: ${draft.value} kr`);
    if (draft.isEntreprenad) lines.push(`Typ: Entreprenad`);
    if (draft.isTurbovex) lines.push(`Typ: Turbovex`);
    if (draft.status) lines.push(`Status: ${draft.status}`);
    if (draft.note) {
      lines.push("");
      lines.push("Notering:");
      lines.push(draft.note);
    }

    const body = encodeURIComponent(lines.join("\n"));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      {/* Header + filter */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Offerter</h2>
          <div className="flex rounded-xl overflow-hidden border">
            <button
              type="button"
              className={`px-3 py-1 text-sm ${
                mode === "active"
                  ? "bg-black text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setMode("active")}
            >
              Aktiva
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-sm ${
                mode === "archive"
                  ? "bg-black text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setMode("archive")}
            >
              Arkiv
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="Sök på titel eller kund..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="border rounded-xl px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Alla statusar</option>
            <option value="utkast">Utkast</option>
            <option value="skickad">Skickad</option>
            <option value="vunnet">Vunnet</option>
            <option value="förlorad">Förlorad</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      <ul className="divide-y">
        {list.map((o) => {
          const custName = getCustomerName(entities, o.customerId);
          return (
            <li key={o.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                  onClick={() => openEdit(o)}
                  type="button"
                >
                  <div className="font-medium truncate">
                    {o.title || "(namnlös offert)"}
                    {mode === "archive" ? " (Arkiv)" : ""}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {custName && <span>{custName}</span>}
                    {o.value ? (
                      <span>{Number(o.value).toLocaleString("sv-SE")} kr</span>
                    ) : null}
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {typeBadge(o.isEntreprenad, o.isTurbovex)}
                  <span className={statusClass(o.status || "utkast")}>
                    {o.status || "utkast"}
                  </span>

                  {mode === "active" ? (
                    <button
                      className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                      onClick={() => softDelete(o)}
                      type="button"
                    >
                      Ta bort
                    </button>
                  ) : (
                    <>
                      <button
                        className="text-xs px-2 py-1 rounded bg-emerald-500 text-white"
                        onClick={() => restoreOffer(o)}
                        type="button"
                      >
                        Återställ
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded bg-rose-700 text-white"
                        onClick={() => hardDelete(o)}
                        type="button"
                      >
                        Ta bort permanent
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="py-6 text-sm text-gray-500">
            {mode === "active"
              ? "Inga offerter."
              : "Inga arkiverade offerter."}
          </li>
        )}
      </ul>

      {/* Popup */}
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
              <div className="font-semibold">Redigera offert</div>
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
                <label className="text-sm font-medium">Titel</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Kund</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.customerId}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      customerId: e.target.value,
                    }))
                  }
                >
                  <option value="">—</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName || c.name || c.id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Belopp (kr)</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  value={draft.value}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      value: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      status: e.target.value,
                    }))
                  }
                >
                  <option value="utkast">Utkast</option>
                  <option value="skickad">Skickad</option>
                  <option value="vunnet">Vunnet</option>
                  <option value="förlorad">Förlorad</option>
                </select>
              </div>

              <div className="col-span-2">
                <div className="text-sm font-medium mb-1">
                  Typ (visas som färgad ikon)
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!draft.isEntreprenad}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          isEntreprenad: e.target.checked,
                        }))
                      }
                    />
                    <span>Entreprenad (orange ikon)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!draft.isTurbovex}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          isTurbovex: e.target.checked,
                        }))
                      }
                    />
                    <span>Turbovex (ljusblå ikon)</span>
                  </label>
                </div>
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium">Notering</label>
                <textarea
                  className="w-full border rounded px-3 py-2 min-h-[100px]"
                  value={draft.note}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      note: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="px-3 py-2 rounded bg-green-600 text-white"
                onClick={saveDraft}
                type="button"
              >
                Spara
              </button>

              <button
                className="px-3 py-2 rounded border"
                onClick={handlePrint}
                type="button"
              >
                Skriv ut
              </button>

              <button
                className="px-3 py-2 rounded border"
                onClick={handleMail}
                type="button"
              >
                Maila offert
              </button>

              <button
                className="px-3 py-2 rounded bg-rose-600 text-white"
                onClick={() => softDelete(openItem)}
                type="button"
              >
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
