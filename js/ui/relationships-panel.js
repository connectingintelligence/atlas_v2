// ─────────────────────────────────────────────────────────────
//  RELATIONSHIPS PANEL — Atlas v2 cross-layer entanglement view.
//
//  A SEPARATE side panel (docked just left of the country drawer) that opens
//  on `atlas:select` WHEN at least one entanglement layer is visible. For the
//  selected country it shows, per entanglement layer, that country's partner
//  relationships (who colonized it / its colonies, refugee origins & asylum,
//  remittance partners, genocide perpetrator/victim ties) WITH year spans —
//  and, at the top, the CROSS-LAYER OVERLAP: partners that recur across two or
//  more layers, which is where colonial, migratory and economic entanglement
//  compound. Pure frontend: reads data/{colonies,migration,economic,
//  genocide_arcs}.json directly (the same files the layers render).
//
//  Public: export function initRelationshipsPanel({ registry, globe })
//  Registered in app.js UI_MODULES.
// ─────────────────────────────────────────────────────────────

import { loadJSON } from '../core/data-loader.js';

// Per-layer identity: key, label, short badge letter, accent colour.
const LAYERS = [
  { key: 'colonies',  label: 'Colonial',  badge: 'C', color: '#b0723a' },
  { key: 'migration', label: 'Refugees',  badge: 'R', color: '#4f7fd9' },
  { key: 'economic',  label: 'Economic',  badge: '$', color: '#3fae6b' },
  { key: 'commodities', label: 'Commodities', badge: 'T', color: '#8a7dff' },
  { key: 'genocide',  label: 'Atrocity',  badge: 'A', color: '#a8412a' },
];
const LAYER_BY_KEY = Object.fromEntries(LAYERS.map((l) => [l.key, l]));

// The Atrocity layer is the curated/beta genocide dataset — NOT built from
// established indices like the rest. It lives behind the same passcode gate as
// the Genocide map layer, so keep this panel consistent: no atrocity ties are
// shown until that layer is unlocked. Unlock state is written to sessionStorage
// by layer-panel.js (key 'atlas-beta-unlocked').
const GENOCIDE_LAYER_ID = 'entanglement-genocide';
function genocideUnlocked() {
  try {
    return JSON.parse(sessionStorage.getItem('atlas-beta-unlocked') || '[]').includes(GENOCIDE_LAYER_ID);
  } catch (e) { return false; }
}
// LAYERS minus the gated Atrocity layer while it is still locked
function shownLayers() {
  return genocideUnlocked() ? LAYERS : LAYERS.filter((l) => l.key !== 'genocide');
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]
));

function humanize(n) {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(Math.round(n));
}

let PANEL = null;
let NAMES = {};               // iso3 -> display name
let DATA = null;              // { colonies, migration, economic, genocide } arc arrays
let REGISTRY = null;
let CURRENT = null;

const nm = (iso) => NAMES[iso] || iso;

// ── data loading (cached) ─────────────────────────────────────
async function ensureData() {
  if (DATA) return DATA;
  const [meta, col, mig, eco, gen, com] = await Promise.all([
    loadJSON('data/country-meta.json').catch(() => ({})),
    loadJSON('data/colonies.json').catch(() => ({ arcs: [] })),
    loadJSON('data/migration.json').catch(() => ({ arcs: [] })),
    loadJSON('data/economic.json').catch(() => ({ arcs: [] })),
    loadJSON('data/genocide_arcs.json').catch(() => ({ arcs: [] })),
    loadJSON('data/commodities.json').catch(() => ({ arcs: [] })),
  ]);
  NAMES = (meta && meta.country_names) || {};
  DATA = {
    colonies: col.arcs || [],
    migration: mig.arcs || [],
    economic: eco.arcs || [],
    genocide: gen.arcs || [],
    commodities: com.arcs || [],
  };
  return DATA;
}

// ── per-layer relationship extraction for one country ─────────
// Each returns a list of { partner, sort, html, self? } rows, partner-keyed.

// mini timeline bar: the tie's window rendered on a 1450–2025 track
function spanBar(a) {
  const T0 = 1450, T1 = 2025, W = T1 - T0;
  const s = a.start_year != null ? Math.max(T0, a.start_year) : T0;
  const e = a.end_year != null ? Math.min(T1, a.end_year) : T1;
  if (e <= s) return '';
  const left = ((s - T0) / W * 100).toFixed(1);
  const width = Math.max(0.8, (e - s) / W * 100).toFixed(1);
  const open = a.start_year == null ? ' class="open-start"' : '';
  return `<span class="rp-span"><i${open} style="left:${left}%;width:${width}%"></i></span>`;
}

