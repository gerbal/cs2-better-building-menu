# Building Lens Metric Range Filters Design

**Status:** Approved design, awaiting implementation-plan review  
**Bead:** `CS-Modding-b53.24`  
**Date:** 2026-08-01

## Goal

Expose the analytical values already present in the Building Lens as bounded
numeric filters. A player should be able to narrow the catalog by cost, upkeep,
workers, capacity, or lot dimensions without changing the FindIt index or
loading an unbounded client-side list.

## Scope

The first slice contains six metrics:

- Construction cost
- Upkeep
- Workers
- Capacity
- Lot width
- Lot depth

Each metric has optional inclusive minimum and maximum bounds. Empty inputs are
unset. Cost, upkeep, workers, and capacity are normalized to finite values in
`0..1,000,000,000` with two decimal places. Lot width and depth are normalized
to integer values in `0..10,000`. Reversed bounds are swapped so a partially
entered range cannot silently produce an empty catalog.

Utilities, pollution, building level, and runtime/map-context predicates remain
follow-up work. The existing Education capacity presets and categorical facets
remain visible and continue to compose with the new ranges.

## User experience

Building Lens gains a collapsed `Metric Filters` drawer beside the existing
categorical facet control. Opening it reveals one compact row per metric with
`Min` and `Max` inputs. Labels use the same base-game/FindIt font scale as the
table headers; inputs have bounded widths and ellipsis-safe labels so the drawer
does not cover the table at the supported 1280×720 viewport.

The drawer shows an active-count marker when any bound is set and provides a
single `Clear` action. Editing a bound applies the normalized range, resets the
catalog offset to zero, and recomputes the total before paging. Clearing all
ranges restores the prior result set and leaves category, facet, search, and
sort state intact.

## Data flow and contracts

The existing `BuildingCatalogQuery` nullable min/max properties remain the
source of truth. A pure UI range contract will:

1. parse empty or invalid input as an unset bound;
2. clamp finite values to the metric's non-negative maximum and precision;
3. swap a reversed pair into ascending order;
4. serialize one flat three-string payload (`metricId`, `minText`, `maxText`)
   for the existing Gameface trigger binding; and
5. emit a page-reset command whenever a range changes.

The C# binding parses the three strings with invariant culture, updates the
query fields, and invokes the existing bounded query engine. Missing nullable
metric values do not match an active range. Existing
FindIt categories/options remain untouched when Building Lens is disabled.

The backend also publishes a normalized `BuildingCatalogMetricRangeState`
binding. The drawer is controlled by that binding rather than an independent
React-only copy, so a view recreation, category transition, or clear action
cannot leave stale values visible. The Education capacity preset remains a
separate lower-bound input; the effective capacity minimum is the greater of
the preset floor and the metric range minimum, while the metric maximum is
preserved.

## Failure handling

Invalid or blank input is treated as unset rather than throwing in Gameface.
The UI keeps the last valid normalized value visible after blur. If the binding
payload is missing or malformed, the backend ignores that range and logs the
normal binding diagnostic; it never performs a second ECS scan or returns an
unbounded result.

## Verification

Browserless UI tests cover empty input, decimal normalization, reversed bounds,
clamping, active-state counts, clear payloads, and page-reset commands. C#
tests cover each selected range against present and missing values, inclusive
endpoints, composition with categorical facets, and bounded paging. The live
check opens the drawer on the developed save, applies a capacity and cost range,
confirms the total and footer reset to page one, clears the ranges, and confirms
the original count returns with no Gameface errors. The package guard, isolated
deployment, and full backend/UI test suites must remain green.

## Non-goals

- No replacement of the existing FindIt index or placement/picker lifecycle.
- No client-side copy of all 4,000+ catalog records.
- No utilities/pollution/runtime predicates in this first slice.
- No new publisher identity or release packaging changes.
