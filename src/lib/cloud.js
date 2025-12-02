/* src/lib/cloud.js – SharePoint/Graph-synk */

const TENANT_ID = "c3485a3b-b394-47ee-a4c1-e2d1dd98bdfb";
const CLIENT_ID = "48bd814b-47b9-4310-8c9d-af61d450cedc";

// ===== SHAREPOINT/GRAPH KONFIG START =====
const SITE_HOSTNAME = "machentreprenadab.sharepoint.com";

// Själva sitens NAMN efter /sites/  → din URL är .../sites/crm/...
// så vi använder bara "crm" här:
const SITE_PATH = "crm";

// (DOC_LIB_NAME* är inte använda just nu, men vi låter dem ligga kvar om vi vill bygga vidare senare)
const DOC_LIB_NAME_SV = "Delade dokument";
// const DOC_LIB_NAME_EN = "Shared Documents";

// Var i dokumentbiblioteket du vill lägga CRM-filen:
const FOLDER_PATH = "CRM";                  // undermapp i biblioteket
const FILE_NAME   = "mach-crm-state.json";  // själva filen
// Full sökväg i dokumentbiblioteket:
const CLOUD_FILE_PATH =
  FOLDER_PATH && FOLDER_PATH.length
    ? `/${FOLDER_PATH}/${FILE_NAME}`
    : `/${FILE_NAME}`;
// ===== SHAREPOINT/GRAPH KONFIG SLUT =====

const SCOPES = ["Files.ReadWrite.All", "Sites.ReadWrite.All"];

let msalInstance = null;
let account = null;

export async function initAuth() {
  if (!window.msal)
    throw new Error("MSAL saknas – lägg till msal-browser i index.html");

  if (!msalInstance) {
    msalInstance = new window.msal.PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: "localStorage" },
    });
  }

  const accts = msalInstance.getAllAccounts();
  if (accts.length) account = accts[0];

  if (!account) {
    try {
      await msalInstance.ssoSilent({ scopes: SCOPES });
      account = msalInstance.getAllAccounts()[0] || null;
    } catch {
      await msalInstance.loginPopup({ scopes: SCOPES });
      account = msalInstance.getAllAccounts()[0] || null;
    }
  }

  if (!account) throw new Error("Kunde inte logga in mot Microsoft.");
}

async function getToken() {
  if (!msalInstance) await initAuth();
  const res = await msalInstance
    .acquireTokenSilent({ account, scopes: SCOPES })
    .catch(() => msalInstance.acquireTokenPopup({ scopes: SCOPES }));
  return res.accessToken;
}

// Hämta site-id för https://machentreprenadab.sharepoint.com/sites/crm
async function getSiteId(token) {
  // Viktigt: här ska det vara /sites/<SITE_PATH>
  const url = `https://graph.microsoft.com/v1.0/sites/${SITE_HOSTNAME}:/sites/${SITE_PATH}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Kunde inte hämta site-id");
  const j = await r.json();
  return j.id; // t.ex. 'machentreprenadab.sharepoint.com,1234-...'
}

async function getFileText(token, siteId, path) {
  // Vi använder sajtens "standard-Drive" (Delade dokument) och filen /CRM/mach-crm-state.json
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:${encodeURI(
    path
  )}:/content`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 404) return null; // filen finns inte ännu
  if (!r.ok) throw new Error("Kunde inte läsa filinnehåll");
  return await r.text();
}

async function putFileText(token, siteId, path, text) {
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:${encodeURI(
    path
  )}:/content`;
  const r = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: text,
  });
  if (!r.ok) throw new Error("Kunde inte spara fil");
  return true;
}

export async function fetchRemoteState() {
  try {
    await initAuth();
    const token = await getToken();
    const siteId = await getSiteId(token);
    const txt = await getFileText(token, siteId, CLOUD_FILE_PATH);
    if (!txt) return null;
    return JSON.parse(txt);
  } catch (e) {
    console.warn("fetchRemoteState misslyckades:", e);
    return null;
  }
}

export async function pushRemoteState(state) {
  try {
    await initAuth();
    const token = await getToken();
    const siteId = await getSiteId(token);
    const payload = JSON.stringify(state);
    await putFileText(token, siteId, CLOUD_FILE_PATH, payload);
    return true;
  } catch (e) {
    console.warn("pushRemoteState misslyckades:", e);
    return false;
  }
}
