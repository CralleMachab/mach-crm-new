export const LS = {
  customers: 'machcrm.customers',
  suppliers: 'machcrm.suppliers',
  offers: 'machcrm.offers',
  projects: 'machcrm.projects',
  activities: 'machcrm.activities',
  lostOffers: 'machcrm.offers.lost',
  offerCounter: 'machcrm.offer.counter',
  settings: 'machcrm.settings'
};
export const load = (k, fallback) => { try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fallback; } catch(e) { return fallback; } };
export const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
export const defaultSettings = { companyName:'Mach Entreprenad AB', owners:['Cralle','Mattias','Övrig'], supplierTypes:['Stålhalls leverantör','Mark företag','EL leverantör','VVS Leverantör','Vent Leverantör'], customerLabels:['Entreprenad','Turbovex','Övrigt'], customerStatus:['Aktiv','Potentiell','Framtida'], offerStart:310050, logoDataUrl:'' };
export const nextOfferNo = () => { const settings = load(LS.settings, defaultSettings); const start = Number(settings.offerStart || 310050); const current = Number(localStorage.getItem(LS.offerCounter) || start - 1); const next = current + 1; localStorage.setItem(LS.offerCounter, String(next)); return next; };
