// ─────────────────────────────────────────────────────────────
//  MOTION — centralised motion tokens + tasteful helpers.
//  The CSS counterparts live in index.html (:root --m-* / --ease-*).
//  Keep this module the single source of truth for JS-driven timing
//  so the feel stays coherent with the stylesheet.
//
//  Responsibilities:
//    • expose MOTION tokens (durations in ms + easing fns/strings)
//    • respect prefers-reduced-motion (helpers collapse to instant)
//    • inject the small palette switcher (wired through applyTheme)
//    • light-touch lifecycle motion: globe first-paint, surface-layer
//      fade, intro leave — all via shared CSS classes, never by
//      reaching into other modules' internals.
// ─────────────────────────────────────────────────────────────

import { THEMES, getTheme, themeLabel, applyTheme, onThemeChange } from './theme.js';

// ── reduced-motion ─────────────────────────────────────────────
const RM_QUERY = '(prefers-reduced-motion: reduce)';
const mq = window.matchMedia ? window.matchMedia(RM_QUERY) : { matches: false, addEventListener() {} };
export function prefersReducedMotion() { return !!mq.matches; }

// ── tokens (ms + easings) — mirror the CSS custom properties ───
export const MOTION = {
  duration: { fast: 180, base: 280, slow: 450, intro: 900, morph: 900 },
  // cubic-bezier control points, reusable as CSS strings or JS easings
  easing: {
    out: [0.22, 0.8, 0.25, 1],      // decel — entrances
    inOut: [0.65, 0, 0.35, 1],      // symmetric — morphs
    soft: [0.4, 0, 0.2, 1],         // gentle UI
  },
  css: {
    out: 'cubic-bezier(.22,.8,.25,1)',
    inOut: 'cubic-bezier(.65,0,.35,1)',
    soft: 'cubic-bezier(.4,0,.2,1)',
  },
};

// honour reduced-motion: every duration collapses to ~0
export function dur(name) { return prefersReducedMotion() ? 0 : ((MOTION.duration[name] ?? +name) || 0); }

// cubic-bezier easing fn factory (for rAF tweens that aren't CSS-driven)
function bezier([x1, y1, x2, y2]) {
  // Newton-Raphson solve for t given x, then sample y. Adequate for UI.
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const fx = (t) => ((ax * t + bx) * t + cx) * t;
  const fy = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    let t = x;
    for (let i = 0; i < 5; i++) { const e = fx(t) - x; const d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(d) < 1e-6) break; t -= e / d; }
    return fy(Math.max(0, Math.min(1, t)));
  };
}
export const ease = {
  out: bezier(MOTION.easing.out),
  inOut: bezier(MOTION.easing.inOut),
  soft: bezier(MOTION.easing.soft),
};

// ── helpers ────────────────────────────────────────────────────

// requestAnimationFrame tween, easing-aware + reduced-motion-aware.
// Returns a cancel fn. onStep(v 0..1-mapped) → onDone().
export function tween({ from = 0, to = 1, duration = MOTION.duration.base, easing = ease.out, onStep, onDone } = {}) {
  if (prefersReducedMotion() || duration <= 0) { onStep?.(to); onDone?.(); return () => {}; }
  let raf = null, start = null, cancelled = false;
  const fn = typeof easing === 'function' ? easing : ease.out;
  function frame(now) {
    if (cancelled) return;
    if (start == null) start = now;
    const t = Math.min(1, (now - start) / duration);
    onStep?.(from + (to - from) * fn(t));
    if (t < 1) raf = requestAnimationFrame(frame); else onDone?.();
  }
  raf = requestAnimationFrame(frame);
  return () => { cancelled = true; if (raf) cancelAnimationFrame(raf); };
}

// Briefly add a class to trigger a one-shot CSS animation, then remove it
// so it can re-fire next time (e.g. layer fade-in on toggle).
export function pulseClass(el, cls, ms = MOTION.duration.slow) {
  if (!el) return;
  el.classList.remove(cls);
  // force reflow so re-adding restarts the animation
  void el.offsetWidth;
  el.classList.add(cls);
  if (prefersReducedMotion()) { el.classList.remove(cls); return; }
  window.setTimeout(() => el.classList.remove(cls), ms + 60);
}

// ── theme switcher (injected; no markup added to index.html) ───
// DISABLED (client request 2026-06-27): the bone/forest/dusk colour dots are
// removed from both desktop and mobile. The app stays on DEFAULT_THEME (bone);
// theme.js keeps the palettes for possible future use, but no picker is shown.
function injectThemeSwitcher() {
  return;   // no-op: do not inject the colour-theme switcher
  /* eslint-disable no-unreachable */
  if (document.getElementById('theme-switcher')) return;
  const host = document.getElementById('chrome') || document.getElementById('stage') || document.body;
  const el = document.createElement('div');
  el.id = 'theme-switcher';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'Colour theme');
  el.innerHTML = THEMES.map((name) =>
    `<button type="button" class="ts-dot" data-theme-name="${name}" title="${themeLabel(name)}"
       aria-label="${themeLabel(name)} theme" aria-pressed="${name === getTheme()}"></button>`
  ).join('');
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('.ts-dot');
    if (btn) applyTheme(btn.dataset.themeName);
  });
  host.appendChild(el);

  const sync = (active) => el.querySelectorAll('.ts-dot').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.themeName === active)));
  sync(getTheme());
  onThemeChange(sync);
}

// ── lifecycle motion (shared CSS classes only) ─────────────────
function wireLifecycle() {
  const wrap = document.getElementById('globe-wrap');

  // Globe first-paint: reveal once the SVG exists.
  if (wrap) {
    const reveal = () => requestAnimationFrame(() => wrap.classList.add('globe-in'));
    if (wrap.querySelector('svg')) reveal();
    else {
      const obs = new MutationObserver(() => { if (wrap.querySelector('svg')) { reveal(); obs.disconnect(); } });
      obs.observe(wrap, { childList: true, subtree: true });
      // safety: reveal regardless after a beat
      window.setTimeout(reveal, 1500);
    }
  }

  // Surface-layer fade-in: a surface layer can dispatch atlas:layerpaint when
  // it (re)paints the choropleth; we cross-fade the country group via a class.
  // Harmless no-op until a layer opts in — keeps the contract one-directional.
  document.addEventListener('atlas:layerpaint', () => pulseClass(wrap, 'layer-fade-enter'));
}

let started = false;
export function initMotion() {
  if (started) return MOTION;
  started = true;
  // expose CSS-driven duration override for reduced motion at the JS edge too
  mq.addEventListener?.('change', () => { /* live-updates dur()/tween() automatically */ });
  const run = () => { injectThemeSwitcher(); wireLifecycle(); };
  // Always defer at least a microtask so the theme.js↔motion.js import cycle
  // is fully resolved before we touch theme exports (getTheme/THEMES).
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else Promise.resolve().then(run);
  return MOTION;
}

// Auto-init on import so app.js need not be touched (theme.js imports this).
initMotion();
