// src/components/onedrive.js
// Identisk OneDrive-picker som i Offerter, utdragen till en gemensam helper.

export function pickOneDriveFiles({ clientId, onSuccess, onError }) {
  if (!window.OneDrive) {
    alert("OneDrive SDK ej laddad (kontrollera <script src='https://js.live.net/v7.2/OneDrive.js'> i index.html).");
    return;
  }
  if (!clientId) {
    alert("Saknar Application (client) ID för OneDrive.");
    return;
  }

  const opts = {
    clientId,
    action: "share",
    multiSelect: true,
    openInNewWindow: true,
    advanced: { redirectUri: window.location.origin },
    success: (files) => {
      const normalized = (files?.value || []).map((f) => ({
        id: f.id,
        name: f.name,
        link: f.links?.sharingLink?.webUrl || f.webUrl,
        webUrl: f.webUrl,
        size: f.size,
        isFolder: !!f.folder
      }));
      onSuccess?.(normalized);
    },
    cancel: () => {},
    error: (e) => {
      console.error("OneDrive Picker error", e);
      onError?.(e);
      alert("Kunde inte hämta från OneDrive. Kontrollera behörigheter eller försök igen.");
    }
  };

  window.OneDrive.open(opts);
}
