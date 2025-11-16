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

export default function ProjectsPanel({
  projects = [],
  setState,
  entities = [],
  offers = [],
}) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("active"); // active | archive
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
    (customers.find((c) => c.id === id)?.companyName) || "—";

  // öppna direkt om _shouldOpen
  useEffect(() => {
    const p = (projects || []).find((x) => x?._shouldOpen);
    if (!p) return;
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
      originatingOfferId: p.originatingOfferId || "",
      supplierIds: Array.isArray(p.supplierIds) ? p.supplierIds.slice() : [],
    });
    setState((s) => ({
      ...s,
      projects: (s.projects || []).map((x) =>
        x.id === p.id ? { ...x, _shouldOpen: undefined } : x
      ),
    }));
  }, [projects, setState, entities]);

  const list = useMemo(() => {
    let arr = (projects || []).slice();
    if (mode === "active") {
      arr = arr.filter((p) => !p.deletedAt);
    } else {
      arr = arr.filter((p) => !!p.deletedAt);
    }

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter((p) =>
        (p.name || "").toLowerCase().includes(s)
      );
    }

    arr.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return arr;
  }, [projects, q, mode]);

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
      originatingOfferId: p.originatingOfferId || "",
      supplierIds: Array.isArray(p.supplierIds) ? p.supplierIds.slice() : [],
    });
  };

  // filer
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

  // leverantörer
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
              files: groupFiles(draft.filesList || []),
              originatingOfferId: draft.originatingOfferId || "",
              supplierIds: Array.isArray(draft.supplierIds)
                ? draft.supplierIds.slice()
                : [],
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
        "Ta bort detta projekt? Det hamnar i Arkiv och kan tas bort permanent därifrån."
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

  const restoreProject = (p) => {
    if (!window.confirm("Återställa detta projekt till Aktiva?")) return;
    setState((s) => ({
      ...s,
      projects: (s.projects || []).map((x) =>
        x.id === p.id ? { ...x, deletedAt: undefined } : x
      ),
    }));
    if (openItem?.id === p.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  const hardDelete = (p) => {
    if (
      !window.confirm(
        "Ta bort detta projekt PERMANENT? Detta går inte att ångra."
      )
    )
      return;
    setState((s) => ({
      ...s,
      projects: (s.projects || []).filter((x) => x.id !== p.id),
    }));
    if (openItem?.id === p.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  const projectStatusBadge = (status) => {
    const base = "text-xs px-2 py-1 rounded";
    switch (status) {
      case "pågående":
        return `${base} bg-blue-100 text-blue-700`;
      case "klar":
        return `${base} bg-green-100 text-green-700`;
      case "pausad":
        return `${base} bg-yellow-100 text-yellow-700`;
      case "förlorad":
        return `${base} bg-rose-100 text-rose-700`;
      default:
        return `${base} bg-gray-100 text-gray-700`;
    }
  };

  const handlePrintProject = () => {
    if (!draft) return;
    const cust = customerName(draft.customerId);
    const safeNote = (draft.note || "").replace(/</g, "&lt;");
    const files = draft.filesList || [];

    let filesHtml = "";
    if (files.length) {
      const grouped = {};
      FILE_CATS.forEach((c) => {
        grouped[c] = [];
      });
      files.forEach((f) => {
        const cat = FILE_CATS.includes(f.category) ? f.category : "Övrigt";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(f);
      });
      filesHtml += "<h2>Filer</h2>";
      Object.keys(grouped).forEach((cat) => {
        if (!grouped[cat] || grouped[cat].length === 0) return;
        filesHtml += `<h3>${cat}</h3><ul>`;
        grouped[cat].forEach((f) => {
          const n = f.name || "fil";
          const url = f.webUrl || "";
          if (url) {
            filesHtml += `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${n}</a></li>`;
          } else {
            filesHtml += `<li>${n}</li>`;
          }
        });
        filesHtml += "</ul>";
      });
    }

    const supNames = (draft.supplierIds || [])
      .map((id) => suppliers.find((s) => s.id === id)?.companyName || id)
      .filter(Boolean);

    const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="utf-8" />
<title>Projekt ${draft.name || ""}</title>
<style>
  body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 18px; margin-top: 24px; margin-bottom: 8px; }
  h3 { font-size: 16px; margin-top: 16px; margin-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  td { padding: 4px 8px; vertical-align: top; }
  .label { font-weight: 600; width: 140px; }
  .note { white-space: pre-wrap; margin-top: 8px; padding: 8px; border: 1px solid #ddd; border-radius: 8px; }
  ul { margin: 4px 0 8px 20px; }
</style>
</head>
<body>
  <h1>Projekt ${draft.name || ""}</h1>
  <div>Datum: ${new Date().toLocaleDateString("sv-SE")}</div>
  <table>
    <tbody>
      <tr><td class="label">Kund</td><td>${cust || "-"}</td></tr>
      <tr><td class="label">Status</td><td>${draft.status || "-"}</td></tr>
      <tr><td class="label">Budget</td><td>${
        draft.budget
          ? Number(draft.budget).toLocaleString("sv-SE") + " kr"
          : "-"
      }</td></tr>
      <tr><td class="label">Start</td><td>${draft.startDate || "-"}</td></tr>
      <tr><td class="label">Slut</td><td>${draft.endDate || "-"}</td></tr>
      <tr><td class="label">Leverantörer</td><td>${
        supNames.length ? supNames.join(", ") : "-"
      }</td></tr>
    </tbody>
  </table>
  ${
    safeNote
      ? `<h2>Anteckning</h2><div class="note">${safeNote}</div>`
      : ""
  }
  ${filesHtml}
</body>
</html>
`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const handleMailProject = () => {
    if (!draft) return;
    const cust = customerName(draft.customerId);
    const lines = [];
    if (cust) lines.push(`Kund: ${cust}`);
    lines.push(`Status: ${draft.status || "-"}`);
    if (draft.budget) lines.push(`Budget: ${draft.budget} kr`);
    if (draft.startDate || draft.endDate) {
      lines.push(
        `Period: ${draft.startDate || "-"} – ${draft.endDate || "-"}`
      );
    }
    if (draft.note) {
      lines.push("");
      lines.push("Anteckning:");
      lines.push(draft.note);
    }
    const files = draft.filesList || [];
    if (files.length) {
      lines.push("");
      lines.push("Filer:");
      files.forEach((f) => {
        const name = f.name || "fil";
        const url = f.webUrl || "";
        lines.push(`- ${name}${url ? " – " + url : ""}`);
      });
    }

    const subject = encodeURIComponent(
      `Projekt ${draft.name || ""}`.trim()
    );
    const body = encodeURIComponent(lines.join("\n"));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Projekt</h2>
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
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Sök..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <ul className="divide-y">
        {list.map((p) => {
          const wonOffer =
            p.originatingOfferId &&
            (offers || []).find(
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
                  <div className="font-medium truncate">
                    {p.name || "Projekt"}
                    {mode === "archive" ? " (Arkiv)" : ""}
                  </div>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-2 items-center">
                    <span>Kund: {customerName(p.customerId)}</span>
                    <span className={projectStatusBadge(p.status)}>
                      {p.status || "pågående"}
                    </span>
                    {wonOffer ? (
                      <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                        Vunnen offert
                      </span>
                    ) : null}
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                    {(p.budget || 0).toLocaleString("sv-SE")} kr
                  </span>
                  {mode === "active" ? (
                    <button
                      className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                      onClick={() => softDelete(p)}
                      type="button"
                    >
                      Ta bort
                    </button>
                  ) : (
                    <>
                      <button
                        className="text-xs px-2 py-1 rounded bg-emerald-500 text-white"
                        onClick={() => restoreProject(p)}
                        type="button"
                      >
                        Återställ
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded bg-rose-700 text-white"
                        onClick={() => hardDelete(p)}
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
              ? "Inga projekt."
              : "Inga arkiverade projekt."}
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
                    setDraft((d) => ({
                      ...d,
                      status: e.target.value,
                    }))
                  }
                >
                  <option value="pågående">pågående</option>
                  <option value="klar">klar</option>
                  <option value="pausad">pausad</option>
                  <option value="förlorad">förlorad</option>
                </select>
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
                <label className="text-sm font-medium">Start</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={draft.startDate}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      startDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Slut</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={draft.endDate}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      endDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Anteckning</label>
                <textarea
                  className="w-full border rounded px-3 py-2 min-h-[80px]"
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
                      <div className="col-span-4">
                        <input
                          className="w-full border rounded px-2 py-1 text-sm"
                          value={f.webUrl || ""}
                          onChange={(e) =>
                            setFileField(idx, "webUrl", e.target.value)
                          }
                          placeholder="Länk (URL)"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
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
                onClick={handlePrintProject}
                type="button"
              >
                Skriv ut
              </button>

              <button
                className="px-3 py-2 rounded border"
                onClick={handleMailProject}
                type="button"
              >
                Maila projekt
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
