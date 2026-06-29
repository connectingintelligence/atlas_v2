# Atlas v2 — Changelog

Newest first. The build stamp under the map title (e.g. `build 06-15.d`)
matches the entries here — check it after a hard-refresh to be sure you are
not looking at a stale browser tab. Every change is verified by
`qa_smoke.sh` (headless checks; run from `map_v2/` with `python3 serve.py 8771`
running).

---

## 2026-06-29 — the REAL iOS drag fix + auto-rotate crash (build 06-29.b)

06-29.a fixed the sheet (removed SVG pointer-capture) but the globe still didn't
move on a real iPhone. Two further root causes found and fixed:

- **`touch-action:none` was on the `<svg>` — iOS WebKit ignores it there.** With
  touch-action unenforced, iOS interpreted the one-finger drag as a page-pan and
  fired `pointercancel` on the globe pointer, so the `pointermove` stream that
  rotates the globe never arrived (headless Chrome honours touch-action on SVG, so
  it could never reproduce). Moved `touch-action:none` onto the HTML element
  `#globe-wrap` in `index.html` (kept on the svg too for non-iOS engines). This is
  the actual touch-drag fix.
- **`projection.js` auto-rotate loop threw a ReferenceError every load.** The
  Pointer-Events rewrite renamed the drag state but `tick()` still read the old,
  now-undeclared `dragStart` (`!dragStart`). In a strict-mode ES module that throws
  → the rAF loop died after one frame (no auto-spin) and logged an error on every
  browser. Replaced with `pointers.size === 0` ("not currently dragging").

The 06-29.a window-listener rewrite + FAB intro-gate are retained and verified
correct (the Layers sheet opens and its rows are tappable on-device).

## 2026-06-29 — iOS touch + intro-FAB fixes (build 06-29.a)

Real-iPhone test of 06-28.b surfaced two blockers; both fixed (desktop untouched):

- **Globe wouldn't move on touch AND the layers sheet was completely untappable.**
  Root cause: `projection.js` called `node.setPointerCapture()` on the **SVG**.
  iOS WebKit mishandles pointer-capture on an `<svg>` — the capture leaks and the
  SVG swallows every subsequent pointer event, so neither the globe drag nor the
  sheet rows ever got their taps. Removed `setPointerCapture`/`releasePointerCapture`
  entirely; `pointermove`/`pointerup`/`pointercancel` now bind to `window` (the
  finger can leave the globe without capture), strictly keyed by `pointerId` in the
  existing `pointers` Map. Any pointer that didn't start on the globe falls straight
  through and we only `preventDefault()` our own — so sheet taps are never blocked.
  Headless Chrome tolerated the capture, so this could only be reasoned from iOS
  behaviour.
- **Layers FAB floated over the intro.** The FAB + scrim (appended to `<body>`,
  z-72) showed via the ≤640px media query regardless of intro state. Gated them on
  `body.intro-active` (the class intro-flow already toggles) in `mobile-shell.js`,
  with specificity high enough to beat the media-query rules → FAB appears only once
  you enter the atlas.

## 2026-06-28 — touch via Pointer Events + legends off on mobile (build 06-28.b)

- **Touch drag rewritten on Pointer Events.** The 06-28.a TouchEvent fix still
  didn't move the globe on a real iPhone (iOS Safari TouchEvent quirks). Replaced
  the whole drag+pinch block in `projection.js` with Pointer Events — the same
  mechanism the layers-sheet drag already uses successfully on-device. One pointer
  rotates (3D) / pans (2D), two pinch-zoom, with setPointerCapture so the gesture
  survives leaving the globe. Mouse runs the identical path → desktop unchanged.
  Verified: synthetic pointer-drag rotates the globe (rot [20,-15] → [47.7,-28.9]).
- **Both legends hidden on phones** (client: "as clean as possible"): the CFCT
  surface ramp and the per-layer arc legend are `display:none` ≤640px. Desktop
  keeps them. `legend.js`.

