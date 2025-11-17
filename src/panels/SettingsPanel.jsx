import React, { useMemo } from "react";

export default function SettingsPanel({
  entities = [],
  offers = [],
  projects = [],
  activities = [],
  setState,
}) {
  const archivedCustomers = useMemo(
    () => (entities || []).filter((e) => e.type === "customer" && e.deletedAt),
    [entities]
  );
  const archivedSuppliers = useMemo(
    () => (entities || []).filter((e) => e.type === "supplier" && e.deletedAt),
    [entities]
  );
  const archivedActivities = useMemo(
    () => (activities || []).filter((a) => a.deletedAt),
    [activities]
  );
  const archivedOffers = useMemo(
    () => (offers || []).filter((o) => o.deletedAt),
    [offers]
  );
  const archivedProjects = useMemo(
    () => (projects || []).filter((p) => p.deletedAt),
    [projects]
  );

  // ----- helpers för återställning / permanent borttagning -----
  const restoreEntity = (id) => {
    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === id ? { ...e, deletedAt: undefined } : e
      ),
    }));
  };
  const deleteEntityForever = (id) => {
    if (!window.confirm("Ta bort denna kontakt PERMANENT? Detta går inte att ångra.")) return;
    setState((s) => ({
      ...s,
      entities: (s.entities || []).filter((e) => e.id !== id),
    }));
  };

  const restoreActivity = (id) => {
    setState((s) => ({
      ...s,
      activities: (s.activities || []).map((a) =>
        a.id === id ? { ...a, deletedAt: undefined } : a
      ),
    }));
  };
  const deleteActivityForever = (id) => {
    if (!window.confirm("Ta bort denna aktivitet PERMANENT? Detta går inte att ångra.")) return;
    setState((s) => ({
      ...s,
      activities: (s.activities || []).filter((a) => a.id !== id),
    }));
  };

  const restoreOffer = (id) => {
    setState((s) => ({
      ...s,
      offers: (s.offers || []).map((o) =>
        o.id === id ? { ...o, deletedAt: undefined } : o
      ),
    }));
  };
  const deleteOfferForever = (id) => {
    if (!window.confirm("Ta bort denna offert PERMANENT? Detta går inte att ångra.")) return;
    setState((s) => ({
      ...s,
      offers: (s.offers || []).filter((o) => o.id !== id),
    }));
  };

  const restoreProject = (id) => {
    setState((s) => ({
      ...s,
      projects: (s.projects || []).map((p) =>
        p.id === id ? { ...p, deletedAt: undefined } : p
      ),
    }));
  };
  const deleteProjectForever = (id) => {
    if (!window.confirm("Ta bort detta projekt PERMANENT? Detta går inte att ångra.")) return;
    setState((s) => ({
      ...s,
      projects: (s.projects || []).filter((p) => p.id !== id),
    }));
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-6">
      <header>
        <h2 className="text-lg font-semibold mb-1">Inställningar</h2>
        <p className="text-sm text-gray-600">
          Här kan du hantera arkiverade poster, import/export (senare), och andra
          systeminställningar.
        </p>
      </header>

      {/* ARKIV-HANTERING */}
      <section>
        <h3 className="font-semibold mb-2">Arkiv – återställ eller ta bort permanent</h3>
        <p className="text-sm text-gray-600 mb-3">
          När du trycker <strong>Ta bort</strong> inne i respektive vy (kunder, leverantörer,
          aktiviteter, offerter, projekt) hamnar poster här som arkiverade.
          Här kan du antingen <strong>Återställ</strong> eller <strong>Ta bort permanent</strong>.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Arkiverade kunder */}
          <div className="border rounded-xl p-3">
            <h4 className="font-semibold mb-2">Arkiverade kunder</h4>
            <ul className="space-y-1 max-h-52 overflow-auto text-sm">
              {archivedCustomers.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 border-b last:border-b-0 py-1"
                >
                  <div className="min-w-0">
                    <div className="truncate">{c.companyName || "(namnlös kund)"}</div>
                    <div className="text-xs text-gray-500">{c.city || ""}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      className="text-xs px-2 py-1 rounded bg-green-600 text-white"
                      onClick={() => restoreEntity(c.id)}
                      type="button"
                    >
                      Återställ
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded bg-rose-700 text-white"
                      onClick={() => deleteEntityForever(c.id)}
                      type="button"
                    >
                      Ta bort permanent
                    </button>
                  </div>
                </li>
              ))}
              {archivedCustomers.length === 0 && (
                <li className="text-xs text-gray-500">Inga arkiverade kunder.</li>
              )}
            </ul>
          </div>

          {/* Arkiverade leverantörer */}
          <div className="border rounded-xl p-3">
            <h4 className="font-semibold mb-2">Arkiverade leverantörer</h4>
            <ul className="space-y-1 max-h-52 overflow-auto text-sm">
              {archivedSuppliers.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 border-b last:border-b-0 py-1"
                >
                  <div className="min-w-0">
                    <div className="truncate">{s.companyName || "(namnlös leverantör)"}</div>
                    <div className="text-xs text-gray-500">{s.city || ""}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      className="text-xs px-2 py-1 rounded bg-green-600 text-white"
                      onClick={() => restoreEntity(s.id)}
                      type="button"
                    >
                      Återställ
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded bg-rose-700 text-white"
                      onClick={() => deleteEntityForever(s.id)}
                      type="button"
                    >
                      Ta bort permanent
                    </button>
                  </div>
                </li>
              ))}
              {archivedSuppliers.length === 0 && (
                <li className="text-xs text-gray-500">Inga arkiverade leverantörer.</li>
              )}
            </ul>
          </div>

          {/* Arkiverade aktiviteter */}
          <div className="border rounded-xl p-3">
            <h4 className="font-semibold mb-2">Arkiverade aktiviteter</h4>
            <ul className="space-y-1 max-h-52 overflow-auto text-sm">
              {archivedActivities.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 border-b last:border-b-0 py-1"
                >
                  <div className="min-w-0">
                    <div className="truncate">{a.title || "Aktivitet"}</div>
                    <div className="text-xs text-gray-500">
                      {a.dueDate || a.createdAt?.slice(0, 10) || ""}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      className="text-xs px-2 py-1 rounded bg-green-600 text-white"
                      onClick={() => restoreActivity(a.id)}
                      type="button"
                    >
                      Återställ
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded bg-rose-700 text-white"
                      onClick={() => deleteActivityForever(a.id)}
                      type="button"
                    >
                      Ta bort permanent
                    </button>
                  </div>
                </li>
              ))}
              {archivedActivities.length === 0 && (
                <li className="text-xs text-gray-500">Inga arkiverade aktiviteter.</li>
              )}
            </ul>
          </div>

          {/* Arkiverade offerter */}
          <div className="border rounded-xl p-3">
            <h4 className="font-semibold mb-2">Arkiverade offerter</h4>
            <ul className="space-y-1 max-h-52 overflow-auto text-sm">
              {archivedOffers.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-2 border-b last:border-b-0 py-1"
                >
                  <div className="min-w-0">
                    <div className="truncate">{o.title || "(namnlös offert)"}</div>
                    <div className="text-xs text-gray-500">{o.status || ""}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      className="text-xs px-2 py-1 rounded bg-green-600 text-white"
                      onClick={() => restoreOffer(o.id)}
                      type="button"
                    >
                      Återställ
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded bg-rose-700 text-white"
                      onClick={() => deleteOfferForever(o.id)}
                      type="button"
                    >
                      Ta bort permanent
                    </button>
                  </div>
                </li>
              ))}
              {archivedOffers.length === 0 && (
                <li className="text-xs text-gray-500">Inga arkiverade offerter.</li>
              )}
            </ul>
          </div>

          {/* Arkiverade projekt */}
          <div className="border rounded-xl p-3">
            <h4 className="font-semibold mb-2">Arkiverade projekt</h4>
            <ul className="space-y-1 max-h-52 overflow-auto text-sm">
              {archivedProjects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 border-b last:border-b-0 py-1"
                >
                  <div className="min-w-0">
                    <div className="truncate">{p.name || "(namnlöst projekt)"}</div>
                    <div className="text-xs text-gray-500">{p.status || ""}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      className="text-xs px-2 py-1 rounded bg-green-600 text-white"
                      onClick={() => restoreProject(p.id)}
                      type="button"
                    >
                      Återställ
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded bg-rose-700 text-white"
                      onClick={() => deleteProjectForever(p.id)}
                      type="button"
                    >
                      Ta bort permanent
                    </button>
                  </div>
                </li>
              ))}
              {archivedProjects.length === 0 && (
                <li className="text-xs text-gray-500">Inga arkiverade projekt.</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Placeholder för import/export */}
      <section>
        <h3 className="font-semibold mb-2">Import / Export (kommande steg)</h3>
        <p className="text-sm text-gray-600">
          Här kan vi senare lägga:
          <br />– Import av kontakter från Outlook (CSV)
          <br />– Export av data till Excel
          <br />– OneDrive-konfiguration mm.
        </p>
      </section>
    </div>
  );
}
