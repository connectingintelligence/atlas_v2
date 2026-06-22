# Historical borders layer — polity maps by era

A surface layer that swaps in **world polity borders as they were** when you
scrub the time axis — so 1500 no longer shows Bolivia, Nigeria and Syria, but
the Inca, Songhai, the Ottoman Empire, the Maori, the Mossi States. It answers
the atlas's own anachronism: every dataset here is keyed to today's ISO states,
which is itself the colonial lens once the year drops below the 20th century.

## Source

- **Dataset:** *historical-basemaps* — georeferenced world boundary GeoJSONs
  by era, compiled and maintained by André Ourednik et al.
- **URL:** https://github.com/aourednik/historical-basemaps
- **License:** GPL-3.0.
- **Files used:** `world_<era>.geojson` for eras 1400, 1492, 1500, 1530, 1600,
  1650, 1700, 1715, 1783, 1800, 1815, 1880, 1900, 1914, 1920, 1930, 1938,
  1945, 1960, 1994, 2000, 2010 — stored at
  `data/raw_sources/historical_basemaps/`, served via the
  `map_v2/data/historical_borders/` symlink, lazy-loaded per era.
- **Accessed:** 2026-06-11

## How the layer behaves

- The scrubbed year snaps **downward** to the latest era sheet at or before it
  (1750 shows the 1715 map — never future borders).
- Surface-group **radio** with the CFCT choropleth: turning this on turns the
  modern composite off, because painting 2024 composite scores over 1500
  polities would be a second anachronism.
- Today's country strokes stay visible as a faint ghost for orientation.
- Polity fill colours are deterministic hashes of the name — they encode
  identity, not data.
- Hover shows the polity name, its ruler where coded (`SUBJECTO`/`PARTOF`,
  e.g. a colony's empire), the era sheet, and the border-precision rating.

## Caveats (the source's own, and ours)

- The upstream project calls itself **work in progress** and asks users to
  verify against other sources before academic use. Borders carry a
  per-polygon `BORDERPRECISION` rating (1 good / 2 approximate / 3 rough),
  surfaced in the tooltip.
- "Historical boundaries are even more disputed than contemporary ones" —
  and the very concept of a fixed, linear border is largely post-1648 and
  European; many polities shown were zones of influence, not bordered states.
  Treat every line as an approximation.
- Coastlines/rivers are modern; pre-modern shorelines differed.
- This layer changes the **basemap frame only.** All arcs (colonies, refugees,
  economic, commodities, genocide) remain keyed to modern ISO states — their
  endpoints do not re-map onto historical polities, because no source dataset
  codes them that way and inventing the correspondence would violate the
  project's no-fabricated-data rule.
