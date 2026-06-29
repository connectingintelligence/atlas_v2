// ─────────────────────────────────────────────────────────────
//  MOBILE SHELL — phone-only chrome (≤640px). Turns the layer rail
//  into a bottom sheet reachable via a floating "Layers" FAB, with a
//  dimming scrim and drag-to-dismiss. Desktop is untouched: the FAB +
//  scrim are display:none above 640px, and we only ever ADD a class
//  (.sheet-open) the panel's own mobile CSS already styles.
//
//  Public API (kept stable for app.js):  initMobileShell({ registry, globe })
// ─────────────────────────────────────────────────────────────

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  /* FAB + scrim are mobile-only; hidden entirely above the phone breakpoint. */
  #layers-fab, #sheet-scrim { display:none; }

  /* …and kept hidden during the intro: intro-flow toggles body.intro-active,
     and these (appended to <body>, not #chrome) would otherwise float over the
     intro at z-72. Higher specificity than the media-query rules → always wins. */
  body.intro-active #layers-fab, body.intro-active #sheet-scrim { display:none; }

  @media (max-width:640px) {
    /* dimming scrim behind the sheet */
    #sheet-scrim { display:block; position:fixed; inset:0; z-index:69;
      background:rgba(0,0,0,.34); opacity:0; pointer-events:none;
      transition:opacity .3s var(--ease-soft, ease); }
    #sheet-scrim.show { opacity:1; pointer-events:auto; }

    /* floating "Layers" button — bottom-centre per the layout contract */
    #layers-fab { display:inline-flex; align-items:center; gap:8px;
      position:fixed; left:50%; transform:translateX(-50%);
      bottom:calc(env(safe-area-inset-bottom) + 16px); z-index:72;
      min-height:48px; padding:0 20px; border-radius:999px; cursor:pointer;
      background:var(--panel-bg); border:1px solid var(--panel-border);
      backdrop-filter:blur(14px) saturate(1.1); color:var(--ink);
      box-shadow:0 4px 18px var(--shadow); font-family:'Inter',system-ui,sans-serif;
      font-size:13px; letter-spacing:.02em; -webkit-tap-highlight-color:transparent;
      transition:transform var(--m-fast, .18s) var(--ease-out, ease); }
    #layers-fab:active { transform:translateX(-50%) scale(.95); }
    #layers-fab .fab-glyph { font-size:15px; line-height:1; }
    /* z:72 keeps the FAB above the open sheet (z:71) so it can toggle it closed */
  }
  `;
  const style = document.createElement('style');
  style.id = 'atlas-mobile-shell-css';
  style.textContent = css;
  document.head.appendChild(style);
}

export function initMobileShell({ registry, globe } = {}) {
  const layers = document.querySelector('#layers');
  if (!layers) return;   // defensive: nothing to control → no-op

  injectStyles();

  const mq = window.matchMedia('(max-width:640px)');
  const setMobileFlag = () => document.body.classList.toggle('is-mobile', mq.matches);
  setMobileFlag();

  // ── FAB ──────────────────────────────────────────────────────
  const fab = document.createElement('button');
  fab.id = 'layers-fab';
  fab.type = 'button';
  fab.setAttribute('aria-controls', 'layers');
  fab.setAttribute('aria-expanded', 'false');
  fab.innerHTML = '<span class="fab-glyph" aria-hidden="true">☰</span><span>Layers</span>';
  document.body.appendChild(fab);

  // ── scrim ────────────────────────────────────────────────────
  const scrim = document.createElement('div');
  scrim.id = 'sheet-scrim';
  scrim.setAttribute('aria-hidden', 'true');
  document.body.appendChild(scrim);

  let open = false;

  // The open/closed position is driven by an INLINE transform, not just the
  // .sheet-open CSS class. On-device the class rule (#layers.sheet-open{
  // translateY(0)}) was being out-cascaded by the base #layers{translateY(101%)}
  // rule, so the "open" sheet stayed parked off-screen at 101% and the scrim sat
  // on top of it — every tap hit the scrim and nothing in the sheet was
  // reachable. An inline style beats any stylesheet rule, so we set the position
  // directly here. The .34s CSS transition on transform still animates it.
  function openSheet() {
    open = true;
    layers.style.transition = '';       // restore CSS-driven snap
    layers.style.transform = 'translateY(0)';   // inline → always wins the cascade
    layers.classList.add('sheet-open');
    scrim.classList.add('show');
    fab.setAttribute('aria-expanded', 'true');
  }

  function closeSheet() {
    open = false;
    layers.style.transition = '';
    // Clear the inline transform: the CLOSED position is correct from CSS on
    // both phone (#layers base → translateY(101%)) and desktop (the rail →
    // translateY(-50%)). Only the OPEN state needs the inline override above, so
    // clearing here keeps the desktop rail intact if the viewport is resized
    // from phone→desktop while the sheet is open (onMqChange calls closeSheet).
    layers.style.transform = '';
    layers.classList.remove('sheet-open');
    scrim.classList.remove('show');
    fab.setAttribute('aria-expanded', 'false');
  }

  fab.addEventListener('click', () => { open ? closeSheet() : openSheet(); });
  scrim.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) closeSheet(); });

  // ── drag-to-dismiss (Pointer Events) ─────────────────────────
  // Only initiate from the top grip zone so the panel's internal scroll is
  // never hijacked. translateY follows the finger downward (clamped ≥0); on
  // release, close past ~90px or on a downward fling, else snap back open.
  const GRIP_ZONE = 28;     // px from the sheet's top edge
  const DISMISS_PX = 90;
  const FLING_PX = 8;       // per-move downward delta that counts as a fling
  let dragging = false;
  let startY = 0;
  let lastY = 0;
  let lastDelta = 0;

  layers.addEventListener('pointerdown', (e) => {
    if (!open || !mq.matches) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = layers.getBoundingClientRect();
    if (e.clientY - rect.top > GRIP_ZONE) return;   // not in the grip → let scroll/clicks be
    dragging = true;
    startY = lastY = e.clientY;
    lastDelta = 0;
    layers.style.transition = 'none';   // 1:1 with the finger
    try { layers.setPointerCapture(e.pointerId); } catch (_) {}
  });

  layers.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = Math.max(0, e.clientY - startY);   // downward only
    lastDelta = e.clientY - lastY;
    lastY = e.clientY;
    layers.style.transform = `translateY(${dy}px)`;
    e.preventDefault();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    try { layers.releasePointerCapture(e.pointerId); } catch (_) {}
    layers.style.transition = '';   // re-enable the snap animation
    const dy = Math.max(0, (e.clientY || lastY) - startY);
    if (dy > DISMISS_PX || lastDelta > FLING_PX) closeSheet();
    else openSheet();   // snap back (clears the inline transform)
  }
  layers.addEventListener('pointerup', endDrag);
  layers.addEventListener('pointercancel', endDrag);

  // keep state coherent across the breakpoint
  const onMqChange = () => {
    setMobileFlag();
    if (!mq.matches && open) closeSheet();   // leaving mobile → tidy up
  };
  if (mq.addEventListener) mq.addEventListener('change', onMqChange);
  else if (mq.addListener) mq.addListener(onMqChange);   // older Safari
}
