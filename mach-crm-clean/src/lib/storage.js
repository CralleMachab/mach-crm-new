// --- LocalStorage helpers -----------------------------------------------
export const LS = {
  customers: "crm.customers",
  suppliers: "crm.suppliers",
  offers: "crm.offers",
  projects: "crm.projects",
  activities: "crm.activities",
  settings: "crm.settings",
};

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("save() failed", key, e);
  }
}

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error("load() failed", key, e);
    return fallback;
  }
}

export function loadAll() {
  return {
    customers: load(LS.customers, []),
    suppliers: load(LS.suppliers, []),
    offers: load(LS.offers, []),
    projects: load(LS.projects, []),
    activities: load(LS.activities, []),
    settings: load(LS.settings, {}),
  };
}

export function resetKey(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error("resetKey() failed", key, e);
  }
}

// --- Import / Export (frivilligt att använda nu) ------------------------
export function exportJSON() {
  const data = loadAll();
  return JSON.stringify(data, null, 2);
}

export function importJSON(jsonString) {
  const data = JSON.parse(jsonString);
  if (data.customers) save(LS.customers, data.customers);
  if (data.suppliers) save(LS.suppliers, data.suppliers);
  if (data.offers) save(LS.offers, data.offers);
  if (data.projects) save(LS.projects, data.projects);
  if (data.activities) save(LS.activities, data.activities);
  if (data.settings) save(LS.settings, data.settings);
  return loadAll();
}

// --- OneDrive File Picker -----------------------------------------------
// Kräver i index.html:
// <script type="text/javascript" src="https://js.live.net/v7.2/OneDrive.js"></script>
// Kräver i Netlify env: VITE_ONEDRIVE_CLIENT_ID (Application/Client ID)
// Azure-appen ska vara Multi-tenant och ha SPA-redirect till exakt din Netlify-URL.

export function pickFromOneDrive({ onPicked }) {
  const clientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID;

  // Tydlig debug – syns alltid i Console
  console.log("DEBUG OneDrive start", {
    clientId,
    origin: window.location.origin,
    hasOneDrive: !!window.OneDrive,
  });

  if (!window.OneDrive || !clientId) {
    alert("OneDrive Picker saknas eller VITE_ONEDRIVE_CLIENT_ID är inte satt.");
    return;
  }

  const odOptions = {
    clientId,
    // Viktigt: använd "query" i stället för "share" för att undvika delningspolicy-problem.
    action: "query",
    multiSelect: true,
    openInNewWindow: true,
    advanced: {
      // Måste finnas som SPA-redirect i Azure → Authentication
      redirectUri: window.location.origin,
      // Minimala scopes (räcker för att läsa och hämta webUrl)
      scopes: ["Files.Read", "User.Read"],
      // Filtrera om du vill: filter: "folder,.pdf,.xlsx,.xls,.docx,.pptx,.dwg"
    },
    success: (result) => {
      try {
        console.log("DEBUG OneDrive success raw", result);
        const urls = (result?.value || [])
          .map(f => f.webUrl)
          .filter(Boolean);
        console.log("DEBUG OneDrive urls", urls);
        if (urls.length && onPicked) onPicked(urls);
      } catch (e) {
        console.error("parse success result failed", e, result);
        alert("Kunde inte tolka svar från OneDrive.");
      }
    },
    cancel: () => {
      console.log("OneDrive canceled");
    },
    error: (e) => {
      // Visa så mycket info som möjligt
      try {
        console.error("OneDrive error (full)", e);
        if (e && e.message) {
          alert("OneDrive-fel: " + e.message);
        } else {
          alert("Kunde inte hämta från OneDrive – kontrollera behörigheter i Microsoft.");
        }
      } catch (_) {
        alert("Kunde inte hämta från OneDrive – kontrollera behörigheter i Microsoft.");
      }
    },
  };

  try {
    window.OneDrive.open(odOptions);
  } catch (e) {
    console.error("Picker launch failed", e);
    alert("Kunde inte öppna OneDrive-fönstret (popup/cookies/policy?).");
  }
}
