// src/App.jsx
// Mach CRM – Featurepack version (Ver-2)
// Inkluderar färgade menyknappar, aktivitetshantering med filter,
// realtidsuppdatering, leverantörsbläddrare m.m.

import React, { useEffect, useMemo, useState } from "react";
import { pickOneDriveFiles } from "./components/onedrive";

/* ========== Local persistence ========== */
const LS_KEY = "mach_crm_state_v2";

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw
      ? JSON.parse(raw)
      : { entities: [], activities: [], offers: [], projects: [] };
  } catch {
    return { entities: [], activities: [], offers: [], projects: [] };
  }
}
function saveState(s) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {}
}

/* ========== Helpers ========== */
function entityLabel(t) {
  return t === "customer" ? "Kund" : "Leverantör";
}
function formatDT(dateStr, timeStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
  return d.toLocaleString("sv-SE", {
    dateStyle: "medium",
    timeStyle: timeStr ? "short" : undefined,
  });
}
function byName(a, b) {
  return (a.companyName || "").localeCompare(b.companyName || "", "sv");
}

/* ========== Constants ========== */
const RESPONSIBLES = ["Cralle", "Mattias", "Övrig"];
const PRIORITIES = [
  { key: "low", label: "Låg", className: "bg-gray-100 text-gray-700" },
  { key: "medium", label: "Normal", className: "bg-yellow-100 text-yellow-700" },
  { key: "high", label: "Hög", className: "bg-red-100 text-red-700" },
  { key: "klar", label: "Klar", className: "bg-green-200 text-green-800" },
];
const ACTIVITY_TYPES = [
  { key: "telefon", icon: "📞" },
  { key: "mail", icon: "✉️" },
  { key: "möte", icon: "📅" },
  { key: "lunch", icon: "🍽️" },
  { key: "uppgift", icon: "🧾" },
];

