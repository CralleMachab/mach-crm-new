import React, { useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "./lib/storage";
import { fetchRemoteState, pushRemoteState } from "./lib/cloud";

import OffersPanel from "./panels/OffersPanel.jsx";
import ProjectsPanel from "./panels/ProjectsPanel.jsx";
import ActivitiesCalendarPanel from "./panels/ActivitiesCalendarPanel.jsx";
import SettingsPanel from "./panels/SettingsPanel.jsx";

/* ===========================
   useStore — lokal + SharePoint
   =========================== */
function useStore() {
  const STORAGE_KEY = "machcrm_data_v3";

  const [state, setState] = useState(() => {
    const local = loadState();
    if (local) return local;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      version: 3,
      activities: [],
      entities: [],
      offers: [],
      projects: [],
      settings: {
        lastSyncInfo: null,
      },
    };
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // Första laddning från SharePoint (om finns)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchRemoteState();
        if (!remote || cancelled) return;

        setState((prev) => {
          const localStamp = prev._lastSavedAt || prev.lastSavedAt;
          const remoteStamp = remote._lastSavedAt || remote.lastSavedAt;
          if (remoteStamp && (!localStamp || remoteStamp > localStamp)) {
            return { ...remote, _loadedFromRemote: true };
          }
          return prev;
        });
      } catch (e) {
        console.error("Kunde inte hämta från SharePoint", e);
        setSyncError("Kunde inte hämta senaste data från SharePoint.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lokalt
  useEffect(() => {
    saveState(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  // Push till SharePoint (debounce)
  useEffect(() => {
    if (!state) return;
    setIsSyncing(true);
    setSyncError(null);

    const t = setTimeout(async () => {
      try {
        const withVersion = { ...state, _lastSavedAt: new Date().toISOString() };
        await pushRemoteState(withVersion);
        setState(withVersion);
        setIsSyncing(false);
      } catch (e) {
        console.error("Kunde inte spara till SharePoint", e);
        setIsSyncing(false);
        setSyncError("Kunde inte spara till SharePoint.");
      }
    }, 1500);

    return () => clearTimeout(t);
  }, [state]);

  return [state, setState, { isSyncing, syncError }];
}

/* ===========================
   Hjälpfunktioner
   =========================== */

function customerCategoryBadge(cat) {
  const base = "text-xs px-2 py-1 rounded text-white";
  switch (cat) {
    case "StålHall":
    case "Stålhall":
      return `${base} bg-gray-500`; // Grå
    case "Totalentreprenad":
    case "TotalEntreprenad":
      return `${base} bg-orange-500`; // Orange
    case "Turbovex":
      return `${base} bg-blue-500`; // Blå
    case "Bygg":
      return `${base} bg-orange-500`;
    case "Admin":
      return `${base} bg-green-500`;
    case "Övrigt":
      return "text-xs px-2 py-1 rounded bg-white text-gray-700 border";
    default:
      return "text-xs px-2 py-1 rounded bg-gray-100 text-gray-700";
  }
}

function supplierCategoryBadge(cat) {
  const base = "text-xs px-2 py-1 rounded text-white";
  switch (cat) {
    case "Stålhalls leverantör":
      return `${base} bg-gray-500`; // Grå
    case "Mark företag":
    case "Mark & Betong":
      return `${base} bg-amber-800`; // Brun-ish
    case "EL leverantör":
      return `${base} bg-red-500`; // Röd
    case "VVS Leverantör":
      return `${base} bg-purple-500`; // Lila
    case "Vent Leverantör":
      return `${base} bg-blue-500`; // Blå
    case "Bygg":
      return `${base} bg-orange-500`;
    case "Projektering":
      return `${base} bg-yellow-400 text-black`;
    case "Admin":
      return `${base} bg-green-500`;
    case "Övrigt":
      return "text-xs px-2 py-1 rounded bg-white text-gray-700 border";
    default:
      return "text-xs px-2 py-1 rounded bg-gray-100 text-gray-700";
  }
}

/* ==========================================================
   Aktiviteter — lista + arkiv-läge
   ========================================================== */

function activityStatusBadge(status) {
  const base = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium";
  switch (status) {
    case "klar":
      return `${base} bg-green-100 text-green-700`;
    case "inställd":
      return `${base} bg-rose-100 text-rose-700`;
    default:
      return `${base} bg-gray-100 text-gray-700`;
  }
}

function activityPriorityBadge(priority) {
  const base = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium";
  switch (priority) {
    case "high":
      return `${base} bg-red-100 text-red-700`;
    case "low":
      return `${base} bg-gray-100 text-gray-700`;
    default:
      return `${base} bg-yellow-100 text-yellow-700`;
  }
}

function ActivitiesPanel({ activities = [], entities = [], setState }) {
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  const customers = useMemo(
    () => (entities || []).filter((e) => e.type === "customer"),
    [entities]
  );

  const customerName = (id) =>
    customers.find((c) => c.id === id)?.companyName || "—";

  const filtered = useMemo(() => {
    let arr = activities || [];
    if (!showArchived) {
      arr = arr.filter((a) => !a.isDone && !a.deletedAt);
    } else {
      arr = arr.filter((a) => a.deletedAt || a.isDone);
    }

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter((a) => {
        const customer = customerName(a.customerId);
        return (
          (a.title || "").toLowerCase().includes(s) ||
          (a.note || "").toLowerCase().includes(s) ||
          customer.toLowerCase().includes(s)
        );
      });
    }

    arr.sort((a, b) => {
      const da = a.dueDate || "";
      const db = b.dueDate || "";
      if (da && db) return da.localeCompare(db);
      if (da) return -1;
      if (db) return 1;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
    return arr;
  }, [activities, showArchived, q, customers]);

  const openEdit = (a) => {
    setOpenItem(a);
    setDraft({
      id: a.id,
      title: a.title || "",
      customerId: a.customerId || "",
      responsible: a.responsible || "Cralle",
      priority: a.priority || "medium",
      status: a.status || "",
      note: a.note || "",
      dueDate: a.dueDate || "",
      dueTime: a.dueTime || "",
    });
  };

  const saveDraft = () => {
    if (!draft) return;
    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((a) =>
        a.id === draft.id
          ? {
              ...a,
              title: draft.title || "",
              customerId: draft.customerId || "",
              responsible: draft.responsible || "Cralle",
              priority: draft.priority || "medium",
              status: draft.status || "",
              note: draft.note || "",
              dueDate: draft.dueDate || "",
              dueTime: draft.dueTime || "",
              isDone: draft.status === "klar",
              updatedAt: new Date().toISOString(),
            }
          : a
      ),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  const softDelete = (a) => {
    if (
      !window.confirm(
        showArchived
          ? "Ta bort aktiviteten permanent?"
          : "Arkivera denna aktivitet? (den flyttas till arkivet)"
      )
    )
      return;

    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((x) =>
        x.id === a.id
          ? showArchived
            ? { ...x, deletedAt: new Date().toISOString() }
            : { ...x, isDone: true, status: "klar" }
          : x
      ),
    }));

    if (openItem?.id === a.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Aktiviteter</h2>
          <button
            className="text-xs px-2 py-1 rounded-full border"
            onClick={() => setShowArchived((v) => !v)}
            type="button"
          >
            {showArchived ? "Visa aktiva" : "Visa arkiv"}
          </button>
        </div>
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Sök i aktiviteter..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <ul className="divide-y">
        {filtered.map((a) => {
          const overdue =
            a.dueDate && !a.isDone && a.dueDate < new Date().toISOString().slice(0, 10);
          return (
            <li key={a.id} className={`py-3 ${overdue ? "bg-red-50" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <button
                  className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                  onClick={() => openEdit(a)}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{a.title || "(ingen titel)"}</span>
                    {a.priority && (
                      <span className={activityPriorityBadge(a.priority)}>
                        {a.priority === "high"
                          ? "Hög"
                          : a.priority === "low"
                          ? "Låg"
                          : "Normal"}
                      </span>
                    )}
                    {a.status && <span className={activityStatusBadge(a.status)}>{a.status}</span>}
                    {overdue && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                        Försenad
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                    {a.dueDate && (
                      <span>
                        Nästa åtgärd: {a.dueDate} {a.dueTime || ""}
                      </span>
                    )}
                    {a.customerId && <span>Kund: {customerName(a.customerId)}</span>}
                    {a.responsible && <span>Ansvarig: {a.responsible}</span>}
                  </div>
                  {a.note && (
                    <div className="text-xs text-gray-600 mt-1 line-clamp-2">{a.note}</div>
                  )}
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                  onClick={() => softDelete(a)}
                  type="button"
                >
                  {showArchived ? "Ta bort" : "Klar / arkivera"}
                </button>
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="py-6 text-sm text-gray-500">
            {showArchived ? "Inga arkiverade aktiviteter." : "Inga aktiviteter ännu."}
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
              <div className="font-semibold">Redigera aktivitet</div>
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
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Kund</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.customerId}
                  onChange={(e) => setDraft((d) => ({ ...d, customerId: e.target.value }))}
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
                <label className="text-sm font-medium">Ansvarig</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.responsible}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, responsible: e.target.value || "Cralle" }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Prioritet</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.priority}
                  onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
                >
                  <option value="low">Låg</option>
                  <option value="medium">Normal</option>
                  <option value="high">Hög</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.status}
                  onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                >
                  <option value="">Pågående</option>
                  <option value="klar">Klar</option>
                  <option value="inställd">Inställd</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Nästa åtgärdsdatum</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={draft.dueDate}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, dueDate: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tid</label>
                <input
                  type="time"
                  className="w-full border rounded px-3 py-2"
                  value={draft.dueTime}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      dueTime: e.target.value,
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

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded bg-green-600 text-white"
                onClick={saveDraft}
                type="button"
              >
                Spara
              </button>
              <button
                className="px-3 py-2 rounded border"
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

/* ==========================================================
   Kunder
   ========================================================== */

function CustomersPanel({ entities = [], setState }) {
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
      orgNo: c.orgNo || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      zip: c.zip || "",
      city: c.city || "",
      customerCategory: c.customerCategory || "",
    });
  }, [entities]);

  const updateDraft = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const createSupplierFromCustomer = () => {
    if (!draft) return;
    const id = draft.id;
    setState((s) => {
      const exists = (s.entities || []).some(
        (e) => e.type === "supplier" && e.id === id
      );
      if (exists) return s;
      const sup = {
        id,
        type: "supplier",
        companyName: draft.companyName || "",
        orgNo: draft.orgNo || "",
        phone: draft.phone || "",
        email: draft.email || "",
        address: draft.address || "",
        zip: draft.zip || "",
        city: draft.city || "",
        supplierCategory: "",
        createdAt: new Date().toISOString(),
        _shouldOpen: true,
      };
      return { ...s, entities: [...(s.entities || []), sup] };
    });
  };

  const list = useMemo(() => {
    const customers = (entities || []).filter((e) => e.type === "customer");

    let arr = customers;

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter((c) => {
        return (
          (c.companyName || "").toLowerCase().includes(s) ||
          (c.orgNo || "").toLowerCase().includes(s) ||
          (c.phone || "").toLowerCase().includes(s) ||
          (c.email || "").toLowerCase().includes(s) ||
          (c.city || "").toLowerCase().includes(s)
        );
      });
    }

    if (cat !== "all") {
      arr = arr.filter((c) => (c.customerCategory || "") === cat);
    }

    const top = arr
      .filter((c) => c.customerCategory === "Totalentreprenad" || c.customerCategory === "Turbovex")
      .sort((a, b) => (b.lastUsedAt || "").localeCompare(a.lastUsedAt || ""));

    const rest = arr.filter((c) => !top.includes(c));

    top.sort((a, b) => (b.lastUsedAt || "").localeCompare(a.lastUsedAt || ""));
    rest.sort((a, b) => (a.companyName || "").localeCompare(b.companyName || ""));

    return [...top, ...rest];
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
      orgNo: c.orgNo || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      zip: c.zip || "",
      city: c.city || "",
      customerCategory: c.customerCategory || "",
    });
  };

  const saveDraft = () => {
    if (!draft) return;
    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === draft.id
          ? {
              ...e,
              type: "customer",
              companyName: draft.companyName || "",
              orgNo: draft.orgNo || "",
              phone: draft.phone || "",
              email: draft.email || "",
              address: draft.address || "",
              zip: draft.zip || "",
              city: draft.city || "",
              customerCategory: draft.customerCategory || "",
              updatedAt: new Date().toISOString(),
            }
          : e
      ),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  const softDelete = (c) => {
    if (!window.confirm("Ta bort denna kund?")) return;
    setState((s) => ({
      ...s,
      entities: (s.entities || []).filter((e) => e.id !== c.id),
    }));
    if (openItem?.id === c.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="font-semibold">Kunder</h2>
        <div className="flex gap-2 flex-wrap items-center">
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
            <option value="Bygg">Bygg</option>
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
                      ({[c.firstName, c.lastName].filter(Boolean).join(" ")})
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                  {c.orgNo && <span>OrgNr: {c.orgNo}</span>}
                  {c.phone && <span>Tel: {c.phone}</span>}
                  {c.email && <span>{c.email}</span>}
                  {c.city && <span>{c.city}</span>}
                </div>
              </button>
              <div className="flex items-center gap-2">
                {c.customerCategory && (
                  <span className={customerCategoryBadge(c.customerCategory)}>
                    {c.customerCategory}
                  </span>
                )}
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
        {list.length === 0 && (
          <li className="py-6 text-sm text-gray-500">Inga kunder.</li>
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
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium">Kategori</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={draft.customerCategory}
                    onChange={(e) =>
                      updateDraft("customerCategory", e.target.value)
                    }
                  >
                    <option value="">—</option>
                    <option value="StålHall">Stålhall</option>
                    <option value="Totalentreprenad">Totalentreprenad</option>
                    <option value="Turbovex">Turbovex</option>
                    <option value="Bygg">Bygg</option>
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

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded bg-green-600 text-white"
                onClick={saveDraft}
                type="button"
              >
                Spara
              </button>
              <button
                className="px-3 py-2 rounded border"
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

/* ==========================================================
   Leverantörer
   ========================================================== */

function SuppliersPanel({ entities = [], setState }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    const s = (entities || []).find((e) => e.type === "supplier" && e._shouldOpen);
    if (!s) return;
    setOpenItem(s);
    setDraft({
      id: s.id,
      companyName: s.companyName || "",
      orgNo: s.orgNo || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      zip: s.zip || "",
      city: s.city || "",
      supplierCategory: s.supplierCategory || "",
    });
  }, [entities]);

  const updateDraft = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const list = useMemo(() => {
    const suppliers = (entities || []).filter((e) => e.type === "supplier");

    let arr = suppliers;

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter((c) => {
        return (
          (c.companyName || "").toLowerCase().includes(s) ||
          (c.orgNo || "").toLowerCase().includes(s) ||
          (c.phone || "").toLowerCase().includes(s) ||
          (c.email || "").toLowerCase().includes(s) ||
          (c.city || "").toLowerCase().includes(s)
        );
      });
    }

    if (cat !== "all") {
      arr = arr.filter((c) => (c.supplierCategory || "") === cat);
    }

    arr.sort((a, b) => (a.companyName || "").localeCompare(b.companyName || ""));

    return arr;
  }, [entities, q, cat]);

  const openEdit = (c) => {
    setOpenItem(c);
    setDraft({
      id: c.id,
      companyName: c.companyName || "",
      orgNo: c.orgNo || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      zip: c.zip || "",
      city: c.city || "",
      supplierCategory: c.supplierCategory || "",
    });
  };

  const saveDraft = () => {
    if (!draft) return;
    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === draft.id
          ? {
              ...e,
              type: "supplier",
              companyName: draft.companyName || "",
              orgNo: draft.orgNo || "",
              phone: draft.phone || "",
              email: draft.email || "",
              address: draft.address || "",
              zip: draft.zip || "",
              city: draft.city || "",
              supplierCategory: draft.supplierCategory || "",
              updatedAt: new Date().toISOString(),
            }
          : e
      ),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  const softDelete = (c) => {
    if (!window.confirm("Ta bort denna leverantör?")) return;
    setState((s) => ({
      ...s,
      entities: (s.entities || []).filter((e) => e.id !== c.id),
    }));
    if (openItem?.id === c.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="font-semibold">Leverantörer</h2>
        <div className="flex gap-2 flex-wrap items-center">
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
            <option value="Stålhalls leverantör">
              Stålhalls leverantör
            </option>
            <option value="Mark & Betong">Mark & Betong</option>
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
        {list.map((c) => (
          <li key={c.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                onClick={() => openEdit(c)}
                type="button"
              >
                <div className="font-medium truncate">
                  {c.companyName || "(namnlös leverantör)"}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                  {c.orgNo && <span>OrgNr: {c.orgNo}</span>}
                  {c.phone && <span>Tel: {c.phone}</span>}
                  {c.email && <span>{c.email}</span>}
                  {c.city && <span>{c.city}</span>}
                </div>
              </button>
              <div className="flex items-center gap-2">
                {c.supplierCategory && (
                  <span className={supplierCategoryBadge(c.supplierCategory)}>
                    {c.supplierCategory}
                  </span>
                )}
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
        {list.length === 0 && (
          <li className="py-6 text-sm text-gray-500">Inga leverantörer.</li>
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
              <div>
                <label className="text-sm font-medium">Kategori</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={draft.supplierCategory}
                  onChange={(e) =>
                    updateDraft("supplierCategory", e.target.value)
                  }
                >
                  <option value="">—</option>
                  <option value="Stålhalls leverantör">
                    Stålhalls leverantör
                  </option>
                  <option value="Mark & Betong">Mark & Betong</option>
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

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded bg-green-600 text-white"
                onClick={saveDraft}
                type="button"
              >
                Spara
              </button>
              <button
                className="px-3 py-2 rounded border"
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

/* ==========================================================
   Rotkomponent
   ========================================================== */

function App() {
  const [state, setState, sync] = useStore();
  const [view, setView] = useState("activities");

  const newId = () =>
    crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

  const getNextOfferNumber = () => {
    const base = 35001;
    const nums =
      (state.offers || [])
        .map((o) => parseInt(o.offerNumber, 10))
        .filter((n) => !Number.isNaN(n) && n >= 35000 && n < 36000);
    if (!nums.length) return base;
    return Math.max(...nums) + 1;
  };

  const getNextDirectProjectNumber = () => {
    const base = 60001;
    const nums =
      (state.projects || [])
        .filter((p) => !p.originatingOfferId)
        .map((p) => parseInt(p.projectNumber || p.internalId, 10))
        .filter((n) => !Number.isNaN(n) && n >= 60000 && n < 70000);
    if (!nums.length) return base;
    return Math.max(...nums) + 1;
  };

  function createActivity() {
    const id = newId();
    const a = {
      id,
      title: "",
      responsible: "Cralle",
      priority: "medium",
      status: "",
      note: "",
      dueDate: "",
      dueTime: "",
      isDone: false,
      createdAt: new Date().toISOString(),
      _shouldOpen: true,
    };
    setState((s) => ({ ...s, activities: [...(s.activities || []), a] }));
    setView("activities");
  }

  function createCustomer() {
    const id = newId();
    const c = {
      id,
      type: "customer",
      companyName: "",
      createdAt: new Date().toISOString(),
      customerCategory: "",
      _shouldOpen: true,
    };
    setState((s) => ({ ...s, entities: [...(s.entities || []), c] }));
    setView("customers");
  }

  function createSupplier() {
    const id = newId();
    const sup = {
      id,
      type: "supplier",
      companyName: "",
      createdAt: new Date().toISOString(),
      supplierCategory: "",
      _shouldOpen: true,
    };
    setState((s) => ({ ...s, entities: [...(s.entities || []), sup] }));
    setView("suppliers");
  }

  function createOffer() {
    const id = newId();
    const offerNumber = getNextOfferNumber();
    const o = {
      id,
      title: "",
      customerId: "",
      value: 0,
      status: "utkast",
      note: "",
      nextActionDate: "",
      files: { Ritningar: [], Offerter: [], Kalkyler: [], KMA: [] },
      supplierIds: [],
      offerNumber,
      createdAt: new Date().toISOString(),
      _shouldOpen: true,
    };

    setState((s) => ({ ...s, offers: [...(s.offers || []), o] }));
    setView("offers");
  }

  function createProjectEmpty() {
    const id = newId();
    const projectNumber = getNextDirectProjectNumber();
    const p = {
      id,
      name: "",
      customerId: "",
      status: "pågående",
      budget: 0,
      startDate: "",
      endDate: "",
      note: "",
      files: { Ritningar: [], Offerter: [], Kalkyler: [], KMA: [] },
      projectNumber,
      internalId: projectNumber,
      createdAt: new Date().toISOString(),
      _shouldOpen: true,
    };
    setState((s) => ({ ...s, projects: [...(s.projects || []), p] }));
    setView("projects");
  }

  const { isSyncing, syncError } = sync;

  return (
    <div className="mx-auto max-w-7xl p-4">
      {/* HEADER */}
      <header className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">
          <img src="/logo.png" alt="Mach CRM" className="h-8" />
        </h1>
        <div className="flex items-center gap-2">
          <button
            className="border rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300"
            onClick={createActivity}
            title="Skapa ny aktivitet"
            type="button"
          >
            + Ny aktivitet
          </button>
          <button
            className="border rounded-xl px-3 py-2"
            onClick={createCustomer}
            type="button"
          >
            + Ny kund
          </button>
          <button
            className="border rounded-xl px-3 py-2"
            onClick={createSupplier}
            type="button"
          >
            + Ny leverantör
          </button>
          <button
            className="border rounded-xl px-3 py-2"
            onClick={createOffer}
            type="button"
          >
            + Ny offert
          </button>
          <button
            className="border rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700"
            onClick={createProjectEmpty}
            type="button"
          >
            + Nytt projekt
          </button>
        </div>
      </header>

      {/* SYNC-STATUS */}
      <div className="mb-4 text-xs text-gray-500 flex items-center gap-3">
        {isSyncing ? <span>Synkar med SharePoint…</span> : <span>Synkad.</span>}
        {syncError && <span className="text-red-500">{syncError}</span>}
      </div>

      {/* NAVIGATION */}
      <nav className="mb-4 flex flex-wrap gap-2">
        <button
          className={`px-3 py-2 rounded-full text-sm ${
            view === "activities" ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
          onClick={() => setView("activities")}
          type="button"
        >
          Aktiviteter
        </button>
        <button
          className={`px-3 py-2 rounded-full text-sm ${
            view === "activitiesCalendar" ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
          onClick={() => setView("activitiesCalendar")}
          type="button"
        >
          Kalender
        </button>
        <button
          className={`px-3 py-2 rounded-full text-sm ${
            view === "customers" ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
          onClick={() => setView("customers")}
          type="button"
        >
          Kunder
        </button>
        <button
          className={`px-3 py-2 rounded-full text-sm ${
            view === "suppliers" ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
          onClick={() => setView("suppliers")}
          type="button"
        >
          Leverantörer
        </button>
        <button
          className={`px-3 py-2 rounded-full text-sm ${
            view === "offers" ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
          onClick={() => setView("offers")}
          type="button"
        >
          Offerter
        </button>
        <button
          className={`px-3 py-2 rounded-full text-sm ${
            view === "projects" ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
          onClick={() => setView("projects")}
          type="button"
        >
          Projekt
        </button>
        <button
          className={`px-3 py-2 rounded-full text-sm ${
            view === "settings" ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
          onClick={() => setView("settings")}
          type="button"
        >
          Inställningar
        </button>
      </nav>

      {/* INNEHÅLL */}
      {view === "activities" && (
        <ActivitiesPanel
          activities={state.activities}
          entities={state.entities}
          setState={setState}
        />
      )}
      {view === "activitiesCalendar" && (
        <ActivitiesCalendarPanel
          activities={state.activities}
          entities={state.entities}
          setState={setState}
        />
      )}
      {view === "customers" && (
        <CustomersPanel entities={state.entities} setState={setState} />
      )}
      {view === "suppliers" && (
        <SuppliersPanel entities={state.entities} setState={setState} />
      )}
      {view === "offers" && (
        <OffersPanel
          offers={state.offers}
          entities={state.entities}
          setState={setState}
        />
      )}
      {view === "projects" && (
        <ProjectsPanel
          projects={state.projects}
          entities={state.entities}
          setState={setState}
        />
      )}
      {view === "settings" && <SettingsPanel state={state} setState={setState} />}
    </div>
  );
}

export default App;
