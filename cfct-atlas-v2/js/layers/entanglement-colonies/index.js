// ─────────────────────────────────────────────────────────────
//  LAYER: entanglement-colonies — colonizer -> colonized arcs
//  LAYERED source (decided with client 2026-06-06):
//    • PRIMARY   tier — COLDAT (Becker 2019): the 8 European overseas empires,
//                       each tie with real start & end years.
//    • SECONDARY tier — ICOW Colonial History 1.1 (Hensel): the "other empires"
//                       COLDAT omits (Ottoman, Russian/Soviet, Austro-Hungarian,
//                       US, Japanese, Chinese, Aus/NZ). No colonisation start
//                       year (start_year null); end_year = independence date.
//  Default view = ALL history (every tie 1462–2008 at once). Switching the
//  Time control to "Snapshot year" filters to start_year <= year <= end_year,
//  so dragging the slider replays the rise and fall of empires. The "Empires"
//  control toggles the ICOW overlay on/off; secondary arcs render slightly
//  dimmer so the rigorous COLDAT core reads as primary.
//
//  Data: data/colonies.json  (symlink -> ../../data/processed/entanglement/colonies.json)
//  Built by: pipeline/build_entanglement_colonies.py  (see methodology/colonies.md)
// ─────────────────────────────────────────────────────────────

import { createArcRenderer } from '../../viz/arc-renderer.js';

// Distinct hue per colonizer so empires read apart on the globe.
const COLONIZER_COLOR = {
  GBR: '#d94f4f', // British  — red
  FRA: '#4f7fd9', // French   — blue
  ESP: '#e0a020', // Spanish  — gold
  PRT: '#3fae6b', // Portuguese — green
  NLD: '#e07b39', // Dutch    — orange
  DEU: '#8a8f99', // German   — grey
  ITA: '#7bc043', // Italian  — lime
  BEL: '#b07ad9', // Belgian  — violet
  // ICOW "other empires" overlay (secondary tier)
  TUR: '#caa24a', // Ottoman      — antique gold
  RUS: '#3f6e8c', // Russian/USSR — steel blue (kept well clear of British red:
                  //   at 1938 Russia's huge landmass read as the same dark red
                  //   as the UK once the territory paint darkened it — client note)
  AUT: '#9a6fb0', // Austria-Hung.— mauve
  USA: '#36c5c0', // US           — teal
  JPN: '#d94f8c', // Japanese     — magenta
  CHN: '#d98c36', // Chinese      — amber
  AUS: '#5f9ea0', // Australian   — cadet
  NZL: '#7f9c5f', // NZ           — moss
  DNK: '#9d6b4f', // Danish       — brown
};
const DEFAULT_COLOR = 'var(--arc-perp)';

function colorFor(iso3) { return COLONIZER_COLOR[iso3] || DEFAULT_COLOR; }

