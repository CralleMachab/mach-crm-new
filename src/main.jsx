// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML = "<pre>❌ Kunde inte hitta #root i index.html</pre>";
} else {
  const root = createRoot(rootEl);
  root.render(<App />);
}