function relColonies(iso) {
  const out = [];
  for (const a of DATA.colonies) {
    if (a.to === iso && a.from !== iso) {          // iso was colonised
      const span = a.start_year != null
        ? `${a.start_year}–${a.end_year ?? '?'}`
        : `until ${a.end_year ?? '?'}`;
      const dur = a.start_year != null && a.end_year != null ? Math.max(0, a.end_year - a.start_year) : null;
      out.push({
        partner: a.from,
        sort: -(a.end_year || 0),
        mag: dur, magText: dur != null ? `${dur} yrs of rule` : 'duration unknown',
        html: `<span class="rp-dir">ruled by</span> <b>${esc(a.empire || nm(a.from))}</b>
               <span class="rp-meta">${span}${a.tier === 'secondary' ? ' · ICOW' : ''}</span>${spanBar(a)}`,
      });
    } else if (a.from === iso && a.to !== iso) {     // iso was the coloniser
      const span = a.start_year != null
        ? `${a.start_year}–${a.end_year ?? '?'}`
        : `until ${a.end_year ?? '?'}`;
      const dur = a.start_year != null && a.end_year != null ? Math.max(0, a.end_year - a.start_year) : null;
      out.push({
        partner: a.to,
        sort: -(a.end_year || 0),
        mag: dur, magText: dur != null ? `${dur} yrs of rule` : 'duration unknown',
        html: `<span class="rp-dir">colonised</span> <b>${esc(nm(a.to))}</b>
               <span class="rp-meta">${span}</span>${spanBar(a)}`,
      });
    }
  }
  return out;
}

// migration / economic: aggregate by (partner,direction) keeping the LATEST year.
function aggDirectional(arcs, iso, verbOut, verbIn, unit) {
  const acc = new Map();   // key -> {partner, dir, year, value}
  for (const a of arcs) {
    let partner, dir;
    if (a.from === iso && a.to !== iso) { partner = a.to; dir = 'out'; }
    else if (a.to === iso && a.from !== iso) { partner = a.from; dir = 'in'; }
    else continue;
    const k = partner + '|' + dir;
    const cur = acc.get(k);
    if (!cur || a.year > cur.year) acc.set(k, { partner, dir, year: a.year, value: a.value });
  }
  const out = [];
  for (const r of acc.values()) {
    out.push({
      partner: r.partner,
      sort: -(r.value || 0),
      mag: Math.abs(r.value || 0), magText: `${humanize(r.value)}${unit} (${r.year})`,
      html: `<span class="rp-dir">${r.dir === 'out' ? verbOut : verbIn}</span> <b>${esc(nm(r.partner))}</b>
             <span class="rp-meta">${humanize(r.value)}${unit} · ${r.year}</span>`,
    });
  }
  return out;
}

// commodities: one row per (partner, direction, commodity), latest year wins.
// BACI is exporter→importer, so from===iso means iso EXPORTS the commodity.
function relCommodities(iso) {
  const acc = new Map();
  for (const a of (DATA.commodities || [])) {
    let partner, dir;
    if (a.from === iso && a.to !== iso) { partner = a.to; dir = 'out'; }
    else if (a.to === iso && a.from !== iso) { partner = a.from; dir = 'in'; }
    else continue;
    const k = `${partner}|${dir}|${a.commodity}`;
    const cur = acc.get(k);
    if (!cur || a.year > cur.year) acc.set(k, { partner, dir, year: a.year, value: a.value, commodity: a.commodity });
  }
  const out = [];
  for (const r of acc.values()) {
    if (!(r.value >= 1)) continue;            // skip sub-$1M residue rows
    const label = (r.commodity || '').replace(/_/g, ' ');
    out.push({
      partner: r.partner,
      sort: -(r.value || 0),
      mag: Math.abs(r.value || 0), magText: `${humanize(r.value)} $M ${label} (${r.year})`,
      html: `<span class="rp-dir">${r.dir === 'out' ? `exports ${label} →` : `imports ${label} ←`}</span> <b>${esc(nm(r.partner))}</b>
             <span class="rp-meta">${humanize(r.value)} $M · ${r.year}</span>`,
    });
  }
  return out;
}

