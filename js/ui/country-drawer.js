// ─────────────────────────────────────────────────────────────
//  COUNTRY DRAWER — Agent E (Atlas v2 Country Readings)
//
//  A right-side drawer that opens on the `atlas:select` DOM event
//  (dispatched by app.js when a country is pinned). It renders:
//    · country name + CFCT score
//    · condition-cluster bars (meta-clusters from cti_scores.json)
//    · population-over-time sparkline
//    · size & geography row
//    · religion stacked bar
//    · practices-of-peace cards (curated) or a "coming soon" note
//    · a disabled "Read full page →" placeholder (v3)
//
//  Self-contained: injects its own <style>, owns its own DOM node.
//  Uses theme CSS variables so it matches bone / forest / dusk.
//  No errors for countries lacking data — every section is optional.
//
//  Public: export function initCountryDrawer({ registry, globe })
//  app.js auto-discovers this module and calls initCountryDrawer at startup.
// ─────────────────────────────────────────────────────────────

// Meta-cluster slug -> display label. Slugs are UNPREFIXED in cti_scores.json
// (e.g. "direct_violence"). Trauma clusters are tc_*, resilience are rf_*.
const META_CLUSTER_LABELS = {
  direct_violence: 'Direct Violence',
  structural_violence: 'Structural Violence',
  'identity-based_oppression': 'Identity-Based Oppression',
  interpersonal_violence_and_health: 'Interpersonal Violence & Health',
  displacement_and_environment: 'Displacement & Environment',
  wars_and_perpetration: 'Wars & Perpetration',
  genocide_and_mass_atrocities: 'Genocide & Mass Atrocities',
  famines_and_disasters: 'Famines & Disasters',
};
// stable display order
const META_ORDER = Object.keys(META_CLUSTER_LABELS);

// Resilience factors (rf_* in cti_scores.json). Labels mirror DOCS.resilience
// names; kept here so the order is stable even if docs reorder. Coverage varies
// widely per factor — absent factors are MISSING keys (shown as "no data", not 0).
const RF_LABELS = {
  rf_democracy: 'Democracy & Governance',
  rf_governance_quality: 'Governance Quality',
  rf_press_freedom: 'Press Freedom',
  rf_peace: 'Peace',
  rf_social_trust: 'Social Trust',
  rf_belonging: 'Belonging',
  rf_wellbeing: 'Wellbeing',
  rf_health: 'Health',
  rf_transitional_justice: 'Transitional Justice',
  rf_gender_equality: 'Gender Equality',
  rf_womens_education: "Women's Education",
  rf_womens_power: "Women's Political Power",
  rf_biodiversity: 'Biodiversity',
  rf_environmental_quality: 'Environmental Quality',
};
const RF_ORDER = Object.keys(RF_LABELS);

// "How it's built / decisions" notes per meta-cluster, shown in the ⓘ panel.
// Generic note for the rest; the death-toll families get their specific choices.
const CLUSTER_NOTES = {
  wars_and_perpetration: 'Battle-death tolls (Correlates of War, 1816–2007), scored per-capita then log-compressed. Successor states inherit the larger of their own or their parent state’s share (e.g. Ukraine ← USSR).',
  'genocide_and_mass_atrocities': 'Built only from established modern indices (UCDP One-sided Violence, ACLED, PITF Geno-/Politicide, TMK — ≈1946–2022). Historical cases (the Holocaust, the Armenian genocide, colonial atrocities) are not scored here; they are reserved for the beta Genocide layer.',
  famines_and_disasters: 'Cumulative death tolls (major famines, natural disasters), scored per-capita then log-compressed.',
};
const CLUSTER_NOTE_GENERIC = 'Each indicator is normalised to 0–100; the cluster is the mean of the indicators present. Absent data is shown as “no data”, never 0.';

