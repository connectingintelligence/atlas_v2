// ─────────────────────────────────────────────────────────────
//  LAYER: entanglement-migration — bilateral refugee FLOWS
//
//  Draws origin -> country-of-asylum refugee flows as great-circle arcs
//  over the globe, for the currently-selected year, above a min-flow
//  threshold. Width and colour encode flow volume (number of refugees).
//
//  Data: data/migration.json  (symlink -> data/processed/entanglement/migration.json)
//  produced by pipeline/build_entanglement_migration.py from the UNHCR
//  Refugee Population Statistics Database (bilateral origin x asylum).
//
//  Schema:
//    { _meta:{ source, year_range:[y0,y1], license, ... },
//      arcs:[ { from:"SYR", to:"DEU", year:2015, value:426700, type:"refugee" } ] }
//
//  Uses the shared arc renderer (Agent D owns it — we only call it).
// ─────────────────────────────────────────────────────────────

import { createArcRenderer } from '../../viz/arc-renderer.js';
import { createParticleFlow } from '../../viz/particle-flow.js';

// Defaults used only if the data file is empty / not yet built.
const FALLBACK_RANGE = [2000, 2024];

function computeMeta(data) {
  const arcs = (data && data.arcs) || [];
  const range = (data && data._meta && Array.isArray(data._meta.year_range) && data._meta.year_range.length === 2)
    ? data._meta.year_range
    : FALLBACK_RANGE;
  let maxValue = 0;
  for (const a of arcs) if (a.value > maxValue) maxValue = a.value;
  return { arcs, range, maxValue: maxValue || 1 };
}

// Width: sqrt scale (flow volume varies over several orders of magnitude),
// clamped to a sensible pixel range.
function widthFor(value, maxValue) {
  const t = Math.sqrt(Math.max(0, value) / maxValue); // 0..1
  // Floor nudged to 0.9px so the thinnest teal arcs (at the default minFlow)
  // stay legible over the warm choropleth; top end unchanged at ~5px.
  return 0.9 + t * 4.1; // 0.9px .. 5px
}

