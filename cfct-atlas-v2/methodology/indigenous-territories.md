# Indigenous territories layer — Native Land Digital

> **Please read first — coverage is incomplete (work in progress).**
> This layer shows only the territories that are in the Native Land Digital
> dataset today. Many countries and whole regions are **missing** — coverage is
> strongest in the Americas, Australia/New Zealand and the Arctic, and thin or
> absent across Africa, the Middle East and most of Asia (India, for example,
> is not yet covered). **A blank area means we have no data there — not that no
> Indigenous peoples live there.** We are still adding sources, so treat the
> map as a partial, evolving picture, never a complete one.

Indigenous territories drawn **over** the modern state grid. The layer is
deliberately **present-tense**: it does not respond to the time scrubber,
because the source is not time-coded — it represents indigenous territories
as a living, evolving assertion of whose land this is, not a historical
snapshot of any particular year. Seen across the borders of the USA, Canada,
Australia or South America, it makes the atlas's point directly: today's
states sit on top of other nations.

## Source

- **Dataset:** Native Land Digital — territories category (one polygon per
  nation/territory, with the project's own colour coding).
- **Publisher:** Native Land Digital (Indigenous-led nonprofit),
  https://native-land.ca
- **File used:** `data/raw_sources/native_land/native_land_territories.geojson`
  (2,057 territories), retrieved **2026-06-16** **live from the Native Land
  Digital API** via a key registered through the Pocket Project account.
  (Earlier builds used a public ArcGIS mirror, vintage 2023-10-01; the layer is
  now on current data.)
- **Refreshing:** re-run `pipeline/fetch_native_land.py` (reads the key from
  `$NATIVE_LAND_API_KEY` or `pipeline/native_land_key.txt`). It downloads the
  live `https://native-land.ca/api/polygons/geojson/territories?key=…`, writes
  the raw file, and writes a thinned copy (coords to 3 decimals) as the served
  `data/processed/entanglement/indigenous_territories.geojson`.
- **License/terms:** free to use in maps and applications; Native Land asks
  reusers to carry their disclaimer (below), which this page and the layer UI do.

## Native Land's disclaimer (carried verbatim in spirit)

- The map does **not** represent official or legal boundaries of any
  Indigenous nation. It is **not** a legal resource and not an academic-level
  representation.
- Territories **overlap by design** — overlapping claims and shared lands are
  the historical reality; the map does not adjudicate them.
- The data **changes often** and may be inaccurate; Native Land encourages
  contacting the nations themselves to learn more than a map can say.

## How the layer behaves

- Translucent fills in Native Land's own per-territory colours, faint enough
  that overlaps read as density rather than error; outlines slightly stronger.
- **Hover the map** to see which Indigenous nation(s) you are pointing at — a
  small floating label lists the territories under the cursor instantly (added
  2026-06-16). **Clicking** a place also lists them in the country chip, with
  links to each nation's native-land.ca page.
- Coexists with the CFCT surface and all arc layers; ignores the time
  scrubber and the all-time toggle (stat rail says "asserted today — not
  year-bound").
- Coverage is strongest in the Americas, Australia/NZ and parts of the
  Arctic; thinner in Africa, the Middle East and Asia — absence of a polygon
  means missing data, not absence of indigenous presence.
