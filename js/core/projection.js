// ─────────────────────────────────────────────────────────────
//  GLOBE ENGINE — orthographic ⇄ flat, rotatable, layer-aware
//  Adapted from atlas/js/globe.js, extended with a smooth projection
//  morph (the v2 2D↔3D toggle) and a render-hook API that overlay
//  layers (arcs) subscribe to so they reproject every frame.
//
//  d3 + topojson are expected on window (loaded via CDN <script> in
//  index.html before the module graph runs).
// ─────────────────────────────────────────────────────────────

// 50m (not 110m): the 1:110m topology drops small island states entirely —
// Malta, Singapore, Mauritius, Maldives, the Caribbean/Pacific micro-states —
// so they were unsearchable-to-nothing on the map. 50m includes them (id_to_iso3
// in country-meta.json already covers their numeric codes). Heavier than 110m
// but matches what v1 used.
const WORLD_URL = 'vendor/countries-50m.json';  // vendored — runs offline

// Morph between two raw projections via a mutator. alpha=0 → orthographic
// (globe), alpha=1 → equirectangular (flat). The raw fns ship with d3-geo.
function interpolatedProjection() {
  const raw0 = d3.geoOrthographicRaw;
  const raw1 = d3.geoEquirectangularRaw;
  let t = 0;
  // The blended raw needs its OWN `.invert`, otherwise geoProjectionMutator
  // leaves projection.invert undefined (it sets `projection.invert` from
  // `raw.invert` on every mutate) — which silently broke screen→lon/lat
  // everywhere it is used: the click→pin lon/lat that the indigenous hit-test
  // and the territory hover label depend on. We give the raw the matching
  // endpoint inverse — exact at the globe (t≈0, orthographic) and flat (t≈1,
  // equirectangular) ends, nearest of the two during the brief morph.
  const mutate = d3.geoProjectionMutator((tt) => {
    const f = (x, y) => {
      const [x0, y0] = raw0(x, y);
      const [x1, y1] = raw1(x, y);
      return [x0 + tt * (x1 - x0), y0 + tt * (y1 - y0)];
    };
    f.invert = (tt < 0.5 ? raw0.invert : raw1.invert);
    return f;
  });
  const proj = mutate(t);
  proj.alpha = function (_) { return arguments.length ? mutate((t = +_)) : t; };
  return proj;
}

