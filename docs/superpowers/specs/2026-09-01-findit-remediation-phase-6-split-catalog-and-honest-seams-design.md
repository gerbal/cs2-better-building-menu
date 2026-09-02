# FindIt remediation phase 6 — split the catalog; make the vanilla seams honest

**Bead:** cm-jjlv.10 (epic cm-jjlv). **Argues from:** finding 8 of
`2026-09-01-architecture-review.md`. **Follows:** phase 4 (cm-jjlv.8), which
took the grouping, relevance and view-state concerns out of
`BuildingCatalog.tsx` and left it at 1,011 lines.

## What is wrong

- **`BuildingCatalog.tsx` is 1,011 lines** holding five things: eleven
  bindings and the page window, three DOM-measuring effects (reveal an
  expanded row, restore the scroll anchor, grow the window at the bottom),
  the table's column header, the table row (about 210 lines of JSX), and
  the branch between the table and `GroupedResults`.
- **Its DOM reaches are unbounded.** Three
  `document.querySelectorAll("[data-catalog-entry…]")` sweeps search the
  whole document for this component's own rows, and `findScrollContainer`
  walks `parentElement` upward with no stop — from a row it would happily
  pass the panel and land on the game's own scroller if one ever
  overflowed by eight pixels.
- **`BuildingMenuSurface.tsx` patches vanilla by guessing.** The toolbar
  it sinks to `z-index: -1` is found as the `game-main-screen` child whose
  `className.startsWith("toolbar_")` — a hashed class name matched by
  prefix, while the sibling `toolLayout` patch two effects up already
  reads its class from the game's stylesheet module. Both patches carry
  the same inline-style bookkeeping (the empty-string restore trap) in two
  copies, and neither is tested.

## What the review asked for, and what the geometry allows

Finding 8 proposes replacing the two patches with "a container the mod
owns inside the AssetMenu slot". Measured against the slot geometry
recorded in `BuildingMenuSurface.tsx` and the 2026-08-09 memory, that
does not hold:

- **`justify-content`.** Vanilla centres side + main + side (990 px) in
  1,267 px, so the main column starts at x=403 and vanilla's tool-options
  column occupies 145→398. Our 727 px panel plus the 253 px control pane
  needs 980 px from the main column's left edge; usable width from 403 is
  877. A container of ours cannot shift LEFT without covering the
  tool-options column, and cannot fit to the right. Left-aligning the trio
  is the one arrangement that fits, and only vanilla's element decides it.
- **`z-index`.** The chirper hangs off `toolbar`; we hang off
  `main-container`; both are children of `game-main-screen` and paint in
  tree order at `z-index: auto`. The pair whose order matters are
  vanilla's siblings, so nothing inside either of them — a container of
  ours included — changes the result. Raising `main-container` was tried
  and broke the game's portalled dropdowns.

