# Navigate, narrow, choose

**Date:** 2026-08-05
**Status:** approved, ready to plan
**Scope:** the Building Lens surface only. Legacy FindIt (`BuildingLensEnabled === false`) is untouched.

## The measurement

Taken from the live game at 1280×720, root catalog open on the zoning view.

Panel is **718 × 625** at y=11. Its bands:

| band | height | what it selects |
|---|---|---|
| `topBar_shF` — search, lens toggle, count, close | 36 | — |
| `lensModeBar_CTt` — Catalog │ Tools | 25 | mode |
| `rowCategoryBar_DS3` — 5 icons | 27 | scope |
| `asset-category-tab-bar_IGA` — 13 icons | 27 | category |
| `families_AI8` — 4 icons | 27 | zone family |
| **chrome** | **142 (23%)** | four nested selection levels |

The scrollable measures 472px with a `scrollHeight` of 472 — nothing scrolls. Content
fills **201px**, so **271px (43% of the panel) is empty** while four selector bands
consume the top.

Horizontal waste is worse than vertical: `families` puts 4 icons — roughly 110px — in
a band 707px wide. Three of the five bands are more than 80% air.

The finding that reframed the work: the panel's 13-icon category strip is

```
Parking, Electricity, Water, Healthcare, Police, FireSafety, Education,
Communications, Garbage, Transportation, Landscaping, ParksAndRecreation, StarAll
```

which is the game's own bottom toolbar strip — visible on screen at y=647 at the same
time, 16 icons wide. The mod redraws the vanilla toolbar inside its own panel, one band
below its own scope bar, one band below its mode bar.

## The diagnosis

Two distinct problems wearing the same costume.

**1. Duplicate navigation.** The category strip restates a control the player already
has, permanently, for 27px.

**2. Filters drawn as tab strips.** `scope` and `family` both narrow the result set —
they are filters, exactly like Role or Cost. They only look like navigation because
they were rendered as tab strips. That grammar has two costs:

- **A permanent 27px band per dimension.** Asset pack is a dimension. Theme is a
  dimension. Each new one costs another band.
- **Exclusivity by construction.** A tab strip cannot express *Office **and**
  high-density*. Filters that should compose cannot.

The second cost is the one that matters against the stated constraint — dozens of
zones and hundreds of utility and landmark buildings once DLC and mods are counted.
Dimensions keep arriving; the current grammar makes each arrival cost chrome and
forbids combination.

There is also a data argument against the family strip specifically. Office zones are
`AreaType.Industrial` carrying `ZoneFlags.Office`, and density cuts across all four
families. A strip that says "pick exactly one of R/C/I/O" asserts a structure the data
does not have.

## Loci of control

Six places to click become four, each with exactly one job:

| locus | question it answers | gesture |
|---|---|---|
| **Bottom bar** (vanilla) | *where am I* | navigate — exclusive, one category |
| **Top bar** | *what is this* | identify, search, switch view |
| **Chip row** | *how is it narrowed* | narrow — additive, composable, removable |
| **Content** | *what do I place* | choose |

Three verbs: **navigate, narrow, choose.** Today the first two are the same gesture —
clicking an icon in a strip — which is why adding a filter dimension feels like adding
a navigation level, and why the access path reads as obtuse.

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ 🔍 search    [Zones ▾]   Catalog│Tools    44        ✕     │ 36
├──────────────────────────────────────────────────────────┤
│ ⊕  [Office ×] [High density ×] [< ₡50k ×]      Clear     │ 27   wraps only when filtered
├──────────────────────────────────────────────────────────┤
│                                                          │
│                        results                           │ 551
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Chrome 142px → 63px, 23% → 10%. Content 472 → 551px (+17%).**

- `rowCategoryBar` and the subcategory strip are removed as permanent bands.
- `lensModeBar` folds into the top bar — `Catalog│Tools` is 128px in a band that is
  otherwise air.
- The breadcrumb chip (`[Zones ▾]`) shows the active section and pops a grid of all
  sections on click. Same for the subcategory chip.
- `⊕` is the existing `FilterRail`, now the chip row's opener rather than a separate
  band. Its popovers already float and cost nothing in layout.

## Chip grammar

One visual form for every way the set is narrowed. A chip carries:

