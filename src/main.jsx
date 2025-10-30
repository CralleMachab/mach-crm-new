// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

console.log("✅ main.jsx laddades");
const root = document.getElementById("root");
console.log("✅ root hittad:", !!root);

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
