// src/App.jsx
import React from "react";

export default function App() {
  const hasOneDrive = typeof window !== "undefined" && !!window.OneDrive;
  return (
    <div style={{minHeight:"100vh",display:"grid",placeItems:"center",fontFamily:"system-ui"}}>
      <div style={{textAlign:"center"}}>
        <h1 style={{fontSize:"24px",marginBottom:"8px"}}>✅ Render-test</h1>
        <p>Om du ser denna text fungerar React-renderingen.</p>
        <p style={{marginTop:"12px"}}>OneDrive SDK laddad: <b>{String(hasOneDrive)}</b></p>
      </div>
    </div>
  );
}
