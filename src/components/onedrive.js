// src/components/onedrive.js
// Robust OneDrive-picker som läser clientId från Vite-miljövariabeln VITE_ONEDRIVE_CLIENT_ID
// Användning i React: const picked = await pickOneDriveFiles();

export async function pickOneDriveFiles() {
  return new Promise((resolve, reject) => {
    try {
      const clientId = import.meta?.env?.VITE_ONEDRIVE_CLIENT_ID;
      if (!clientId) {
        alert("Saknar VITE_ONEDRIVE_CLIENT_ID. Sätt den i Netlify → Environment variables.");
        return reject(new Error("Missing VITE_ONEDRIVE_CLIENT_ID"));
      }
      if (typeof window === "undefined" || !window.OneDrive) {
        alert("OneDrive SDK ej laddad. Kontrollera index.html (<script src='https://js.live.net/v7.2/OneDrive.js'>).");
        return reject(new Error("OneDrive SDK not loaded"));
      }

      window.OneDrive.open({
        clientId,
        action: "share",
        multiSelect: true,
        openInNewWindow: true,
        advanced: {
          redirectUri: window.location.origin, // måste vara registrerad i Azure App (SPA)
        },
        success: (files) => {
          const out = (files?.value || []).map(f => ({
            id: f.id,
            name: f.name,
            webUrl: f.webUrl || f.links?.sharingLink?.webUrl || "",
            size: f.size,
            isFolder: !!f.folder,
          }));
          resolve(out);
        },
        cancel: () => resolve([]),
        error: (e) => {
          console.error("OneDrive Picker error", e);
          alert("Kunde inte hämta från OneDrive. Kontrollera behörigheter/redirect-URI eller försök igen.");
          reject(e);
        },
      });
    } catch (e) {
      reject(e);
    }
  });
}
