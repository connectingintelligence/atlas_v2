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
//   TEw    = Σ(w·tc) / (count of tc present)      (indicator sliders)
//   Rw     = weight-normalised mean of rf_*       (resilience sliders)
//   TEmaxW = max TEw over all scored countries UNDER THE CURRENT WEIGHTS
//   value  = clip( (TEw / TEmaxW × 95) × (1 − 0.20 × Rw/100), 0, 100 )
//
// IMPORTANT — why TEw divides by the COUNT of present clusters, not by Σw:
// a weight-NORMALISED mean (÷Σw) is scale-invariant — multiplying all sliders
// by any factor leaves TEw unchanged, and even relative shifts move it only a
// point or two, so the sliders felt like an on/off switch (only crossing 0 did
// anything visible). Dividing by the weight-INDEPENDENT count makes the sliders
// true multipliers: relative re-weighting now expresses the full spread between
// countries, and there is no discontinuity at w=0 (a cluster fades out smoothly
// rather than dropping out of the denominator).
//
// Rescaling by the SELECTION's own max (not the composite's) still makes any
// subset read on the full ramp: pick one cluster alone and the worst country
// goes deep red, because the per-country 1/count cancels in TEw/TEmaxW. With
// every slider at 100, TEw is the plain cluster mean and TEmaxW equals the
// pipeline's te_max, so the default CFCT surface is reproduced exactly
// (verified: painted fills match within ±1 RGB — qa_smoke check 2).
const weighting = { level: 'meta', all: { meta: {}, indicators: {}, resilience: {} } };

const wOf = (map, k) => (map && map[k] != null ? map[k] : 100);

// Weighted trauma mean under the current weights. Denominator = COUNT of
// present clusters (weight-independent), NOT Σw — see the header note: this is
// what gives the sliders real, smooth leverage instead of an on/off feel.
// Returns null only when NO trauma cluster carries any weight (→ country absent).
function traumaMean(d, tcKeys) {
  let num = 0, n = 0, any = false;
  for (const k of tcKeys) {
    const v = d[k];
    if (v == null || isNaN(v)) continue;
    n += 1;                                   // present clusters (independent of weight)
    const w = wOf(weighting.all.indicators, k) / 100;
    if (w > 0) { num += w * v; any = true; }
  }
  return (n > 0 && any) ? num / n : null;
}

// Weighted resilience mean — used when all trauma weight is 0, so the Custom
// surface maps pure (weighted) RESILIENCE (0–100, green). This divides by Σw
// (a true weighted MEAN), NOT by the cluster count like traumaMean: there is no
// live-max rescale to undo a 1/count shrink here, so weighting only "Democracy"
// must read as Democracy's own value (≈93, green), not value/14 (≈6, black).
// Picking a different subset of factors gives a different mean — that's the
// leverage. Null when no resilience factor carries any weight.
function resilienceMean(d, rfKeys) {
  let num = 0, den = 0;
  for (const k of rfKeys) {
    const v = d[k];
    if (v == null || isNaN(v)) continue;
    const w = wOf(weighting.all.resilience, k) / 100;
    if (w <= 0) continue;
    num += w * v; den += w;
  }
  return den > 0 ? num / den : null;
}

// True when every trauma weight is 0 but at least one resilience weight is up:
// the weighted surface becomes pure resilience (green) rather than a blank globe.
function weightedIsResilience(tcKeys, rfKeys) {
  const traumaZero = tcKeys.every((k) => wOf(weighting.all.indicators, k) <= 0);
  const anyResil = rfKeys.some((k) => wOf(weighting.all.resilience, k) > 0);
  return traumaZero && anyResil;
}

function weightedValue(d, tcKeys, rfKeys, teMaxW) {
  if (!d) return null;
  // the pipeline withholds a CTI below 5 covered indicators — honour that
  // here too, so thin-coverage countries stay "absent" under any weighting
  if (d.cti == null) return null;
  const TEw = traumaMean(d, tcKeys);
  if (TEw == null) {
    // No trauma weight anywhere → show the weighted RESILIENCE surface instead.
    // (Zeroing trauma + weighting only resilience now yields a pure resilience
    // map, which is what one intuitively expects.) Null if no resilience either.
    return resilienceMean(d, rfKeys);
  }
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

    // The active colour ramp: green for the pure-resilience surface AND for the
    // weighted surface once trauma is fully un-weighted (→ it maps resilience).
    function activeRamp() {
      const mode = ctx.getControl('mode') || 'cti';
      if (mode === 'resilience') return 'resilience';
      if (mode === 'weighted' && weightedIsResilience(tcKeys, rfKeys)) return 'resilience';
      return 'conditions';
    }
    function paint() {
      const mode = ctx.getControl('mode') || 'cti';
      const ramp = activeRamp();
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
        if (m === 'weighted') {
          return weightedIsResilience(tcKeys, rfKeys)
            ? 'Custom resilience (your weights)' : 'Custom CFCT (your weights)';
        }
        return MODE_LABEL[m] || 'Surface';
      },
      // 'resilience' | 'conditions' — the legend reads this to colour its key
      ramp() { return activeRamp(); },
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
        const mode = ctx.getControl('mode') || 'cti';
        const d = data[iso3];
        if (!d) return [];
        // Resilience surface: list the present resilience factors (highest first)
        // so the tooltip explains the green score; absent factors simply omitted
        // (the drawer's Resilience section shows them as "no data").
        // Pure resilience surface OR weighted-with-only-resilience: list the
        // weighted factors that are actually contributing (highest first).
        if (mode === 'resilience' || (mode === 'weighted' && weightedIsResilience(tcKeys, rfKeys))) {
          const useW = mode === 'weighted';
          return rfKeys
            .map((k) => {
              const v = d[k];
              if (v == null || isNaN(v)) return null;
              if (useW && wOf(weighting.all.resilience, k) <= 0) return null;
              return { label: labelFor(k), value: v };
            })
            .filter(Boolean)
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
        }
        if (mode !== 'weighted') return [];
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
