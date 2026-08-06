# Grouped views

**Date:** 2026-08-05
**Status:** approved, building
**Scope:** the Building Lens catalog. The zone catalog is named as the follow-on, not done here.

## Where this came from

The zoning view groups zones by family, then by density, and renders each leaf as
a small labelled tile in a wrapped row. Playing it, that read better than either
catalog mode — not because the tiles are prettier, but because **every name is
fully readable and the set is chunked**. The grid truncates names
("Canopy-Covered Parkl…") and the table fits about twelve rows on a screen.

That matters most in exactly the case this whole effort is aimed at: hundreds of
utility and landmark buildings per category once DLC and mods are counted.

## What each mode is for

| mode | shows | good at | bad at |
|---|---|---|---|
| **Grid** | thumbnail, name truncated | recognising a building by sight | names |
| **List** (new) | small icon, full name, wrapped | scanning a large set by name | comparing anything |
| **Table** | one row, many metrics | comparing numbers | scanning; ~12 rows a screen |

## Grouping is a primary sort key

The central decision, and the one that keeps this simple.

With paging, "group by X" and "sort by Y" cannot be independent. Grouping only
the current page splits a group across a page boundary, and then the headings
lie about what they contain. Every grouped list resolves this the same way:

> **Grouping forces a primary sort on the group dimension. The chosen sort orders
> rows within each group.**

`Group by Category · Sort by Cost ▲` means order by `(category, subCategory, cost)`.
Groups are contiguous, paging cuts cleanly, and the query engine needs one new
thing: a primary key ahead of the existing sort.

This also explains why the feature generalizes as far as it does. **The zoning
view is already an instance of it** — family → density → tiles is group-by-family
with a density sub-level. Once this lands, `ZoningHierarchy` can stop being a
bespoke component and become the generic grouped renderer pointed at the zone
catalog.

## A dimension decides its own depth

Rather than a separate "then by" control, each dimension declares the levels it
yields:

| dimension | levels | example headings |
|---|---|---|
| None | — | flat |
| **Category** | category → subCategory | `SERVICE BUILDINGS` → `Health & Deathcare` |
| Subcategory | subCategory | `Health & Deathcare` |
| Role | buildingType | `Hospital` |
| Theme | theme | `European` |
| Source | provenance, else DLC | `Base game`, `Bridges & Ports` |
| Density | zoneType | `Low`, `High` |
| Footprint | banded | `2×2`, `3×3`, `4×4+` |
| Cost | banded | `₡0–5k`, `₡5–25k`, `₡25k+` |

Category yielding two levels is what keeps it useful after navigation: once
you have navigated *to* Service Buildings, a single `SERVICE BUILDINGS` heading
would be noise, but the subcategory level underneath still chunks the set.

**Default is Category**, so the feature is visible without being sought.

**Array-valued dimensions are excluded**: asset packs, placement flags,
extensions. An entry belongs to several, so it would appear under several
headings and the group counts would exceed the result total. That is a real
design question — duplicate, or pick a primary — and defaulting to either answer
badly is worse than leaving it out of the first version.

**Numeric dimensions band** rather than emitting one heading per distinct value.
Thresholds live in the domain module and are asserted in tests, because the C#
ordering and the UI headings must agree or a group will appear to be sorted
wrongly.

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ 🔍 search   [Zones ▾] [All types ▾]   Grid│List│Table  ✕ │
├──────────────────────────────────────────────────────────┤
│ ⊕  [chips…]                                              │
├──────────────────────────────────────────────────────────┤
│ Group by Category ▾        Sort by Name ▲   More sorting │
├──────────────────────────────────────────────────────────┤
│ HEALTH & DEATHCARE                                   12  │
│ [◱ Medical Clinic] [◱ Hospital] [◱ Cemetery] …           │
│ EDUCATION & RESEARCH                                  8  │
│ [◱ Elementary School] [◱ High School] …                  │
└──────────────────────────────────────────────────────────┘
```

Group-by sits **beside Sort**, not in the chip row. Sort and group are both
"how the set is ordered"; chips are "how the set is narrowed". Keeping that
distinction is what the chip-row rework turned on, and the sort bar already
exists so this costs no new band.

**Grouping applies to all three modes.** A grouped grid is what the zoning view
is; a grouped table is how you read "the cheapest in each category". One
grouping model, three renderers.

## Components

| file | change |
|---|---|
| `domain/buildingGroups.ts` | **new.** `GROUP_DIMENSIONS`, `groupLevelsFor(entry, dimension)`, `buildGroupedView(entries, dimension)`, band thresholds. Pure and tested. |
| `mods/BuildingList/BuildingList.tsx` + scss | **new.** The compact wrapped renderer. |
| `mods/BuildingCatalog/BuildingCatalog.tsx` | Three-way mode, group picker, grouped rendering for all modes. |
| `FindIt/Domain/BuildingCatalogGrouping.cs` | **new.** The group key projection and its band thresholds, mirroring the UI module. Tested. |
| `FindIt/Services/BuildingCatalogQueryEngine.cs` | Seed the ordering with the group keys so groups are contiguous across pages. |
| `FindIt/Domain/BuildingCatalogQuery.cs` | `GroupBy` field. |
| `FindIt/Systems/FindItUISystem.*` | `BuildingCatalogGroupBy` binding, `SetBuildingCatalogGroupBy` trigger. |

The ordering refactor is mechanical: the sort switch currently starts each case
with `OrderBy`. It becomes `ThenBy` on a seed, where the seed is the group keys
when grouping and a constant when not.

## Testing

Domain tests on both sides, because the two must agree:

- a dimension yields its declared levels, in order
- Category yields two levels; every other dimension yields one
- band edges land in the right band, on both sides of each threshold
- an entry missing the grouped field lands in one explicit "Other" group rather
  than a blank heading
- grouping is stable: equal group keys preserve the chosen sort's order
- the C# ordering places all members of a group contiguously
- group counts sum to the result total (the invariant that excludes array
  dimensions)

## Risks

- **A page boundary inside a group** shows a heading with two items under it,
  which reads as wrong even though it is correct. Solved by marking a continued
  group rather than by fighting the paging.
- **Two implementations of the same bands** can drift. Mitigated by asserting
  the same edges in both test suites; a shared source would be better and is not
  available across the boundary.

## Out of scope

Unifying `ZoningHierarchy` onto this renderer, and array-valued grouping. Both
are named above as the follow-ons they are.
