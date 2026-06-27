// ─────────────────────────────────────────────────────────────
//  LAYER PANEL (Regler) — one row per registered layer:
//    visibility toggle · declared controls · opacity · isolate · "i".
//  Surface layers group at top (mutually exclusive — registry enforces
//  the radio behaviour). Entanglement layers stack below (any combo on).
//
//  Auto-updates via registry.onChange so layers that register late
//  (migration / economic / colonies / genocide) appear automatically.
//
//  Public API (kept stable for app.js):  initLayerPanel(registry, mountEl)
// ─────────────────────────────────────────────────────────────

import { openMethodology } from './methodology-page.js';

// Per-layer opacity, kept here (not a registry concept). Applied to the
// layer's overlay <g data-layer="id"> so it works for surface + arc layers.
const opacity = new Map();   // id -> 0..1  (default 1)

function applyOpacity(id) {
  const o = opacity.has(id) ? opacity.get(id) : 1;
  // entanglement / surface overlay group
  document.querySelectorAll(`#globe-wrap [data-layer="${CSS.escape(id)}"]`)
    .forEach((g) => { g.style.opacity = o; });
}

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  /* ── Layer panel (Agent F, injected) ───────────────────────── */
  #layers { scrollbar-width:thin; scrollbar-color:var(--rule) transparent; }
  #layers::-webkit-scrollbar { width:6px; }
  #layers::-webkit-scrollbar-thumb { background:var(--rule); border-radius:3px; }
  #layers h3 { display:flex; align-items:center; gap:9px; }
  #layers h3::after { content:""; flex:1; height:1px; background:var(--rule); opacity:.6; }
  #layers .layer-empty { font-size:11.5px; color:var(--ink-faint); font-style:italic;
    padding:4px 8px; line-height:1.5; }

  .layer-row { border-left:2px solid transparent; padding:7px 8px; border-radius:2px;
    transition:background .2s, border-color .2s; }
  .layer-row.on { border-left-color:var(--accent); background:var(--chip-bg); }
  .layer-row.isolated { border-left-color:var(--accent); }
  .layer-row.isolated .layer-name::after {
    content:"solo"; margin-left:7px; font-family:'JetBrains Mono',monospace; font-size:8.5px;
    letter-spacing:.12em; text-transform:uppercase; color:var(--accent-ink);
    background:var(--accent); padding:1px 5px; border-radius:2px; vertical-align:middle; }

  .layer-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .layer-toggle { display:flex; align-items:center; gap:9px; cursor:pointer; font-size:13px;
    color:var(--ink-dim); flex:1; min-width:0; }
  .layer-toggle .layer-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .layer-row.on .layer-name { color:var(--ink); }
  .layer-toggle input { accent-color:var(--accent); flex:none; }

  .layer-actions { display:flex; align-items:center; gap:5px; flex:none; }
  .layer-btn { width:18px; height:18px; border-radius:50%; border:1px solid var(--rule);
    background:transparent; color:var(--ink-faint); cursor:pointer; display:inline-flex;
    align-items:center; justify-content:center; padding:0; line-height:1;
    transition:color .18s, border-color .18s, background .18s; }
  .layer-btn:hover { color:var(--ink); border-color:var(--ink-faint); }
  .layer-btn svg { width:11px; height:11px; display:block; }
  .layer-info { font-family:'Source Serif 4',serif; font-style:italic; font-size:11px; }
  .layer-iso.active { background:var(--accent); border-color:var(--accent); color:var(--accent-ink); }

  /* beta-gated layer */
  .beta-tag { font-family:'JetBrains Mono',monospace; font-size:8px; letter-spacing:.12em;
    text-transform:uppercase; color:var(--ink-faint); border:1px solid var(--rule);
    padding:1px 4px; border-radius:2px; vertical-align:middle; margin-left:2px; }
  .beta-trigger { cursor:pointer; }
  .beta-lock { display:inline-flex; width:14px; height:14px; color:var(--ink-faint); flex:none; }
  .beta-lock svg { width:13px; height:13px; }
  .beta-unlock { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin:8px 0 2px; }
  .beta-unlock input { flex:1; min-width:0; font-family:'JetBrains Mono',monospace; font-size:11px;
    padding:4px 7px; border:1px solid var(--panel-border); border-radius:3px;
    background:var(--chip-bg); color:var(--ink); }
  .beta-go { appearance:none; cursor:pointer; font-size:11px; padding:4px 11px; border-radius:3px;
    border:1px solid var(--accent); background:var(--accent); color:var(--accent-ink); }
  .beta-note { flex-basis:100%; font-size:8.5px; color:var(--ink-faint); }
  .beta-wrong .beta-unlock input { border-color:var(--accent); animation:betaShake .35s; }
  @keyframes betaShake { 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }

  .layer-controls { margin:9px 0 3px; display:flex; flex-direction:column; gap:10px;
    padding-left:1px; }
  .ctrl { display:flex; flex-direction:column; gap:5px; font-size:11.5px; color:var(--ink-dim); }
  .ctrl > span { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
  .ctrl .cval { font-family:'JetBrains Mono',monospace; color:var(--ink); font-style:normal;
    font-size:11px; }
  .ctrl select { width:100%; accent-color:var(--accent); font-family:inherit;
    background:var(--bg-2); color:var(--ink); border:1px solid var(--rule); border-radius:2px;
    padding:5px 6px; font-size:12px; cursor:pointer; }
  .ctrl input[type="range"] { width:100%; accent-color:var(--accent); cursor:pointer;
    -webkit-appearance:none; appearance:none; height:3px; border-radius:2px;
    background:var(--rule); margin:6px 0 2px; }
  .ctrl input[type="range"]::-webkit-slider-thumb { -webkit-appearance:none; appearance:none;
    width:13px; height:13px; border-radius:50%; background:var(--accent); cursor:pointer;
    border:2px solid var(--bg); box-shadow:0 0 0 1px var(--accent); }
  .ctrl input[type="range"]::-moz-range-thumb { width:13px; height:13px; border-radius:50%;
    background:var(--accent); cursor:pointer; border:2px solid var(--bg); }
  .ctrl-toggle > span { justify-content:flex-start; gap:9px; align-items:center; }
  .ctrl-toggle input { accent-color:var(--accent); }
  .ctrl-opacity { border-top:1px dashed var(--rule); padding-top:9px; margin-top:2px; }

  /* ── PHONE (≤640px): turn the left rail into a bottom sheet ──────
     Desktop (>640px) rules above are untouched. mobile-shell.js toggles
     .sheet-open and drives the drag; here we own the sheet chrome. */
  @media (max-width:640px) {
    #layers { position:fixed; left:0; right:0; bottom:0; top:auto; transform:translateY(101%);
      width:100%; max-width:100%; max-height:82dvh; overflow-y:auto;
      border-radius:16px 16px 0 0; padding:22px 18px;
      /* clear the floating Layers FAB (48px tall at bottom+16) so it never
         overlaps the last row / Beta-layer footer when scrolled to the end */
      padding-bottom:calc(env(safe-area-inset-bottom) + 76px);
      transition:transform .34s cubic-bezier(.22,.8,.25,1); z-index:71;
      box-shadow:0 -8px 30px var(--shadow); -webkit-overflow-scrolling:touch; }
    #layers.sheet-open { transform:translateY(0); }
    /* grip/handle — small centred drag bar in the top grip zone */
    #layers::before { content:""; position:absolute; top:9px; left:50%; transform:translateX(-50%);
      width:36px; height:4px; border-radius:2px; background:var(--rule); }
    /* a touch more breathing room so the grip doesn't crowd the first heading */
    #layers h3:first-child { margin-top:6px; }
  }
  `;
  const style = document.createElement('style');
  style.id = 'atlas-layer-panel-css';
  style.textContent = css;
  document.head.appendChild(style);
}

// inline SVG icons (inherit currentColor)
const ICON = {
  info: 'i',
  solo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.4"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2"/></svg>',
  lock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="7" width="9" height="6.3" rx="1.2"/><path d="M5.6 7V5a2.4 2.4 0 0 1 4.8 0v2"/></svg>',
};

// Beta-layer unlock state, session-scoped. SOFT prototype gate only — the data
// file is still fetchable, so this is obfuscation, not security (see the note
// in the gated layer module).
const BETA_KEY = 'atlas-beta-unlocked';
const betaUnlocked = new Set(JSON.parse(sessionStorage.getItem(BETA_KEY) || '[]'));
const persistBeta = () => { try { sessionStorage.setItem(BETA_KEY, JSON.stringify([...betaUnlocked])); } catch (e) {} };

export function initLayerPanel(registry, mountEl) {
  const el = typeof mountEl === 'string' ? document.querySelector(mountEl) : mountEl;
  if (!el) { console.warn('layer-panel: mount element not found'); return; }
  injectStyles();

  // which entanglement layer (if any) is currently soloed
  let isolatedId = null;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function controlRow(layer, c) {
    const val = layer.controlValues[c.id];
    if (c.type === 'select') {
      const opts = (c.options || []).map((o) =>
        `<option value="${esc(o.value)}" ${o.value === val ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
      return `<label class="ctrl"><span>${esc(c.label)}</span>
        <select data-ctrl="${esc(c.id)}">${opts}</select></label>`;
    }
    if (c.type === 'toggle') {
      return `<label class="ctrl ctrl-toggle"><span>
        <input type="checkbox" data-ctrl="${esc(c.id)}" ${val ? 'checked' : ''}>
        ${esc(c.label)}</span></label>`;
    }
    // slider (default)
    const min = c.min ?? 0, max = c.max ?? 1, step = c.step ?? 0.05;
    return `<label class="ctrl"><span>${esc(c.label)} <em class="cval">${esc(val)}</em></span>
      <input type="range" data-ctrl="${esc(c.id)}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
  }

  // per-layer opacity slider (synthetic — not a registry control)
  function opacityRow(layer) {
    const o = opacity.has(layer.id) ? opacity.get(layer.id) : 1;
    return `<label class="ctrl ctrl-opacity"><span>Opacity <em class="cval" data-opval>${Math.round(o * 100)}%</em></span>
      <input type="range" data-opacity min="0" max="1" step="0.05" value="${o}"></label>`;
  }

  function layerRow(layer) {
    const soloed = layer.group !== 'surface' && isolatedId === layer.id;
    // Gated "Beta" layer, still locked → show a lock + inline passcode field
    // instead of the toggle. Once unlocked (this session) it falls through to a
    // normal row that just carries a small "Beta" tag.
    if (layer.beta && !betaUnlocked.has(layer.id)) {
      // Locked: reveal nothing about what the layer is — just "Beta layer".
      // No methodology ⓘ here (it would give the layer away); it returns once
      // unlocked.
      return `<div class="layer-row beta-locked" data-layer="${esc(layer.id)}">
        <div class="layer-head">
          <span class="layer-toggle beta-trigger" data-beta-trigger role="button" tabindex="0">
            <span class="beta-lock">${ICON.lock}</span>
            <span class="layer-name">Beta layer</span>
          </span>
        </div>
        <div class="beta-unlock" hidden>
          <input type="password" data-beta-input placeholder="Passcode" autocomplete="off" spellcheck="false">
          <button type="button" class="beta-go" data-beta-submit>Unlock</button>
          <div class="beta-note">Beta layer — soft prototype gate.</div>
        </div>
      </div>`;
    }
    const betaTag = layer.beta ? ' <span class="beta-tag">Beta</span>' : '';
    let controls = '';
    if (layer.visible) {
      const declared = (layer.controls || []).map((c) => controlRow(layer, c)).join('');
      // Only add the panel's synthetic group-opacity slider if the layer does
      // NOT already declare its own 'opacity' control — otherwise two "Opacity"
      // sliders appear and fight each other (the group one can fade arcs to nil).
      const hasOwnOpacity = (layer.controls || []).some((c) => c.id === 'opacity');
      controls = `<div class="layer-controls">${declared}${hasOwnOpacity ? '' : opacityRow(layer)}</div>`;
    }
    const isoBtn = layer.group !== 'surface'
      ? `<button class="layer-btn layer-iso ${soloed ? 'active' : ''}" data-iso
           title="${soloed ? 'Exit solo' : 'Show only this layer'}" aria-label="Isolate layer">${ICON.solo}</button>`
      : '';
    const infoBtn = layer.methodologyPath
      ? `<button class="layer-btn layer-info" data-info title="Methodology" aria-label="Methodology">${ICON.info}</button>`
      : '';
    return `<div class="layer-row ${layer.visible ? 'on' : ''} ${soloed ? 'isolated' : ''}" data-layer="${esc(layer.id)}">
        <div class="layer-head">
          <label class="layer-toggle">
            <input type="checkbox" data-toggle ${layer.visible ? 'checked' : ''}>
            <span class="layer-name">${esc(layer.label)}${betaTag}</span>
          </label>
          <div class="layer-actions">${isoBtn}${infoBtn}</div>
        </div>
        ${controls}
      </div>`;
  }

  // Isolate: show ONLY this entanglement layer; hide other entanglement
  // layers. Toggling again restores the layers that were on before.
  let preIsolateState = null;   // Map id->visible captured at solo time
  async function toggleIsolate(id, entangleLayers) {
    if (isolatedId === id) {
      // un-solo: restore prior visibility
      isolatedId = null;
      if (preIsolateState) {
        for (const l of entangleLayers) {
          const want = preIsolateState.get(l.id) ?? false;
          if (l.id !== id) await registry.setVisible(l.id, want);
        }
      }
      preIsolateState = null;
    } else {
      // capture current state, then solo
      preIsolateState = new Map(entangleLayers.map((l) => [l.id, l.visible]));
      isolatedId = id;
      await registry.setVisible(id, true);
      for (const l of entangleLayers) {
        if (l.id !== id && l.visible) await registry.setVisible(l.id, false);
      }
    }
    // registry.onChange will re-render; isolatedId is read there.
  }

  function render(layers) {
    const surface = layers.filter((l) => l.group === 'surface');
    // Beta/gated layers sink to the bottom of the entanglement list (stable sort
    // keeps everything else in registration order).
    const entangle = layers.filter((l) => l.group !== 'surface')
      .sort((a, b) => (a.beta ? 1 : 0) - (b.beta ? 1 : 0));

    // drop a stale solo if its layer vanished or was turned off externally
    if (isolatedId && !entangle.some((l) => l.id === isolatedId && l.visible)) {
      isolatedId = null; preIsolateState = null;
    }

    el.innerHTML = `
      <h3>Surface</h3>
      <div class="layer-group">${
        surface.length ? surface.map(layerRow).join('')
                       : '<div class="layer-empty">No surface layer registered.</div>'}</div>
      <h3>Entanglements</h3>
      <div class="layer-group">${
        entangle.length ? entangle.map(layerRow).join('')
                        : '<div class="layer-empty">No entanglement layers yet — they appear here as data agents register them.</div>'}</div>`;

    el.querySelectorAll('.layer-row').forEach((row) => {
      const id = row.dataset.layer;

      row.querySelector('[data-toggle]')?.addEventListener('change', (e) => {
        // manual toggle breaks any active solo cleanly
        if (isolatedId && (!e.target.checked || id !== isolatedId)) {
          isolatedId = null; preIsolateState = null;
        }
        registry.setVisible(id, e.target.checked);
      });

      row.querySelector('[data-info]')?.addEventListener('click', () => {
        const layer = registry.get(id);
        if (layer?.methodologyPath) openMethodology(layer.methodologyPath, layer.label);
      });

      row.querySelector('[data-iso]')?.addEventListener('click', () => {
        toggleIsolate(id, entangle);
      });

      // Beta gate: reveal the passcode field, then check it. On success, unlock
      // (session-scoped), re-render, and turn the layer on.
      const trigger = row.querySelector('[data-beta-trigger]');
      if (trigger) {
        const form = row.querySelector('.beta-unlock');
        const input = row.querySelector('[data-beta-input]');
        const reveal = () => { form.hidden = false; input?.focus(); };
        trigger.addEventListener('click', reveal);
        trigger.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); } });
        const submit = () => {
          const want = registry.get(id)?.passcode;
          if (input && want && input.value === want) {
            betaUnlocked.add(id); persistBeta();
            render(registry.list());
            registry.setVisible(id, true);
          } else if (input) {
            input.value = ''; input.placeholder = 'Wrong passcode'; row.classList.add('beta-wrong');
            setTimeout(() => row.classList.remove('beta-wrong'), 500);
          }
        };
        row.querySelector('[data-beta-submit]')?.addEventListener('click', submit);
        input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      }

      // declared controls
      row.querySelectorAll('[data-ctrl]').forEach((input) => {
        const evt = input.type === 'range' ? 'input' : 'change';
        input.addEventListener(evt, (e) => {
          const v = input.type === 'checkbox' ? e.target.checked
            : input.type === 'range' ? +e.target.value : e.target.value;
          registry.setControl(id, input.dataset.ctrl, v);
          const cval = input.closest('.ctrl')?.querySelector('.cval');
          if (cval && input.type !== 'select') cval.textContent = v;
        });
      });

      // synthetic opacity slider
      row.querySelector('[data-opacity]')?.addEventListener('input', (e) => {
        const v = +e.target.value;
        opacity.set(id, v);
        applyOpacity(id);
        const out = row.querySelector('[data-opval]');
        if (out) out.textContent = Math.round(v * 100) + '%';
      });
    });

    // re-apply any stored opacities (groups are recreated on (re)mount)
    layers.forEach((l) => { if (opacity.has(l.id)) applyOpacity(l.id); });
  }

  render(registry.list());
  registry.onChange(render);
  // a frame after mount, re-apply opacities (overlay groups created on mount)
  registry.onChange(() => requestAnimationFrame(() =>
    registry.list().forEach((l) => { if (opacity.has(l.id)) applyOpacity(l.id); })));
}
