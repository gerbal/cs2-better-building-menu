# Building Lens layout concept

The Building Lens is the information surface for the FindIt successor. FindIt
remains the discovery and placement shell; the lens makes the decision about
which building to place faster and more legible than the vanilla card grid.

## User goals and path

1. Open FindIt from the toolbar or `Ctrl+F`.
2. Search, choose a category/subcategory, or use the existing sort and filter
   controls to narrow the indexed catalog.
3. Scan aligned rows without opening each building: identity stays at the
   left, while cost, upkeep, workers, capacity, lot, level, and parking are
   comparable columns.
4. Select a row for the normal FindIt placement flow, or add up to three rows
   to the compare tray and place directly from the selected entry.
5. Keep the panel open while placing, picking, locating, or returning to the
   catalog. The world and native HUD remain visible around the bounded panel.

## Panel modes

All widths are outer panel units, including the existing 35-unit FindIt panel
chrome. The C# setting stores the inner content width, so the user preference
survives reopening and alignment changes.

| Mode | Width | Purpose | Column behavior |
| --- | ---: | --- | --- |
| Compact | 735 (minimum) | Narrow screens and quick lookup | Stable identity, short metric labels/values, and actions; long text ellipsizes with a tooltip. |
| Default | 800 (initial persisted value) | Normal comparison | All common metrics are visible in the flex table; the bounded body scrolls while the header and actions stay visible. |
| Expanded | 1,235 (maximum) | Deliberate comparison | Full metric labels/values and the compare inspector have room; this is reached with the existing expand command or the resize handle. |

The existing FindIt grid keeps its vanilla sizing rules when the lens is off.
The lens uses a flex-based row/header contract because Coherent Gameface does
not provide reliable CSS grid/table behavior.

## Row/header contract

The header and every row use the same ordered columns:

`Identity | Cost | Upkeep | Workers | Capacity | Lot | Level | Parking | Compare/Place`

Identity contains the thumbnail, building name, and category. Metric cells are
fixed-width, centered, and independently ellipsized; their full value remains
available through the cell tooltip. Compare and Place are action cells and do
not move when metric text changes.

## Resize and visibility rules

The handle changes width only while the Building Lens is enabled. Left and
right alignments move one edge; centered alignment moves both edges, so a
pointer delta changes width twice as much. Width is clamped to 735–1,235,
committed on pointer release, and persisted through `BuildingLensPanelWidth`.
Height is intentionally bounded by the existing panel/scroll layout; a later
iteration may add a height preference only if it does not cover the world or
native HUD. The compare tray should remain collapsible and bounded rather than
stealing the catalog's scroll height.

At smaller UI scales, compact labels and ellipsized values preserve the column
contract. At larger scales, the same columns expand with the panel and expose
more text; no control relies on an absolute screen pixel size.
