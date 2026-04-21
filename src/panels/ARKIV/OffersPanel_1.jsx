import React, { useEffect, useMemo, useState } from "react";
import NotesHistory from "../components/NotesHistory.jsx";
import PlannerHome from "../planner/Home.jsx";
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

const createEmptyPlanner = () => ({
  tasks: {},
  schedules: {},
});

export default function OffersPanel({ offers = [], entities = [], setState }) {
  const [q, setQ] = useState("");
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);
  const [showPlanner, setShowPlanner] = useState(false);

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

  const offerNumberOf = (o) =>
    o?.offerNumber ?? o?.number ?? o?.offertnummer ?? null;
  const projectNumberOf = (o) => o?.projectNumber ?? o?.projectNo ?? null;

  const normalizeSupplierRows = (o) => {
    // Ny struktur: o.suppliers = [{ id, sent, responded }]
    if (Array.isArray(o?.suppliers)) {
      return o.suppliers
        .filter((x) => x && x.id)
        .map((x) => ({
          id: x.id,
          sent: !!x.sent,
          responded: !!x.responded,
        }));
    }
    // Bakåtkompatibilitet: supplierIds + globala flaggor
    const ids = Array.isArray(o?.supplierIds) ? o.supplierIds.slice() : [];
    const sent = !!o?.supplierSent;
    const responded = !!o?.supplierResponded;
    return ids.map((id) => ({ id, sent, responded }));
  };

  const mkId = () =>
    crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

  const normalizeNotes = (o) => {
    const raw = Array.isArray(o?.notes) ? o.notes : null;
    if (raw && raw.length) {
      return raw
        .map((n) => ({
          id: n?.id || mkId(),
          date: (n?.date || n?.dateISO || "").slice(0, 10),
          text: n?.text ?? n?.value ?? "",
        }))
        .filter((n) => (n.date || n.text) && typeof n.text === "string");
    }
    const legacyText = o?.note || "";
    if (legacyText && typeof legacyText === "string") {
      const legacyDate = (o?.updatedAt || o?.createdAt || "").slice(0, 10);
      return [{ id: mkId(), date: legacyDate, text: legacyText }];
    }
    return [];
  };


  // används för att se om "Nästa händelse"-datum är passerat
  const todayYmd = new Date().toISOString().slice(0, 10);
  const isNextActionOverdue = (offer) =>
    offer.nextActionDate && offer.nextActionDate < todayYmd;

  // Öppna direkt om _shouldOpen är satt (när ny offert skapas)
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
      notes: normalizeNotes(o),
      note: o.note || "", // legacy (hålls kvar för bakåtkompatibilitet
      nextActionDate: o.nextActionDate || "",
      filesList,
      suppliers: normalizeSupplierRows(o),
      kind: o.kind || "", // Entreprenadform
      offerNumber: offerNumberOf(o),
      projectNumber: projectNumberOf(o),
      planner: o.planner || createEmptyPlanner(),
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
      notes: normalizeNotes(o),
      note: o.note || "", // legacy (hålls kvar för bakåtkompatibilitet
      nextActionDate: o.nextActionDate || "",
      filesList,
      suppliers: normalizeSupplierRows(o),
      kind: o.kind || "", // Entreprenadform
      offerNumber: offerNumberOf(o),
      projectNumber: projectNumberOf(o),
      planner: o.planner || createEmptyPlanner(),
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
      const existing = Array.isArray(d.suppliers) ? d.suppliers : [];
      if (existing.some((x) => x.id === supplierId)) return d;
      return {
        ...d,
        suppliers: [...existing, { id: supplierId, sent: false, responded: false, sentDate: "" }],
      };
    });
  };

  const removeSupplierFromOffer = (supplierId) => {
    setDraft((d) => ({
      ...d,
      suppliers: (d.suppliers || []).filter((x) => x.id !== supplierId),
    }));
  };

  const setSupplierFlag = (supplierId, field, value) => {
    const today = new Date().toISOString().slice(0, 10);
    setDraft((d) => ({
      ...d,
      suppliers: (d.suppliers || []).map((x) => {
        if (x.id !== supplierId) return x;
        if (field === "sent") {
          return {
            ...x,
            sent: !!value,
            sentDate: value ? today : "",
          };
        }
        return { ...x, [field]: !!value };
      }),
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
              planner: draft.planner || o.planner || createEmptyPlanner(),
              note: (draft.notes?.[0]?.text || draft.note || ""),
              notes: Array.isArray(draft.notes) ? draft.notes : normalizeNotes(draft),
              nextActionDate: draft.nextActionDate || "",
              files,
              offerNumber: draft.offerNumber ?? offerNumberOf(o) ?? null,
              projectNumber: draft.projectNumber ?? projectNumberOf(o) ?? null,
              suppliers: Array.isArray(draft.suppliers)
                ? draft.suppliers
                    .filter((x) => x && x.id)
                    .map((x) => ({
                      id: x.id,
                      sent: !!x.sent,
                      responded: !!x.responded,
                      sentDate: x.sentDate || "",
                    }))
                : [],
              supplierIds: Array.isArray(draft.suppliers)
                ? draft.suppliers.map((x) => x.id).filter(Boolean)
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

  function kindBadge(kind) {
    if (!kind) return null;
    const base = "text-xs px-2 py-1 rounded ";
    if (kind.includes("ABT-06")) {
      return base + "bg-orange-200 text-orange-800";
    }
    if (kind.includes("AB-04")) {
      return base + "bg-amber-200 text-amber-800";
    }
    if (kind.includes("ABK09")) {
      return base + "bg-slate-200 text-slate-800";
    }
    if (kind.includes("ABM 07") || kind.includes("Turbovex")) {
      return base + "bg-blue-200 text-blue-800";
    }
    return base + "bg-gray-100 text-gray-700";
  }

  function statusLabel(status) {
    const v = (status || "utkast").toLowerCase();
    if (v === "utkast") return "Utkast";
    if (v === "inskickad") return "Inskickad";
    if (v === "vunnen") return "Vunnen";
    if (v === "förlorad") return "Förlorad";
    return status || "Utkast";
  }

  function statusPill(status) {
    const v = (status || "utkast").toLowerCase();
    const base = "text-xs px-2 py-1 rounded font-medium ";
    if (v === "utkast") return base + "bg-gray-200 text-gray-800";
    if (v === "inskickad") return base + "bg-orange-200 text-orange-900";
    if (v === "vunnen") return base + "bg-green-200 text-green-900";
    if (v === "förlorad") return base + "bg-red-200 text-red-900";
    return base + "bg-gray-100 text-gray-700";
  }

  function createProjectFromOffer() {
    if (!draft) return;
    const files = groupFiles(draft.filesList || []);
    setState((s) => {
      const base = 650501;
      const existing = (s.projects || [])
        .map((p) => Number(p.projectNumber))
        .filter((n) => Number.isFinite(n) && n >= base);
      const nextNumber = existing.length ? Math.max(...existing) + 1 : base;

      const chosenProjectNumber = Number(draft.projectNumber) || null;
      const projectNumber = chosenProjectNumber && Number.isFinite(chosenProjectNumber) ? chosenProjectNumber : nextNumber;

      const proj = {
        id:
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(0, 8)),
        projectNumber: projectNumber,
        name: draft.title || "Projekt",
        customerId: draft.customerId || "",
        status: "pågående",
        budget: Number(draft.value) || 0,
        note: draft.note || "",
        planner: draft.planner || createEmptyPlanner(),
        files,
        originatingOfferId: draft.id,
        supplierIds: Array.isArray(draft.suppliers)
          ? draft.suppliers.map((x) => x.id).filter(Boolean)
          : [],
        kind: draft.kind || "",
        offerNumber: draft.offerNumber ?? null,
        createdAt: new Date().toISOString(),
      };

      return {
        ...s,
        projects: [...(s.projects || []), proj],
        offers: (s.offers || []).map((o) =>
          o.id === draft.id
            ? {
                ...o,
                status: "vunnen",
                updatedAt: new Date().toISOString(),
                offerNumber: (o.offerNumber ?? o.number ?? draft.offerNumber ?? null),
                projectNumber: projectNumber,
                projectId: proj.id,
              }
            : o
        ),
      };
    });
    setOpenItem(null);
    setDraft(null);
    alert("Projekt skapat från offert (öppnas inte automatiskt).");
  }

  const emailOffer = () => {
    if (!draft) return;

    const customer =
      customers.find((c) => c.id === draft.customerId) || null;
    const files = groupFiles(draft.filesList || []);

    const lines = [];

    lines.push(`Offert: ${draft.title || ""}`);
    if (customer) {
      lines.push(
        `Kund: ${customer.companyName || customer.name || ""}`
      );
    }
    lines.push(
      `Belopp: ${(Number(draft.value) || 0).toLocaleString(
        "sv-SE"
      )} kr`
    );
    lines.push(`Status: ${draft.status || "utkast"}`);
    if (draft.kind) lines.push(`Entreprenadform: ${draft.kind}`);
    if (draft.nextActionDate) {
      lines.push(`Nästa händelse: ${draft.nextActionDate}`);
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
            f.webUrl ? " – " + f.webUrl : ""
          }`
        );
      });
      lines.push("");
    });

    const subject = `Offert – ${draft.title || ""}`;
    const body = lines.join("\n");

    const mailto = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
  };

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
              .replace(/>/g, "&gt;")}${
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
  <title>Offert – ${draft.title || ""}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      background: #f3f4f6;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .page {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      padding: 32px 40px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .title-block h1 {
      margin: 0 0 4px 0;
      font-size: 26px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .title-block .subtitle {
      font-size: 14px;
      color: #6b7280;
    }
    .company-block {
      text-align: right;
      font-size: 13px;
      color: #4b5563;
    }
    .company-block img {
      height: 56px;
      margin-bottom: 4px;
    }
    .meta-grid {
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
      color: #111827;
    }
    .box {
      border-radius: 12px;
      border: 1px solid #e5e7eb;
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
    .btn-print {
      border-radius: 999px;
      border: 1px solid #e5e7eb;
      padding: 8px 16px;
      font-size: 14px;
      background: #111827;
      color: #f9fafb;
      cursor: pointer;
    }
    .btn-print:hover {
      background: #020617;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .page {
        box-shadow: none;
        border-radius: 0;
        margin: 0;
        max-width: none;
      }
      .footer-actions {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="title-block">
        <h1>Offert</h1>
        <div class="subtitle">Datum: ${todayStr}</div>
      </div>
      <div class="company-block">
        <img src="/logo.png" alt="Mach Entreprenad AB" />
        <div>Mach Entreprenad AB</div>
      </div>
    </div>

    <div class="meta-grid">
      <div>
        <span class="label">Titel:</span>
        <span class="value"> ${draft.title || ""}</span>
      </div>
      <div>
        <span class="label">Kund:</span>
        <span class="value">
          ${
            customer
              ? customer.companyName || customer.name || "—"
              : "—"
          }
        </span>
      </div>
      <div>
        <span class="label">Belopp:</span>
        <span class="value">
          ${(Number(draft.value) || 0).toLocaleString("sv-SE")} kr
        </span>
      </div>
      <div>
        <span class="label">Status:</span>
        <span class="value">${draft.status || "utkast"}</span>
      </div>
      ${
        draft.kind
          ? `<div><span class="label">Entreprenadform:</span> <span class="value">${draft.kind}</span></div>`
          : ""
      }
      ${
        draft.nextActionDate
          ? `<div><span class="label">Nästa händelse:</span> <span class="value">${draft.nextActionDate}</span></div>`
          : ""
      }
    </div>

    <div class="section">
      <div class="section-title">Beskrivning / anteckning</div>
      <div class="box">
        <p>${
          (draft.note || "")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br/>") || "Ingen anteckning."
        }</p>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Filer</div>
      <div class="box">
        ${fileLines || "<p>Inga filer kopplade.</p>"}
      </div>
    </div>

    <div class="footer-actions">
      <button class="btn-print" onclick="window.print()">Skriv ut</button>
    </div>
  </div>
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
        {list.map((o) => {
          const offNum = offerNumberOf(o);
          return (
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
                  {offNum ? `Nr: ${offNum} · ` : ""}
                  Kund: {customerName(o.customerId)} ·{" "}
                  {(o.value || 0).toLocaleString("sv-SE")} kr ·{" "}
                  <span className={statusPill(o.status)}>
                    {statusLabel(o.status)}
                  </span>
                </div>

                {o.nextActionDate && (
                  <div
                    className={
                      "text-xs mt-0.5 " +
                      (isNextActionOverdue(o)
                        ? "text-red-600 font-semibold"
                        : "text-gray-500")
                    }
                  >
                    Nästa händelse: {o.nextActionDate}
                    {isNextActionOverdue(o) && " (passert, följ upp)"}
                  </div>
                )}
              </button>
              <div className="flex items-center gap-2 shrink-0">
                {offNum ? (
                  <span
                    className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 font-mono"
                    title="Offertnummer"
                  >
                    {offNum}
                  </span>
                ) : null}
                {o.kind && (
                  <span className={kindBadge(o.kind)}>{o.kind}</span>
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
          );
        })}
        {list.length === 0 && (
          <li className="py-6 text-sm text-gray-500">Inga offerter.</li>
        )}
      </ul>

      {openItem && draft && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
        >
          <div
            className="bg-white rounded-2xl shadow p-4 w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-2 gap-3">
              <div className="font-semibold">Redigera offert</div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[11px] text-gray-500 leading-none">
                    Offertnummer
                  </div>
                  <input
                    className="border rounded px-2 py-1 bg-gray-50 text-sm font-mono text-right"
                    value={draft.offerNumber ?? ""}
                    readOnly
                    style={{
                      // +3ch ger lite extra marginal så alla siffror syns med padding
                      width: `${Math.max(String(draft.offerNumber ?? "").length + 3, 9)}ch`,
                    }}
                  />
                </div>
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
                <label className="text-sm font-medium">
                  Nästa händelse
                </label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={draft.nextActionDate || ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      nextActionDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Entreprenadform
                </label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.kind || ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, kind: e.target.value }))
                  }
                >
                  <option value="">—</option>
                  <option value="ABT-06 Totalentreprenad">
                    ABT-06 Totalentreprenad
                  </option>
                  <option value="ABT06 - Stålhall i Entreprenadform">
                    ABT06 - Stålhall i Entreprenadform
                  </option>
                  <option value="AB-04">AB-04</option>
                  <option value="ABK09">ABK09</option>
                  <option value="ABM 07 Turbovex">ABM 07 Turbovex</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Tidplan</label>
                <div className="w-full border rounded px-3 py-2 bg-gray-50 min-h-[42px] flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-600">
                    {draft?.planner ? "Tidplan skapad" : "Ingen tidplan skapad"}
                  </span>

                  <button
                    className="px-3 py-2 rounded bg-blue-600 text-white text-sm"
                    type="button"
                    onClick={() => {
                      if (!draft?.planner) {
                        const ok = window.confirm(
                          "Denna offert har ingen tidplan ännu. Vill du skapa en ny?"
                        );
                        if (!ok) return;

                        setDraft((d) => ({
                          ...d,
                          planner: createEmptyPlanner(),
                        }));
                      }

                      setShowPlanner(true);
                    }}
                  >
                    Tidplan
                  </button>
                </div>
              </div>
              
            </div>

            {/* Leverantörer */}
            <div className="mt-4 border rounded-xl p-3">
              <div className="font-medium mb-2">Kopplade leverantörer</div>
              <div className="flex gap-2 mb-3">
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
                      (s) => !(draft.suppliers || []).some((x) => x.id === s.id)
                    )
                    .sort((a, b) =>
                      (a.companyName || "").localeCompare(b.companyName || "")
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.companyName || s.id}
                      </option>
                    ))}
                </select>
              </div>

              {(draft.suppliers || []).length === 0 ? (
                <div className="text-xs text-gray-500">Inga leverantörer kopplade.</div>
              ) : (
                <div className="space-y-2">
                  {(draft.suppliers || []).map((row) => {
                    const sup = suppliers.find((s) => s.id === row.id);
                    return (
                      <div
                        key={row.id}
                        className="grid grid-cols-12 gap-2 items-center border rounded-xl px-3 py-2"
                      >
                        <div className="col-span-5 truncate text-sm">
                          {sup?.companyName || row.id}
                        </div>
                        <div className="col-span-3 flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={!!row.sent}
                            onChange={(e) =>
                              setSupplierFlag(row.id, "sent", e.target.checked)
                            }
                          />
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Skickad</span>
                          {row.sent && row.sentDate ? (
                            <span className="ml-2 text-xs text-gray-600">({row.sentDate})</span>
                          ) : null}
                        </div>
                        <div className="col-span-3 flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={!!row.responded}
                            onChange={(e) =>
                              setSupplierFlag(row.id, "responded", e.target.checked)
                            }
                          />
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Återkopplad
                          </span>
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                            onClick={() => removeSupplierFromOffer(row.id)}
                            type="button"
                          >
                            Ta bort
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
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

            <div className="mt-4 border rounded-xl p-3">
              <div className="font-medium mb-2">Anteckningar</div>
              <NotesHistory
                notes={draft.notes || []}
                onChange={(next) =>
                  setDraft((d) => ({
                    ...d,
                    notes: next,
                    // håll legacy-fältet "note" synkat med senaste anteckningen
                    note: next?.length ? next[0].text : d.note,
                  }))
                }
              />
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
                className="px-3 py-2 rounded bg-indigo-600 text-white"
                onClick={emailOffer}
                type="button"
              >
                Maila offert
              </button>

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

      {showPlanner && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]"
          onClick={() => setShowPlanner(false)}
        >
          <div
            className="bg-white rounded-2xl shadow p-4 w-full max-w-6xl max-h-[95vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <PlannerHome
              value={draft?.planner}
              onChange={(nextPlanner) =>
                setDraft((d) => ({
                  ...d,
                  planner: nextPlanner,
                }))
              }
              onClose={() => setShowPlanner(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