## 2026-06-28 — mobile handling fixes from real-device testing (build 06-28.a)

First real phone test surfaced several issues; all fixed (desktop untouched):

- **Globe/map would not move on touch (the big one).** Drag used `d3.pointer()`,
  which reads `event.clientX` — `undefined` on a `TouchEvent` (coords live in
  `event.touches[*]`) → it returned `[NaN,NaN]` and the globe never rotated/panned
  on a phone. Added `dragXY()` in `projection.js` that extracts the first touch's
  coordinates for touch input (keeps `d3.pointer` for mouse → desktop byte-for-byte
  unchanged). Single-finger drag now rotates (3D) / pans (2D); pinch still zooms.
  It now feels like a normal map on the phone.
- **Layers sheet barely visible / felt dead.** Over the globe the 0.86-alpha
  panel-bg + blur washed it out. The sheet is now a **solid** `var(--bg)` surface
  (no backdrop blur) on phones, with `touch-action:pan-y` + `overscroll-behavior:
  contain` for clean scrolling, ≥44px tap targets on every row, bigger checkboxes,
  selects and info/solo buttons, and more FAB clearance.
- **Weighting button removed on mobile** (client: overkill for phones) — desktop
  keeps it. `weighting-panel.js`.
- **Feedback pill removed on mobile** (client request) — desktop keeps it.
- **Search tidied:** collapsed state is now a clean magnifier circle (the long
  placeholder no longer shows as a cut-off "Searc"); the top-left stack tightened
  up now that Weighting + Feedback are gone (brand · search · surface key).

## 2026-06-27 — remove the colour-theme switcher (build 06-27.t)

Client request: the bone/forest/dusk colour dots (bottom-left) are removed from
desktop and mobile. `motion.js` `injectThemeSwitcher()` is now a no-op; the app
stays on the default "bone" palette. `theme.js` keeps the palettes for possible
future use; the dead `#theme-switcher` CSS is left in place (harmless, no element).

## 2026-06-27 — gate Atrocity ties behind the Genocide passcode (build 06-27.s)

Data-integrity consistency: the **Atrocity section in the Relationships panel** was
showing the curated genocide data (Holocaust perpetrator/victim ties, etc.) even
though the Genocide map layer is beta-gated behind a passcode — that data is curated,
not built from established indices, so it must stay behind the same gate. Now the
relationships panel hides ALL atrocity ties (section, Sankey strands, legend swatch,
tie counts, subtitle) until the Genocide layer is unlocked. `relationships-panel.js`:
`genocideUnlocked()` reads the same `sessionStorage['atlas-beta-unlocked']` the layer
panel writes; `relGenocide()` returns `[]` when locked; `shownLayers()` drops the
Atrocity layer from the rendered sections + diagram legend. Verified: France panel
locked → 0 Atrocity/perpetrator/Holocaust; unlocked → Atrocity section returns. QA 24/24.

## 2026-06-27 — fix: single resilience factor turned the map black (build 06-27.r)

`resilienceMean()` divided by the cluster COUNT (copied from `traumaMean`), but
resilience has no live-max rescale to undo the 1/count shrink — so weighting only
one factor (e.g. Democracy) gave value/14 ≈ 6 → the whole globe went near-black.
Switched it to divide by **Σw** (a true weighted mean): one factor now reads as that
factor's own value (DEU Democracy 93.1 = green, AFG 23.7 = dark), and any subset of
factors gives that subset's mean. all-100 is unchanged (Σv/14 either way). Verified:
Democracy-only → 209 green, 0 black. qa_smoke 24/24.

## 2026-06-27 — custom weighted RESILIENCE surface (build 06-27.q)

The big one this round, on client request: you can now **weight resilience as its own
surface**, not just as a trauma dampener.

