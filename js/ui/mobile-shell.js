// ─────────────────────────────────────────────────────────────
//  MOBILE SHELL — phone-only chrome (≤640px). Turns the layer rail
//  into a PEEK SHEET: an always-visible bottom strip that summarises
//  the active surface + entanglements, and expands to the full layer
//  list on tap (or drag up). Replaces the old floating "Layers" FAB.
//
//  Desktop/tablet are untouched: the wrapper is `display:contents`
//  there, so #layers behaves exactly as the original rail (the peek
//  header is display:none), and #chrome's opacity gates it during the
//  intro for free.
//
//  Because #layers is re-rendered via innerHTML by layer-panel.js, the
//  peek header lives in a SIBLING wrapper (#layers-sheet), never inside
//  #layers — so a re-render can't wipe it. The summary is kept in sync
//  through registry.onChange.
//
//  Public API (kept stable for app.js):  initMobileShell({ registry, globe })
// ─────────────────────────────────────────────────────────────

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  /* desktop / tablet: the wrapper is invisible — #layers acts as the rail it
     always was (positioned relative to #chrome), and the peek header is hidden. */
  #layers-sheet { display:contents; }
  #peek-head { display:none; }
  #sheet-scrim { display:none; }

  @media (max-width:640px) {
    /* the wrapper IS the sliding sheet; #layers becomes its scroll area */
    #layers-sheet {
      --peek-h:98px;
      display:flex; flex-direction:column;
      position:fixed; left:0; right:0; bottom:0; z-index:72;
      max-height:84dvh; background:var(--bg);
      border-radius:18px 18px 0 0; box-shadow:0 -8px 30px var(--shadow);
      transform:translateY(calc(100% - var(--peek-h)));
      transition:transform .38s cubic-bezier(.22,.8,.25,1);
      -webkit-tap-highlight-color:transparent;
    }
    #layers-sheet.expanded { transform:translateY(0); }

    /* always-visible peek header (grip + active surface + entanglement badges) */
    #peek-head { display:block; flex:none; cursor:pointer; padding:9px 18px 12px;
      border-bottom:1px solid transparent; transition:border-color .3s; }
    #layers-sheet.expanded #peek-head { border-bottom-color:var(--rule); }
    #peek-head .ph-grip { width:42px; height:5px; border-radius:3px; background:var(--rule); margin:0 auto 9px; }
    #peek-head .ph-row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    #peek-head .ph-lbl { font:600 10px/1 'JetBrains Mono',ui-monospace,monospace; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-faint); }
    #peek-head .ph-now { font-size:15px; margin-top:3px; color:var(--ink); }
    #peek-head .ph-chev { color:var(--ink-faint); font-size:18px; line-height:1; transition:transform .35s; }
    #layers-sheet.expanded #peek-head .ph-chev { transform:rotate(180deg); }
    #peek-head .ph-badges { display:flex; gap:6px; margin-top:9px; overflow:hidden; white-space:nowrap; }
    #peek-head .ph-badges .b { flex:none; font-size:11px; background:var(--chip-bg);
      border:1px solid var(--panel-border); border-radius:999px; padding:3px 10px; color:var(--ink-dim); }
    #peek-head .ph-badges .b.none { color:var(--ink-faint); font-style:italic; }

    /* #layers (moved inside the wrapper) → plain scroll area. Higher specificity
       (#layers-sheet #layers = 2-0-0) deliberately overrides layer-panel.js's own
       mobile rules (#layers / #layers.sheet-open = 1-0-0 / 1-1-0). */
    #layers-sheet #layers { position:static; transform:none; max-height:none; width:auto;
      min-height:0; flex:1; overflow-y:auto; border-radius:0; box-shadow:none; z-index:auto;
      background:transparent; backdrop-filter:none;
      padding:4px 16px calc(env(safe-area-inset-bottom) + 80px); }
    #layers-sheet #layers::before { display:none; }   /* peek-head owns the grip */

    /* dimming scrim behind the expanded sheet */
    #sheet-scrim { display:block; position:fixed; inset:0; z-index:69;
      background:rgba(0,0,0,.34); opacity:0; pointer-events:none;
      transition:opacity .3s var(--ease-soft, ease); }
    #sheet-scrim.show { opacity:1; pointer-events:auto; }
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

  // ── wrap #layers so the peek header is a sibling (survives re-render) ──
  const sheet = document.createElement('div');
  sheet.id = 'layers-sheet';
  layers.parentNode.insertBefore(sheet, layers);

  const head = document.createElement('div');
  head.id = 'peek-head';
  head.setAttribute('role', 'button');
  head.setAttribute('aria-controls', 'layers');
  head.setAttribute('aria-expanded', 'false');
  head.innerHTML = `
    <div class="ph-grip" aria-hidden="true"></div>
    <div class="ph-row">
      <div><div class="ph-lbl">Surface</div><div class="ph-now"><b id="ph-active">—</b></div></div>
      <span class="ph-chev" aria-hidden="true">⌃</span>
    </div>
    <div class="ph-badges" id="ph-badges"></div>`;
  sheet.appendChild(head);
  sheet.appendChild(layers);   // move the existing list into the wrapper

  // ── scrim ──
  // CRITICAL: the scrim MUST live inside #chrome (alongside #layers-sheet), NOT on
  // <body>. #chrome is position:fixed → it forms its own stacking context, so the
  // sheet's z-index (72) is only meaningful *within* #chrome. A body-level scrim at
  // z-69 paints above the entire #chrome unit (z-index:auto) and therefore above the
  // sheet — making the whole open menu grey and untappable. Putting the scrim in the
  // SAME stacking context as the sheet lets z-69 (scrim) sit correctly below z-72
  // (sheet). Verified with a hit-test: body-level → scrim covers rows; in #chrome →
  // rows are the topmost element.
  const scrim = document.createElement('div');
  scrim.id = 'sheet-scrim';
  scrim.setAttribute('aria-hidden', 'true');
  sheet.parentNode.insertBefore(scrim, sheet);   // into #chrome, before the sheet

  // ── expand / collapse ──
  let open = false;
  function expand()   { open = true;  sheet.classList.add('expanded');    scrim.classList.add('show');    head.setAttribute('aria-expanded', 'true'); }
  function collapse() { open = false; sheet.classList.remove('expanded'); scrim.classList.remove('show'); head.setAttribute('aria-expanded', 'false'); }
  function toggle()   { open ? collapse() : expand(); }

  scrim.addEventListener('click', collapse);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) collapse(); });

  // ── drag the header (up to expand / down to collapse); a near-zero move is a tap ──
  let dragging = false, startY = 0, base = 0, sheetH = 0, moved = 0;
  head.addEventListener('pointerdown', (e) => {
    if (!mq.matches) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true; startY = e.clientY; moved = 0;
    sheetH = sheet.offsetHeight;
    base = sheet.classList.contains('expanded') ? 0 : (sheetH - head.offsetHeight);
    sheet.style.transition = 'none';
    try { head.setPointerCapture(e.pointerId); } catch (_) {}
  });
  head.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    moved = e.clientY - startY;
    sheet.style.transform = `translateY(${Math.min(sheetH, Math.max(0, base + moved))}px)`;
    e.preventDefault();
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    try { head.releasePointerCapture(e.pointerId); } catch (_) {}
    sheet.style.transition = '';
    sheet.style.transform = '';      // hand control back to the .expanded class
    if (Math.abs(moved) < 6) { toggle(); return; }   // treat as a tap
    if (moved < -24) expand();
    else if (moved > 24) collapse();
    else (sheet.classList.contains('expanded') ? expand() : collapse());
  }
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);

  // ── keep the peek summary in sync with the registry ──
  const firstWord = (s) => (s || '').replace(/\s*[⚖].*/, '').split(' ')[0];
  function updatePeek(list) {
    const surface = list.find((l) => l.group === 'surface' && l.visible);
    const ents = list.filter((l) => l.group !== 'surface' && l.visible);
    const act = document.getElementById('ph-active');
    const badges = document.getElementById('ph-badges');
    if (act) act.textContent = surface ? surface.label : 'none';
    if (badges) {
      badges.innerHTML = ents.length
        ? ents.map((l) => `<span class="b">${firstWord(l.label)}</span>`).join('')
        : `<span class="b none">tap to add entanglements</span>`;
    }
  }
  if (registry?.onChange) registry.onChange(updatePeek);
  if (registry?.list) updatePeek(registry.list());

  // keep state coherent across the breakpoint
  const onMqChange = () => {
    setMobileFlag();
    if (!mq.matches && open) collapse();   // leaving mobile → tidy up
  };
  if (mq.addEventListener) mq.addEventListener('change', onMqChange);
  else if (mq.addListener) mq.addListener(onMqChange);   // older Safari
}
