// ─────────────────────────────────────────────────────────────
//  ANACHRONISM NOTE — when the time scrubber goes back before 1900
//  while the map is still drawing TODAY'S state borders, say so:
//  a small caption above the scrubber + the modern borders fade to
//  a ghost. The borders are a reference frame keyed to the data
//  (everything is ISO3-coded), not a claim that Nigeria existed in
//  1500 — this module makes that explicit instead of silent.
//
//  Suppressed whenever the 'historical-borders' surface layer is on
//  (then the borders ARE period borders and the layer speaks for
//  itself), and in all-time mode (no single year is claimed).
//
//  Public API:  initAnachronismNote({ registry })
// ─────────────────────────────────────────────────────────────

const THRESHOLD = 1900;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  #anachronism-note { position:fixed; left:50%; bottom:104px; transform:translateX(-50%);
    z-index:54; max-width:min(560px, 80vw); text-align:center; pointer-events:none;
    font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:.08em;
    color:var(--ink-faint); background:var(--panel-bg); border:1px solid var(--panel-border);
    border-radius:999px; padding:5px 14px; backdrop-filter:blur(10px);
    opacity:0; transition:opacity .35s ease; }
  #anachronism-note.show { opacity:1; }
  #indigenous-time-note { position:fixed; left:50%; bottom:130px; transform:translateX(-50%);
    z-index:54; max-width:min(620px, 84vw); text-align:center; pointer-events:none;
    font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:.08em;
    color:var(--ink-faint); background:var(--panel-bg); border:1px solid var(--panel-border);
    border-radius:999px; padding:5px 14px; backdrop-filter:blur(10px);
    opacity:0; transition:opacity .35s ease; }
  #indigenous-time-note.show { opacity:1; }
  svg.anachronism .countries path.country { stroke-opacity:.3; transition:stroke-opacity .4s ease; }`;
  const s = document.createElement('style');
  s.id = 'anachronism-css'; s.textContent = css;
  document.head.appendChild(s);
}

export function initAnachronismNote({ registry } = {}) {
  if (!registry) return;
  injectStyles();

  const note = document.createElement('div');
  note.id = 'anachronism-note';
  note.textContent = "Borders shown are today's states — a reference frame; they did not exist then";
  document.body.appendChild(note);

  // Same honesty rule applied to the Native Land overlay: those territories
  // also moved and changed through time, but the source is present-tense
  // (no dated indigenous-boundaries dataset exists) — say so when the user
  // scrubs the clock while the layer is on.
  const indigNote = document.createElement('div');
  indigNote.id = 'indigenous-time-note';
  indigNote.textContent = 'Indigenous territories are shown as asserted today — nations also moved and changed; no dated source exists';
  document.body.appendChild(indigNote);

  const svg = document.querySelector('#globe-wrap svg');

  function sync() {
    const year = registry.year;
    const allTime = !!registry.allTime;
    const list = registry.list();
    const histOn = list.some((e) => e.id === 'historical-borders' && e.visible);
    const indigOn = list.some((e) => e.id === 'indigenous-territories' && e.visible);
    const past = !allTime && Number.isFinite(year) && year < THRESHOLD;
    const anachronistic = past && !histOn;
    note.classList.toggle('show', anachronistic);
    svg?.classList.toggle('anachronism', anachronistic);
    indigNote.classList.toggle('show', past && indigOn);
  }

  registry.onYearChange(sync);
  registry.onChange(sync);
  sync();
}
