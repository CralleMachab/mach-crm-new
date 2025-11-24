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
      // Läs projektets nummer från både internalId och projectNumber
      internalId: p.internalId || p.projectNumber || "",
      originatingOfferId: p.originatingOfferId || "",
      supplierIds: Array.isArray(p.supplierIds) ? p.supplierIds.slice() : [],
      kind: p.kind || "",
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
      arr = arr.filter((p) => (p.name || "").toLowerCase().includes(s));
    }
    arr.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return arr;
  }, [projects, q]);

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
      // Samma här: använd internalId eller projectNumber
      internalId: p.internalId || p.projectNumber || "",
      originatingOfferId: p.originatingOfferId || "",
      supplierIds: Array.isArray(p.supplierIds) ? p.supplierIds.slice() : [],
      kind: p.kind || "",
    });
  };

  const projectStatusBadge = (status) => {
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
              // Spara numret både i internalId och projectNumber
              internalId: draft.internalId || "",
              projectNumber: draft.internalId || "",
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

  const emailProject = () => {
    if (!draft) return;

    const customer =
      customers.find((c) => c.id === draft.customerId) || null;
    const files = groupFiles(draft.filesList || []);

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
      lines.push(`Entreprenad form: ${draft.kind}`);
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

    const subject = `Projekt – ${draft.name || ""}`;
    const body = lines.join("\n");

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
  <title>Projekt – ${draft.name || ""}</title>
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
      padding: 32px 4
