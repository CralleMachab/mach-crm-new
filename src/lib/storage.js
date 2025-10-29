// lib/storage.js
// -------------------------------------------------------------
// Lagring för Mach CRM (localStorage-bas, enkel att koppla till Graph senare)
// - Entities (kunder/leverantörer) utan OneDrive-koppling
// - Offerter (har OneDrive-filer)
// - Projekt (egna filer + valbara kopplingar från offerter)
// - Kontaktpersoner med rullista: contacts[] + activeContactId
// - Påminnelser på entities och projekt
// - Projekt har linkedOfferItemIds[] = vilka offertfiler som ska “följa med”
// -------------------------------------------------------------

const STORAGE_KEY = "machcrm_data_v3";

// ---- Utils
function iso(d = new Date()) {
  return new Date(d).toISOString();
}
function isoInDays(delta) {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
const uuid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

// ---- Initialdata (bara för demo; kan tas bort senare)
function demoSeed() {
  const custId = uuid();
  const suppId = uuid();
  const offerId = uuid();

  return {
    entities: [
      {
        id: custId,
        type: "customer",
        companyName: "Exempel AB",
        orgNo: "556000-0000",
        phone: "+46 8 123 45 67",
        email: "info@exempel.se",
        address: "Storgatan 1, 111 11 Stockholm",
        notes: "Viktig kund.",
        contacts: [
          { id: uuid(), name: "Anna Andersson", role: "Inköp", phone: "+46 70 111 22 33", email: "anna@exempel.se" },
          { id: uuid(), name: "Per Persson", role: "Ekonomi", phone: "", email: "per@exempel.se" }
        ],
        activeContactId: null, // sätts via UI
        reminders: [
          { id: uuid(), type: "Samtal", subject: "Följ upp offert", dueDate: isoInDays(0), done: false }
        ],
        createdAt: iso(),
        updatedAt: iso()
      },
      {
        id: suppId,
        type: "supplier",
        companyName: "Leveranta AB",
        orgNo: "556111-1111",
        phone: "+46 31 987 65 43",
        email: "kontakt@leveranta.se",
        address: "Kvarnvägen 5, 411 11 Göteborg",
        notes: "Bra priser.",
        contacts: [{ id: uuid(), name: "Sara Svensson", role: "Sälj", phone: "", email: "sara@leveranta.se" }],
        activeContactId: null,
        reminders: [{ id: uuid(), type: "Samtal", subject: "Förhandla frakt", dueDate: isoInDays(-2), done: false }],
        createdAt: iso(),
        updatedAt: iso()
      }
    ],

    // Offerter (OneDrive-filer hör hemma här – inte på kunderna)
    offers: [
      {
        id: offerId,
        customerId: custId,
        title: "Offert 2025-01",
        files: [
          // { id, name, link, webUrl, size, isFolder }
        ],
        createdAt: iso(),
        updatedAt: iso()
      }
    ],

    // Projekt (egna filer + valbar koppling till offerter)
    projects: [
      // {
      //   id, type:'project', name, customerId, status, startDate, dueDate, description,
      //   files:[{ id,name,link,webUrl,size,isFolder }],
      //   reminders:[{...}],
      //   linkedOfferItemIds:[], // <-- valda offert-filers id:n som ska “följas”
      //   createdAt, updatedAt
      // }
    ]
  };
}

// ---- Ladda/spara + enkel migration
export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = demoSeed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw);

    // Grundfält
    parsed.entities = parsed.entities || [];
    parsed.offers = parsed.offers || [];
    parsed.projects = parsed.projects || [];

    // Migration entities
    parsed.entities.forEach((e) => {
      e.contacts = e.contacts || [];
      if (!("activeContactId" in e)) e.activeContactId = e.contacts[0]?.id || null;
      e.reminders = e.reminders || [];
      e.createdAt = e.createdAt || iso();
      e.updatedAt = e.updatedAt || iso();
    });

    // Migration projects: lägg till linkedOfferItemIds (Steg 1A)
    parsed.projects.forEach((p) => {
      p.files = p.files || [];
      p.reminders = p.reminders || [];
      p.linkedOfferItemIds = p.linkedOfferItemIds || []; // NYCKELN: vilka offertfiler som ska följas
      p.createdAt = p.createdAt || iso();
      p.updatedAt = p.updatedAt || iso();
    });

    // Migration offers
    parsed.offers.forEach((o) => {
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

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---- Upserts
export function upsertEntity(state, entity) {
  const arr = state.entities || (state.entities = []);
  const i = arr.findIndex((x) => x.id === entity.id);
  if (i >= 0) arr[i] = entity;
  else arr.unshift(entity);
  saveState(state);
  return state;
}

export function upsertProject(state, project) {
  const arr = state.projects || (state.projects = []);
  const i = arr.findIndex((x) => x.id === project.id);
  if (i >= 0) arr[i] = project;
  else arr.unshift(project);
  saveState(state);
  return state;
}

export function upsertOffer(state, offer) {
  const arr = state.offers || (state.offers = []);
  const i = arr.findIndex((x) => x.id === offer.id);
  if (i >= 0) arr[i] = offer;
  else arr.unshift(offer);
  saveState(state);
  return state;
}

// ---- Skapa nytt
export function newEntity(type) {
  return {
    id: uuid(),
    type,
    companyName: type === "customer" ? "Ny kund" : "Ny leverantör",
    orgNo: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    contacts: [],
    activeContactId: null,
    reminders: [],
    createdAt: iso(),
    updatedAt: iso()
  };
}

export function newProject(customerId) {
  return {
    id: uuid(),
    type: "project",
    name: "Nytt projekt",
    customerId: customerId || null,
    status: "Planerad",
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    description: "",
    files: [],
    reminders: [],
    linkedOfferItemIds: [], // Steg 1B — NYTT fält
    createdAt: iso(),
    updatedAt: iso()
  };
}

export function newOffer(customerId) {
  return {
    id: uuid(),
    customerId,
    title: "Ny offert",
    files: [],
    createdAt: iso(),
    updatedAt: iso()
  };
}

// ---- Helpers: kontakter
export function setActiveContact(state, entityId, contactId) {
  const e = state.entities.find((x) => x.id === entityId);
  if (!e) return state;
  e.activeContactId = contactId;
  e.updatedAt = iso();
  return upsertEntity(state, e);
}

export function addContact(state, entityId) {
  const e = state.entities.find((x) => x.id === entityId);
  if (!e) return state;
  const c = { id: uuid(), name: "", role: "", phone: "", email: "" };
  e.contacts = [...(e.contacts || []), c];
  if (!e.activeContactId) e.activeContactId = c.id;
  e.updatedAt = iso();
  return upsertEntity(state, e);
}

// ---- Helpers: Projekt ↔ Offerter (valbara länkar)
// Steg 1C — spara vilka offertfiler (id:n) som projektet vill följa
export function setProjectOfferLinks(state, projectId, ids) {
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return state;
  p.linkedOfferItemIds = Array.isArray(ids) ? ids.slice() : [];
  p.updatedAt = iso();
  return upsertProject(state, p);
}

// Bygg upp projektets filer genom att lägga till valda offertfiler (utan dubbletter)
export function buildProjectSyncedFiles(state, project) {
  if (!project || !project.customerId) return project?.files || [];
  const offers = (state.offers || []).filter((o) => o.customerId === project.customerId);
  const offerItems = offers.flatMap((o) => o.files || []);
  const chosen = offerItems.filter((it) => project.linkedOfferItemIds.includes(it.id));
  const existingIds = new Set((project.files || []).map((f) => f.id));
  const merged = (project.files || []).concat(chosen.filter((f) => !existingIds.has(f.id)));
  return merged;
}

// (Valfri extra-helper om du vill kopiera alla offerter-filer direkt)
// Behålls för bakåtkompabilitet, men du kan ignorera den om du använder setProjectOfferLinks+buildProjectSyncedFiles
export function copyAllOfferFilesForCustomerToProject(state, customerId, projectId) {
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return state;
  const offers = (state.offers || []).filter((o) => o.customerId === customerId);
  const srcFiles = offers.flatMap((o) => o.files || []);
  const existingIds = new Set((p.files || []).map((f) => f.id));
  const toAdd = srcFiles.filter((f) => !existingIds.has(f.id));
  p.files = (p.files || []).concat(toAdd);
  p.updatedAt = iso();
  return upsertProject(state, p);
}