// Build the ⓘ panel HTML for one meta-cluster: what's inside (member indicators
// + their sources/links) and how it was built. Pulls from indicator-docs.json.
function clusterInfoHtml(slug) {
  if (!DOCS || !Array.isArray(DOCS.metaClusters)) return '';
  const md = DOCS.metaClusters.find((m) => m.key === slug);
  if (!md) return '';
  const inds = DOCS.indicators || {};
  const members = (md.indicatorKeys || []).map((k) => {
    const ind = inds[k] || {};
    const srcs = (ind.sources || []).filter((s) => s && (s.url || s.id)).map((s) =>
      s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.id || 'source')}</a>` : esc(s.id)).join(' · ');
    return `<li><b>${esc(ind.name || k.replace(/^tc_/, '').replace(/_/g, ' '))}</b>${ind.description ? ` — ${esc(ind.description)}` : ''}${srcs ? `<div class="cd-ci-src">${srcs}</div>` : ''}</li>`;
  }).join('');
  const note = CLUSTER_NOTES[slug] || CLUSTER_NOTE_GENERIC;
  return `<div class="cd-ci">
    ${md.description ? `<div class="cd-ci-desc">${esc(md.description)}</div>` : ''}
    <ul class="cd-ci-list">${members}</ul>
    <div class="cd-ci-note">${note}</div>
  </div>`;
}

// ⓘ panel for one resilience factor: name, description, sources — from
// indicator-docs.json's `resilience` block (keyed by rf_* slug).
function resilienceInfoHtml(slug) {
  const rd = DOCS && DOCS.resilience && DOCS.resilience[slug];
  if (!rd) return '';
  const srcs = (rd.sources || []).filter((s) => s && (s.url || s.id)).map((s) =>
    s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.id || 'source')}</a>` : esc(s.id)).join(' · ');
  const inv = rd.invert ? `<div class="cd-ci-note">Higher raw values mean less resilience; the score is inverted so 100 = most resilient.</div>` : '';
  return `<div class="cd-ci">
    ${rd.description ? `<div class="cd-ci-desc">${esc(rd.description)}</div>` : ''}
    ${srcs ? `<div class="cd-ci-src">${srcs}</div>` : ''}
    ${inv}
    <div class="cd-ci-note">Normalised to 0–100 (100 = strongest). Absent data is shown as “no data”, never 0.</div>
  </div>`;
}

const RELIGION_COLORS = {
  Christian: '#9a7563', Muslim: '#8b6f47', Hindu: '#d4a574',
  Unaffiliated: '#b8a89a', Buddhist: '#c4a468', Jewish: '#c09050',
  Traditional: '#7a6a5a', Spiritualist: '#a68a70', Sikh: '#9d7e3f',
  Other: '#9a8a7a',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]
));

let DRAWER = null;        // the drawer DOM node
let CTI = null;           // cti_scores.json (lazy)
let COUNTRIES = null;     // countries.json (lazy)
let DOCS = null;          // indicator-docs.json (lazy) — per-cluster sources/build
let CURRENT = null;       // currently open iso3
let NAMES = {};           // iso3 -> display name (from cti or countries)

