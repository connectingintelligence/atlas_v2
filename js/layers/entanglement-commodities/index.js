// ─────────────────────────────────────────────────────────────
//  LAYER: entanglement-commodities
//  Bilateral commodity trade (CEPII BACI HS6, exporter → importer) —
//  the first REAL bilateral trade in the atlas (the economic layer's
//  "trade" stream is only %GDP openness rings).
//
//  One toggle per commodity group, hue = commodity. Particles are the DEFAULT
//  voice (like Refugees): each corridor streams dots in its commodity colour
//  along the same geometry the arcs use. A single shared canvas paints all six
//  hues at once via particle-flow's per-arc `colorOf` (no canvas-per-colour).
//  Arcs stay available through the Display control, and a pinned country always
//  draws its arcs so WHO-supplies-WHOM is still legible on demand.
//
//  Data: data/commodities.json (symlink → processed/entanglement/)
//  Schema: { _meta:{ year, units, groups_hs6, counts },
//            arcs:[ { from:"CHL", to:"CHN", year:2024, value:25471,
//                     commodity:"copper" } ] }   value = USD millions
// ─────────────────────────────────────────────────────────────

import { createArcRenderer } from '../../viz/arc-renderer.js';
import { createParticleFlow } from '../../viz/particle-flow.js';

