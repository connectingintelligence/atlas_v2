// ─────────────────────────────────────────────────────────────
//  LAYER: entanglement-slavetrade
//  The trans-Atlantic and intra-American slave trade as flows —
//  SlaveVoyages.org voyage records aggregated per (purchase region →
//  disembarkation region). The atlas's central thesis (colonial
//  entanglement that outlasts empire) begins here.
//
//  DESIGN STANCE — memorial stillness, like the genocide layer:
//  no marching dashes, no particles. Hue = the carrier empire (vessel
//  flag), width = √(captives disembarked). Endpoints are HISTORICAL
//  COASTAL REGIONS with explicit coordinates, not modern states — the
//  Bight of Benin is not Nigeria. (Consequence: pinning a country does
//  not focus these arcs; they are not country-keyed, by design.)
//
//  Data: data/slavetrade.json (591 region pairs, 10.1M embarked /
//  8.85M disembarked across mapped pairs — the gap is the death toll
//  of the crossings).
// ─────────────────────────────────────────────────────────────

import { createArcRenderer } from '../../viz/arc-renderer.js';

// muted, sombre palette per carrier flag — identity, not celebration
const FLAG_COLOR = {
  'Portugal / Brazil': '#8a6248',
  'Portugal': '#8a6248',
  'Great Britain': '#9c4a3c',
  'France': '#5d6b85',
  'Spain / Uruguay': '#a08544',
  'Spain': '#a08544',
  'Netherlands': '#a06a35',
  'U.S.A.': '#5e6e64',
  'Denmark / Baltic': '#6b8587',
  'Denmark': '#6b8587',
};
const FALLBACK_COLOR = '#7a7066';

// SlaveVoyages records some flags as combined colonial categories — a colonising
// power merged with the colony/successor state that flew the same flag tradition
// (Portugal/Brazil, Spain/Uruguay, Denmark/Baltic). We DISPLAY these under the
// colonising power: a colony did not organise its own subjugation, so the
// responsibility sits with the power whose system ran the trade. This is our
// editorial framing — the raw source categories are unchanged in the data; see
// methodology/slavetrade.md.
const FLAG_CANON = {
  'Portugal / Brazil': 'Portugal',
  'Spain / Uruguay': 'Spain',
  'Denmark / Baltic': 'Denmark',
};
const canonFlag = (f) => FLAG_CANON[f] || f;

