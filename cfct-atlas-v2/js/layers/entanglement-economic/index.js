// ─────────────────────────────────────────────────────────────
//  LAYER: entanglement-economic  (Agent B)
//  Economic & resources entanglement — three sub-streams:
//    • remittance  (KNOMAD bilateral remittance matrix)   → arcs (PINK)
//    • aid         (OECD-DAC bilateral ODA)                → arcs (GREEN)
//    • trade       (WDI trade-as-%-GDP, per-country)       → openness markers (violet)
//
//  Remittance & aid are genuinely bilateral, so they render as great-circle
//  arcs via the shared arc renderer. Each stream gets a DISTINCT, warm/saturated
//  colour so the arcs stay legible over the warm CFCT choropleth AND remain
//  distinct from the migration layer's cool teal.
//
//  Trade openness is NOT a bilateral flow, so trade records are stored as
//  self-referential arcs (from == to). They render as a glowing "openness"
//  ring at each country centroid sized by trade/GDP.
//
//  Data: data/economic.json (symlink → processed/entanglement/economic.json)
//  Schema:
//    { _meta:{ source, year_range:[y0,y1], license, counts:{remittance,aid,trade} },
//      arcs:[ { from:"USA", to:"MEX", year:2021, value:12345, type:"remittance" } ] }
// ─────────────────────────────────────────────────────────────

import { createArcRenderer } from '../../viz/arc-renderer.js';
import { createParticleFlow } from '../../viz/particle-flow.js';

// Pulse-ring CSS for aid arrivals (one-time). Aid is DISCRETE yearly
// disbursements, not a continuous stream — expanding rings landing on the
// recipient say that honestly; the steady gold particles are reserved for
// remittances, which really are continuous circulation.
function injectAidPulseCss() {
  if (document.getElementById('aid-pulse-css')) return;
  const tag = document.createElement('style');
  tag.id = 'aid-pulse-css';
  tag.textContent = `
    @keyframes aid-pulse { 0% { r: 2; opacity: .75; } 100% { r: 17; opacity: 0; } }
    circle.aid-pulse { fill: none; stroke: #37d67a; stroke-width: 1.6;
      animation: aid-pulse 2.6s ease-out infinite; pointer-events: none; }
    @media (prefers-reduced-motion: reduce) { circle.aid-pulse { animation: none; r: 6; opacity: .4; } }
  `;
  document.head.appendChild(tag);
}

// Distinct, saturated palette. Remittance gold + aid green read clearly over
// the warm orange choropleth and are unmistakably different from migration's
// cool teal. Trade markers stay violet (a per-country attribute, not a flow).
const STREAM_COLOR = {
  // Remittance was gold/amber (invisible over the warm-orange choropleth), then
  // cyan — but cyan sat too close to aid-green at particle size (client note
  // 2026-06-15). Pink/magenta is the maximum hue separation from aid-green while
  // staying legible over both the orange land and the cream oceans.
  remittance: '#ff4d8d', // pink / magenta
  aid: '#37d67a',        // green
  trade: '#8a7dff',      // violet (openness markers)
};

const FALLBACK_RANGE = [2000, 2024];

