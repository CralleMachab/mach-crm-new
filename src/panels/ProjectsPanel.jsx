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
  entities = [],
  offers = [],
  setState,
}) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
    customers.find((c) => c.id === id)?.companyName ||
    customers.find((c) => c.id === id)?.name ||
    "—";

  const list = useMemo(() => {
    let arr = (projects || []).filter((p) => !p.deletedAt);

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter((p) => {
        const cname = customerName(p.customerId).toLowerCase();
        return (
          (p.name || "").toLowerCase().includes(s) ||
          (p.internalId || "").toString().includes(s) ||
          cname.includes(s)
        );
      });
    }

    if (statusFilter !== "all") {
      arr = arr.filter((p) => (p.status || "pågående") === statusFilter);
    }

    arr.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return arr;
  }, [projects, q, statusFilter, customers]);

  const openEdit = (p) => {
    setOpenItem(p);
    setDraft({
      id: p.id,
      name: p.name || "",
      customerId: p.customerId || "",
      status: p.status || "pågående",
      budget: p.budget ?? 0,
      startDate: p.startDate || "",
      endDate: p.endDate || "",
      note: p.note || "",
      filesList: flattenFiles(p.files),
      internalId: p.internalId || p.projectNumber || "",
      originatingOfferId: p.originatingOfferId || "",
      supplierIds: Array.isArray(p.supplierIds) ? p.supplierIds.slice() : [],
      kind: p.kind || "",
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
              budget: Number(draft.budget) || 0,
              startDate: draft.startDate || "",
              endDate: draft.endDate || "",
              note: draft.note || "",
              files,
              internalId: draft.internalId || "",
              projectNumber: draft.internalId || p.projectNumber || "",
              originatingOfferId: draft.originatingOfferId || "",
              supplierIds: Array.isArray(draft.supplierIds)
                ? draft.supplierIds.slice()
                : [],
              kind: draft.kind || "",
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

  const exportText = () => {
    if (!draft) return;
    const files = groupFiles(draft.filesList || []);

    const customer = customers.find((c) => c.id === draft.customerId);
    const lines = [];

    lines.push(`Projekt: ${draft.name || ""}`);
    if (customer) {
      lines.push(
        `Kund: ${customer.companyName || customer.name || ""}`
      );
    }
    if (draft.internalId) {
      lines.push(`Projektnr: ${draft.internalId}`);
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
        lines.push(`- ${f.name} (${f.webUrl})`);
      });
      lines.push("");
    });

    const text = lines.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (draft.internalId || "projekt") + ".txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportHtml = () => {
    if (!draft) return;
    const files = groupFiles(draft.filesList || []);
    const customer = customers.find((c) => c.id === draft.customerId);

    const todayStr = new Date().toLocaleDateString("sv-SE");

    const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8" />
  <title>Projekt ${draft.name || ""}</title>
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body {
      margin: 0;
      padding: 24px;
      background: #f3f4f6;
    }
    .page {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      padding: 24px 24px 32px 24px;
      box-shadow: 0 10px 40px rgba(15, 23, 42, 0.12);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 16px;
    }
    .title-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
    }
    .subtitle {
      font-size: 13px;
      color: #6b7280;
    }
    .badges {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
    }
    .badge-label {
      font-weight: 600;
      color: #4b5563;
    }
    .badge-value {
      font-weight: 500;
      color: #111827;
    }
    .section {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
    }
    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 8px;
    }
    .two-col {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 32px;
    }
    .field-grid {
      display: grid;
      grid-template-columns: 120px 1fr;
      row-gap: 4px;
      column-gap: 8px;
      font-size: 13px;
      color: #374151;
    }
    .label {
      font-weight: 500;
      color: #6b7280;
    }
    .value {
      color: #111827;
    }
    .note-box {
      border-radius: 12px;
      background: #f9fafb;
      padding: 12px 16px;
      font-size: 14px;
      color: #111827;
    }
    ul {
      margin: 4px 0 0 18px;
      padding: 0;
    }
    li {
      margin-bottom: 4px;
    }
    .footer-actions {
      margin-top: 24px;
      text-align: right;
    }
    .footer-text {
      font-size: 11px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="title-block">
        <div class="title">${draft.name || ""}</div>
        <div class="subtitle">Projektöversikt</div>
        <div class="subtitle">Datum: ${todayStr}</div>
      </div>
      <div class="badges">
        <div class="badge" style="background:#eef2ff;">
          <span class="badge-label">Status:</span>
          <span class="badge-value">${draft.status || "pågående"}</span>
        </div>
        ${
          draft.internalId
            ? `<div class="badge" style="background:#ecfdf5;">
          <span class="badge-label">Projektnr:</span>
          <span class="badge-value">${draft.internalId}</span>
        </div>`
            : ""
        }
      </div>
    </div>

    <div class="section two-col">
      <div>
        <div class="section-title">Grundinfo</div>
        <div class="field-grid">
          <div class="label">Projekt:</div>
          <div class="value">${draft.name || ""}</div>
          <div class="label">Kund:</div>
          <div class="value">${
            customer
              ? customer.companyName || customer.name || "—"
              : "—"
          }</div>
          <div class="label">Status:</div>
          <div class="value">${draft.status || "pågående"}</div>
          <div class="label">Start:</div>
          <div class="value">${draft.startDate || "—"}</div>
          <div class="label">Slut:</div>
          <div class="value">${draft.endDate || "—"}</div>
          ${
            draft.kind
              ? `<div><span class="label">Entreprenadform:</span> <span class="value">${draft.kind}</span></div>`
              : ""
          }
        </div>
      </div>
      <div>
        <div class="section-title">Budget</div>
        <div class="field-grid">
          <div class="label">Budget:</div>
          <div class="value">${(Number(draft.budget) || 0).toLocaleString(
            "sv-SE"
          )} kr</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Beskrivning / anteckning</div>
      <div class="note-box">
        ${
          draft.note
            ? draft.note
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/\\n/g, "<br/>")
            : "<span style='color:#6b7280;'>Ingen anteckning angiven.</span>"
        }
      </div>
    </div>

    <div class="section">
      <div class="section-title">Filer</div>
      ${
        FILE_CATS.map((cat) => {
          const arr = files[cat] || [];
          if (!arr.length) return "";
          const items = arr
            .map(
              (f) =>
                `<li><a href="${f.webUrl}" target="_blank" rel="noopener">${f.name}</a></li>`
            )
            .join("");
          return `
            <div style="margin-bottom:12px;">
              <div class="label" style="margin-bottom:4px;">${cat}</div>
              <ul>${items}</ul>
            </div>
          `;
        }).join("") || "<div class='value' style='color:#6b7280;'>Inga filer tillagda.</div>"
      }
    </div>

    <div class="footer-actions">
      <div class="footer-text">
        Genererad från Mach CRM
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (draft.internalId || "projekt") + ".html";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="font-semibold">Projekt</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="Sök på namn, projektnr, kund..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="border rounded-xl px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Alla statusar</option>
            <option value="pågående">Pågående</option>
            <option value="avslutat">Avslutat</option>
            <option value="paus">Paus</option>
            <option value="inställt">Inställt</option>
          </select>
        </div>
      </div>

      <ul className="divide-y">
        {list.map((p) => {
          const wonOffer = (offers || []).find(
            (o) => o.id === p.originatingOfferId && o.status === "vunnen"
          );
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
                    {p.startDate && (
                      <span>Start: {p.startDate}</span>
                    )}
                    {p.endDate && (
                      <span>Slut: {p.endDate}</span>
                    )}
                    {wonOffer && (
                      <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Från offert: {wonOffer.title || wonOffer.id}
                      </span>
                    )}
                    {p.kind && (
                      <span
                        className={
                          "text-[11px] px-2 py-0.5 rounded " +
                          (p.kind === "Totalentreprenad ABT-06"
                            ? "bg-orange-200 text-orange-800"
                            : p.kind === "AB-04"
                            ? "bg-amber-200 text-amber-800"
                            : p.kind === "Bygg"
                            ? "bg-yellow-200 text-yellow-800"
                            : p.kind === "ABK09"
                            ? "bg-purple-200 text-purple-800"
                            : p.kind === "Turbovex"
                            ? "bg-blue-200 text-blue-800"
                            : "bg-gray-100 text-gray-700")
                        }
                      >
                        {p.kind}
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                    {(p.budget || 0).toLocaleString("sv-SE")} kr
                  </span>
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
                      {c.companyName || c.name || c.id}
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
                    setDraft((d) => ({
                      ...d,
                      status: e.target.value,
                    }))
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
                  placeholder="t.ex. 35073 eller 60001"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Budget (kr)</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  value={draft.budget}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      budget: e.target.value,
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

            {/* Leverantörer kopplade till projektet */}
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
                          value={f.category || "Offerter"}
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
                className="px-3 py-2 rounded bg-sky-600 text-white"
                onClick={exportText}
                type="button"
              >
                Exportera TXT
              </button>
              <button
                className="px-3 py-2 rounded bg-indigo-600 text-white"
                onClick={exportHtml}
                type="button"
              >
                Exportera HTML
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
