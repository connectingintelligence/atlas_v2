// ─────────────────────────────────────────────────────────────
//  LAYER: cfct-composite — the surface choropleth
//  Consumes the live v1 pipeline output (data/cti_scores.json) and
//  paints the globe by the selected metric. This is the reference
//  implementation that proves the registry works on real data.
//
//  NOTE on schema: meta-clusters in cti_scores.json are UNPREFIXED
//  (e.g. "genocide_and_mass_atrocities"), trauma clusters are "tc_*",
//  resilience factors "rf_*". Confirmed against the live file 2026-06.
// ─────────────────────────────────────────────────────────────

const META_CLUSTERS = [
  ['direct_violence', 'Direct Violence'],
  ['structural_violence', 'Structural Violence'],
  ['identity-based_oppression', 'Identity-Based Oppression'],
  ['interpersonal_violence_and_health', 'Interpersonal Violence & Health'],
  ['displacement_and_environment', 'Displacement & Environment'],
  ['wars_and_perpetration', 'Wars & Perpetration'],
  ['genocide_and_mass_atrocities', 'Genocide & Mass Atrocities'],
  ['famines_and_disasters', 'Famines & Disasters'],
];

const MODE_OPTIONS = [
  { value: 'cti', label: 'CFCT composite' },
  { value: 'weighted', label: 'Custom weighting ⚖' },
  { value: 'te', label: 'Trauma exposure' },
  { value: 'resilience', label: 'Resilience' },
  { value: 'coverage', label: 'Data coverage' },
  ...META_CLUSTERS.map(([k, l]) => ({ value: 'mc:' + k, label: l })),
];

