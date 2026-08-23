# Zoning: density tiers as navigable categories

Design, 2026-08-23. Bead: `cm-2xvs.16`.

The bead asks for density subgrouping in grid, list and cards. This design goes
further on the same problem: the tier becomes a destination in the category
strip rather than a heading inside the results, which is what the strip's
existing school-tier and dev-tree-branch substitutions already do for other
axes.

## The problem, measured

With content packs loading, the Zones menu holds 74 entries and the Residential
category alone holds 52 of them, drawn as one flat alphabetical wall. Because
every zone's display name leads with its theme prefix, alphabetical order
clusters by theme rather than by tier, and the grid truncates the names that
would distinguish them:

```
CN Low Densit…ous…   CN Low Densit…ous…   CN Low Rent Housing   CN Medium Densit…
```

The player is looking for a density tier. Nothing in the view is sorted by one.

## What is actually in the way

The bead assumed the renderer was the gap. It is not.

**Both presentation layers already do this.** Grouping the Zones menu by "Asset
type" today renders a working two-level hierarchy — `ZONES 78` with nested
`Commercial Zones 8`, `Office Zones 6`, `Residential Zones 63` — through
`GroupedResults`' `renderNodes` recursion and `.groupHeadingNested`; C# already
carries `PrimaryKey`/`SecondaryKey`, with the secondary wired for the depth-2
`category` dimension. And the category strip already substitutes a category's
sub-tabs for the category itself, for school tiers and dev-tree branches (see
Navigation below, which is the route this design takes).

**The blocker is that zone entries carry no density.** Read live from the
running catalog, all 74:

```
ZonesResidential | Zones     | Zones_Residential     | zoneType 0   52
ZonesCommercial  | Zones     | Zones_Commercial      | zoneType 0    6
ZonesIndustrial  | Zones     | Zones_Industrial      | zoneType 0    1
ZonesOffice      | Zones     | Zones_Office          | zoneType 0    6
ZonesExtractors  | Buildings | Buildings_Specialized | zoneType 0    9
```

`ZonePrefabCategoryProcessor.TryCreatePrefabIndex` sets `Category` and
`SubCategory` and never touches `ZoneType`, so every zone ships `Any`. That is
also why **Density is not even offered** in the Group-by picker:
`groupDimensionsFor` drops a dimension whose sampled entries all share one
level, and they do. The Zone filter facet is empty for the same reason.

The derivation itself already exists and is good — `IndexZones` computes a tier
from real `ZonePropertiesData`, with a prefab-name fallback — but it writes to
`ZoneCatalogEntry.Density`, which fed the zoning surface that was deleted. Its
TS counterpart, `zoneAsCatalogEntry`, is tested and has no production callers.

The work is therefore: route an existing tier onto the entries the menu renders,
give it a rank, a label and an icon, and make it a destination in the category
strip.

## The tier vocabulary

Six tiers, and they are the words the game already uses. Display names from the
live catalog, theme prefixes stripped:

```
Low Density Housing        (+ Courtyard, Modern, Traditional, Waterfront,
                              Basic, Classic, Gable-Roof, Gambrel-Roof,
                              Detached, Semi-Detached, Terraced)
Medium Density Housing
Medium Density Row Housing
High Density Housing
Mixed Housing              (+ Mixed Old Town-Style Apartment Buildings)
Low Rent Housing
```

`ZoneTypeFilter` gains `Mixed = 32` and `LowRent = 64`. Existing members keep
their values, so building-side classification is untouched.

Commercial and office are in scope and already resolvable: all twelve carry the
tier in the prefab name (`EU Commercial High`, `Office Low`, `USSW Office Low`).
Note they depend on the name **entirely** — the `ZonePropertiesData` derivation
returns `Any` whenever `m_ResidentialProperties <= 0`, so it never fires for
them. `ZoneData.m_MaxHeight` is a plausible data-derived alternative and should
be evaluated during implementation rather than assumed.

Industrial (one zone) and the nine extractor areas have no tier and stay `Any`.

### Order

```
Low  →  Row  →  Medium  →  Mixed  →  Low Rent  →  High
```

Decided by the user. Two facts behind it: row housing unlocks at milestone 1,
before medium at 2 — confirmed against the live catalog — and Low Rent Housing
is high-density affordable housing, so it belongs beside High rather than
beside Low.

Unlock milestones, read from the running catalog:

| Tier | n | Milestones |
|---|---|---|
| Low | 27 | 0, 4 |
| Row | 6 | 1 |
| Medium | 11 | 2 |
| Low Rent | 5 | 4 |
| Mixed | 13 | 0, 5 |
| High | 13 | 8, 9, 10 |