export function createGlobe(container, opts = {}) {
  const state = {
    rotation: opts.rotation || [20, -15, 0],
    autoRotate: opts.autoRotate !== false,
    rotateSpeed: opts.rotateSpeed ?? 0.16,
    showGraticule: opts.showGraticule !== false,
    proj: opts.projection === 'flat' ? 1 : 0,   // 0=globe, 1=flat
    zoom: 1, zoomMin: 0.6, zoomMax: 10,
    countries: null,
    centroids: {},
    hoverIso: null,
    pinnedIso: null,
    width: container.clientWidth,
    height: container.clientHeight,
  };

  let paintFn = null;                 // (iso3) -> fill colour, set by the active surface layer
  const renderHooks = new Set();      // overlay layers subscribe; called after each base draw

  const svg = d3.select(container).append('svg')
    .attr('width', state.width).attr('height', state.height)
    .attr('viewBox', `0 0 ${state.width} ${state.height}`);

  const defs = svg.append('defs');
  const grad = defs.append('radialGradient').attr('id', 'v2-atmos');
  grad.append('stop').attr('offset', '0%').attr('stop-color', 'var(--globe-atmos-inner)');
  grad.append('stop').attr('offset', '100%').attr('stop-color', 'var(--globe-atmos-outer)');
  const sphereGrad = defs.append('radialGradient').attr('id', 'v2-sphere-shade')
    .attr('cx', '35%').attr('cy', '32%').attr('r', '75%');
  sphereGrad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(255,255,255,0.09)');
  sphereGrad.append('stop').attr('offset', '60%').attr('stop-color', 'rgba(0,0,0,0)');
  sphereGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(0,0,0,0.35)');

  const g = svg.append('g');
  const atmos = g.append('circle').attr('class', 'atmos').attr('fill', 'url(#v2-atmos)');
  const oceanPath = g.append('path').attr('class', 'ocean');
  const graticulePath = g.append('path').attr('class', 'graticule');
  const countriesG = g.append('g').attr('class', 'countries');
  const overlayG = g.append('g').attr('class', 'overlay').style('pointer-events', 'none');
  const shadePath = g.append('path').attr('class', 'sphere-shade').attr('fill', 'url(#v2-sphere-shade)');

  const projection = interpolatedProjection().precision(0.4);
  const pathGen = d3.geoPath(projection);
  const graticule = d3.geoGraticule10();

  function scaleFor() {
    const w = state.width, h = state.height;
    const globeScale = Math.min(w, h) * 0.46;
    const flatScale = (w * 0.46) / Math.PI;
    // ease the scale across the morph so neither end clips
    return (globeScale + state.proj * (flatScale - globeScale)) * state.zoom;
  }

  function sizeForViewport() {
    const w = container.clientWidth, h = container.clientHeight;
    state.width = w; state.height = h;
    projection.translate([w / 2, h / 2]).scale(scaleFor());
    svg.attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`);
    const s = scaleFor();
    atmos.attr('cx', w / 2).attr('cy', h / 2).attr('r', s * 1.12)
      .style('opacity', 1 - state.proj);          // halo fades out when flat
    grad.attr('cx', w / 2).attr('cy', h / 2).attr('r', s * 1.12).attr('gradientUnits', 'userSpaceOnUse');
  }

  function render() {
    projection.alpha(state.proj);
    // Globe (alpha≈0): small-circle clip at 90° hides the back hemisphere.
    // Once morphing/flat: clipAngle(null) restores d3's antimeridian cutting,
    // so polygons crossing ±180° (Russia, Fiji, Antarctica) don't smear into
    // full-width bands across the flat map.
    projection.clipAngle(state.proj < 0.04 ? 90 : null);
    projection.rotate(state.rotation).scale(scaleFor()).translate([state.width / 2, state.height / 2]);

    const sphere = pathGen({ type: 'Sphere' });
    oceanPath.attr('d', sphere);
    shadePath.attr('d', sphere).style('opacity', Math.max(0, 1 - state.proj * 1.4));
    graticulePath.attr('d', state.showGraticule ? pathGen(graticule) : null);
    if (state.countries) countriesG.selectAll('path.country').attr('d', pathGen);
    renderHooks.forEach((fn) => { try { fn(); } catch (e) { console.warn('render hook failed', e); } });
  }

  function paintCountries() {
    countriesG.selectAll('path.country')
      .attr('fill', (d) => {
        if (!d.__iso3) return 'var(--country-absent)';
        const c = paintFn ? paintFn(d.__iso3) : null;
        return c || 'var(--country-absent)';
      })
      .attr('data-dimmed', (d) => (state.pinnedIso && d.__iso3 !== state.pinnedIso ? 'true' : null));
  }

  async function loadWorld(meta) {
    const topo = await d3.json(WORLD_URL);
    const feats = topojson.feature(topo, topo.objects.countries).features;
    const idToIso = meta?.id_to_iso3 || {};
    const nameToIso = meta?.name_to_iso3 || {};
    for (const f of feats) {
      const numId = String(f.id).padStart(3, '0');
      f.__iso3 = idToIso[numId] || (f.properties && nameToIso[f.properties.name]) || null;
    }
    state.countries = feats;
    state.centroids = {};
    // Anchor each country at its MAINLAND (largest polygon), not the centroid
    // of the whole MultiPolygon — otherwise overseas territories drag the
    // point off-country (France + French Guiana put every arc endpoint in the
    // Bay of Biscay; USA + Alaska/Hawaii, Japan, Indonesia were also skewed).
    const mainlandCentroid = (f) => {
      const g = f.geometry;
      if (!g || g.type !== 'MultiPolygon') return d3.geoCentroid(f);
      let best = null, bestArea = -1;
      for (const coords of g.coordinates) {
        const poly = { type: 'Polygon', coordinates: coords };
        const a = d3.geoArea(poly);
        if (a > bestArea) { bestArea = a; best = poly; }
      }
      return best ? d3.geoCentroid(best) : d3.geoCentroid(f);
    };
    for (const f of feats) if (f.__iso3) state.centroids[f.__iso3] = mainlandCentroid(f);

    countriesG.selectAll('path.country').data(feats, (d) => d.id).join('path')
      .attr('class', 'country')
      .on('mousemove', onHover).on('mouseleave', onLeave).on('click', onClick);

    render(); paintCountries();
    if (opts.onReady) opts.onReady(api);
  }

  // ── interactions ──
  function onHover(ev, d) {
    const changed = state.hoverIso !== d.__iso3;
    state.hoverIso = d.__iso3;
    if (opts.onHover) opts.onHover(d.__iso3, ev, d);
    // re-render so overlay layers (arc hover-focus) update even when not auto-rotating
    if (changed && !state.autoRotate) render();
  }
  function onLeave(ev) {
    const changed = state.hoverIso != null;
    state.hoverIso = null;
    if (opts.onHover) opts.onHover(null, ev, null);
    if (changed && !state.autoRotate) render();
  }
  function onClick(ev, d) {
    if (!d.__iso3) return;
    state.pinnedIso = state.pinnedIso === d.__iso3 ? null : d.__iso3;
    paintCountries();
    // geographic click point (for overlays that hit-test polygons, e.g.
    // indigenous territories in the country chip); null if not invertible
    let lonlat = null;
    try { lonlat = projection.invert(d3.pointer(ev, svg.node())) || null; } catch (e) {}
    if (opts.onPinChange) opts.onPinChange(state.pinnedIso, d, lonlat);
    if (state.pinnedIso && state.proj < 0.5) {
      const c = state.centroids[d.__iso3];
      if (c) spinTo([-c[0], -c[1], 0], 800);
    }
    // Re-render immediately so overlay arc layers re-focus on (or release) the
    // pinned country even when not auto-rotating or in flat mode.
    render();
  }

  // ── drag rotate + pinch zoom ──
  // touch-action:none keeps the browser from hijacking touches for page
  // pan / pinch-to-zoom / rubber-band scroll while the user works the globe.
  // It is inert on desktop (mouse) input.
  svg.style('touch-action', 'none');

  let dragStart = null, rotStart = null;
  let pinchStart = null;   // { dist, zoom } while a 2-finger pinch is active

  function pinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  // Pointer position relative to the svg. CRITICAL: d3.pointer() reads
  // event.clientX, which is UNDEFINED on a TouchEvent (coords live in
  // event.touches[*]) — so it returns [NaN,NaN] and the globe never moves on a
  // phone. Extract the first touch ourselves for touch input; keep d3.pointer
  // for mouse so desktop behaviour is byte-for-byte unchanged.
  function dragXY(ev) {
    const t = (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]);
    if (t) {
      const r = svg.node().getBoundingClientRect();
      return [t.clientX - r.left, t.clientY - r.top];
    }
    return d3.pointer(ev, svg.node());
  }

  svg.on('mousedown.drag touchstart.drag', (ev) => {
    // Two fingers down → begin a pinch-zoom gesture and cancel any single-finger
    // drag-rotate that may have started, so the globe doesn't rotate mid-pinch.
    if (ev.touches && ev.touches.length === 2) {
      ev.preventDefault();
      pinchStart = { dist: pinchDistance(ev.touches), zoom: state.zoom };
      dragStart = null;
      if (state.autoRotate) {
        state.autoRotate = false;
        if (opts.onAutoRotateChange) opts.onAutoRotateChange(false);
      }
      return;
    }
    state.autoRotate = false;
    if (opts.onAutoRotateChange) opts.onAutoRotateChange(false);
    dragStart = dragXY(ev);
    rotStart = state.rotation.slice();
  }, { passive: false });

  d3.select(window).on('mousemove.drag touchmove.drag', (ev) => {
    // Pinch takes priority; never rotate while 2+ fingers are down.
    if (ev.touches && ev.touches.length >= 2) {
      if (pinchStart) {
        ev.preventDefault();
        const ratio = pinchDistance(ev.touches) / pinchStart.dist;
        setZoom(pinchStart.zoom * ratio, false);
      }
      return;
    }
    if (!dragStart) return;
    // a finger is dragging the globe → stop the page from scrolling/bouncing
    if (ev.touches) ev.preventDefault();
    const p = dragXY(ev);
    const k = 0.33 * (1 - state.proj * 0.4);
    state.rotation = [
      rotStart[0] + (p[0] - dragStart[0]) * k,
      Math.max(-85, Math.min(85, rotStart[1] - (p[1] - dragStart[1]) * k)),
      rotStart[2],
    ];
    render();
  }, { passive: false });

  d3.select(window).on('mouseup.drag touchend.drag', (ev) => {
    // End the pinch once fewer than 2 fingers remain; end the drag once all
    // fingers are up (mouseup has no .touches, so both clear).
    if (!ev.touches || ev.touches.length < 2) pinchStart = null;
    if (!ev.touches || ev.touches.length === 0) dragStart = null;
  });

  // ── wheel zoom ──
  svg.on('wheel.zoom', (ev) => {
    ev.preventDefault();
    setZoom(state.zoom * Math.exp(-ev.deltaY * 0.0015), false);
  }, { passive: false });

  function setZoom(z, animate) {
    const target = Math.max(state.zoomMin, Math.min(state.zoomMax, z));
    if (!animate) { state.zoom = target; sizeForViewport(); render(); opts.onZoomChange?.(state.zoom); return; }
    animateValue(state.zoom, target, 240, (v) => { state.zoom = v; sizeForViewport(); render(); }, () => opts.onZoomChange?.(state.zoom));
  }

  // ── projection morph (the 2D↔3D toggle) ──
  function setProjection(flat, animate = true) {
    const target = flat ? 1 : 0;
    if (!animate) { state.proj = target; sizeForViewport(); render(); opts.onProjectionChange?.(target); return; }
    const wasAuto = state.autoRotate;
    state.autoRotate = false;
    animateValue(state.proj, target, 900, (v) => {
      state.proj = v;
      // ease the tilt toward 0 as we flatten so the map sits upright
      if (target === 1) state.rotation[1] = state.rotation[1] * (1 - v) + 0 * v;
      sizeForViewport(); render();
    }, () => { state.autoRotate = wasAuto && target === 0; opts.onProjectionChange?.(target); });
  }

  function spinTo(targetRot, duration = 800) {
    const start = state.rotation.slice();
    state.autoRotate = false;
    animateValue(0, 1, duration, (e) => {
      state.rotation = start.map((s, i) => s + (targetRot[i] - s) * e);
      render();
    });
  }

  // Centre on a country AND zoom to its size, so small island states (Malta,
  // Singapore, Mauritius…) become visible instead of a sub-pixel dot. Works in
  // globe and flat modes (rotate centres either). Zoom scales inversely with the
  // country's angular extent: tiny → near max zoom, large → modest.
  function focusOn(iso3, duration = 800) {
    const f = state.countries && state.countries.find((c) => c.__iso3 === iso3);
    const c = state.centroids[iso3] || (f ? d3.geoCentroid(f) : null);
    if (!c) return;
    spinTo([-c[0], -c[1], 0], duration);
    let span = 60;
    if (f) {
      try {
        const b = d3.geoBounds(f);   // [[w,s],[e,n]]
        span = Math.max(Math.abs(b[1][0] - b[0][0]), Math.abs(b[1][1] - b[0][1]), 0.4);
      } catch (e) {}
    }
    const target = Math.max(state.zoomMin, Math.min(state.zoomMax, 100 / Math.max(span, 10)));
    setZoom(target, true);
  }

  // shared eased animator (easeInOutCubic)
  function animateValue(from, to, dur, onStep, onDone) {
    let startT = null;
    function step(now) {
      if (startT == null) startT = now;
      const t = Math.min(1, (now - startT) / dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      onStep(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(step); else onDone?.();
    }
    requestAnimationFrame(step);
  }

  // ── auto-rotate loop ──
  let rafId = null, lastT = performance.now();
  function tick(now) {
    const dt = now - lastT; lastT = now;
    if (state.autoRotate && !dragStart && state.proj < 0.04) {
      state.rotation[0] = (state.rotation[0] + state.rotateSpeed * (dt / 16.67)) % 360;
      render();
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  const ro = new ResizeObserver(() => { sizeForViewport(); render(); });
  ro.observe(container);
  sizeForViewport();

  const api = {
    svg, overlay: overlayG, projection, path: pathGen,
    state,
    getCentroids() { return state.centroids; },
    setPaint(fn) { paintFn = fn; paintCountries(); },
    repaint: paintCountries,
    // overlay layers register here; fn runs after every base render
    onRender(fn) { renderHooks.add(fn); return () => renderHooks.delete(fn); },
    requestRender: render,
    setZoom, zoomIn: () => setZoom(state.zoom * 1.25, true), zoomOut: () => setZoom(state.zoom / 1.25, true),
    zoomReset: () => setZoom(1, true), getZoom: () => state.zoom,
    setProjection, getProjection: () => state.proj,
    toggleProjection: () => setProjection(state.proj < 0.5),
    setAutoRotate(v) { state.autoRotate = !!v; opts.onAutoRotateChange?.(state.autoRotate); },
    toggleAutoRotate() { state.autoRotate = !state.autoRotate; opts.onAutoRotateChange?.(state.autoRotate); return state.autoRotate; },
    setRotateSpeed(v) { state.rotateSpeed = v; },
    setGraticule(v) { state.showGraticule = !!v; render(); },
    setPinned(iso) { state.pinnedIso = iso; paintCountries(); },
    spinTo, focusOn,
    teardown() { cancelAnimationFrame(rafId); ro.disconnect(); svg.remove(); },
    _loadWorld: loadWorld,
  };
  return api;
}
