// ─────────────────────────────────────────────────────────────
//  UNIFIED GLOBAL TIME SCRUBBER — one timeline that drives every
//  year-aware layer at once (Atlas v2).
//
//  Docks bottom-centre, just ABOVE the existing #bottom-hint, so it
//  doesn't collide with the hint (bottom:24px) or the bottom-right
//  #globe-controls (right:28px; bottom:24px). It is a slim bar:
//    [ ▶ ]  ──────●────────────────  2024
//  · range = the UNION of every registered layer's 'year' control range
//  · changing it (or each play tick) pushes the year into BOTH the
//    global registry (registry.setYear) AND every visible layer that
//    owns a 'year' control (registry.setControl(id,'year',y)).
//  · only shown when ≥1 *visible* layer is year-aware; otherwise hidden.
//  · re-evaluates on registry.onChange.
//  · respects prefers-reduced-motion (no auto-play motion when reduced;
//    manual scrubbing always works).
//
//  Self-contained: injects its own DOM + <style> using theme vars.
//  Public:  export function initTimeScrubber({ registry, globe })
//  app.js auto-discovers + calls it at startup.
// ─────────────────────────────────────────────────────────────

const STEP_MS = 400; // ~1 year per tick during playback

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  #time-scrubber {
    position: fixed; left: 50%; bottom: 58px; transform: translateX(-50%) translateY(8px);
    z-index: 62; display: none; align-items: center; gap: 14px;
    padding: 8px 16px 8px 8px; border-radius: 999px;
    background: var(--panel-bg, rgba(241,235,225,0.86));
    border: 1px solid var(--panel-border, rgba(26,22,18,0.10));
    backdrop-filter: blur(14px) saturate(1.1); -webkit-backdrop-filter: blur(14px) saturate(1.1);
    box-shadow: 0 10px 36px rgba(0,0,0,0.16);
    font-family: 'JetBrains Mono', monospace;
    opacity: 0; pointer-events: none;
    transition: opacity .28s ease, transform .28s cubic-bezier(.22,.8,.25,1);
    max-width: min(640px, 78vw); width: 480px;
  }
  #time-scrubber.show { display: flex; }
  #time-scrubber.visible { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
  @media (prefers-reduced-motion: reduce) { #time-scrubber { transition: opacity .28s ease; } }

  #time-scrubber .ts-play {
    flex: none; width: 34px; height: 34px; border-radius: 50%;
    border: 1px solid var(--rule, #cfc4b2); background: transparent;
    color: var(--ink-dim, #555049); cursor: pointer; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; transition: background .18s, color .18s, border-color .18s;
  }
  #time-scrubber .ts-play:hover { color: var(--ink, #1a1612); border-color: var(--ink-faint, #8a8278); }
  #time-scrubber .ts-play.playing { background: var(--accent, #b0522a); color: var(--accent-ink, #f1ebe1); border-color: var(--accent, #b0522a); }
  #time-scrubber .ts-play[disabled] { opacity: .4; cursor: default; }

  #time-scrubber .ts-range { flex: 1; min-width: 0; height: 4px; }
  #time-scrubber input[type=range] {
    width: 100%; accent-color: var(--accent, #b0522a);
    background: transparent; cursor: pointer;
  }

  #time-scrubber .ts-readout {
    flex: none; min-width: 56px; text-align: right;
    font-family: 'Source Serif 4', Georgia, serif; font-weight: 500;
    font-size: 22px; line-height: 1; color: var(--ink, #1a1612);
    font-variant-numeric: tabular-nums; letter-spacing: .01em;
  }
  #time-scrubber .ts-bounds {
    flex: none; display: flex; flex-direction: column; align-items: flex-start;
    font-size: 8.5px; letter-spacing: .08em; color: var(--ink-faint, #8a8278);
    line-height: 1.3;
  }
  #time-scrubber .ts-alltime {
    flex: none; padding: 5px 9px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--rule, #cfc4b2); background: transparent;
    color: var(--ink-dim, #555049); font-family: 'JetBrains Mono', monospace;
    font-size: 10px; letter-spacing: .1em; line-height: 1;
    transition: background .18s, color .18s, border-color .18s;
  }
  #time-scrubber .ts-alltime:hover { color: var(--ink, #1a1612); border-color: var(--ink-faint, #8a8278); }
  #time-scrubber .ts-alltime.active {
    background: var(--accent, #b0522a); color: var(--accent-ink, #f1ebe1); border-color: var(--accent, #b0522a);
  }
  /* when the time axis is off, fade the slider + bounds so it reads as inactive */
  #time-scrubber.alltime .ts-range, #time-scrubber.alltime .ts-bounds { opacity: .35; }

  /* ── phones: lift above the bottom layout contract (FAB / controls / theme
     all sit at bottom+16px); keep centred and inside the viewport ── */
  @media (max-width:640px){
    #time-scrubber {
      bottom: calc(env(safe-area-inset-bottom) + 80px);
      width: auto; max-width: 94vw; gap: 10px; padding: 7px 14px 7px 7px;
    }
    #time-scrubber .ts-bounds { display: none; } /* save width on narrow screens */
    #time-scrubber .ts-play { width: 40px; height: 40px; font-size: 15px; } /* tap target */
    #time-scrubber .ts-readout { font-size: 19px; min-width: 46px; }
    #time-scrubber .ts-alltime { padding: 9px 12px; }
    /* contracts badge rides just above the lifted scrubber (inline style → !important) */
    #time-contracts {
      bottom: calc(env(safe-area-inset-bottom) + 136px) !important;
      max-width: 94vw !important;
    }
  }`;
  const s = document.createElement('style');
  s.id = 'atlas-time-scrubber-css';
  s.textContent = css;
  document.head.appendChild(s);
}

export function initTimeScrubber({ registry, globe } = {}) {
  if (!registry) { console.warn('time-scrubber: no registry'); return; }
  injectStyles();

  const prefersReduced = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── DOM ──────────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.id = 'time-scrubber';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Global timeline');
  bar.innerHTML = `
    <button class="ts-play" type="button" aria-label="Play timeline" title="Play / pause timeline">▶</button>
    <span class="ts-bounds"><span class="ts-min"></span><span class="ts-max"></span></span>
    <span class="ts-range">
      <input type="range" min="0" max="1" step="1" value="1" aria-label="Year">
    </span>
    <span class="ts-readout" aria-live="polite">—</span>
    <button class="ts-alltime" type="button" aria-pressed="false" title="Show all years at once (turn the time axis off)">ALL</button>`;
  document.body.appendChild(bar);

  const playBtn = bar.querySelector('.ts-play');
  const slider = bar.querySelector('input[type=range]');
  const readout = bar.querySelector('.ts-readout');
  const minLabel = bar.querySelector('.ts-min');
  const maxLabel = bar.querySelector('.ts-max');
  const allBtn = bar.querySelector('.ts-alltime');

  // ── state ────────────────────────────────────────────────────
  let minYear = null;
  let maxYear = null;
  let yearAwareVisible = false;   // ≥1 visible layer with a 'year' control
  let timer = null;
  let allTimeOn = false;          // time axis off → every layer shows all years

  // A layer is "time-aware" if it declares a `temporal:{min,max}` extent OR a
  // 'year' control. Returns its [min,max] data-year range, or null.
  function rangeOf(e) {
    const t = e.temporal;
    if (t && typeof t.min === 'number' && typeof t.max === 'number') return [t.min, t.max];
    const yc = (e.controls || []).find((c) => c.id === 'year');
    if (yc && typeof yc.min === 'number' && typeof yc.max === 'number') return [yc.min, yc.max];
    return null;
  }

  // The axis domain is the union of the time-aware layers that are CURRENTLY
  // VISIBLE — so with one layer on, the slider spans exactly that layer's real
  // data years (e.g. Commodities → 2022–2024) instead of a fixed 1500–2024, and
  // any visible time-aware layer (incl. Historical Borders, which has no 'year'
  // slider) raises the scrubber on its own.
  function scan() {
    const entries = (typeof registry.list === 'function' ? registry.list() : []) || [];
    let lo = Infinity;
    let hi = -Infinity;
    let anyVisibleAware = false;
    for (const e of entries) {
      if (!e.visible) continue;
      const r = rangeOf(e);
      if (!r) continue;
      anyVisibleAware = true;
      lo = Math.min(lo, r[0]);
      hi = Math.max(hi, r[1]);
    }
    if (!anyVisibleAware || !isFinite(lo) || !isFinite(hi)) {
      return { lo: null, hi: null, visible: false };
    }
    return { lo, hi, visible: true };
  }

  function setSliderToYear(y) {
    if (minYear == null || maxYear == null) return;
    const clamped = Math.max(minYear, Math.min(maxYear, y));
    slider.value = String(clamped);
    readout.textContent = String(clamped);
  }

  // Push the year both globally and into every visible year-aware layer.
  function applyYear(y) {
    const yr = Math.round(y);
    readout.textContent = String(yr);
    try { registry.setYear(yr); } catch (err) { console.warn('time-scrubber setYear', err); }
    const entries = (typeof registry.list === 'function' ? registry.list() : []) || [];
    for (const e of entries) {
      if (!e.visible) continue;
      const hasYear = (e.controls || []).some((c) => c.id === 'year');
      if (!hasYear) continue;
      try { registry.setControl(e.id, 'year', yr); } catch (err) { console.warn('time-scrubber setControl', err); }
    }
  }

  // ── playback ─────────────────────────────────────────────────
  function stop() {
    if (timer != null) { clearInterval(timer); timer = null; }
    playBtn.classList.remove('playing');
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Play timeline');
  }

  function tick() {
    if (minYear == null || maxYear == null) { stop(); return; }
    let cur = Math.round(+slider.value);
    if (cur >= maxYear) {
      cur = minYear;          // loop back to the start
    } else {
      cur += 1;
    }
    setSliderToYear(cur);
    applyYear(cur);
  }

  function play() {
    if (prefersReduced) return;                 // no auto motion when reduced
    if (!yearAwareVisible || minYear == null) return;
    if (minYear === maxYear) return;            // nothing to animate
    if (timer != null) return;
    playBtn.classList.add('playing');
    playBtn.textContent = '❚❚';
    playBtn.setAttribute('aria-label', 'Pause timeline');
    timer = setInterval(tick, STEP_MS);
  }

  playBtn.addEventListener('click', () => {
    if (timer != null) stop(); else play();
  });

  // ── all-time off-switch ──────────────────────────────────────
  function setAllTime(on) {
    allTimeOn = !!on;
    if (allTimeOn) stop();
    bar.classList.toggle('alltime', allTimeOn);
    allBtn.classList.toggle('active', allTimeOn);
    allBtn.setAttribute('aria-pressed', allTimeOn ? 'true' : 'false');
    slider.disabled = allTimeOn;
    playBtn.disabled = allTimeOn || prefersReduced || (minYear === maxYear);
    readout.textContent = allTimeOn ? 'ALL' : String(Math.round(+slider.value));
    try { registry.setAllTime(allTimeOn); } catch (err) { console.warn('time-scrubber setAllTime', err); }
    // leaving all-time: re-assert the slider's year onto the layers
    if (!allTimeOn) applyYear(+slider.value);
  }
  allBtn.addEventListener('click', () => setAllTime(!allTimeOn));

  slider.addEventListener('input', () => {
    if (allTimeOn) setAllTime(false);   // scrubbing re-engages the time axis
    // manual scrubbing pauses any running playback
    if (timer != null) stop();
    applyYear(+slider.value);
  });

  // ── show / hide + range refresh ──────────────────────────────
  function refresh() {
    const { lo, hi, visible } = scan();
    yearAwareVisible = visible;

    if (lo == null) {
      // no year-aware layers registered at all
      hide();
      minYear = maxYear = null;
      return;
    }

    const prevYear = (minYear != null) ? Math.round(+slider.value) : null;
    const rangeChanged = (lo !== minYear || hi !== maxYear);
    minYear = lo;
    maxYear = hi;
    slider.min = String(lo);
    slider.max = String(hi);
    minLabel.textContent = String(lo);
    maxLabel.textContent = String(hi);

    if (rangeChanged || prevYear == null) {
      // default the position to the registry's current year if it's in range,
      // otherwise to the max year.
      let target = maxYear;
      const regYear = (typeof registry.year === 'number') ? registry.year : null;
      if (regYear != null && regYear >= minYear && regYear <= maxYear) target = regYear;
      else if (prevYear != null && prevYear >= minYear && prevYear <= maxYear) target = prevYear;
      setSliderToYear(target);
    } else {
      setSliderToYear(prevYear);
    }

    const playable = !prefersReduced && (minYear !== maxYear) && !allTimeOn;
    playBtn.disabled = !playable;
    slider.disabled = allTimeOn;
    if (allTimeOn) readout.textContent = 'ALL';

    if (visible) show(); else hide();
  }

  function show() {
    bar.classList.add('show');
    // next frame so the opacity/transform transition runs
    requestAnimationFrame(() => bar.classList.add('visible'));
  }
  function hide() {
    stop();
    bar.classList.remove('visible');
    bar.classList.remove('show');
  }

  // ── temporal contracts: the one slider means something different per
  // layer (yearly series / single-vintage snapshot / span / cumulative /
  // timeless). Saying so under the scrubber turns silent year-snapping
  // into visible information instead of a quiet lie.
  const CONTRACTS = {
    'entanglement-migration': (y) => `Refugees ${y}`,
    'entanglement-economic': () => 'Remit 2021 (only year) · Aid yearly',
    'entanglement-commodities': (y) => `Commodities ${y === 'ALL' ? 'peak 22–24' : Math.min(2024, Math.max(2022, y))}`,
    'entanglement-colonies': () => 'Colonies: spans',
    'entanglement-overseas': () => 'Overseas territories: today',
    'entanglement-genocide': (y) => `Genocide ≤ ${y}`,
    'entanglement-slavetrade': () => 'Slave voyages 1514–1866',
    'indigenous-territories': () => 'Territories: today',
    'historical-borders': (y) => `Borders: era ≤ ${y}`,
  };
  const contracts = document.createElement('div');
  contracts.id = 'time-contracts';
  contracts.style.cssText = `position:fixed; left:50%; bottom:84px; transform:translateX(-50%);
    z-index:53; max-width:80vw; text-align:center; pointer-events:none;
    font-family:'JetBrains Mono',monospace; font-size:8.5px; letter-spacing:.06em;
    color:var(--ink-faint); opacity:0; transition:opacity .3s ease;`;
  document.body.appendChild(contracts);
  function syncContracts() {
    const y = allTimeOn ? 'ALL' : Math.round(registry.year ?? +slider.value);
    const parts = registry.list()
      .filter((e) => e.visible && CONTRACTS[e.id])
      .map((e) => CONTRACTS[e.id](y));
    contracts.textContent = parts.join('  ·  ');
    contracts.style.opacity = parts.length ? 1 : 0;
  }

  // react to layers registering / visibility / control changes
  if (typeof registry.onChange === 'function') registry.onChange(() => { refresh(); syncContracts(); });
  if (typeof registry.onYearChange === 'function') registry.onYearChange(() => syncContracts());

  // keep the readout/slider honest if some other UI drives the year
  if (typeof registry.onYearChange === 'function') {
    registry.onYearChange((y) => {
      if (minYear == null || maxYear == null) return;
      const yr = Math.round(y);
      if (yr < minYear || yr > maxYear) return;
      if (Math.round(+slider.value) === yr) return;
      setSliderToYear(yr);
    });
  }

  // initial pass (layers may already be registered)
  refresh();

  // small integration handle (parity with country-drawer)
  window.atlasTimeScrubber = {
    refresh,
    setYear: (y) => { if (allTimeOn) setAllTime(false); setSliderToYear(y); applyYear(y); },
    setAllTime,
    play, stop,
    get allTime() { return allTimeOn; },
    get range() { return [minYear, maxYear]; },
  };
}

export default { initTimeScrubber };