export default {
  id: 'entanglement-economic',
  label: 'Economic',
  group: 'entanglement',
  methodologyPath: 'methodology/economic.md',
  dataPath: 'data/economic.json',
  controls: [
    { id: 'opacity', label: 'Arc intensity', type: 'slider', default: 0.7, min: 0.05, max: 1, step: 0.05 },
    { id: 'year', label: 'Year', type: 'slider', default: FALLBACK_RANGE[1], min: FALLBACK_RANGE[0], max: FALLBACK_RANGE[1], step: 1 },
    // Log-stepped floor: remittance corridors span 0.001–52,595 USD M and aid
    // 0.001–11,790 USD M, so a linear slider can never serve both. ≥10 M trims
    // micro-noise on both streams without hiding mid-size corridors.
    {
      id: 'minValue', label: 'Min value', type: 'select', default: '10',
      options: [
        { value: '0', label: 'No minimum' },
        { value: '1', label: '≥ $1 million' },
        { value: '10', label: '≥ $10 million' },
        { value: '100', label: '≥ $100 million' },
        { value: '1000', label: '≥ $1 billion' },
      ],
    },
    { id: 'showRemittance', label: 'Remittances', type: 'toggle', default: true },
    { id: 'showAid', label: 'Aid (ODA)', type: 'toggle', default: true },
    // honest label: the WDI extract on disk tops out at ~2012 and the rings
    // are %GDP openness, not corridors (real bilateral trade = Commodities)
    { id: 'showTrade', label: 'Trade openness (%GDP, ~2012)', type: 'toggle', default: false },
    // Particles-only is the default voice: flows read as motion, not clutter.
    // Pinning a country still draws its arcs (mirrors the colonies
    // territory+pin pattern), so detail is one click away.
    {
      id: 'display', label: 'Display', type: 'select', default: 'particles',
      options: [
        { value: 'particles', label: 'Particles only' },
        { value: 'both', label: 'Arcs + particles' },
        { value: 'arcs', label: 'Arcs only' },
      ],
    },
  ],

  render(ctx) {
    const data = ctx.data || {};
    const all = Array.isArray(data.arcs) ? data.arcs : [];

    // partition once: bilateral flows vs per-country trade markers
    const flows = all.filter((a) => a.from !== a.to);          // remittance/aid
    const openness = all.filter((a) => a.from === a.to);       // trade markers

    // "All time" aggregate: one flow per (from,to,type) carrying its peak value,
    // and one trade marker per country (peak openness), so turning the time axis
    // off shows the union across all years rather than stacking duplicates.
    const peakBy = (rows, keyFn) => {
      const m = new Map();
      for (const a of rows) { const k = keyFn(a); const c = m.get(k); if (!c || a.value > c.value) m.set(k, a); }
      return [...m.values()];
    };
    const flowsAllTime = peakBy(flows, (a) => `${a.from}->${a.to}|${a.type}`);
    const opennessAllTime = peakBy(openness, (a) => a.from);

    // year range from data; reflect it onto the year + minValue controls so
    // the sliders snap to actual coverage (mutates the shared control objects).
    const yrs = [...new Set(all.map((a) => a.year).filter((y) => Number.isFinite(y)))].sort((a, b) => a - b);
    const yMin = yrs.length ? yrs[0] : FALLBACK_RANGE[0];
    const yMax = yrs.length ? yrs[yrs.length - 1] : FALLBACK_RANGE[1];
    const yearCtrl = this.controls.find((c) => c.id === 'year');
    if (yearCtrl) { yearCtrl.min = yMin; yearCtrl.max = yMax; if (yearCtrl.default > yMax || yearCtrl.default < yMin) yearCtrl.default = yMax; }

    const fVals = flows.map((a) => a.value).filter((v) => Number.isFinite(v) && v > 0);
    const fMax = fVals.length ? Math.max(...fVals) : 1000;

    // width ∝ sqrt(value), clamped to a sensible pixel range
    const widthOf = (v) => {
      const t = Math.sqrt(Math.max(0, v || 0) / (fMax || 1)); // 0..1
      return 0.6 + t * 4.4;                                   // 0.6px .. 5px
    };

    // scale trade marker radius: openness % → px
    const oVals = openness.map((a) => a.value).filter((v) => Number.isFinite(v));
    const oMax = oVals.length ? Math.max(...oVals) : 100;
    const rOf = (v) => 2 + 7 * Math.sqrt(Math.max(0, v) / (oMax || 1));

    // trade stream years + its latest year (trade is %GDP, a different unit /
    // cadence than the flow streams, so it gets its own year-snapping).
    const tradeYears = [...new Set(openness.map((o) => o.year).filter((y) => Number.isFinite(y)))].sort((a, b) => a - b);
    const tradeLatest = tradeYears.length ? tradeYears[tradeYears.length - 1] : null;

    // a dedicated <g> for trade markers so arcs and markers don't fight
    const markerG = ctx.group.append('g').attr('class', 'econ-markers');
    const pulseG = ctx.group.append('g').attr('class', 'econ-aid-pulses');
    const arcs = createArcRenderer(ctx.group, ctx);
    injectAidPulseCss();
    // gold drift: slower + denser than refugee particles — circulation, not flight.
    // Since particles became the DEFAULT face of this layer (arcs hidden unless
    // pinned), they carry the whole visual load: more corridors, a particle
    // floor and bigger dots, plus a green aid stream (the pulse rings alone
    // read as almost no movement once the 1.5k aid arcs stopped drawing).
    const particles = createParticleFlow(ctx, { rgb: '255,77,141', speed: 0.55, maxPerArc: 18, minPerArc: 2, sizeScale: 1.2 });
    const aidParticles = createParticleFlow(ctx, { rgb: '47,178,104', speed: 0.5, maxPerArc: 10, minPerArc: 1, sizeScale: 1.1 });
    const maxRemit = Math.max(1, ...flows.filter((a) => a.type === 'remittance').map((a) => a.value || 0));
    const maxAid = Math.max(1, ...flows.filter((a) => a.type === 'aid').map((a) => a.value || 0));

    function snapYear(want, pool) {
      if (!Number.isFinite(want) || !pool.length) return want;
      let best = pool[0];
      for (const y of pool) if (Math.abs(y - want) < Math.abs(best - want)) best = y;
      return best;
    }

    function activeYear() {
      // snap the requested year to the nearest year actually present
      return snapYear(ctx.getControl('year'), yrs);
    }

    // Each stream has its own cadence (remittance = a single KNOMAD matrix
    // year, aid = yearly DAC series), so each snaps within its OWN years —
    // otherwise the sparse stream vanishes whenever the slider sits on a year
    // only the dense stream has (trade already does this; see visibleOpenness).
    const remitYears = [...new Set(flows.filter((a) => a.type === 'remittance')
      .map((a) => a.year).filter((y) => Number.isFinite(y)))].sort((a, b) => a - b);
    const aidYears = [...new Set(flows.filter((a) => a.type === 'aid')
      .map((a) => a.year).filter((y) => Number.isFinite(y)))].sort((a, b) => a - b);

    const allTime = () => !!(ctx.isAllTime && ctx.isAllTime());

    function visibleFlows() {
      const showR = ctx.getControl('showRemittance');
      const showA = ctx.getControl('showAid');
      const minV = +ctx.getControl('minValue') || 0;
      const want = ctx.getControl('year');
      const remitYr = snapYear(want, remitYears);
      const aidYr = snapYear(want, aidYears);
      const off = allTime();
      return (off ? flowsAllTime : flows).filter((a) => {
        if (a.type === 'remittance' && !showR) return false;
        if (a.type === 'aid' && !showA) return false;
        if (!off && Number.isFinite(a.year)) {
          const yr = a.type === 'remittance' ? remitYr : a.type === 'aid' ? aidYr : activeYear();
          if (a.year !== yr) return false;
        }
        if (Number.isFinite(a.value) && a.value < minV) return false;
        return true;
      });
    }

    function visibleOpenness() {
      if (!ctx.getControl('showTrade')) return [];
      // Trade openness is %GDP, not USD, so the USD minValue must NOT cull it.
      if (allTime()) return opennessAllTime;            // peak per country
      // Snap to the chosen year if the trade stream has it, else show latest.
      const want = activeYear();
      const showYear = tradeYears.includes(want) ? want : tradeLatest;
      return openness.filter((a) => {
        if (showYear !== null && Number.isFinite(a.year) && a.year !== showYear) return false;
        return true;
      });
    }

    function drawMarkers() {
      const op = +ctx.getControl('opacity');
      const centroids = ctx.getCentroids ? ctx.getCentroids() : {};
      const items = visibleOpenness()
        .map((a) => ({ a, c: centroids[a.from] }))
        .filter((d) => d.c)
        .map((d) => ({ a: d.a, p: ctx.projection(d.c), c: d.c }))
        .filter((d) => d.p && isFinite(d.p[0]) && isFinite(d.p[1]) && isOnFront(d.c, ctx.projection));

      const sel = markerG.selectAll('circle.econ-trade').data(items, (d) => d.a.from);
      sel.exit().remove();
      sel.enter().append('circle')
        .attr('class', 'econ-trade')
        .attr('fill', STREAM_COLOR.trade)
        .attr('stroke', STREAM_COLOR.trade)
        .attr('stroke-width', 0.6)
        .merge(sel)
        .attr('cx', (d) => d.p[0])
        .attr('cy', (d) => d.p[1])
        .attr('r', (d) => rOf(d.a.value))
        .attr('fill-opacity', op * 0.35)
        .attr('stroke-opacity', op);
    }

    function drawArcs() {
      const op = +ctx.getControl('opacity');
      const display = ctx.getControl('display') || 'particles';
      // particles-only hides arcs — unless a country is pinned, in which case
      // its arcs draw (the renderer itself culls to arcs touching the pin)
      const pinned = ctx.globe?.state?.pinnedIso || null;
      const showArcs = display !== 'particles' || !!pinned;
      arcs.draw(showArcs ? visibleFlows() : [], {
        color: (d) => STREAM_COLOR[d.type] || '#999',
        width: (d) => widthOf(d.value),
        opacity: () => (isFinite(op) ? op : 0.7),
      });
    }

    // Expanding rings at aid recipients (aggregate per recipient for the
    // active year). cx/cy track the globe per frame; r + opacity belong to
    // the CSS animation. Stagger via a stable per-country delay.
    function drawAidPulses() {
      const on = (ctx.getControl('display') || 'particles') !== 'arcs' && ctx.getControl('showAid');
      const centroids = ctx.getCentroids ? ctx.getCentroids() : {};
      const byRecip = new Map();
      if (on) {
        for (const a of visibleFlows()) {
          if (a.type !== 'aid') continue;
          byRecip.set(a.to, (byRecip.get(a.to) || 0) + (a.value || 0));
        }
      }
      const items = [...byRecip.entries()]
        .map(([iso, v]) => ({ iso, v, c: centroids[iso] }))
        .filter((d) => d.c)
        .map((d) => ({ ...d, p: ctx.projection(d.c) }))
        .filter((d) => d.p && isFinite(d.p[0]) && isOnFront(d.c, ctx.projection));
      const sel = pulseG.selectAll('circle.aid-pulse').data(items, (d) => d.iso);
      sel.exit().remove();
      sel.enter().append('circle')
        .attr('class', 'aid-pulse')
        .style('animation-delay', (d) => `${(d.iso.charCodeAt(0) * 137 + d.iso.charCodeAt(2) * 71) % 2400}ms`)
        .merge(sel)
        .attr('cx', (d) => d.p[0])
        .attr('cy', (d) => d.p[1]);
    }

    function redraw() {
      drawArcs();
      drawMarkers();
      drawAidPulses();
      // particles on the biggest corridors per stream (caps the pool)
      const vf = visibleFlows();
      const remit = vf.filter((a) => a.type === 'remittance')
        .sort((x, y) => (y.value || 0) - (x.value || 0)).slice(0, 400);
      const aid = vf.filter((a) => a.type === 'aid')
        .sort((x, y) => (y.value || 0) - (x.value || 0)).slice(0, 200);
      const showParticles = (ctx.getControl('display') || 'particles') !== 'arcs';
      particles.setEnabled(showParticles && !!ctx.getControl('showRemittance'));
      particles.update(remit, maxRemit);
      aidParticles.setEnabled(showParticles && !!ctx.getControl('showAid'));
      aidParticles.update(aid, maxAid);
    }

    function emitStats() {
      const vf = visibleFlows();
      const remit = vf.filter((a) => a.type === 'remittance');
      const aid = vf.filter((a) => a.type === 'aid');
      const tot = vf.reduce((s, a) => s + (a.value || 0), 0);
      const peak = vf.length ? Math.max(...vf.map((a) => a.value || 0)) : 0;
      document.dispatchEvent(new CustomEvent('atlas:stats', {
        detail: {
          coverage: `${remit.length} remit · ${aid.length} aid · ${visibleOpenness().length} trade`,
          mean: vf.length ? `${Math.round(tot / vf.length).toLocaleString()} USD M` : `${yMin}–${yMax}`,
          peak: peak ? `${Math.round(peak).toLocaleString()} USD M` : '—',
        },
      }));
    }

    // reproject every frame so arcs/markers track the rotating globe
    ctx.onRender(redraw);
    emitStats();
    ctx.requestRender();

    return {
      update() { emitStats(); ctx.requestRender(); },
      destroy() { arcs.clear(); markerG.remove(); pulseG.remove(); particles.destroy(); aidParticles.destroy(); },
    };
  },
};

// front-hemisphere test mirroring arc-renderer visibility
function isOnFront([lon, lat], projection) {
  const alpha = projection.alpha ? projection.alpha() : 0;
  if (alpha > 0.5) return true;
  const rot = projection.rotate();
  const l0 = -rot[0] * Math.PI / 180;
  const p0 = -rot[1] * Math.PI / 180;
  const l = lon * Math.PI / 180;
  const p = lat * Math.PI / 180;
  const c = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0);
  return c > -0.05;
}