function relGenocide(iso) {
  if (!genocideUnlocked()) return [];   // gated: curated atrocity data stays hidden until unlocked
  const out = [];
  for (const a of DATA.genocide) {
    const self = a.self || a.from === a.to;
    if (self && a.from === iso) {
      out.push({
        partner: iso, self: true, sort: -(a.deaths || 0),
        html: `<span class="rp-dir">internal</span> <b>${esc(a.event)}</b>
               <span class="rp-meta">${esc(a.years)} · ${humanize(a.deaths)} deaths</span>`,
      });
    } else if (a.from === iso && a.to !== iso) {
      out.push({
        partner: a.to, sort: -(a.deaths || 0),
        mag: Math.abs(a.deaths || 0), magText: `${humanize(a.deaths)} deaths · ${a.event}`,
        html: `<span class="rp-dir">perpetrator →</span> <b>${esc(nm(a.to))}</b>
               <span class="rp-meta">${esc(a.event)} · ${esc(a.years)}</span>`,
      });
    } else if (a.to === iso && a.from !== iso) {
      out.push({
        partner: a.from, sort: -(a.deaths || 0),
        mag: Math.abs(a.deaths || 0), magText: `${humanize(a.deaths)} deaths · ${a.event}`,
        html: `<span class="rp-dir">victim ←</span> <b>${esc(nm(a.from))}</b>
               <span class="rp-meta">${esc(a.event)} · ${esc(a.years)}</span>`,
      });
    }
  }
  return out;
}

function computeRelations(iso) {
  return {
    colonies: relColonies(iso),
    migration: aggDirectional(DATA.migration, iso, 'refugees →', 'refugees ←', ''),
    economic: [
      ...aggDirectional(
        DATA.economic.filter((a) => a.type === 'remittance'),
        iso, 'remits →', 'remits ←', ' $M'),
      ...aggDirectional(
        DATA.economic.filter((a) => a.type === 'aid'),
        iso, 'aid →', 'aid ←', ' $'),
    ],
    commodities: relCommodities(iso),
    genocide: relGenocide(iso),
  };
}

