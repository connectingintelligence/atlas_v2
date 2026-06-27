// ─────────────────────────────────────────────────────────────
//  METHODOLOGY PAGE (Seiten) — right side panel rendering a layer's
//  markdown methodology via window.marked, styled in the bone palette.
//
//  Expected markdown sections (see methodology/_template.md):
//    What it measures · Source · Year range · Caveats · Full citation · License
//  A "Source" definition list is lifted into a clean citation block.
//
//  Public API (kept stable):  openMethodology(path, title) · closeMethodology()
//  Closes on ×, on Esc, or on backdrop click.
// ─────────────────────────────────────────────────────────────

import { loadText } from '../core/data-loader.js';

let panel = null;
let backdrop = null;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  /* ── Methodology panel (Agent F, injected) ─────────────────── */
  #methodology-backdrop { position:fixed; inset:0; z-index:74; background:rgba(0,0,0,.18);
    opacity:0; pointer-events:none; transition:opacity .4s ease; }
  #methodology-backdrop.open { opacity:1; pointer-events:auto; }

  #methodology { position:fixed; top:0; right:0; bottom:0; width:400px; max-width:94vw;
    background:var(--bg); border-left:1px solid var(--rule); padding:0; overflow:hidden;
    display:flex; flex-direction:column; transform:translateX(100%); z-index:75;
    box-shadow:-18px 0 50px rgba(0,0,0,.16);
    transition:transform .45s cubic-bezier(.22,.8,.25,1); }
  #methodology.open { transform:translateX(0); }

  #methodology .mhead { display:flex; align-items:flex-start; justify-content:space-between;
    gap:12px; padding:26px 28px 16px; border-bottom:1px solid var(--rule); flex:none; }
  #methodology .mkind { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.16em;
    text-transform:uppercase; color:var(--accent); margin-bottom:7px; }
  #methodology .mtitle { font-family:'Source Serif 4',serif; font-weight:400; font-size:21px;
    line-height:1.18; color:var(--ink); }
  #methodology .mclose { flex:none; width:30px; height:30px; border-radius:50%; background:transparent;
    border:1px solid var(--rule); color:var(--ink-faint); font-size:17px; line-height:1; cursor:pointer;
    display:inline-flex; align-items:center; justify-content:center; transition:color .18s,border-color .18s,background .18s; }
  #methodology .mclose:hover { color:var(--ink); border-color:var(--ink-faint); background:var(--chip-bg); }

  #methodology .mscroll { overflow-y:auto; padding:22px 28px 40px; flex:1;
    scrollbar-width:thin; scrollbar-color:var(--rule) transparent; }
  #methodology .mscroll::-webkit-scrollbar { width:6px; }
  #methodology .mscroll::-webkit-scrollbar-thumb { background:var(--rule); border-radius:3px; }

  #methodology .mbody { font-size:14px; line-height:1.72; color:var(--ink-dim); }
  #methodology .mbody > *:first-child { margin-top:0; }
  #methodology .mbody h1 { font-family:'Source Serif 4',serif; font-weight:400; font-size:24px;
    color:var(--ink); margin:0 0 12px; line-height:1.15; }
  #methodology .mbody h2 { font-family:'JetBrains Mono',monospace; font-size:10.5px; letter-spacing:.14em;
    text-transform:uppercase; color:var(--ink-faint); margin:26px 0 9px; padding-bottom:6px;
    border-bottom:1px solid var(--rule); }
  #methodology .mbody h3 { font-family:'Source Serif 4',serif; font-weight:500; font-size:15px;
    color:var(--ink); margin:18px 0 6px; }
  #methodology .mbody p { margin:0 0 12px; }
  #methodology .mbody strong { color:var(--ink); font-weight:600; }
  #methodology .mbody em { color:var(--ink); }
  #methodology .mbody a { color:var(--accent); text-decoration:none; border-bottom:1px solid color-mix(in srgb,var(--accent) 40%,transparent); }
  #methodology .mbody a:hover { border-bottom-color:var(--accent); }
  #methodology .mbody ul, #methodology .mbody ol { margin:0 0 14px; padding-left:20px; }
  #methodology .mbody li { margin:0 0 6px; }
  #methodology .mbody li::marker { color:var(--ink-faint); }
  #methodology .mbody code { font-family:'JetBrains Mono',monospace; font-size:12px;
    background:var(--chip-bg); padding:1px 5px; border-radius:2px; color:var(--ink); }
  #methodology .mbody pre { background:var(--bg-2); border:1px solid var(--rule); border-radius:3px;
    padding:12px 14px; overflow-x:auto; margin:0 0 14px; }
  #methodology .mbody pre code { background:none; padding:0; font-size:11.5px; line-height:1.55;
    color:var(--ink-dim); }
  #methodology .mbody blockquote { border-left:2px solid var(--accent); margin:0 0 14px;
    padding:2px 0 2px 14px; color:var(--ink-faint); font-style:italic; }
  #methodology .mbody hr { border:none; border-top:1px solid var(--rule); margin:22px 0; }
  #methodology .mbody table { width:100%; border-collapse:collapse; margin:0 0 14px; font-size:12.5px; }
  #methodology .mbody th, #methodology .mbody td { text-align:left; padding:6px 8px;
    border-bottom:1px solid var(--rule); }
  #methodology .mbody th { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.1em;
    text-transform:uppercase; color:var(--ink-faint); }

  /* citation block lifted from the Source definition list */
  #methodology .mbody .citation { background:var(--chip-bg); border:1px solid var(--rule);
    border-radius:4px; padding:14px 16px; margin:6px 0 16px; }
  #methodology .mbody .citation dl { display:grid; grid-template-columns:auto 1fr; gap:6px 14px; margin:0; }
  #methodology .mbody .citation dt { font-family:'JetBrains Mono',monospace; font-size:9.5px;
    letter-spacing:.12em; text-transform:uppercase; color:var(--ink-faint); padding-top:2px; white-space:nowrap; }
  #methodology .mbody .citation dd { margin:0; color:var(--ink); font-size:13px; word-break:break-word; }
  #methodology .mbody .citation dd a { word-break:break-all; }

  #methodology .merr { color:var(--arc-perp); font-style:italic; }
  #methodology .mloading { color:var(--ink-faint); font-style:italic; }

  /* ── Phone pass (Agent F): full-screen sheet ≤640px ─────────── */
  @media (max-width:640px){
    #methodology { width:100%; max-width:100%; top:0; bottom:auto; height:100dvh;
      border-left:none; box-shadow:none; }
    #methodology .mhead { padding:calc(env(safe-area-inset-top) + 18px)
      calc(env(safe-area-inset-right) + 18px) 16px calc(env(safe-area-inset-left) + 18px); }
    #methodology .mclose { width:44px; height:44px; font-size:21px; }
    #methodology .mscroll { -webkit-overflow-scrolling:touch; overscroll-behavior:contain;
      padding:22px calc(env(safe-area-inset-right) + 20px)
      calc(env(safe-area-inset-bottom) + 40px) calc(env(safe-area-inset-left) + 20px); }
  }
  `;
  const style = document.createElement('style');
  style.id = 'atlas-methodology-css';
  style.textContent = css;
  document.head.appendChild(style);
}

function ensurePanel() {
  if (panel) return panel;
  injectStyles();

  backdrop = document.createElement('div');
  backdrop.id = 'methodology-backdrop';
  backdrop.addEventListener('click', closeMethodology);
  document.body.appendChild(backdrop);

  panel = document.createElement('aside');
  panel.id = 'methodology';
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Methodology');
  panel.innerHTML = `
    <div class="mhead">
      <div>
        <div class="mkind">Methodology</div>
        <div class="mtitle"></div>
      </div>
      <button class="mclose" title="Close (Esc)" aria-label="Close">×</button>
    </div>
    <div class="mscroll"><div class="mbody"><p class="mloading">Loading…</p></div></div>`;
  document.body.appendChild(panel);

  panel.querySelector('.mclose').addEventListener('click', closeMethodology);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) closeMethodology();
  });
  return panel;
}

// Find a "Source" section whose body is a markdown bullet list of
// `**Key:** value` pairs and turn it into a definition-list citation block.
// Operates on the rendered HTML so we don't need a markdown AST.
function enhanceCitation(bodyEl) {
  const heads = [...bodyEl.querySelectorAll('h2, h3')];
  const srcHead = heads.find((h) => /^(source|full citation|citation)\b/i.test(h.textContent.trim()));
  if (!srcHead) return;
  // find the first UL after the heading, skipping intro prose/blockquotes,
  // but stop at the next section heading.
  let list = srcHead.nextElementSibling;
  while (list && list.tagName !== 'UL' && !/^H[1-6]$/.test(list.tagName)) {
    list = list.nextElementSibling;
  }
  if (!list || list.tagName !== 'UL') return;

  const dl = document.createElement('dl');
  let any = false;
  list.querySelectorAll(':scope > li').forEach((li) => {
    const strong = li.querySelector('strong');
    if (strong && /:\s*$/.test(strong.textContent)) {
      const dt = document.createElement('dt');
      dt.textContent = strong.textContent.replace(/:\s*$/, '');
      // value = remaining nodes after the <strong>
      const dd = document.createElement('dd');
      let node = strong.nextSibling;
      while (node) { dd.appendChild(node.cloneNode(true)); node = node.nextSibling; }
      dd.innerHTML = dd.innerHTML.replace(/^[:\s]+/, '');
      dl.appendChild(dt); dl.appendChild(dd); any = true;
    }
  });
  if (!any) return;

  const wrap = document.createElement('div');
  wrap.className = 'citation';
  wrap.appendChild(dl);
  list.replaceWith(wrap);
}

export async function openMethodology(path, title) {
  const p = ensurePanel();
  p.querySelector('.mtitle').textContent = title || 'Methodology';
  const body = p.querySelector('.mbody');
  body.innerHTML = '<p class="mloading">Loading…</p>';
  p.classList.add('open');
  backdrop.classList.add('open');
  try {
    const md = await loadText(path);
    body.innerHTML = (window.marked ? window.marked.parse(md) : `<pre>${md}</pre>`);
    enhanceCitation(body);
  } catch (err) {
    body.innerHTML = `<p class="merr">Could not load methodology (${path}).</p>`;
  }
  p.querySelector('.mscroll').scrollTop = 0;
}

export function closeMethodology() {
  panel?.classList.remove('open');
  backdrop?.classList.remove('open');
}
