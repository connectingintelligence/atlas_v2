# Country Readings

**What it shows.** The per-country drawer assembles a short "reading" of each
territory: its collective-trauma condition (the CFCT score and its meta-cluster
breakdown), population over time, size and geography, religious composition, and
a handful of curated *practices of peace* — local traditions, institutions and
memorials through which communities address harm and rebuild relationship.

## Sources

### 1. CFCT score & condition clusters
- **Dataset:** Collective Fragility / Collective Trauma Index (CFCT), Atlas v1 pipeline output
- **Publisher:** Connecting Intelligence / The Pocket Project (built from World Bank, V-Dem, PTS, RSF, WHO, UNHCR, UCDP, COW, COLDAT, EPR, UNESCO and others)
- **File:** `map_v2/data/cti_scores.json` (← `03_Prototype/map/cti_scores.json`)
- **Note:** the drawer reads the *existing* v1 index; it does not recompute it. Meta-cluster keys are unprefixed (e.g. `direct_violence`), trauma clusters are `tc_*`, resilience factors `rf_*`.

### 2. Religion
- **Dataset:** "How the Global Religious Landscape Changed From 2010 to 2020" (percentages worksheet); 2020 figures
- **Publisher:** Pew Research Center — Pew-Templeton Global Religious Futures project
- **URL:** https://www.pewresearch.org/religion/ (dataset: "Religion Composition 2010-2020")
- **Local file:** `data/raw_sources/Religious Composition 2010-2020 dataset/Religious Composition 2010-2020 (percentages).csv`
- **Coverage:** 201 countries/territories (≥100,000 population in 2010 or 2020), 7 categories: Christian, Muslim, Unaffiliated, Buddhist, Hindu, Jewish, Other.
- **License:** Pew Research Center data, free for non-commercial research with attribution.
- **Accessed:** 2026-01-20 (file timestamped Feb 2026 revision)

### 3. Geography (area / capital / languages / region)
- **Dataset:** REST Countries v3.1 (`/all?fields=cca3,ccn3,name,area,capital,languages,region,subregion`)
- **Publisher:** REST Countries (community project, built on Wikipedia / CIA World Factbook)
- **URL:** https://restcountries.com/v3.1/all
- **License:** Mozilla Public License 2.0 (open, no key)
- **Accessed:** at pipeline build time (cached to `data/raw_sources/restcountries_all.json`)
- **Note:** in the shipped `countries.json`, geography is filled for the ~30 curated countries; running the pipeline backfills geography for all countries from the live API.

### 4. Population over time
- **Dataset:** World Population Prospects 2024 — Total Population by sex, annual
- **Publisher:** UN Department of Economic and Social Affairs, Population Division
- **URL:** https://population.un.org/wpp/ (CSV: `WPP2024_TotalPopulationBySex.csv`)
- **License:** CC BY 3.0 IGO
- **Accessed:** at pipeline build time (cached to `data/raw_sources/wpp_total_population.csv`)
- **Fallback:** when the WPP CSV is unavailable, the build falls back to the two
  population anchor points (2010 and 2020) carried in the Pew dataset, which Pew
  itself sources from UN WPP 2024. The shipped `countries.json` uses these two
  anchors; running the pipeline replaces them with the full decade series
  (1950, 1960, …, 2024).

### 5. Practices of peace
- **Source:** Curated editorial content (Atlas v2 team), hand-written and fact-checked against the named tradition / institution.
- **NOT auto-generated.** ~30 countries are curated; the rest carry a "coming soon" placeholder. Content quality is prioritised over coverage (see plan §8.4).

## How it is built

`pipeline/build_country_readings.py` is deterministic and re-runnable:

1. Loads the UN-numeric → ISO3 map from `map_v2/data/country-meta.json`.
2. Parses the on-disk Pew CSV → per-country religion array + 2010/2020 population anchors.
3. Fetches REST Countries (cached) → area / capital / languages / region.
4. Fetches UN WPP (cached) → decade population markers; falls back to Pew anchors.
5. Merges with the curated `PRACTICES` table.
6. Writes `data/processed/countries.json` (keys ordered, floats rounded) and
   symlinks `map_v2/data/countries.json` to it.

```
python3 build_country_readings.py              # live fetch + caches
python3 build_country_readings.py --no-network # caches + Pew only
```

Output schema (per ISO3):

```json
{
  "RWA": {
    "name": "Rwanda",
    "population": [{ "year": 2010, "value": 10.32 }, { "year": 2020, "value": 13.07 }],
    "geography": { "area": "26,338 km²", "capital": "Kigali", "languages": "...", "region": "..." },
    "religion": [{ "name": "Christian", "pct": 97.0 }, { "name": "Muslim", "pct": 1.8 }],
    "practices": [{ "name": "Gacaca Courts", "meta": "...", "desc": "..." }]
  }
}
```

Countries without curated practices carry `"practices_status": "coming_soon"` instead of a `practices` array.

## What counts (and what doesn't)

- **Religion** uses Pew's 7-category schema; "Other religions" bundles Baha'i, Jain, Shinto, Sikh, Zoroastrian, folk/traditional and many small groups, so the bar under-represents religious diversity in places where folk religion dominates.
- **Population** markers are decade snapshots, not a continuous series — the sparkline is indicative, not analytic.
- **Geography** capital/area/language fields follow REST Countries' editorial choices (e.g. a single "capital" for countries with more than one seat of government).
- **Practices of peace** is a deliberately small, curated set. It is illustrative, not a ranking or an exhaustive inventory; absence of a card means "not yet curated", never "no such practices exist".

## Caveats

- Religion figures are 2020 estimates; rapidly changing populations (conflict, migration) may have shifted since.
- The shipped `countries.json` carries 2010/2020 population anchors and geography only for the curated set; **re-running the pipeline** backfills the full UN WPP series and REST Countries geography for all ~200 countries.
- Territories present in the globe topology but absent from Pew (small dependencies, disputed areas) render with whatever fields exist and a graceful "coming soon" / "no data" fallback — never an error.

*No AI-fabricated data. Population, religion and geography each trace to the
public sources above; practices-of-peace prose is curated, attributable editorial content.*