// ── rendering ─────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('rel-panel-css')) return;
  const css = `
  #rel-panel {
    position: fixed; top: 0; right: 0; height: 100vh; width: 348px; max-width: 92vw;
    z-index: 88; display: flex; flex-direction: column;
    background: var(--panel-bg, rgba(241,235,225,0.94));
    border-left: 1px solid var(--panel-border, rgba(26,22,18,0.12));
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    box-shadow: -18px 0 48px rgba(0,0,0,0.14);
    transform: translateX(100%); transition: transform .42s cubic-bezier(.22,1,.36,1);
    color: var(--ink, #1a1612); font-family: 'Inter', system-ui, sans-serif;
  }
  /* docked just left of the 380px country drawer; when the drawer is closed
     the panel takes the drawer's slot instead (standalone mode), so closing
     the drawer doesn't strand it mid-screen — entanglements stay browsable */
  #rel-panel.open { transform: translateX(-392px); }
  #rel-panel.open.standalone { transform: translateX(0); }
  @media (max-width: 1180px) { #rel-panel.open { transform: translateX(0); z-index: 92; } }
  @media (prefers-reduced-motion: reduce) { #rel-panel { transition: none; } }

  #rel-panel .rp-scroll { overflow-y: auto; padding: 24px 22px 36px; flex: 1; }
  #rel-panel .rp-close {
    position: absolute; top: 14px; right: 14px; z-index: 2;
    width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
    border: 1px solid var(--rule, #cfc4b2); background: transparent;
    color: var(--ink-dim, #555); font-size: 15px; line-height: 1;
    display: flex; align-items: center; justify-content: center; transition: background .2s, color .2s;
  }
  #rel-panel .rp-close:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); }
  #rel-panel .rp-eyebrow {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .16em;
    text-transform: uppercase; color: var(--accent, #b0522a); margin-bottom: 6px;
  }
  #rel-panel .rp-name {
    font-family: 'Source Serif 4', Georgia, serif; font-size: 24px; line-height: 1.12;
    font-weight: 500; margin: 0 0 4px;
  }
  #rel-panel .rp-sub { font-size: 11.5px; color: var(--ink-dim, #6b6358); margin: 0 0 18px; }

  #rel-panel .rp-overlap {
    border: 1px solid var(--rule, #cfc4b2); border-radius: 10px; padding: 12px 13px;
    margin-bottom: 20px; background: color-mix(in srgb, var(--accent) 6%, transparent);
  }
  #rel-panel .rp-overlap h4, #rel-panel .rp-sec h4 {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .12em;
    text-transform: uppercase; color: var(--ink-dim, #6b6358); margin: 0 0 9px; font-weight: 600;
  }
  #rel-panel .rp-olrow { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 13px; }
  #rel-panel .rp-olrow b { font-weight: 600; }
  #rel-panel .rp-badges { display: inline-flex; gap: 3px; margin-left: auto; }
  #rel-panel .rp-badge {
    width: 16px; height: 16px; border-radius: 4px; font-size: 9.5px; font-weight: 700;
    color: #fff; display: inline-flex; align-items: center; justify-content: center;
    font-family: 'JetBrains Mono', monospace;
  }
  #rel-panel .rp-empty-ol { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  #rel-panel .rp-ol-sum { font-size: 11px; color: var(--ink-dim, #6b6358); margin: 0 0 9px; line-height: 1.4; }
  #rel-panel .rp-ol-more {
    margin-top: 6px; font-size: 11px; font-family: 'JetBrains Mono', monospace; cursor: pointer;
    background: transparent; border: 1px solid var(--rule, #cfc4b2); border-radius: 6px;
    color: var(--ink-dim, #6b6358); padding: 4px 9px; transition: background .2s, color .2s;
  }
  #rel-panel .rp-ol-more:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); }

  #rel-panel .rp-sec { margin-bottom: 16px; }
  #rel-panel .rp-sechead {
    display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;
    padding: 7px 0; border-top: 1px solid var(--rule, #cfc4b2);
  }
  #rel-panel .rp-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  #rel-panel .rp-sechead .rp-lbl { font-size: 13px; font-weight: 600; }
  #rel-panel .rp-count { margin-left: auto; font-size: 11px; color: var(--ink-dim); font-family: 'JetBrains Mono', monospace; }
  #rel-panel .rp-chev { font-size: 10px; color: var(--ink-dim); transition: transform .2s; }
  #rel-panel .rp-sec.collapsed .rp-chev { transform: rotate(-90deg); }
  #rel-panel .rp-sec.collapsed .rp-list { display: none; }
  #rel-panel .rp-list { list-style: none; margin: 4px 0 0; padding: 0; }
  #rel-panel .rp-item {
    font-size: 12.5px; line-height: 1.5; padding: 4px 8px; border-radius: 6px;
    display: flex; flex-wrap: wrap; gap: 4px; align-items: baseline;
  }
  #rel-panel .rp-item.overlap { background: color-mix(in srgb, var(--accent) 10%, transparent); }
  #rel-panel .rp-item.overlap::before { content: '◆'; color: var(--accent); font-size: 9px; margin-right: 2px; }
  #rel-panel .rp-dir { color: var(--ink-dim, #6b6358); }
  #rel-panel .rp-meta { color: var(--ink-faint, #8a8276); font-size: 11px; font-family: 'JetBrains Mono', monospace; }
  #rel-panel .rp-sec-empty { font-size: 11.5px; color: var(--ink-faint); font-style: italic; padding: 2px 8px; }

  /* flow (Sankey) — the only diagram view */
  #rel-panel .rp-diagram .rp-view-flow { display:block; }
  #rel-panel .rp-diaglegend { display:flex; flex-wrap:wrap; gap:5px 14px; justify-content:center;
    margin:2px 0 3px; font-family:'JetBrains Mono',monospace; font-size:9px;
    letter-spacing:.08em; text-transform:uppercase; color:var(--ink-dim); }
  #rel-panel .rp-lg-item { display:inline-flex; align-items:center; gap:5px; }
  #rel-panel .rp-lg-item i { width:10px; height:10px; border-radius:3px; flex:none; }
  #rel-panel .rp-diaghint { text-align:center; font-family:'JetBrains Mono',monospace;
    font-size:8.5px; letter-spacing:.05em; color:var(--ink-faint); margin:0 0 12px; }
  #rel-panel .rp-chord { margin: 0 0 14px; }
  /* partner click-to-pin + strand hover isolation */
  #rel-panel .rp-item[data-iso] { cursor: pointer; }
  #rel-panel .rp-item[data-iso]:hover { background: var(--rule); border-radius: 4px; }
  #rel-panel .rp-chord text[data-iso] { cursor: pointer; pointer-events: all; }
  #rel-panel .rp-chord text[data-iso]:hover { fill: var(--ink); }
  #rel-panel .rp-chord svg.focusing path:not(.hot) { opacity: .18; }
  #rel-panel .rp-chord svg.focusing path.hot { opacity: 1; }
  #rel-panel .rp-chord svg { display: block; margin: 0 auto; }
  #rel-panel .rp-chord text { font-family: 'Inter', system-ui, sans-serif; }

  /* colonial span bars: each tie's window on a 1450–2025 track */
  #rel-panel .rp-span {
    flex-basis: 100%; height: 5px; border-radius: 3px; margin-top: 3px;
    background: color-mix(in srgb, var(--rule, #cfc4b2) 55%, transparent);
    position: relative; overflow: hidden;
  }
  #rel-panel .rp-span i {
    position: absolute; top: 0; bottom: 0; border-radius: 3px;
    background: #b0723a; opacity: .75;
  }
  #rel-panel .rp-span i.open-start {
    background: linear-gradient(90deg, transparent, #b0723a 60%);
  }

  /* ── PHONE: true full-screen panel ── */
  @media (max-width: 640px) {
    #rel-panel {
      width: 100%; max-width: 100%; left: 0; right: 0;
      height: 100dvh;
    }
    /* full-screen: always sits in its own slot, no -392px dock offset */
    #rel-panel.open, #rel-panel.open.standalone {
      transform: translateX(0); z-index: 92;
    }
    #rel-panel .rp-scroll {
      padding:
        calc(env(safe-area-inset-top) + 24px)
        calc(env(safe-area-inset-right) + 18px)
        calc(env(safe-area-inset-bottom) + 36px)
        calc(env(safe-area-inset-left) + 18px);
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }
    #rel-panel .rp-close {
      top: calc(env(safe-area-inset-top) + 12px);
      right: calc(env(safe-area-inset-right) + 12px);
      width: 44px; height: 44px; font-size: 18px;
    }
  }
  `;
  const tag = document.createElement('style');
  tag.id = 'rel-panel-css';
  tag.textContent = css;
  document.head.appendChild(tag);
}

