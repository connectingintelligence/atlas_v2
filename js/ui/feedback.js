// ─────────────────────────────────────────────────────────────
//  PROTOTYPE DISCLAIMER + FEEDBACK — a modal that opens IN FRONT of
//  the map: says honestly that this is a prototype with possible data
//  gaps/errors, and asks the visitor to tell us what is missing, what
//  is wrong (and why), what questions they have, which indices/datasets
//  to add, and what surprised them.
//
//  Behaviour:
//   • auto-opens ONCE per browser (localStorage) after the intro ends
//     (watches #intro for the 'hidden' class); never auto-opens under
//     ?nointro (QA/screenshot runs) or ?nofb.
//   • a small "Prototype · Feedback" pill (top-centre) reopens it any time.
//   • "Send by email" composes a mailto: to the project address with the
//     filled fields; "Copy" puts the same text on the clipboard (fallback
//     when no mail client is configured). No backend — nothing is uploaded.
//
//  Public API:  initFeedback({ registry, globe })
// ─────────────────────────────────────────────────────────────

const FEEDBACK_EMAIL = 'mail@pocketproject.org';
const SEEN_KEY = 'atlas_feedback_seen_v1';

const FIELDS = [
  ['missing', 'What is missing?', 'A country, a flow, an event, a whole topic…'],
  ['wrong', 'What is wrong — and why?', 'A number, a direction, a label; say why if you can (a source helps).'],
  ['questions', 'Questions you have', 'Anything unclear about what the map claims or how to read it.'],
  ['indices', 'Indices or datasets we should add', 'Things you would want this atlas to measure or show.'],
  ['surprises', 'What surprised you?', 'Good or bad — surprises tell us where the map speaks or misleads.'],
];

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  #fb-overlay { position:fixed; inset:0; z-index:300; background:rgba(20,16,10,.45);
    backdrop-filter:blur(3px); display:none; align-items:center; justify-content:center; }
  #fb-overlay.open { display:flex; }
  #fb-modal { width:min(560px, 92vw); max-height:86vh; overflow:auto;
    background:var(--panel-bg); border:1px solid var(--panel-border); border-radius:8px;
    box-shadow:0 18px 60px var(--shadow, rgba(0,0,0,.35)); padding:22px 24px 18px;
    color:var(--ink-dim); font-family:'Inter',sans-serif; }
  #fb-modal h2 { margin:0 0 4px; font-family:'Source Serif 4',serif; font-weight:500;
    font-size:20px; color:var(--ink); }
  #fb-modal .fb-kicker { font-family:'JetBrains Mono',monospace; font-size:9px;
    letter-spacing:.18em; text-transform:uppercase; color:var(--ink-faint); margin-bottom:10px; }
  #fb-modal .fb-disclaimer { font-size:12.5px; line-height:1.65; margin-bottom:14px; }
  #fb-modal label { display:block; margin-bottom:10px; }
  #fb-modal label span { display:block; font-family:'JetBrains Mono',monospace; font-size:10px;
    letter-spacing:.08em; text-transform:uppercase; color:var(--ink-dim); margin-bottom:3px; }
  #fb-modal textarea { width:100%; box-sizing:border-box; min-height:44px; resize:vertical;
    background:transparent; border:1px solid var(--panel-border); border-radius:4px;
    padding:6px 8px; font:12px/1.5 'Inter',sans-serif; color:var(--ink); }
  #fb-modal textarea::placeholder { color:var(--ink-faint); }
  #fb-modal .fb-actions { display:flex; gap:10px; align-items:center; margin-top:14px; flex-wrap:wrap; }
  #fb-modal button { appearance:none; cursor:pointer; border-radius:999px; padding:7px 16px;
    font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.06em; }
  #fb-modal .fb-send { background:var(--accent, #b4541e); color:#fff; border:none; }
  #fb-modal .fb-copy { background:transparent; color:var(--ink-dim); border:1px solid var(--panel-border); }
  #fb-modal .fb-close { background:transparent; color:var(--ink-faint); border:none; margin-left:auto; }
  #fb-modal .fb-note { font-size:10.5px; color:var(--ink-faint); margin-top:8px; line-height:1.5; }
  /* left rail, directly under the country search (top:78 + 34px field + gap) */
  #fb-pill { position:fixed; top:122px; left:28px; z-index:60;
    appearance:none; cursor:pointer; background:var(--panel-bg); color:var(--ink-dim);
    border:1px solid var(--panel-border); border-radius:999px; padding:5px 14px;
    font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:.14em;
    text-transform:uppercase; backdrop-filter:blur(10px); }
  #fb-pill:hover { color:var(--ink); }
  @media (max-width:900px){ #fb-pill { display:none; } }

  /* ── phones: keep feedback REACHABLE (re-show the pill in the left column,
     under the search) and make the modal full-width friendly with safe-area
     padding + >=40px controls. ── */
  @media (max-width:640px){
    /* Feedback pill hidden on phones (client request). Desktop unchanged. */
    #fb-pill { display:none; }
    #fb-modal { width:94vw; max-width:94vw; max-height:86dvh;
      padding:18px 16px calc(16px + env(safe-area-inset-bottom));
      padding-top:calc(18px + env(safe-area-inset-top)); }
    #fb-modal textarea { font-size:16px; } /* >=16px stops iOS zoom-on-focus */
    #fb-modal button { min-height:40px; padding:10px 16px; }
  }`;
  const s = document.createElement('style');
  s.id = 'atlas-feedback-css'; s.textContent = css;
  document.head.appendChild(s);
}

function composeBody(modal) {
  const parts = [];
  for (const [id, label] of FIELDS) {
    const v = modal.querySelector(`textarea[data-fb="${id}"]`)?.value.trim();
    if (v) parts.push(`${label.toUpperCase()}\n${v}`);
  }
  if (!parts.length) return null;
  parts.push(`—\nSent from the atlas prototype (${location.href})`);
  return parts.join('\n\n');
}

export function initFeedback() {
  injectStyles();

  const overlay = document.createElement('div');
  overlay.id = 'fb-overlay';
  overlay.innerHTML = `
    <div id="fb-modal" role="dialog" aria-modal="true" aria-label="Prototype disclaimer and feedback">
      <div class="fb-kicker">Prototype · work in progress</div>
      <h2>This map is a prototype — data may be missing</h2>
      <div class="fb-disclaimer">
        Every layer cites a real published source, but coverage is incomplete,
        some figures are contested, and errors are possible. Absence on the map
        means missing data, not a zero. If you see anything wrong or missing,
        please tell us here — it shapes what gets fixed next.
      </div>
      ${FIELDS.map(([id, label, ph]) => `
        <label><span>${label}</span>
          <textarea data-fb="${id}" rows="2" placeholder="${ph}"></textarea>
        </label>`).join('')}
      <div class="fb-actions">
        <button type="button" class="fb-send">Send by email</button>
        <button type="button" class="fb-copy">Copy</button>
        <button type="button" class="fb-close">Continue to the map →</button>
      </div>
      <div class="fb-note">"Send by email" opens your mail app addressed to
        ${FEEDBACK_EMAIL} — nothing is sent or stored otherwise. Reopen this
        any time via the "Prototype · Feedback" button at the top.</div>
    </div>`;
  document.body.appendChild(overlay);
  const modal = overlay.querySelector('#fb-modal');

  const pill = document.createElement('button');
  pill.id = 'fb-pill';
  pill.type = 'button';
  pill.textContent = 'Prototype · Feedback';
  document.body.appendChild(pill);

  const open = () => overlay.classList.add('open');
  const close = () => { overlay.classList.remove('open'); try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {} };

  pill.addEventListener('click', open);
  overlay.querySelector('.fb-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

  overlay.querySelector('.fb-send').addEventListener('click', () => {
    const body = composeBody(modal);
    if (!body) { modal.querySelector('textarea').focus(); return; }
    const subject = 'Atlas prototype feedback';
    location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
  overlay.querySelector('.fb-copy').addEventListener('click', async (e) => {
    const body = composeBody(modal);
    if (!body) { modal.querySelector('textarea').focus(); return; }
    try {
      await navigator.clipboard.writeText(`To: ${FEEDBACK_EMAIL}\n\n${body}`);
      e.target.textContent = 'Copied ✓';
      setTimeout(() => { e.target.textContent = 'Copy'; }, 1800);
    } catch (err) { /* clipboard blocked — mailto remains */ }
  });

  // Auto-open once per browser, after the intro hands off to the map.
  // Never during QA runs (?nointro / ?nofb keep screenshots clean).
  const params = new URLSearchParams(location.search);
  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch (e) {}
  if (seen || params.has('nointro') || params.has('nofb')) return;

  const intro = document.getElementById('intro');
  if (!intro || intro.classList.contains('hidden')) { setTimeout(open, 800); return; }
  const mo = new MutationObserver(() => {
    if (intro.classList.contains('hidden')) { mo.disconnect(); setTimeout(open, 700); }
  });
  mo.observe(intro, { attributes: true, attributeFilter: ['class'] });
}
