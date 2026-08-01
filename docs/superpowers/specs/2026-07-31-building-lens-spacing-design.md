# Building Lens spacing and typography design

## Status

Approved direction: balance legibility and row density. Implementation is
intentionally pending spec review.

## Context

The Building Lens replaces FindIt's vanilla asset-card presentation with a
flex-based information table. The current live panel is structurally aligned,
but the compact metric text is difficult to read and the spacing budget is not
yet explicit. Coherent Gameface does not provide reliable CSS grid/table
behavior, so the design must preserve the existing flex row/header contract.

The live default panel was measured at a 1280×720 viewport:

- catalog padding: `8rem` on every side;
- heading and sort padding: `4rem 8rem 8rem`;
- column-header padding: `5rem 34rem 3rem 8rem`;
- row gap: `3rem`;
- row-select padding: `4rem 4rem 4rem 8rem`;
- identity thumbnail gap: `7rem`;
- row/select heights: `104/100rem`;
- metric headers and values: `6.67px`; identity name/category: `10.67/9.33px`.

The `34rem` header reserve aligns the compare action and must not drift from
the row action width. Metric cells currently have no internal padding; their
fixed widths are the available readability budget.

## Goals

1. Make building names, categories, and common metrics readable without
   sacrificing the ability to scan several rows at once.
2. Preserve a single ordered column contract at every width:
   `Identity | Cost | Upkeep | Workers | Capacity | Lot | Level | Parking | Compare/Place`.
3. Keep header, identity, metric, and action edges aligned after padding or
   typography changes.
4. Keep the world and native HUD visible; do not solve density by allowing the
   panel to cover the viewport.
5. Preserve full metric labels/values through tooltips when compact labels or
   ellipsized values are displayed.

## Non-goals

- No second catalog/index or backend binding is introduced.
- No horizontal scrolling of the table is introduced.
- No height resize preference is added in this pass.
- The vanilla FindIt grid keeps its existing sizing when the Building Lens is
  disabled.

## Adaptive spacing tiers

The panel width is the existing outer width, including the 35-unit FindIt
chrome. The UI derives a visual density tier from the bound outer width; the C#
setting and resize math remain unchanged.

| Tier | Outer width | Spacing | Typography and labels |
| --- | ---: | --- | --- |
| Compact | 735–799 | The catalog, heading/sort, capacity-filter, and compare shells use `6rem` horizontal padding; the table header and row keep the `8rem` identity gutter and `34rem` action reserve. Row/select height is `92/88rem`; row gap is `2rem`; identity gap is `6rem`. | Metric values use the compact token. Headers use the fixed compact labels `Cost`, `Upk`, `Wkr`, `Cap`, `Lot`, `Lvl`, `Park`; `title` attributes and metric tooltips retain the full localized labels and values. |
| Default | 800–999 | Catalog padding `8rem`; heading/sort remain `4rem 8rem 8rem`; row/select height `104/100rem`; row gap `3rem`; identity gap `7rem`; preserve the shared gutters. | Metric values use `fontSizeXS`; headers remain short enough to fit their fixed columns; full labels are available on hover. |
| Expanded | 1000–1235 | Keep the default outer gutters and row rhythm; use available width for identity and the compare inspector rather than adding arbitrary cell padding. | Full metric headers and values are preferred; identity text may expose more of its name/category before ellipsizing. |

The tier boundaries are deterministic and based on the same width binding used
by the resize handle. They do not depend on viewport pixels, so the contract
survives supported UI-scale changes.

## Shared alignment and padding contract

- The column header and each row use identical `gap` and fixed metric bases.
- The identity cell always starts at the `8rem` left gutter in default and
  expanded tiers; compact reduces only the catalog/section shell padding, not
  the identity anchor.
- The header keeps `34rem` of right padding for the compare/place action. The
  row action keeps its current fixed width, so the header's final metric edge
  cannot drift when labels change.
- Metric cells receive no new horizontal padding. Centering plus the fixed
  width gives predictable alignment; extra padding would reduce the usable
  text box and create earlier ellipses.
- Identity thumbnail-to-text spacing is `6–7rem` according to tier. The
  thumbnail remains centered in its existing box and the name/category lines
  remain vertically centered inside the row-select content box.
- Shell/section padding is reduced only in Compact. The table's identity anchor
  and action reserve are exceptions and remain fixed so the header and rows do
  not drift. Row vertical padding is reduced with the Compact row height; the
  title/category line boxes remain distinct and never overlap.
- The compare tray follows the section shell padding and keeps its action
  buttons outside the identity text flex region.

## Typography and formatting

- Metric headers and values move from `fontSizeXXS` to the tested
  `fontSizeXS` token in Default and Expanded tiers. Compact keeps
  `fontSizeXXS` for both to protect the fixed-column budget.
- Compact header labels are abbreviated in the presentation layer; their
  `title` attributes and metric cell tooltips remain full-length.
- Numeric values always use the existing locale-aware formatter; this pass does
  not introduce abbreviated or rounded display values. If a value cannot fit,
  it ellipsizes in the cell while the full value remains in the tooltip.
- Identity name and category tokens remain unchanged until the metric change
  is measured against vanilla. This keeps the main hierarchy stable while the
  metric columns become easier to scan.

## Implementation boundaries

1. Add a pure UI layout helper with a `getBuildingLensDensity(outerWidth)`
   function that maps the outer panel width to the Compact, Default, or
   Expanded tier and exposes that tier's spacing/label policy.
2. Bind `PanelWidth` directly in `BuildingCatalogComponent`, add the existing
   `BUILDING_LENS_PANEL_CHROME_WIDTH`, and derive the tier from that outer
   width. This avoids prop churn while keeping the helper independent of the
   C# width clamp; do not duplicate clamp logic in the helper.
3. Express tier spacing through existing CSS-module classes or custom
   properties supported by Gameface. Avoid CSS grid, `:not()`, and modern
   browser-only features.
4. Keep the C# resize triggers and persisted setting unchanged unless a live
   test demonstrates a binding mismatch.

## Verification plan

### Browserless

- Test the pure tier mapping at widths 735, 799, 800, 999, 1000, and 1235.
- Test compact label presentation, locale-aware value formatting, and full
  tooltip values.
- Run the existing UI contract suite and webpack build.

### Live Gameface

- At the default 1280×720 scale, capture computed padding, font sizes, and
  bounding rectangles for the header, first row, identity cell, metric cells,
  and compare action.
- Verify no header/row edge drift at minimum, default, and maximum widths.
- Verify the first two identity lines remain distinct and visible at every
  tier; verify metric values do not paint into neighboring columns.
- Confirm the world/HUD remains visible around the panel and that the final
  screenshot has no successor console exceptions.
- Restore the user's saved width and alignment after the check.

## Risks and mitigations

- **Metric text still clips at Compact:** abbreviate labels and retain full
  value tooltips; allow values to ellipsize without changing the data or
  shrinking identity below its anchor budget.
- **A larger token causes column overlap:** widen only the affected fixed
  metric basis within the existing minimum/maximum panel contract, then rerun
  the edge-alignment checks.
- **Gameface rejects a CSS feature:** fall back to explicit CSS-module tier
  classes and flex properties already used by the successor.
- **Live boot instability:** use the full launcher chain when the cached-token
  path reproduces the known AssetDatabase loop; never treat a pre-UI boot error
  as a Building Lens runtime failure.
