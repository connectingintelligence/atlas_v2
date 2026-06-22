# Present-day overseas territories

A line from each administering power to a place it **still governs today**
from across an ocean — French Guiana, Réunion, Puerto Rico, Gibraltar,
Greenland, New Caledonia, the Falklands, and so on.

## Why this layer exists

The **Colonies** layer is built from COLDAT and ICOW, which only record
territories that became **independent**. They are therefore silent on the
places that never did — the territories a former imperial power continues to
administer. The world basemap compounds this: it folds most overseas
territories into the metropole's own shape (French Guiana is literally drawn
as part of "France"), so they have no separate point on the map and no arc
could ever reach them. This layer adds the missing line.

## The thesis — and the honest caveat

Read together with the Colonies and Slave-Voyages layers, these present-day
ties make the atlas's argument visible: **empire did not simply end.** Distant
sovereignty persists, and the people of these territories are still governed
from a capital thousands of kilometres away.

But "colony" is not a uniform legal fact, and the map says so. Each territory
is **tagged with its real status**, because they differ:

- **UN-listed Non-Self-Governing Territory** — on the United Nations' own list
  of territories still to be decolonised (e.g. New Caledonia, Gibraltar, the
  Falklands, Guam, Western Sahara). This is the strongest "still a colony"
  claim, made by the UN itself.
- **Integrated overseas region** — legally an integral part of the metropole,
  with the same status as a mainland region (the French *départements
  d'outre-mer* like Guiana and Réunion; the Spanish Canaries; the Portuguese
  Azores and Madeira). Their residents are full citizens and vote in national
  elections — yet they are governed from across an ocean, which is why the
  layer still shows them.
- **Autonomous country/region** — self-governing within the kingdom
  (Greenland, the Faroes, the Dutch constituent countries).
- **Dependency** and **state in free association** — the remaining range
  (Puerto Rico, the Cook Islands, etc.).

The map's neutral label is "overseas territory"; the stronger framing is this
text. We do not flatten the distinction — calling an integrated French
*département* a "colony" without qualification would be inaccurate, and the
tag tells you which is which.

## Source

- **UN list of Non-Self-Governing Territories** — UN Special Committee on
  Decolonization (C-24): https://www.un.org/dgacm/en/content/decolonization/nsgts
- **CIA World Factbook** — "Dependencies and areas of special sovereignty".
- **Natural Earth admin-0** (SOVEREIGNT vs ADMIN) for the sovereign mapping.
- Endpoint coordinates are standard published locations of each territory —
  verifiable geographic facts, not modelled values. **Nothing is fabricated.**

## How the layer behaves

- **Present-tense:** it ignores the time scrubber and the all-time toggle —
  these are ties that exist *now* (the time badge reads "Overseas territories:
  today").
- **Endpoints** are explicit `[lon, lat]` points, like the Slave-Voyages
  anchors — not modern-state centroids — so the line lands on the real island
  or coast, and a dot marks each territory (they are too small to see
  otherwise; UN-listed territories get a slightly larger dot).
- **Hue = administering power**, using the same palette as the Colonies layer
  so the two read as one story. Pinning a power (e.g. France) shows just its
  overseas ties.
- The **Scope** control switches between every present-day territory and only
  the UN-listed Non-Self-Governing ones.

## Known limits

- Built from a curated list of the major administering powers (France, the UK,
  the US, the Netherlands, Denmark, New Zealand, Australia, Spain, Portugal,
  Norway). It is not yet exhaustive — smaller or more ambiguous cases (e.g.
  China's SARs, which were *returned from* colonial powers and sit adjacent to
  the metropole) are deliberately left out as a different category.
