export function customerCategoryBadge(cat) {
  const base = "text-xs px-2 py-1 rounded text-white";
  switch (cat) {
    case "StålHall":
    case "Stålhall":
      return `${base} bg-gray-500`;
    case "Totalentreprenad":
    case "TotalEntreprenad":
      return `${base} bg-orange-500`;
    case "Turbovex":
      return `${base} bg-blue-500`;
    case "Bygg":
      return `${base} bg-orange-500`;
    case "Övrigt":
      return "text-xs px-2 py-1 rounded bg-white text-gray-700 border";
    default:
      return "text-xs px-2 py-1 rounded bg-gray-100 text-gray-700";
  }
}

export function supplierCategoryBadge(cat) {
  const base = "text-xs px-2 py-1 rounded text-white";
  switch (cat) {
    case "Stålhalls leverantör":
      return `${base} bg-gray-500`;
    case "Mark företag":
      return `${base} bg-amber-800`;
    case "EL leverantör":
      return `${base} bg-red-500`;
    case "VVS Leverantör":
      return `${base} bg-purple-500`;
    case "Vent Leverantör":
      return `${base} bg-blue-500`;
    case "Bygg":
      return `${base} bg-orange-500`;
    case "Projektering":
      return `${base} bg-yellow-400 text-black`;
    case "Övrigt":
      return "text-xs px-2 py-1 rounded bg-white text-gray-700 border";
    default:
      return "text-xs px-2 py-1 rounded bg-gray-100 text-gray-700";
  }
}