The rank is a **static table**, not computed from these at runtime: pack content
ships ungated, so Low spans `0,4` and Mixed spans `0,5`, and ranking by observed
minimum milestone would tie Mixed with Low.

That Low Rent is high-density has a direct consequence for the classifier, and
the probe confirmed it: the ratio derivation calls all five of these zones
`High` today, so the Low Rent test must run **before** it and override it. The
existing name-stem table gets it wrong in the other direction — its stems are
`Row, Low, Medium, High` in that order, so `"LowRent"` matches `Low` and lands
in the low-density bucket. Those five are the only zones in the whole catalog
where the data-derived and name-derived tiers disagree, apart from
`Residential Medium`; both cases are covered under Classification.

## Classification — measured

Probed on 2026-08-23 with an instrumented boot over all 88 zone prefabs,
logging `m_IgnoreLandValue`, `m_AllowedSold`, `m_ResidentialProperties`,
`m_SpaceMultiplier`, `m_ScaleResidentials`, the derived density, the name-stem
density, max lot width and `m_MaxHeight`. Both original guesses were wrong in
different ways and the probe replaced them.

```
1. Mixed     family is Residential AND m_AllowedSold != 0
2. Low Rent  family is Residential AND m_ScaleResidentials
                                   AND m_ResidentialProperties / m_SpaceMultiplier >= 3
3. Low / Row / Medium / High       the existing ratio and lot-width derivation
4. Prefab-name stems               commercial and office only
```

**Mixed — confirmed exactly.** Thirteen residential zones carry
`m_AllowedSold != 0` and all thirteen are the Mixed Housing zones: no false
positives, no misses. ("UK London Townhouse" matches a naive `townhouse` name
test but has `m_AllowedSold = 0` and is a plain High zone — the data is right
where the name is misleading.)

**`m_IgnoreLandValue` is dead.** It is `False` on all 88 zones, so it marks
nothing. Recorded here so it is not tried again. `ZoneFlags` was checked too and
has no low-rent bit — it is only `SupportNarrow`, `SupportLeftCorner`,
`SupportRightCorner`, `Office`.

**Low Rent is a ratio, and the ratios are discrete.** Among residential zones
with `m_ScaleResidentials` and no commerce:

| ratio | n | tier |
|---|---|---|
| 0.5 | 6 | Row |
| 0.75 | 12 | Medium |
| 2.0 | 8 | High |
| 2.5 | 1 | High (UK London Townhouse) |
| **4.0** | **5** | **Low Rent** |

A threshold of 3 sits in the middle of the 2.5 → 4.0 gap. That is a real
margin, not a hairline — and it is the mechanic rather than a coincidence: low
rent means four properties in one unit of space where high density means two.

**The `m_ScaleResidentials` guard is load-bearing.** Without it the rule also
catches "UK Residential Low Terraced", whose ratio is 3.0 — but the existing
derivation checks `m_ScaleResidentials` *before* the ratio and correctly calls
it Low. Ordering the new test the same way removes the false positive.

Cross-check: the data rule and a `low ?rent` prefab-name test select **the same
five zones**, exactly. Assert both in the tests; a future disagreement is a
signal that shipped content has changed, not a failure to paper over.

### The result is an exact partition

```
Residential  n=67   Low 22 · Row 7 · Medium 11 · Mixed 13 · Low Rent 5 · High 9
Commercial   n=10   Low 7 · High 3
Office       n=6    Low 2 · High 4
Industrial   n=5    untiered
```

Nothing outside Industrial lands untiered — which is what the strip
substitution needs (see Navigation). The three zones that carry no tier word in
their name are all placed by the data: "StarQ Single Family Residentials" → Low
(ratio 1.0), "NA San Francisco" → Low (ratio 2.86, `m_ScaleResidentials` false),
"UK London Townhouse" → High (ratio 2.5).

One weakness worth knowing: `Residential Medium` has no indexed spawnable
buildings, so `maxLotWidth` is 0 and the row-housing test's documented fallback
("a zone with no spawnable buildings at all stays row") files it as Row where
its name says Medium. It is the only disagreement between data and name across
all 67 residential zones other than the five Low Rent ones. Left as-is: it is a
pre-existing behaviour of the shared derivation, not something this change
introduces.

The derivation moves into one place that both `IndexZones` and
`ZonePrefabCategoryProcessor` call, so the zone catalog and the prefab index
cannot drift into two answers about the same zone.

### Indexing order — verified, safe

