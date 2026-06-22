// ─────────────────────────────────────────────────────────────
//  LAYER: historical-borders  (surface group)
//  Polity borders AS THEY WERE — answers the "scrub to 1500 and the
//  map still shows today's states" anachronism. Swaps a whole-world
//  polity map in under the arcs, snapped to the latest era sheet at
//  or before the scrubbed year (showing 1783 borders at 1750 would
//  be a future leak, so we always snap DOWNWARD).
//
//  Surface group = radio with the CFCT choropleth: the modern
//  composite painted over 1500 polities would be its own anachronism,
//  so the registry's exclusivity is the honest behaviour here.
//
//  Data: data/historical_borders/world_<era>.geojson (symlink →
//  data/raw_sources/historical_basemaps/), lazy-loaded per era and
//  cached. Source: aourednik/historical-basemaps (GPL-3.0) — see
//  methodology/historical-borders.md for its accuracy caveats; the
//  per-feature BORDERPRECISION rating is surfaced in the tooltip.
// ─────────────────────────────────────────────────────────────

const ERAS = [1400, 1492, 1500, 1530, 1600, 1650, 1700, 1715, 1783, 1800,
  1815, 1880, 1900, 1914, 1920, 1930, 1938, 1945, 1960, 1994, 2000, 2010];

const PRECISION_HINT = { 1: 'border precision: good', 2: 'border precision: approximate', 3: 'border precision: rough' };

// muted but distinct fill per polity name — deterministic hash → HSL.
// Low saturation keeps the arcs readable on top.
function fillFor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, ${34 + (h >> 9) % 18}%, ${58 + (h >> 4) % 14}%)`;
}

function eraFor(year) {
  let best = ERAS[0];
  for (const e of ERAS) if (e <= year) best = e; else break;
  return best;
}

export default {
  id: 'historical-borders',
  label: 'Historical borders',
  group: 'surface',
  methodologyPath: 'methodology/historical-borders.md',
  controls: [
    { id: 'opacity', label: 'Opacity', type: 'slider', default: 0.55, min: 0.05, max: 1, step: 0.05 },
    { id: 'fills', label: 'Fill polities', type: 'toggle', default: true },
  ],

  render(ctx) {
    const cache = new Map();      // era -> features
    let loadedEra = null;         // era currently drawn
    let loading = null;           // era being fetched (de-dupes fetches)
    const g = ctx.group.append('g').attr('class', 'hist-borders');

    // While we're on, today's country strokes step far back (they stay as a
    // faint ghost for orientation, deliberately not invisible).
    const svg = ctx.group.node().ownerSVGElement;
    if (svg && !document.getElementById('hist-borders-css')) {
      const tag = document.createElement('style');
      tag.id = 'hist-borders-css';
      tag.textContent = `
        svg.hist-on .countries path.country { stroke-opacity:.12; fill-opacity:.25; }
        .hist-borders path { cursor:default; }`;
      document.head.appendChild(tag);
    }
    svg?.classList.add('hist-on');

    async function loadEra(era) {
      if (cache.has(era)) return cache.get(era);
      const r = await fetch(`data/historical_borders/world_${era}.geojson`);
      if (!r.ok) throw new Error(`historical borders ${era}: HTTP ${r.status}`);
      const gj = await r.json();
      cache.set(era, gj.features || []);
      return cache.get(era);
    }

    function titleFor(p, era) {
      const name = p.NAME || 'Unnamed';
      const ruler = p.SUBJECTO && p.SUBJECTO !== name ? ` — subject to ${p.SUBJECTO}` : '';
      const part = !ruler && p.PARTOF && p.PARTOF !== name ? ` — part of ${p.PARTOF}` : '';
      const prec = PRECISION_HINT[p.BORDERPRECISION] || '';
      return `${name}${ruler}${part}\nmap of ${era} · ${prec}`;
    }

    function emitStats(era, n) {
      document.dispatchEvent(new CustomEvent('atlas:stats', {
        detail: { coverage: `${n} polities`, mean: `map of ${era}`, peak: 'approx. borders' },
      }));
    }

    function draw(features, era) {
      const op = +ctx.getControl('opacity');
      const fills = ctx.getControl('fills') !== false;
      const sel = g.selectAll('path').data(features, (d) => (d.properties.NAME || '') + era);
      sel.exit().remove();
      sel.enter().append('path')
        .attr('stroke', 'var(--ink-dim, #6b6358)')
        .attr('stroke-width', 0.7)
        .attr('vector-effect', 'non-scaling-stroke')
        .each(function (d) {
          d3.select(this).append('title').text(titleFor(d.properties, era));
        })
        .merge(sel)
        .attr('d', ctx.path)
        .attr('fill', (d) => (fills ? fillFor(d.properties.NAME) : 'none'))
        .attr('fill-opacity', op * 0.42)
        .attr('stroke-opacity', Math.min(1, op + 0.2));
    }

    // throttle continuous re-pathing (auto-rotate/drag) to ~14fps — ~300
    // polity polygons re-pathed per frame is the next-heaviest cost after
    // the territories layer; era swaps and control changes bypass this
    let lastPath = 0;
    function frame() {
      // all-time = "no single year" → use the most recent sheet as the frame
      const year = (ctx.isAllTime && ctx.isAllTime()) ? ERAS[ERAS.length - 1] : ctx.getYear();
      const era = eraFor(year || ERAS[ERAS.length - 1]);
      const now = performance.now();
      if (era === loadedEra && now - lastPath < 70) return;
      lastPath = now;
      if (era !== loadedEra) {
        if (loading !== era) {
          loading = era;
          loadEra(era).then((feats) => {
            if (loading !== era) return;       // superseded by a later scrub
            loadedEra = era; loading = null;
            g.selectAll('path').remove();      // era swap: rebuild the join
            draw(feats, era);
            emitStats(era, feats.length);
            ctx.requestRender();
          }).catch((e) => { loading = null; console.warn(e); });
        }
        if (loadedEra == null) return;         // nothing drawn yet
      }
      if (loadedEra != null) draw(cache.get(loadedEra), loadedEra);
    }

    ctx.onRender(frame);
    ctx.requestRender();

    return {
      update() { ctx.requestRender(); },
      destroy() { g.remove(); svg?.classList.remove('hist-on'); },
    };
  },
};
