// src/lib/cloud.js
// Minimal moln-synk via Microsoft Graph (OneDrive/SharePoint) utan att förstöra localStorage.
// Läs/skriv EN (1) JSON-fil: MachCRM/mach-crm.json i OneDrive (eller SharePoint senare).

/* ======== 1) KONFIG – FYLL I ENTRA-ID:N ======== */
export const TENANT_ID = "48bd814b-47b9-4310-8c9d-af61d450cedc";            // <— Directory (tenant) ID (GUID)
export const CLIENT_ID = "c3485a3b-b394-47ee-a4c1-e2d1dd98bdfb";      // <— Application (client) ID (GUID)

// Valfritt: byt filens sökväg (behåll gärna denna)
const CLOUD_FILE_PATH = "/MachCRM/mach-crm.json"; // hamnar i (eller läses från) "My files/MachCRM/mach-crm.json"

// Behörighet: Files.ReadWrite (delegated) räcker för denna fil.

// ======== 2) MSAL setup ========
let msalInstance = null;
let account = null;

export function initAuth() {
  if (msalInstance) return msalInstance;
  if (!window.msal) {
    console.warn("MSAL (msal-browser) saknas. Kolla index.html script-taggen.");
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

  // Hantera ev. redirect-svar (om MSAL skulle använda redirect-flöde)
  msalInstance.handleRedirectPromise().catch(err => console.error("MSAL redirect error:", err));

  const acs = msalInstance.getAllAccounts();
  if (acs.length) {
    account = acs[0];
  }
  return msalInstance;
}

const SCOPES = ["Files.ReadWrite"];

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

// ======== 3) Graph helpers (OneDrive användares "My files") ========
async function graphFetch(path, method = "GET", body, contentType) {
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
    const text = await res.text().catch(() => "");
    throw new Error(`Graph ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res;
}

// Läs filen /Me/drive/root:/MachCRM/mach-crm.json
export async function loadCloud() {
  try {
    await ensureLoginPopup();
    // kolla om filen finns
    const metaRes = await graphFetch(`/me/drive/root:${encodeURI(CLOUD_FILE_PATH)}`);
    const meta = await metaRes.json();

    // hämta innehållet
    const contentRes = await graphFetch(`/me/drive/items/${meta.id}/content`);
    const text = await contentRes.text();
    const obj = JSON.parse(text);
    return obj;
  } catch (err) {
    // Om 404 -> filen finns inte än => returnera null (första körningen)
    if (String(err).includes("404")) return null;
    console.error("loadCloud error:", err);
    throw err;
  }
}

// Skriv filen (skapar om den saknas)
export async function saveCloud(stateObj) {
  try {
    await ensureLoginPopup();
    const data = new Blob([JSON.stringify(stateObj)], { type: "application/json" });
    // PUT content till target path (skapar/uppdaterar)
    await graphFetch(`/me/drive/root:${encodeURI(CLOUD_FILE_PATH)}:/content`, "PUT", data, "application/json");
    return true;
  } catch (err) {
    console.error("saveCloud error:", err);
    return false;
  }
}

// Hjälpstatus för UI
export function getAuthStatus() {
  return {
    signedIn: !!account,
    account: account ? { username: account.username, name: account.name } : null,
    cloudPath: CLOUD_FILE_PATH,
  };
}
