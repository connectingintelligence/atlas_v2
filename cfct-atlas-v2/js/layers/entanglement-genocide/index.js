// ─────────────────────────────────────────────────────────────
//  LAYER: entanglement-genocide — perpetrator↔victim arcs
//
//  Draws curved arcs from a perpetrator country to each victim country for
//  every event in the curated genocide dataset (data/genocide_arcs.json,
//  built by pipeline/build_entanglement_genocide.py). Colour encodes role
//  (--arc-perp / --arc-victim). Direction (perpetrator → victim) is shown by an
//  ARROWHEAD at the victim end; lines have a CONSTANT width (the old death-toll-
//  as-width encoding was dropped 2026-06-15 on client feedback — it didn't read
//  and confused). The death toll still scales the self-event halos and lives in
//  the data + Event picker.
//
//  DATA DISCIPLINE: every arc traces 1:1 to a sourced row. Two tiers (like
//  the colonies layer): 'curated' = human-verified events with per-row
//  academic citations; 'ucdp' = UCDP One-Sided Violence v25.1 government-
//  actor fatalities 1989–2024 (yearly best estimates, aggregated per pair).
//  No AI-fabricated values. See methodology/genocide.md.
//
//  Self-perpetrated events (a state killing its own population — Cambodia,
//  Rwanda, the Great Leap Forward, …) have from === to. They cannot be drawn
//  as a line, so they render as a pulsing node halo on the country centroid.
// ─────────────────────────────────────────────────────────────

import { createArcRenderer } from '../../viz/arc-renderer.js';

function parseStartYear(arc) {
  if (typeof arc.start_year === 'number') return arc.start_year;
  const m = (arc.years || '').match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
}