// ── styles ────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('country-drawer-css')) return;
  const css = `
  #country-drawer {
    position: fixed; top: 0; right: 0; height: 100vh; width: 380px; max-width: 92vw;
    z-index: 90; display: flex; flex-direction: column;
    background: var(--panel-bg, rgba(241,235,225,0.92));
    border-left: 1px solid var(--panel-border, rgba(26,22,18,0.12));
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    box-shadow: -18px 0 48px rgba(0,0,0,0.16);
    transform: translateX(100%); transition: transform .42s cubic-bezier(.22,1,.36,1);
    color: var(--ink, #1a1612);
    font-family: 'Inter', system-ui, sans-serif;
  }
  #country-drawer.open { transform: translateX(0); }
  @media (prefers-reduced-motion: reduce) { #country-drawer { transition: none; } }

  #country-drawer .cd-scroll { overflow-y: auto; padding: 26px 26px 40px; flex: 1; }
  #country-drawer .cd-close {
    position: absolute; top: 16px; right: 16px; z-index: 2;
    width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
    border: 1px solid var(--rule, #cfc4b2); background: transparent;
    color: var(--ink-dim, #555); font-size: 16px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    transition: background .2s, color .2s;
  }
  #country-drawer .cd-close:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); }

  #country-drawer .cd-eyebrow {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .16em;
    text-transform: uppercase; color: var(--accent, #b0522a); margin-bottom: 8px;
  }
  #country-drawer .cd-name {
    font-family: 'Source Serif 4', Georgia, serif; font-size: 30px; line-height: 1.1;
    font-weight: 500; color: var(--ink); margin: 0 0 18px;
  }

  /* CFCT score block */
  #country-drawer .cd-score { display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px; }
  #country-drawer .cd-score-val {
    font-family: 'Source Serif 4', serif; font-size: 44px; line-height: 1;
    color: var(--accent); font-weight: 500;
  }
  #country-drawer .cd-score-meta { font-size: 11px; color: var(--ink-faint, #8a8278); line-height: 1.45; }
  #country-drawer .cd-score-meta b { color: var(--ink-dim); font-weight: 600; }

  /* sections */
  #country-drawer .cd-section { margin: 26px 0 0; padding-top: 22px; border-top: 1px solid var(--rule, #cfc4b2); }
  #country-drawer .cd-section-title {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .16em;
    text-transform: uppercase; color: var(--ink-faint, #8a8278); margin-bottom: 14px; font-weight: 500;
    display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  }
  #country-drawer .cd-section-aside { color: var(--ink-dim); letter-spacing: .04em; }

  /* cluster bars */
  #country-drawer .cd-bar-row { margin-bottom: 11px; }
  #country-drawer .cd-bar-head {
    display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;
  }
  #country-drawer .cd-bar-label { font-size: 12px; color: var(--ink-dim); }
  #country-drawer .cd-bar-num {
    font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--ink-faint);
  }
  #country-drawer .cd-bar-track {
    height: 6px; border-radius: 3px; background: color-mix(in srgb, var(--rule) 55%, transparent);
    overflow: hidden;
  }
  #country-drawer .cd-bar-fill { height: 100%; border-radius: 3px; background: var(--accent); transition: width .5s ease; }
  /* resilience bars read GREEN (mirrors the resilience surface ramp on the map) */
  #country-drawer .cd-bar-fill.res { background: #5f8f5a; }
  /* absent meta-cluster: faded row, empty track, "no data" instead of a number */
  #country-drawer .cd-bar-absent { opacity: .6; }
  #country-drawer .cd-bar-absent .cd-bar-label { color: var(--ink-faint); }
  #country-drawer .cd-bar-nodata { font-style: italic; text-transform: none; letter-spacing: 0; }
  #country-drawer .cd-bar-absent .cd-bar-track { background: repeating-linear-gradient(45deg,
    color-mix(in srgb, var(--rule) 40%, transparent) 0 4px, transparent 4px 8px); }
  #country-drawer .cd-cluster-note { margin-top: 12px; font-size: 10.5px; line-height: 1.5;
    color: var(--ink-faint); border-top: 1px solid var(--rule); padding-top: 9px; }
  /* per-cluster info (ⓘ) */
  #country-drawer .cd-bar-right { display: inline-flex; align-items: center; gap: 7px; }
  #country-drawer .cd-ci-btn { width: 15px; height: 15px; flex: none; border-radius: 50%;
    border: 1px solid var(--rule); background: transparent; color: var(--ink-faint);
    font-family: 'Source Serif 4', serif; font-style: italic; font-size: 10px; line-height: 1;
    cursor: pointer; padding: 0; transition: color .15s, border-color .15s, background .15s; }
  #country-drawer .cd-ci-btn:hover { color: var(--ink); border-color: var(--ink-faint); }
  #country-drawer .cd-ci-btn.open { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  #country-drawer .cd-ci-panel { margin: 4px 0 2px; padding: 9px 11px; border-radius: 4px;
    background: var(--chip-bg); font-size: 11px; line-height: 1.5; color: var(--ink-dim); }
  #country-drawer .cd-ci-desc { color: var(--ink); margin-bottom: 7px; }
  #country-drawer .cd-ci-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
  #country-drawer .cd-ci-list b { color: var(--ink); font-weight: 600; }
  #country-drawer .cd-ci-src { margin-top: 2px; font-size: 10px; }
  #country-drawer .cd-ci-src a { color: var(--accent); text-decoration: none; border-bottom: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); }
  #country-drawer .cd-ci-src a:hover { border-bottom-color: var(--accent); }
  #country-drawer .cd-ci-note { margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--rule);
    font-size: 10px; color: var(--ink-faint); font-style: italic; }

  /* sparkline */
  #country-drawer .cd-spark-wrap { position: relative; width: 100%; height: 70px; }
  #country-drawer .cd-spark-wrap svg { width: 100%; height: 100%; display: block; }
  #country-drawer .cd-spark-foot {
    display: flex; justify-content: space-between; margin-top: 6px;
    font-family: 'JetBrains Mono', monospace; font-size: 9.5px; color: var(--ink-faint);
  }
  #country-drawer .cd-spark-now { color: var(--ink); font-weight: 600; }

  /* geography grid */
  #country-drawer .cd-geo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 18px; }
  #country-drawer .cd-geo-item { display: flex; flex-direction: column; }
  #country-drawer .cd-geo-label {
    font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: .14em;
    text-transform: uppercase; color: var(--ink-faint); margin-bottom: 5px;
  }
  #country-drawer .cd-geo-value { font-size: 13px; line-height: 1.3; color: var(--ink); font-weight: 500; }

  /* religion */
  #country-drawer .cd-rel-bar {
    width: 100%; height: 14px; border-radius: 2px; overflow: hidden; display: block; margin-bottom: 10px;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.06);
  }
  #country-drawer .cd-rel-bar svg { width: 100%; height: 100%; display: block; }
  #country-drawer .cd-rel-legend { font-size: 11px; line-height: 1.5; color: var(--ink-dim); }
  #country-drawer .cd-rel-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; vertical-align: baseline;
  }

  /* practices */
  #country-drawer .cd-practices { display: flex; flex-direction: column; gap: 14px; }
  #country-drawer .cd-practice { border-left: 2px solid var(--accent); padding-left: 12px; }
  #country-drawer .cd-practice-name {
    font-family: 'Source Serif 4', serif; font-size: 15px; font-weight: 500; line-height: 1.3;
    color: var(--ink); margin-bottom: 4px;
  }
  #country-drawer .cd-practice-meta {
    font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: .1em;
    text-transform: uppercase; color: var(--accent); margin-bottom: 6px;
  }
  #country-drawer .cd-practice-desc { font-size: 12px; line-height: 1.5; color: var(--ink-dim); }
  #country-drawer .cd-placeholder {
    font-size: 12px; color: var(--ink-dim); font-style: italic; padding: 14px;
    background: color-mix(in srgb, var(--rule) 30%, transparent); border-radius: 2px;
    border-left: 2px solid var(--rule);
  }

  /* CTA */
  #country-drawer .cd-cta-wrap { margin-top: 24px; padding-top: 22px; border-top: 1px solid var(--rule); }
  #country-drawer .cd-cta {
    display: inline-flex; align-items: center; gap: 8px; background: transparent;
    border: 1px solid var(--rule); color: var(--ink-faint);
    font-size: 13px; font-weight: 500; padding: 11px 16px; border-radius: 2px;
    cursor: not-allowed; opacity: .7;
  }
  #country-drawer .cd-cta-tag {
    font-family: 'JetBrains Mono', monospace; font-size: 8.5px; letter-spacing: .12em;
    text-transform: uppercase; margin-left: 4px; color: var(--ink-faint);
  }
  #country-drawer .cd-nodata { font-size: 12.5px; color: var(--ink-dim); font-style: italic; }

  /* ── PHONE: true full-screen drawer ── */
  @media (max-width: 640px) {
    #country-drawer {
      width: 100%; max-width: 100%; left: 0; right: 0;
      height: 100dvh;
    }
    #country-drawer .cd-scroll {
      padding:
        calc(env(safe-area-inset-top) + 26px)
        calc(env(safe-area-inset-right) + 20px)
        calc(env(safe-area-inset-bottom) + 40px)
        calc(env(safe-area-inset-left) + 20px);
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }
    #country-drawer .cd-close {
      top: calc(env(safe-area-inset-top) + 12px);
      right: calc(env(safe-area-inset-right) + 12px);
      width: 44px; height: 44px; font-size: 20px;
    }
  }
  `;
  const style = document.createElement('style');
  style.id = 'country-drawer-css';
  style.textContent = css;
  document.head.appendChild(style);
}

