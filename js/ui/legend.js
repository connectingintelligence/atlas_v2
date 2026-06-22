// ─────────────────────────────────────────────────────────────
//  LAYER LEGEND — explains what each VISIBLE entanglement layer's
//  arc COLOUR + WIDTH encode. Compact, docks bottom-right (raised
//  clear of #globe-controls). Rebuilds on registry.onChange so it
//  always mirrors which entanglement layers are currently on; hides
//  entirely when none are visible.
//
//  This module only READS the registry (registry.list / onChange).
//  It owns no layer data and never mutates colours — the swatches
//  below mirror the layers' own encodings (theme vars + the
//  per-colonizer / migration ramps) for explanatory purposes only.
//
//  Public API:  initLegend({ registry, globe })
// ─────────────────────────────────────────────────────────────

import { legendGradient } from '../core/theme.js';

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  #atlas-legend { position:fixed; right:28px; bottom:70px; z-index:55;
    width:236px; max-width:46vw; background:var(--panel-bg);
    border:1px solid var(--panel-border); border-radius:6px;
    backdrop-filter:blur(14px); box-shadow:0 10px 34px var(--shadow,rgba(0,0,0,.2));
    font-family:'JetBrains Mono',monospace; color:var(--ink-dim);
    padding:11px 13px 12px; opacity:0; transform:translateY(8px);
    transition:opacity .3s ease, transform .3s ease; pointer-events:none; }
  #atlas-legend.show { opacity:1; transform:translateY(0); pointer-events:auto; }
  #atlas-legend .lg-title { font-size:9px; letter-spacing:.16em; text-transform:uppercase;
    color:var(--ink-faint); margin-bottom:9px; }
  #atlas-legend .lg-row { margin-bottom:10px; }
  #atlas-legend .lg-row:last-child { margin-bottom:0; }
  #atlas-legend .lg-name { font-size:11px; color:var(--ink); margin-bottom:4px;
    display:flex; align-items:center; gap:7px; }
  #atlas-legend .lg-swatches { display:inline-flex; align-items:center; gap:4px; }
  #atlas-legend .lg-sw { width:13px; height:13px; border-radius:3px; flex:none;
    border:1px solid var(--panel-border); }
  #atlas-legend .lg-bar { width:34px; height:9px; border-radius:3px; flex:none;
    border:1px solid var(--panel-border); }
  #atlas-legend .lg-desc { font-size:9.5px; line-height:1.5; color:var(--ink-faint);
    letter-spacing:.02em; }
  #atlas-legend .lg-width { display:inline-flex; align-items:center; gap:5px; margin-top:4px; }
  #atlas-legend .lg-width svg { display:block; }
  @media (max-width:900px){ #atlas-legend { bottom:auto; top:64px; } }`;
  const s = document.createElement('style');
  s.id = 'atlas-legend-css'; s.textContent = css;
  document.head.appendChild(s);
}

// A tiny inline SVG showing a thin→thick wedge to explain "width = …".
function widthWedge(color) {
  return `<svg width="34" height="9" viewBox="0 0 34 9" aria-hidden="true">
    <path d="M0 4.5 L34 0.5 L34 8.5 Z" fill="${color}" opacity="0.85"></path></svg>`;
}

