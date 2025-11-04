/* ======== SharePoint-konfiguration (fyllt åt dig) ======== */
/**
 * SITE_HOSTNAME och SITE_PATH ska spegla din SharePoint-webbplats-URL.
 * Du gav: https://machentreprenadab.sharepoint.com/sites/crm/Lists/CRM%20Machab/AllItems.aspx
 *
 * => SITE_HOSTNAME = "machentreprenadab.sharepoint.com"
 * => SITE_PATH     = "/sites/crm"
 *
 * CLOUD_FILE_PATH är sökvägen till själva JSON-filen där vi kan spara CRM-data
 * (om/när vi aktiverar riktig molnlagring). Lämna som det är så länge.
 */

export const TENANT_ID = "c3485a3b-b394-47ee-a4c1-e2d1dd98bdfb";   // Directory (tenant) ID
export const CLIENT_ID = "48bd814b-47b9-4310-8c9d-af61d450cedc";   // Application (client) ID

export const SITE_HOSTNAME  = "machentreprenadab.sharepoint.com";
export const SITE_PATH      = "/sites/crm";
export const CLOUD_FILE_PATH = "/MachCRM/mach-crm.json";

/**
 * Nedan finns stubbar (platshållare) för molnspar. De gör inget ännu,
 * men är redo den dagen vi vill koppla på riktig lagring via Graph.
 * Lämna dessa som de är – appen funkar lokalt ändå (localStorage).
 */

export async function cloudLoadState() {
  // TODO: implementera senare (MSAL + Graph)
  return null; // null => appen faller tillbaka till localStorage
}

export async function cloudSaveState(_state) {
  // TODO: implementera senare (MSAL + Graph)
  return false; // false => sparar ej i molnet än
}
