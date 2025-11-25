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
      supplierIds: Array.isArray(p.supplierIds) ? p.supplierIds.slice() : [],
      internalId: p.internalId || p.projectNumber || "",
      kind: p.kind || "",
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
      supplierIds: Array.isArray(p.supplierIds) ? p.supplierIds.slice() : [],
      internalId: p.internalId || p.projectNumber || "",
      kind: p.kind || "",
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
        "Kunde inte hämta filer
