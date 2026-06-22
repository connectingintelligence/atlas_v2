# Genocide

**What it measures.** Each arc traces mass violence from the **perpetrating**
state to a **victim** population's country. An **arrowhead at the victim end**
shows the direction (who did it to whom); colour encodes role (perpetrator vs.
victim). It is a map of who did what to whom — the entanglements of mass
violence between nations.

**Visual encoding (updated 2026-06-15).** Lines are drawn at a **constant
width** — the earlier death-toll-as-thickness encoding was removed because it
did not read clearly on the globe and confused more than it conveyed. Direction
is carried by the arrowhead instead. The estimated death toll is still in the
data and the *Event* picker, and it still scales the **halo** of self-
perpetrated events (a state killing its own population — e.g. Cambodia, Rwanda,
the Holodomor — which have no perpetrator→victim line, so a breathing halo on
the country is their only mark). No motion is used anywhere on this layer
(memorial stillness); the only movement is the slow breathing of those halos.

**Two tiers** (layered, like the Colonies layer; the *Source* control toggles
them):

- **`curated` (primary)** — named historical events, human-verified, one
  academic/institutional citation per row.
- **`ucdp` (secondary)** — systematic yearly fatality counts of intentional
  government violence against civilians, 1989–2024, from UCDP.

## Sources

