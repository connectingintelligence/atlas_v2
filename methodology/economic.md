# Economic & Resources Entanglement

**What it measures.** How countries are economically bound to one another and
to the world economy. Three sub-streams, each a separately toggleable layer of
meaning:

- **Remittances** (arc, warm **gold**) — money sent home by migrants, sending
  country → receiving country (USD millions).
- **Aid / ODA** (arc, **green**) — official development assistance, donor →
  recipient (USD millions).
- **Trade openness** (marker, violet) — trade as a share of GDP, a per-country
  reading of how exposed an economy is to the world. This is *not* a bilateral
  flow, so it is drawn as a glowing ring at each country's centroid sized by
  trade/GDP, rather than as an arc between two countries.

The two flow streams use distinct, saturated **warm** colours (gold, green) so
they stay legible over the warm CFCT choropleth *and* are unmistakably
different from the migration layer's cool teal arcs.

## Sources

### 1. Remittances — World Bank / KNOMAD Bilateral Remittance Matrix
- **Dataset:** Bilateral Remittance Matrix — a country × country matrix where
  rows are the *sending* country and columns are the *receiving* country; cells
  are remittances in **USD millions** for a single matrix year.
- **Publisher:** KNOMAD (Global Knowledge Partnership on Migration and
  Development) / World Bank.
- **Landing page:** https://www.knomad.org/data/remittances
  - Direct XLSX (latest editions; the dated path changes each release):
    `https://www.knomad.org/sites/default/files/<YYYY-MM>/bilateral_remittance_matrix_<YEAR>.xlsx`
    (the pipeline tries the recent known URLs automatically; override with
    `--remittance-xlsx PATH` if they have moved).
- **Year:** one matrix per release; latest published is the 2021–2023 vintage.
- **On disk:** the World Bank **Data360** SDMX-CSV export of the same matrix
  (`WB_KNOMAD_BRE`, 2021) at `data/raw/knomad_bre_data360.csv` — the build
  falls back to it automatically when no KNOMAD XLSX is available
  (`build_remittances_data360()`; REF_AREA = host/sending country,
  `Destination: <name>` label = receiving country, US$ million; the `WLD`
  world-total aggregate is dropped so totals don't masquerade as corridors).
- **License:** free to use for non-commercial purposes with attribution to
  KNOMAD / World Bank.
- **Accessed:** Data360 export on disk (2026-06-05); XLSX download optional.

### 2. Aid — OECD-DAC bilateral ODA, via the World Bank API
- **Dataset:** *Net bilateral aid flows from DAC donors* — the OECD-DAC Table
  2A series republished per donor in the World Bank WDI as indicators
  `DC.DAC.<DONOR>L.CD` (current US$). Donor → recipient, net disbursements.
- **Publisher:** OECD Development Assistance Committee (original source),
  via World Bank World Development Indicators (API host).
- **URL:** `https://api.worldbank.org/v2/country/all/indicator/DC.DAC.<DONOR>L.CD`
  (fetched by `pipeline/fetch_wb_dac_aid.py` for all 31 country donors →
  `data/raw/oecd_dac2a_oda.csv` in `Donor,Recipient,Year,Value` form).
- **Why not OECD directly:** stats.oecd.org is retired and sdmx.oecd.org sits
  behind a Cloudflare browser challenge that rejects scripted downloads (the
  403 that originally cut this stream). The WB mirror is the same DAC source,
  openly served.
- **Scope notes:** the *EU institutions* donor (`CEC`) is excluded — it is not
  a country and has no map centroid to anchor an arc; WB regional aggregates
  ("Arab World", …) are excluded as recipients; only positive net flows are
  kept.
- **Year range:** 2000–2024, annual.
- **License:** CC-BY-4.0 (World Bank API terms); attribute OECD-DAC as the
  original source.
- **Accessed:** 2026-06-10.

### 3. Trade openness — World Bank WDI
- **Dataset:** Trade (% of GDP), indicator `NE.TRD.GNFS.ZS`.
- **Publisher:** World Bank, World Development Indicators.
- **URL:** https://data.worldbank.org/indicator/NE.TRD.GNFS.ZS
- **On disk:** `03_Prototype/data/new/statrisk_replication-master/data.out/wdi.csv`,
  column `wdi.trade`.
- **Year range on disk:** 1960–~2013 (this WDI extract is from the 2015 statrisk
  replication; the build uses the latest available year per country in range,
  typically 2012).
- **License:** CC-BY-4.0.
- **Accessed:** on disk.

## How it is built

`pipeline/build_entanglement_economic.py` produces
`data/processed/entanglement/economic.json` (symlinked to
`map_v2/data/economic.json`; if the symlink is absent the pipeline copies the
file so the two stay in sync):

- **Trade:** reads `wdi.csv`, maps each row's `sftgcode` (PITF/COW country code,
  e.g. `GER`→`DEU`, `UKG`→`GBR`, `ROK`→`KOR`) to ISO3, keeps the latest non-`NA`
  `wdi.trade` value per country within the year window, and emits a
  **self-referential** arc `{from==to, value=trade%GDP, type:"trade"}`.
