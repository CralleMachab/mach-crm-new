// src/lib/cloud.js — SharePoint-variant

/* ======== FYLLT MED DINA VÄRDEN ======== */
export const TENANT_ID  = "c3485a3b-b394-47ee-a4c1-e2d1dd98bdfb"; // Directory (tenant) ID
export const CLIENT_ID  = "48bd814b-47b9-4310-8c9d-af61d450cedc"; // Application (client) ID

const SITE_HOSTNAME = "machentreprenadab.sharepoint.com"; // <— från din URL
const SITE_PATH     = "/sites/crm";                        // <— från din URL
const CLOUD_FILE_PATH = "/MachCRM/mach-crm.json";          // lagras i root på site drive
/* ======================================= */

let msalInstance = null;
let account = null;

export function initAuth() {
  if (msalInstance) return msalInstance;
  if (!window.msal) {
    console.warn("MSAL (msal-browser) saknas. Kolla index.html script-tag.");
    return null;
  }
  msalInstance = new window.msal.PublicClientApplication({
    auth: {
      clientId: CLIENT_ID,
      authority: `https://login.microsoftonline.com/${TENANT_ID}`,
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
  });
  msalInstance.handleRedirectPromise().catch(err => console.error("MSAL redirect error:", err));

  const acs = msalInstance.getAllAccounts();
  if (acs.length) account = acs[0];
  return msalInstance;
}

const SCOPES = ["Sites.ReadWrite.All"];

export async function ensureLoginPopup() {
  initAuth();
  if (!msalInstance) throw new Error("MSAL ej initierad.");
  if (!account) {
    const res = await msalInstance.loginPopup({ scopes: SCOPES });
    account = res.account;
  }
  return account;
}

async function acquireToken() {
  initAuth();
  if (!msalInstance) throw new Error("MSAL ej initierad.");
  if (!account) await ensureLoginPopup();

  try {
    const res = await msalInstance.acquireTokenSilent({ account, scopes: SCOPES });
    return res.accessToken;
  } catch {
    const res = await msalInstance.acquireTokenPopup({ account, scopes: SCOPES });
    return res.accessToken;
  }
}

export function logout() {
  if (!msalInstance || !account) return;
  msalInstance.logoutPopup({ account });
  account = null;
}

async function graphFetch(path, method="GET", body, contentType) {
  const token = await acquireToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(()=>"");
    throw new Error(`Graph ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res;
}

async function getSiteId() {
  const cacheKey = `sp_siteid:${SITE_HOSTNAME}${SITE_PATH}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;
  const r = await graphFetch(`/sites/${SITE_HOSTNAME}:${SITE_PATH}?$select=id`);
  const j = await r.json();
  const siteId = j?.id;
  if (!siteId) throw new Error("Kunde inte hämta SharePoint siteId. Kontrollera SITE_HOSTNAME och SITE_PATH.");
  localStorage.setItem(cacheKey, siteId);
  return siteId;
}

export async function loadCloud() {
  try {
    await ensureLoginPopup();
    const siteId = await getSiteId();

    const metaRes = await graphFetch(`/sites/${siteId}/drive/root:${encodeURI(CLOUD_FILE_PATH)}`);
    const meta = await metaRes.json();

    const contentRes = await graphFetch(`/sites/${siteId}/drive/items/${meta.id}/content`);
    const text = await contentRes.text();
    const obj = JSON.parse(text);
    return obj;
  } catch (err) {
    if (String(err).includes("404")) return null; // filen finns inte ännu
    console.error("loadCloud(SP) error:", err);
    throw err;
  }
}

export async function saveCloud(stateObj) {
  try {
    await ensureLoginPopup();
    const siteId = await getSiteId();
    const data = new Blob([JSON.stringify(stateObj)], { type: "application/json" });
    await graphFetch(`/sites/${siteId}/drive/root:${encodeURI(CLOUD_FILE_PATH)}:/content`, "PUT", data, "application/json");
    return true;
  } catch (err) {
    console.error("saveCloud(SP) error:", err);
    return false;
  }
}

export function getAuthStatus() {
  return {
    signedIn: !!account,
    account: account ? { username: account.username, name: account.name } : null,
    cloudPath: `SharePoint ${SITE_PATH}${CLOUD_FILE_PATH}`,
    site: { hostname: SITE_HOSTNAME, path: SITE_PATH },
  };
}