- In Custom weighting, **set every condition (trauma) weight to 0** and the surface
  flips to a **pure, weighted RESILIENCE map (green)** instead of going blank — exactly
  what one expects from "I weighted only resilience". The 14 resilience sliders then
  shape that green map directly (weight each factor in or out, same count-denominator
  leverage as trauma). `cfct-composite/index.js`: new `resilienceMean()` +
  `weightedIsResilience()`; `weightedValue()` falls back to weighted resilience when
  trauma is un-weighted; `paint()`/`activeRamp()` pick the green ramp; `surface.ramp()`
  exposed; `label()`/`breakdown()` adapt ("Custom resilience (your weights)", factor list).
- **Legend follows it live** (`legend.js`): in weighted mode the key reads the live
  `surface.ramp()` and switches between "Custom CFCT" (warm) and "Custom resilience"
  (green); re-syncs on weight changes (deferred a microtask so it reads fresh state).
- **Warning + notes updated** (`weighting-panel.js`): the blank-map warning now only
  fires when **both** trauma and resilience are all 0 (truly nothing to map). The
  Resilience-tab note now explains the new behaviour (zero the conditions → green
  resilience surface shaped by these sliders) instead of "Custom weighting always maps
  trauma".

Verified headless: trauma→0 yields 215 green countries (DEU 77.7), legend "Custom
resilience", no warning; both→0 yields blank + warning. Desktop qa_smoke 24/24.

## 2026-06-27 — blank-map guard + legend tidy (build 06-27.p)

- **Blank globe in Custom weighting explained** (`weighting-panel.js`): zeroing all
  condition/trauma weights (e.g. "All → 0" on Meta/Indicators) makes the weighted
  surface paint nothing — it went silently blank with the stat-rail empty, which
  read as a bug. Added an inline warning banner in the panel that appears whenever
  every trauma weight is 0 ("raise at least one cluster… resilience weights only
  dampen"). Confirmed: warning shows on trauma=0, clears on All → 100. (Not a code
  regression — both old and new maths return null with no trauma weight; the new
  slider leverage just made people try it.)
- **Surface legend labels** (`legend.js`): dropped the "fragile / resilient" end
  labels under the Resilience key (client preference) — every surface key now shows
  just the title on top + the 0 / 50 / 100 scale.

## 2026-06-27 — resilience legibility + weighting clarity (build 06-27.o)

- **Resilience ramp redesigned** (`theme.js`): lush green (high) → **dark-grey/near-black**
  (low), so a fragile country (Afghanistan ≈23) reads near-black instead of a pale
  tint. (Absent countries stay light bone, so dark-low ≠ no-data.)
- **Surface legend now follows the active surface** (`legend.js`): the Resilience
  surface shows a green→dark key labelled *fragile → resilient*; trauma/coverage
  surfaces keep the warm conditions key. It no longer always says "CFCT surface".
- **Weighting "Resilience" tab clarified** (`weighting-panel.js`): users read that tab
  as a resilience *surface* and wondered why the map stayed red. Added an inline note:
  these sliders only **dampen the trauma surface by ≤20%** — Custom weighting always
  maps trauma; to map resilience itself, pick **Surface → Resilience**.

## 2026-06-27 — six fixes from client review (build 06-27.n)

Root-caused via a 5-way read-only diagnosis, then fixed by hand. Desktop
`qa_smoke.sh` 24/24 (one check rewritten to the new commodities contract).

1. **Weighting felt like on/off, not 0–100.** Root cause was maths, not a bug: the
   weighted surface divided the trauma mean by **Σw**, so the weight *magnitude*
   cancelled and only crossing exactly 0 changed anything. Fix in
   `js/layers/cfct-composite/index.js` `traumaMean()`: divide by the **count of
   present clusters** (weight-independent) instead of Σw. Sliders are now true
   multipliers with smooth leverage and no 0-discontinuity. The all-100 = default
   CFCT identity is preserved (qa check 2 still passes); single-cluster selection
   still fills the ramp (the per-country 1/count cancels in `TEw/TEmaxW`).
   Simulated: reweighting half the indicators now moves the surface mean |Δ| ≈ 9.5
   (max 29), 181/238 countries shift >5 pts — vs ≈0 before.
