// ─────────────────────────────────────────────────────────────
//  LAYER: indigenous-territories
//  Indigenous territories from Native Land Digital, drawn OVER the
//  modern state grid. Deliberately PRESENT-TENSE: the dataset is not
//  time-coded and Native Land frames it as a living assertion of
//  whose land this is — so the layer ignores the time scrubber.
//  Overlaying these territories across USA/CAN/AUS/South-American
//  borders is the visual argument that today's states sit on top of
//  other nations — without pretending we know the map of 1500.
//
//  HONESTY CONSTRAINTS (Native Land's own, carried into the UI):
//  not legal or academic boundaries; territories overlap by design;
//  the data evolves. Tooltip + stat rail + methodology all say so.
//
//  Data: data/indigenous_territories.geojson (symlink) — fetched from
//  the public ArcGIS mirror of Native Land's territories (vintage
//  2023-10; canonical live data needs a free native-land.ca API key).
// ─────────────────────────────────────────────────────────────

export default {
  id: 'indigenous-territories',
  label: 'Indigenous territories',
  group: 'entanglement',          // coexists with surfaces + arc layers
  methodologyPath: 'methodology/indigenous-territories.md',
  dataPath: 'data/indigenous_territories.geojson',
  controls: [
    { id: 'opacity', label: 'Opacity', type: 'slider', default: 0.45, min: 0.05, max: 1, step: 0.05 },
    { id: 'fills', label: 'Fill territories', type: 'toggle', default: true },
  ],

  render(ctx) {
    const feats = (ctx.data && ctx.data.features) || [];
    const g = ctx.group.append('g').attr('class', 'indig-territories');

    // PERFORMANCE: this is the heaviest layer on the page (~112k polygon
    // vertices across 2,059 paths). Two mitigations keep it smooth:
    //  1. back-hemisphere culling on the globe — features whose centroid is
    //     behind the horizon get display:none and skip re-pathing entirely;
    //  2. re-pathing is throttled to ~14fps during continuous motion
    //     (auto-rotate/drag). Territories are large, slow shapes — the
    //     arcs/particles keep full frame rate, so motion stays alive.
    const centroids = feats.map((f) => d3.geoCentroid(f));

    const nodes = [];
    const sel = g.selectAll('path').data(feats)
      .enter().append('path')
      .attr('stroke-width', 0.6)
      .attr('vector-effect', 'non-scaling-stroke')
      .each(function (d) {
        nodes.push(this);
        const name = d.properties?.Name || 'Unnamed territory';
        d3.select(this).append('title')
          .text(`${name}\nNative Land Digital — asserted territory today;\nnot a legal boundary · overlaps are real`);
      });

    const DEG = Math.PI / 180;
    function frontTest() {
      const proj = ctx.projection;
      const alpha = proj.alpha ? proj.alpha() : 0;
      if (alpha > 0.5) return null;                 // flat: everything visible
      const rot = proj.rotate();
      const l0 = -rot[0] * DEG, p0 = -rot[1] * DEG;
      const sp0 = Math.sin(p0), cp0 = Math.cos(p0);
      return ([lon, lat]) => {
        const l = lon * DEG, p = lat * DEG;
        return (sp0 * Math.sin(p) + cp0 * Math.cos(p) * Math.cos(l - l0)) > -0.12;
      };
    }

    let lastPath = 0;
    function redraw(force) {
      const now = performance.now();
      if (force !== true && now - lastPath < 70) return;
      lastPath = now;
      const op = +ctx.getControl('opacity');
      const fills = ctx.getControl('fills') !== false;
      const front = frontTest();
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (front && !front(centroids[i])) {
          node.setAttribute('display', 'none');
          continue;                                  // skip re-pathing hidden shapes
        }
        node.removeAttribute('display');
        node.setAttribute('d', ctx.path(feats[i]) || '');
        const color = feats[i].properties?.color || '#a86b32';
        node.setAttribute('fill', fills ? color : 'none');
        node.setAttribute('fill-opacity', op * 0.22);  // overlaps stack — keep faint
        node.setAttribute('stroke', color);
        node.setAttribute('stroke-opacity', Math.min(1, op * 0.9));
      }
    }

    function emitStats() {
      document.dispatchEvent(new CustomEvent('atlas:stats', {
        detail: {
          coverage: `${feats.length} territories`,
          mean: 'asserted today — not year-bound',
          peak: 'not legal boundaries',
        },
      }));
    }

    // ── HOVER LABEL: move the cursor over the map and see which Indigenous
    // nation(s) you're pointing at (client 2026-06-16: "I want to see which
    // ones they are"). Native <title> tooltips are slow and easy to miss;
    // this is instant. We invert the pointer to lon/lat and hit-test the
    // polygons — but only those whose bounding box contains the point AND
    // whose centroid is on the visible hemisphere, so it stays cheap.
    const bbox = feats.map((f) => {
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      const polys = f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates
        : f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : [];
      for (const poly of polys) for (const ring of poly) for (const [x, y] of ring) {
        if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y;
      }
      return [a, b, c, d];
    });
    function pipRing(pt, ring) {
      const [x, y] = pt; let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[j], [x2, y2] = ring[i];
        if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) inside = !inside;
      }
      return inside;
    }
    function contains(geom, pt) {
      const polys = geom?.type === 'MultiPolygon' ? geom.coordinates
        : geom?.type === 'Polygon' ? [geom.coordinates] : [];
      return polys.some((p) => p[0] && pipRing(pt, p[0]));
    }
    // Expose a point→territory-names lookup so the ONE shared hover tooltip
    // (built in app.js) can show an "Indigenous land: …" line inline, instead
    // of a second floating box stacking on top of it. Cleared on destroy, so
    // the line only appears while this layer is visible.
    function namesAt(ll) {
      if (!ll || !isFinite(ll[0]) || !isFinite(ll[1])) return [];
      const out = [];
      for (let i = 0; i < feats.length; i++) {
        const b = bbox[i];
        if (ll[0] < b[0] || ll[0] > b[2] || ll[1] < b[1] || ll[1] > b[3]) continue;
        if (contains(feats[i].geometry, ll)) {
          out.push(feats[i].properties?.Name || 'Unnamed territory');
          if (out.length >= 8) break;
        }
      }
      return out;
    }
    window.atlasIndigenous = { namesAt };

    ctx.onRender(redraw);
    emitStats();
    redraw(true);
    ctx.requestRender();

    return {
      update() { emitStats(); redraw(true); ctx.requestRender(); },
      destroy() {
        g.remove();
        if (window.atlasIndigenous && window.atlasIndigenous.namesAt === namesAt) window.atlasIndigenous = null;
      },
    };
  },
};
