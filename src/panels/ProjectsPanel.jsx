// src/panels/ProjectsPanel.jsx
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

function projectStatusBadge(status) {
  const base =
    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium";
  switch (status) {
    case "pågående":
      return `${base} bg-blue-100 text-blue-700`;
    case "avslutat":
      return `${base} bg-green-100 text-green-700`;
    case "paus":
      return `${base} bg-yellow-100 text-yellow-700`;
    case "inställt":
      return `${base} bg-rose-100 text-rose-700`;
    default:
      return `${base} bg-gray-100 text-gray-700`;
  }
}

export default function ProjectsPanel({
  projects = [],
  setState,
  entities = [],
  offers = [],
}) {
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

  const getOriginOffer = (project) => {
    if (!project?.originatingOfferId) return null;
    return (offers || []).find((o) => o.id === project.originatingOfferId);
  };

  // Öppna direkt om _shouldOpen är satt
  useEffect(() => {
    const p = (projects || []).find((x) => x?._shouldOpen);
    if (!p) return;
    setOpenItem(p);
    setDraft({
      id: p.id,
      name: p.name || "",
      customerId: p.customerId || "",
      status: p.status || "pågående",
      internalId: p.internalId || "",
      startDate: p.startDate || "",
      endDate: p.endDate || "",
      note: p.note || "",
      kind: p.kind || "",
      filesList: flattenFiles(p.files),
      supplierIds: Array.isArray(p.supplierIds) ? p.supplierIds.slice() : [],
      originatingOfferId: p.originatingOfferId || null,
    });
    setState((s) => ({
      ...s,
      projects: (s.projects || []).map((x) =>
        x.id === p.id ? { ...x, _shouldOpen: undefined } : x
      ),
    }));
  }, [projects, setState]);

  const list = useMemo(() => {
    let arr = (projects || []).filter((p) => !p.deletedAt);

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter((p) => {
        const cName = customerName(p.customerId).toLowerCase();
        return (
          (p.name || "").toLowerCase().includes(s) ||
          (p.internalId || "").toString().includes(s) ||
          cName.includes(s)
        );
      });
    }

    arr.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return arr;
  }, [projects, q, customers]);

  const openEdit = (p) => {
    setOpenItem(p);
    setDraft({
      id: p.id,
      name: p.name || "",
      customerId: p.customerId || "",
      status: p.status || "pågående",
      internalId: p.internalId || "",
      startDate: p.startDate || "",
      endDate: p.endDate || "",
      note: p.note || "",
      kind: p.kind || "",
      filesList: flattenFiles(p.files),
      supplierIds: Array.isArray(p.supplierIds) ? p.supplierIds.slice() : [],
      originatingOfferId: p.originatingOfferId || null,
    });
  };

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
          category: "Ritningar",
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
            category: "Ritningar",
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

  const addSupplierToProject = (supplierId) => {
    if (!supplierId) return;
    setDraft((d) => {
      const set = new Set(d.supplierIds || []);
      set.add(supplierId);
      return { ...d, supplierIds: Array.from(set) };
    });
  };

  const removeSupplierFromProject = (supplierId) => {
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
      projects: (s.projects || []).map((p) =>
        p.id === draft.id
          ? {
              ...p,
              name: draft.name || "",
              customerId: draft.customerId || "",
              status: draft.status || "pågående",
              internalId: draft.internalId || "",
              projectNumber: draft.internalId || p.projectNumber || "",
              startDate: draft.startDate || "",
              endDate: draft.endDate || "",
              note: draft.note || "",
              kind: draft.kind || "",
              files,
              supplierIds: Array.isArray(draft.supplierIds)
                ? draft.supplierIds.slice()
                : [],
              originatingOfferId: draft.originatingOfferId || null,
              updatedAt: new Date().toISOString(),
            }
          : p
      ),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  const softDelete = (p) => {
    if (
      !window.confirm(
        "Ta bort detta projekt? Det hamnar i Arkiv (kan tas bort permanent via Inställningar)."
      )
    )
      return;
    setState((s) => ({
      ...s,
      projects: (s.projects || []).map((x) =>
        x.id === p.id ? { ...x, deletedAt: new Date().toISOString() } : x
      ),
    }));
    if (openItem?.id === p.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  const sendProjectByEmail = () => {
    if (!draft) return;
    const customer =
      customers.find((c) => c.id === draft.customerId) || null;
    const files = groupFiles(draft.filesList || []);

    const lines = [];
    lines.push(`Projekt: ${draft.name || ""}`);
    if (draft.internalId) {
      lines.push(`Projektnr: ${draft.internalId}`);
    }
    if (customer) {
      lines.push(`Kund: ${customer.companyName || ""}`);
    }
    if (draft.status) {
      lines.push(`Status: ${draft.status}`);
    }
    if (draft.startDate) {
      lines.push(`Start: ${draft.startDate}`);
    }
    if (draft.endDate) {
      lines.push(`Slut: ${draft.endDate}`);
    }
    if (draft.kind) {
      lines.push(`Entreprenadform: ${draft.kind}`);
    }

    lines.push("");

    if (draft.note) {
      lines.push("Anteckning:");
      lines.push(draft.note);
      lines.push("");
    }

    FILE_CATS.forEach((cat) => {
      const arr = files[cat] || [];
      if (!arr.length) return;
      lines.push(`${cat}:`);
      arr.forEach((f) => {
        lines.push(
          `- ${(f.name || "fil")}${
            f.webUrl ? ` (${f.webUrl})` : ""
          }`
        );
      });
      lines.push("");
    });

    const body = lines.join("\n");
    const subject = draft.name || "Projekt";

    const mailto = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
  };

  const printProject = () => {
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
            `<li>${f.name || "fil"}${
              f.webUrl
                ? ` – <a href="${f.webUrl}">${f.webUrl}</a>`
                : ""
            }</li>`
        )
        .join("");
      return `<h4>${cat}</h4><ul>${items}</ul>`;
    }).join("");

    const todayStr = new Date().toLocaleDateString("sv-SE");

    const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <title>Projekt – ${draft.name || ""}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        sans-serif;
      font-size: 14px;
      color: #111827;
      margin: 0;
      padding: 0;
    }
    .page {
      padding: 24px;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 4px;
    }
    .meta {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px 24px;
      font-size: 14px;
      margin-bottom: 12px;
    }
    .label {
      font-weight: 600;
      color: #374151;
    }
    .value {
      color: #111827;
    }
    .section-title {
      margin-top: 24px;
      margin-bottom: 8px;
      font-size: 16px;
      font-weight: 600;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
    }
    .note {
      white-space: pre-wrap;
      background: #f9fafb;
      border-radius: 8px;
      padding: 8px 10px;
      border: 1px solid #e5e7eb;
    }
    h4 {
      margin: 16px 0 4px;
      font-size: 14px;
      font-weight: 600;
    }
    ul {
      margin: 0 0 4px 16px;
      padding: 0;
    }
    li {
      margin: 0 0 2px;
    }
    a {
      color: #1d4ed8;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .footer {
      margin-top: 24px;
      font-size: 11px;
      color: #9ca3af;
    }

    @media print {
      body {
        padding: 0;
        margin: 0;
      }
      .page {
        padding: 0;
      }
      .footer {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="title-block">
        <h1>Projekt</h1>
        <div class="meta">
          Utskriftsdatum: ${todayStr}
        </div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div><span class="label">Namn:</span> <span class="value">${
          draft.name || ""
        }</span></div>
        <div><span class="label">Projektnr:</span> <span class="value">${
          draft.internalId || ""
        }</span></div>
        ${
          customer
            ? `<div><span class="label">Kund:</span> <span class="value">${
                customer.companyName || ""
              }</span></div>`
            : ""
        }
      </div>
      <div>
        <div><span class="label">Status:</span> <span class="value">${
          draft.status || ""
        }</span></div>
        <div><span class="label">Entreprenadform:</span> <span class="value">${
          draft.kind || ""
        }</span></div>
        <div><span class="label">Start:</span> <span class="value">${
          draft.startDate || ""
        }</span></div>
        <div><span class="label">Slut:</span> <span class="value">${
          draft.endDate || ""
        }</span></div>
      </div>
    </div>

    ${
      draft.note
        ? `<div class="section-title">Anteckning</div>
           <div class="note">${(draft.note || "")
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")}</div>`
        : ""
    }

    ${
      fileLines
        ? `<div class="section-title">Filer</div>${fileLines}`
        : ""
    }

    <div class="footer">
      Genererat från Mach CRM.
    </div>
  </div>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="font-semibold">Projekt</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="Sök på namn, projektnr, kund..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className="border rounded-xl px-3 py-2 text-sm"
            type="button"
            onClick={sendProjectByEmail}
            disabled={!draft}
            title="Skicka projektet (det öppna) via e-post"
          >
            ✉️ Skicka via e-post
          </button>
          <button
            className="border rounded-xl px-3 py-2 text-sm"
            type="button"
            onClick={printProject}
            disabled={!draft}
            title="Skriv ut projektet (det öppna)"
          >
            🖨️ Skriv ut
          </button>
        </div>
      </div>

      <ul className="divide-y">
        {list.map((p) => {
          const origin = getOriginOffer(p);
          return (
            <li key={p.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                  onClick={() => openEdit(p)}
                  type="button"
                >
                  <div className="font-medium truncate flex items-center gap-2">
                    <span>{p.name || "Projekt"}</span>
                    {p.internalId && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        #{p.internalId}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                    <span>Kund: {customerName(p.customerId)}</span>
                    <span className={projectStatusBadge(p.status)}>
                      {p.status || "pågående"}
                    </span>
                    {p.startDate && <span>Start: {p.startDate}</span>}
                    {p.endDate && <span>Slut: {p.endDate}</span>}
                    {origin && (
                      <span>Från offert #{origin.offerNumber || ""}</span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                    onClick={() => softDelete(p)}
                    type="button"
                  >
                    Ta bort
                  </button>
                </div>
              </div>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="py-6 text-sm text-gray-500">Inga projekt.</li>
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
              <div className="font-semibold">Redigera projekt</div>
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
                <label className="text-sm font-medium">Namn</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
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
                      {c.companyName || c.id}
                    </option>
                  ))}
                </select>
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
                  <option value="pågående">Pågående</option>
                  <option value="avslutat">Avslutat</option>
                  <option value="paus">Paus</option>
                  <option value="inställt">Inställt</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Projektnr</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.internalId || ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      internalId: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Startdatum</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={draft.startDate || ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      startDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Slutdatum</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={draft.endDate || ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      endDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Entreprenadform</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.kind || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, kind: e.target.value }))
                  }
                >
                  <option value="">—</option>
                  <option value="Totalentreprenad ABT-06">
                    Totalentreprenad ABT-06
                  </option>
                  <option value="AB-04">AB-04</option>
                  <option value="Bygg">Bygg</option>
                  <option value="ABK09">ABK09</option>
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
                    addSupplierToProject(e.target.value);
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
                          onClick={() => removeSupplierFromProject(id)}
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
                          value={f.category || "Ritningar"}
                          onChange={(e) =>
                            setFileField(idx, "category", e.target.value)
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
                              window.open(
                                f.webUrl,
                                "_blank",
                                "noopener"
                              );
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