`GetZoneType` fails soft to `Any` when its cache is cold, which would be
indistinguishable from today's bug. Traced:

- `OnGameLoadingComplete` → `RunIndex(true)` (`PrefabIndexingSystem.cs:213`)
- inside `if (full)`: `IndexZones()` at `:401`, which assigns `_zoneTypeCache`
  at `:2480`
- the processor loop starts at `:408`; `TryCreatePrefabIndex` is called at `:492`

So 401 → 2480 → 408 → 492: the cache is fully populated before any processor
runs. The decisive evidence is an existing caller at the same point —
`ZonedBuildingPrefabCategoryProcessor.cs:154` already calls `GetZoneType` from
its own `TryCreatePrefabIndex`, and zoned buildings already ship non-`Any`
values through it.

One hole worth recording: `RunIndex(false)` from `OnUpdate` (`:297`) does not
call `IndexZones`, so a zone prefab created during an incremental pass is absent
from the cache and reads `Any` until the next full index. `_zoneTypeCache` is
static and never cleared, and `Enabled` is false until after the first full
pass, so a cold cache cannot occur. Out of scope; noted so it is not
rediscovered as a bug.

## Ranking and labels

This is larger than it first appeared, because **there is no existing mirror to
follow and the density grouping is already degraded.**

`BuildingCatalogGrouping.cs:117` ranks Density as
`entry.ZoneType.ToString().PadLeft(3, '0')` — the raw enum number as text. It
orders correctly today only by coincidence of the flag values, and `Mixed = 32`
and `LowRent = 64` would sort after `Signature = 16`, at the far end. On the TS
side `buildingGroups.ts:539-544` emits `String(entry.zoneType)`, so the Density
grouping's headings read literally `"0"`, `"1"`, `"2"`, `"4"`, `"8"`, `"16"`.
That has never been seen because the dimension is always filtered out of the
picker.

So this work introduces the rank and the labels rather than extending them:

- an explicit rank table in `BuildingCatalogGrouping`, replacing the raw
  numeric key
- a matching label + order table in `buildingGroups.ts`, replacing
  `String(entry.zoneType)`
- both asserted in their own suite, against the same literals — which is all
  the "mirror" for cost and footprint bands ever was. Neither suite reads the
  other's file; the comments in both files say so outright.

`zoningHierarchy.ts`'s `DENSITY_ORDER` is a third, name-keyed order with no C#
counterpart, asserted nowhere, and reachable only through the dead
`sortZonesForDisplay`. It should be reconciled with the new table or deleted
with its unused callers.

### Labels and assets needed

`ZoneTypeOption.cs` projects its filter chips from a hand-built
`Dictionary<ZoneTypeFilter, string>` of icons, **not from the enum**, so a
member with no entry is silently invisible — no crash, no placeholder, the chip
simply never appears. Two new icons are required and no existing asset is close:
`Icons/Standard/` has `LowLevel`, `MediumLevel`, `HighLevel`, `Row` and nothing
for mixed use or low rent.

Locale keys are built as `$"Zone{member}"`, so `ZoneMixed` and `ZoneLowRent` are
needed in `Locale.json` (which today has `ZoneLow, ZoneRow, ZoneMedium,
ZoneSignature, ZoneHigh`) and in the eight files under `Locale/`.

## Navigation: each family+tier is its own tab

A tier is not a sub-heading buried in the results — it is a destination. Each
(family, tier) pair becomes its own category in the strip, with its own icon:

```
Residential  Low · Row · Medium · Mixed · Low Rent · High
Commercial   Low · High
Office       Low · High
Industrial   (no tier)
Extractors   (no tier)
```

Twelve tabs where there are five today, and the 52-item Residential wall becomes
six aimed choices.

### The pattern already exists, twice

`MenuCategoryStrip` already replaces a category with its own sub-tabs, in place
and in the same row:

- **School tiers** — four ranks of school drawn instead of the Education
  category, `src={tier.icon || category.icon}`
- **Dev-tree branches** — `expandedTabs` for the expanded category, one tab per
  branch with its own icon

The school-tier comment also states the condition this design has to meet:

> They partition that category exactly — ten schools, 3/3/1/3 — so nothing is
> lost by drawing them instead of it, and a separate tier segment would have
> asked the player to combine two rows to reach what one row can say.

Density partitions Residential the same way, and the probe confirmed it: all 67
residential, 10 commercial and 6 office zones land in exactly one tier, with
nothing untiered outside Industrial. The three zones that worried this section
in draft — "Single Family Residentials", "NA San Francisco" and "UK London
Townhouse" — are all placed by the data. See Classification above.