const META_KEYS = META_CLUSTERS.map(([k]) => k);
const META_LABEL = Object.fromEntries(META_CLUSTERS);
const MODE_LABEL = { cti: 'CFCT composite', weighted: 'Custom weighting', te: 'Trauma exposure', resilience: 'Resilience', coverage: 'Data coverage' };
// Human label for a component key (meta slug, tc_*, rf_*).
function labelFor(key) {
  if (META_LABEL[key]) return META_LABEL[key];
  return key.replace(/^(tc_|rf_)/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Custom-weighting state, driven live by the weighting panel via the
// 'atlas:weights' event. ONE FLAT weight vector over the 28 trauma
// indicators (the panel's meta sliders are just group handles that write
// through to their members) plus the 14 resilience sliders. The weighted
// surface is a faithful CLIENT-SIDE CFCT RECOMPUTATION mirroring
// pipeline/compute_cti.py, with one deliberate generalisation:
//
//   TEw    = weight-normalised mean of tc_*       (indicator sliders)
//   Rw     = weight-normalised mean of rf_*       (resilience sliders)
//   TEmaxW = max TEw over all scored countries UNDER THE CURRENT WEIGHTS
//   value  = clip( (TEw / TEmaxW × 95) × (1 − 0.20 × Rw/100), 0, 100 )
//
// Rescaling by the SELECTION's own max (not the composite's) makes any
// subset read on the full ramp: pick "political terror" alone and the
// worst country (Afghanistan, 98.97) goes deep red at ~95×dampener,
// instead of clipping half the world at 100. With every slider at 100,
// TEmaxW equals the pipeline's te_max, so the default CFCT surface is
// reproduced exactly (verified: painted fills match within ±1 RGB).
const weighting = { level: 'meta', all: { meta: {}, indicators: {}, resilience: {} } };

const wOf = (map, k) => (map && map[k] != null ? map[k] : 100);

// weight-normalised trauma mean for one country under the current weights
function traumaMean(d, tcKeys) {
  let num = 0, den = 0;
  for (const k of tcKeys) {
    const v = d[k];
    if (v == null || isNaN(v)) continue;
    const w = wOf(weighting.all.indicators, k) / 100;
    if (w <= 0) continue;
    num += w * v; den += w;
  }
  return den > 0 ? num / den : null;
}

function weightedValue(d, tcKeys, rfKeys, teMaxW) {
  if (!d) return null;
  // the pipeline withholds a CTI below 5 covered indicators — honour that
  // here too, so thin-coverage countries stay "absent" under any weighting
  if (d.cti == null) return null;
  const TEw = traumaMean(d, tcKeys);
  if (TEw == null) return null;              // every trauma weight at 0
  let rnum = 0, rden = 0;
  for (const k of rfKeys) {
    const v = d[k];
    if (v == null || isNaN(v)) continue;
    const w = wOf(weighting.all.resilience, k) / 100;
    if (w <= 0) continue;
    rnum += w * v; rden += w;
  }
  const Rw = rden > 0 ? rnum / rden : 0;     // nothing picked → no dampening
  const val = (TEw / (teMaxW || 1)) * 95 * (1 - 0.20 * Rw / 100);
  return Math.max(0, Math.min(100, val));
}

function valueFor(d, mode, teMax, tcKeys, rfKeys, teMaxW) {
  if (!d) return null;
  if (mode === 'cti') return d.cti;
  if (mode === 'weighted') return weightedValue(d, tcKeys, rfKeys, teMaxW);
  if (mode === 'te') return d.te == null ? null : (d.te / (teMax || 1)) * 100;
  if (mode === 'resilience') return d.r;
  if (mode === 'coverage') return d.cov_pct;
  if (mode.startsWith('mc:')) { const v = d[mode.slice(3)]; return v == null ? null : v; }
  return null;
}

export default {
  id: 'cfct-composite',
  label: 'CFCT composite',
  group: 'surface',
  methodologyPath: 'methodology/cfct.md',
  dataPath: 'data/cti_scores.json',
  controls: [
    { id: 'mode', label: 'Surface', type: 'select', default: 'cti', options: MODE_OPTIONS },
  ],

  render(ctx) {
    const data = ctx.data || {};
    const teMax = (data._meta && data._meta.te_max) || 1;
    // keys actually present in the data (union across countries), per family
    const keysWith = (prefix) => [...new Set(
      Object.keys(data).filter((k) => k !== '_meta')
        .flatMap((iso) => Object.keys(data[iso]).filter((kk) => kk.startsWith(prefix)))
    )];
    const tcKeys = keysWith('tc_');
    const rfKeys = keysWith('rf_');

    // the selection's own stretch factor: max weighted trauma mean across
    // WELL-COVERED countries under the CURRENT weights (≈ te_max at all-100).
    // Must mirror pipeline compute_cti.robust_te_max: thin-coverage entities
    // (defunct V-Dem statelets etc.) have an extreme mean over a few clusters
    // and would otherwise blow up the stretch, so require >=20 of 28 trauma
    // clusters present — without this, the weighted-all-100 surface no longer
    // matches the default CFCT.
    const MIN_TC_FOR_MAX = 20;
    function computeTeMaxW() {
      let m = 0;
      for (const iso of Object.keys(data)) {
        if (iso === '_meta') continue;
        const d = data[iso];
        if (!d || d.cti == null) continue;
        const present = tcKeys.reduce((n, k) => n + (d[k] != null && !isNaN(d[k]) ? 1 : 0), 0);
        if (present < MIN_TC_FOR_MAX) continue;
        const t = traumaMean(d, tcKeys);
        if (t != null && t > m) m = t;
      }
      return m || 1;
    }
    let teMaxW = computeTeMaxW();

    function paint() {
      const mode = ctx.getControl('mode') || 'cti';
      // pure-resilience surface uses the green ramp; the weighted surface is
      // always a full CFCT recomputation → conditions ramp like the default
      const ramp = mode === 'resilience' ? 'resilience' : 'conditions';
      ctx.setPaint((iso3) => {
        const v = valueFor(data[iso3], mode, teMax, tcKeys, rfKeys, teMaxW);
        return ctx.colorFor(v, ramp);
      });
    }
    paint();

    // live re-weighting from the weighting panel (sends all tab maps)
    const onWeights = (e) => {
      const { level, all } = e.detail || {};
      if (level) weighting.level = level;
      if (all) weighting.all = all;
      teMaxW = computeTeMaxW();
      if ((ctx.getControl('mode') || 'cti') === 'weighted') paint();
    };
    document.addEventListener('atlas:weights', onWeights);

    // expose stats for the stat-rail (global mean / peak / coverage)
    const isos = Object.keys(data).filter((k) => k !== '_meta');
    const ctis = isos.map((k) => data[k].cti).filter((v) => v != null && !isNaN(v));
    const covered = isos.filter((k) => data[k].cti != null).length;
    const stats = {
      coverage: `${covered}/${isos.length}`,
      mean: ctis.length ? (ctis.reduce((a, b) => a + b, 0) / ctis.length).toFixed(1) : '—',
      peak: ctis.length ? Math.max(...ctis).toFixed(1) : '—',
    };
    document.dispatchEvent(new CustomEvent('atlas:stats', { detail: stats }));

    // Publish a live "current surface" accessor so the hover tooltip (app.js)
    // shows the value of whatever surface is selected — including the custom
    // weighting — instead of a fixed CFCT number, plus a breakdown of the
    // picked components for that country.
    const surface = {
      label() {
        const m = ctx.getControl('mode') || 'cti';
        if (m.startsWith('mc:')) return META_LABEL[m.slice(3)] || 'Meta-cluster';
        if (m === 'weighted') return 'Custom CFCT (your weights)';
        return MODE_LABEL[m] || 'Surface';
      },
      unit() { return (ctx.getControl('mode') || 'cti') === 'coverage' ? '% covered' : '/ 100'; },
      // surfaced in the hover tooltip so thin-coverage caveats are visible
      // at the moment of reading, not two clicks away in the drawer
      coverageNote(iso3) {
        const d = data[iso3];
        const total = (data._meta && data._meta.total_indicators) || 42;
        return d && d.cov != null ? `based on ${d.cov} of ${total} components` : null;
      },
      value(iso3) { return valueFor(data[iso3], ctx.getControl('mode') || 'cti', teMax, tcKeys, rfKeys, teMaxW); },
      // weighted mode: the recomputation's two terms + the heaviest trauma
      // contributors (weight × score), so the tooltip explains the number
      breakdown(iso3) {
        if ((ctx.getControl('mode') || 'cti') !== 'weighted') return [];
        const d = data[iso3];
        if (!d) return [];
        let rnum = 0, rden = 0;
        for (const k of rfKeys) {
          const v = d[k];
          if (v == null || isNaN(v)) continue;
          const w = wOf(weighting.all.resilience, k) / 100;
          if (w <= 0) continue;
          rnum += w * v; rden += w;
        }
        const comps = tcKeys
          .map((k) => {
            const v = d[k];
            if (v == null || isNaN(v)) return null;
            const w = wOf(weighting.all.indicators, k) / 100;
            return w > 0 ? { label: labelFor(k), value: v, contrib: w * v } : null;
          })
          .filter(Boolean)
          .sort((a, b) => b.contrib - a.contrib)
          .slice(0, 6)
          .map(({ label, value }) => ({ label, value }));
        const head = rden > 0 ? [{ label: 'Resilience (dampens ≤20%)', value: rnum / rden }] : [];
        return [...head, ...comps];
      },
    };
    window.atlas = window.atlas || {};
    window.atlas.surface = surface;

    return {
      update() { paint(); },
      destroy() {
        document.removeEventListener('atlas:weights', onWeights);
        if (window.atlas && window.atlas.surface === surface) window.atlas.surface = null;
        ctx.setPaint(null);
      },
    };
  },
};
