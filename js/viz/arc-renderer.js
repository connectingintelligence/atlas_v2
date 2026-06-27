// ─────────────────────────────────────────────────────────────
//  ARC RENDERER — shared great-circle arc drawing over globe/flat
//
//  ⚠ STABLE PUBLIC API (Agents A/B/C build against these — do NOT change
//  signatures):
//      createArcRenderer(group, ctx) -> { draw(arcs, opts), clear(), ... }
//      resolveArc(arc, centroids)    -> { from:[lon,lat], to:[lon,lat] } | null
//
//  An "arc" passed to draw() is: { fromIso, toIso, value?, color?, width?,
//  opacity?, id? }  (coords are resolved from centroids), or it may carry
//  explicit { from:[lon,lat], to:[lon,lat] }.
//
//  Note: the FDEB edge-bundling experiment was REMOVED 2026-06-12 — the
//  relaxation degenerated into jagged scribbles on real arc sets and had
//  been disabled for everyone since 2026-06-10. Arcs are plain great
//  circles (globe) / right-hand bows (flat). See git/memory if it is
//  ever worth re-attempting.
// ─────────────────────────────────────────────────────────────

// An endpoint may be a [lon,lat] array, an ISO3 code string (entanglement
// JSON schema uses from/to as ISO3 codes), or absent — in which case the
// fromIso/toIso fields are used. All resolve to a [lon,lat] via centroids.
function resolveEnd(v, isoFallback, centroids) {
  if (Array.isArray(v)) return v;                 // already [lon,lat]
  if (typeof v === 'string') return centroids[v]; // ISO3 code
  return centroids[isoFallback];                  // fromIso/toIso
}

export function resolveArc(arc, centroids) {
  const from = resolveEnd(arc.from, arc.fromIso, centroids);
  const to = resolveEnd(arc.to, arc.toIso, centroids);
  if (!from || !to) return null;
  return { from, to };
}

// Extract an arc's [originIso, destIso] ISO3 codes for the hover-focus
// connection test. Mirrors resolveArc's multi-form handling: an endpoint may
// be an ISO3 string (from/to) or the fromIso/toIso field. When an endpoint is
// a [lon,lat] array it carries no code, so we return null for that side and
// such arcs are treated as not-connected to any hovered country.
function arcEndIso(v, isoFallback) {
  if (typeof v === 'string') return v;            // ISO3 code in from/to
  if (Array.isArray(v)) return null;              // raw [lon,lat] — no code
  return (typeof isoFallback === 'string') ? isoFallback : null; // fromIso/toIso
}
function arcEndpointIsos(arc) {
  return [arcEndIso(arc.from, arc.fromIso), arcEndIso(arc.to, arc.toIso)];
}

// Is a lon/lat on the visible hemisphere given the current rotation?
function makeVisibilityTest(projection) {
  const rot = projection.rotate();
  const alpha = projection.alpha ? projection.alpha() : 0;
  if (alpha > 0.5) return () => true;               // flat-ish: everything visible
  const λ0 = -rot[0] * Math.PI / 180, φ0 = -rot[1] * Math.PI / 180;
  return ([lon, lat]) => {
    const λ = lon * Math.PI / 180, φ = lat * Math.PI / 180;
    const c = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ - λ0);
    return c > -0.05;
  };
}

const DEG = Math.PI / 180;

// ── geodesic helpers (work in lon/lat, on the unit sphere) ──
function toVec([lon, lat]) {
  const λ = lon * DEG, φ = lat * DEG;
  return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
}
function toLonLat([x, y, z]) {
  const lat = Math.asin(Math.max(-1, Math.min(1, z))) / DEG;
  const lon = Math.atan2(y, x) / DEG;
  return [lon, lat];
}
function angleBetween(a, b) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

// One-time CSS for the direction animation: dashes march from origin toward
// destination on FOCUSED arcs only (hover/pin), so direction is visible
// without animating thousands of paths at once.
function injectFlowCss() {
  if (document.getElementById('arc-flow-css')) return;
  const tag = document.createElement('style');
  tag.id = 'arc-flow-css';
  tag.textContent = `
    @keyframes arc-flow { to { stroke-dashoffset: -22; } }
    path.arc.flowing { stroke-dasharray: 14 8; animation: arc-flow .7s linear infinite; }
    @media (prefers-reduced-motion: reduce) { path.arc.flowing { animation: none; stroke-dasharray: none; } }
  `;
  document.head.appendChild(tag);
}