// ── data loading ──────────────────────────────────────────────
async function ensureData() {
  if (CTI && COUNTRIES) return;
  const loads = [];
  if (!CTI) loads.push(
    fetch('data/cti_scores.json').then((r) => r.json()).then((d) => { CTI = d; })
      .catch(() => { CTI = {}; })
  );
  if (!COUNTRIES) loads.push(
    fetch('data/countries.json').then((r) => r.json()).then((d) => { COUNTRIES = d; })
      .catch(() => { COUNTRIES = {}; })
  );
  if (!DOCS) loads.push(
    fetch('data/indicator-docs.json').then((r) => r.json()).then((d) => { DOCS = d; })
      .catch(() => { DOCS = {}; })
  );
  await Promise.all(loads);
  // build a name lookup
  for (const [iso, rec] of Object.entries(COUNTRIES || {})) {
    if (iso !== '_meta' && rec && rec.name) NAMES[iso] = rec.name;
  }
}

// ── renderers ─────────────────────────────────────────────────
function renderScore(cti) {
  if (!cti || cti.cti == null) {
    return `<div class="cd-nodata">No CFCT score available for this territory.</div>`;
  }
  const parts = [];
  if (cti.te != null) parts.push(`Trauma exposure <b>${cti.te.toFixed(1)}</b>`);
  if (cti.r != null) parts.push(`Resilience <b>${cti.r.toFixed(1)}</b>`);
  if (cti.cov_pct != null) parts.push(`Coverage <b>${Math.round(cti.cov_pct)}%</b>`);
  return `
    <div class="cd-score">
      <div class="cd-score-val">${cti.cti.toFixed(1)}</div>
      <div class="cd-score-meta">CFCT Index / 100<br>${parts.join(' · ')}</div>
    </div>`;
}