function ensurePanel() {
  if (PANEL) return PANEL;
  injectStyles();
  PANEL = document.createElement('aside');
  PANEL.id = 'rel-panel';
  PANEL.setAttribute('aria-label', 'Cross-layer relationships');
  PANEL.innerHTML = `<button class="rp-close" title="Close">✕</button><div class="rp-scroll"></div>`;
  PANEL.querySelector('.rp-close').addEventListener('click', close);
  document.body.appendChild(PANEL);
  watchDrawer();
  return PANEL;
}

// Follow the country drawer: docked beside it while it's open, sliding into
// its slot (standalone) when it closes. Lazy — the drawer element may not
// exist until the first atlas:select.
let DRAWER_OBSERVED = false;
function syncStandalone() {
  const drawer = document.getElementById('country-drawer');
  PANEL.classList.toggle('standalone', !(drawer && drawer.classList.contains('open')));
}
function watchDrawer() {
  if (DRAWER_OBSERVED) return;
  const drawer = document.getElementById('country-drawer');
  if (!drawer) { setTimeout(watchDrawer, 500); return; }
  DRAWER_OBSERVED = true;
  new MutationObserver(syncStandalone)
    .observe(drawer, { attributes: true, attributeFilter: ['class'] });
  syncStandalone();
}

function close() { if (PANEL) PANEL.classList.remove('open'); CURRENT = null; }

// ── top partners (drives the "Flow" Sankey view): partners ranked by compound
// entanglement, each carrying per-layer strength 0..1 from the tie's REAL
// magnitude — years of rule / refugees / USD / deaths — NOT the list-ordering
// key (`sort` is recency for colonies, which made every colonial ribbon
// identical full-thickness). Power 0.6 keeps heavy tails visible without
// flattening the rest; magnitude-less ties (ICOW null starts) get a floor.
function topPartners(rel) {
  const perLayerMax = {};
  const partners = new Map();   // partner -> { layers: {key: strength01}, labels: {key: text} }
  for (const { key } of LAYERS) {
    perLayerMax[key] = Math.max(1, ...rel[key].filter((r) => !r.self).map((r) => Math.abs(r.mag ?? 0)));
    for (const r of rel[key]) {
      if (r.self) continue;
      const p = partners.get(r.partner) || { layers: {}, labels: {} };
      const s = r.mag != null
        ? Math.pow(Math.abs(r.mag) / perLayerMax[key], 0.6)
        : 0.12;
      if (s >= (p.layers[key] || 0)) {
        p.layers[key] = Math.max(s, 0.06);
        if (r.magText) p.labels[key] = r.magText;
      }
      partners.set(r.partner, p);
    }
  }
  const score = ([, p]) => Object.keys(p.layers).length * 2
    + (p.layers.colonies ? 2 : 0) + (p.layers.genocide ? 2 : 0)
    + Object.values(p.layers).reduce((s, v) => s + v, 0);
  return [...partners.entries()].sort((a, b) => score(b) - score(a)).slice(0, 10);
}