So both patches stay: imperative, scoped to the mount, restored on
unmount. What changes is that they become **honest** (every selector is a
class the game's stylesheet module exports, none is guessed) and
**tested** (one patch primitive with the restore rule pinned).

## Decision

Split `BuildingCatalog.tsx` into a container, a window hook, a scroll hook
and two table components, with every DOM reach bounded by a ref the
container owns. Move the two vanilla patches into one hook built on one
tested primitive that selects only by stylesheet-module classes. Nothing
about what the lens shows changes.

## Design

### 1. The catalog's files

`FindIt/UI/src/mods/BuildingCatalog/`:

- **`catalogDom.ts`** — the DOM helpers, pure over `Element`-shaped
  objects so they test under node with fakes:
  - `lastCatalogRow(root, entryId?)` — the LAST `[data-catalog-entry]`
    (or `[data-catalog-entry="<id>"]`) under `root`. Last, because the
    grid's shelf renders the same entries above the body.
  - `findScrollContainer(from, within)` — walks `parentElement` from
    `from` until `isScrollContainer(scrollHeight, clientHeight)`; returns
    `null` on reaching `within` (inclusive) without a hit. The threshold
    stays `CATALOG_SCROLL_MIN_OVERFLOW`.
- **`useCatalogWindow.ts`** — `useCatalogWindow(rootRef, { viewMode,
  groupBy })` reads `BuildingCatalog$` and returns `{ items, totalCount,
  offset, limit, status, hasMore, loadMore }`, and owns the bottom-of-list
  frame loop (the passive half of the trigger; polling because Cohtml
  emits no scroll event). The loop measures via `lastCatalogRow(root)` +
  `findScrollContainer(row, root)`.
- **`useScrollAnchor.ts`** — two hooks, both over the root ref:
  - `useScrollAnchor(rootRef, anchorKey, itemCount)` — the retry loop
    that puts the player back on the anchored entry, verbatim from today
    but measuring inside `root`.
  - `useRevealExpandedRow(rootRef, expandedId, detailSelector)` — the
    ResizeObserver reveal, verbatim but bounded.
- **`TableRow.tsx`** — one row: the hover-carded Place button with the
  identity cell and the seven metric cells, the details chevron, and
  `BuildingResultDetails` when expanded. Props: `entry`, `expanded`,
  `columnStyle`, `nameBudget`, `separators`, `labels` (place, inspect,
  locked, built), `resolveFacetLabel`, `onPlace`, `onToggleExpanded`.
- **`TableView.tsx`** — the column header (sort buttons) and the
  `Scrollable` of group headings and `TableRow`s, the empty/indexing
  states, and the footer. Props: `items`, `status`, `emptyState`
  (ReactNode), `density`, `columnWidths`, `sortColumn`, `descending`,
  `onSort`, `expandedId`, `onToggleExpanded`, plus the row props above,
  and `footer`.
- **`BuildingCatalog.tsx`** keeps: the bindings, the density/column/name
  geometry, the labels, `activate`/`setSort`/`toggleExpanded`, the scope
  notice and the footer, the root `<div ref={rootRef}>`, and the branch:
  `tableMode ? <TableView …/> : <GroupedResults …/>`. Target under 350
  lines.

The root ref is the container's own `styles.catalog` div. `Scrollable`
declares `RefAttributes<HTMLDivElement>`, so a ref on it is possible; not
relied on here, because which element scrolls differs by view mode and
the walk bounded by the root already answers it. Whether that ref lands
on the scroller is a live question for the verification, recorded either
way.

### 2. The vanilla seams

`FindIt/UI/src/mods/BuildingMenu/vanillaLayout.ts`:

- `setInlineStyle(element, property, value): () => void` — sets
  `element.style[property]` and returns the restore: assigns the previous
  value back when there was one, otherwise `style.removeProperty(css-name)`
  (the empty-string trap: Cohtml rejects `""` as a value and logs on every
  close). Tested with a fake element.
- `vanillaClass(modulePath, key): string | null` — the first class token
  of `getModule(modulePath, "classes")?.[key]`, or `null` when the module
  or key is absent. `gameMainScreen` resolves to two tokens
  (`game-main-screen_TRK child-opacity-transition_nkS`); the first is the
  selector.
- `findVanillaToolbar(): HTMLElement | null` — the `game-main-screen`
  element's child carrying the `toolbar` class of
  `game-ui/game/components/toolbar/toolbar.module.scss`. A missing
  module, class or element yields `null` and the patch is a no-op —
  never a prefix match on a hashed name.
- `useVanillaLayoutForLens()` — one effect that applies both patches on
  mount (`toolLayout` → `justify-content: flex-start`; toolbar →
  `z-index: -1`) and restores both on unmount. `BuildingMenuSurface`
  calls it and loses its two effects and their two `getModule` lookups.

The prose that explains WHY each patch exists moves with it, trimmed to
what is still true.

### 3. Tests

- **Moved regex tests.** `buildingLensUx.test.ts` reads
  `BuildingCatalog.tsx` as text for eleven assertions and
  `BuildingMenuSurface.tsx` for five. The catalog assertions read the
  concatenation of `src/mods/BuildingCatalog/*.tsx` so they keep guarding
  the same strings across the split; the two whose named identifier
  changes (`{catalogFooter}` → `{footer}` inside TableView;
  `footer={catalogFooter}` stays) are updated. The surface assertions
  re-point at `vanillaLayout.ts` (`justifyContent = "flex-start"`, the
  `removeProperty("justify-content")` restore). `supportedUpgradesField`'s
  "table row detail" site becomes `TableRow.tsx`. cm-jjlv.11 replaces all
  of these with a render harness; this phase only keeps them true.
- **New.** `catalogDom.test.ts`: the walk stops at `within`, skips a
  container over by fewer than eight pixels, prefers the last row.
  `vanillaLayout.test.ts`: `setInlineStyle` restores a previous value,
  removes the property when there was none, and is idempotent;
  `vanillaClass` takes the first token and returns `null` for an absent
  key.
- Both suites green; `tsc --noEmit` clean; `BindingManifestTests` needs
  no change (no binding moves).

### 4. Out of scope

`VanillaComponentResolver`'s `getModule` paths with no fallback (finding
8's last clause) — a different seam, unchanged here. `GroupedResults`,
`BuildingGrid`, `BuildingList`. The Chirper toast lane (the real fix the
z-index comment names).

## Live verification

`949230-c`, Porterville 3, after build/deploy/reload (CSS and layout
cannot be probed without a run). Open Roads:

- the lens row's `getBoundingClientRect().left` is 264 (left-aligned, the
  `justify-content` patch holds through the new selector);
- the element `findVanillaToolbar` selects has computed `z-index: -1`,
  and after closing the menu its inline `z-index` is gone and
  `toolLayout`'s inline `justify-content` is gone (no "invalid value" log
  line in the UI log);
- Table view: expanding a row near the fold moves `scrollTop` (reveal);
  scrolling the rows to the bottom grows the page past 100 (window);
  placing an entry and reopening the menu lands with that entry's row on
  screen (anchor);
- every `[data-catalog-entry]` the hooks measure is a descendant of the
  catalog root (checked by evaluating the same selectors scoped to the
  root vs the document and comparing counts);
- totals unchanged; zero exceptions.