function renderClusters(cti) {
  if (!cti) return '';
  const rows = [];
  // ⓘ button + hidden info panel (sources / what's inside / how built) per row.
  const infoBtn = (slug) => `<button class="cd-ci-btn" data-ci="${esc(slug)}" type="button"
    title="About this cluster" aria-label="About ${esc(META_CLUSTER_LABELS[slug])}">i</button>`;
  const infoPanel = (slug) => `<div class="cd-ci-panel" data-ci-panel="${esc(slug)}" hidden>${clusterInfoHtml(slug)}</div>`;
  for (const slug of META_ORDER) {
    const v = cti[slug];
    if (typeof v !== 'number') {
      // ABSENT: no validated data for this meta-cluster in this country. Say so
      // explicitly — never paint a 0, which would read as "measured, none here".
      rows.push(`
        <div class="cd-bar-row cd-bar-absent">
          <div class="cd-bar-head">
            <span class="cd-bar-label">${esc(META_CLUSTER_LABELS[slug])}</span>
            <span class="cd-bar-right"><span class="cd-bar-num cd-bar-nodata">no data</span>${infoBtn(slug)}</span>
          </div>
          <div class="cd-bar-track"></div>
          ${infoPanel(slug)}
        </div>`);
      continue;
    }
    const pct = Math.max(0, Math.min(100, v));
    rows.push(`
      <div class="cd-bar-row">
        <div class="cd-bar-head">
          <span class="cd-bar-label">${esc(META_CLUSTER_LABELS[slug])}</span>
          <span class="cd-bar-right"><span class="cd-bar-num">${v < 0.5 ? '&lt;1' : Math.round(v)}</span>${infoBtn(slug)}</span>
        </div>
        <div class="cd-bar-track"><div class="cd-bar-fill" style="width:${pct}%"></div></div>
        ${infoPanel(slug)}
      </div>`);
  }
  if (!rows.length) return '';
  return `
    <div class="cd-section">
      <div class="cd-section-title">Condition Clusters</div>
      ${rows.join('')}
      <div class="cd-cluster-note">Genocide &amp; Mass Atrocities draws on modern datasets
        (≈1946–2022) — earlier events (the Holocaust, the Armenian genocide, colonial
        atrocities) and the most recent ones are not captured here. The curated historical
        record will be shown in a beta layer, coming in a future version.</div>
    </div>`;
}