// Per-layer legend descriptors. Colours here MIRROR the layers' own
// encodings (theme vars / ramps) — purely explanatory swatches.
function rowFor(id) {
  switch (id) {
    case 'entanglement-migration':
      return {
        name: 'Refugees',
        // teal→deep-blue ramp matches the migration layer's colorFor()
        swatchHtml: `<span class="lg-bar" style="background:linear-gradient(90deg,rgb(120,170,190),rgb(20,70,110))"></span>`,
        desc: 'origin → asylum · darker = larger flow · width = refugees',
      };
    case 'entanglement-colonies':
      return {
        name: 'Colonies',
        // a few representative empire hues (British/French/Spanish/Portuguese)
        swatchHtml: `<span class="lg-swatches">
          <span class="lg-sw" style="background:#d94f4f"></span>
          <span class="lg-sw" style="background:#4f7fd9"></span>
          <span class="lg-sw" style="background:#e0a020"></span>
          <span class="lg-sw" style="background:#3fae6b"></span>
        </span>`,
        desc: 'colonizer → colonized · hue = empire · year-filtered',
      };
    case 'entanglement-overseas':
      return {
        name: 'Overseas territories',
        // same empire palette as Colonies (Britain red, France blue, …)
        swatchHtml: `<span class="lg-swatches">
          <span class="lg-sw" style="background:#d94f4f" title="United Kingdom"></span>
          <span class="lg-sw" style="background:#4f7fd9" title="France"></span>
          <span class="lg-sw" style="background:#36c5c0" title="United States"></span>
          <span class="lg-sw" style="background:#9d6b4f" title="Denmark"></span>
        </span>`,
        desc: 'power → territory still governed today · hue = power · dot = territory',
      };
    case 'entanglement-genocide':
      return {
        name: 'Genocide',
        swatchHtml: `<span class="lg-swatches">
          <span class="lg-sw" style="background:var(--arc-perp)" title="perpetrator"></span>
          <span class="lg-sw" style="background:var(--arc-victim)" title="victim"></span>
        </span>`,
        desc: 'perpetrator → victim (arrow points to victim) · ≤ year shows',
      };
    case 'entanglement-economic':
      // Three labelled swatches so the client's "what's green vs yellow?"
      // question is answered in the key itself. Colours mirror STREAM_COLOR.
      return {
        name: 'Economic',
        swatchHtml: `<span class="lg-swatches">
          <span class="lg-sw" style="background:#ff4d8d" title="remittances"></span>
          <span class="lg-sw" style="background:#37d67a" title="aid (ODA)"></span>
          <span class="lg-sw" style="background:#8a7dff" title="trade openness"></span>
        </span>`,
        desc: 'pink = remittances · green = aid · violet = trade · width = value',
      };
    case 'entanglement-slavetrade':
      return {
        name: 'Slave Voyages',
        // carrier-flag hues (Portugal, Britain, France, Spain, NL) — combined
        // colonial flags shown under the colonising power (see methodology)
        swatchHtml: `<span class="lg-swatches">
          <span class="lg-sw" style="background:#8a6248" title="Portugal"></span>
          <span class="lg-sw" style="background:#9c4a3c" title="Great Britain"></span>
          <span class="lg-sw" style="background:#5d6b85" title="France"></span>
          <span class="lg-sw" style="background:#a08544" title="Spain"></span>
          <span class="lg-sw" style="background:#a06a35" title="Netherlands"></span>
        </span>`,
        desc: 'region → region · hue = carrier flag · width = captives',
      };
    case 'entanglement-commodities':
      return {
        name: 'Commodities',
        // mirror COMMODITY colours in the layer (oil/gold/copper/rare-earths/lithium/cobalt)
        swatchHtml: `<span class="lg-swatches">
          <span class="lg-sw" style="background:#8d9aa8" title="crude oil"></span>
          <span class="lg-sw" style="background:#f2d24b" title="gold"></span>
          <span class="lg-sw" style="background:#e07b39" title="copper"></span>
          <span class="lg-sw" style="background:#e44fd2" title="rare earths"></span>
          <span class="lg-sw" style="background:#7ce0e0" title="lithium"></span>
          <span class="lg-sw" style="background:#4f6fe4" title="cobalt"></span>
        </span>`,
        desc: 'exporter → importer · hue = commodity · width = value',
      };
    default:
      return null;
  }
}

// Order in which to present rows (matches conceptual stacking).
const ORDER = [
  'entanglement-migration',
  'entanglement-colonies',
  'entanglement-overseas',
  'entanglement-genocide',
  'entanglement-economic',
  'entanglement-commodities',
  'entanglement-slavetrade',
];

export function initLegend({ registry, globe } = {}) {
  if (!registry) return;
  injectStyles();

  const panel = document.createElement('aside');
  panel.id = 'atlas-legend';
  panel.setAttribute('aria-label', 'Layer legend');
  document.body.appendChild(panel);

  // ── choropleth ramp legend (bottom-left, above the Weighting button) ──
  // The surface had no colour key at all; without one the orange shades are
  // just mood. Shows whenever the CFCT surface is on.
  const ramp = document.createElement('aside');
  ramp.id = 'surface-legend';
  ramp.setAttribute('aria-label', 'Surface colour scale');
  ramp.style.cssText = `position:fixed; left:28px; bottom:64px; z-index:55; width:170px;
    background:var(--panel-bg, rgba(241,235,225,.92)); border:1px solid var(--panel-border, #cfc4b2);
    border-radius:8px; padding:9px 12px 8px; backdrop-filter:blur(10px); display:none;`;
  ramp.innerHTML = `
    <div style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.14em;
      text-transform:uppercase;color:var(--ink-faint,#8a8276);margin-bottom:6px;">CFCT surface</div>
    <div style="height:8px;border-radius:4px;background:${legendGradient('conditions')};"></div>
    <div style="display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;
      font-size:9px;color:var(--ink-dim,#6b6358);margin-top:3px;"><span>0</span><span>50</span><span>100</span></div>`;
  document.body.appendChild(ramp);
  function syncRamp() {
    const cfctOn = registry.list().some((e) => e.id === 'cfct-composite' && e.visible);
    ramp.style.display = cfctOn ? 'block' : 'none';
  }
  syncRamp();

  function render(list) {
    const entries = Array.isArray(list) ? list : registry.list();
    // currently-visible entanglement layers we know how to describe
    const visible = entries.filter(
      (e) => e && e.visible && (e.group || 'entanglement') === 'entanglement' && rowFor(e.id),
    );
    if (!visible.length) {
      panel.classList.remove('show');
      panel.innerHTML = '';
      return;
    }
    // present in stable conceptual order
    visible.sort((a, b) => {
      const ia = ORDER.indexOf(a.id), ib = ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    const rowsHtml = visible.map((e) => {
      const r = rowFor(e.id);
      const widthHtml = r.widthColor
        ? `<span class="lg-width">${widthWedge(r.widthColor)}<span>width = scale</span></span>`
        : '';
      return `<div class="lg-row">
        <div class="lg-name">${r.swatchHtml}${r.name}</div>
        <div class="lg-desc">${r.desc}</div>
        ${widthHtml}
      </div>`;
    }).join('');

    panel.innerHTML = `<div class="lg-title">Layer legend</div>${rowsHtml}`;
    panel.classList.add('show');
  }

  // initial paint + rebuild on every registry change (visibility/controls/added)
  render(registry.list());
  registry.onChange((list) => { render(list); syncRamp(); });
}
