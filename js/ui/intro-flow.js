// ─────────────────────────────────────────────────────────────
//  INTRO FLOW — 3-screen onboarding, ported from atlas/js/app.js.
//  Drives #intro markup: .intro-screen[data-screen], [data-next],
//  [data-skip], [data-enter], .intro-progress .dot.
//  PHASE-1 hand-off — Agent G refines copy + transitions.
// ─────────────────────────────────────────────────────────────

const REDUCED = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false };

export function initIntro({ onEnter } = {}) {
  const intro = document.getElementById('intro');
  const chrome = document.getElementById('chrome');
  if (!intro) { onEnter?.(); return; }

  const screens = [...intro.querySelectorAll('.intro-screen')];
  const dots = [...intro.querySelectorAll('.intro-progress .dot')];
  let i = 0;
  let entered = false;

  // Search, feedback pill, legend, surface ramp and the weighting button mount
  // to <body> (not #chrome), so they'd show through the intro. Hide them while
  // the intro is up; enter() removes this and they fade in with the chrome.
  document.body.classList.add('intro-active');

  function show(n) {
    i = Math.max(0, Math.min(screens.length - 1, n));
    // re-trigger the active screen's staggered child reveal each visit
    screens.forEach((s, k) => {
      const wasActive = s.classList.contains('active');
      s.classList.toggle('active', k === i);
      if (k === i && !wasActive) { void s.offsetWidth; } // reflow → restart anim
    });
    dots.forEach((d, k) => d.classList.toggle('active', k === i));
    intro.classList.toggle('fading', i > 0);
  }

  function enter() {
    if (entered) return;
    entered = true;
    document.body.classList.remove('intro-active');
    // smoother handoff: fade the whole intro out, then remove from the layout.
    // CSS handles the cross-fade; chrome reveals concurrently for continuity.
    chrome?.classList.add('visible');
    const finish = () => { intro.classList.add('hidden'); intro.classList.remove('leaving'); };
    if (REDUCED.matches) { finish(); }
    else {
      intro.classList.add('leaving');
      window.setTimeout(finish, 720); // matches #intro opacity transition (.7s)
    }
    onEnter?.();
  }

  intro.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', () => show(i + 1)));
  intro.querySelectorAll('[data-skip], [data-enter]').forEach((b) => b.addEventListener('click', enter));
  dots.forEach((d, k) => d.addEventListener('click', () => show(k)));

  // keyboard affordance: → / Enter advances, Esc skips straight in
  window.addEventListener('keydown', (ev) => {
    if (intro.classList.contains('hidden')) return;
    if (ev.key === 'ArrowRight' || ev.key === 'Enter') { i < screens.length - 1 ? show(i + 1) : enter(); }
    else if (ev.key === 'ArrowLeft') { show(i - 1); }
    else if (ev.key === 'Escape') { enter(); }
  });

  show(0);
  return { enter, show };
}
