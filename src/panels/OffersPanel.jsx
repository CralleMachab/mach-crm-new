// src/panels/OffersPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { pickOneDriveFiles } from "../components/onedrive";

const FILE_CATS = ["Ritningar", "Offerter", "Kalkyler", "KMA"];

const flattenFiles = (obj) => {
  if (!obj || typeof obj !== "object") return [];
  const out = [];
  FILE_CATS.forEach((cat) => {
    const arr = Array.isArray(obj[cat]) ? obj[cat] : [];
    arr.forEach((f) =>
      out.push({
        id: f.id || Math.random().toString(36).slice(0, 8),
        name: f.name || "fil",
        webUrl: f.webUrl || f.url || "#",
        category: cat,
      })
    );
  });
  return out;
};

const groupFiles = (list = []) => {
  const obj = { Ritningar: [], Offerter: [], Kalkyler: [], KMA: [] };
  list.forEach((f) => {
    const cat = FILE_CATS.includes(f.category) ? f.category : "Offerter";
    obj[cat].push({
      id: f.id || Math.random().toString(36).slice(0, 8),
      name: f.name || "fil",
      webUrl: f.webUrl || f.url || "#",
    });
  });
  return obj;
};

export default function OffersPanel({ offers = [], entities = [], setState }) {
  const [q, setQ] = useState("");
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  const customers = useMemo(
    () => (entities || []).filter((e) => e.type === "customer"),
    [entities]
  );
  const suppliers = useMemo(
    () => (entities || []).filter((e) => e.type === "supplier"),
    [entities]
  );
  const customerName = (id) =>
    customers.find((c) => c.id === id)?.companyName || "—";

  // Öppna direkt om _shouldOpen är satt
  useEffect(() => {
    const o = (offers || []).find((x) => x?._shouldOpen);
    if (!o) return;
    const filesList = flattenFiles(o.files);
    setOpenItem(o);
    setDraft({
      id: o.id,
      title: o.title || "",
      customerId: o.customerId || "",
      value: o.value ?? 0,
      status: o.status || "utkast",
      note: o.note || "",
      filesList,
      supplierIds: Array.isArray(o.supplierIds) ? o.supplierIds.slice() : [],
      kind: o.kind || "", // Entreprenad / Turbovex (om du vill använda det senare)
    });
    setState((s) => ({
      ...s,
      offers: (s.offers || []).map((x) =>
        x.id === o.id ? { ...x, _shouldOpen: undefined } : x
      ),
    }));
  }, [offers, setState]);

  const list = useMemo(() => {
    let arr = (offers || []).filter((o) => !o.deletedAt);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter((o) => (o.title || "").toLowerCase().includes(s));
    }
    arr.sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );
    return arr;
  }, [offers, q]);

  const openEdit = (o) => {
    const filesList = flattenFiles(o.files);
    setOpenItem(o);
    setDraft({
      id: o.id,
      title: o.title || "",
      customerId: o.customerId || "",
      value: o.value ?? 0,
      status: o.status || "utkast",
      note: o.note || "",
      filesList,
      supplierIds: Array.isArray(o.supplierIds) ? o.supplierIds.slice() : [],
      kind: o.kind || "",
    });
  };

  // ==== filer ====
  const setFileField = (idx, field, value) => {
    setDraft((d) => {
      const copy = (d.filesList || []).slice();
      copy[idx] = { ...copy[idx], [field]: value };
      return { ...d, filesList: copy };
    });
  };
  const addManualFile = () => {
    setDraft((d) => ({
      ...d,
      filesList: [
        ...(d.filesList || []),
        {
          id: Math.random().toString(36).slice(0, 8),
          name: "Ny fil",
          webUrl: "#",
          category: "Offerter",
        },
      ],
    }));
  };
  const addFilesFromOneDrive = async () => {
    try {
      const picked = await pickOneDriveFiles();
      if (!picked || picked.length === 0) return;
      setDraft((d) => ({
        ...d,
        filesList: [
          ...(d.filesList || []),
          ...picked.map((p) => ({
            id: p.id || Math.random().toString(36).slice(0, 8),
            name: p.name || "fil",
            webUrl: p.webUrl || p.url || "#",
            category: "Offerter",
          })),
        ],
      }));
    } catch (e) {
      alert(
        "Kunde inte hämta filer från OneDrive. Du kan lägga till manuellt med knappen nedan."
      );
    }
  };
  const removeFileRow = (idx) => {
    setDraft((d) => {
      const copy = (d.filesList || []).slice();
      copy.splice(idx, 1);
      return { ...d, filesList: copy };
    });
  };

  // ==== leverantörer ====
  const addSupplierToOffer = (supplierId) => {
    if (!supplierId) return;
    setDraft((d) => {
      const set = new Set(d.supplierIds || []);
      set.add(supplierId);
      return { ...d, supplierIds: Array.from(set) };
    });
  };
  const removeSupplierFromOffer = (supplierId) => {
    setDraft((d) => ({
      ...d,
      supplierIds: (d.supplierIds || []).filter((id) => id !== supplierId),
    }));
  };

  const saveDraft = () => {
    if (!draft) return;
    const files = groupFiles(draft.filesList || []);
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
              files,
              supplierIds: Array.isArray(draft.supplierIds)
                ? draft.supplierIds.slice()
                : [],
              kind: draft.kind || "",
              updatedAt: new Date().toISOString(),
            }
          : o
      ),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  const softDelete = (o) => {
    if (
      !window.confirm(
        "Ta bort denna offert? Den hamnar i Arkiv och kan tas bort permanent därifrån."
      )
    )
      return;
    setState((s) => ({
      ...s,
      offers: (s.offers || []).map((x) =>
        x.id === o.id ? { ...x, deletedAt: new Date().toISOString() } : x
      ),
    }));
    if (openItem?.id === o.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  function createProjectFromOffer() {
    if (!draft) return;
    const files = groupFiles(draft.filesList || []);
    const proj = {
      id:
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(0, 8)),
      name: draft.title || "Projekt",
      customerId: draft.customerId || "",
      status: "pågående",
      budget: Number(draft.value) || 0,
      note: draft.note || "",
      files,
      originatingOfferId: draft.id,
      supplierIds: Array.isArray(draft.supplierIds)
        ? draft.supplierIds.slice()
        : [],
      kind: draft.kind || "",
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      projects: [...(s.projects || []), proj],
      offers: (s.offers || []).map((o) =>
        o.id === draft.id
          ? { ...o, status: "vunnen", updatedAt: new Date().toISOString() }
          : o
      ),
    }));
    setOpenItem(null);
    setDraft(null);
    alert("Projekt skapat från offert (öppnas inte automatiskt).");
  }

  const printOffer = () => {
    if (!draft) return;
    const customer =
      customers.find((c) => c.id === draft.customerId) || null;
    const files = groupFiles(draft.filesList || []);
    const fileLines = FILE_CATS.map((cat) => {
      const arr = files[cat] || [];
      if (!arr.length) return "";
      const items = arr
        .map(
          (f) =>
            `<li>${(f.name || "fil")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")} – ${
              f.webUrl ? `<a href="${f.webUrl}">${f.webUrl}</a>` : ""
            }</li>`
        )
        .join("");
      return `<h4>${cat}</h4><ul>${items}</ul>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <title>Offert – ${draft.title || ""}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin-top: 24px; margin-bottom: 8px; }
    h3 { font-size: 16px; margin-top: 16px; margin-bottom: 4px; }
    h4 { font-size: 14px; margin-top: 8px; margin-bottom: 4px; }
    .meta { margin-bottom: 16px; font-size: 14px; }
    .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-top: 8px; }
    ul { margin-top: 4px; }
    @media print {
      button { display:none; }
    }
  </style>
</head>
<body>
  <h1>Offert</h1>
  <div class="meta">
    <div><strong>Titel:</strong> ${draft.title || ""}</div>
    <div><strong>Kund:</strong> ${
      customer?.companyName || customer?.name || "—"
    }</div>
    <div><strong>Belopp:</strong> ${(
      Number(draft.value) || 0
    ).toLocaleString("sv-SE")} kr</div>
    <div><strong>Status:</strong> ${draft.status || "utkast"}</div>
    ${
      draft.kind
        ? `<div><strong>Typ:</strong> ${draft.kind}</div>`
        : ""
    }
  </div>

  <h2>Beskrivning / anteckning</h2>
  <div class="box">
    <p>${(draft.note || "")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>")}</p>
  </div>

  <h2>Filer</h2>
  <div class="box">
    ${fileLines || "<p>Inga filer kopplade.</p>"}
  </div>

  <button onclick="window.print()">Skriv ut</button>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) {
      alert("Tillåt popup-fönster för att kunna skriva ut offerten.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Offerter</h2>
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Sök..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <ul className="divide-y">
        {list.map((o) => (
          <li key={o.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                onClick={() => openEdit(o)}
                type="button"
              >
                <div className="font-medium truncate">
                  {o.title || "Offert"}
                </div>
                <div className="text-xs text-gray-500">
                  Kund: {customerName(o.customerId)} ·{" "}
                  {o.status || "utkast"} ·{" "}
                  {(o.value || 0).toLocaleString("sv-SE")} kr
                </div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                {o.kind && (
                  <span
                    className={
                      "text-xs px-2 py-1 rounded " +
                      (o.kind === "Entreprenad"
                        ? "bg-orange-200 text-orange-800"
                        : o.kind === "Turbovex"
                        ? "bg-blue-200 text-blue-800"
                        : "bg-gray-100 text-gray-700")
                    }
                  >
                    {o.kind}
                  </span>
                )}
                <button
                  className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                  onClick={() => softDelete(o)}
                  type="button"
                >
                  Ta bort
                </button>
              </div>
            </div>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-6 text-sm text-gray-500">Inga offerter.</li>
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
            className="bg-white rounded-2xl shadow p-4 w-full max-w-3xl"
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
                    setDraft((d) => ({ ...d, customerId: e.target.value }))
                  }
                >
                  <option value="">—</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName || c.id}
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
                    setDraft((d) => ({ ...d, value: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, status: e.target.value }))
                  }
                >
                  <option value="utkast">Utkast</option>
                  <option value="inskickad">Inskickad</option>
                  <option value="vunnen">Vunnen</option>
                  <option value="förlorad">Förlorad</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Typ</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.kind || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, kind: e.target.value }))
                  }
                >
                  <option value="">—</option>
                  <option value="Entreprenad">Entreprenad</option>
                  <option value="Turbovex">Turbovex</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Anteckning</label>
                <textarea
                  className="w-full border rounded px-3 py-2 min-h-[80px]"
                  value={draft.note}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, note: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Leverantörer */}
            <div className="mt-4 border rounded-xl p-3">
              <div className="font-medium mb-2">Kopplade leverantörer</div>
              <div className="flex gap-2 mb-2">
                <select
                  className="border rounded px-2 py-1"
                  onChange={(e) => {
                    addSupplierToOffer(e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">+ Lägg till leverantör…</option>
                  {suppliers
                    .filter(
                      (s) => !(draft.supplierIds || []).includes(s.id)
                    )
                    .sort((a, b) =>
                      (a.companyName || "").localeCompare(
                        b.companyName || ""
                      )
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.companyName || s.id}
                      </option>
                    ))}
                </select>
              </div>
              {(draft.supplierIds || []).length === 0 ? (
                <div className="text-xs text-gray-500">
                  Inga leverantörer kopplade.
                </div>
              ) : (
                <ul className="text-sm space-y-1">
                  {draft.supplierIds.map((id) => {
                    const sup = suppliers.find((s) => s.id === id);
                    return (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">
                          {sup?.companyName || id}
                        </span>
                        <button
                          className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                          onClick={() => removeSupplierFromOffer(id)}
                          type="button"
                        >
                          Ta bort
                        </button>
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
                  <button
                    className="text-xs px-2 py-1 rounded border"
                    onClick={addFilesFromOneDrive}
                    type="button"
                  >
                    + Lägg till från OneDrive
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded border"
                    onClick={addManualFile}
                    type="button"
                  >
                    + Lägg till länk manuellt
                  </button>
                </div>
              </div>

              {(draft.filesList || []).length === 0 ? (
                <div className="text-xs text-gray-500">
                  Inga filer tillagda.
                </div>
              ) : (
                <div className="space-y-2">
                  {(draft.filesList || []).map((f, idx) => (
                    <div
                      key={f.id || idx}
                      className="grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-3">
                        <select
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={f.category || "Offerter"}
                          onChange={(e) =>
                            setFileField(
                              idx,
                              "category",
                              e.target.value
                            )
                          }
                        >
                          {FILE_CATS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4">
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={f.name || ""}
                          onChange={(e) =>
                            setFileField(idx, "name", e.target.value)
                          }
                          placeholder="Filnamn"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={f.webUrl || ""}
                          onChange={(e) =>
                            setFileField(idx, "webUrl", e.target.value)
                          }
                          placeholder="Länk (URL)"
                        />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1 items-end">
                        <button
                          className="text-xs px-2 py-1 rounded bg-blue-600 text-white w-full"
                          type="button"
                          onClick={() => {
                            if (f.webUrl) {
                              window.open(f.webUrl, "_blank", "noopener");
                            } else {
                              alert(
                                "Ingen länk angiven för denna fil."
                              );
                            }
                          }}
                        >
                          Öppna
                        </button>
                        <button
                          className="text-xs px-2 py-1 rounded bg-rose-500 text-white w-full"
                          onClick={() => removeFileRow(idx)}
                          type="button"
                        >
                          Ta bort
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              <button
                className="px-3 py-2 rounded bg-green-600 text-white"
                onClick={saveDraft}
                type="button"
              >
                Spara
              </button>

              {draft.status === "vunnen" && (
                <button
                  className="px-3 py-2 rounded bg-blue-600 text-white"
                  onClick={createProjectFromOffer}
                  type="button"
                >
                  Skapa projekt från offert (ärver filer & leverantörer)
                </button>
              )}

              <button
                className="px-3 py-2 rounded bg-slate-600 text-white"
                onClick={printOffer}
                type="button"
              >
                Skriv ut offert
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
