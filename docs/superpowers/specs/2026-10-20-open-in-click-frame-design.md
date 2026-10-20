# The build menu opens in the frame the player clicks

Design for two changes to how the asset menu opens: the UI decides on its own that the menu is
ours (A), and the catalog draws only the rows that fit (B). Builds on the kept panel
(`perf/keep-menu-built`).

## Why

A build-menu open takes 110–185 ms with BBM against 30–50 ms for the game's own menu (AZ testbed,
1080p, measured in game 2026-10-20). Two of the causes are structural, and neither is BBM's code
being slow:

- **The open waits a round trip.** C# clears `OwnsCurrentMenu` on every close. On the next open the
  game mounts its own asset menu in the click frame, BBM's watcher sends `VanillaMenuSelected`, and
  the slot replaces vanilla only when `OwnsCurrentMenu` comes back, a frame later. Meanwhile
  vanilla's grid is built (27 image loads) and was laid out with size in 3 of 3 opens, so it is
  probably drawn for one frame. A throwaway spike that rendered the slot at once for menus C# had
  owned before made reopens 106–120 → 65–69 ms (Fire & Rescue 64 → 40) with no vanilla grid.
- **The table builds ten times what it shows.** Every page holds 40 entries and every entry is
  rendered. In the table view 4 of 40 rows are on screen (92 px rows in a 372 px list); building 40
  rows costs about 61 ms of DOM, style and layout, the visible ones plus two about 6 ms. Grid, list
  and cards show 29–35 of 40, so their window is about right.

Success: a reopen in about 65 ms, close to vanilla; a switch and a first open in the table view
cheaper by the rows it no longer builds; nothing that worked stops working.

## Goals

- **A.** When the player opens a toolbar menu that BBM stands in for, the slot replaces vanilla in
  the same frame, and vanilla's grid is never built.
- **A.** When the kept panel already holds that menu's page (a reopen), it is shown in that frame.
- **A.** When it holds another menu's page (a switch), nothing from the other menu is ever shown: the
  panel appears when the new page arrives, as today, without vanilla's grid in between.
- **B.** The catalog renders the entries that fit its visible area plus a small margin, in every view,
  and renders more as the player scrolls, without waiting for C# while the page still has entries.

## Non-goals

- Changing how C# builds or sizes pages, the 40-entry window, or Load more.
- Lighter table rows, SVG icon cost, C# refresh timing: measured, separate work.
- Showing a placeholder or stale content to make a switch feel faster.

## Anti-goals (a failure even if it is faster)

- Any frame showing one menu's header, strip or cards under another menu's button.
- The asset menu covering a menu C# gives back to vanilla (a mod's menu with nothing indexed, the
  replace setting off, Find It's panel, photo mode) for more than the one frame it takes C# to say so.
- A blank UI after the mod is subscribed mid-session (see the extension rules in
  `docs/design-notes.md`: no hook added to a wrapper of a vanilla hook).
- Scroll anchoring to a placed building, Enter-to-place, "Load more" and the end-of-list label behaving
  differently.

## A. The UI decides ownership

**C# publishes the menus it stands in for.** A new value binding, `OwnedAssetMenus`: one entry per
vanilla toolbar menu C# would take over if it were selected now, `{ index, name }`, where `index` is
the menu prefab's entity index (what `toolbar.selectedAssetMenu` carries) and `name` is
`VanillaMenuIndex.MenuName(index)`. Membership is exactly the negation of `MenuRouting.ShouldYield`
for that menu under the current setting, index and toolbar selection, so the UI and
`VanillaMenuSelected` cannot disagree. It is empty while the replace setting is off. It is
recomputed and republished when any of its inputs changes: an index generation is published, the
toolbar's theme/pack/vanilla-mods selection changes, the setting changes. Computing it is pure
domain code with tests.

**The page states its menu.** `BuildingCatalogPage` gains `Menu`, the menu the query ran scoped to
(empty when unscoped), written as `menu`, the way `SearchText` already is. A close clears C#'s scope
but sends no page, so the page the kept panel holds keeps naming the menu it shows.

**The UI owns the selected menu when** the setting is on and the selected toolbar menu's index is in
`OwnedAssetMenus`, or `OwnsCurrentMenu` is true (C# stays authoritative; the set only lets the UI act
a frame earlier). One pure function decides it, used by:

- `RemoveVanillaAssetMenu`, which renders the slot instead of vanilla's menu, passing the selected
  menu's name to the slot;
- `ToolOptionsVisibility` (still hook-free: it reads `.value` of the bindings) and
  `ToolOptionsPanelRefresh` (which subscribes to the extra bindings so the panel re-renders).

`VanillaMenuWatcher` is unchanged: C# still hears every selection and still refreshes.

**The kept panel joins the slot when its page belongs there.** The slot store's entry carries the
menu it was opened for. `KeptAssetMenu` moves its element into the slot, and counts as shown, when:

1. the page it holds names the slot's menu (a reopen: this frame), or
2. any page has arrived since the slot opened (a switch, an unscoped query, a first open: when C#
   answers), or
3. a short timeout passes with neither (a fallback, so a missed page can never leave an empty slot).

Until then the slot is in the document but empty, so neither vanilla's grid nor the other menu's
page is drawn. Once joined, later pages do not detach it.

If C# yields a menu the UI claimed, it republishes `OwnedAssetMenus` without it and leaves
`OwnsCurrentMenu` false, and the next render gives the slot back to vanilla.

## B. Render what fits

`useCatalogWindow` keeps the page as C# sends it and adds a render count: how many of the page's
entries the views draw. It starts from an estimate, rows that fit the catalog's height in the current
view plus a margin of two rows, and the existing fill loop raises it while the last drawn row ends
inside the visible area. Scrolling near the bottom raises it by a step; only when it has reached the
end of the page does the loop send Load more to C#, as today. So:

- `items` handed to the views is the drawn prefix; the full page stays available for Enter's best
  match;
- "has more" means more in the page or more in C#;
- the end-of-list label and Load more count what is drawn against the total, as they do now;
- a pending scroll anchor raises the count to cover the anchored entry before it is measured;
- the count resets to the estimate when the kept panel is hidden (the next open starts at the top
  anyway), which also frees the hidden panel's extra rows.

The estimate's inputs are the view's row height in rem and the catalog height the layout already
holds; it is a pure function with tests. A wrong estimate costs a frame of the fill loop, not
correctness.

## Constraints

- Cohtml: no `Element.replaceWith`, no `TreeWalker`; `performance.now()` does not advance within a
  task (never spin on it); `setAttribute` and layout are expensive; SVG icons cost about 0.9 ms per
  element created.
- Extension points: no hooks added inside wrappers of vanilla hooks (mid-session load).
- UI and C# tests stay green: `npm test` (782 + 220), `dotnet test` (933).
- Owner rulings stand: the table and its look are unchanged; options keep their meaning.

## Testing

- Unit: owned-menu computation (C#), ownership decision, slot-join rule, render-count estimate and
  growth (UI), page `menu` serialisation and the binding manifest.
- In game, A/B against `perf/keep-menu-built` in one session where possible: reopen and switch in all
  four views; vanilla grid never laid out; no frame of another menu's content; the yield cases
  (setting off, a menu with nothing indexed, Find It panel, photo mode); scroll anchor after placing;
  Enter to place; Load more to the end of Roads; mid-session subscribe.

## Left to the builder

Names, file layout, the timeout length, the margin and step sizes, and how the render count reaches
the anchor.