// "#e07b39" -> "224,123,57" for the particle engine's rgba() fill.
const hexToRgb = (h) => {
  const n = parseInt((h || '#999999').slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

// Hue = commodity. Picked to stay distinct from the other layers' voices
// (refugee teal, remittance gold, aid green, openness violet) AND from
// each other; gold/copper lean on their material colour.
// Tuned for particle visibility over the warm, MUTED CFCT terrain: the map is
// sand→terracotta, so particles read best when dark, cool, or highly saturated
// and away from that hue range. Oil = near-black ("black gold" + max contrast);
// cobalt/rare-earths/lithium are the cool poppers; gold/copper stay warm but
// saturated enough to separate from the choropleth.
const COMMODITY = {
  crude_oil: { label: 'Crude oil', color: '#1a1512' },     // near-black — "black gold"
  gold: { label: 'Gold', color: '#e0a81e' },     // saturated gold
  copper: { label: 'Copper', color: '#e9622b' },     // saturated copper
  rare_earths: { label: 'Rare earths', color: '#d930b8' },     // vivid magenta
  lithium: { label: 'Lithium', color: '#17b0be' },     // deep teal
  cobalt: { label: 'Cobalt', color: '#3b5cf0' },     // cobalt blue
};

export default {
  id: 'entanglement-commodities',
  label: 'Commodities',
  group: 'entanglement',
  temporal: { min: 2022, max: 2024 },   // BACI HS6 trade — only these years exist
  methodologyPath: 'methodology/commodities.md',
  dataPath: 'data/commodities.json',
  controls: [
    { id: 'opacity', label: 'Arc intensity', type: 'slider', default: 0.75, min: 0.05, max: 1, step: 0.05 },
    // Log-stepped floor like the economic layer; ≥$100 M default keeps the
    // six groups readable together (~400 arcs) — drop it to see the tail.
    {
      id: 'minValue', label: 'Min value', type: 'select', default: '100',
      options: [
        { value: '0', label: 'No minimum' },
        { value: '1', label: '≥ $1 million' },
        { value: '10', label: '≥ $10 million' },
        { value: '100', label: '≥ $100 million' },
        { value: '1000', label: '≥ $1 billion' },
      ],
    },
    // Particles-only is the default voice (mirrors Refugees): flows read as
    // motion, not clutter. Pinning a country still draws its arcs.
    {
      id: 'display', label: 'Display', type: 'select', default: 'particles',
      options: [
        { value: 'particles', label: 'Particles only' },
        { value: 'both', label: 'Arcs + particles' },
        { value: 'arcs', label: 'Arcs only' },
      ],
    },
    ...Object.entries(COMMODITY).map(([key, c]) => (
      { id: `show_${key}`, label: c.label, type: 'toggle', default: true }
    )),
  ],

  render(ctx) {
    const data = ctx.data || {};
    const all = Array.isArray(data.arcs) ? data.arcs : [];

    const vMax = all.length ? Math.max(...all.map((a) => a.value || 0)) : 1;
    // width ∝ sqrt(value): crude-oil mega-corridors must not flatten the rest
    const widthOf = (v) => 0.6 + 4.4 * Math.sqrt(Math.max(0, v || 0) / vMax);

    const arcs = createArcRenderer(ctx.group, ctx);
    // particle stream, coloured per-arc by commodity (one shared canvas)
    const particles = createParticleFlow(ctx, {
      colorOf: (a) => hexToRgb(COMMODITY[a.commodity]?.color),
      maxPerArc: 10, sizeScale: 1.05,
    });

    // data carries 2022–2024 — snap the global scrubber to the nearest
    // covered year; "all time" shows each corridor's PEAK year (no stacking)
    const years = [...new Set(all.map((a) => a.year).filter(Number.isFinite))].sort((a, b) => a - b);
    const snapYear = (want) => {
      if (!years.length || !Number.isFinite(want)) return years[years.length - 1];
      let best = years[0];
      for (const y of years) if (Math.abs(y - want) < Math.abs(best - want)) best = y;
      return best;
    };
    const peakAllTime = (() => {
      const m = new Map();
      for (const a of all) {
        const k = `${a.from}->${a.to}|${a.commodity}`;
        const c = m.get(k);
        if (!c || a.value > c.value) m.set(k, a);
      }
      return [...m.values()];
    })();
    let activeYear = years[years.length - 1];

    function visible() {
      const minV = +ctx.getControl('minValue') || 0;
      const allTime = !!(ctx.isAllTime && ctx.isAllTime());
      activeYear = snapYear(ctx.getYear());
      const pool = allTime ? peakAllTime : all;
      return pool.filter((a) => {
        const c = COMMODITY[a.commodity];
        if (!c || ctx.getControl(`show_${a.commodity}`) === false) return false;
        if (!allTime && a.year !== activeYear) return false;
        return !(Number.isFinite(a.value) && a.value < minV);
      });
    }

    function redraw() {
      const op = +ctx.getControl('opacity');
      const vis = visible();
      const display = ctx.getControl('display') || 'particles';
      // particles-only stays particles-only EVEN WHEN a country is pinned —
      // arcs are strictly opt-in via the Display control ("Arcs + particles" /
      // "Arcs only"). Pinning still focuses the particles (particle-flow reads
      // the pin); it must not summon commodity lines on its own.
      const showArcs = display !== 'particles';
      arcs.draw(showArcs ? vis : [], {
        color: (d) => COMMODITY[d.commodity]?.color || '#999',
        width: (d) => widthOf(d.value),
        opacity: () => (isFinite(op) ? op : 0.75),
      });
      particles.setEnabled(display !== 'arcs');
      particles.update(vis, vMax);
    }

    function emitStats() {
      const vis = visible();
      const tot = vis.reduce((s, a) => s + (a.value || 0), 0);
      const peak = vis.length ? Math.max(...vis.map((a) => a.value || 0)) : 0;
      const groups = new Set(vis.map((a) => a.commodity)).size;
      document.dispatchEvent(new CustomEvent('atlas:stats', {
        detail: {
          coverage: `${vis.length} corridors · ${groups} commodities · ${(ctx.isAllTime && ctx.isAllTime()) ? `peak ${years[0]}–${years[years.length - 1]}` : activeYear}`,
          mean: vis.length ? `${Math.round(tot / vis.length).toLocaleString()} USD M` : '—',
          peak: peak ? `${Math.round(peak).toLocaleString()} USD M` : '—',
        },
      }));
    }

    ctx.onRender(redraw);
    emitStats();
    ctx.requestRender();

    return {
      update() { emitStats(); ctx.requestRender(); },
      destroy() { arcs.clear(); particles.destroy(); },
    };
  },
};

export { COMMODITY };