2. **Time scrubber only worked with an entanglement on; axis always 1500–2024.**
   The scrubber detected "time-aware" only by a `year` control, which Historical
   Borders (and slavetrade/commodities) don't have, and built its domain from
   *all registered* layers. Added a declarative `temporal:{min,max}` on those
   three layers, exposed it via the registry, and rewrote `time-scrubber.js`
   `scan()` to (a) treat `temporal` OR a `year` control as time-aware, and (b)
   size the axis to the **currently visible** layers only. Now Historical Borders
   raises the scrubber alone (1400–2010), and the x-axis matches real data per
   layer (Commodities 2022–2024, Slave Voyages 1514–1866).
3. **Resilience invisible in the country details.** The drawer was hard-wired to
   the 8 trauma clusters and never rendered the 14 `rf_*` resilience factors. Added
   a **Resilience Factors** section to the Country Reading (`country-drawer.js`):
   green bars, the aggregate score in the header, per-factor ⓘ (sources from
   `indicator-docs.json`), and explicit **“no data”** rows (never a painted 0) for
   factors absent in a country. Also fixed `surface.breakdown()` so the hover
   tooltip lists factors when the Resilience surface is selected.
4. **Commodities drew lines when a country was pinned.** `showArcs` was forced true
   on pin (`|| !!pinned`). Removed it (`entanglement-commodities/index.js`): the
   layer stays particles-only by default even when pinned; arcs are strictly
   opt-in via the existing Display control. (qa check updated to assert this.)
5. **Overseas territories streaked nonsense lines in 2D.** Classic antimeridian
   wrap in the shared `js/viz/arc-renderer.js`: a great circle crossing ±180° was
   joined edge-to-edge into a straight line across the whole flat map (France→
   Wallis, USA→Guam, NZ→Tokelau/Niue/Cook Is., N. Marianas). Added a flat-mode
   split when the projected x jumps more than half the map width — each piece now
   runs to its own edge. Fixes overseas, and latently colonies/migration too.

## 2026-06-27 — mobile / touch pass (build 06-27.m)

The atlas is now usable + clean on phones, with the **desktop/Mac experience
unchanged** (every rule is gated behind `@media (max-width:640px)`; desktop
`qa_smoke.sh` still 24/24). Built as a 5-way parallel pass (disjoint file sets,
one shared layout contract), then reconciled by hand.

