// src/components/onedrive.js
// Enklare OneDrive-filepicker med hårdkodat Client ID

// Ditt Application (client) ID från Azure:
const CLIENT_ID = "48bd814b-47b9-4310-8c9d-af61d450cedc";

export async function pickOneDriveFiles() {
  return new Promise((resolve, reject) => {
    try {
      // Kontrollera att OneDrive SDK är laddad
      if (typeof window === "undefined" || !window.OneDrive) {
        alert("OneDrive SDK är inte laddad. Kontrollera <script src='https://js.live.net/v7.2/OneDrive.js'> i index.html.");
        return reject(new Error("OneDrive SDK not loaded"));
      }

      if (!CLIENT_ID) {
        alert("Saknar CLIENT_ID i src/components/onedrive.js.");
        return reject(new Error("Missing CLIENT_ID"));
      }

      window.OneDrive.open({
        clientId: CLIENT_ID,
        action: "share",
        multiSelect: true,
        openInNewWindow: true,
        advanced: {
          // Måste matcha en redirect URI i din app-registrering (t.ex. Netlify-URLen)
          redirectUri: window.location.origin,
        },
        success: (files) => {
          const out = (files?.value || []).map((f) => ({
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