export default {
  id: 'entanglement-colonies',
  label: 'Colonies',
  group: 'entanglement',
  methodologyPath: 'methodology/colonies.md',
  dataPath: 'data/colonies.json',
  controls: [
    {
      // Empires aren't flows between two points — they're POSSESSION over
      // time. Default view paints each country with the colour of the empire
      // that ruled it (arcs appear when you pin a country); 'arcs' restores
      // the classic all-arcs view; 'both' stacks them.
      id: 'display', label: 'Display', type: 'select', default: 'territory',
      options: [
        { value: 'territory', label: 'Territory (+ arcs on pin)' },
        { value: 'arcs', label: 'Arcs' },
        { value: 'both', label: 'Territory + arcs' },
      ],
    },
    {
      // Default to the FULL sweep of colonial history. A year snapshot hides
      // any tie not active that year (e.g. at 1938 all of Spanish America is
      // long independent → no Europe↔South America arcs), which reads as
      // missing data. "Snapshot year" opts back into the replay mode.
      id: 'timeMode', label: 'Time', type: 'select', default: 'all',
      options: [
        { value: 'all', label: 'All history (1462–2008)' },
        { value: 'year', label: 'Snapshot year (slider)' },
      ],
    },
    { id: 'year', label: 'Year', type: 'slider', default: 1938, min: 1450, max: 2016, step: 1 },
    { id: 'opacity', label: 'Opacity', type: 'slider', default: 0.6, min: 0.05, max: 1, step: 0.05 },
    {
      // Toggle the ICOW "other empires" overlay (secondary tier). Default to
      // showing everything so the layered story (e.g. Tunisia: Ottoman then
      // French) is visible; "European overseas only" falls back to the rigorous
      // COLDAT core.
      id: 'empires', label: 'Empires', type: 'select', default: 'all',
      options: [
        { value: 'all', label: 'All empires (+ ICOW)' },
        { value: 'primary', label: 'European overseas only (COLDAT)' },
      ],
    },
  ],

  render(ctx) {
    const data = ctx.data || {};
    const allArcs = Array.isArray(data.arcs) ? data.arcs : [];
    // territory paint sits UNDER the arcs in the layer's own group
    const terrG = ctx.group.insert('g', ':first-child').attr('class', 'colony-territory');
    // Bundling OFF: with all 206 ties visible (all-history default) the FDEB
    // pass degenerates into a jagged tangle over the Atlantic corridor —
    // empire-coloured great circles fanning out cleanly read far better.
    const arcs = createArcRenderer(ctx.group, ctx);

    // The layer owns its own year via the `year` control (default 1938) so it
    // can replay colonial history independently of the global year. We also
    // respect the global ctx.getYear() if no per-layer control exists.
    function currentYear() {
      const y = ctx.getControl('year');
      return (y == null) ? ctx.getYear() : +y;
    }

    function visibleArcs() {
      const year = currentYear();
      // All ties show when the layer's own Time mode is 'all' (the default) or
      // the global time axis is switched off; the year window only applies in
      // the opt-in 'Snapshot year' mode.
      const allTime = (ctx.getControl('timeMode') || 'all') !== 'year'
        || !!(ctx.isAllTime && ctx.isAllTime());
      const showSecondary = (ctx.getControl('empires') || 'all') !== 'primary';
      return allArcs.filter((a) => {
        if (a.tier === 'secondary' && !showSecondary) return false;
        if (allTime) return true;                       // time axis off → every tie
        // ICOW secondary arcs have a null start_year (colonisation start not
        // coded); treat null bounds as open so the tie shows up to independence.
        const afterStart = (a.start_year == null) || (a.start_year <= year);
        const beforeEnd = (a.end_year == null) || (year <= a.end_year);
        return afterStart && beforeEnd;
      }).map((a) => ({
        fromIso: a.from || a.colonizer,
        toIso: a.to || a.colonized,
        id: `${a.colonizer}->${a.colonized}`,
        tier: a.tier,
        colonizer: a.colonizer,
      }));
    }

    function emitStats(list) {
      const empires = new Set(list.map((d) => d.colonizer));
      const snapshot = (ctx.getControl('timeMode') || 'all') === 'year'
        && !(ctx.isAllTime && ctx.isAllTime());
      document.dispatchEvent(new CustomEvent('atlas:stats', {
        detail: {
          coverage: `${list.length} ties`,
          mean: `${empires.size} empires`,
          peak: snapshot ? `${currentYear()}` : '1462–2008',
        },
      }));
    }

    // ── territory paint: each country filled with its ruling empire ──
    // For the active window, map colonised -> colonizer. With several rulers
    // (e.g. Tunisia: Ottoman then French) the PRIMARY (COLDAT) tie wins, then
    // the most recent end_year — "the empire whose mark was left last".
    function rulerMap() {
      const best = new Map();   // colonised iso -> arc
      const year = currentYear();
      const allTime = (ctx.getControl('timeMode') || 'all') !== 'year'
        || !!(ctx.isAllTime && ctx.isAllTime());
      const showSecondary = (ctx.getControl('empires') || 'all') !== 'primary';
      for (const a of allArcs) {
        if (a.tier === 'secondary' && !showSecondary) continue;
        if (!allTime) {
          const afterStart = (a.start_year == null) || (a.start_year <= year);
          const beforeEnd = (a.end_year == null) || (year <= a.end_year);
          if (!afterStart || !beforeEnd) continue;
        }
        const cur = best.get(a.colonized);
        if (!cur
          || (a.tier === 'primary' && cur.tier === 'secondary')
          || (a.tier === cur.tier && (a.end_year || 0) > (cur.end_year || 0))) {
          best.set(a.colonized, a);
        }
      }
      return best;
    }

    function paintTerritory(show) {
      const feats = (ctx.globe && ctx.globe.state && ctx.globe.state.countries) || [];
      if (!show || !feats.length) { terrG.selectAll('path').remove(); return; }
      const rulers = rulerMap();
      const colonizers = new Set([...rulers.values()].map((a) => a.colonizer));
      const path = d3.geoPath(ctx.projection);
      const items = feats.filter((f) => f.__iso3 && (rulers.has(f.__iso3) || colonizers.has(f.__iso3)));
      const sel = terrG.selectAll('path.terr').data(items, (f) => f.__iso3);
      sel.exit().remove();
      sel.enter().append('path').attr('class', 'terr')
        .attr('stroke', '#fff').attr('stroke-width', 0.4).attr('pointer-events', 'none')
        .merge(sel)
        .attr('d', path)
        .attr('fill', (f) => {
          const tie = rulers.get(f.__iso3);
          if (tie) {
            const c = d3.color(COLONIZER_COLOR[tie.colonizer] || '#9b8b78');
            return tie.tier === 'secondary' ? c.brighter(0.7).formatHex() : c.brighter(0.25).formatHex();
          }
          const core = d3.color(COLONIZER_COLOR[f.__iso3] || '#9b8b78');  // the empire's core
          return core.darker(0.8).formatHex();
        })
        .attr('fill-opacity', (f) => (rulers.has(f.__iso3) ? 0.62 : 0.7));
    }

    function paint() {
      const display = ctx.getControl('display') || 'territory';
      const pinned = ctx.globe?.state?.pinnedIso || null;
      const showTerr = display !== 'arcs';
      // territory mode keeps the map calm: arcs only when a country is pinned
      const showArcs = display === 'arcs' || display === 'both' || (display === 'territory' && pinned);
      paintTerritory(showTerr);
      const list = showArcs ? visibleArcs() : [];
      const op = +ctx.getControl('opacity');
      const opacity = Number.isFinite(op) ? op : 0.7;
      arcs.draw(list, {
        color: (d) => colorFor(d.colonizer),
        // COLDAT (primary) cables read a touch heavier than the ICOW overlay.
        width: (d) => (d.tier === 'secondary' ? 1.4 : 2.0),
        // Secondary (ICOW) arcs render dimmer so the rigorous core stays primary.
        opacity: (d) => (d.tier === 'secondary' ? opacity * 0.72 : opacity),
      });
      emitStats(showArcs ? list : visibleArcs());
    }

    // redraw every frame so arcs reproject as the globe rotates
    ctx.onRender(paint);
    paint();

    return {
      update() { paint(); ctx.requestRender(); },
      destroy() { arcs.clear(); terrG.remove(); },
    };
  },
};
