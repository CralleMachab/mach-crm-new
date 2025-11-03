// src/components/onedrive.js
// Gemensam OneDrive-picker

export function pickOneDriveFiles({ clientId, onSuccess, onError }) {
  if (typeof window === "undefined" || !window.OneDrive) {
    onError?.(new Error("OneDrive SDK ej laddad. Kontrollera index.html-skriptet."));
    alert("OneDrive SDK ej laddad. Kontrollera index.html (<script src='https://js.live.net/v7.2/OneDrive.js'>).");
    return;
  }
  if (!clientId) {
    alert("Saknar Application (client) ID för OneDrive.");
    return;
  }

  window.OneDrive.open({
    clientId,
    action: "share",
    multiSelect: true,
    openInNewWindow: true,
    advanced: { redirectUri: window.location.origin },
    success: (files) => {
      const out = (files?.value || []).map(f => ({
        id: f.id,
        name: f.name,
        link: f.links?.sharingLink?.webUrl || f.webUrl,
        webUrl: f.webUrl,
        size: f.size,
        isFolder: !!f.folder,
      }));
      onSuccess?.(out);
    },
    cancel: () => {},
    error: (e) => {
      console.error("OneDrive Picker error", e);
      alert("Kunde inte hämta från OneDrive. Kontrollera behörigheter eller försök igen.");
      onError?.(e);
    },
  });
}
