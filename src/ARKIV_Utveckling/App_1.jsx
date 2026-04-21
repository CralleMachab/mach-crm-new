import React, { useEffect, useMemo, useState, useRef } from "react";
import { loadState, saveState } from "./lib/storage";
import { fetchRemoteState, pushRemoteState } from "./lib/cloud";
import NotesHistory from "./components/NotesHistory.jsx";

import OffersPanel from "./panels/OffersPanel.jsx";
import ProjectsPanel from "./panels/ProjectsPanel.jsx";

import ActivitiesCalendarPanel from "./panels/ActivitiesCalendarPanel.jsx";
import SettingsPanel from "./panels/SettingsPanel.jsx";
import ActivitiesPanel from "./panels/ActivitiesPanel.jsx";

const ENABLE_REMOTE_SYNC = false;

// Hjälp-funktion för att visa svenskt datum/tid
function formatSwedishDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ===========================
   useStore — lokal + SharePoint
   =========================== */
function useStore() {
  const STORAGE_KEY = "machcrm_data_v3";

  const [state, setState] = useState(() => {
    const s = loadState();
    if (s && typeof s === "object") return s;
    return {
      activities: [],
      entities: [],
      offers: [],
      projects: [],
      _lastSavedAt: "",
    };
  });

  // Lokalt
  useEffect(() => {
    saveState(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  // Push till SharePoint (debounce) – avstängd när ENABLE_REMOTE_SYNC = false
  useEffect(() => {
    if (!ENABLE_REMOTE_SYNC) return;
    const t = setTimeout(async () => {
      try {
        const withVersion = {
          ...state,
          _lastSavedAt: new Date().toISOString(),
        };
        await pushRemoteState(withVersion);
      } catch (e) {
        console.warn("Kunde inte spara till SharePoint:", e);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [state]);

  // Poll från SharePoint
  useEffect(() => {
    if (!ENABLE_REMOTE_SYNC) return;
    let stopped = false;
    const tick = async () => {
      try {
        const remote = await fetchRemoteState();
        if (remote && typeof remote === "object") {
          const lv = state?._lastSavedAt || "";
          const rv = remote?._lastSavedAt || "";
          if (rv && rv !== lv) {
            setState(remote);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
            } catch {}
          }
        }
      } catch {
      } finally {
        if (!stopped) setTimeout(tick, 5000);
      }
    };
    tick();
    return () => {
      stopped = true;
    };
  }, []); // bara första gången


  return [state, setState];
}

/* ======================================
   Färghelpers för kategorier
   ====================================== */
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
      return `${base} bg-orange-500`; // Orange för Bygg
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
    case "Övrigt":
      return "text-xs px-2 py-1 rounded bg-white text-gray-700 border";
    default:
      return "text-xs px-2 py-1 rounded bg-gray-100 text-gray-700";
  }
}


/* ======================================
   Kunder
   ====================================== */
function CustomersPanel({ entities = [], setState }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  // Öppna direkt om _shouldOpen är satt
  useEffect(() => {
    const c = (entities || []).find(
      (e) => e.type === "customer" && e._shouldOpen
    );
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
    let arr = (entities || []).filter(
      (e) => e.type === "customer" && !e.deletedAt
    );

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

    // Sortering: 3 senaste med lastUsedAt först, sedan resten alfabetiskt
    const withUsed = arr.filter((e) => !!e.lastUsedAt);
    withUsed.sort((a, b) =>
      (b.lastUsedAt || "").localeCompare(a.lastUsedAt || "")
    );
    const top3 = withUsed.slice(0, 3).map((e) => e.id);

    const topList = arr.filter((e) => top3.includes(e.id));
    const rest = arr.filter((e) => !top3.includes(e.id));
    rest.sort((a, b) =>
      (a.companyName || "").localeCompare(b.companyName || "")
    );

    return [...topList, ...rest];
  }, [entities, q, cat]);

  const openEdit = (c) => {
    // uppdatera lastUsedAt
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
    const id =
      crypto?.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

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

    setState((s) => ({
      ...s,
      entities: [...(s.entities || []), sup],
    }));

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
                      {[
                        c.firstName,
                        c.lastName,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {[c.city || "", c.phone || ""]
                    .filter(Boolean)
                    .join(" · ")}
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
                  onChange={(e) =>
                    updateDraft("companyName", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Förnamn</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.firstName || ""}
                  onChange={(e) =>
                    updateDraft("firstName", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Efternamn</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.lastName || ""}
                  onChange={(e) =>
                    updateDraft("lastName", e.target.value)
                  }
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
                  onChange={(e) =>
                    updateDraft("address", e.target.value)
                  }
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
                  onChange={(e) =>
                    updateDraft("notes", e.target.value)
                  }
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
                    <option value="Totalentreprenad">
                      Totalentreprenad
                    </option>
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

/* ======================================
   Leverantörer
   ====================================== */
function SuppliersPanel({ entities = [], setState }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [mode, setMode] = useState("active"); // active | archive
  const [openItem, setOpenItem] = useState(null);
  const [draft, setDraft] = useState(null);

  // Öppna direkt om _shouldOpen är satt
  useEffect(() => {
    const s = (entities || []).find(
      (e) => e.type === "supplier" && e._shouldOpen
    );
    if (!s) return;
    setOpenItem(s);
    setDraft({
      id: s.id,
      companyName: s.companyName || "",
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      orgNo: s.orgNo || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      zip: s.zip || "",
      city: s.city || "",
      supplierCategory: s.supplierCategory || "",
      notes: s.notes || "",
    });
    setState((st) => ({
      ...st,
      entities: (st.entities || []).map((e) =>
        e.id === s.id ? { ...e, _shouldOpen: undefined } : e
      ),
    }));
  }, [entities, setState]);
  useEffect(() => {
  if (!openActivityId) return;

  const activity = state.activities?.find((a) => a.id === openActivityId);
  if (!activity) return;

  setActivityDraft(activity);
  setActivityModalOpen(true);
}, [openActivityId, state.activities]);

  const list = useMemo(() => {
    let arr = (entities || []).filter((e) => e.type === "supplier");
    if (mode === "active") {
      arr = arr.filter((e) => !e.deletedAt);
    } else {
      arr = arr.filter((e) => !!e.deletedAt);
    }

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
      arr = arr.filter((e) => (e.supplierCategory || "") === cat);
    }

    arr.sort((a, b) =>
      (a.companyName || "").localeCompare(b.companyName || "")
    );
    return arr;
  }, [entities, q, cat, mode]);

  const openEdit = (s) => {
    setState((st) => ({
      ...st,
      entities: (st.entities || []).map((e) =>
        e.id === s.id ? { ...e, lastUsedAt: new Date().toISOString() } : e
      ),
    }));
    setOpenItem(s);
    setDraft({
      id: s.id,
      companyName: s.companyName || "",
      firstName: s.firstName || "",
      lastName: s.lastName || "",
      orgNo: s.orgNo || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      zip: s.zip || "",
      city: s.city || "",
      supplierCategory: s.supplierCategory || "",
      notes: s.notes || "",
    });
  };

  const updateDraft = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const createCustomerFromSupplier = () => {
    if (!draft) return;
    const id =
      crypto?.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const c = {
      id,
      type: "customer",
      companyName: draft.companyName || "",
      firstName: draft.firstName || "",
      lastName: draft.lastName || "",
      orgNo: draft.orgNo || "",
      phone: draft.phone || "",
      email: draft.email || "",
      address: draft.address || "",
      zip: draft.zip || "",
      city: draft.city || "",
      customerCategory: draft.supplierCategory || "",
      notes: draft.notes || "",
      createdAt: new Date().toISOString(),
    };

    setState((s) => ({
      ...s,
      entities: [...(s.entities || []), c],
    }));

    alert("Kund skapad från leverantören.");
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
              supplierCategory: draft.supplierCategory || "",
              notes: draft.notes || "",
              updatedAt: new Date().toISOString(),
            }
          : e
      ),
    }));
    setOpenItem(null);
    setDraft(null);
  };

  const softDelete = (sup) => {
    if (
      !window.confirm(
        "Ta bort denna leverantör? Den hamnar i arkiv (kan återställas via Inställningar)."
      )
    )
      return;
    setState((s0) => ({
      ...s0,
      entities: (s0.entities || []).map((e) =>
        e.id === sup.id ? { ...e, deletedAt: new Date().toISOString() } : e
      ),
    }));
    if (openItem?.id === sup.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  const hardDelete = (sup) => {
    if (
      !window.confirm(
        "Ta bort denna leverantör PERMANENT? Detta går inte att ångra."
      )
    )
      return;
    setState((s0) => ({
      ...s0,
      entities: (s0.entities || []).filter((e) => e.id !== sup.id),
    }));
    if (openItem?.id === sup.id) {
      setOpenItem(null);
      setDraft(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Leverantörer</h2>
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
            <option value="Stålhalls leverantör">
              Stålhalls leverantör
            </option>
            <option value="Mark företag">Mark företag</option>
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
        {list.map((sup) => (
          <li key={sup.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                className="text-left min-w-0 flex-1 hover:bg-gray-50 rounded px-1"
                onClick={() => openEdit(sup)}
                type="button"
              >
                <div className="font-medium truncate">
                  {sup.companyName || "(namnlös leverantör)"}
                  {(sup.firstName || sup.lastName) && (
                    <span className="text-sm text-gray-500 ml-1">
                      {[
                        sup.firstName,
                        sup.lastName,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  )}
                  {mode === "archive" ? " (Arkiv)" : ""}
                </div>
                <div className="text-xs text-gray-500">
                  {[sup.city || "", sup.phone || ""]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <span className={supplierCategoryBadge(sup.supplierCategory)}>
                  {sup.supplierCategory || "—"}
                </span>

                {mode === "active" ? (
                  <button
                    className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                    onClick={() => softDelete(sup)}
                    type="button"
                  >
                    Ta bort
                  </button>
                ) : (
                  <button
                    className="text-xs px-2 py-1 rounded bg-rose-700 text-white"
                    onClick={() => hardDelete(sup)}
                    type="button"
                  >
                    Ta bort permanent
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}

        {list.length === 0 && (
          <li className="py-6 text-sm text-gray-500">
            {mode === "active"
              ? "Inga leverantörer."
              : "Inga arkiverade leverantörer."}
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
                  onChange={(e) =>
                    updateDraft("companyName", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Förnamn</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.firstName || ""}
                  onChange={(e) =>
                    updateDraft("firstName", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">Efternamn</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.lastName || ""}
                  onChange={(e) =>
                    updateDraft("lastName", e.target.value)
                  }
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
                  onChange={(e) =>
                    updateDraft("address", e.target.value)
                  }
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
                  onChange={(e) =>
                    updateDraft("notes", e.target.value)
                  }
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
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
                    <option value="Mark företag">Mark företag</option>
                    <option value="EL leverantör">EL leverantör</option>
                    <option value="VVS Leverantör">VVS Leverantör</option>
                    <option value="Vent Leverantör">Vent Leverantör</option>
                    <option value="Bygg">Bygg</option>
                    <option value="Projektering">Projektering</option>
                    <option value="Admin">Admin</option>
                    <option value="Övrigt">Övrigt</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="text-xs px-2 py-2 rounded bg-slate-600 text-white whitespace-nowrap"
                  onClick={createCustomerFromSupplier}
                >
                  Gör till kund
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
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

/* ===========================
   App — layout + meny
   =========================== */

export default function App() {
  const [state, setState] = useStore();
  const [view, setView] = useState("activities");

  const [openActivityId, setOpenActivityId] = useState(null);
  const [openActivitySource, setOpenActivitySource] = useState(null);

  useEffect(() => {
  if (!openActivityId) return;
  setView("activities");
}, [openActivityId]);

  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [activityDraft, setActivityDraft] = useState(null);

  // views: activities | activitiesCalendar | customers | suppliers | offers | projects | settings

  const lastSyncedIso = state?._lastSavedAt || "";
  const lastSyncedText = lastSyncedIso
    ? formatSwedishDateTime(lastSyncedIso)
    : "Ingen synk ännu";

  const newId = () =>
    crypto?.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  function createActivity() {
    // Signalera till ActivitiesPanel att en ny aktivitet ska skapas i popup,
    // men lägg INTE till den i listan förrän den sparas.
    setState((s) => ({
      ...s,
      _newActivityRequestId: (s._newActivityRequestId || 0) + 1,
    }));
    setView("activities");
  }

  function createOffer() {
    setState((s) => {
      const base = 350501;
      const existing = (s.offers || [])
        .map((o) => Number(o.offerNumber))
        .filter((n) => Number.isFinite(n) && n >= base);
      const nextNumber = existing.length ? Math.max(...existing) + 1 : base;

      const id = newId();
      const o = {
        id,
        title: "",
        customerId: "",
        value: 0,
        status: "utkast",
        note: "",
        nextActionDate: "",
        files: {
          Ritningar: [],
          Offerter: [],
          Kalkyler: [],
          KMA: [],
        },
        supplierIds: [],
        supplierSent: false,
        supplierResponded: false,
        offerNumber: nextNumber,
        createdAt: new Date().toISOString(),
        _shouldOpen: true,
      };

      return { ...s, offers: [...(s.offers || []), o] };
    });
    setView("offers");
  }

  function createProjectEmpty() {
    setState((s) => {
      const base = 650501;
      const existing = (s.projects || [])
        .map((p) => Number(p.projectNumber))
        .filter((n) => Number.isFinite(n) && n >= base);
      const nextNumber = existing.length ? Math.max(...existing) + 1 : base;

      const id = newId();
      const p = {
        id,
        projectNumber: nextNumber,
        name: "",
        customerId: "",
        status: "pågående",
        budget: 0,
        startDate: "",
        endDate: "",
        note: "",
        files: {
          Ritningar: [],
          Offerter: [],
          Kalkyler: [],
          KMA: [],
        },
        createdAt: new Date().toISOString(),
        _shouldOpen: true,
      };

      return { ...s, projects: [...(s.projects || []), p] };
    });
    setView("projects");
  }

  function createCustomer() {
    const id = newId();
    const c = {
      id,
      type: "customer",
      companyName: "",
      firstName: "",
      lastName: "",
      notes: "",
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
    firstName: "",
    lastName: "",
    notes: "",
    createdAt: new Date().toISOString(),
    supplierCategory: "",
    _shouldOpen: true,
  };
  setState((s) => ({ ...s, entities: [...(s.entities || []), sup] }));
  setView("suppliers");
}

useEffect(() => {
  if (openActivitySource !== "calendar") return;
  if (!openActivityId) return;

  setView("activities");
}, [openActivityId, openActivitySource]);

return (
    <div className="mx-auto max-w-7xl p-4">
      {/* HEADER */}
      <header className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Mach CRM</h1>

        <div className="flex flex-col items-end gap-1">
          {/* Knapprad */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="border rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300"
              onClick={createActivity}
              title="Skapa ny aktivitet"
              type="button"
            >
              + Ny aktivitet
            </button>

            <button
              className="border rounded-xl px-3 py-2 bg-orange-300 hover:bg-orange-400"
              onClick={createOffer}
              title="Skapa ny offert"
              type="button"
            >
              + Ny offert
            </button>

            <button
              className="border rounded-xl px-3 py-2 bg-green-200 hover:bg-green-300"
              onClick={createProjectEmpty}
              title="Skapa nytt projekt"
              type="button"
            >
              + Nytt projekt
            </button>

            <button
              className="border rounded-xl px-3 py-2 bg-blue-200 hover:bg-blue-300"
              onClick={createCustomer}
              title="Lägg till kund"
              type="button"
            >
              + Ny kund
            </button>

            <button
              className="border rounded-xl px-3 py-2 bg-amber-200 hover:bg-amber-300"
              onClick={createSupplier}
              title="Lägg till leverantör"
              type="button"
            >
              + Ny leverantör
            </button>

            <button
              className="ml-2 border rounded-xl px-3 py-2 hover:bg-gray-50"
              onClick={() => setView("settings")}
              title="Inställningar"
              type="button"
            >
              🛠️
            </button>
          </div>

          {/* Senast synkad-raden */}
          <div className="text-xs text-gray-500">
            Senast synkad: {lastSyncedText}
          </div>
        </div>
      </header>

      {/* NY LAYOUT: menyrad överst, innehåll under */}
      <div className="flex flex-col gap-4">
        {/* Meny-knappar (ersätter sidomenyn) */}
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            type="button"
            onClick={() => setView("activities")}
            className={`px-3 py-2 rounded-xl border text-sm ${
              view === "activities"
                ? "bg-gray-200 text-gray-900"
                : "bg-white text-gray-700"
            }`}
          >
            Aktiviteter
          </button>

          <button
            type="button"
            onClick={() => setView("activitiesCalendar")}
            className={`px-3 py-2 rounded-xl border text-sm ${
              view === "activitiesCalendar"
                ? "bg-gray-400 text-white"
                : "bg-white text-gray-700"
            }`}
          >
            Kalender
          </button>

          <button
            type="button"
            onClick={() => setView("customers")}
            className={`px-3 py-2 rounded-xl border text-sm ${
              view === "customers"
                ? "bg-blue-200 text-blue-900"
                : "bg-white text-gray-700"
            }`}
          >
            Kunder
          </button>

          <button
            type="button"
            onClick={() => setView("suppliers")}
            className={`px-3 py-2 rounded-xl border text-sm ${
              view === "suppliers"
                ? "bg-amber-200 text-amber-900"
                : "bg-white text-gray-700"
            }`}
          >
            Leverantörer
          </button>

          <button
            type="button"
            onClick={() => setView("offers")}
            className={`px-3 py-2 rounded-xl border text-sm ${
              view === "offers"
                ? "bg-orange-300 text-orange-900"
                : "bg-white text-gray-700"
            }`}
          >
            Offerter
          </button>

          <button
            type="button"
            onClick={() => setView("projects")}
            className={`px-3 py-2 rounded-xl border text-sm ${
              view === "projects"
                ? "bg-green-200 text-green-900"
                : "bg-white text-gray-700"
            }`}
          >
            Projekt
          </button>
        </div>

        {/* Själva innehållet/panelerna */}
        <div className="bg-slate-50 rounded-2xl p-3">
          {view === "activities" && (
  <ActivitiesPanel
    activities={state.activities || []}
    entities={state.entities || []}
    state={state}
    setState={setState}
    openActivityId={openActivityId}
    setOpenActivityId={setOpenActivityId}
    openActivitySource={openActivitySource}
    setOpenActivitySource={setOpenActivitySource}
  />
)}

  {view === "activitiesCalendar" && (
  <>
    <ActivitiesCalendarPanel
  activities={state.activities || []}
  entities={state.entities || []}
  setState={setState}
  setView={setView}
  openActivityId={openActivityId}
  setOpenActivityId={(id) => {
    setOpenActivityId(id);
    setView("activities");
  }}
  openActivitySource={openActivitySource}
  setOpenActivitySource={setOpenActivitySource}
/>

    <div
      style={{
  position: "absolute",
  left: "-99999px",
  top: 0,
}}
    >
      <ActivitiesPanel
        activities={state.activities || []}
        entities={state.entities || []}
        state={state}
        setState={setState}
        openActivityId={openActivityId}
        setOpenActivityId={setOpenActivityId}
        openActivitySource={openActivitySource}
        setOpenActivitySource={setOpenActivitySource}
      />
    </div>
  </>
)}

          {view === "customers" && (
            <CustomersPanel
              entities={state.entities || []}
              setState={setState}
            />
          )}

          {view === "suppliers" && (
            <SuppliersPanel
              entities={state.entities || []}
              setState={setState}
            />
          )}

          {view === "offers" && (
            <OffersPanel
              offers={state.offers || []}
              entities={state.entities || []}
              setState={setState}
            />
          )}

          {view === "projects" && (
            <ProjectsPanel
              projects={state.projects || []}
              offers={state.offers || []}
              entities={state.entities || []}
              setState={setState}
            />
          )}

          {view === "settings" && (
  <SettingsPanel
    entities={state.entities || []}
    offers={state.offers || []}
    projects={state.projects || []}
    activities={state.activities || []}
    setState={setState}
  />
)}
        </div>
      </div>
    </div>
  );
}