- **Remittances:** opens the KNOMAD XLSX, auto-detects the country **header
  row** (the row whose cells resolve to the most ISO3 codes) and the country
  **label column**, then walks every (sender row × receiver column) cell. Both
  axes are normalised to ISO3 via `country_mapping.get_iso3`; aggregate/region
  labels (`World`, `Sub-Saharan Africa`, totals, …) are dropped, self-loops are
  skipped, and each positive cell becomes one `type:"remittance"` arc. The set
  is capped to the top `--remit-top-n` corridors by value (default 4000) to keep
  the arc set bounded.
- **Aid:** reads the OECD-DAC long-format CSV, heuristically detects
  donor/recipient/year/value columns across both the legacy OECD.Stat and new
  Data Explorer SDMX-CSV shapes, filters to **total-ODA** rows when an aid-type
  / measure column is present (so categories are not double-counted), normalises
  donor & recipient to ISO3, sums duplicate (year, donor, recipient) cells, and
  emits `type:"aid"` arcs in range. Capped to the top `--aid-top-n` flows
  (default 1500).
- Output is **deterministic and re-runnable**: arcs are sorted by
  `(type, year, from, to)`.

```json
{ "_meta": { "source": "...", "year_range": [2000, 2024],
             "counts": { "remittance": 0, "aid": 0, "trade": 52 },
             "license": "..." },
  "arcs": [ { "from": "USA", "to": "MEX", "year": 2021, "value": 12345, "type": "remittance" },
            { "from": "DEU", "to": "AFG", "year": 2020, "value": 430.2, "type": "aid" },
            { "from": "USA", "to": "USA", "year": 2012, "value": 30.67, "type": "trade" } ] }
```

### Re-running the build (exact commands)

```bash
# 1. (only if refreshing aid) fetch DAC bilateral ODA via the World Bank API:
python3 pipeline/fetch_wb_dac_aid.py     # -> data/raw/oecd_dac2a_oda.csv

# 2. build all three streams from disk (remittances fall back to the
#    Data360 CSV automatically when no KNOMAD XLSX is present):
python3 pipeline/build_entanglement_economic.py \
    --aid-csv data/raw/oecd_dac2a_oda.csv --no-download
```

Manual downloads if files go stale:
1. **Remittances** — https://www.knomad.org/data/remittances → "Bilateral
   Remittance Matrix" → download the latest XLSX → pass via `--remittance-xlsx`
   (or refresh the Data360 export of `WB_KNOMAD_BRE`).
2. **Aid** — re-run `pipeline/fetch_wb_dac_aid.py`; a manual OECD Data Explorer
   SDMX-CSV export still works via `--aid-csv` if preferred.

