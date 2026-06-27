// ─────────────────────────────────────────────────────────────
//  THEME — palette switching + JS-side colour scales
//  The CSS custom properties live in index.html (:root + [data-theme]).
//  This module flips the active theme and exposes the choropleth ramps
//  used by canvas/SVG fills that can't read CSS variables directly.
// ─────────────────────────────────────────────────────────────

// Side-effect import: boots motion (tokens, theme switcher, lifecycle motion).
// theme.js is in app.js's import graph, so this guarantees motion runs without
// app.js needing a new <script> or import. motion.js imports back from here —
// the cycle is safe (motion only *calls* these exports at runtime, not at
// module top level), and ES modules resolve it via live bindings.
import './motion.js';

export const THEMES = ['bone', 'forest', 'dusk'];
export const DEFAULT_THEME = 'bone';

const THEME_LABELS = { bone: 'Bone', forest: 'Forest', dusk: 'Dusk' };

// Choropleth ramps. Kept in JS (not CSS) because d3 fills interpolate numerically.
// Conditions = warm escalation; resilience = cool green. Lifted from atlas/js/globe.js
// and tuned so each palette stays legible on its own background.
const RAMPS = {
  // Warm escalation: a muted sand at the low end (reads alive on every
  // palette) climbing through amber to a deep terracotta. The low stop is
  // warmed from a cold grey so absent-vs-low countries don't fight visually.
  conditions: [
    [0.00, [171, 158, 134]],
    [0.25, [197, 159, 116]],
    [0.50, [216, 136, 74]],
    [0.75, [202, 96, 50]],
    [1.00, [162, 50, 32]],
  ],
  // Resilience: lush green (high) → dark grey/near-black (low). The low end is
  // deliberately dark so a fragile country (e.g. Afghanistan ~23) reads as
  // near-black, not a pale tint — "less resilience = darker, more depleted",
  // climbing through to a saturated, alive green at the top. (Absent countries
  // stay the light bone --country-absent, so dark-low ≠ no-data.)
  resilience: [
    [0.00, [24, 26, 24]],     // near-black — lowest resilience
    [0.22, [52, 58, 52]],     // dark grey (≈ Afghanistan 23)
    [0.42, [86, 104, 88]],    // dark grey-green
    [0.62, [104, 152, 112]],  // muted green
    [0.82, [82, 184, 110]],   // green
    [1.00, [64, 198, 96]],    // lush green — highest resilience
  ],
};

function interp(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      const f = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      const c = stops[i][1].map((c0, j) => Math.round(c0 + f * (stops[i + 1][1][j] - c0)));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return `rgb(${stops[stops.length - 1][1].join(',')})`;
}

// value: 0..100, ramp: 'conditions' | 'resilience'
export function colorFor(value, ramp = 'conditions') {
  if (value == null || isNaN(value)) return null;
  const t = Math.max(0, Math.min(100, value)) / 100;
  return interp(RAMPS[ramp] || RAMPS.conditions, t);
}

// CSS gradient string for legends, e.g. legendGradient('conditions')
export function legendGradient(ramp = 'conditions') {
  const stops = RAMPS[ramp] || RAMPS.conditions;
  const parts = stops.map(([t, c]) => `rgb(${c.join(',')}) ${(t * 100).toFixed(0)}%`);
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}

let current = DEFAULT_THEME;
const listeners = new Set();

export function getTheme() { return current; }
export function themeLabel(name = current) { return THEME_LABELS[name] || name; }

export function applyTheme(name) {
  if (!THEMES.includes(name)) name = DEFAULT_THEME;
  current = name;
  document.body.setAttribute('data-theme', name);
  listeners.forEach((fn) => { try { fn(name); } catch (e) { console.warn('theme listener failed', e); } });
}

// Subscribe to theme changes; returns an unsubscribe fn.
export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Read a resolved CSS custom property (so JS code can match the active palette).
export function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}
