// src/panels/SettingsPanel.jsx
import React, { useState, useMemo } from "react";

export default function SettingsPanel({
  entities = [],
  offers = [],
  projects = [],
  activities = [],
  setState
}) {
  const [csvText, setCsvText] = useState("");

  /* --------------------------
     IMPORTERA KONTAKTER (CSV)
     -------------------------- */
  function importContacts() {
    if (!csvText.trim()) return alert("Ingen CSV-data att importera.");

    const rows = csvText.split("\n").map(r => r.trim()).filter(Boolean);
    const header = rows.shift().split(",");

    const companyIdx = header.indexOf("Company");
    const phoneIdx = header.indexOf("Phone");
    const mailIdx = header.indexOf("Email");

    if (companyIdx < 0)
      return alert("CSV saknar fältet 'Company'. Exportera igen från Outlook.");

    const newContacts = rows.map((r) => {
      const cols = r.split(",");
      return {
        id: crypto.randomUUID(),
        type: "customer",
        companyName: cols[companyIdx] || "",
        phone: cols[phoneIdx] || "",
        email: cols[mailIdx] || "",
        createdAt: new Date().toISOString(),
      };
    });

    setState((s) => ({
      ...s,
      entities: [...(s.entities || []), ...newContacts],
    }));

    alert(`Import klar (${newContacts.length} kontakter).`);
    setCsvText("");
  }

  /* --------------------------
     EXPORTERA KONTAKTER
     -------------------------- */
  function exportContacts() {
    const customers = (entities || []).filter((e) => e.type === "customer");

    const header = "Company,Phone,Email\n";
    const body = customers
      .map((c) => `${c.companyName||""},${c.phone||""},${c.email||""}`)
      .join("\n");

    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "machcrm_kontakter.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  /* --------------------------
     ARKIV (flyttat hit)
     -------------------------- */
  const lostOffers   = useMemo(()=> (offers||[]).filter(o=>o.status==="förlorad" && !o.deletedAt), [offers]);
  const lostProjects = useMemo(()=> (projects||[]).filter(p=>p.status==="förlorad" && !p.deletedAt), [projects]);
  const deletedOffers  = useMemo(()=> (offers||[]).filter(o=>o.deletedAt), [offers]);
  const deletedProjects= useMemo(()=> (projects||[]).filter(p=>p.deletedAt), [projects]);
  const deletedActivities = useMemo(()=> (activities||[]).filter(a=>a.deletedAt), [activities]);

  function restoreActivity(id) {
    setState(s => ({
      ...s,
      activities: (s.activities||[]).map(a => 
        a.id === id ? {...a, deletedAt: undefined } : a)
    }));
  }
  function restoreOffer(id) {
    setState(s => ({
      ...s,
      offers: (s.offers||[]).map(o => 
        o.id === id ? {...o, deletedAt: undefined } : o)
    }));
  }
  function restoreProject(id) {
    setState(s => ({
      ...s,
      projects: (s.projects||[]).map(p => 
        p.id === id ? {...p, deletedAt: undefined } : p)
    }));
  }

  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-10">
      <h2 className="font-semibold text-lg">Inställningar</h2>

      {/* IMPORT */}
      <section>
        <h3 className="font-semibold mb-2">Importera kontakter (Outlook CSV)</h3>
        <textarea
          className="w-full border rounded p-2 h-40"
          placeholder="Klistra in CSV-data här..."
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
        <button
          className="mt-2 px-3 py-2 bg-blue-600 text-white rounded"
          onClick={importContacts}
        >
          Importera kontakter
        </button>
      </section>

      {/* EXPORT */}
      <section>
        <h3 className="font-semibold mb-2">Exportera kontakter</h3>
        <button
          className="px-3 py-2 bg-green-600 text-white rounded"
          onClick={exportContacts}
        >
          Ladda ner kontakter som CSV
        </button>
      </section>

      {/* ONEDRIVE INFO */}
      <section>
        <h3 className="font-semibold mb-2">OneDrive-inställningar</h3>
        <p className="text-sm text-gray-600">
          VITE_ONEDRIVE_CLIENT_ID hämtas automatiskt från Netlify.
        </p>
      </section>

      {/* ARKIV */}
      <section>
        <h3 className="font-semibold mb-3">Arkiv</h3>

        <div className="space-y-4">

          <div>
            <h4 className="font-medium">Arkiverade aktiviteter</h4>
            <ul className="text-sm list-disc pl-5">
              {deletedActivities.map((a) => (
                <li key={a.id}>
                  {a.title}
                  <button
                    className="ml-2 text-blue-600 underline"
                    onClick={() => restoreActivity(a.id)}
                  >
                    Återställ
                  </button>
                </li>
              ))}
              {deletedActivities.length === 0 && (
                <li className="text-gray-500">Inga arkiverade aktiviteter.</li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="font-medium">Förlorade offerter</h4>
            <ul className="text-sm list-disc pl-5">
              {lostOffers.map((o) => (
                <li key={o.id}>{o.title}</li>
              ))}
              {lostOffers.length === 0 && (
                <li className="text-gray-500">Inga förlorade offerter.</li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="font-medium">Borttagna offerter</h4>
            <ul className="text-sm list-disc pl-5">
              {deletedOffers.map((o) => (
                <li key={o.id}>
                  {o.title}
                  <button
                    className="ml-2 text-blue-600 underline"
                    onClick={() => restoreOffer(o.id)}
                  >
                    Återställ
                  </button>
                </li>
              ))}
              {deletedOffers.length === 0 && (
                <li className="text-gray-500">Inga borttagna offerter.</li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="font-medium">Borttagna projekt</h4>
            <ul className="text-sm list-disc pl-5">
              {deletedProjects.map((p) => (
                <li key={p.id}>
                  {p.name}
                  <button
                    className="ml-2 text-blue-600 underline"
                    onClick={() => restoreProject(p.id)}
                  >
                    Återställ
                  </button>
                </li>
              ))}
              {deletedProjects.length === 0 && (
                <li className="text-gray-500">Inga borttagna projekt.</li>
              )}
            </ul>
          </div>

        </div>
      </section>
    </div>
  );
}