**Navigation — bottom sheet + FAB (`js/ui/mobile-shell.js`, new).**
- On phones the left layer rail becomes a **bottom sheet** reached via a floating
  **☰ Layers** button (bottom-centre). Tapping dims the globe with a scrim and
  slides the sheet up; close via the FAB, scrim tap, **drag-down on the grip**, or
  Esc. Drag-to-dismiss uses Pointer Events from a 28px top grip zone (so the
  sheet's own scroll is never hijacked) with fling detection + snap-back.
- `#layers` re-styled as the sheet in `layer-panel.js` (≤640px): fixed bottom,
  `translateY(101%)` → `.sheet-open`, 82dvh, rounded top, grip bar, FAB-clearance
  padding. Desktop rail untouched above 640px.

**Touch gestures (`js/core/projection.js`).** Two-finger **pinch-to-zoom** (drag-
rotate is suppressed mid-pinch); `touch-action:none` on the svg stops page
rubber-banding. Mouse wheel/drag unchanged. The +/- zoom buttons are hidden on
mobile (pinch replaces them).

**Full-screen panels (≤640px).** Country reading, Relationships, Methodology, and
Weighting go true full-screen (`100dvh`, safe-area padding, 44px close targets,
momentum scroll). Chrome respects `env(safe-area-inset-*)` (viewport now
`viewport-fit=cover`) and `100dvh` to dodge the iOS address-bar jump.

**Floating chrome reflow.** A single non-overlapping **top-left stack** on a 44px
rhythm below a one-line brand (build-stamp hidden on phones): Weighting · Search
(collapses to a 40px icon) · Feedback · CFCT surface ramp · legend (collapsible).
Bottom edge: theme dots (left) · Layers FAB (centre) · 2D-3D + play (right). Time
scrubber lifts above the FAB. `#bottom-hint` hidden.

**Verified:** desktop `qa_smoke.sh` 24/24; phone-viewport screenshots of the home
map, open sheet, full-screen country reading, and relationships panel. iPad is
intentionally left on the desktop layout pending Thomas's mobile/iPad call.

## 2026-06-22 — data integrity, intro, small islands, beta gate (build 06-22.a)

A large session. All verified by `qa_smoke.sh` (24/24).

**Data integrity (the big one): absent data is now shown as ABSENT, never 0.**
- The historical death-toll family (war, perpetration, genocide, famine, disaster,
  authoritarian rule) is no longer zero-filled for uncovered countries — uncovered
  cells are NaN/absent and read "no data" in the Country Reading, render grey on the
  map, and are excluded from the averages (`build_historical_scores.py` output stage
  + `parse_and_merge.py`). COW's `-8/-9` "unknown" sentinels are now treated as missing
  (fixed Sudan reading a false 0 on war).
- **War layer normalization fixed:** per-capita **+ log** (was linear min-max, which put
  one outlier at 100 and the USA at ~2). Successor states take the MAX of their own and
  the inherited share (fixed Ukraine sitting at ~3 while Belarus inherited ~81).
- `te_max` rescale anchored to well-covered countries (≥20/28 clusters) so thin-coverage
  entities (defunct V-Dem statelets) can't blow up the global scale.
- **Genocide clusters now use ESTABLISHED INDICES ONLY** — UCDP One-sided, ACLED civilian
  fatalities, PITF Geno-/Politicide, TMK — no curated list in the composite. Modern-only
  (≈1946–2022); historical cases (Holocaust etc.) are intentionally absent and reserved
  for the beta Genocide layer. A visible caveat note now appears under the Country
  Reading's Condition Clusters. Fixed `identity-based_oppression` drawer slug typo
  (hyphen vs underscore) that showed "no data" for that cluster on every country.
  Tiny real values now show "<1" (not "0").

**Map / UI**
- **Small island states now visible:** basemap switched 110m → **50m** (Malta, Singapore,
  Mauritius, Maldives… were absent at 110m). Search/select now **flies + zooms** to a
  country scaled to its size; max zoom raised 6 → 10.
- **Intro flow:** lighter, less-bold type; the globe dims to ~0.28 opacity behind the
  text; copy replaced with the v1-prototype framing; math formula removed; the search /
  feedback / legend / weighting chrome is hidden during the intro.
- **Resilience surface** ramp re-tuned to a stronger grey → lush-green arc.
- **Panel overlap fixed:** `#globe-wrap` is now its own stacking context so arcs/particles
  no longer bleed over the layer panel.
- **Commodities** layer is now particles-only by default (like Refugees), one shared
  canvas, per-commodity colour; oil → near-black, palette tuned for the warm terrain.
- **Slave Voyages:** carrier panel render fix (value labels no longer overflow); combined
  colonial flags shown under the colonising power (Portugal/Brazil → Portugal, etc.).
- **Relationships panel:** radar/spider view removed entirely — Flow (Sankey) only.
- **Genocide → "Beta layer":** gated behind a soft passcode, shown as a locked "Beta
  layer" (label hidden until unlocked), sunk to the bottom of the entanglements. Reusable
  for any `beta` layer. Honest: client-side obfuscation only.
- **Feedback** email → `mail@pocketproject.org`.

## 2026-06-16 — follow-up UX requests (builds 06-16.a–.g)

Verified headless (QA now 24/24):

- **Indigenous "land under cursor" merged into the one hover tooltip**
  (build 06-16.g). The new lookup had been a *second* floating box that landed
  on top of the CFCT tooltip (looked doubled). Now the indigenous layer exposes
  `window.atlasIndigenous.namesAt(lonlat)` and the single `#tooltip` (app.js)
  renders an inline "Indigenous land · …" line under the CFCT value. The
  separate `#indig-hover` box is gone. Files: `js/layers/indigenous-territories/
  index.js`, `js/app.js`.
- **FIX: live Native Land data washed the whole globe** (build 06-16.f). The API
  GeoJSON has mixed/pole-problematic ring winding; d3.geoPath fills the region
  to the *left* of a ring, so wrongly-wound polygons filled the whole sphere
  (green, then teal). `pipeline/fetch_native_land.py` now rewinds every ring by
  **spherical area** (orient so d3's filled side is the smaller, <2π region) —
  correct near poles and for large rings where planar shoelace is meaningless.
  Globe + flat now render territories correctly; Arizona hit-test still exact.

- **Indigenous territories now on LIVE data** (build 06-16.e): with the Native
  Land Digital API key registered through the Pocket Project account, the layer
  was refreshed from the live API (2,057 territories, current) — replacing the
  2023-10 ArcGIS mirror. New `pipeline/fetch_native_land.py` (key from
  `$NATIVE_LAND_API_KEY` or `pipeline/native_land_key.txt`; fetch → thin to 3
  decimals → served geojson). Arizona hit-test still exact (Diné Bikéyah,
  Hopitutskwa, Pueblos, Ute). `methodology/indigenous-territories.md` updated.

- **FIX: projection had no `.invert` → screen→lon/lat was silently broken**
  (build 06-16.d). The morph projection (`interpolatedProjection`) is built with
  `geoProjectionMutator`, which sets `projection.invert` from the *raw*
  function's invert on every `alpha()` call — and the blended raw had none, so
  `projection.invert` was `undefined`. The click handler wraps `invert` in a
  try/catch, so clicks silently produced **`lonlat = null`** — meaning the
  indigenous **click→territory list never worked on real clicks** (only the QA
  `&ll=` flag, which injects coords, passed), and the new **hover label found
  nothing**. Fix: give the blended raw its own `.invert` (the matching endpoint
  inverse — orthographic at the globe end, equirectangular at flat), so d3 wires
  `projection.invert` up and keeps it. Verified: `invert([...]) → [lon,lat]` and
  the hover now reports e.g. "Indigenous land: Yup'ik/Cup'ik". File:
  `js/core/projection.js`. This also fixes the click→chip territory list and any
  other invert-dependent interaction.

- **Slave Voyages — "Who organised it" ranking panel** (builds 06-16.b–.c): a
  small ranked bar list (top-right) with a **Flag / Port** toggle:
  - **Flag** (default): carrier flags by voyages organised over the visible
    routes — "which powers were most active" (Portugal/Brazil, Great Britain,
    U.S.A., France, …). Exact counts summed from each route's `flags`.
    Refreshes on control change.
  - **Port**: the top-25 **fitting-out ports** the voyages began from
    (Liverpool, Bahia, London, Rio de Janeiro, Bristol, Nantes, Lisbon, Havana,
    …) — the closest signal to *who organised it*, across all voyages with a
    known port. Added to `slavetrade.json._meta.departure_ports` by a new pass
    in `build_entanglement_slavetrade.py` (column
    `voyage_itinerary__imp_port_voyage_begin__name`).
  - Each route arc also has a hover `<title>` with its carrier-flag breakdown.
  - Files: `js/layers/entanglement-slavetrade/index.js`,
    `pipeline/build_entanglement_slavetrade.py`, `methodology/slavetrade.md`.
  - **Data note on "who was politically behind it":** the source has the vessel
    **flag** and the **ports** (now both surfaced) — but **no explicit
    political-sponsor field** (crown/government, chartered companies, investors).
    That would need other historical sources.


- **Entanglements button always works** — it no longer greys out when no
  entanglement layer is on, and the relationships panel no longer gates its
  open/follow on layer visibility (it reads its own data). Click a country →
  [Entanglements] opens the panel directly, no need to switch a layer on first.
  Files: `js/ui/country-chip.js` (removed the disable logic),
  `js/ui/relationships-panel.js` (removed the three `anyEntanglementVisible`
  gates + the now-unused function).
- **Indigenous territories — instant hover label** — moving the cursor over the
  map (with the layer on) now shows the Indigenous nation(s) under the pointer
  in a small floating label ("Indigenous land: …"), in addition to the existing
  click→chip list. Hit-test is bbox-prefiltered + front-hemisphere-culled so it
  stays cheap. File: `js/layers/indigenous-territories/index.js`.
- **Slave Voyages — carrier (organising power) breakdown on hover** — the data
  already carried a per-route `flags` count; each route's arc now has a tooltip
  listing the carrier flags that organised those voyages (e.g. "Portugal/Brazil
  2,647 · USA 14 · France 6 …") with route + voyages + disembarked. File:
  `js/layers/entanglement-slavetrade/index.js`.
- QA: 3 new checks (rel panel opens with no layer, slave carrier tooltip,
  territories hover label).

## 2026-06-15 — review session with Adrian (builds 06-15.a … .f)

Source: call with Adrian Wagner, 2026-06-15 (transcript on Max's Desktop).
Decisions and feedback from that call, implemented in four sub-builds.

### Decisions taken (not just code)
- **Genocide layer stays visible for now.** Adrian proposed gating it behind a
  passcode as a "beta" layer; the decision on 2026-06-15 was to **keep it
  visible and defer the gate**. (When built, the gate can only be obfuscation
  on a static client — see NEXT-SESSION memory.)
- **Historical-displacement tier (Partition / WWII expulsions / Nakba): not
  built.** AI-only, no sources, and refugee data does not reach that far back.
  Genocide remains the *only* AI-curated layer.
- **Overseas-territories framing:** neutral label on the map; the colonial-
  continuity thesis + the legal-status nuance live in the methodology text.

### build 06-15.f — genocide: 3 contested events added
- Added the three events agreed in the call ("add all, mark contested"), each
  with a real citation + confidence flag in `genocide_curated_verified.csv`,
  then reran `build_entanglement_genocide.py` (120 arcs / 30 events, up from
  117 / 27):
  - **Australian Frontier Wars** 1788–1930 (self-arc AUS) — Reynolds ≥20,000
    national / Evans & Ørsted-Jensen ≥65,180 Queensland alone; *contested*,
    confidence low.
  - **East Timor (Indonesian occupation)** 1975–1999 (IDN → TLS) — CAVR *Chega!*
    (2005) / HRDAG min. 102,800 (±11,000), up to 200,000; confidence high.
  - **West Papua (Indonesian rule)** 1963–present (self-arc IDN) — toll
    *contested*, no demographic study; Yale Law 2004 / Anderson 2015 / Genocide
    Watch cite up to 500,000; confidence low.
  - Verified headless: East Timor arc draws (37→38 arcs), Australia + West Papua
    add 2 halos (78→80), all three in the Event picker. `methodology/genocide.md`
    updated. No values fabricated — every row cites a published source.

### build 06-15.e — relationships panel: radar / spider chart
- Replaced the "Radial" chord diagram with a **Radar (spider) chart**, now the
  default view (client reference: a climate "Risk Profile" radar). One axis per
  entanglement layer (Colonial / Refugees / Economic / Commodities / Atrocity);
  the filled polygon is the country's **relative involvement** per layer — 0 at
  centre, 1 = the most-entangled country in that layer (magnitude = distinct
  partner countries, normalised against the global per-layer max, `^0.65` to
  keep small values legible). Concentric rings + spokes + layer-coloured axis
  labels and vertex dots (hover = partner count).
- "Flow" (vertical Sankey, strongest partners) stays as the toggle. The old
  `chordBlock` was removed; `topPartners` (which it shared) still drives Flow.
- Files: `js/ui/relationships-panel.js` (new `buildRadar`/`radarBlock`, view
  toggle + default, CSS, comments). Dev: `?relpanel=FRA`.

### build 06-15.d — genocide arc redesign + documentation
- **Genocide arcs redesigned** (Adrian: the death-toll-as-width "confused more
  than it helped"; make direction obvious):
  - Lines now have a **constant width**; the death-toll → width encoding is gone.
  - Direction shown by an **arrowhead at the victim end** (`<marker>` with
    `fill:context-stroke` so it inherits each arc's colour). No motion —
    memorial stillness preserved.
  - Self-perpetrated events keep their breathing **halo**, now a touch larger /
    thicker (Adrian found the circles hard to see); death toll still scales the
    halo radius and stays in the data + Event picker.
  - Files: `js/layers/entanglement-genocide/index.js`, `js/ui/legend.js`
    (genocide row: dropped width wedge, desc now "perpetrator → victim (arrow)"),
    `methodology/genocide.md`.
- **This `CHANGELOG.md` created** and the docs above updated.

### build 06-15.c — NEW layer: Overseas territories
- Answers "why is there no line to French Guiana?": the colonial datasets only
  record territories that became **independent**, and the world basemap folds
  French Guiana into France's own polygon — so it had no node and no arc.
- New layer **`entanglement-overseas`** ("Overseas territories"): one line from
  each administering power to the real `[lon,lat]` of each territory it still
  governs, plus a dot at each territory. **43 territories · 10 powers · 16
  UN-listed.** Present-tense (ignores the time scrubber). Hue = power (same
  palette as Colonies). Honest **status tags**: UN-listed NSGT / integrated
  overseas region (French DOM, Canaries, Azores — legally part of the metropole)
  / autonomous (Greenland, Faroes, Dutch) / dependency / associated state.
  Scope control: all vs UN-listed only.
- Data: `pipeline/build_overseas_territories.py` →
  `data/processed/entanglement/overseas_territories.json` (symlinked into
  `map_v2/data/`). Sources: UN C-24 Non-Self-Governing Territories list, CIA
  World Factbook, Natural Earth admin-0; coordinates are published facts — no
  values fabricated.
- Files: new layer dir, build script, `js/app.js` (registration),
  `js/ui/legend.js` (row + order), `js/ui/time-scrubber.js` (contract badge),
  `methodology/overseas-territories.md`, 2 new `qa_smoke.sh` checks.

### build 06-15.b — economic remittance colour
- Remittance changed from cyan to **pink/magenta `#ff4d8d`** — cyan still sat
  too close to aid-green at particle size (client screenshot). Pink is the
  maximum hue separation from aid-green. Files:
  `js/layers/entanglement-economic/index.js`, `js/ui/legend.js`.

### build 06-15.a — visual batch from the call
- **Colonies — Russia recoloured** rust → **steel blue `#3f6e8c`**: at the 1938
  snapshot Russia's huge landmass read as the same dark red as Britain once the
  territory paint darkened it. `js/layers/entanglement-colonies/index.js`.
- **Economic — remittances off yellow** (gold `#ffc233`, invisible over the
  warm-orange surface) → cyan, then pink in .b. Particle colour updated too.
- **Legend — economic key** now has three labelled swatches
  (remittances / aid / trade) answering "what's green vs yellow?".
- **"Slave trade" → "Slave Voyages"** everywhere (Adrian: the arcs are the
  voyages, not the trade between the powers that profited): layer label, legend,
  time-contract badge, intro prose (`index.html`), `methodology/slavetrade.md`.
- **Indigenous coverage disclaimer** pulled to a prominent plain-language block
  at the **top** of `methodology/indigenous-territories.md` ("work in progress;
  blank ≠ no Indigenous peoples; India not yet covered") — Adrian wanted it
  early because it is a sensitive topic.

### Still pending after this session
- One-click from a country to its entanglements in the economic view.
- **Waiting on others:** Adrian → Pocket Project API key; Thomas → mobile/iPad
  call; Native Land API key.
