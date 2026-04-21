const KEY_PREFIX = "mach_tidplan_sandbox_v1";

function key(projectId) {
  return `${KEY_PREFIX}:${projectId}`;
}

export function loadProjectData(projectId) {
  const raw = localStorage.getItem(key(projectId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveProjectData(projectId, data) {
  localStorage.setItem(key(projectId), JSON.stringify(data));
}

export function resetProjectData(projectId) {
  localStorage.removeItem(key(projectId));
}