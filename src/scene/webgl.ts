/** WebGL disponible ? Toujours faux avec `?liste` dans l'URL, pour tester le repli. */
export function webglAvailable() {
  if (new URLSearchParams(location.search).has('liste')) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
