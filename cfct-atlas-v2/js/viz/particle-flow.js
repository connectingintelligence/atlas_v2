// ─────────────────────────────────────────────────────────────
//  PARTICLE FLOW — canvas overlay that streams dots along arcs.
//
//  Direction made visible: particles travel origin → destination along the
//  SAME geometry the SVG arcs use (flat mode: right-hand bow; globe mode:
//  great circle with horizon culling), so dots ride exactly on the drawn
//  lines in both projections. Count + size scale with flow volume.
//
//  A translucent fade pass each frame leaves short comet trails.
//  Pointer-events: none — purely decorative; tooltips/clicks pass through.
//
//  createParticleFlow(ctx, opts) -> { update(arcs, maxValue), setEnabled(on), destroy() }
//    arcs: [{ from|fromIso, to|toIso, value }] — already filtered by the layer
// ─────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;

export function createParticleFlow(ctx, opts = {}) {
  const wrap = document.querySelector('#globe-wrap') || document.body;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;';
  wrap.appendChild(canvas);
  const g = canvas.getContext('2d');
  const rgb = opts.rgb || '30,80,125';          // refugee teal-blue (default/fallback)
  // Optional per-arc colour: colorOf(arc) -> "r,g,b". Lets ONE canvas stream
  // many hues at once (e.g. the commodity layer's six groups) without a canvas
  // per colour — the fade trail is alpha-only, so mixed colours coexist fine.
  const colorOf = opts.colorOf || null;
  const maxParticlesPerArc = opts.maxPerArc ?? 14;
  const minParticlesPerArc = opts.minPerArc ?? 1; // floor — keeps thin corridors alive
  const speedScale = opts.speed ?? 1;           // <1 = slower (remittance drift)
  const sizeScale = opts.sizeScale ?? 1;        // >1 = bigger dots (presence boost)

  let dpr = 1;
  function resize() {
    const r = wrap.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, r.width * dpr);
    canvas.height = Math.max(1, r.height * dpr);
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(wrap);

  // corridors: [{ c0, c1, interp, mag, dots:[{t,speed,size}] }]
  let corridors = [];
  let sig = null;
  let enabled = true;
  let raf = 0;

  function update(arcs, maxValue) {
    const pinned = ctx.globe?.state?.pinnedIso || null;
    const s = (pinned || '') + '|' + arcs.length + '|' +
      arcs.map((a) => (a.fromIso || a.from) + (a.toIso || a.to) + (colorOf ? colorOf(a) : '')).join(',');
    if (s === sig) return;
    sig = s;
    const centroids = ctx.getCentroids ? ctx.getCentroids() : {};
    corridors = [];
    for (const a of arcs) {
      const f = a.fromIso || a.from, t = a.toIso || a.to;
      if (pinned && f !== pinned && t !== pinned) continue;
      const c0 = centroids[f], c1 = centroids[t];
      if (!c0 || !c1 || f === t) continue;
      const mag = Math.sqrt(Math.max(0, a.value || 1) / (maxValue || 1)); // 0..1
      const n = Math.max(minParticlesPerArc, Math.round(1 + mag * maxParticlesPerArc));
      const dots = [];
      for (let i = 0; i < n; i++) {
        dots.push({
          t: Math.random(),
          speed: (0.0016 + 0.0022 * Math.random()) * (0.6 + 0.7 * mag) * speedScale,
          size: (0.9 + mag * 2.3) * sizeScale,
        });
      }
      corridors.push({ c0, c1, interp: d3.geoInterpolate(c0, c1), mag, rgb: (colorOf ? colorOf(a) : rgb), dots });
    }
  }

  // visible-hemisphere test (globe mode)
  function visTest() {
    const proj = ctx.projection;
    const alpha = proj.alpha ? proj.alpha() : 0;
    if (alpha > 0.5) return () => true;
    const rot = proj.rotate();
    const l0 = -rot[0] * DEG, p0 = -rot[1] * DEG;
    return ([lon, lat]) => {
      const l = lon * DEG, p = lat * DEG;
      return (Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0)) > -0.02;
    };
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const w = canvas.width / dpr, h = canvas.height / dpr;
    if (!enabled || !corridors.length) { g.clearRect(0, 0, w, h); return; }
    // fade previous frame -> short comet trails on a transparent canvas
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';

    const proj = ctx.projection;
    const alpha = proj.alpha ? proj.alpha() : 0;
    const visible = visTest();

    for (const c of corridors) {
      const crgb = c.rgb || rgb;
      let p0 = null, p1 = null, dx = 0, dy = 0, px = 0, py = 0, k = 0, chord = 0;
      if (alpha > 0.5) {
        // flat: same right-hand bow as the SVG arcs
        p0 = proj(c.c0); p1 = proj(c.c1);
        if (!p0 || !p1 || !isFinite(p0[0]) || !isFinite(p1[0])) continue;
        dx = p1[0] - p0[0]; dy = p1[1] - p0[1];
        chord = Math.hypot(dx, dy) || 1;
        if (Math.abs(dx) >= w / 2) { p0 = null; } // wrap pair → geodesic fallback
        else { px = dy / chord; py = -dx / chord; k = Math.min(chord * 0.18, 60) * (1 + 0.3 * c.mag); }
      }
      for (const d of c.dots) {
        d.t += d.speed;
        if (d.t >= 1) d.t -= 1;
        let x, y;
        if (p0) {
          const b = Math.sin(d.t * Math.PI);
          x = p0[0] + dx * d.t + px * k * b;
          y = p0[1] + dy * d.t + py * k * b;
        } else {
          const ll = c.interp(d.t);
          if (!visible(ll)) continue;
          const p = proj(ll);
          if (!p || !isFinite(p[0])) continue;
          x = p[0]; y = p[1];
        }
        g.beginPath();
        g.arc(x, y, d.size, 0, 2 * Math.PI);
        g.fillStyle = `rgba(${crgb},${0.35 + 0.5 * d.t})`;   // per-arc hue; brighter toward arrival
        g.fill();
      }
    }
  }
  raf = requestAnimationFrame(frame);

  return {
    update,
    setEnabled(on) { enabled = !!on; },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.remove();
    },
  };
}
