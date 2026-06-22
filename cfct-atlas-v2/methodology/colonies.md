# Colonies (Colonial / Dependency Entanglement)

**What it measures.** Each arc runs from a colonizing power (the metropole) to a
territory it ruled, drawn for the years that tie was active. Dragging the year
slider replays the expansion and retreat of empires — French and British reach
swell around 1900 and recede through the 1960s–70s decolonisation wave; the
Ottoman, Russian/Soviet and Austro-Hungarian land empires rise and dissolve
across the 19th–20th centuries.

The layer is built in **two tiers** so coverage and rigour are explicit:

| Tier | Source | Covers | Years |
|------|--------|--------|-------|
| **Primary** | COLDAT (Becker 2019) | The eight European overseas empires (Britain, France, Spain, Portugal, Netherlands, Belgium, Germany, Italy), each with real start **and** end years | colony-specific, ~1462–1984 |
| **Secondary** (toggleable overlay) | ICOW Colonial History 1.1 (Hensel) | The land/non-European empires COLDAT omits: Ottoman, Russian/Soviet, Austro-Hungarian, United States, Japanese, Chinese, Australian, New Zealand | end year only (independence date); **no start year** |

The layer's *Empires* control switches between *European overseas only (COLDAT)*
and *All empires (+ ICOW)*. Secondary (ICOW) arcs render slightly dimmer and
thinner so the rigorous COLDAT core reads as primary.

## Sources

**Primary — COLDAT (The Colonial Dates Dataset).**
- **Dataset:** `data/raw_sources/COLDAT_dyads.csv` (long format: one row per
  `country × colonizer`, with `col` = 1 when a colonial relationship existed and
  `colstart_mean / colend_mean` the averaged start/end years; `_max` variants give
  the widest plausible span).
- **Author / publisher:** Becker, Bastian (2019). *Introducing COLDAT: The
  Colonial Dates Dataset.* SOCIUM/SFB1342 Working Paper No. 02. University of
  Bremen.
- **Archive:** Harvard Dataverse, **doi:10.7910/DVN/T9SDEW**.
- **License:** CC-BY 4.0.
- **Accessed:** 2026-06-06.

**Secondary — ICOW Colonial History Data Set, v1.1.**
- **Dataset:** `data/raw_sources/colonial_datasets/ICOW Colonial History 1.1/coldata110.csv`
  (one row per modern state: `ColRuler` = the CoW code of its colonial ruler,
  `IndDate` = independence date `YYYYMM`, plus violence/type/notes).
- **Author:** Hensel, Paul R. (2018). *ICOW Colonial History Data Set,* version 1.1.
- **URL:** https://www.paulhensel.org/icowcol.html (archive `colhist.zip`).
- **License:** Free for research use with citation.
- **Accessed:** 2026-06-06.

## How it is built

Pipeline step: `pipeline/build_entanglement_colonies.py` →
`data/processed/entanglement/colonies.json` (symlinked to
`map_v2/data/colonies.json`). Deterministic, offline, re-runnable (sorted output).

