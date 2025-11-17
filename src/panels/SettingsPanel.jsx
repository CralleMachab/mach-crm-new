import React, { useMemo, useState } from "react";

const newId = () =>
  crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

// Enkel CSV-parser (komma eller semikolon, basic)
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const first = lines[0];
  const delimiter = first.includes(";") ? ";" : ",";
  const headers = first
    .split(delimiter)
    .map((h) => h.trim().replace(/^"|"$/g, ""));

  return lines.slice(1).map((line) => {
    const cols = line
      .split(delimiter)
      .map((c) => c.trim().replace(/^"|"$/g, ""));
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] || "";
    });
    return row;
  });
}

// Skapar CSV-text från array av objekt
function toCsv(rows, headers) {
  const escape = (val) => {
    if (val == null) return "";
    const s = String(val);
    if (s.includes('"') || s.includes(";") || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const delimiter = ";"; // funkar bra i svenskt Excel
  const headerLine = headers.map((h) => escape(h)).join(delimiter);
  const dataLines = rows.map((row) =>
    headers.map((h) => escape(row[h] ?? "")).join(delimiter)
  );
  return [headerLine, ...dataLines].join("\r\n");
}

// Laddar ner en fil i browsern
function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SettingsPanel({
  entities = [],
  offers = [],
  projects = [],
  activities = [],
  setState,
}) {
  const [importType, setImportType] = useState("customer"); // "customer" | "supplier"
  const [importInfo, setImportInfo] = useState("");

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

  // ----- Arkiv helpers -----
  const restoreEntity = (id) => {
    setState((s) => ({
      ...s,
      entities: (s.entities || []).map((e) =>
        e.id === id ? { ...e, deletedAt: undefined } : e
      ),
    }));
  };
  const deleteEntityForever = (id) => {
    if (
      !window.confirm(
        "Ta bort denna kontakt PERMANENT? Detta går inte att ångra."
      )
    )
      return;
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
    if (
      !window.confirm(
        "Ta bort denna aktivitet PERMANENT? Detta går inte att ångra."
      )
    )
      return;
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
    if (!window.confirm("Ta bort denna offert PERMANENT? Detta går inte att ångra."))
      return;
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
    if (!window.confirm("Ta bort detta projekt PERMANENT? Detta går inte att ångra."))
      return;
    setState((s) => ({
      ...s,
      projects: (s.projects || []).filter((p) => p.id !== id),
    }));
  };

  // ----- IMPORT av kontakter (Outlook CSV) -----
  const handleCsvFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target?.result || "");
      const rows = parseCsv(text);
      if (!rows.length) {
        setImportInfo("Kunde inte läsa några rader från CSV-filen.");
        return;
      }

      let created = 0;
      const now = new Date().toISOString();

      const newEntities = rows
        .map((row) => {
          // Försök hitta företagsnamn / namn
          const companyName =
            row["Company"] ||
            row["Company Name"] ||
            row["CompanyName"] ||
            row["Företag"] ||
            row["Full Name"] ||
            row["Namn"] ||
            "";
          if (!companyName) return null;

          const phone =
            row["Business Phone"] ||
            row["Home Phone"] ||
            row["Telephone"] ||
            row["Telefon"] ||
            "";
          const email =
            row["E-mail Address"] || row["Email"] || row["E-post"] || "";
          const address =
            row["Business Street"] || row["Street"] || row["Adress"] || "";
          const zip =
            row["Business Postal Code"] ||
            row["Postal Code"] ||
            row["Postnr"] ||
            "";
          const city =
            row["Business City"] || row["City"] || row["Ort"] || "";

          const entType = importType === "supplier" ? "supplier" : "customer";

          created += 1;
          return {
            id: newId(),
            type: entType,
            companyName,
            phone,
            email,
            address,
            zip,
            city,
            createdAt: now,
          };
        })
        .filter(Boolean);

      if (!newEntities.length) {
        setImportInfo(
          "CSV-läste ok, men hittade inga rader med företagsnamn. Kontrollera filen."
        );
        return;
      }

      setState((s) => ({
        ...s,
        entities: [...(s.entities || []), ...newEntities],
      }));
      setImportInfo(
        `Import klar: ${created} kontakter skapades som ${
          importType === "supplier" ? "leverantörer" : "kunder"
        }.`
      );
      e.target.value = "";
    };
    reader.onerror = () => {
      setImportInfo("Kunde inte läsa CSV-filen (FileReader-fel).");
    };
    reader.readAsText(file, "utf-8");
  };

  // ----- EXPORT till CSV (Excel) -----
  const exportCustomers = () => {
    const customers = (entities || []).filter((e) => e.type === "customer");
    const headers = [
      "id",
      "companyName",
      "orgNo",
      "phone",
      "email",
      "address",
      "zip",
      "city",
      "customerCategory",
      "createdAt",
      "updatedAt",
    ];
    const rows = customers.map((c) => ({
      id: c.id,
      companyName: c.companyName || "",
      orgNo: c.orgNo || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      zip: c.zip || "",
      city: c.city || "",
      customerCategory: c.customerCategory || "",
      createdAt: c.createdAt || "",
      updatedAt: c.updatedAt || "",
    }));
    downloadTextFile("kunder.csv", toCsv(rows, headers));
  };

  const exportSuppliers = () => {
    const suppliers = (entities || []).filter((e) => e.type === "supplier");
    const headers = [
      "id",
      "companyName",
      "orgNo",
      "phone",
      "email",
      "address",
      "zip",
      "city",
      "supplierCategory",
      "createdAt",
      "updatedAt",
    ];
    const rows = suppliers.map((s) => ({
      id: s.id,
      companyName: s.companyName || "",
      orgNo: s.orgNo || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      zip: s.zip || "",
      city: s.city || "",
      supplierCategory: s.supplierCategory || "",
      createdAt: s.createdAt || "",
      updatedAt: s.updatedAt || "",
    }));
    downloadTextFile("leverantorer.csv", toCsv(rows, headers));
  };

  const exportActivities = () => {
    const headers = [
      "id",
      "title",
      "responsible",
      "priority",
      "status",
      "dueDate",
      "dueTime",
      "description",
      "customerId",
      "supplierId",
      "contactName",
      "isPhone",
      "isEmail",
      "isLunch",
      "isMeeting",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ];
    const rows = (activities || []).map((a) => ({
      id: a.id,
      title: a.title || "",
      responsible: a.responsible || "",
      priority: a.priority || "",
      status: a.status || "",
      dueDate: a.dueDate || "",
      dueTime: a.dueTime || "",
      description: a.description || "",
      customerId: a.customerId || "",
      supplierId: a.supplierId || "",
      contactName: a.contactName || "",
      isPhone: a.isPhone ? "1" : "",
      isEmail: a.isEmail ? "1" : "",
      isLunch: a.isLunch ? "1" : "",
      isMeeting: a.isMeeting ? "1" : "",
      createdAt: a.createdAt || "",
      updatedAt: a.updatedAt || "",
      deletedAt: a.deletedAt || "",
    }));
    downloadTextFile("aktiviteter.csv", toCsv(rows, headers));
  };

  const exportOffers = () => {
    const headers = [
      "id",
      "title",
      "customerId",
      "value",
      "status",
      "note",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ];
    const rows = (offers || []).map((o) => ({
      id: o.id,
      title: o.title || "",
      customerId: o.customerId || "",
      value: o.value ?? "",
      status: o.status || "",
      note: o.note || "",
      createdAt: o.createdAt || "",
      updatedAt: o.updatedAt || "",
      deletedAt: o.deletedAt || "",
    }));
    downloadTextFile("offerter.csv", toCsv(rows, headers));
  };

  const exportProjects = () => {
    const headers = [
      "id",
      "name",
      "customerId",
      "status",
      "budget",
      "startDate",
      "endDate",
      "note",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ];
    const rows = (projects || []).map((p) => ({
      id: p.id,
      name: p.name || "",
      customerId: p.customerId || "",
      status: p.status || "",
      budget: p.budget ?? "",
      startDate: p.startDate || "",
      endDate: p.endDate || "",
      note: p.note || "",
      createdAt: p.createdAt || "",
      updatedAt: p.updatedAt || "",
      deletedAt: p.deletedAt || "",
    }));
    downloadTextFile("projekt.csv", toCsv(rows, headers));
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-6">
      <header>
        <h2 className="text-lg font-semibold mb-1">Inställningar</h2>
        <p className="text-sm text-gray-600">
          Här kan du hantera arkiverade poster, importera kontakter från Outlook och
          exportera data till Excel-kompatibla CSV-filer.
        </p>
      </header>

      {/* ARKIV-HANTERING */}
      <section>
        <h3 className="font-semibold mb-2">Arkiv – återställ eller ta bort permanent</h3>
        <p className="text-sm text-gray-600 mb-3">
          När du trycker <strong>Ta bort</strong> inne i respektive vy hamnar poster här som
          arkiverade. Här kan du antingen <strong>Återställ</strong> eller{" "}
          <strong>Ta bort permanent</strong>.
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
                    <div className="truncate">
                      {s.companyName || "(namnlös leverantör)"}
                    </div>
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

      {/* IMPORT */}
      <section>
        <h3 className="font-semibold mb-2">Importera kontakter (Outlook CSV)</h3>
        <p className="text-sm text-gray-600 mb-3">
          1. I Outlook: exportera kontakter till CSV (standard-export).
          <br />
          2. Välj om de ska in som <strong>kunder</strong> eller{" "}
          <strong>leverantörer</strong>.
          <br />
          3. Ladda upp CSV här – vi läser företagsnamn, telefon, e-post, adress m.m.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-2">
          <label className="flex items-center gap-2 text-sm">
            <span>Importera som:</span>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={importType}
              onChange={(e) => setImportType(e.target.value)}
            >
              <option value="customer">Kunder</option>
              <option value="supplier">Leverantörer</option>
            </select>
          </label>

          <input
            type="file"
            accept=".csv,text/csv"
            className="text-sm"
            onChange={handleCsvFileChange}
          />
        </div>

        {importInfo && (
          <div className="text-xs text-gray-700 bg-gray-50 border rounded px-2 py-1 inline-block">
            {importInfo}
          </div>
        )}

        <p className="text-xs text-gray-500 mt-2">
          Tips: Om du bara vill importera vissa kontakter kan du i Outlook först
          markera de kontakterna och göra export från just den vyn/listan, så blir
          CSV-filen redan filtrerad.
        </p>
      </section>

      {/* EXPORT */}
      <section>
        <h3 className="font-semibold mb-2">Exportera data (CSV för Excel)</h3>
        <p className="text-sm text-gray-600 mb-3">
          Skapar CSV-filer som kan öppnas direkt i Excel. Bra för backup,
          rapportering eller vidare analys.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <button
            className="border rounded-xl px-3 py-2 hover:bg-gray-50 text-left"
            type="button"
            onClick={exportCustomers}
          >
            <div className="font-semibold">Exportera kunder</div>
            <div className="text-xs text-gray-500">
              Alla kunder till <code>kunder.csv</code>
            </div>
          </button>

          <button
            className="border rounded-xl px-3 py-2 hover:bg-gray-50 text-left"
            type="button"
            onClick={exportSuppliers}
          >
            <div className="font-semibold">Exportera leverantörer</div>
            <div className="text-xs text-gray-500">
              Alla leverantörer till <code>leverantorer.csv</code>
            </div>
          </button>

          <button
            className="border rounded-xl px-3 py-2 hover:bg-gray-50 text-left"
            type="button"
            onClick={exportActivities}
          >
            <div className="font-semibold">Exportera aktiviteter</div>
            <div className="text-xs text-gray-500">
              Alla aktiviteter till <code>aktiviteter.csv</code>
            </div>
          </button>

          <button
            className="border rounded-xl px-3 py-2 hover:bg-gray-50 text-left"
            type="button"
            onClick={exportOffers}
          >
            <div className="font-semibold">Exportera offerter</div>
            <div className="text-xs text-gray-500">
              Alla offerter till <code>offerter.csv</code>
            </div>
          </button>

          <button
            className="border rounded-xl px-3 py-2 hover:bg-gray-50 text-left"
            type="button"
            onClick={exportProjects}
          >
            <div className="font-semibold">Exportera projekt</div>
            <div className="text-xs text-gray-500">
              Alla projekt till <code>projekt.csv</code>
            </div>
          </button>
        </div>
      </section>

      {/* ONEDRIVE INFO */}
      <section>
        <h3 className="font-semibold mb-2">OneDrive / SharePoint</h3>
        <p className="text-sm text-gray-600">
          Systemet sparar redan data mot SharePoint/OneDrive via den
          backend-konfiguration du har (t.ex. via{" "}
          <code>VITE_ONEDRIVE_CLIENT_ID</code> i Netlify). Här kan vi i framtiden lägga
          inställningar för:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-600 mt-2">
          <li>Byta SharePoint-site / bibliotek</li>
          <li>Visa status på senaste synk</li>
          <li>Manuella knappar för "Synka nu" / "Exportera backup"</li>
        </ul>
      </section>
    </div>
  );
}
