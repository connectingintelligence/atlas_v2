# Atlas v2 — Changelog

Newest first. The build stamp under the map title (e.g. `build 06-15.d`)
matches the entries here — check it after a hard-refresh to be sure you are
not looking at a stale browser tab. Every change is verified by
`qa_smoke.sh` (headless checks; run from `map_v2/` with `python3 serve.py 8771`
running).

---

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
