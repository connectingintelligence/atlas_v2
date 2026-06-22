// ─────────────────────────────────────────────────────────────
//  LAYER: entanglement-overseas — present-day overseas territories
//
//  The colonial datasets (COLDAT/ICOW behind the Colonies layer) only
//  record territories that became INDEPENDENT, so they say nothing about
//  the places a former imperial power STILL governs from across an ocean
//  (French Guiana, Réunion, Puerto Rico, Gibraltar, Greenland, New
//  Caledonia, …). The world basemap also folds most of these into the
//  metropole's own polygon — French Guiana is drawn as part of "France" —
//  so they have no node and no arc can point to them. This layer supplies
//  the missing line: power → the real [lon,lat] of each territory.
//
//  FRAMING (client 2026-06-15): neutral label on the map; the colonial-
//  continuity thesis + the legal-status nuance live in
//  methodology/overseas-territories.md. Each territory is tagged with its
//  real status (UN-listed NSGT / integrated overseas region / autonomous /
//  dependency / associated state) — they are NOT all "colonies" in law.
//
//  Data: data/overseas_territories.json (built by
//  pipeline/build_overseas_territories.py — sources cited there).
// ─────────────────────────────────────────────────────────────

import { createArcRenderer } from '../../viz/arc-renderer.js';

// hue per administering power — mirrors the Colonies layer's empire palette
// so the two read as the same story (Britain red, France blue, …).
const POWER_COLOR = {
  GBR: '#d94f4f', FRA: '#4f7fd9', ESP: '#e0a020', PRT: '#3fae6b',
  NLD: '#e07b39', USA: '#36c5c0', DNK: '#9d6b4f', NOR: '#6b8587',
  AUS: '#5f9ea0', NZL: '#7f9c5f',
};
const FALLBACK = '#9b8b78';
const colorFor = (p) => POWER_COLOR[p] || FALLBACK;

export default {
  id: 'entanglement-overseas',
  label: 'Overseas territories',
  group: 'entanglement',
  methodologyPath: 'methodology/overseas-territories.md',
  dataPath: 'data/overseas_territories.json',
  controls: [
    { id: 'opacity', label: 'Opacity', type: 'slider', default: 0.7, min: 0.05, max: 1, step: 0.05 },
    {
      // honesty filter: show every present-day territory, or only those the
      // UN itself still lists as Non-Self-Governing (the strongest "colony" claim)
      id: 'scope', label: 'Scope', type: 'select', default: 'all',
      options: [
        { value: 'all', label: 'All overseas territories' },
        { value: 'un', label: 'UN-listed (Non-Self-Governing) only' },
      ],
    },
  ],

  render(ctx) {
    const data = ctx.data || {};
    const all = Array.isArray(data.arcs) ? data.arcs : [];

    const arcs = createArcRenderer(ctx.group, ctx);
    const dotG = ctx.group.append('g').attr('class', 'overseas-dots');

    function visible() {
      const unOnly = (ctx.getControl('scope') || 'all') === 'un';
      return unOnly ? all.filter((a) => a.un_listed) : all;
    }

    function drawDots(list) {
      const op = +ctx.getControl('opacity');
      const items = list
        .map((a) => ({ a, p: ctx.projection(a.to) }))
        .filter((d) => d.p && isFinite(d.p[0]) && isFinite(d.p[1]) && isOnFront(d.a.to, ctx.projection));
      const sel = dotG.selectAll('circle.ov-dot').data(items, (d) => d.a.territory);
      sel.exit().remove();
      const ent = sel.enter().append('circle')
        .attr('class', 'ov-dot').attr('stroke', '#fff').attr('stroke-width', 0.5);
      ent.append('title');
      ent.merge(sel)
        .attr('cx', (d) => d.p[0]).attr('cy', (d) => d.p[1])
        .attr('r', (d) => (d.a.un_listed ? 3.2 : 2.4))
        .attr('fill', (d) => colorFor(d.a.power))
        .attr('fill-opacity', Number.isFinite(op) ? op : 0.7)
        .select('title')
        .text((d) => `${d.a.territory} — ${d.a.power_name} · ${d.a.status_label}`);
    }

    function redraw() {
      const op = +ctx.getControl('opacity');
      const list = visible();
      arcs.draw(list, {
        color: (d) => colorFor(d.power),
        width: (d) => (d.un_listed ? 1.8 : 1.3),
        opacity: () => (Number.isFinite(op) ? op : 0.7),
        // present-tense ties — keep them still, like the slave-voyages layer;
        // marching dashes would read as live traffic, which these are not.
        flowAnimate: false,
      });
      drawDots(list);
    }

    function emitStats() {
      const list = visible();
      const powers = new Set(list.map((a) => a.power));
      document.dispatchEvent(new CustomEvent('atlas:stats', {
        detail: {
          coverage: `${list.length} territories`,
          mean: `${powers.size} administering powers`,
          peak: `${list.filter((a) => a.un_listed).length} UN-listed`,
        },
      }));
    }

    ctx.onRender(redraw);
    emitStats();
    ctx.requestRender();

    return {
      update() { emitStats(); ctx.requestRender(); },
      destroy() { arcs.clear(); dotG.remove(); },
    };
  },
};

// front-hemisphere test mirroring the arc renderer's visibility cull
function isOnFront([lon, lat], projection) {
  const alpha = projection.alpha ? projection.alpha() : 0;
  if (alpha > 0.5) return true;
  const rot = projection.rotate();
  const l0 = -rot[0] * Math.PI / 180, p0 = -rot[1] * Math.PI / 180;
  const l = lon * Math.PI / 180, p = lat * Math.PI / 180;
  const c = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0);
  return c > -0.05;
}