### Tier 1 — curated events
- **Dataset:** Curated genocide & mass-atrocity dataset (`genocide_curated_verified.csv`) — human-verified, with a per-row academic/institutional citation.
- **Publisher:** Compiled for this project from published scholarship and institutional records (USHMM, ICTY, ICTR/UN, ECCC, TRC South Africa, Lancet, PLOS ONE, and named academic monographs — see each row's `source` field).
- **URL:** Sources are cited per event in the data file; representative references include Hilberg, *The Destruction of the European Jews* (Yale, 3rd ed.); Kiernan, *The Pol Pot Regime* (Yale, 2004); Olusoga & Erichsen, *The Kaiser's Holocaust* (Faber, 2010); ICTY *Prosecutor v. Krstić*.
- **Year range:** 1838–2025
- **License:** Compiled from published academic sources; cite individual rows.
- **Accessed:** 2026-06-04 (North American indigenous entries added 2026-06-11)
- **Indigenous genocides (added 2026-06-11):** three self-arc entries (perpetrator state = location of the victim nations): California Genocide 1846–1873 (Madley, *An American Genocide*, Yale 2016 — 9,492–16,094 direct killings; mid = midpoint of Madley's range); Trail of Tears 1838–1839 (Thornton 1984 *Ethnohistory* / 1987 — 2,000–8,000 deaths, ~4,000 commonly cited per Mooney); Canada Indian Residential Schools 1883–1996 (TRC of Canada Final Report 2015, Vol. 4 — 3,201 confirmed deaths, Sinclair estimate likely >6,000; TRC wording is "cultural genocide", recognized as genocide by the House of Commons in Oct 2022).
- **Contested events (added 2026-06-15, flagged):** three more, with their figures explicitly marked contested per the curated-but-flagged policy. (1) **Australian Frontier Wars** 1788–1930 (self-arc, AUS) — Reynolds: ≥20,000 Aboriginal deaths nationally; Evans & Ørsted-Jensen (2014): ≥65,180 in Queensland alone (66,680 incl. settlers); see *Speculating about genocide: the Queensland frontier 1859–1897*, Australian Economic History Review (doi:10.1111/aehr.12278) — no single agreed national figure, confidence **low**. (2) **East Timor (Indonesian occupation)** 1975–1999 (IDN → TLS) — CAVR *Chega!* Report (2005) / HRDAG: minimum 102,800 (±11,000) conflict-related deaths, possibly up to 200,000; confidence **high**. (3) **West Papua (Indonesian rule)** 1963–present (self-arc, IDN) — toll **contested**, no rigorous demographic study; advocacy and some academic sources (Yale Law/Lowenstein 2004; Anderson 2015, *Griffith Journal of Law & Human Dignity*; Genocide Watch) cite up to 500,000, confidence **low**.

### Tier 2 — UCDP One-Sided Violence v25.1
- **Dataset:** UCDP One-Sided Violence Dataset version 25.1 (`OneSided_v25_1.csv`).
- **Publisher:** Uppsala Conflict Data Program, Uppsala University.
- **Citation:** Davies, Engström, Pettersson & Öberg (2025), *Journal of Peace Research* 62(4); Eck & Hultman (2007), *JPR* 44(2).
- **URL:** https://ucdp.uu.se/downloads/ (nsos/ucdp-onesided-251-csv.zip)
- **Year range:** 1989–2024
- **License:** Free for academic use with citation.
- **Accessed:** 2026-06-10

## How it is built

`pipeline/build_entanglement_genocide.py` refactors the v1 curated-genocide
logic (`build_genocide_curated.py` + the perpetrator×victim cross-product from
`atlas/js/entanglement.js`).

1. Read `data/raw/genocide_curated_verified.csv`. Each row is already an
   explicit `(event, iso3_victim, iso3_perpetrator, year_start, year_end,
   deaths_low/mid/high, source_citation, confidence, notes)` tuple, so the
   perpetrator→victim pairing is taken directly from the curated record — no
   inference is performed.
2. Normalise historical entities to modern ISO3 on the perpetrator side
   (`SUN` → `RUS` as successor state, e.g. the Holodomor). Victim ISO3 codes
   are used as authored.
3. Emit one arc per row. `deaths` is `deaths_mid` (the scholarly/geometric
   midpoint of the cited range). Where perpetrator and victim are the same
   country (a state killing its own population) the arc is flagged `self:true`;
   the layer renders these as a node halo rather than a line.
4. Sort deterministically (`-deaths`, then event, from, to) and write the v2
   arc schema. The pipeline is fully deterministic and re-runnable.
5. **UCDP tier:** keep rows with `is_government_actor = 1` (the perpetrator is
   a state, mappable to ISO3 — "Government of X"; coalition actors give each
   member the tie, with jointly-coded fatalities flagged in `notes`, never
   split). Aggregate yearly rows to one arc per (perpetrator, location):
   `deaths` = sum of yearly *best* estimates, span = first..last year. All
   UCDP arcs share the event label "One-sided violence 1989-2024 (UCDP)" and
   carry `tier: "ucdp"`.
   - **Skipped, never reattributed:** non-state actors (ISIS, LRA, … — no
     perpetrator country; 867 rows) and rows whose `location` spans several
     countries (UCDP does not split fatalities per country; 70 rows). Counts
     are recorded in `_meta.ucdp_skipped`.
   - **Considered, not used:** Rummel's 20th-century democide totals — his
     summary tables exist only as GIF images (hawaii.edu/powerkills), so
     transcribing them would violate the no-fabrication rule. Pre-1989
     coverage therefore stays with the curated tier.

```json
{ "_meta": { "source": "...", "year_range": [1864, 2025], "license": "..." },
  "arcs": [ { "from": "DEU", "to": "POL", "event": "Holocaust (Jewish victims)",
              "years": "1941-1945", "start_year": 1941, "deaths": 3000000,
              "role_from": "perpetrator", "role_to": "victim", "self": false,
              "confidence": "high", "source": "Hilberg, ...", "notes": "..." } ] }
```

## What counts (and what doesn't)

"What counts as genocide" is itself political. This dataset takes a deliberately
**curated, citation-first** stance rather than an algorithmic one:

- **Included:** events with a clear scholarly or legal basis — ICTY/ICTR/ICJ/
  ECCC adjudication (Srebrenica, Rwanda, Cambodia, the Rohingya and Gaza cases),
  widely recognised historical genocides (Holocaust, Armenian/Assyrian/Greek,
  Herero & Nama, Holodomor, Circassian), and mass killings with strong
  demographic scholarship (Great Leap Forward famine, Indonesian killings,
  Partition, Nanjing, Congo Free State, Soviet Great Terror, Apartheid).
- **Contested labels are kept, honestly.** Some entries are legally unsettled
  (Gaza 2023–2025: ICJ "plausible genocide", ruling pending) or academically
  debated (Greek Genocide, Bangladesh toll). The `confidence` field and the
  per-row `notes` record that contestation rather than hiding it.
- **Deliberately excluded** to avoid AI-fabricated or unverifiable data: the v1
  automated `genocide_mass_atrocities.csv` (PITF/EWP) pipeline, which
  `pipeline/config.py` flagged as 44/65 unverified, is **not** used here. Only
  the human-reviewed curated file feeds these arcs.

The map therefore shows a defensible, cited subset — not an exhaustive ledger of
all mass violence in history.

## Caveats

- **Death tolls are estimates with wide ranges.** `deaths_mid` is a single
  representative figure; consult `deaths_low`/`deaths_high` and the source for
  the real uncertainty (e.g. Bangladesh 300K–3M, Congo Free State 1M–5M).
- **Perpetrator attribution is simplified to one state.** Collaboration,
  occupation, and multi-actor responsibility are collapsed to a single
  perpetrator ISO3 (the Holocaust is attributed to `DEU` though many states
  participated).
- **Successor-state mapping is a convenience.** `SUN`→`RUS` assigns Soviet
  perpetration to the modern Russian Federation; this is a coding choice, not a
  legal claim about present-day responsibility.
- **Self-perpetrated events** (from === to) are not directional arcs; they are
  shown as country halos.
- **Coverage is event-based pre-1989, systematic after.** Before 1989 only the
  curated events appear; from 1989 the UCDP tier adds every government
  one-sided-violence campaign UCDP codes (≥25 civilian deaths/year threshold).
  Absence of an arc is still not evidence of absence of atrocity.
- **UCDP "best" estimates are conservative.** UCDP counts only deaths it can
  source to reports; tolls for the same events in the curated tier (e.g.
  Rwanda 1994, Srebrenica) are far higher and the two tiers deliberately
  coexist rather than being merged or deduplicated — the *Source* control
  isolates either view.
- **UCDP scope:** government perpetrators only on this layer; non-state-actor
  violence (ISIS, LRA, …) has no perpetrator country to anchor an arc.

*No AI-fabricated data. Every value traces to the source cited in the data file.*