/* ========== Root component ========== */
export default function App() {
  const [state, setState] = useState(loadState());
  const [activeTab, setActiveTab] = useState("activities");
  const [modal, setModal] = useState(null);

  // autosave + sync with other tabs
  useEffect(() => {
    saveState(state);
    const onStorage = (e) => {
      if (e.key === LS_KEY) {
        try {
          const newVal = JSON.parse(e.newValue || "{}");
          if (newVal && typeof newVal === "object") setState(newVal);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [state]);

  /* ----- create functions ----- */
  function createActivity() {
    const id = crypto.randomUUID();
    const a = {
      id,
      title: "Ny aktivitet",
      responsible: "Cralle",
      priority: "medium",
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, activities: [...(s.activities || []), a] }));
  }
  function createOffer() {
    const id = crypto.randomUUID();
    const o = { id, title: "Ny offert", createdAt: new Date().toISOString() };
    setState((s) => ({ ...s, offers: [...(s.offers || []), o] }));
  }
  function createProjectEmpty() {
    const id = crypto.randomUUID();
    const p = { id, name: "Nytt projekt", createdAt: new Date().toISOString() };
    setState((s) => ({ ...s, projects: [...(s.projects || []), p] }));
  }
  function createCustomer() {
    const id = crypto.randomUUID();
    const c = { id, type: "customer", companyName: "Ny kund" };
    setState((s) => ({ ...s, entities: [...(s.entities || []), c] }));
  }
  function createSupplier() {
    const id = crypto.randomUUID();
    const sObj = { id, type: "supplier", companyName: "Ny leverantör" };
    setState((s) => ({ ...s, entities: [...(s.entities || []), sObj] }));
  }

  /* ----- layout rendering ----- */
  return (
    <div className="mx-auto max-w-7xl p-4">
      {/* HEADER */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Mach CRM</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="border rounded-xl px-3 py-2 bg-gray-200 hover:bg-gray-300"
            onClick={createActivity}
          >
            + Ny aktivitet
          </button>
          <button
            className="border rounded-xl px-3 py-2 bg-orange-300 hover:bg-orange-400"
            onClick={createOffer}
          >
            + Ny offert
          </button>
          <button
            className="border rounded-xl px-3 py-2 bg-green-200 hover:bg-green-300"
            onClick={createProjectEmpty}
          >
            + Nytt projekt
          </button>
          <button
            className="border rounded-xl px-3 py-2 bg-blue-200 hover:bg-blue-300"
            onClick={createCustomer}
          >
            + Ny kund
          </button>
          <button
            className="border rounded-xl px-3 py-2 bg-amber-200 hover:bg-amber-300"
            onClick={createSupplier}
          >
            + Ny leverantör
          </button>
        </div>
      </header>

      {/* Aktiviteter */}
      <ActivitiesPanel
        activities={state.activities}
        entities={state.entities}
        setState={setState}
      />
    </div>
  );
}

/* ========== Activities panel ========== */
function ActivitiesPanel({ activities, entities, setState }) {
  const [range, setRange] = useState("all");
  const [view, setView] = useState("list");
  const [respFilter, setRespFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(null);

  const visible = useMemo(() => {
    let arr = [...(activities || [])].filter((a) => !a.deletedAt);
    if (respFilter !== "all") arr = arr.filter((a) => a.responsible === respFilter);
    if (dateFilter) arr = arr.filter((a) => a.dueDate?.slice(0, 10) === dateFilter);
    return arr;
  }, [activities, respFilter, dateFilter]);

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="font-semibold">Aktiviteter</h2>
        {dateFilter && (
          <button
            className="text-xs underline ml-2"
            onClick={() => setDateFilter(null)}
          >
            Visa alla dagar
          </button>
        )}
        <div className="flex gap-2">
          <div className="flex rounded-xl overflow-hidden border">
            {["all", "Mattias", "Cralle", "Övrig"].map((r) => (
              <button
                key={r}
                className={`px-3 py-2 ${
                  respFilter === r
                    ? "bg-black text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setRespFilter(r)}
              >
                {r === "all" ? "Alla" : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "list" && (
        <ul className="divide-y">
          {visible.map((a) => (
            <li key={a.id} className="py-3 cursor-pointer">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{a.title || "Aktivitet"}</div>
                  <div className="text-xs text-gray-500">
                    {formatDT(a.dueDate, a.dueTime)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      PRIORITIES.find((p) => p.key === a.priority)?.className
                    }`}
                  >
                    {a.priority}
                  </span>
                  <button
                    className={`text-xs font-semibold px-2 py-1 rounded border ${
                      a.responsible === "Mattias"
                        ? "border-purple-400 text-purple-700"
                        : a.responsible === "Cralle"
                        ? "border-blue-400 text-blue-700"
                        : "border-gray-300 text-gray-700"
                    }`}
                    onClick={() => setRespFilter(a.responsible)}
                  >
                    {a.responsible}
                  </button>
                  <div className="flex gap-1">
                    <button
                      className="text-xs px-2 py-1 rounded bg-green-500 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        const upd = {
                          ...a,
                          priority: "klar",
                          updatedAt: new Date().toISOString(),
                        };
                        setState((s) => ({
                          ...s,
                          activities: s.activities.map((x) =>
                            x.id === a.id ? upd : x
                          ),
                        }));
                      }}
                    >
                      Klar
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded bg-orange-400 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        const upd = {
                          ...a,
                          status: "återkoppling",
                          updatedAt: new Date().toISOString(),
                        };
                        setState((s) => ({
                          ...s,
                          activities: s.activities.map((x) =>
                            x.id === a.id ? upd : x
                          ),
                        }));
                      }}
                    >
                      Återkoppling
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded bg-rose-500 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        const upd = { ...a, deletedAt: new Date().toISOString() };
                        setState((s) => ({
                          ...s,
                          activities: s.activities.map((x) =>
                            x.id === a.id ? upd : x
                          ),
                        }));
                      }}
                    >
                      Ta bort
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
