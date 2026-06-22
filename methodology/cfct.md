# The CFCT Composite

**What it measures.** The Conditions For Collective Trauma (CFCT) composite is a
single 0–100 reading per country of the cumulative *conditions* under which
collective trauma forms and persists — not a measure of trauma itself.

## How it is computed

```
CFCT = (CD / CD_max × 95) × (1 − 0.20 × R / 100)
```

- **CD (Conditions Density / Trauma Exposure)** — the mean across all condition
  cluster scores for a country.
- **CD_max** — the observed maximum across all countries, used to rescale so the
  worst case approaches 95 and the full range is legible.
- **R (Resilience)** — the mean across all resilience factor scores. Resilience
  *dampens* the reading by up to 20%; it buffers conditions, it does not erase them.

## What the surface selector shows

- **CFCT composite** — the dampened composite above.
- **Trauma exposure** — CD alone, rescaled by `CD_max`, before resilience dampening.
- **Resilience** — R alone (cool/green ramp).
- **Data coverage** — the share of indicators present for each country.
- **Meta-clusters** — the eight thematic groupings (Direct Violence, Structural
  Violence, Identity-Based Oppression, Interpersonal Violence & Health,
  Displacement & Environment, Wars & Perpetration, Genocide & Mass Atrocities,
  Famines & Disasters).

> **Cumulative death-toll clusters** (war, perpetration, genocide victimhood,
> famine, natural-disaster deaths) are scored **per-capita then log-compressed**
> before the 0–100 min-max. Per-capita keeps the collective-trauma framing —
> trauma as a *share of a society*, not a raw body count — so a small nation that
> lost a large fraction of its people ranks above a large nation with a bigger
> absolute toll. Log compression (`log1p`) stops a single extreme outlier from
> pinning the scale at 100 and flattening everyone else toward 0. (Corrected
> 2026-06-22: an earlier build used straight min-max with no log, which put the
> USA at ≈2 on the war layer and one small state at 100 on disasters.)

> **Missing data is shown as ABSENT, never as 0.** When a country is not present
> in a cluster's source, that cluster is left blank — it reads "no data" in the
> Country Reading and renders absent on the map, rather than being filled with a
> 0. A 0 would falsely assert "no trauma" where we simply have no measurement,
> and would drag the country's composite down. Absent clusters are excluded from
> the averages: a country's CFCT is the mean of the clusters it actually has.
> The TE rescale is anchored only to well-covered countries (≥20 of 28 clusters)
> so thin-coverage entities can't distort the global scale. (Corrected
> 2026-06-22: the source-limited clusters — war, famine, genocide, disaster,
> authoritarian rule — were previously zero-filled for uncovered countries.)

> **Genocide clusters use established indices only.** The two Genocide & Mass
> Atrocities clusters (victimhood, perpetration) are built **solely from
> recognised datasets** — UCDP One-sided Violence (1989+), ACLED civilian
> fatalities, the PITF Geno-/Politicide list (Harff, 1956+), and the TMK
> Targeted Mass Killing index (1946–2022) — not from any hand-curated list. A
> consequence: these indices are all **modern**, so pre-1946 cases (the
> Holocaust, the Armenian genocide, colonial atrocities) are **not scored in the
> composite** — there is no established per-country index that reaches that far
> back. Those histories are shown instead in the separate, beta-gated **Genocide
> entanglement layer**, which is the only place the project's curated event list
> is used. (Decision 2026-06-22: keep the composite to citable indices only.)

## Custom weighting (fixed & redesigned 2026-06-11)

The **Custom weighting** surface recomputes the full CFCT formula client-side
with your slider weights — it is not a flat mean:

```
TEw    = Σ(wᵢ · clusterᵢ) / Σwᵢ      wᵢ = the indicator's slider % (ONE flat
                                      weight vector over the 28 indicators)
Rw     = Σ(wⱼ · factorⱼ) / Σwⱼ        wⱼ = resilience slider %
TEmaxW = max TEw over all scored countries UNDER THE CURRENT WEIGHTS
CFCTw  = clip( (TEw / TEmaxW × 95) × (1 − 0.20 × Rw / 100), 0, 100 )
```

- **One flat weight vector.** The meta-cluster tab's sliders are *group
  handles*: moving one sets all its member indicators to that value (and the
  meta slider displays the group's mean). There is no hidden meta × indicator
  multiplication — the 28 indicator weights are the single source of truth.
- **The ramp stretches over your selection.** `TEmaxW` is recomputed from the
  current weights, so isolating a single indicator reads on the full colour
  range: pick *Political Terror* alone and the worst countries (Afghanistan,
  Eritrea, North Korea) sit deep red at ~86–90 (95 × their resilience
  dampener), with the full spread below — instead of half the world clipping
  at 100 against the composite's much-lower maximum.
- **Every slider at 100 reproduces the default CFCT exactly** (verified:
  painted surfaces match within ±1 RGB from 1-decimal rounding).
- Resilience sliders control the dampener (≤20%); zero them to see raw
  weighted trauma exposure.
- Countries the pipeline withholds for thin coverage (<5 indicators) stay
  *absent* under any weighting.
- Before 2026-06-11 this surface was a flat weighted mean of the visible tab's
  component scores — no rescale, no resilience dampener — so "all 100" looked
  nothing like the default. That was a bug, not a different truth.

## Source

- **Dataset:** CFCT v1 composite (`cti_scores.json`)
- **Publisher:** Conditions for Collective Trauma — v1 pipeline (`03_Prototype/pipeline/`)
- **Inputs:** World Bank, V-Dem, PTS, RSF, WHO, UNHCR, UCDP, COW, COLDAT, EPR, UNESCO, and others
- **Year range:** latest available per indicator (current as of 2024)
- **License:** derived; underlying sources retain their own licenses
- **Accessed:** 2026-06

All inputs are verified academic / institutional datasets. Clusters with no
validated source are marked **absent** rather than imputed. No AI-fabricated
data enters the pipeline.

## Why equal weights

All 28 condition clusters carry equal weight, and likewise the 14 resilience
factors — a deliberate choice, not an oversight:

- Absent strong theory for *importance*, equal weighting is the standard,
  legible default for composite indices (cf. the HDI; OECD/JRC Handbook on
  Composite Indicators). The custom-weighting panel is the sensitivity
  analysis: any reader can test how the picture moves under their own weights.
- **Reliability weighting was considered and rejected.** Weighting clusters
  by how well they are measured (source count, coverage) would systematically
  down-weight exactly the under-documented traumas — colonial-era violence,
  indigenous dispossession, child abuse in poorly surveyed regions — because
  thinness of measurement correlates with historical marginality. That would
  encode the archive's bias into the index. Measurement quality is instead
  *disclosed* (coverage surface, per-indicator coverage chips, and the
  tooltip's "based on N of 42 components") rather than silently weighted.
- The two exceptions (women's power, belonging) carry documented internal
  sub-weights with parity benchmarks and a 30%-coverage floor; flattening
  them to equal sub-weights is under consideration since the specific
  percentages are editorial judgment, not sourced.

## Caveats

- A country shaded *absent* means missing data, not the absence of conditions.
- Cross-country comparison is bounded by uneven coverage — read coverage alongside.
- The composite flattens lived experience into a number. It is a lens, not a verdict.

## License

Derived composite. The CFCT score and code are part of this project; each
underlying indicator retains the license of its original publisher (see the
source list above). Cite the original sources when reusing component values.

---

*Source: v1 pipeline (`03_Prototype/pipeline/`), output `cti_scores.json`.
Methodology brief: `03_Prototype/docs/`.*
