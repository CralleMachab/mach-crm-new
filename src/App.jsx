// src/App.jsx
import React from "react";

// ✅ Ditt Entra Application (client) ID — MED citattecken
const ONEDRIVE_CLIENT_ID = "48bd814b-47b9-4310-8c9d-af61d450cedc";

export default function App() {
  function openOneDrive() {
    if (!window.OneDrive) {
      alert("❌ OneDrive SDK laddades inte. Kontrollera att index.html har raden med js.live.net/v7.2/OneDrive.js");
      return;
    }
    window.OneDrive.open({
      clientId: ONEDRIVE_CLIENT_ID,
      action: "share",
      multiSelect: true,
      openInNewWindow: true,
      advanced: { redirectUri: window.location.origin },
      success: (files) => alert("✅ Väljaren fungerade! Antal filer: " + (files?.value?.length || 0)),
      cancel: () => {},
      error: (e) => alert("❌ Fel i OneDrive Picker: " + (e?.message || e)),
    });
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6 text-center bg-slate-100">
      <h1 className="text-2xl font-bold">Mach CRM – OneDrive-test</h1>
      <p className="text-gray-600">
        Klicka på knappen för att testa om OneDrive-popupen öppnas korrekt.
      </p>
      <button
        onClick={openOneDrive}
        className="bg-black text-white px-6 py-3 rounded-xl text-lg hover:bg-gray-800"
      >
        Testa OneDrive-anslutning
      </button>
    </div>
  );
}
