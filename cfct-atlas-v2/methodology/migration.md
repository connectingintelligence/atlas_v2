# Migration (refugee flows)

**What it measures.** Each arc is a bilateral **refugee flow**: it runs from a
country of **origin** to a country of **asylum**, for one calendar year. The
arc's width and colour encode the number of refugees under UNHCR's mandate on
that origin→asylum route at year-end. It is a snapshot of where the world's
refugees *are* relative to where they *come from* — not a count of crossings.

## Source

- **Dataset:** UNHCR Refugee Population Statistics Database — *population*
  figures, broken down by **country of origin × country of asylum** (bilateral).
- **Publisher:** UNHCR, The UN Refugee Agency.
- **URL (API, no key):**
  `https://api.unhcr.org/population/v1/population/?coo_all=true&coa_all=true&year=YYYY`
  - Browse / docs: https://www.unhcr.org/refugee-statistics/ and
    https://api.unhcr.org/docs/refugee-statistics.html
  - Manual CSV download: https://www.unhcr.org/refugee-statistics/download/
- **Year range:** the API exposes ~1951–present; this pipeline defaults to
  **2000–2024**. The shipped `migration.json` reports its true range in
  `_meta.year_range`.
- **License:** Free to use with attribution to UNHCR. © UNHCR. See
  https://www.unhcr.org/terms-and-conditions
- **Accessed:** 2026-06-04

## How it is built

`pipeline/build_entanglement_migration.py`:

1. **Acquire.** Three modes:
   - `--fetch --years 2000-2024` — pulls the live API year by year (paginated
     via `maxPages`), caching each year's raw JSON under
     `data/raw/unhcr_bilateral/<year>.json` for deterministic re-runs.
   - *(default, offline)* — rebuilds from those cached raw JSON files.
   - `--csv PATH` — parses a manually downloaded UNHCR "population figures" CSV.
2. **Normalise ISO3.** Each row already carries `coo_iso` / `coa_iso`; these are
   validated (3 uppercase letters) and UNHCR non-country aggregate codes
   (`UKN` unknown, `STA` stateless, `WOR`, `VAR`, …) are dropped. If an ISO code
   is missing it falls back to `pipeline/country_mapping.get_iso3()` on the name.
3. **Aggregate.** Sum `refugees` over each `(year, origin, asylum)` triple.
   Self-loops (`origin == asylum`) and zero/empty values are removed.
4. **Emit** deterministically sorted arcs (by year, then descending value) to
   `data/processed/entanglement/migration.json`, and keep the map_v2 copy
   (`map_v2/data/migration.json`, ideally a symlink) in sync.

```json
{ "_meta": { "source": "UNHCR ... (bilateral, origin x asylum)",
             "year_range": [2000, 2024], "license": "...", "type": "refugee" },
  "arcs": [ { "from": "SYR", "to": "DEU", "year": 2015, "value": 426700, "type": "refugee" } ] }
```

### Manual CSV download (exact steps, if the API is unreachable)

1. Go to https://www.unhcr.org/refugee-statistics/download/
2. **Population type:** tick *Refugees under UNHCR's mandate*.
3. **Display / group by:** *Year*, *Country of origin*, *Country of asylum*.
4. **Years:** select the range you want (e.g. 2000–2024).
5. Click **Download** → CSV. The file has a few metadata header lines above the
   real table; the parser auto-detects the header row containing `Year`.
6. Build: `python3 pipeline/build_entanglement_migration.py --csv ~/Downloads/population.csv`

## What counts (and what doesn't)

- **Counts:** *refugees under UNHCR's mandate* — people who have fled their
  country owing to persecution, conflict, violence, or serious public-order
  disruption and are recognised under UNHCR's mandate, located in a country of
  asylum, with an identifiable country of origin.
- **Does NOT count (no arc):**
  - **Internally displaced persons (IDPs)** — they never cross a border, so
    there is no origin→asylum pair to draw. (The largest displacement crises are
    badly under-represented as a result.)
  - **Stateless persons** — frequently have no recognised country of origin.
  - **Asylum-seekers** whose claims are pending (excluded by default; the
    pipeline can fold them in only via an explicit opt-in, kept off to avoid
    double counting).
  - **Palestinian refugees under UNRWA's mandate**, who fall outside UNHCR's
    statistics.
  - **Other people in need of international protection / "of concern"** beyond
    the mandate-refugee definition.

The choice of *what is a refugee* is itself political: it privileges
cross-border, legally-recognised movement and renders internal displacement and
statelessness invisible on this map.

## Caveats

- **Stock, not flow.** Figures are year-end *populations*, not the number of
  people who moved that year. A persistent large stock (e.g. SYR→TUR) appears
  every year it persists, not only in the year of flight.
- **Reporting lag & revision.** Recent years are provisional and revised in
  later releases; counts are partly estimated by UNHCR where census data is thin.
- **Asylum ≠ first crossing.** The asylum country is where a refugee is counted,
  which may differ from the first border crossed.
- **Aggregate/unknown origins dropped.** Rows with non-ISO origin/asylum codes
  are excluded, so global totals here are slightly below UNHCR headline totals.
- **Refugees ≠ migration — South America is the cautionary example.** The layer
  draws UNHCR-*mandate refugees* only. Labor migration, asylum-seekers, IDPs,
  and UNHCR's separate **"Venezuelans displaced abroad"** category are all
  outside it. Of the ~7.9M displaced Venezuelans, only ~370K appear here as
  2024 refugees — Venezuela→Colombia, in reality the hemisphere's largest
  displacement corridor (~2.8M people, mostly under national temporary-
  protection statuses), is nearly invisible. Thin arcs in a region mean "few
  *mandate refugees*", not "no migration". (The layer was relabelled
  *Refugees* — from *Migration* — for exactly this reason.)
- **Build note.** `migration.json` is populated with the real UNHCR download
  (91,138 arcs, 2000–2024). To refresh:
  `python3 pipeline/build_entanglement_migration.py --fetch --years 2000-2024`.

*No AI-fabricated data. Every value traces to the source above.*
