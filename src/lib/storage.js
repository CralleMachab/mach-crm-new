// lib/storage.js
const STORAGE_KEY = "machcrm_data_v3";

function iso(d = new Date()) { return new Date(d).toISOString(); }
function isoInDays(delta) { const d = new Date(); d.setDate(d.getDate()+delta); d.setHours(9,0,0,0); return d.toISOString(); }
const uuid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

function demoSeed() {
  const custId = uuid();
  const suppId = uuid();
  const offerId = uuid();
  return {
    entities: [
      {
        id: custId, type: "customer",
        companyName: "Exempel AB", orgNo: "556000-0000",
        phone: "+46 8 123 45 67", email: "info@exempel.se",
        address: "Storgatan 1, 111 11 Stockholm", notes: "Viktig kund.",
        contacts: [
          { id: uuid(), name: "Anna Andersson", role: "Inköp", phone: "+46 70 111 22 33", email: "anna@exempel.se" },
          { id: uuid(), name: "Per Persson", role: "Ekonomi", phone: "", email: "per@exempel.se" }
        ],
        activeContactId: null,
        reminders: [{ id: uuid(), type: "Samtal", subject: "Följ upp offert", dueDate: isoInDays(0), done: false }],
        createdAt: iso(), updatedAt: iso()
      },
      {
        id: suppId, type: "supplier",
        companyName: "Leveranta AB", orgNo: "556111-1111",
        phone: "+46 31 987 65 43", email: "kontakt@leveranta.se",
        address: "Kvarnvägen 5, 411 11 Göteborg", notes: "Bra priser.",
        contacts: [{ id: uuid(), name: "Sara Svensson", role: "Sälj", phone: "", email: "sara@leveranta.se" }],
        activeContactId: null,
        reminders: [{ id: uuid(), type: "Samtal", subject: "Förhandla frakt", dueDate: isoInDays(-2), done: false }],
        createdAt: iso(), updatedAt: iso()
      }
    ],
    offers: [
      { id: offerId, customerId: custId, title: "Offert 2025-01", files: [], createdAt: iso(), updatedAt: iso() }
    ],
    projects: []
  };
}

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) { const seeded = demoSeed(); localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded)); return seeded; }
  try {
    const parsed = JSON.parse(raw);
    parsed.entities = parsed.entities || [];
    parsed.offers = parsed.offers || [];
    parsed.projects = parsed.projects || [];

    parsed.entities.forEach(e => {
      e.contacts = e.contacts || [];
      if (!("activeContactId" in e)) e.activeContactId = e.contacts[0]?.id || null;
      e.reminders = e.reminders || [];
      e.createdAt = e.createdAt || iso();
      e.updatedAt = e.updatedAt || iso();
    });

    parsed.projects.forEach(p => {
      p.files = p.files || [];
      p.reminders = p.reminders || [];
      p.linkedOfferItemIds = p.linkedOfferItemIds || [];
      p.createdAt = p.createdAt || iso();
      p.updatedAt = p.updatedAt || iso();
    });

    parsed.offers.forEach(o => {
      o.files = o.files || [];
      o.createdAt = o.createdAt || iso();
      o.updatedAt = o.updatedAt || iso();
    });

    return parsed;
  } catch {
    const seeded = demoSeed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

export function upsertEntity(state, entity) {
  const arr = state.entities || (state.entities = []);
  const i = arr.findIndex(x => x.id === entity.id);
  if (i >= 0) arr[i] = entity; else arr.unshift(entity);
  saveState(state); return state;
}
export function upsertProject(state, project) {
  const arr = state.projects || (state.projects = []);
  const i = arr.findIndex(x => x.id === project.id);
  if (i >= 0) arr[i] = project; else arr.unshift(project);
  saveState(state); return state;
}
export function upsertOffer(state, offer) {
  const arr = state.offers || (state.offers = []);
  const i = arr.findIndex(x => x.id === offer.id);
  if (i >= 0) arr[i] = offer; else arr.unshift(offer);
  saveState(state); return state;
}

export function newEntity(type) {
  return { id: uuid(), type, companyName: type==="customer"?"Ny kund":"Ny leverantör", orgNo:"", phone:"", email:"", address:"", notes:"",
    contacts: [], activeContactId: null, reminders: [], createdAt: iso(), updatedAt: iso()
  };
}
export function newProject(customerId) {
  return { id: uuid(), type: "project", name: "Nytt projekt", customerId: customerId || null,
    status: "Planerad", startDate: new Date().toISOString().slice(0,10), dueDate: "", description: "",
    files: [], reminders: [], linkedOfferItemIds: [], createdAt: iso(), updatedAt: iso()
  };
}
export function newOffer(customerId) {
  return { id: uuid(), customerId, title: "Ny offert", files: [], createdAt: iso(), updatedAt: iso() };
}

// Kontakter
export function setActiveContact(state, entityId, contactId) {
  const e = state.entities.find(x => x.id === entityId); if (!e) return state;
  e.activeContactId = contactId; e.updatedAt = iso(); return upsertEntity(state, e);
}
export function addContact(state, entityId) {
  const e = state.entities.find(x => x.id === entityId); if (!e) return state;
  const c = { id: uuid(), name: "", role: "", phone: "", email: "" };
  e.contacts = [...(e.contacts || []), c]; if (!e.activeContactId) e.activeContactId = c.id; e.updatedAt = iso();
  return upsertEntity(state, e);
}

// Projekt ↔ Offerter
export function setProjectOfferLinks(state, projectId, ids) {
  const p = state.projects.find(x => x.id === projectId); if (!p) return state;
  p.linkedOfferItemIds = Array.isArray(ids) ? ids.slice() : []; p.updatedAt = iso(); return upsertProject(state, p);
}
export function buildProjectSyncedFiles(state, project) {
  if (!project || !project.customerId) return project?.files || [];
  const offers = (state.offers || []).filter(o => o.customerId === project.customerId);
  const offerItems = offers.flatMap(o => o.files || []);
  const chosen = offerItems.filter(it => project.linkedOfferItemIds.includes(it.id));
  const existingIds = new Set((project.files || []).map(f => f.id));
  return (project.files || []).concat(chosen.filter(f => !existingIds.has(f.id)));
}

export function copyAllOfferFilesForCustomerToProject(state, customerId, projectId) {
  const p = state.projects.find(x => x.id === projectId); if (!p) return state;
  const offers = (state.offers || []).filter(o => o.customerId === customerId);
  const srcFiles = offers.flatMap(o => o.files || []);
  const existingIds = new Set((p.files || []).map(f => f.id));
  const toAdd = srcFiles.filter(f => !existingIds.has(f.id));
  p.files = (p.files || []).concat(toAdd); p.updatedAt = iso(); return upsertProject(state, p);
}