export default {
  id: 'entanglement-slavetrade',
  // "Slave Voyages" not "Slave trade" (client note): the arcs trace the
  // voyages themselves (purchase region → disembarkation region), not the
  // commercial trade between the European powers that profited from it.
  label: 'Slave Voyages',
  group: 'entanglement',
  methodologyPath: 'methodology/slavetrade.md',
  dataPath: 'data/slavetrade.json',
  controls: [
    { id: 'opacity', label: 'Arc intensity', type: 'slider', default: 0.6, min: 0.05, max: 1, step: 0.05 },
    {
      // span-filter like the colonies layer: default ALL (the trade spans
      // 1514–1866; the global scrubber usually sits in the present)
      id: 'timeMode', label: 'Time', type: 'select', default: 'all',
      options: [
        { value: 'all', label: 'All voyages (1514–1866)' },
        { value: 'year', label: 'Active at scrubbed year' },
      ],
    },
    {
      id: 'minVoyages', label: 'Min voyages', type: 'select', default: '10',
      options: [
        { value: '0', label: 'All routes' },
        { value: '10', label: '≥ 10 voyages' },
        { value: '50', label: '≥ 50 voyages' },
        { value: '200', label: '≥ 200 voyages' },
      ],
    },
  ],

  render(ctx) {
    const data = ctx.data || {};
    const all = Array.isArray(data.arcs) ? data.arcs : [];
    const maxDis = Math.max(1, ...all.map((a) => a.disembarked || 0));
    const widthOf = (v) => 0.5 + 5.5 * Math.sqrt(Math.max(0, v) / maxDis);

    // Per-route hover tooltip listing the CARRIER FLAGS — i.e. which powers
    // organised the voyages on that route. The data already carries a per-route
    // `flags` breakdown (voyage counts) + `flag_top`; this just surfaces it.
    // Each arc gets a stable id so we can match the rendered path back to it.
    const nf = (n) => (n || 0).toLocaleString('en-US');
    const flagText = (a) => {
      const merged = new Map();
      for (const [f, n] of Object.entries(a.flags || {})) {
        const c = canonFlag(f); merged.set(c, (merged.get(c) || 0) + n);
      }
      const entries = [...merged.entries()].sort((x, y) => y[1] - x[1]);
      const top = entries.slice(0, 6).map(([f, n]) => `${f} ${nf(n)}`).join(' · ');
      return top + (entries.length > 6 ? ` · +${entries.length - 6} more` : '');
    };
    const titleById = new Map();
    all.forEach((a) => {
      a.id = `${a.fromName}→${a.toName}`;
      titleById.set(a.id, `${a.fromName} → ${a.toName}\n`
        + `${nf(a.voyages)} voyages · ${nf(a.disembarked)} disembarked\n`
        + `Carriers (flag): ${flagText(a)}`);
    });
    const SVGNS = 'http://www.w3.org/2000/svg';
    function applyTitles() {
      ctx.group.selectAll('path.arc').each(function () {
        const t = titleById.get(this.getAttribute('data-id'));
        if (!t) return;
        let el = this.querySelector('title');
        if (!el) { el = document.createElementNS(SVGNS, 'title'); this.appendChild(el); }
        if (el.textContent !== t) el.textContent = t;
      });
    }

    const arcs = createArcRenderer(ctx.group, ctx);

    function visible() {
      const minV = +ctx.getControl('minVoyages') || 0;
      const mode = ctx.getControl('timeMode') || 'all';
      const yr = ctx.getYear();
      const allTime = !!(ctx.isAllTime && ctx.isAllTime());
      return all.filter((a) => {
        if ((a.voyages || 0) < minV) return false;
        if (mode === 'year' && !allTime && Number.isFinite(yr)) {
          if (a.year_start != null && a.year_end != null && (yr < a.year_start || yr > a.year_end)) return false;
        }
        return true;
      });
    }

    function redraw() {
      const op = +ctx.getControl('opacity');
      arcs.draw(visible(), {
        color: (d) => FLAG_COLOR[d.flag_top] || FALLBACK_COLOR,
        width: (d) => widthOf(d.disembarked),
        opacity: () => (isFinite(op) ? op : 0.6),
        flowAnimate: false,          // memorial stillness — no motion on this data
      });
      applyTitles();                 // hover = which powers carried this route
    }

    function emitStats() {
      const vis = visible();
      const emb = vis.reduce((s, a) => s + (a.embarked || 0), 0);
      const dis = vis.reduce((s, a) => s + (a.disembarked || 0), 0);
      document.dispatchEvent(new CustomEvent('atlas:stats', {
        detail: {
          coverage: `${vis.length} routes · 1514–1866`,
          mean: `${(dis / 1e6).toFixed(2)}M disembarked`,
          peak: `${((emb - dis) / 1e6).toFixed(2)}M died crossing`,
        },
      }));
    }

    // ── CARRIER RANKING PANEL ────────────────────────────────────
    // "Which powers were most active" (Adrian's ask): a small ranked bar list
    // of the carrier flags by voyages organised, over the currently-visible
    // routes. Voyage counts are EXACT (summed from each route's `flags`); the
    // flag is the vessel's national flag — the closest the SlaveVoyages data
    // gets to "who organised it" (there is no separate political-sponsor field).
    if (!document.getElementById('slave-carriers-css')) {
      const st = document.createElement('style');
      st.id = 'slave-carriers-css';
      st.textContent = `
        #slave-carriers { position:fixed; right:28px; top:132px; z-index:56; width:236px;
          max-width:46vw; background:var(--panel-bg); border:1px solid var(--panel-border);
          border-radius:6px; backdrop-filter:blur(14px); padding:11px 13px 12px;
          font-family:'JetBrains Mono',monospace; color:var(--ink-dim); display:none;
          box-shadow:0 10px 34px var(--shadow,rgba(0,0,0,.2)); }
        #slave-carriers .sc-head { display:flex; align-items:center; justify-content:space-between;
          gap:8px; margin-bottom:9px; }
        #slave-carriers .sc-title { font-size:9px; letter-spacing:.14em; text-transform:uppercase;
          color:var(--ink-faint); }
        #slave-carriers .sc-toggle { display:inline-flex; gap:3px; }
        #slave-carriers .sc-toggle button { appearance:none; cursor:pointer; border-radius:999px;
          border:1px solid var(--panel-border); background:transparent; color:var(--ink-dim);
          padding:2px 7px; font-family:'JetBrains Mono',monospace; font-size:8px; letter-spacing:.06em;
          text-transform:uppercase; }
        #slave-carriers .sc-toggle button.active { color:var(--ink); background:var(--rule); }
        #slave-carriers .sc-hint { font-size:8.5px; color:var(--ink-faint); margin-bottom:8px;
          line-height:1.4; }
        #slave-carriers .sc-row { margin-bottom:7px; }
        #slave-carriers .sc-row:last-child { margin-bottom:0; }
        #slave-carriers .sc-name { font-size:10px; color:var(--ink); display:flex; align-items:center;
          gap:6px; margin-bottom:2px; }
        #slave-carriers .sc-sw { width:9px; height:9px; border-radius:2px; flex:none; }
        #slave-carriers .sc-bartrack { display:flex; align-items:center; gap:6px; }
        #slave-carriers .sc-track { flex:1; min-width:0; }
        #slave-carriers .sc-bar { display:block; height:7px; border-radius:2px; min-width:2px; max-width:100%; }
        #slave-carriers .sc-val { flex:none; font-size:9px; color:var(--ink-faint); white-space:nowrap; }
        @media (max-width:900px){ #slave-carriers { display:none !important; } }`;
      document.head.appendChild(st);
    }
    const depPorts = (data._meta && data._meta.departure_ports) || [];
    let rankMode = 'flag';     // 'flag' = vessel flag (from visible routes) | 'port' = fitting-out port (global)
    const panel = document.createElement('aside');
    panel.id = 'slave-carriers';
    panel.setAttribute('aria-label', 'Slave-voyage organisers ranked');
    panel.innerHTML = `
      <div class="sc-head">
        <span class="sc-title">Who organised it</span>
        <span class="sc-toggle">
          <button type="button" data-mode="flag" class="active">Flag</button>
          <button type="button" data-mode="port"${depPorts.length ? '' : ' disabled'}>Port</button>
        </span>
      </div>
      <div class="sc-hint"></div>
      <div class="sc-body"></div>`;
    document.body.appendChild(panel);

    // bar row helper (shared by both modes)
    const barRow = (label, v, max, total, col, titleSuffix) =>
      `<div class="sc-row" title="${label}: ${nf(v)} voyages${total ? ` (${(v / total * 100).toFixed(0)}%)` : ''}${titleSuffix || ''}">
        <div class="sc-name"><span class="sc-sw" style="background:${col}"></span>${label}</div>
        <div class="sc-bartrack"><span class="sc-track"><span class="sc-bar" style="width:${Math.max(2, (v / max) * 100).toFixed(1)}%;background:${col}"></span></span><span class="sc-val">${nf(v)}</span></div>
      </div>`;

    function renderCarriers() {
      const hint = panel.querySelector('.sc-hint');
      let rows, html;
      if (rankMode === 'port') {
        // global fitting-out ports — the closest signal to who ORGANISED it
        rows = depPorts.map((p) => [p.port, p.voyages]);
        if (!rows.length) { panel.style.display = 'none'; return; }
        const max = rows[0][1] || 1;
        hint.textContent = 'Port the voyage was fitted out from (imputed) — across all voyages.';
        html = rows.map(([port, v]) => barRow(port, v, max, 0, 'var(--accent,#b0522a)')).join('');
      } else {
        // vessel flag, summed over the currently-visible routes (exact)
        const m = new Map();
        for (const a of visible()) {
          for (const [f, n] of Object.entries(a.flags || {})) { const c = canonFlag(f); m.set(c, (m.get(c) || 0) + n); }
        }
        rows = [...m.entries()].sort((x, y) => y[1] - x[1]);
        if (!rows.length) { panel.style.display = 'none'; return; }
        const max = rows[0][1] || 1;
        const total = rows.reduce((s, r) => s + r[1], 0) || 1;
        hint.textContent = 'Vessel flag, grouped under the colonising power (see methodology).';
        html = rows.map(([flag, v]) => barRow(flag, v, max, total, FLAG_COLOR[flag] || FALLBACK_COLOR)).join('');
      }
      panel.querySelector('.sc-body').innerHTML = html;
      panel.style.display = 'block';
    }

    panel.querySelector('.sc-toggle').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-mode]');
      if (!b || b.disabled) return;
      rankMode = b.dataset.mode;
      panel.querySelectorAll('.sc-toggle button').forEach((x) => x.classList.toggle('active', x === b));
      renderCarriers();
    });

    ctx.onRender(redraw);
    emitStats();
    renderCarriers();
    ctx.requestRender();

    return {
      update() { emitStats(); renderCarriers(); ctx.requestRender(); },
      destroy() { arcs.clear(); panel.remove(); },
    };
  },
};