1. **Primary tier (COLDAT).** For every dyad with `col == 1`, emit a directed
   `colonizer → colonized` arc. `start_year`/`end_year` use COLDAT's averaged
   (`_mean`) dates, with the `_max` span retained as `start_year_max`/`end_year_max`.
   - Colonizer name → ISO3 (`belgium`→BEL, `britain`→GBR, `france`→FRA,
     `germany`→DEU, `italy`→ITA, `netherlands`→NLD, `portugal`→PRT, `spain`→ESP).
   - Colonized country name → ISO3 via `map_v2/data/country-meta.json`, with nine
     spelling aliases (e.g. *Cape Verde*→CPV, *Congo - Kinshasa*→COD,
     *Côte d'Ivoire*→CIV, *Myanmar (Burma)*→MMR).
2. **Secondary tier (ICOW).** For every state whose `ColRuler` is **not** one of
   the eight COLDAT colonizers (i.e. an empire COLDAT cannot represent), emit a
   `ruler → state` arc.
   - Ruler CoW code → ISO3 / display name: 2→USA, 300→Austria-Hungary,
     365→Russia / USSR, 640→Ottoman Empire, 710→China, 740→Japan, 900→Australia,
     920→New Zealand.
   - Colonized state CoW code → modern successor ISO3 (only the ~45 overlay
     states are mapped, verified by name; the defunct *Czechoslovakia* aggregate
     is dropped in favour of CZE + SVK).
   - `end_year` = year of `IndDate`. **`start_year` is `null` by design** — ICOW
     does not code when colonisation began. In the UI a null start means the tie
     is shown for every year up to independence.
   - `ind_violent`, `ind_type` and `notes` are passed through for the side panel.
3. **Merge & sort.** Both tiers are written to a single `arcs` array; every arc
   carries `tier` (`primary`/`secondary`), `source`, and `empire` (display name)
   so the layer, legend and relationships panel can attribute it.

```json
{ "_meta": { "sources": [ {"tier":"primary","name":"COLDAT …","url":"https://doi.org/10.7910/DVN/T9SDEW"},
                          {"tier":"secondary","name":"ICOW Colonial History 1.1","url":"https://www.paulhensel.org/icowcol.html"} ],
             "year_range": [1462, 2008], "primary_arcs": 161, "secondary_arcs": 45 },
  "arcs": [ { "from":"FRA","to":"TUN","colonizer":"FRA","colonized":"TUN","empire":"France",
              "start_year":1877,"end_year":1956,"tier":"primary","source":"COLDAT" },
            { "from":"TUR","to":"TUN","colonizer":"TUR","colonized":"TUN","empire":"Ottoman Empire",
              "start_year":null,"end_year":1591,"tier":"secondary","source":"ICOW Colonial History 1.1" } ] }
```

The Tunisia example shows the two tiers working together: COLDAT records French
rule 1877–1956, ICOW adds the earlier Ottoman tie — both surface in the country
relationships panel, the Ottoman one labelled *ICOW*.

## What counts (and what doesn't)

A tie records *which power ruled which territory, and when*. It is **not** a
measure of the intensity, violence, extraction, or population of colonial rule.

## Caveats

- **Two different coding philosophies.** COLDAT dates formal colonial rule by the
  eight European maritime empires; ICOW codes the colonial ruler and independence
  date of every modern state. They are combined as complementary lenses, not
  reconciled into a single span — a country can therefore carry both a COLDAT arc
  (with start+end) and an ICOW arc (end only) from a different empire.
- **ICOW arcs have no start year.** The overlay shows *who ruled and until when*,
  not when the conquest began; treat the pre-independence span as "active up to
  independence", not a precise duration. Some ICOW independence dates reflect
  early-modern transitions (e.g. Tunisia's 1591 Ottoman autonomy), so an arc may
  fall entirely before the 1816 default scrubber window.
- **One ruler per state in ICOW.** ICOW records a single colonial ruler, so a
  territory ruled successively by two non-European empires keeps only the one ICOW
  codes; layered European rule is captured separately by COLDAT.
- **Successor-state mapping.** Historical entities are mapped to a single modern
  ISO3 (e.g. Soviet republics → their present states); pre-independence border
  changes are not modelled. The defunct Czechoslovakia aggregate is dropped to
  avoid double-counting CZE + SVK.
- **Informal empire & settler dispossession are invisible.** Spheres of
  influence, unequal treaties, and internal dispossession of indigenous peoples
  within a settler state leave no arc in either dataset. Concretely: Britain
  shows no tie to China or Japan — correct for formal rule (Japan was never
  colonised; China as a state was never a British colony), but the treaty
  ports, concessions and the Opium Wars are exactly the "informal empire"
  these sources do not code.
- **Sub-state territories are invisible.** Both datasets code modern sovereign
  states only, so colonies that became part of another state rather than
  independent leave no arc: Hong Kong (British 1842–1997, now a Chinese SAR)
  and Macau (Portuguese, until 1999) simply have no row to draw from.
- **Denmark and Sweden are absent — a sourcing gap, not an oversight.** COLDAT
  does not code the Nordic empires. ICOW records Iceland's 1944 independence
  *from* Denmark and Norway's 1905 *from* Sweden, but with `ColRuler = -9` —
  i.e. ICOW classes these as unions/integral territories, **not colonial
  rule** — and Greenland, the Faroes, and the Danish West Indies are not
  modern states, so they have no ICOW row at all. Emitting Danish/Swedish
  arcs would require recoding the source's own judgement, which the
  no-fabrication rule forbids. A dataset that codes the Nordic colonial
  empires directly would be needed to close this gap.
- **Endpoint rendering.** An arc draws only when both endpoints have a globe
  centroid.

*No AI-fabricated data. Every arc traces to COLDAT (primary) or ICOW (secondary)
above; the ISO3 / name mappings are the only editorial layer and are documented
in the build script. ICOW secondary arcs carry a null start year by design.*
