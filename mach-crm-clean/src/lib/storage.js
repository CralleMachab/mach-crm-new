export function pickFromOneDrive({ onPicked }) {
  const clientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID;
  if (!window.OneDrive || !clientId) {
    alert("OneDrive Picker saknas eller VITE_ONEDRIVE_CLIENT_ID är inte satt.");
    return;
  }

  const odOptions = {
    clientId,
    action: "share",
    multiSelect: true,
    openInNewWindow: true,
    advanced: {
      redirectUri: window.location.origin,
      scopes: ["Files.ReadWrite", "offline_access", "User.Read"]
    },
    success: (result) => {
      const urls = result.value.map(f => f.webUrl);
      if (onPicked) onPicked(urls);
    },
    cancel: () => console.log("OneDrive canceled"),
    error: (e) => {
      console.error("OneDrive error", e);
      alert("Kunde inte hämta från OneDrive – kontrollera behörigheter i Microsoft.");
    }
  };

  try {
    window.OneDrive.open(odOptions);
  } catch (e) {
    console.error("Picker launch failed", e);
  }
}
