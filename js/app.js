// ─────────────────────────────────────────────────────────────
//  APP — main entry. Wires the globe engine, layer registry, panel,
//  intro, and chrome controls together. Phase-1 integration glue.
// ─────────────────────────────────────────────────────────────

import { createGlobe } from './core/projection.js';
import { LayerRegistry } from './core/layer-registry.js';
import { applyTheme, DEFAULT_THEME } from './core/theme.js';
import { loadCountryMeta, loadCti } from './core/data-loader.js';
import { initIntro } from './ui/intro-flow.js';
import { initLayerPanel } from './ui/layer-panel.js';
import cfctLayer from './layers/cfct-composite/index.js';

const $ = (sel) => document.querySelector(sel);

// Entanglement layers are auto-discovered: each Phase-2 agent ships its module
// at the path below. Missing ones are skipped silently, so agents never need to
// touch app.js — keeping their work conflict-free.
const ENTANGLEMENT_LAYERS = [
  './layers/entanglement-migration/index.js',  // Agent A
  './layers/entanglement-economic/index.js',   // Agent B
  './layers/entanglement-colonies/index.js',   // Agent C
  './layers/entanglement-overseas/index.js',   // present-day overseas territories (still-governed)
  './layers/entanglement-genocide/index.js',   // Agent D
  './layers/entanglement-commodities/index.js', // BACI HS6 bilateral commodity trade
  './layers/historical-borders/index.js',       // era polity maps (surface group)
  './layers/indigenous-territories/index.js',   // Native Land overlay (present-tense)
  './layers/entanglement-slavetrade/index.js',  // SlaveVoyages region-to-region flows
];
// Optional UI modules, each exporting a named init fn called with { registry, globe }.
const UI_MODULES = [
  ['./ui/country-drawer.js', 'initCountryDrawer'],     // Agent E
  ['./ui/weighting-panel.js', 'initWeightingPanel'],   // custom 0–100 weighting + indicator docs
  ['./ui/time-scrubber.js', 'initTimeScrubber'],       // global year slider driving all layers
  ['./ui/legend.js', 'initLegend'],                    // per-layer arc colour/width legend
  ['./ui/relationships-panel.js', 'initRelationshipsPanel'], // cross-layer entanglement panel
  ['./ui/country-search.js', 'initCountrySearch'],     // type-ahead country finder ("/")
  ['./ui/feedback.js', 'initFeedback'],                // prototype disclaimer + feedback modal
  ['./ui/anachronism-note.js', 'initAnachronismNote'], // "today's borders ≠ 1500" caption + fade
  ['./ui/country-chip.js', 'initCountryChip'],         // click = pin + chip; panels open on demand
];

