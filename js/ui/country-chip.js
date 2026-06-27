// ─────────────────────────────────────────────────────────────
//  COUNTRY CHIP — the small thing that appears when you click a
//  country, INSTEAD of the drawer + relationships panel popping up.
//  Clicking a country now just pins it (arcs focus on it); this chip
//  names the pin and offers the two panels on demand:
//    [Details]        → atlas:open-drawer        (country drawer)
//    [Entanglements]  → atlas:open-relationships (relationships panel)
//    [×]              → unpin (clears focus, closes everything)
//
//  The Entanglements button is ALWAYS active (client 2026-06-16): the
//  relationships panel reads its own data, so you do not need to switch a
//  layer on first.
//
//  Public API:  initCountryChip({ registry, globe })
// ─────────────────────────────────────────────────────────────

import { loadCountryMeta } from '../core/data-loader.js';

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  #country-chip { position:fixed; top:80px; right:28px; z-index:58;
    display:none; flex-direction:column; gap:6px; padding:7px 9px 7px 14px;
    background:var(--panel-bg); border:1px solid var(--panel-border);
    border-radius:18px; backdrop-filter:blur(12px); max-width:min(380px, 80vw);
    box-shadow:0 8px 26px var(--shadow, rgba(0,0,0,.18)); }
  #country-chip.show { display:inline-flex; }
  #country-chip .cc-row { display:flex; align-items:center; gap:10px; }
  #country-chip .cc-terr { display:none; font-family:'JetBrains Mono',monospace;
    font-size:9.5px; line-height:1.7; color:var(--ink-faint); letter-spacing:.04em;
    border-top:1px solid var(--rule); padding-top:5px; }
  #country-chip .cc-terr.show { display:block; }
  #country-chip .cc-terr a { color:var(--ink-dim); text-decoration:none;
    border-bottom:1px dotted var(--panel-border); }
  #country-chip .cc-terr a:hover { color:var(--ink); }
  #country-chip .cc-name { font-family:'Source Serif 4',serif; font-size:14.5px;
    color:var(--ink); white-space:nowrap; max-width:180px; overflow:hidden;
    text-overflow:ellipsis; }
  #country-chip button { appearance:none; cursor:pointer; border-radius:999px;
    border:1px solid var(--panel-border); background:transparent;
    color:var(--ink-dim); padding:4px 11px; font-family:'JetBrains Mono',monospace;
    font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; }
  #country-chip button:hover:not(:disabled) { color:var(--ink); background:var(--rule); }
  #country-chip button:disabled { opacity:.35; cursor:default; }
  #country-chip .cc-unpin { border:none; padding:4px 7px; font-size:13px; }
  @media (max-width:900px){ #country-chip { top:64px; right:12px; } }

  /* ── phones: keep it top-right but below the safe-area inset, cap its width
     so it never spans the screen, and grow the buttons to >=40px tap targets ── */
  @media (max-width:640px){
    #country-chip { top: calc(env(safe-area-inset-top) + 52px); right:12px; left:auto;
      max-width: min(56vw, 210px); }
    #country-chip .cc-row { flex-wrap:wrap; gap:8px; }
    #country-chip .cc-name { max-width:54vw; }
    #country-chip button { min-height:40px; padding:9px 13px; font-size:10px; }
    #country-chip .cc-unpin { min-width:40px; min-height:40px; padding:0; font-size:18px;
      display:flex; align-items:center; justify-content:center; }
  }`;
  const s = document.createElement('style');
  s.id = 'country-chip-css'; s.textContent = css;
  document.head.appendChild(s);
}

export async function initCountryChip({ registry, globe } = {}) {
  injectStyles();
  let names = {};
  try { names = (await loadCountryMeta()).country_names || {}; } catch (e) {}

  const chip = document.createElement('div');
  chip.id = 'country-chip';
  chip.innerHTML = `
    <div class="cc-row">
      <span class="cc-name"></span>
      <button type="button" class="cc-details">Details</button>
      <button type="button" class="cc-rel">Entanglements</button>
      <button type="button" class="cc-unpin" aria-label="Unpin country">×</button>
    </div>
    <div class="cc-terr"></div>`;
  document.body.appendChild(chip);

  const nameEl = chip.querySelector('.cc-name');
  const relBtn = chip.querySelector('.cc-rel');
  const terrEl = chip.querySelector('.cc-terr');
  let iso = null;

  // ── indigenous territories at the click point ────────────────
  // Whose land did you actually click? When the indigenous-territories layer
  // is on, hit-test the click's lon/lat against the Native Land polygons
  // (math, not pointer-events — country clicking is untouched) and list the
  // overlapping territories with links to their native-land.ca pages.
  let terrFeats = null, terrLoading = null;
  const indigOn = () => {
    try { return registry.list().some((e) => e.id === 'indigenous-territories' && e.visible); }
    catch (e) { return false; }
  };
  async function loadTerritories() {
    if (terrFeats) return terrFeats;
    if (!terrLoading) {
      terrLoading = fetch('data/indigenous_territories.geojson')
        .then((r) => r.json())
        .then((gj) => { terrFeats = gj.features || []; return terrFeats; })
        .catch(() => { terrLoading = null; return []; });
    }
    return terrLoading;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Planar even-odd point-in-polygon — NOT d3.geoContains: the ArcGIS export's
  // ring winding is inconsistent, which makes spherical containment see some
  // polygons as "everything except the territory" (false hits continents away).
  // Planar is correct at territory scale (verified vs known Arizona nations).
  function pipRing(pt, ring) {
    const [x, y] = pt; let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j], [x2, y2] = ring[i];
      if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) inside = !inside;
    }
    return inside;
  }
  function containsPt(geom, pt) {
    if (!geom) return false;
    const polys = geom.type === 'MultiPolygon' ? geom.coordinates
      : geom.type === 'Polygon' ? [geom.coordinates] : [];
    return polys.some((p) => p[0] && pipRing(pt, p[0]));
  }
  async function showTerritories(lonlat) {
    terrEl.classList.remove('show');
    terrEl.innerHTML = '';
    if (!lonlat || !indigOn()) return;
    const feats = await loadTerritories();
    const hits = feats.filter((f) => { try { return containsPt(f.geometry, lonlat); } catch (e) { return false; } });
    if (!hits.length) return;
    const links = hits.slice(0, 5).map((f) => {
      const name = esc(f.properties?.Name || 'Unnamed');
      const slug = f.properties?.Slug;
      return slug
        ? `<a href="https://native-land.ca/maps/territories/${encodeURIComponent(slug)}/" target="_blank" rel="noopener">${name}</a>`
        : name;
    }).join(' · ');
    const more = hits.length > 5 ? ` · +${hits.length - 5} more` : '';
    terrEl.innerHTML = `Indigenous territories here: ${links}${more}`;
    terrEl.classList.add('show');
  }

  document.addEventListener('atlas:select', (e) => {
    iso = e.detail && e.detail.iso3;
    if (!iso) { chip.classList.remove('show'); return; }
    nameEl.textContent = names[iso] || iso;
    chip.classList.add('show');
    showTerritories(e.detail.lonlat);
  });

  chip.querySelector('.cc-details').addEventListener('click', () => {
    if (iso) document.dispatchEvent(new CustomEvent('atlas:open-drawer', { detail: { iso3: iso } }));
  });
  relBtn.addEventListener('click', () => {
    if (iso) document.dispatchEvent(new CustomEvent('atlas:open-relationships', { detail: { iso3: iso } }));
  });
  chip.querySelector('.cc-unpin').addEventListener('click', () => {
    try { globe?.setPinned?.(null); globe?.requestRender?.(); } catch (e) {}
    document.dispatchEvent(new CustomEvent('atlas:select', { detail: { iso3: null } }));
  });
}
