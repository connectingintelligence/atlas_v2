// ─────────────────────────────────────────────────────────────
//  WEIGHTING PANEL — interactive 0–100 weights for the CFCT surface.
//
//  Two levels: the 8 meta-clusters, or the individual indicators
//  (the 28 trauma clusters, grouped by meta-cluster). Moving any slider
//  recomputes the choropleth live (the cfct-composite layer listens for
//  the 'atlas:weights' event and recomputes the full CFCT formula with
//  the custom weights — all sliders at 100 reproduces the default CFCT).
//
//  Each row carries an "i" button → real per-indicator documentation
//  (name · what it measures · source URL) pulled from indicator-docs.json,
//  which is generated from the v1 pipeline config.py (no fabricated text).
//
//  Public API:  initWeightingPanel({ registry, globe })
// ─────────────────────────────────────────────────────────────

import { loadJSON } from '../core/data-loader.js';

const CFCT_ID = 'cfct-composite';

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  #wt-toggle { position:fixed; left:28px; bottom:24px; z-index:60;
    display:inline-flex; align-items:center; gap:8px; background:var(--panel-bg);
    border:1px solid var(--panel-border); backdrop-filter:blur(14px); color:var(--ink-dim);
    font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.04em;
    padding:8px 13px; border-radius:999px; cursor:pointer; transition:color .18s,border-color .18s; }
  #wt-toggle:hover { color:var(--ink); border-color:var(--ink-faint); }
  #wt-toggle.on { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }

  #wt-panel { position:fixed; left:332px; top:50%; transform:translateY(-50%) translateX(-130%);
    width:330px; max-height:78vh; display:flex; flex-direction:column; z-index:78;
    background:var(--bg); border:1px solid var(--rule); border-radius:5px;
    box-shadow:0 12px 44px var(--shadow,rgba(0,0,0,.2));
    opacity:0; pointer-events:none; transition:transform .4s cubic-bezier(.22,.8,.25,1), opacity .3s ease; }
  #wt-panel.open { transform:translateY(-50%) translateX(0); opacity:1; pointer-events:auto; }
  #wt-head { padding:18px 18px 12px; border-bottom:1px solid var(--rule); flex:none; }
  #wt-head .wt-title { font-family:'Source Serif 4',serif; font-size:18px; color:var(--ink); }
  #wt-head .wt-sub { font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:.12em;
    text-transform:uppercase; color:var(--ink-faint); margin-top:4px; }
  #wt-close { position:absolute; top:14px; right:16px; background:transparent; border:none;
    color:var(--ink-faint); font-size:17px; cursor:pointer; }
  #wt-close:hover { color:var(--ink); }
  #wt-tabs { display:flex; gap:2px; margin-top:12px; border:1px solid var(--rule); border-radius:3px; overflow:hidden; }
  #wt-tabs button { flex:1; background:transparent; border:none; color:var(--ink-dim);
    font-family:inherit; font-size:11.5px; padding:7px 0; cursor:pointer; transition:background .2s,color .2s; }
  #wt-tabs button.active { background:var(--accent); color:var(--accent-ink); }
  #wt-body { overflow-y:auto; padding:10px 18px 16px; flex:1; scrollbar-width:thin; scrollbar-color:var(--rule) transparent; }
  #wt-body::-webkit-scrollbar { width:6px; } #wt-body::-webkit-scrollbar-thumb { background:var(--rule); border-radius:3px; }
  .wt-group-h { font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:.13em; text-transform:uppercase;
    color:var(--ink-faint); margin:16px 0 7px; padding-bottom:4px; border-bottom:1px solid var(--rule); }
  .wt-group-h:first-child { margin-top:4px; }
  #wt-warn { margin:0 0 4px; padding:10px 14px; font-size:12px; line-height:1.5;
    color:var(--ink); background:color-mix(in srgb, var(--accent) 12%, var(--bg));
    border-top:1px solid var(--panel-border); border-bottom:1px solid var(--panel-border); }
  #wt-warn[hidden] { display:none; }
  .wt-row { margin-bottom:11px; }
  .wt-row-top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:3px; }
  .wt-name { font-size:12.5px; color:var(--ink-dim); flex:1; }
  .wt-row.muted .wt-name { color:var(--ink-faint); text-decoration:line-through; }
  .wt-val { font-family:'JetBrains Mono',monospace; font-size:10.5px; color:var(--ink); min-width:26px; text-align:right; }
  .wt-cov { font-family:'JetBrains Mono',monospace; font-size:9px; color:var(--ink-faint); letter-spacing:.03em; }
  .wt-cov.sparse { color:var(--arc-perp); }
  .wt-doc-cov { display:block; margin-top:5px; font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--ink-dim); }
  .wt-i { width:17px; height:17px; flex:none; border-radius:50%; border:1px solid var(--rule); background:transparent;
    color:var(--ink-faint); font-family:'Source Serif 4',serif; font-style:italic; font-size:10px; cursor:pointer; line-height:1; }
  .wt-i:hover, .wt-i.on { color:var(--ink); border-color:var(--ink-faint); }
  .wt-row input[type=range] { width:100%; accent-color:var(--accent); }
  .wt-doc { font-size:11.5px; line-height:1.55; color:var(--ink-faint); background:var(--chip-bg);
    border-radius:3px; padding:8px 10px; margin-top:5px; display:none; }
  .wt-doc.open { display:block; }
  .wt-doc .wt-doc-src { display:block; margin-top:5px; }
  .wt-doc a { color:var(--accent); text-decoration:none; border-bottom:1px solid color-mix(in srgb,var(--accent) 40%,transparent); word-break:break-all; }
  #wt-foot { flex:none; display:flex; justify-content:space-between; align-items:center;
    padding:10px 18px; border-top:1px solid var(--rule); font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--ink-faint); }
  #wt-foot .wt-btns { display:flex; gap:6px; }
  #wt-foot .wt-btn { background:transparent; border:1px solid var(--rule); color:var(--ink-dim); font-family:inherit;
    font-size:10px; padding:5px 11px; border-radius:3px; cursor:pointer; transition:color .18s,border-color .18s; }
  #wt-foot .wt-btn:hover { color:var(--ink); border-color:var(--ink-faint); }
  @media (max-width:900px){ #wt-panel{ width:88vw; } }

  /* ── Phone pass (Agent F): full-screen sheet + tappable controls ≤640px ── */
  @media (max-width:640px){
    /* Weighting is hidden on phones (client: overkill for mobile). The panel is
       desktop-only; the toggle simply isn't shown ≤640px. Desktop unchanged. */
    #wt-toggle { display:none; }
    #wt-panel { left:0; right:0; top:0; bottom:auto; width:100%; max-width:100%;
      height:100dvh; max-height:100dvh; border:none; border-radius:0;
      transform:translateY(100%); }
    #wt-panel.open { transform:translateY(0); }
    #wt-head { padding:calc(env(safe-area-inset-top) + 16px)
      calc(env(safe-area-inset-right) + 18px) 12px calc(env(safe-area-inset-left) + 18px); }
    #wt-close { width:44px; height:44px; font-size:21px; top:calc(env(safe-area-inset-top) + 6px);
      right:calc(env(safe-area-inset-right) + 8px); }
    #wt-tabs button { min-height:42px; font-size:12.5px; }
    #wt-body { padding-left:calc(env(safe-area-inset-left) + 18px);
      padding-right:calc(env(safe-area-inset-right) + 18px); }
    .wt-row { margin-bottom:16px; }
    .wt-row input[type=range] { height:40px; touch-action:none; }
    .wt-i { width:40px; height:40px; font-size:14px; }
    #wt-foot { padding:12px calc(env(safe-area-inset-right) + 18px)
      calc(env(safe-area-inset-bottom) + 12px) calc(env(safe-area-inset-left) + 18px); }
    #wt-foot .wt-btn { min-height:40px; padding:8px 14px; font-size:11px; }
  }`;
  const s = document.createElement('style');
  s.id = 'atlas-weighting-css'; s.textContent = css;
  document.head.appendChild(s);
}

export async function initWeightingPanel({ registry, globe } = {}) {
  injectStyles();
  let docs;
  try { docs = await loadJSON('data/indicator-docs.json'); }
  catch (e) { console.warn('weighting-panel: indicator-docs.json missing', e); return; }

  const metaList = docs.metaClusters || [];
  const indicators = docs.indicators || {};
  const resilience = docs.resilience || {};

  // weights state per level (key → 0..100, default 100)
  const state = {
    level: 'meta',
    meta: Object.fromEntries(metaList.map((m) => [m.key, 100])),
    indicators: Object.fromEntries(Object.keys(indicators).map((k) => [k, 100])),
    resilience: Object.fromEntries(Object.keys(resilience).map((k) => [k, 100])),
  };

  // ── DOM ──
  const toggle = document.createElement('button');
  toggle.id = 'wt-toggle'; toggle.innerHTML = '⚖ Weighting';
  document.body.appendChild(toggle);

  const panel = document.createElement('aside');
  panel.id = 'wt-panel';
  panel.innerHTML = `
    <div id="wt-head">
      <button id="wt-close" title="Close">×</button>
      <div class="wt-title">Custom weighting</div>
      <div class="wt-sub">Re-weight the surface · 0–100</div>
      <div id="wt-tabs">
        <button data-level="meta" class="active">Meta-clusters</button>
        <button data-level="indicators">Indicators</button>
        <button data-level="resilience">Resilience</button>
      </div>
    </div>
    <div id="wt-warn" hidden>⚠ <b>Every weight is 0</b>, so the map has nothing to show.
      Raise at least one <b>condition cluster</b> (warm trauma map) or one
      <b>resilience factor</b> (green resilience map).</div>
    <div id="wt-body"></div>
    <div id="wt-foot"><span id="wt-hint">drag to re-weight</span>
      <span class="wt-btns">
        <button id="wt-zero" class="wt-btn" title="Set every weight to 0">All → 0</button>
        <button id="wt-reset" class="wt-btn" title="Set every weight to 100">All → 100</button>
      </span></div>`;
  document.body.appendChild(panel);

  const body = panel.querySelector('#wt-body');

  // members per meta-cluster: meta sliders are GROUP HANDLES — they write
  // through to their member indicators, so the 28 indicator weights are the
  // single source of truth (no hidden meta × indicator multiplication)
  const membersOf = Object.fromEntries(metaList.map((m) => [m.key, m.indicatorKeys || []]));
  const metaDisplay = (key) => {
    const ks = membersOf[key] || [];
    if (!ks.length) return 100;
    return Math.round(ks.reduce((s, k) => s + (state.indicators[k] ?? 100), 0) / ks.length);
  };

  function docRow(key, info) {
    const w = state.level === 'meta' ? metaDisplay(key) : state[state.level][key];
    const cov = info.coverage || {};
    const srcHtml = (info.sources || []).filter((s) => s.url || s.notes).map((s) =>
      `<span class="wt-doc-src">${s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${s.id}</a>` : s.id}${s.notes ? ` — ${s.notes}` : ''}</span>`).join('');
    // at-a-glance coverage chip (non-zero / total); flag sparse coverage in warm
    const covChip = cov.total
      ? `<span class="wt-cov ${cov.nonzero < cov.total * 0.34 ? 'sparse' : ''}" title="countries with non-zero data">${cov.nonzero}/${cov.total}</span>`
      : '';
    const covLine = cov.total
      ? `<span class="wt-doc-cov">Coverage: ${cov.present}/${cov.total} countries reported · ${cov.nonzero} non-zero · mean ${cov.mean}/100 · max ${cov.max}</span>`
      : '';
    const hasDoc = info.description || srcHtml || covLine;
    return `<div class="wt-row ${w <= 0 ? 'muted' : ''}" data-key="${key}">
      <div class="wt-row-top">
        <span class="wt-name">${info.name || key}</span>
        ${covChip}
        <span class="wt-val">${w}</span>
        ${hasDoc ? '<button class="wt-i" title="About this indicator">i</button>' : ''}
      </div>
      <input type="range" min="0" max="100" step="1" value="${w}">
      ${hasDoc ? `<div class="wt-doc">${info.description ? `<span>${info.description}</span>` : ''}${covLine}${srcHtml}</div>` : ''}
    </div>`;
  }

  function renderBody() {
    if (state.level === 'meta') {
      body.innerHTML = metaList.map((m) => docRow(m.key, m)).join('');
    } else if (state.level === 'resilience') {
      // resilience factors enter the weighted surface as its dampener term.
      // NOTE: the Custom-weighting surface is always TRAUMA-based (warm palette);
      // these sliders only soften it by ≤20%. Users kept reading this tab as a
      // "resilience surface" and wondering why the map stayed red — so spell it out
      // and point them to Surface → Resilience for an actual green resilience map.
      body.innerHTML = '<div class="wt-group-h">Resilience factors</div>'
        + '<div style="font-size:11.5px;line-height:1.5;color:var(--ink-dim);background:var(--chip-bg);'
        + 'border-left:2px solid var(--accent);border-radius:2px;padding:8px 10px;margin:0 0 12px;">'
        + 'While any condition (trauma) weight is up, these factors <b>dampen the trauma surface</b> (by up to 20%). '
        + 'Set <b>every condition weight to 0</b> (Meta-clusters → All → 0) and the map becomes a <b>green resilience '
        + 'surface</b> that these sliders shape directly — weight each factor in or out.</div>'
        + Object.entries(resilience).map(([k, info]) => docRow(k, info)).join('');
    } else {
      // group trauma indicators under their meta-cluster
      body.innerHTML = metaList.map((m) => {
        const rows = (m.indicatorKeys || []).map((k) => docRow(k, indicators[k] || {})).join('');
        return `<div class="wt-group-h">${m.name}</div>${rows}`;
      }).join('');
    }
    wireRows();
  }

  function wireRows() {
    body.querySelectorAll('.wt-row').forEach((row) => {
      const key = row.dataset.key;
      const slider = row.querySelector('input[type=range]');
      const val = row.querySelector('.wt-val');
      slider.addEventListener('input', () => {
        const v = +slider.value;
        if (state.level === 'meta') {
          // group handle: set every member indicator to this value
          state.meta[key] = v;
          for (const k of membersOf[key] || []) state.indicators[k] = v;
        } else {
          state[state.level][key] = v;
        }
        val.textContent = v;
        row.classList.toggle('muted', v <= 0);
        emit();
      });
      row.querySelector('.wt-i')?.addEventListener('click', (e) => {
        e.target.classList.toggle('on');
        row.querySelector('.wt-doc')?.classList.toggle('open');
      });
    });
  }

  // meta→indicator parentage so the layer can compose meta% × indicator%
  // into one effective weight per trauma indicator
  const parents = {};
  for (const m of metaList) for (const k of m.indicatorKeys || []) parents[k] = m.key;

  // Warn only when there is genuinely NOTHING to map — every trauma weight AND
  // every resilience weight at 0. (Trauma 0 + resilience up now maps a pure
  // resilience surface, so that's no longer a blank/warning case.)
  const warnEl = panel.querySelector('#wt-warn');
  function updateWarn() {
    const traumaAllZero = Object.values(state.indicators).every((v) => !v || v <= 0);
    const resilAllZero = Object.values(state.resilience).every((v) => !v || v <= 0);
    warnEl.hidden = !(traumaAllZero && resilAllZero);
  }

  function emit() {
    updateWarn();
    // Send ALL THREE tab maps every time: the weighted surface is a full
    // CFCT recomputation (trauma weights + resilience dampener together),
    // not a per-tab flat mean — see cfct-composite weightedValue().
    document.dispatchEvent(new CustomEvent('atlas:weights', {
      detail: {
        level: state.level,
        weights: { ...state[state.level] },   // legacy field
        all: {
          meta: { ...state.meta },
          indicators: { ...state.indicators },
          resilience: { ...state.resilience },
        },
        parents,
      },
    }));
  }

  // ── interactions ──
  function open() {
    panel.classList.add('open'); toggle.classList.add('on');
    // ensure cfct is the active surface AND in weighted mode, then push weights
    registry.setVisible(CFCT_ID, true);
    registry.setControl(CFCT_ID, 'mode', 'weighted');
    emit();
  }
  function close() { panel.classList.remove('open'); toggle.classList.remove('on'); }

  toggle.addEventListener('click', () => (panel.classList.contains('open') ? close() : open()));
  panel.querySelector('#wt-close').addEventListener('click', close);
  panel.querySelectorAll('#wt-tabs button').forEach((b) => b.addEventListener('click', () => {
    state.level = b.dataset.level;
    panel.querySelectorAll('#wt-tabs button').forEach((x) => x.classList.toggle('active', x === b));
    renderBody();
    emit();
  }));
  function setAll(v) {
    const lvl = state[state.level];
    Object.keys(lvl).forEach((k) => (lvl[k] = v));
    // meta tab is a group handle — write through to the real weights
    if (state.level === 'meta') Object.keys(state.indicators).forEach((k) => (state.indicators[k] = v));
    renderBody(); emit();
  }
  panel.querySelector('#wt-reset').addEventListener('click', () => setAll(100));
  panel.querySelector('#wt-zero').addEventListener('click', () => setAll(0));

  renderBody();
}