export function createArcRenderer(group, ctx, options = {}) {
  const { projection } = ctx;
  injectFlowCss();
  // Lay a polyline of lon/lat control points down onto the screen, adding the
  // great-circle "altitude" bump and clipping at the horizon. Returns an SVG
  // path string (possibly multi-segment) or null.
  function projectPolyline(lonlats, mag, geometry) {
    const { cx, cy, baseScale, alpha } = geometry;
    const a = lonlats[0], b = lonlats[lonlats.length - 1];

    // ── FLAT MODE: consistent right-hand bow (flow-map convention) ──
    // The globe-mode radial lift below bends arcs away from the SCREEN centre,
    // which on a flat map makes bow directions look random (they depend on
    // where the arc sits on canvas, not on geography). Flat arcs instead bow a
    // fixed fraction to the RIGHT of their travel direction: every curve looks
    // deliberate, and A→B vs B→A bow to opposite sides, so the curve itself
    // encodes direction. Wrap-around pairs (crossing the map edge) fall back
    // to the geodesic path below.
    if (alpha > 0.5 && lonlats.length === 2) {
      const p0 = projection(a), p1 = projection(b);
      if (p0 && p1 && isFinite(p0[0]) && isFinite(p1[0])) {
        const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
        const chord = Math.hypot(dx, dy);
        if (chord > 1 && Math.abs(dx) < cx) {        // cx = half map width
          const px = dy / chord, py = -dx / chord;   // unit perp, right of travel
          const k = Math.min(chord * 0.18, 60) * (1 + 0.3 * (mag || 0));
          const SUB = 24, pts = [];
          for (let i = 0; i <= SUB; i++) {
            const t = i / SUB, bump = Math.sin(t * Math.PI);
            pts.push([p0[0] + dx * t + px * k * bump, p0[1] + dy * t + py * k * bump]);
          }
          return 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L');
        }
      }
    }

    const va = toVec(a), vb = toVec(b);
    const dist = angleBetween(va, vb);
    const altFrac = (0.12 + 0.28 * (dist / Math.PI) + 0.04 * (mag || 0)) * (1 - alpha * 0.7);
    const visible = makeVisibilityTest(projection);

    // densify each control segment so curves stay smooth
    const SUB = Math.max(2, Math.round(48 / (lonlats.length - 1)));
    const samples = [];
    for (let s = 0; s < lonlats.length - 1; s++) {
      const gi = d3.geoInterpolate(lonlats[s], lonlats[s + 1]);
      const last = s === lonlats.length - 2;
      for (let i = 0; i <= SUB; i++) {
        if (i === SUB && !last) continue;               // avoid dupes at joints
        samples.push(gi(i / SUB));
      }
    }

    const segments = [];
    let current = [];
    let prevX = null;
    const N = samples.length - 1;
    for (let i = 0; i < samples.length; i++) {
      const coord = samples[i];
      const p = projection(coord);
      if (!p || !isFinite(p[0]) || !isFinite(p[1]) || !visible(coord)) {
        if (current.length > 1) segments.push(current); current = []; prevX = null; continue;
      }
      // FLAT MODE antimeridian split: an equirectangular map maps x linearly to
      // longitude, so a great circle crossing ±180° produces consecutive samples
      // on opposite map edges. Without a break, the renderer joins them with a
      // straight L that streaks across the whole map (e.g. France→Wallis,
      // USA→Guam, NZ→Tokelau/Niue/Cook Is.). When the projected x jumps more than
      // half the map width (cx), end the current sub-segment so each piece runs to
      // its own edge. Globe mode is unaffected (the horizon cull already breaks it).
      if (alpha > 0.5 && prevX != null && Math.abs(p[0] - prevX) > cx) {
        if (current.length > 1) segments.push(current); current = [];
      }
      prevX = p[0];
      const t = i / N;
      const bump = Math.sin(t * Math.PI);
      const dx = p[0] - cx, dy = p[1] - cy;
      const r = Math.hypot(dx, dy) || 1;
      const nr = r + baseScale * altFrac * bump;
      current.push([cx + dx / r * nr, cy + dy / r * nr]);
    }
    if (current.length > 1) segments.push(current);
    if (!segments.length) return null;
    return segments.map((seg) => 'M' + seg.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')).join(' ');
  }

  function draw(arcs, opts = {}) {
    const centroids = ctx.getCentroids ? ctx.getCentroids() : {};
    const w = projection.translate()[0] * 2, h = projection.translate()[1] * 2;
    const geometry = { cx: w / 2, cy: h / 2, baseScale: projection.scale(), alpha: projection.alpha ? projection.alpha() : 0 };
    const colorFn = opts.color || ((d) => d.color || 'var(--arc-perp)');
    const widthFn = opts.width || ((d) => d.width || 1);
    const opacityFn = opts.opacity || ((d) => d.opacity ?? 0.7);

    // resolve endpoints (skip arcs whose centroids are unknown)
    const resolved = arcs.map((a, i) => {
      const r = resolveArc(a, centroids);
      if (!r) return null;
      return { arc: a, from: r.from, to: r.to, key: a.id ?? `${a.fromIso}-${a.toIso}-${i}`, idx: i };
    }).filter(Boolean);

    // ── HOVER-TO-FOCUS ──
    // Read the live hovered country from the globe state every frame. When a
    // country is hovered, arcs that touch it stay vivid (small boost) while all
    // others are heavily dimmed, so dense entanglement sets become readable.
    // (The connection test uses the arc's ISO3 endpoints, independent of
    // geometry.)
    const hovered = ctx.globe?.state?.hoverIso || null;
    const pinned = ctx.globe?.state?.pinnedIso || null;
    const DIM_FACTOR = 0.12;        // non-connected arcs ×0.12
    const FOCUS_OPACITY_BOOST = 1.25;
    const FOCUS_WIDTH_BOOST = 1.4;

    const prepared = resolved.map((r, i) => {
      const a = r.arc;
      const [originIso, destIso] = arcEndpointIsos(a);
      // PINNED FOCUS — clicking a country pins it (globe.state.pinnedIso); while
      // pinned, draw ONLY the arcs that touch it ("just France's migration /
      // colonies"), hiding the rest. Clicking again unpins and restores all.
      if (pinned && originIso !== pinned && destIso !== pinned) return null;
      const d = projectPolyline([r.from, r.to], a.mag, geometry);
      if (!d) return null;
      const connected = !!hovered && (originIso === hovered || destIso === hovered);
      return { ...a, _d: d, _key: r.key, _connected: connected };
    }).filter((a) => a && a._d);

    // Draw connected (focused) arcs last so they sit on top (higher z). Stable
    // sort keeps original order within each group.
    if (hovered) {
      prepared.sort((p, q) => (p._connected === q._connected ? 0 : p._connected ? 1 : -1));
    }

    // Final stroke attrs: derive from the layer's functions, then apply the
    // hover focus/dim multipliers on top (no per-layer code needed).
    const finalOpacity = (d) => {
      const base = +opacityFn(d);
      if (!hovered) return base;
      return d._connected ? Math.min(1, base * FOCUS_OPACITY_BOOST) : base * DIM_FACTOR;
    };
    const finalWidth = (d) => {
      const base = +widthFn(d);
      return (hovered && d._connected) ? base * FOCUS_WIDTH_BOOST : base;
    };

    const sel = group.selectAll('path.arc').data(prepared, (d) => d._key);
    sel.exit().remove();
    const ent = sel.enter().append('path')
      .attr('class', 'arc').attr('fill', 'none')
      .attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
    if (opts.onClick) ent.style('cursor', 'pointer');
    const all = ent.merge(sel)
      // Re-apply data join order to the DOM so focused arcs render on top.
      .order()
      .attr('d', (d) => d._d)
      .attr('stroke', colorFn)
      .attr('stroke-width', finalWidth)
      .attr('stroke-opacity', finalOpacity)
      // animate flow direction on the focused subset only. Layers can opt out
      // (opts.flowAnimate = false): the genocide layer keeps its arcs STILL —
      // marching dashes read as cheerful traffic, which is the wrong register
      // for atrocity data.
      .classed('flowing', (d) => opts.flowAnimate !== false && (!!pinned || d._connected))
      .attr('data-id', (d) => d._key);
    if (opts.onClick) all.on('click', (ev, d) => opts.onClick(d, ev));
    else all.on('click', null);
  }

  function clear() { group.selectAll('path.arc').remove(); }

  return { draw, clear };
}