// (Radar/spider view removed — Flow Sankey is the only diagram.)

// ── vertical Sankey (the panel's only diagram): the country as a spine on
// the left, top partners stacked on the right, one gradient ribbon per
// (partner, layer) — thickness = tie strength. Reads top-to-bottom; overlap
// is impossible by construction.
// Precedent: Abel & Sander (Science 2014) chord plots for UN-context
// migration flows; IEA/IPCC Sankeys for flows in narrow report layouts.
function sankeyBlock(top, iso) {
  if (top.length < 2) return '';
  const W = 300, XL = 16, BW = 7, XR = 204, LX = 217, GAP = 7, TOP = 14;
  const blocks = top.map(([p, info]) => {
    const strands = LAYERS.filter((l) => info.layers[l.key]).map((l) => ({
      key: l.key, color: l.color, label: l.label,
      magText: info.labels?.[l.key] || '',
      h: 2 + info.layers[l.key] * 14,
    }));
    return { p, strands, h: strands.reduce((s, d) => s + d.h, 0) };
  });
  const totStrand = blocks.reduce((s, b) => s + b.h, 0);
  const totRight = totStrand + GAP * (blocks.length - 1);
  const H = Math.ceil(Math.max(150, totRight + TOP * 2));

  let defs = '', ribbons = '', bars = '', labels = '';
  let yL = (H - totStrand) / 2;          // left spine: contiguous, centred
  let yR = (H - totRight) / 2;           // right: gaps between partners
  const mx = (XL + BW + XR) / 2;
  blocks.forEach((b, i) => {
    const by0 = yR;
    b.strands.forEach((st) => {
      const aL = yL + st.h / 2, aR = yR + st.h / 2;
      const gid = `rps-${i}-${st.key}`;
      defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse"
        x1="${XL + BW}" y1="${aL.toFixed(1)}" x2="${XR}" y2="${aR.toFixed(1)}">
        <stop offset="0" stop-color="#b0522a" stop-opacity="0.5"/>
        <stop offset="1" stop-color="${st.color}" stop-opacity="0.92"/></linearGradient>`;
      ribbons += `<path d="M${XL + BW},${aL.toFixed(1)} C${mx},${aL.toFixed(1)} ${mx},${aR.toFixed(1)} ${XR},${aR.toFixed(1)}"
        fill="none" stroke="url(#${gid})" stroke-width="${st.h.toFixed(1)}">
        <title>${esc(nm(b.p))} — ${st.label}${st.magText ? `: ${esc(st.magText)}` : ''}</title></path>`;
      bars += `<rect x="${XR}" y="${yR.toFixed(1)}" width="${BW}" height="${st.h.toFixed(1)}" fill="${st.color}"/>`;
      yL += st.h; yR += st.h;
    });
    const name = nm(b.p).length > 13 ? nm(b.p).slice(0, 12) + '…' : nm(b.p);
    // letter badges (C R $ T A) = colour-blind-safe redundancy for strand hues
    const badges = b.strands.map((st) => LAYER_BY_KEY[st.key]?.badge || '').join(' ');
    labels += `<text x="${LX}" y="${(by0 + b.h / 2 + 3).toFixed(1)}" font-size="9.5" data-iso="${esc(b.p)}"
      fill="var(--ink-dim,#6b6358)">${esc(name)}<tspan dx="5" font-size="7"
      fill="var(--ink-faint,#9a917f)">${badges}</tspan></text>`;
    yR += GAP;
  });
  const ly0 = (H - totStrand) / 2;
  const spine = `<rect x="${XL}" y="${ly0.toFixed(1)}" width="${BW}" height="${totStrand.toFixed(1)}" rx="2" fill="var(--accent,#b0522a)"/>
    <text x="${XL - 5}" y="${(ly0 + totStrand / 2).toFixed(1)}" font-size="9" font-weight="700"
      fill="var(--ink-dim,#6b6358)" text-anchor="middle"
      transform="rotate(-90 ${XL - 5} ${(ly0 + totStrand / 2).toFixed(1)})">${esc(iso)}</text>`;
  return `<div class="rp-chord"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>${defs}</defs>${ribbons}${spine}${bars}${labels}</svg></div>`;
}

function diagramBlock(rel, iso) {
  const top = topPartners(rel);
  if (top.length < 2) return '';
  const legend = shownLayers().map((l) =>
    `<span class="rp-lg-item"><i style="background:${l.color}"></i>${l.label}</span>`).join('');
  return `<div class="rp-diagram">
    <div class="rp-view rp-view-flow">${sankeyBlock(top, iso)}</div>
    <div class="rp-diaglegend">${legend}</div>
    <div class="rp-diaghint">Strongest partners across the visible layers.</div>
  </div>`;
}

function overlapBlock(rel) {
  // partner -> set of layer keys it appears in (exclude self-only genocide)
  const byPartner = new Map();
  for (const { key } of LAYERS) {
    for (const row of rel[key]) {
      if (row.self) continue;
      if (!byPartner.has(row.partner)) byPartner.set(row.partner, new Set());
      byPartner.get(row.partner).add(key);
    }
  }
  const DOM = new Set(['colonies', 'genocide']); // domination layers
  const all = [...byPartner.entries()].filter(([, set]) => set.size >= 2);

  // The informative overlap is where a DOMINATION tie (colonial / atrocity) also
  // carries a present-day FLOW (refugee / remittance) — post-colonial dependence
  // that outlasts the empire. Refugee+remittance co-occur almost everywhere a
  // diaspora exists, so that pairing alone is structural, not insight: collapse it.
  const compound = all.filter(([, s]) => [...s].some((k) => DOM.has(k)));
  const diaspora = all.filter(([, s]) => ![...s].some((k) => DOM.has(k)));
  const score = (s) => (s.has('colonies') ? 2 : 0) + (s.has('genocide') ? 2 : 0) + s.size;
  compound.sort((a, b) => score(b[1]) - score(a[1]) || nm(a[0]).localeCompare(nm(b[0])));
  diaspora.sort((a, b) => nm(a[0]).localeCompare(nm(b[0])));

  // per-layer ◆ markers highlight only the meaningful (compound) partners
  const overlapPartners = new Set(compound.map(([p]) => p));

  const rowHtml = ([partner, set]) => {
    const badges = LAYERS.filter((l) => set.has(l.key)).map((l) =>
      `<span class="rp-badge" style="background:${l.color}" title="${l.label}">${l.badge}</span>`).join('');
    return `<div class="rp-olrow"><b>${esc(nm(partner))}</b>
      <span class="rp-badges">${badges}</span></div>`;
  };
  const capped = (rows, n, moreLabel) => {
    let h = rows.slice(0, n).map(rowHtml).join('');
    if (rows.length > n) {
      h += `<button class="rp-ol-more" type="button">${moreLabel}</button>`;
      h += `<div class="rp-ol-rest" hidden>${rows.slice(n).map(rowHtml).join('')}</div>`;
    }
    return h;
  };

  let html = `<div class="rp-overlap"><h4>Where domination meets displacement</h4>`;
  html += `<div class="rp-ol-sum">Partners whose colonial or atrocity history <em>also</em> carries a present-day refugee or remittance flow — the entanglement that outlasts the empire.</div>`;
  if (!compound.length) {
    html += `<div class="rp-empty-ol">No colonial or atrocity tie here coincides with a refugee or remittance flow.</div>`;
  } else {
    html += capped(compound, 10, `+${compound.length - 10} more`);
  }
  if (diaspora.length) {
    html += `<button class="rp-ol-more rp-ol-diaspora" type="button">+${diaspora.length} diaspora-only partners · refugee + remittance, no colonial/atrocity tie</button>`;
    html += `<div class="rp-ol-rest" hidden>${diaspora.map(rowHtml).join('')}</div>`;
  }
  html += `</div>`;
  return { html, overlapPartners };
}

function sectionBlock(layer, rows, overlapPartners) {
  rows = rows.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const items = rows.length
    ? rows.map((r) => {
        const hot = !r.self && overlapPartners.has(r.partner) ? ' overlap' : '';
        // data-iso makes the row clickable: click → pin that partner on the
        // globe (closes the panel→map loop); self rows stay inert
        const isoAttr = !r.self && r.partner ? ` data-iso="${esc(r.partner)}"` : '';
        return `<li class="rp-item${hot}"${isoAttr}>${r.html}</li>`;
      }).join('')
    : `<div class="rp-sec-empty">No ties in this layer.</div>`;
  // ALWAYS collapsed by default — the counts + chevrons are the menu; lists
  // open on demand (user: everything expanded at once is overwhelming).
  const collapsed = ' collapsed';
  return `<section class="rp-sec${collapsed}" data-key="${layer.key}">
    <div class="rp-sechead">
      <span class="rp-dot" style="background:${layer.color}"></span>
      <span class="rp-lbl">${layer.label}</span>
      <span class="rp-count">${rows.length}</span>
      <span class="rp-chev">▾</span>
    </div>
    <ul class="rp-list">${items}</ul>
  </section>`;
}

function render(iso) {
  const rel = computeRelations(iso);
  const total = LAYERS.reduce((n, l) => n + rel[l.key].filter((r) => !r.self).length, 0)
    + rel.genocide.filter((r) => r.self).length;
  const { html: olHtml, overlapPartners } = overlapBlock(rel);
  const secs = shownLayers().map((l) => sectionBlock(l, rel[l.key], overlapPartners)).join('');
  const scroll = PANEL.querySelector('.rp-scroll');
  scroll.innerHTML = `
    <div class="rp-eyebrow">Entanglements</div>
    <h2 class="rp-name">${esc(nm(iso))}</h2>
    <p class="rp-sub">${total} cross-border ${total === 1 ? 'tie' : 'ties'} across colonial, refugee, economic, commodity${genocideUnlocked() ? ' & atrocity' : ''} layers</p>
    ${diagramBlock(rel, iso)}
    ${olHtml}
    ${secs}`;
  // collapse/expand
  scroll.querySelectorAll('.rp-sechead').forEach((h) => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed'));
  });
  // partner click → pin on the globe (chip + arc focus follow via
  // atlas:select; the panel itself re-renders to the clicked partner).
  // Assignment (not addEventListener) so re-renders don't stack handlers.
  scroll.onclick = (ev) => {
    const el = ev.target.closest('[data-iso]');
    if (!el || !el.dataset.iso) return;
    const p = el.dataset.iso;
    try { window.atlas?.globe?.setPinned?.(p); window.atlas?.globe?.requestRender?.(); } catch (e) {}
    document.dispatchEvent(new CustomEvent('atlas:select', { detail: { iso3: p } }));
  };
  // hovering a diagram strand isolates it (the rest fade)
  scroll.onmouseover = (ev) => {
    const p = ev.target.closest?.('.rp-chord path');
    if (!p) return;
    const svg = p.closest('svg');
    svg.classList.add('focusing');
    svg.querySelectorAll('path').forEach((q) => q.classList.toggle('hot', q === p));
  };
  scroll.onmouseout = (ev) => {
    const svg = ev.target.closest?.('.rp-chord svg');
    if (svg) { svg.classList.remove('focusing'); svg.querySelectorAll('path.hot').forEach((q) => q.classList.remove('hot')); }
  };
  const moreBtn = scroll.querySelector('.rp-ol-more');
  if (moreBtn) moreBtn.addEventListener('click', () => {
    const rest = scroll.querySelector('.rp-ol-rest');
    if (rest) { rest.hidden = false; moreBtn.remove(); }
  });
  return total;
}

// ── public init ───────────────────────────────────────────────
export function initRelationshipsPanel({ registry } = {}) {
  REGISTRY = registry;
  // Open ONLY on explicit request (the country chip's "Entanglements"
  // button) — clicking a country pins/focuses but no longer pops this up.
  document.addEventListener('atlas:open-relationships', async (e) => {
    const iso = e.detail && e.detail.iso3;
    if (!iso) return;
    // No longer gated on layer visibility (client 2026-06-16): the panel reads
    // its own data, so the chip's "Entanglements" button always works — you do
    // not have to switch a layer on first.
    await ensureData();
    ensurePanel();
    CURRENT = iso;
    const total = render(iso);
    if (total > 0) { PANEL.classList.add('open'); syncStandalone(); }
    else close();
  });
  // While already open, follow selection so the content tracks the pin.
  document.addEventListener('atlas:select', async (e) => {
    const iso = e.detail && e.detail.iso3;
    if (!iso) { close(); return; }                  // unpin closes
    if (!PANEL || !PANEL.classList.contains('open') || iso === CURRENT) return;
    await ensureData();
    CURRENT = iso;
    if (render(iso) > 0) syncStandalone(); else close();
  });
  // integration handle for the country chip
  window.atlasRelationshipsPanel = { close };
}