```ts
interface FilterChip {
  id: string;          // stable, unique across dimensions
  dimension: string;   // "section" | "subCategory" | facet group id | "metric:<key>"
  label: string;       // what the player reads
  removable: boolean;  // false for section, which always has a value
}
```

Chips are ordered **navigation first, then facets, then metric ranges**, so the
leftmost chips are the ones the navigation put there and the rightmost are the ones the
player added. Within a dimension, source order is preserved.

The section chip is never removable — there is always an active section — but it is
always clickable, which is what makes it a breadcrumb rather than a filter. Every other
chip removes on click of its `×`.

### Presets become chips

Clicking Electricity in the vanilla bar currently applies a preset filter silently: the
player sees a filtered list and no account of why. Under this grammar the preset
arrives *as* pre-populated chips:

```
⊕  [Electricity ▾] [Service building ×]
```

Visible, explained, individually removable. "Electricity buildings, but not only the
service ones" becomes one click on an `×` instead of a mystery. The preset stops being
a hidden mode and becomes a starting position.

This is also why the chip row must sit between the top bar and the content rather than
inside a drawer: it is the record of what the navigation did to you.

## Panel sizing

The 271px of empty panel is the largest single number on screen, and fixing it trades
against panel stability. Three options were considered:

- **Size to content** — zoning collapses to ~350px, more map visible. Rejected: the
  panel would change height on every keystroke, and a control that moves under the
  cursor is its own kind of bad.
- **Fixed height, denser content** — panel stays put, recovered space goes to larger
  tiles. Rejected: does not address the empty case at all.
- **Fixed floor, grow to a cap** — chosen. Never below ~400px, never above the current
  625px.

Implemented as `min-height` / `max-height` on the lens content region so short results
stop leaving a void, tall ones still cap, and the panel never jitters between the two
because both bounds are constants rather than functions of the result count.

## Components

| file | change |
|---|---|
| `domain/filterChips.ts` | **new.** Pure: build the ordered chip list from section, subcategory, facet state and metric ranges. Also `chipRemovalCommand` mapping a chip back to the trigger that clears it. |
| `mods/ChipRow/ChipRow.tsx` + `.module.scss` | **new.** Renders the rail opener, the chips, and Clear. Wraps rather than scrolls. |
| `mods/TopBar/TopBar.tsx` | In lens mode: drop `rowCategoryBar` and the subcategory container, fold the mode buttons into the top bar, render `ChipRow` as the single band beneath. Legacy path unchanged. |
| `mods/TopBar/topBar.module.scss` | Styles for the folded mode buttons. |
| `mods/BuildingCatalog/buildingCatalog.module.scss` | Content `min-height` / `max-height`. |
| `mods/ZoningHierarchy/*` | Family strip removed; family becomes a facet dimension surfaced as chips. |

`ChipRow` lives in `TopBar` so it renders between the top bar and the content. All the
state it needs is already published on `mod.id` bindings (`BuildingLensSection`,
`BuildingLensSubCategory`, `BuildingLensFacets`, `BuildingCatalogMetricRanges`), so it
binds directly rather than threading props through `BuildingCatalog`.

## Testing

Unit tests on `domain/filterChips.ts` — the only part with logic worth asserting:

- ordering: navigation chips before facets before metrics
- the section chip is non-removable and always present
- a facet group with no selections contributes no chips
- a metric range at its default contributes no chip (the `hasSelection` trap that
  previously made the rail badge read 2 with nothing filtered)
- every chip's removal command names a trigger that exists
- an unknown dimension is dropped rather than rendering a chip that cannot be removed

Rendering and layout are verified in-game against the measurements above, not in unit
tests: the numbers that matter here are computed by Cohtml.

## Risks

- **Discoverability of section switching.** Removing the strip means the only in-panel
  path to another section is the breadcrumb popover. Mitigated by the chip carrying a
  visible `▾` and by the bottom bar remaining a first-class entry point — but this is
  the change most likely to need revisiting after play.
- **Chip row wrapping.** With many filters active the row grows, eating the space it
  saved. Bounded by the fact that a wrapped row only appears once the player has
  deliberately narrowed, and it can be cleared in one click.
- **Legacy divergence.** Lens and legacy modes now have visibly different navigation.
  Accepted: legacy is upstream FindIt's UI and is not ours to redesign.

## Out of scope

Sorting, the compare tray, forecasts, the coverage overlay, and the vanilla-menu
interception itself. This changes where controls live and how they compose, not what
they compute.
