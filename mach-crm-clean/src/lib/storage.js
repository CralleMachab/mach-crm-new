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
    settings: load(LS.settings, {
      // plats för framtida inställningar
    }),
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
// OBS! Kräver att index.html har:
// <script type="text/javascript" src="https://js.live.net/v7.2/OneDrive.js"></script>
// Samt att Netlify har env-variabeln VITE_ONEDRIVE_CLIENT_ID (Application (client) ID)
// och att Azure App Registration är Multi-tenant + SPA Redirect URI = din Netlify-URL.

export function pickFromOneDrive({ onPicked }) {
  const clientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID;

  // Debug – syns i webbläsarens Konsol (F12 → Console)
  console.log("DEBUG OneDrive:", {
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
    action: "share",            // ger delningsbar länk vi kan spara
    multiSelect: true,
    openInNewWindow: true,
    advanced: {
      // Måste matcha exakt i Azure → App registrations → Authentication → SPA Redirect URIs
      redirectUri: window.location.origin,
      // Scopes – kräver ofta admin consent om tenant är låst
      scopes: ["Files.ReadWrite", "offline_access", "User.Read"],
    },
    success: (result) => {
      try {
        const urls = (result?.value || [])
          .map(f => f.webUrl)
          .filter(Boolean);
        if (urls.length && onPicked) onPicked(urls);
      } catch (e) {
        console.error("parse success result failed", e, result);
      }
    },
    cancel: () => {
      console.log("OneDrive canceled");
    },
    error: (e) => {
      console.error("OneDrive error", e);
      alert("Kunde inte hämta från OneDrive – kontrollera behörigheter i Microsoft.");
    },
  };

  try {
    window.OneDrive.open(odOptions);
  } catch (e) {
    console.error("Picker launch failed", e);
    alert("Kunde inte öppna OneDrive-fönstret. Kontrollera popup-inställningar.");
  }
}