export default {
  id: 'entanglement-genocide',
  label: 'Genocide',
  group: 'entanglement',
  // BETA / gated: the only layer curated *for this project* (vs. ingesting an
  // external institutional dataset), so it sits behind a soft passcode + a
  // "Beta" tag and sinks to the bottom of the entanglement list. NOTE: on a
  // static site this is OBFUSCATION ONLY — the data file stays fetchable; the
  // gate just keeps the layer out of casual view. Reusable: any layer with
  // `beta:true` + `passcode` gets the same treatment.
  beta: true,
  passcode: 'this_is_locked521',
  methodologyPath: 'methodology/genocide.md',
  dataPath: 'data/genocide_arcs.json',
  // Declared defaults; `year` min/max are patched from the data's real range
  // at render() time (the registry shares this control object).
  controls: [
    // Default opacity tuned so dense bundled fans (e.g. the Holocaust arcs out
    // of DEU) read as layered cables instead of one saturated mass; the
    // per-arc magnitude boost in opacityFor() still makes big events stand out.
    { id: 'opacity', label: 'Opacity', type: 'slider', default: 0.7, min: 0.1, max: 1, step: 0.05 },
    { id: 'year', label: 'Year (≤ shows)', type: 'slider', default: 2025, min: 1864, max: 2025, step: 1 },
    {
      id: 'view', label: 'View', type: 'select', default: 'both',
      options: [
        { value: 'both', label: 'Perpetrators ↔ Victims' },
        { value: 'perp', label: 'Perpetrators only' },
        { value: 'victim', label: 'Victims only' },
      ],
    },
    // event options are appended at mount once data is known; keep an "all"
    // default so the control is valid before/without data.
    { id: 'event', label: 'Event', type: 'select', default: 'all', options: [{ value: 'all', label: 'All events' }] },
    {
      id: 'tier', label: 'Source', type: 'select', default: 'all',
      options: [
        { value: 'all', label: 'All sources' },
        { value: 'curated', label: 'Curated events (cited)' },
        { value: 'ucdp', label: 'UCDP one-sided 1989–2024' },
      ],
    },
  ],

  render(ctx) {
    const data = ctx.data || {};
    const arcs = Array.isArray(data.arcs) ? data.arcs : [];

    // Populate the event select with the events actually present (the panel
    // re-reads module.controls when it builds the row).
    const events = (data._meta && data._meta.events) || [...new Set(arcs.map((a) => a.event))].sort();
    const eventControl = this.controls.find((c) => c.id === 'event');
    if (eventControl) {
      eventControl.options = [{ value: 'all', label: 'All events' }, ...events.map((e) => ({ value: e, label: e }))];
    }
    // snap the year slider to the data's real range
    const range = (data._meta && Array.isArray(data._meta.year_range) && data._meta.year_range.length === 2)
      ? data._meta.year_range : [1864, 2025];
    const yearCtrl = this.controls.find((c) => c.id === 'year');
    if (yearCtrl) { yearCtrl.min = range[0]; yearCtrl.max = range[1]; yearCtrl.default = range[1]; }

    // The filter year: prefer the per-layer slider; fall back to the global year.
    const filterYear = () => {
      const c = ctx.getControl('year');
      return (c != null && c !== '') ? +c : ctx.getYear();
    };

    // CLIENT REDESIGN 2026-06-15 (Adrian): drop death-toll-as-WIDTH. The
    // log-scaled thickness didn't read on the globe and "confused more than it
    // helped" — so every perpetrator→victim line now has a CONSTANT width, and
    // direction (who did it to whom) is shown by an ARROWHEAD at the victim end
    // instead. The death toll still drives the self-event halo radius (a halo is
    // the only mark a self-perpetrated event has) and stays in the data and the
    // Event picker.
    const LINE_WIDTH = 1.6;
    const maxLog = Math.max(1, ...arcs.map((a) => Math.log10(Math.max(1, (a.deaths || 0) + 1))));
    const setMag = (a) => { a._mag = Math.log10(Math.max(1, (a.deaths || 0) + 1)) / maxLog; return a._mag; };

    const lineArcs = arcs.filter((a) => a.from !== a.to);
    const selfArcs = arcs.filter((a) => a.from === a.to);

    // shared renderer for the perpetrator→victim lines
    const arcGroup = ctx.group.append('g').attr('class', 'genocide-arcs');
    const haloGroup = ctx.group.append('g').attr('class', 'genocide-self');
    const renderer = createArcRenderer(arcGroup, { ...ctx, group: arcGroup });
    // slow breathing on the death-toll halos — a memorial pulse, ~7s period
    if (!document.getElementById('genocide-halo-css')) {
      const tag = document.createElement('style');
      tag.id = 'genocide-halo-css';
      tag.textContent = `
        @keyframes gself-breathe { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
        circle.gself { animation: gself-breathe 7s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { circle.gself { animation: none; } }
      `;
      document.head.appendChild(tag);
    }
    // Direction marker — a small arrowhead at the VICTIM end of each arc, so
    // "from where to where / who was the perpetrator" is unmistakable without
    // any motion (memorial stillness preserved — no marching dashes).
    // fill:context-stroke makes the arrowhead inherit each arc's stroke colour.
    arcGroup.append('defs').html(`
      <marker id="genocide-arrow" viewBox="0 0 10 10" refX="8.5" refY="5"
        markerWidth="6.5" markerHeight="6.5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0.5,1 L9,5 L0.5,9 Z" fill="context-stroke"></path>
      </marker>`);

    function activeFilter() {
      const view = ctx.getControl('view') || 'both';
      const ev = ctx.getControl('event') || 'all';
      const tier = ctx.getControl('tier') || 'all';
      return (a) => {
        if (tier !== 'all' && (a.tier || 'curated') !== tier) return false;
        if (ev !== 'all' && a.event !== ev) return false;
        if (view === 'perp' && a.role_from !== 'perpetrator') return false;
        if (view === 'victim' && a.role_to !== 'victim') return false;
        return true;
      };
    }

    // opacity: base from control, dimmed if the event hasn't started by `year`
    function opacityFor(a) {
      const base = ctx.getControl('opacity') ?? 0.8;
      const year = filterYear();
      const sy = parseStartYear(a);
      // when the time axis is off, never dim by year — show all atrocities at once
      const allTime = !!(ctx.isAllTime && ctx.isAllTime());
      const yearDim = (!allTime && sy != null && year != null && year < sy) ? 0.06 : 1;
      // constant weight per Adrian's redesign — no magnitude boost on the line
      return base * yearDim;
    }

    // colour: blend perpetrator hue → victim hue along the arc isn't trivial
    // with a single stroke, so we colour by the dominant role of the current
    // view (victim hue when looking at victims, perpetrator hue otherwise).
    function colorFor() {
      const view = ctx.getControl('view') || 'both';
      return view === 'victim' ? 'var(--arc-victim)' : 'var(--arc-perp)';
    }

    function visibleArcs() {
      const f = activeFilter();
      // attach _mag (used only by the self-event halos now)
      lineArcs.forEach(setMag);
      return lineArcs.filter(f);
    }

    function drawSelf() {
      const f = activeFilter();
      const centroids = ctx.getCentroids ? ctx.getCentroids() : {};
      const view = ctx.getControl('view') || 'both';
      const year = filterYear();
      const baseOp = ctx.getControl('opacity') ?? 0.8;
      const items = selfArcs.filter(f).map((a) => {
        const c = centroids[a.from];
        if (!c) return null;
        const p = ctx.projection(c);
        if (!p || !isFinite(p[0])) return null;
        // horizon cull on the globe
        const vis = ctx.projection.alpha && ctx.projection.alpha() > 0.5 ? true
          : (() => { const rot = ctx.projection.rotate(); const λ0 = -rot[0] * Math.PI / 180, φ0 = -rot[1] * Math.PI / 180; const λ = c[0] * Math.PI / 180, φ = c[1] * Math.PI / 180; return (Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ - λ0)) > -0.02; })();
        if (!vis) return null;
        setMag(a);
        const sy = parseStartYear(a);
        const yearDim = (sy != null && year != null && year < sy) ? 0.06 : 1;
        // a touch larger + thicker than before — the client found the halos hard
        // to see; the death toll still scales the radius (self-events have no line).
        return { a, x: p[0], y: p[1], r: 6 + (a._mag ?? 0.5) * 9, op: baseOp * yearDim };
      }).filter(Boolean);

      const col = view === 'victim' ? 'var(--arc-victim)' : 'var(--arc-perp)';
      const sel = haloGroup.selectAll('circle.gself').data(items, (d) => d.a.event + d.a.from);
      sel.exit().remove();
      sel.enter().append('circle')
        .attr('class', 'gself').attr('fill', 'none').attr('stroke-width', 2.2)
        .merge(sel)
        .attr('cx', (d) => d.x).attr('cy', (d) => d.y).attr('r', (d) => d.r)
        .attr('stroke', col).attr('stroke-opacity', (d) => d.op);
    }

    function redraw() {
      renderer.draw(visibleArcs(), {
        // MEMORIAL STILLNESS — no marching-dash flow animation on this layer:
        // motion reads as traffic/flow, the wrong register for atrocity data.
        // The only movement allowed is the slow breathing of the halos.
        flowAnimate: false,
        color: colorFor,
        width: () => LINE_WIDTH,         // constant — death toll no longer = width
        opacity: opacityFor,
      });
      // arrowhead at the victim end on every genocide arc (set after draw so
      // freshly-entered paths pick it up too). Self-event halos are circles,
      // not path.arc, so they are unaffected.
      arcGroup.selectAll('path.arc').attr('marker-end', 'url(#genocide-arrow)');
      drawSelf();
    }

    // redraw on every globe frame (reproject under rotation) + initial paint
    ctx.onRender(redraw);
    redraw();

    return {
      update() { redraw(); },
      destroy() {
        renderer.clear();
        arcGroup.remove();
        haloGroup.remove();
      },
    };
  },
};
