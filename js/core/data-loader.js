// ─────────────────────────────────────────────────────────────
//  DATA LOADER — fetch + in-memory cache + light validation
//  Every layer's data goes through here so caching + error handling
//  are uniform. Validation is intentionally light: enough to fail loud
//  on a malformed file, not a full JSON-schema engine.
// ─────────────────────────────────────────────────────────────

const cache = new Map();      // path -> Promise<json>

// Generic cached fetch. Concurrent callers share one in-flight promise.
export function loadJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(path)
    .then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json();
    })
    .catch((err) => {
      cache.delete(path);   // don't cache failures — allow retry
      throw new Error(`Failed to load ${path}: ${err.message}`);
    });
  cache.set(path, p);
  return p;
}

export function loadText(path) {
  const key = 'text:' + path;
  if (cache.has(key)) return cache.get(key);
  const p = fetch(path).then((r) => {
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.text();
  }).catch((err) => { cache.delete(key); throw err; });
  cache.set(key, p);
  return p;
}

// ── validators ───────────────────────────────────────────────
// Shared entanglement schema (§3.2 of the plan): { _meta, arcs: [{from,to,year,value,type}] }
export function validateEntanglement(json, label = 'entanglement') {
  if (!json || typeof json !== 'object') throw new Error(`${label}: not an object`);
  if (!Array.isArray(json.arcs)) throw new Error(`${label}: missing arcs[]`);
  for (let i = 0; i < json.arcs.length; i++) {
    const a = json.arcs[i];
    if (!a.from || !a.to) throw new Error(`${label}: arc ${i} missing from/to`);
  }
  return json;
}

// CFCT scores file: object keyed by ISO3 with a _meta block.
export function validateCti(json, label = 'cti_scores') {
  if (!json || typeof json !== 'object') throw new Error(`${label}: not an object`);
  if (!json._meta) throw new Error(`${label}: missing _meta`);
  return json;
}

// Convenience loaders for the well-known core files.
export const loadCti = () => loadJSON('data/cti_scores.json').then((j) => validateCti(j));
export const loadCountryMeta = () => loadJSON('data/country-meta.json');

export function clearCache() { cache.clear(); }