## Chinese development finance (added 2026-06-12)

The DAC mirror only covers Western donors — China, the Gulf states and other
non-DAC lenders were invisible, a systematic skew. The aid stream now merges
**AidData's Global Chinese Development Finance Dataset v3.0** (top-500 flows;
Donor = CHN; 2000–2021; `data/raw/aiddata_chinese_finance.csv`, built from
records flagged "Recommended For Aggregates").

- **Measure caveat:** GCDF values are **commitments (nominal USD)**; DAC
  values are **net disbursements**. Same order of magnitude, different
  accounting — a CHN arc and a USA arc are not strictly the same quantity.
- License: ODC-By 1.0. Citation: AidData. 2023. *Global Chinese Development
  Finance Dataset, Version 3.0*; academic use should also cite Custer et al.
  (2023, TUFF 3.0 methodology) and Dreher et al. (2022, *Banking on Beijing*).
- The "Trade openness" rings are now labelled with their real vintage
  (%GDP, ~2012) and default OFF — real bilateral trade lives in the
  Commodities layer.

## What counts (and what doesn't)

- A **trade marker** says how open an economy is, not who it trades with. A
  small open economy (Singapore, Belgium) glows large; a large continental
  economy (USA, Brazil) glows small — that is the intended reading.
- A **remittance / aid arc** is directional: it points from sender/donor to
  receiver/recipient. Width ∝ √value; colour identifies the stream.

## Build & status (what ships)

The shipped `economic.json` reports the true per-stream counts in
`_meta.counts`. On a build host **with** network access (or with
`--remittance-xlsx` / `--aid-csv` provided), all three streams populate and the
remittance + aid toggles light up with no code change. On a host **without**
network and with no remittance/aid file on disk, those two bilateral streams are
**skipped** (logged, never invented) and only the on-disk **trade** stream
ships — per the project's hard data-discipline rule.

## Caveats

- **Remittances are model-based estimates,** not observed transactions. KNOMAD
  allocates each country's total remittance receipts/payments across partners
  using migrant-stock and host/origin-income weights; a single bilateral cell
  can be far from reality for a specific corridor, and the matrix represents one
  vintage year, not a time series.
- **Bilateral aid is imperfect.** ODA mixes grants and concessional loans,
  routes substantial funding through multilaterals (which are **not** captured
  as bilateral arcs here), and reporting standards differ across donors and
  years. Values are USD millions of disbursements; the pipeline filters to total
  ODA where the source labels it, but exports that lack an aid-type column may
  mix categories. (Fixed 2026-06-11: `fetch_wb_dac_aid.py` previously emitted
  raw USD while remittances were USD millions — both streams are now USD
  millions, and the layer's min-value filter is a log-stepped select
  (none / ≥$1 M / ≥$10 M default / ≥$100 M / ≥$1 B) sized to fit both
  distributions: remittances 0.001–52,595 M, aid 0.001–11,790 M.)
- **Trade openness on disk is dated** (latest ~2012 in this WDI extract). The
  pipeline accepts a fresher WDI file; the ratio is also sensitive to re-export
  hubs and GDP-denominator effects (hence values above 100% for entrepôt
  economies).
- **Coverage is partial.** Absence of a marker or arc means missing/unresolved
  data, not a zero flow. Aggregate rows/columns (`World`, regions, income
  groups) are deliberately excluded so no arc terminates on a non-country.
- **Top-N capping.** To keep the rendered arc set legible and bounded, only the
  largest corridors/flows are emitted by default (`--remit-top-n 4000`,
  `--aid-top-n 1500`); pass `0` to keep everything.

*No AI-fabricated data. Every value traces to the sources above — trade to the
on-disk WDI file, remittances to the KNOMAD bilateral matrix, and aid to the
OECD-DAC DAC2A table when the pipeline is run with access to them.*
