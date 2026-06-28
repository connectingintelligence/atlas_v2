// ─────────────────────────────────────────────────────────────
//  COUNTRY SEARCH — type-ahead country finder.
//
//  A small search field top-centre. Matching a country and hitting Enter
//  (or clicking a suggestion) behaves exactly like clicking the country on
//  the globe: pins it (arc layers focus on it), spins the globe to centre
//  it, and dispatches `atlas:select` so the country drawer + relationships
//  panel open. Press "/" anywhere to focus the search; Esc closes it.
//
//  Public: export function initCountrySearch({ registry, globe })
//  Registered in app.js UI_MODULES.
// ─────────────────────────────────────────────────────────────

import { loadJSON } from '../core/data-loader.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]
));

function injectStyles() {
  if (document.getElementById('country-search-css')) return;
  const css = `
  #csearch {
    /* anchored to the left rail, under the brand block — same column as the
       layer panel, so the globe and title keep the centre stage */
    position: fixed; top: 78px; left: 28px;
    z-index: 70; width: 322px; box-sizing: border-box;
    font-family: 'Inter', system-ui, sans-serif;
  }
  #csearch input {
    width: 100%; box-sizing: border-box; height: 34px; padding: 0 34px 0 13px;
    border-radius: 999px; border: 1px solid var(--rule, #cfc4b2);
    background: var(--panel-bg, rgba(241,235,225,0.92));
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    color: var(--ink, #1a1612); font-size: 13px; outline: none;
    transition: border-color .2s, box-shadow .2s;
  }
  #csearch input:focus {
    border-color: var(--accent, #b0522a);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
  }
  #csearch input::placeholder { color: var(--ink-faint, #8a8276); }
  #csearch .cs-icon {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    color: var(--ink-faint, #8a8276); font-size: 13px; pointer-events: none;
  }
  #csearch .cs-list {
    list-style: none; margin: 6px 0 0; padding: 5px;
    border-radius: 12px; border: 1px solid var(--rule, #cfc4b2);
    background: var(--panel-bg, rgba(241,235,225,0.96));
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 14px 38px rgba(0,0,0,0.16); max-height: 320px; overflow-y: auto;
  }
  #csearch .cs-list[hidden] { display: none; }
  #csearch .cs-item {
    display: flex; align-items: baseline; gap: 8px; padding: 7px 10px;
    border-radius: 8px; font-size: 13px; cursor: pointer; color: var(--ink, #1a1612);
  }
  #csearch .cs-item .cs-iso {
    margin-left: auto; font-family: 'JetBrains Mono', monospace;
    font-size: 10px; color: var(--ink-faint, #8a8276);
  }
  #csearch .cs-item:hover, #csearch .cs-item.active {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
  #csearch .cs-empty { padding: 7px 10px; font-size: 12px; font-style: italic; color: var(--ink-faint); }
  @media (max-width: 900px) { #csearch { width: 210px; } }

  /* ── phones: tuck under the topbar in the left column and collapse to a 40px
     search button (clears the top-right country-chip). Focusing it (tap or "/")
     expands the field; blurring on select collapses it again. ── */
  @media (max-width: 640px) {
    /* directly under the brand title (Weighting + Feedback are hidden on phones) */
    #csearch { top: calc(env(safe-area-inset-top) + 52px); left: 12px; width: auto; }
    #csearch input {
      width: 44px; height: 44px; padding: 0; text-align: center; font-size: 16px;
      transition: width .25s ease, padding .25s ease;
    }
    /* collapsed = clean magnifier circle only (hide the long placeholder so it
       doesn't read as a cut-off "Searc") */
    #csearch input:not(:focus)::placeholder { color: transparent; }
    #csearch input:focus {
      width: min(72vw, 280px); text-align: left; padding: 0 36px 0 14px;
    }
    #csearch .cs-icon { right: 50%; transform: translate(50%, -50%); }
    #csearch input:focus + .cs-icon { right: 14px; transform: translateY(-50%); }
    #csearch .cs-list { width: min(72vw, 280px); max-height: 50vh; }
    #csearch .cs-item { padding: 10px 12px; }
  }
  `;
  const tag = document.createElement('style');
  tag.id = 'country-search-css';
  tag.textContent = css;
  document.head.appendChild(tag);
}

export async function initCountrySearch({ globe } = {}) {
  injectStyles();

  const meta = await loadJSON('data/country-meta.json').catch(() => ({}));
  const names = meta.country_names || {};
  // [iso3, name, lowercase name] — sorted for stable suggestion order
  const index = Object.entries(names)
    .map(([iso, name]) => [iso, name, String(name).toLowerCase()])
    .sort((a, b) => a[1].localeCompare(b[1]));

  const root = document.createElement('div');
  root.id = 'csearch';
  root.innerHTML = `
    <input type="text" placeholder="Search country…  ( / )" aria-label="Search country"
           autocomplete="off" spellcheck="false">
    <span class="cs-icon">⌕</span>
    <ul class="cs-list" hidden></ul>`;
  document.body.appendChild(root);
  const input = root.querySelector('input');
  const list = root.querySelector('.cs-list');
  let matches = [];
  let active = -1;

  function matchesFor(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    const starts = [], contains = [];
    for (const [iso, name, lower] of index) {
      if (lower.startsWith(q) || iso.toLowerCase() === q) starts.push([iso, name]);
      else if (lower.includes(q)) contains.push([iso, name]);
      if (starts.length >= 8) break;
    }
    return starts.concat(contains).slice(0, 8);
  }

  function renderList() {
    if (!matches.length) {
      list.innerHTML = input.value.trim()
        ? `<li class="cs-empty">No country matches</li>` : '';
      list.hidden = !input.value.trim();
      return;
    }
    list.innerHTML = matches.map(([iso, name], i) =>
      `<li class="cs-item${i === active ? ' active' : ''}" data-iso="${iso}">
         ${esc(name)}<span class="cs-iso">${iso}</span></li>`).join('');
    list.hidden = false;
  }

  function go(iso) {
    list.hidden = true;
    input.value = names[iso] || iso;
    input.blur();
    // mirror a real globe click: pin → arc layers focus; spin to centre; open
    // the drawer + relationships panel via atlas:select
    if (globe) {
      globe.setPinned(iso);
      // Fly to the country AND zoom to its size, so small island states are
      // actually visible (works in both globe and flat). Falls back to centring.
      if (globe.focusOn) globe.focusOn(iso, 800);
      else {
        const c = globe.getCentroids ? globe.getCentroids()[iso] : null;
        if (c && globe.getProjection && globe.getProjection() < 0.5) globe.spinTo([-c[0], -c[1], 0], 800);
      }
      globe.requestRender && globe.requestRender();
    }
    document.dispatchEvent(new CustomEvent('atlas:select', { detail: { iso3: iso } }));
  }

  input.addEventListener('input', () => {
    matches = matchesFor(input.value);
    active = matches.length ? 0 : -1;
    renderList();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, matches.length - 1); renderList(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); renderList(); e.preventDefault(); }
    else if (e.key === 'Enter' && active >= 0 && matches[active]) go(matches[active][0]);
    else if (e.key === 'Escape') { list.hidden = true; input.blur(); }
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('.cs-item');
    if (li) { e.preventDefault(); go(li.dataset.iso); }
  });
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 150));
  input.addEventListener('focus', () => { if (matches.length) list.hidden = false; });

  // "/" focuses search from anywhere (unless already typing in a field)
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}