export default {
  id: 'entanglement-migration',
  // "Refugees", not "Migration": the data is UNHCR-mandate refugees only —
  // labor migration, asylum-seekers, IDPs and UNHCR's separate "Venezuelans
  // displaced abroad" category are not in it, so the broader label oversold
  // what the arcs show (e.g. South America reads near-empty despite the
  // ~7.9M-person Venezuelan exodus, mostly coded outside 'refugee').
  label: 'Refugees',
  group: 'entanglement',
  methodologyPath: 'methodology/migration.md',
  dataPath: 'data/migration.json',

  // year min/max are patched at render() time from the data's real range,
  // but the registry reads control metadata before render, so we seed the
  // common UNHCR range here as the declared default.
  controls: [
    { id: 'opacity', label: 'Opacity', type: 'slider', default: 0.65, min: 0, max: 1, step: 0.05 },
    { id: 'year', label: 'Year', type: 'slider', default: FALLBACK_RANGE[1], min: FALLBACK_RANGE[0], max: FALLBACK_RANGE[1], step: 1 },
    { id: 'minFlow', label: 'Min flow (refugees)', type: 'slider', default: 10000, min: 0, max: 500000, step: 5000 },
    {
      // Top-N corridors per origin: the default view keeps each country's
      // biggest flows so structure reads instead of spaghetti; pinning a
      // country still reveals its complete set (the pin bypasses the cut).
      id: 'topn', label: 'Corridors / country', type: 'select', default: '3',
      options: [
        { value: '3', label: 'Top 3 per country' },
        { value: '5', label: 'Top 5 per country' },
        { value: '10', label: 'Top 10 per country' },
        { value: '0', label: 'All corridors' },
      ],
    },
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
    const { arcs: allArcs, range, maxValue } = computeMeta(ctx.data);

    // Reflect the real data year-range onto our control so the slider snaps
    // to coverage (mutates the declared control object the registry shares).
    const yearCtrl = this.controls.find((c) => c.id === 'year');
    if (yearCtrl) { yearCtrl.min = range[0]; yearCtrl.max = range[1]; }

    const arcRenderer = createArcRenderer(ctx.group, ctx);

    // Pre-bucket arcs by year for fast per-frame filtering.
    const byYear = new Map();
    for (const a of allArcs) {
      if (!byYear.has(a.year)) byYear.set(a.year, []);
      byYear.get(a.year).push(a);
    }

    // "All time" aggregate: one arc per origin→asylum pair carrying its PEAK
    // year value, so toggling the time axis off shows the union of every flow
    // ever recorded instead of stacking 25 years of duplicate pairs.
    const allYearsAgg = (() => {
      const peak = new Map();
      for (const a of allArcs) {
        const k = `${a.from}->${a.to}`;
        const cur = peak.get(k);
        if (!cur || a.value > cur.value) peak.set(k, a);
      }
      return [...peak.values()];
    })();

    // Distinct cool palette so refugee-flow arcs stay legible OVER the warm
    // CFCT choropleth (orange-on-orange was invisible). Bigger flows ride darker.
    function colorFor(value) {
      const t = Math.sqrt(Math.max(0, value) / maxValue); // 0..1
      const lo = [120, 170, 190], hi = [20, 70, 110];     // pale steel -> deep teal-blue
      const c = lo.map((l, i) => Math.round(l + (hi[i] - l) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }

    // top-N cut, cached per settings signature (currentArcs runs every frame)
    let topCache = { key: null, list: null };
    function currentArcs() {
      const minFlow = +ctx.getControl('minFlow') || 0;
      const topn = +(ctx.getControl('topn') ?? 3);
      const pinned = ctx.globe?.state?.pinnedIso || null;
      const allTime = !!(ctx.isAllTime && ctx.isAllTime());
      const year = allTime ? 'all' : clampYear(ctx.getYear());
      const key = `${year}|${minFlow}|${topn}|${pinned || ''}`;
      if (topCache.key === key) return topCache.list;

      const pool = (allTime ? allYearsAgg : (byYear.get(year) || []))
        .filter((a) => a.value >= minFlow);
      let list = pool;
      if (topn > 0) {
        const byOrigin = new Map();
        for (const a of pool) {
          if (!byOrigin.has(a.from)) byOrigin.set(a.from, []);
          byOrigin.get(a.from).push(a);
        }
        list = [];
        for (const arr of byOrigin.values()) {
          arr.sort((x, y) => y.value - x.value);
          list.push(...arr.slice(0, topn));
        }
        // pinned country always gets its COMPLETE set, regardless of the cut
        if (pinned) {
          const have = new Set(list);
          for (const a of pool) {
            if ((a.from === pinned || a.to === pinned) && !have.has(a)) list.push(a);
          }
        }
      }
      topCache = { key, list };
      return list;
    }

    function clampYear(y) {
      // global year may be outside our coverage; snap to nearest available year
      if (byYear.has(y)) return y;
      let best = null, bestDist = Infinity;
      for (const yr of byYear.keys()) {
        const d = Math.abs(yr - y);
        if (d < bestDist) { bestDist = d; best = yr; }
      }
      return best == null ? y : best;
    }

    function emitStats() {
      const arcs = currentArcs();
      const total = arcs.reduce((s, a) => s + a.value, 0);
      document.dispatchEvent(new CustomEvent('atlas:stats', {
        detail: {
          coverage: `${arcs.length} flows`,
          mean: arcs.length ? Math.round(total / arcs.length).toLocaleString() : '—',
          peak: arcs.length ? Math.max(...arcs.map((a) => a.value)).toLocaleString() : '—',
        },
      }));
    }

    // particles stream along the same corridors (canvas overlay; own RAF)
    const particles = createParticleFlow(ctx, { rgb: '30,80,125' });

    function drawFrame() {
      const opacity = +ctx.getControl('opacity');
      const list = currentArcs();
      const display = ctx.getControl('display') || 'particles';
      // particles-only hides arcs — unless a country is pinned, in which case
      // its arcs draw (the renderer itself culls to arcs touching the pin)
      const pinned = ctx.globe?.state?.pinnedIso || null;
      const showArcs = display !== 'particles' || !!pinned;
      arcRenderer.draw(showArcs ? list : [], {
        color: (d) => d.color || colorFor(d.value),
        width: (d) => widthFor(d.value, maxValue),
        opacity: () => (isFinite(opacity) ? opacity : 0.65),
      });
      particles.setEnabled(display !== 'arcs');
      particles.update(list, maxValue);
    }

    // redraw every frame so arcs reproject as the globe rotates
    ctx.onRender(drawFrame);
    emitStats();
    ctx.requestRender();

    return {
      update() { emitStats(); ctx.requestRender(); },
      destroy() { arcRenderer.clear(); particles.destroy(); },
    };
  },
};