The dev-tree branches take the other half of the precedent: they carry no
numeral because "each unlock ships its own icon, so the tabs are already told
apart by what they are". Density icons differ too, so no numeral — once Mixed
and Low Rent have icons.

### What has to change

The strip's own `flatMap` already branches per category, so the rendering is
close to free. Two gaps:

1. **The producer is dev-tree-specific and expands exactly one category.**
   `BuildingCatalogAdapter.GetExpandedCategoryId` filters on
   `!string.IsNullOrEmpty(entry.DevTreeBranch)` and ends in `FirstOrDefault` —
   one category, chosen by size. This design needs three expanded at once
   (Residential, Commercial, Office). The binding pair
   `BuildingLensExpandedCategory` / `BuildingLensExpandedTabs` becomes a map
   from category to its tabs, and the axis becomes a parameter rather than
   being hard-coded to the dev tree.
2. **Icons.** `Icons/Standard/` ships `LowLevel`, `MediumLevel`, `HighLevel`
   and `Row` — which only make sense as tier navigation, so the project already
   anticipated this. Nothing exists for Mixed or Low Rent, and
   `Icons/Colored/`'s nearest candidates read as neither.

### This replaces the nested heading

The tier is the tab, so `menuCategory` stays depth 1: no `SecondaryKey` change,
no second heading level, no `groupLevelsFor` change. `density` is already a
depth-1 group dimension, so the grid can group by it within a family the way the
education menu defaults to `schoolTier`.

An earlier draft of this design proposed a nested level plus a rule collapsing
any level with a single child. Recording why that rule is gone, so it is not
proposed again: it was **unnecessary**, since `shouldShowHeading(nodes)` is
`nodes.length > 1` and already suppresses a lone child's heading — confirmed
live, where grouping by "Asset type" renders `BUILDINGS 9` followed directly by
nine tiles with no sub-heading. And it was **harmful**:
`buildingGroups.test.ts:428`, "still labels the level below a lone parent", is a
regression test for a reported play bug — *the table reordered into Roads,
Bridges and Tracks and named none of them* — which the collapse would
reintroduce.

### Interaction with the strip's own scale problem

`cm-2xvs.22` is open because the strip already becomes three rows of ~60
unlabelled icons at pack scale. Twelve tabs inside the Zones menu is a long way
from that and is not the case that bead is about, but this design does push in
the direction of more tabs, and whatever `cm-2xvs.22` decides about overflow has
to hold for these too.

### What this earns elsewhere

The same change makes the Zone filter facet non-empty for the Zones menu and
makes Density selectable in the Group-by picker for the first time, both of
which are inert today for the one reason.

## View modes

The strip sits above all four, so the navigation lands everywhere at once.
Grouping within a selected tab reaches all four the same way it does today:
grid, list and cards render through `GroupedResults`, the table through
`flattenGroupedRows`, and both call the same `buildGroupedView` and
`shouldShowHeading`.

## Out of scope

- Tile labels still truncate to `CN Low Densit…ous…`, so within a tier the
  theme prefix is the only distinguishing text. Grouping by tier makes the
  redundant tier words in the label more obviously wasteful, but shortening
  them is separate work.
- Building-side zone classification is untouched. Buildings never receive
  `Mixed` or `LowRent`.
- The dead `zoneAsCatalogEntry` / `sortZonesForDisplay` pair and their tests.

## Verification

- Backend unit tests for the classifier across all six tiers plus untiered,
  built from the probe's real values. The cases that would have shipped a bug:
  a `LowRent` zone at ratio 4.0 proving it is not left as High; "UK Residential
  Low Terraced" at ratio 3.0 with `m_ScaleResidentials` false proving the guard
  is present; "UK London Townhouse" proving a name test for `townhouse` does
  not pull it into Mixed; and the `m_AllowedSold` case proving Mixed wins over
  the ratio.
- The data rule and the `low ?rent` name test select the same five zones.
- The partition: every residential, commercial and office zone lands in exactly
  one tier, and only Industrial is untiered. Counts per family from the probe
  are in Classification above and are the expected values.
- Rank tables asserted in both suites.
- In game, with packs loaded: the Zones strip shows Residential's six tiers in
  the decided order, Commercial's two and Office's two, with Industrial and
  Extractors unexpanded; the counts across the tier tabs sum to their family's
  old count; every other menu's strip is unchanged, Signatures included.
- Each guard must be confirmed to **fail** against the pre-change code. Two
  guards in this codebase have passed on the bug they named
  (`uniqueMarkScale`, `vectorEffectSafety`); a green new test proves nothing on
  its own.