async function main() {
  applyTheme(DEFAULT_THEME);

  const [meta, cti] = await Promise.all([loadCountryMeta(), loadCti()]);
  const names = meta.country_names || {};

  const tooltip = $('#tooltip');
  const globe = createGlobe($('#globe-wrap'), {
    projection: 'globe',
    autoRotate: true,
    onHover(iso3, ev) {
      if (!iso3 || !ev) { tooltip.style.display = 'none'; return; }
      const name = names[iso3] || iso3;
      // Reflect the CURRENT surface (incl. custom weighting), not a fixed CFCT.
      const surf = window.atlas && window.atlas.surface;
      let valStr, hint, bdHtml = '';
      if (surf && surf.value) {
        const v = surf.value(iso3);
        valStr = (v == null || isNaN(v)) ? 'no data' : v.toFixed(1);
        hint = `${surf.label()} ${surf.unit ? surf.unit() : '/ 100'}`;
        const bd = surf.breakdown ? surf.breakdown(iso3) : [];
        if (bd.length) {
          const rows = bd.slice(0, 8).map((b) =>
            `<div style="display:flex;justify-content:space-between;gap:14px;font-size:11.5px;color:var(--ink-dim);">
               <span>${b.label}</span><span class="mono" style="color:var(--ink);">${b.value.toFixed(1)}</span></div>`).join('');
          const more = bd.length > 8 ? `<div style="font-size:10px;color:var(--ink-faint);margin-top:2px;">+${bd.length - 8} more</div>` : '';
          bdHtml = `<div style="margin-top:8px;padding-top:7px;border-top:1px solid var(--rule);display:flex;flex-direction:column;gap:3px;">${rows}${more}</div>`;
        }
      } else {
        const d = cti[iso3];
        valStr = d && d.cti != null ? d.cti.toFixed(1) : 'no data';
        hint = 'CFCT / 100';
      }
      const covNote = surf && surf.coverageNote ? surf.coverageNote(iso3) : null;
      // Indigenous land under the cursor (only when that layer is visible) —
      // rendered INLINE in this one tooltip rather than as a second floating box.
      let indigHtml = '';
      const indig = window.atlasIndigenous;
      if (indig && indig.namesAt) {
        try {
          const ll = globe.projection.invert(d3.pointer(ev, globe.svg.node()));
          const ns = ll ? indig.namesAt(ll) : [];
          if (ns.length) {
            const escTT = (s) => String(s).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
            const shown = ns.slice(0, 4).map(escTT).join(' · ');
            const more = ns.length > 4 ? ` +${ns.length - 4}` : '';
            indigHtml = `<div style="margin-top:7px;padding-top:6px;border-top:1px solid var(--rule);font-size:11px;color:var(--ink-dim);">`
              + `<span style="color:var(--ink-faint);">Indigenous land</span> · ${shown}${more}</div>`;
          }
        } catch (e) { /* invert can fail off-globe */ }
      }
      tooltip.style.display = 'block';
      tooltip.innerHTML = `<div class="tt-name">${name}</div>
        <div class="tt-val">${valStr}</div>
        <div class="tt-hint">${hint}${covNote ? ` · ${covNote}` : ''}</div>${indigHtml}${bdHtml}`;
      tooltip.style.left = (ev.clientX + 14) + 'px';
      tooltip.style.top = (ev.clientY + 14) + 'px';
    },
    onProjectionChange(t) {
      const btn = $('#gc-proj');
      btn.textContent = t > 0.5 ? '2D' : '3D';
      btn.classList.toggle('active', t < 0.5);
    },
    onAutoRotateChange(on) { $('#gc-play').textContent = on ? '❚❚' : '▶'; },
    onPinChange(iso3, feature, lonlat) {
      // country-drawer (Agent E) listens for this
      document.dispatchEvent(new CustomEvent('atlas:select', { detail: { iso3, feature, lonlat } }));
    },
  });

  await globe._loadWorld(meta);

  // registry + layers
  const registry = new LayerRegistry(globe, { defaultYear: 2024 });
  registry.register(cfctLayer);
  // auto-discover entanglement layers built by Phase-2 agents
  await Promise.all(ENTANGLEMENT_LAYERS.map(async (path) => {
    try { const m = await import(path); if (m.default) registry.register(m.default); }
    catch (e) { /* not built yet — skip */ }
  }));
  // auto-discover optional UI modules
  await Promise.all(UI_MODULES.map(async ([path, fn]) => {
    try { const m = await import(path); if (typeof m[fn] === 'function') await m[fn]({ registry, globe }); }
    catch (e) { /* not built yet — skip */ }
  }));
  window.atlas = { globe, registry };   // handle for integration + debugging

  initLayerPanel(registry, '#layers');
  await registry.setVisible('cfct-composite', true);

  // stat rail (fed by the cfct layer via an event)
  document.addEventListener('atlas:stats', (e) => {
    const s = e.detail || {};
    if (s.coverage) $('#sr-cov').textContent = s.coverage;
    if (s.mean) $('#sr-mean').textContent = s.mean;
    if (s.peak) $('#sr-peak').textContent = s.peak;
  });

  // chrome controls
  $('#gc-proj').addEventListener('click', () => globe.toggleProjection());
  $('#gc-play').addEventListener('click', () => globe.toggleAutoRotate());
  $('#gc-zin').addEventListener('click', () => globe.zoomIn());
  $('#gc-zout').addEventListener('click', () => globe.zoomOut());

  const intro = initIntro({ onEnter() { /* chrome revealed by intro-flow */ } });
  // dev affordance: ?nointro jumps straight into the atlas (used for QA screenshots)
  const params = new URLSearchParams(location.search);
  if (params.has('nointro')) intro?.enter();
  if (params.has('flat')) globe.setProjection(true, false);
  // dev/QA: ?layers=entanglement-migration,entanglement-colonies turns layers on
  const want = params.get('layers');
  if (want) for (const id of want.split(',')) { try { await registry.setVisible(id.trim(), true); } catch (e) {} }
  // dev/QA: ?select=DEU selects AND opens the country drawer for that ISO3
  // (panels no longer auto-open on selection — the chip is the gateway)
  const sel = params.get('select');
  if (sel) {
    globe.setPinned(sel); globe.focusOn?.(sel, 600);
    document.dispatchEvent(new CustomEvent('atlas:select', { detail: { iso3: sel } }));
    document.dispatchEvent(new CustomEvent('atlas:open-drawer', { detail: { iso3: sel } }));
  }
  // dev/QA: ?relpanel=IRN opens the relationships panel for that ISO3
  const rp = params.get('relpanel');
  if (rp) {
    document.dispatchEvent(new CustomEvent('atlas:select', { detail: { iso3: rp } }));
    document.dispatchEvent(new CustomEvent('atlas:open-relationships', { detail: { iso3: rp } }));
  }
  // dev/QA: ?pin=FRA pins the globe (focuses arc layers on that country, as a
  // click would) and opens its panels — used to screenshot the click-to-focus.
  const pin = params.get('pin');
  if (pin) {
    globe.setPinned(pin); globe.requestRender();
    // optional &ll=lon,lat simulates the click point (territory hit-testing)
    const ll = (params.get('ll') || '').split(',').map(Number);
    const lonlat = ll.length === 2 && ll.every(Number.isFinite) ? ll : null;
    document.dispatchEvent(new CustomEvent('atlas:select', { detail: { iso3: pin, lonlat } }));
  }
  // dev/QA: ?year=1500 scrubs the global time axis
  const qYear = parseInt(params.get('year'), 10);
  if (Number.isFinite(qYear)) {
    try { registry.setYear(qYear); window.atlasTimeScrubber?.setYear(qYear); } catch (e) {}
  }
  // dev/QA: ?alltime turns the time axis off (all years at once)
  if (params.has('alltime')) { try { registry.setAllTime(true); window.atlasTimeScrubber?.setAllTime(true); } catch (e) {} }
  // dev/QA: ?weights opens the weighting panel (level via ?weights=indicators)
  if (params.has('weights')) {
    document.querySelector('#wt-panel [data-level="' + (params.get('weights') || 'meta') + '"]')?.click();
    document.querySelector('#wt-toggle')?.click();
  }
}

main().catch((err) => {
  console.error('Atlas v2 failed to start:', err);
  document.body.insertAdjacentHTML('beforeend',
    `<div style="position:fixed;inset:auto 0 0 0;padding:14px;background:#9a3818;color:#fff;
      font:13px monospace;z-index:999;">Atlas failed to start: ${err.message}
      — are you serving over http? (file:// blocks module + fetch). Try:
      <b>python3 -m http.server</b> in map_v2/</div>`);
});