// Resilience Factors — the drill-down of the single "Resilience" score, shown
// in every Country Reading regardless of the active surface. Mirrors
// renderClusters: green bars, per-factor ⓘ, and an explicit "no data" row
// (never a painted 0) for factors absent in this country.
function renderResilience(cti) {
  if (!cti) return '';
  const infoBtn = (slug) => `<button class="cd-ci-btn" data-ci="${esc(slug)}" type="button"
    title="About this factor" aria-label="About ${esc(RF_LABELS[slug])}">i</button>`;
  const infoPanel = (slug) => `<div class="cd-ci-panel" data-ci-panel="${esc(slug)}" hidden>${resilienceInfoHtml(slug)}</div>`;
  const rows = [];
  for (const slug of RF_ORDER) {
    const v = cti[slug];
    if (typeof v !== 'number') {
      rows.push(`
        <div class="cd-bar-row cd-bar-absent">
          <div class="cd-bar-head">
            <span class="cd-bar-label">${esc(RF_LABELS[slug])}</span>
            <span class="cd-bar-right"><span class="cd-bar-num cd-bar-nodata">no data</span>${infoBtn(slug)}</span>
          </div>
          <div class="cd-bar-track"></div>
          ${infoPanel(slug)}
        </div>`);
      continue;
    }
    const pct = Math.max(0, Math.min(100, v));
    rows.push(`
      <div class="cd-bar-row">
        <div class="cd-bar-head">
          <span class="cd-bar-label">${esc(RF_LABELS[slug])}</span>
          <span class="cd-bar-right"><span class="cd-bar-num">${v < 0.5 ? '&lt;1' : Math.round(v)}</span>${infoBtn(slug)}</span>
        </div>
        <div class="cd-bar-track"><div class="cd-bar-fill res" style="width:${pct}%"></div></div>
        ${infoPanel(slug)}
      </div>`);
  }
  if (!rows.length) return '';
  const score = (cti.r != null && !isNaN(cti.r))
    ? `<span class="cd-section-aside">Resilience ${cti.r.toFixed(1)} / 100</span>` : '';
  return `
    <div class="cd-section">
      <div class="cd-section-title">Resilience Factors${score}</div>
      ${rows.join('')}
      <div class="cd-cluster-note">Resilience indicates where the collective capacity for
        mitigation, awareness, and integration may exist. Coverage varies by factor; blanks
        mean the indicator is not available for this territory, not that it scores zero.</div>
    </div>`;
}

