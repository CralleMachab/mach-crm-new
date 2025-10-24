import React from 'react'
import { LS, load, save, defaultSettings, nextOfferNo } from './lib/storage.js'

export default function App() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold">Mach CRM – Starter</h1>
      <p className="mt-2 text-slate-600">Vite + Netlify redo. Säg till så lägger jag in full funktion (Aktivitet, Offert, Projekt, Kunder, Leverantörer, Inställningar).</p>
    </div>
  )
}
