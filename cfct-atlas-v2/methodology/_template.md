# <Layer name>

**What it measures.** One or two sentences. What does a single arc (or a shade,
for a surface layer) represent here? State the unit of the `value` field.

## Source

> The bullet list below is lifted into a styled citation block in the
> methodology panel. Keep each line as `**Key:** value` — the renderer turns the
> keys into labels. Do not rename the keys.

- **Dataset:** <name, version / release>
- **Publisher:** <institution>
- **URL:** <verifiable link>
- **Year range:** <e.g. 1990–2024>
- **License:** <e.g. CC-BY 4.0 / Open / public domain>
- **Accessed:** <YYYY-MM-DD>

## How it is built

Brief description of the pipeline step (`build_entanglement_<x>.py`): what is
parsed, how ISO3 normalisation is applied, how values are aggregated, and the
output schema.

```json
{ "_meta": { "source": "...", "year_range": [0, 0], "license": "..." },
  "arcs": [ { "from": "ISO3", "to": "ISO3", "year": 0, "value": 0, "type": "..." } ] }
```

## What counts (and what doesn't)

The inclusion criteria and the politics of them. Be explicit about what the data
*cannot* show — silences are part of the reading.

## Caveats

- Bullet the known gaps and biases.
- Note any modelled / estimated values (vs directly observed).
- Note coverage unevenness across regions or years.

## Full citation

> One line, ready to paste into a bibliography.

<Author / Institution. (Year). *Dataset title* (version). Publisher. URL>

## License

<Restate the license and any attribution / redistribution terms. If usage is
restricted, say so here.>

---

*No AI-fabricated data. Every value traces to the source above.*