function sparklineSVG(pop) {
  const w = 320, h = 70, pad = 6;
  const xs = pop.map((d) => d.year);
  const ys = pop.map((d) => d.value);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = (maxX - minX) || 1, rangeY = (maxY - minY) || 1;
  const pts = pop.map((d) => {
    const x = ((d.year - minX) / rangeX) * (w - pad * 2) + pad;
    const y = h - pad - ((d.value - minY) / rangeY) * (h - pad * 2);
    return [x, y];
  });
  const path = 'M ' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L ');
  const area = `${path} L ${pts[pts.length - 1][0].toFixed(1)},${h} L ${pts[0][0].toFixed(1)},${h} Z`;
  const last = pts[pts.length - 1];
  return `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="${area}" fill="var(--accent)" opacity="0.10"/>
      <path d="${path}" stroke="var(--accent)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6" fill="var(--accent)"/>
    </svg>`;
}

function fmtPop(m) {
  if (m == null) return '';
  if (m >= 1000) return (m / 1000).toFixed(2) + 'B';
  if (m >= 1) return m.toFixed(1) + 'M';
  return Math.round(m * 1000) + 'K';
}

function renderPopulation(rec) {
  const pop = rec && rec.population;
  if (!pop || pop.length < 2) return '';
  const first = pop[0], last = pop[pop.length - 1];
  return `
    <div class="cd-section">
      <div class="cd-section-title">Population Over Time</div>
      <div class="cd-spark-wrap">${sparklineSVG(pop)}</div>
      <div class="cd-spark-foot">
        <span>${first.year} · ${fmtPop(first.value)}</span>
        <span class="cd-spark-now">${last.year} · ${fmtPop(last.value)}</span>
      </div>
    </div>`;
}

function renderGeography(rec) {
  const g = rec && rec.geography;
  if (!g) return '';
  const items = [
    ['Area', g.area], ['Capital', g.capital],
    ['Region', g.region], ['Languages', g.languages],
  ].filter(([, v]) => v);
  if (!items.length) return '';
  return `
    <div class="cd-section">
      <div class="cd-section-title">Size & Geography</div>
      <div class="cd-geo-grid">
        ${items.map(([k, v]) => `
          <div class="cd-geo-item">
            <div class="cd-geo-label">${esc(k)}</div>
            <div class="cd-geo-value">${esc(v)}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderReligion(rec) {
  const rel = rec && rec.religion;
  if (!rel || !rel.length) return '';
  const total = rel.reduce((s, r) => s + (r.pct || 0), 0) || 1;
  let xOff = 0;
  const segs = rel.map((r) => {
    const w = (r.pct / total) * 320;
    const c = RELIGION_COLORS[r.name] || RELIGION_COLORS.Other;
    const seg = `<rect x="${xOff.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="14" fill="${c}"/>`;
    xOff += w;
    return seg;
  }).join('');
  const legend = rel
    .filter((r) => r.pct >= 1)
    .map((r) => {
      const c = RELIGION_COLORS[r.name] || RELIGION_COLORS.Other;
      return `<span class="cd-rel-dot" style="background:${c}"></span>${esc(r.name)} ${Math.round(r.pct)}%`;
    })
    .join(' &nbsp; ');
  return `
    <div class="cd-section">
      <div class="cd-section-title">Religion</div>
      <div class="cd-rel-bar"><svg viewBox="0 0 320 14" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${segs}</svg></div>
      <div class="cd-rel-legend">${legend}</div>
    </div>`;
}

function renderPractices(rec) {
  const practices = rec && rec.practices;
  let body;
  if (practices && practices.length) {
    body = `<div class="cd-practices">${practices.map((p) => `
      <div class="cd-practice">
        <div class="cd-practice-name">${esc(p.name)}</div>
        ${p.meta ? `<div class="cd-practice-meta">${esc(p.meta)}</div>` : ''}
        ${p.desc ? `<div class="cd-practice-desc">${esc(p.desc)}</div>` : ''}
      </div>`).join('')}</div>`;
  } else {
    body = `<div class="cd-placeholder">Curated practices of peace for this country are coming soon.</div>`;
  }
  return `
    <div class="cd-section">
      <div class="cd-section-title">Practices of Peace</div>
      ${body}
    </div>`;
}

function renderCTA() {
  return `
    <div class="cd-cta-wrap">
      <span class="cd-cta">Read full page <span>→</span><span class="cd-cta-tag">v3</span></span>
    </div>`;
}

function renderDrawer(iso3) {
  const cti = (CTI && CTI[iso3]) || null;
  const rec = (COUNTRIES && COUNTRIES[iso3]) || null;
  const name = (rec && rec.name) || NAMES[iso3] || iso3;

  const hasAnything = cti || rec;
  const sections = [
    renderScore(cti),
    renderClusters(cti),
    renderResilience(cti),
    renderPopulation(rec),
    renderGeography(rec),
    renderReligion(rec),
    renderPractices(rec),
    // renderCTA removed — "Read full page → v3" pointed nowhere
  ].join('');

  DRAWER.querySelector('.cd-scroll').innerHTML = `
    <div class="cd-eyebrow">Country Reading · ${esc(iso3)}</div>
    <h2 class="cd-name">${esc(name)}</h2>
    ${hasAnything ? sections : `<div class="cd-nodata">No data is available for this territory yet.</div>${renderPractices(null)}`}
  `;
  DRAWER.querySelector('.cd-scroll').scrollTop = 0;
  // wire the per-cluster ⓘ toggles
  DRAWER.querySelectorAll('.cd-ci-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = DRAWER.querySelector(`.cd-ci-panel[data-ci-panel="${btn.dataset.ci}"]`);
      if (!panel) return;
      const open = panel.hidden;
      panel.hidden = !open;
      btn.classList.toggle('open', open);
    });
  });
}

