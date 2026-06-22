# Commodities layer — bilateral commodity trade

Exporter → importer arcs for six strategic commodity groups, the atlas's first
**genuinely bilateral** trade data (the Economic layer's "trade" stream is
per-country %-of-GDP openness, not corridors).

## Source

- **Dataset:** CEPII **BACI** HS22, version 202601 (release 2026-01-22) —
  UN Comtrade bilateral trade reconciled at the HS6 product level (exporter and
  importer declarations harmonised into one consistent flow).
- **Publisher:** CEPII (Centre d'Études Prospectives et d'Informations
  Internationales).
- **Citation:** Gaulier, G. and Zignago, S. (2010), *BACI: International Trade
  Database at the Product-Level — The 1994–2007 Version*, CEPII Working Paper
  N°2010-23.
- **URL:** http://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37
- **File:** `data/raw_sources/trade_datasets/BACI_HS22_V202601.zip`
  (year file used: `BACI_HS22_Y2024_V202601.csv`).
- **Years:** 2022–2024 (all years in the HS22 vintage); the layer snaps the
  global time scrubber to the nearest covered year, and "all time" shows each
  corridor's peak year.
- **Units:** BACI reports **thousand USD**; the pipeline emits **USD millions**
  (matching the Economic layer).
- **License:** CEPII open data; cite Gaulier & Zignago (2010).
- **Accessed:** 2026-06-11

## Commodity groups (HS6 codes)

| Group | HS6 codes | Note |
|---|---|---|
| Crude oil | 270900 | petroleum oils, crude |
| Gold | 710811, 710812, 710813 | **non-monetary only** — 710820 (monetary gold) excluded |
| Copper | 260300 + 740311/12/13/19/21/22/29 | ores & concentrates + unwrought refined/alloys |
| Rare earths | 284610, 284690, 280530 | cerium & other RE compounds + RE metals (Sc, Y) |
| Lithium | 283691 | lithium carbonate (the traded battery precursor) |
| Cobalt | 810520, 810530, 810590 | mattes/intermediates, **incl. waste & scrap (810530)**, articles |

## How it is built

`pipeline/build_entanglement_commodities.py`:

1. Stream `BACI_HS22_Y2024_V202601.csv` once, keep rows whose HS6 code `k` is
   in a group above.
2. Map BACI numeric country codes to ISO3 via `country_codes_V202601.csv`.
   Codes without a real ISO3 are dropped and logged — see caveats.
3. Sum value per (exporter, importer, group); convert thousand USD → USD M.
4. Keep the **top 250 corridors per group globally, UNION each exporter's
   own top 5 corridors per group** (counts of capped corridors are stored in
   `_meta.corridors_dropped_by_cap` — no silent truncation). Output: 3,099
   arcs. The per-exporter floor exists because a purely global cut made
   mid-size exporters look empty when pinned: Mali's gold to Australia
   ($216M) and Switzerland ($120M) fell below the global gold top-250 even
   though they dominate Mali's own trade.

```bash
# rebuild (BACI zip already on disk; re-download from the URL above if stale)
python3 pipeline/build_entanglement_commodities.py
```

Output `data/processed/entanglement/commodities.json`
(symlinked as `map_v2/data/commodities.json`).

## What the layer shows

- **Arc hue = commodity** (slate oil, metallic-yellow gold, copper orange,
  magenta rare earths, pale-cyan lithium, cobalt blue); **width ∝ √value**.
- Min-value floor is a log-stepped select (default **≥ $100 M**, ~400 arcs
  across all six groups); hover-to-focus and click-to-pin come from the shared
  arc renderer.
- 2024 spot checks against known patterns: CAN→USA crude ($100.5 bn),
  CHL→CHN copper ($25.5 bn), COD→CHN cobalt ($3.0 bn), MMR→CHN rare earths
  ($0.8 bn), CHL→CHN lithium carbonate ($2.0 bn).

## Caveats

- **Taiwan (fixed 2026-06-12).** Comtrade code 490 "Other Asia, nes" is
  Taiwan's reporting residual (per BACI's own FAQ) and is now mapped to TWN
  (237 corridors, incl. IRN→TWN crude oil $13bn in 2022). Still dropped:
  "Europe EFTA, nes", historical SACU.
- **Per-importer floor (added 2026-06-12)** alongside the per-exporter one,
  so pinned importers also always show their main suppliers.
- **Re-exports & transit hubs** (CHE/GBR gold, NLD oil) inflate entrepôt
  corridors; BACI reconciles mirror declarations but does not undo routing.
- **One year, one vintage.** 2024 values only; no time series yet (the HS22
  file also carries 2022–2023 if a scrubber hookup is wanted later).
- **Group ≠ total market.** Lithium = carbonate only (no spodumene 2530.90 /
  hydroxide split-out); cobalt includes scrap; rare earths exclude downstream
  magnets (8505).
