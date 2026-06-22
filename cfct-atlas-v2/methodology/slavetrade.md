# Slave Voyages layer — SlaveVoyages flows

The arcs trace the **voyages** themselves — purchase region → disembarkation
region — not the commercial "trade" between the European powers that profited,
which is why the layer is named *Slave Voyages* (the British and Dutch homelands,
for instance, do not appear as arc endpoints; the captives were not shipped
there). The trans-Atlantic and intra-American slave voyages are the historical
foundation of the entanglements the rest of the atlas maps.

## Source

- **Dataset:** SlaveVoyages.org consolidated voyage database (Trans-Atlantic
  Slave Trade Database + Intra-American Slave Trade Database) — 78,050 voyage
  records; the project's **imputed (IMP)** variables are used throughout.
- **Publisher:** Slave Voyages Consortium (Rice University / Emory et al.).
- **URL:** https://www.slavevoyages.org
- **File:** `data/raw_sources/all-voyages.csv`
- **License:** CC-BY-NC; cite the Slave Voyages Consortium.
- **Year range:** 1514–1866 (voyages with valid arrival years).

## How it is built

`pipeline/build_entanglement_slavetrade.py` aggregates voyages per
(principal region of captive purchase → principal region of disembarkation):
voyage count, captives embarked, captives disembarked, year span, and the
carrier-flag breakdown. Pairs with fewer than 3 voyages are dropped (counted
in `_meta`). Output: **591 region pairs · 10.10M embarked · 8.85M
disembarked** — the difference, ~1.25M people, is the death toll of the
crossings among mapped pairs.

## Why region anchors, not modern countries

Voyages are coded to SlaveVoyages' historical coastal regions ("Bight of
Benin", "Gold Coast", "Saint-Domingue"). Mapping those onto modern ISO states
would invent precision — the Bight of Benin spans modern Benin, Togo and
Nigeria. Arcs therefore carry explicit coordinates at each region's principal
historical port (Ouidah, Elmina, Luanda, Cap-Français, Salvador…), and
**modern-state attribution is deliberately not made**. Consequence: pinning a
country does not focus these arcs — they are not country-keyed, by design.

## What the layer shows

- **Hue = carrier flag** (the empire whose ships carried the trade:
  Portugal, Great Britain, France, Spain, Netherlands, U.S.A.,
  Denmark — combined colonial flags shown under the colonising power, see below)
  — a muted, sombre palette; **width ∝ √(captives disembarked)**.
- **Hover a route** to see the full breakdown of *which powers organised it* —
  the carrier-flag voyage counts (e.g. "Portugal 2,647 · U.S.A. 14 ·
  France 6"), with the route name, total voyages and captives disembarked. The
  data carries this per route; the colour only shows the single top carrier.
- **"Who organised it" ranking panel** (top-right when the layer is on), with a
  **Flag / Port** toggle: *Flag* ranks the carrier flags by voyages over the
  visible routes (exact, from each route's flag breakdown); *Port* ranks the
  top-25 **fitting-out ports** the voyages began from (Liverpool, Bahia, London,
  Rio de Janeiro, Bristol, Nantes, Lisbon, Havana, …) — built from the
  `voyage_itinerary__imp_port_voyage_begin__name` column across all voyages with
  a known port and stored in `_meta.departure_ports`.

### What "who organised it" means here

**Combined flags are shown under the colonising power.** SlaveVoyages records
several flags as combined colonial categories — *Portugal / Brazil*,
*Spain / Uruguay*, *Denmark / Baltic* — merging a colonising power with the
colony or successor state that flew the same flag tradition. In this map we
display them under the **colonising power** (Portugal, Spain, Denmark): a
colonised territory did not organise its own subjugation, so naming it beside
the coloniser would misattribute responsibility. This is a deliberate editorial
labelling choice — the underlying source data keeps SlaveVoyages' original
combined categories unchanged. (The trade-off, stated plainly: it folds the
*post-independence* trade — which independent Brazil, the largest 19th-century
slave-trading state, continued under its own flag until 1888 — into "Portugal".)

The endpoints are coastal **regions**, not the home powers, so the arcs do not
point back to Europe. The signal for *who ran the trade* is the **carrier flag**
— the nationality of the vessel — surfaced via the hover tooltip and the ranking
panel. That flag is the closest the SlaveVoyages data comes to a "political
sponsor": the dataset records the flag and the **ports** (where each voyage was
fitted out, bought and landed), but **no explicit field for the government,
crown, chartered company or investors** behind a voyage. Attributing political
responsibility beyond the flag would require other historical sources. The
**departure (fitting-out) ports** — a finer "organised from which city" signal —
are now also extracted (`_meta.departure_ports`, the Port tab of the ranking
panel). What the source still does *not* carry is the political sponsor proper:
the crown/government, the chartered companies (Royal African Company, Dutch WIC,
South Sea Company…) or the investors behind a voyage.
- **Memorial stillness** like the genocide layer: no flow animation, no
  particles. This data does not get traffic metaphors.
- Time control: "All voyages" (default) or a span filter against the global
  scrubber. Min-voyages filter trims rare routings.
- Stat rail shows routes, millions disembarked, and millions who died in the
  crossing under the current filters.

## Caveats

- IMP variables are the project's imputations over incomplete records; the
  consortium's own totals (~12.5M embarked trans-Atlantic) exceed what is
  mappable here because many voyages lack region coding — `_meta` records
  every dropped category (largest: generic "Americas", 712 voyages).
- Intra-American legs (e.g. Jamaica → Gulf coast) appear as their own flows;
  a person may therefore be counted on two arcs (ocean crossing + onward
  sale). Totals per arc are voyage-level, not person-level deduplication.
- The Indian-Ocean/Southeast-Asian Dutch trade appears only where the
  database covers it (Cape, Mauritius, Batavia anchors).