// ── open / close ──────────────────────────────────────────────
function openDrawer(iso3) {
  CURRENT = iso3;
  renderDrawer(iso3);
  DRAWER.classList.add('open');
  DRAWER.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  CURRENT = null;
  DRAWER.classList.remove('open');
  DRAWER.setAttribute('aria-hidden', 'true');
}

// ── entry point ───────────────────────────────────────────────
export function initCountryDrawer({ registry, globe } = {}) {
  injectStyles();

  if (!DRAWER) {
    DRAWER = document.createElement('aside');
    DRAWER.id = 'country-drawer';
    DRAWER.setAttribute('aria-hidden', 'true');
    DRAWER.innerHTML = `
      <button class="cd-close" type="button" aria-label="Close">×</button>
      <div class="cd-scroll"></div>`;
    document.body.appendChild(DRAWER);
    // closing the drawer no longer unpins the globe — the pin (and its arc
    // focus) belongs to the country chip; its × is the unpin.
    DRAWER.querySelector('.cd-close').addEventListener('click', () => closeDrawer());
  }

  // Open ONLY on explicit request (the country chip's "Details" button) —
  // clicking a country on the globe pins/focuses but no longer pops this up.
  document.addEventListener('atlas:open-drawer', async (e) => {
    const iso3 = e.detail && e.detail.iso3;
    if (!iso3) return;
    try {
      await ensureData();
      openDrawer(iso3);
    } catch (err) {
      console.warn('[country-drawer] failed to open:', err);
    }
  });
  // While already open, follow selection so the content tracks the pin.
  document.addEventListener('atlas:select', async (e) => {
    const iso3 = e.detail && e.detail.iso3;
    if (!iso3) { closeDrawer(); return; }          // unpin closes
    if (!DRAWER.classList.contains('open') || iso3 === CURRENT) return;
    try { await ensureData(); openDrawer(iso3); } catch (err) { /* keep prior */ }
  });

  // expose a tiny test/integration handle
  window.atlasCountryDrawer = { open: async (iso) => { await ensureData(); openDrawer(iso); }, close: closeDrawer };
}

export default { initCountryDrawer };
