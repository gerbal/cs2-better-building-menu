# FindIt remediation phase 6 — split the catalog, honest seams — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `BuildingCatalog.tsx` becomes a container under 350 lines over two
hooks, two table components and a DOM helper module whose every reach is
bounded by a ref the container owns; the two vanilla layout patches move
into one hook built on one tested primitive that selects only by the game's
stylesheet-module classes.

**Architecture:** Pure helpers (`catalogDom.ts`, `vanillaLayout.ts`) are
written test-first under node with fake elements. The hooks and components
are extractions — the code moves, the behaviour does not — so each
extraction task is gated by `tsc` and the two suites rather than by new
behavioural tests. Live behaviour is verified once at the end on
`949230-c`.

**Tech Stack:** TS/React 18 under Cohtml; node's test runner (`npm test`
in `FindIt/UI`, `npx tsc --noEmit -p .`); `just test findit-building-menu`
for both suites; `just build …`, `just deploy-isolated findit-building-menu
949230-c` (gated on `cs2-status` == no-game).

**Spec:** `docs/superpowers/specs/2026-09-01-findit-remediation-phase-6-split-catalog-and-honest-seams-design.md`

## Global Constraints

- Branch `findit/phase-6-split-catalog` off master `63f2143`, in the
  worktree `/var/home/gerbal/Games/CS-Modding-wt/findit-remediation`.
- Nothing about what the lens shows changes. No binding is added or
  removed (`BindingManifestTests` stays as it is).
- Every DOM query the catalog makes is scoped to the catalog's root
  element; `document.querySelectorAll` does not appear in
  `src/mods/BuildingCatalog/` after Task 3.
- No selector is a prefix match on a hashed class name; every vanilla
  class comes from `getModule(<module>.scss, "classes")` and a missing
  class makes the patch a no-op.
- Beads: cm-jjlv.10.1–.5 under cm-jjlv.10; close each on commit.
- Commit trailers: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
  and `Claude-Session: https://claude.ai/code/session_013U8fzQAHmfdVdWfXLX2Eqv`.

---

### Task 1: `catalogDom.ts` — the bounded DOM helpers

**Files:**
- Create: `FindIt/UI/src/mods/BuildingCatalog/catalogDom.ts`
- Test: `FindIt/UI/test/catalogDom.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ScrollBox { scrollHeight: number; clientHeight: number; parentElement: ScrollBox | null }
  export function findScrollContainer<T extends ScrollBox>(from: T, within: T): T | null
  export function lastCatalogRow(root: ParentNode, entryId?: number): HTMLElement | null
  ```

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findScrollContainer, lastCatalogRow } from "../src/mods/BuildingCatalog/catalogDom.ts";
import { CATALOG_SCROLL_MIN_OVERFLOW } from "../src/domain/catalogWindow.ts";

type Box = { scrollHeight: number; clientHeight: number; parentElement: Box | null };
const box = (over: number, parent: Box | null): Box => ({ scrollHeight: 100 + over, clientHeight: 100, parentElement: parent });

describe("finding the element that scrolls", () => {
  it("returns the first ancestor that overflows by the threshold", () => {
    const root = box(0, null);
    const scroller = box(CATALOG_SCROLL_MIN_OVERFLOW, root);
    const row = box(0, box(0, scroller));

    assert.equal(findScrollContainer(row, root), scroller);
  });

  it("skips a container sub-pixel rounding pushed over by less than the threshold", () => {
    const root = box(0, null);
    const scroller = box(40, root);
    const nearly = box(CATALOG_SCROLL_MIN_OVERFLOW - 1, scroller);
    const row = box(0, nearly);

    assert.equal(findScrollContainer(row, root), scroller);
  });

  it("stops at the root rather than walking into the game's own tree", () => {
    // The panel's own root never overflows; what is above it is vanilla.
    const game = box(500, null);
    const root = box(0, game);
    const row = box(0, box(0, root));

    assert.equal(findScrollContainer(row, root), null);
  });

  it("does not return the root itself even when it overflows", () => {
    const root = box(50, null);
    const row = box(0, root);

    assert.equal(findScrollContainer(row, root), null);
  });
});

describe("the row a hook should measure", () => {
  const el = (id: number) => ({ id, tag: `row-${id}` }) as unknown as HTMLElement;
  const root = (rows: HTMLElement[]) => ({
    querySelectorAll: (selector: string) => {
      const m = selector.match(/="(\d+)"/);
      return (m ? rows.filter((r) => (r as unknown as { id: number }).id === Number(m[1])) : rows) as unknown as NodeListOf<Element>;
    },
  }) as unknown as ParentNode;

  it("prefers the last match, because the shelf renders a copy above the body", () => {
    const rows = [el(7), el(9), el(7)];

    assert.equal(lastCatalogRow(root(rows), 7), rows[2]);
    assert.equal(lastCatalogRow(root(rows)), rows[2]);
  });

  it("has nothing to say about an entry that is not rendered", () => {
    assert.equal(lastCatalogRow(root([el(1)]), 2), null);
    assert.equal(lastCatalogRow(root([])), null);
  });
});
```

- [ ] **Step 2: Run it** — `cd FindIt/UI && node --test test/catalogDom.test.ts` (or `npm test`); expected: fails, module not found.

- [ ] **Step 3: Implement**

```ts
import { isScrollContainer } from "domain/catalogWindow";

/** The three fields the walk reads; an HTMLElement satisfies it. */
export interface ScrollBox {
  scrollHeight: number;
  clientHeight: number;
  parentElement: ScrollBox | null;
}

/**
 * The element that actually scrolls, found by walking up from a row and
 * never past the catalog's own root.
 *
 * By walking rather than by ref, because which element owns the scroll
 * differs by view mode, and cs2/ui's `Scrollable` silently drops props it
 * does not recognise. Bounded by `within` because the game's own screen is
 * above the root, and a walk that kept going would land on whatever vanilla
 * container happened to overflow.
 *
 * The overflow threshold is the point: a plain `scrollHeight > clientHeight`
 * stops at the first container that sub-pixel rounding pushed one pixel
 * over, which is not the one the player is moving. See
 * CATALOG_SCROLL_MIN_OVERFLOW.
 */
export function findScrollContainer<T extends ScrollBox>(from: T, within: T): T | null {
  let node = from.parentElement as T | null;

  while (node && node !== within) {
    if (isScrollContainer(node.scrollHeight, node.clientHeight)) {
      return node;
    }

    node = node.parentElement as T | null;
  }

  return null;
}

/**
 * The row to measure: the LAST `[data-catalog-entry]` under the root.
 *
 * Last, not first. The grid's "frequently placed" shelf renders the same
 * entries above the body with the same attribute, and the shelf is pinned
 * in view — anchoring to that copy reports the row on screen without
 * scrolling anything, a silent no-op dressed as a success. Walking up from
 * the shelf's copy also finds the panel rather than the list.
 */
export function lastCatalogRow(root: ParentNode, entryId?: number): HTMLElement | null {
  const selector = entryId === undefined ? "[data-catalog-entry]" : `[data-catalog-entry="${entryId}"]`;
  const rows = root.querySelectorAll(selector);
  const row = rows.length === 0 ? null : rows[rows.length - 1];

  return row as HTMLElement | null;
}
```

The `as HTMLElement | null` is deliberate: node has no `HTMLElement`
global, so the test cannot `instanceof`-check, and the callers only read
`getBoundingClientRect`/`querySelector` off it.

- [ ] **Step 4: Run** — `npm test` green, `npx tsc --noEmit -p .` clean.

- [ ] **Step 5: Commit** — `refactor(findit): bounded catalog DOM helpers — the scroll walk stops at the root, the row is the last match (cm-jjlv.10.1)`; close cm-jjlv.10.1.

---

### Task 2: `vanillaLayout.ts` — one tested patch primitive, honest selectors

**Files:**
- Create: `FindIt/UI/src/mods/BuildingMenu/vanillaLayout.ts`
- Test: `FindIt/UI/test/vanillaLayout.test.ts`
- Modify: `FindIt/UI/src/mods/BuildingMenu/BuildingMenuSurface.tsx` (delete the two effects, lines 79–208, and the `GameMainScreneTheme` module at line 22; call the hook), `FindIt/UI/test/buildingLensUx.test.ts:255-256, 383-396` (`surfaceSourceFor` reads `vanillaLayout.ts`).

**Interfaces:**
- Produces:
  ```ts
  export interface StyledElement { style: { getPropertyValue?(n: string): string; removeProperty(n: string): unknown; [k: string]: unknown } }
  export function setInlineStyle(element: StyledElement, property: "justifyContent" | "zIndex", value: string): () => void
  export function firstClassToken(classes: unknown): string | null
  export function vanillaClass(modulePath: string, key: string): string | null
  export function findVanillaToolbar(doc: Document): HTMLElement | null
  export function useVanillaLayoutForLens(): void
  ```
  (`getModule` cannot be imported under node — `cs2/modding` is a webpack
  external — so `vanillaClass`, `findVanillaToolbar` and the hook live
  below a `// --- needs the game ---` line and the test imports only the
  two pure functions. Node resolves the file's `cs2/modding` import at load
  time, so the pure functions go in **`vanillaLayoutPure.ts`** and
  `vanillaLayout.ts` re-exports them; the test imports the pure module.)

- [ ] **Step 1: Write the failing test** (`test/vanillaLayout.test.ts`)

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstClassToken, setInlineStyle } from "../src/mods/BuildingMenu/vanillaLayoutPure.ts";

const fake = (initial: Record<string, string> = {}) => {
  const removed: string[] = [];
  const style: Record<string, unknown> = { ...initial, removeProperty: (name: string) => { removed.push(name); } };
  return { el: { style } as never, style, removed };
};

describe("patching one of vanilla's inline styles", () => {
  it("assigns the value and hands back a restore", () => {
    const { el, style } = fake();
    const restore = setInlineStyle(el, "justifyContent", "flex-start");

    assert.equal(style.justifyContent, "flex-start");
    assert.equal(typeof restore, "function");
  });

  it("removes the property on restore when the game had set none inline", () => {
    // Cohtml rejects "" as a value and logs "Trying to set justifyContent
    // property to invalid value!" on every menu close; a browser reads ""
    // as unset. removeProperty is what both accept.
    const { el, style, removed } = fake();
    setInlineStyle(el, "zIndex", "-1")();

    assert.deepEqual(removed, ["z-index"]);
    assert.equal(style.zIndex, "-1", "the property is removed, not reassigned");
  });

  it("puts a previous inline value back rather than removing it", () => {
    const { el, style, removed } = fake({ justifyContent: "center" });
    setInlineStyle(el, "justifyContent", "flex-start")();

    assert.equal(style.justifyContent, "center");
    assert.deepEqual(removed, []);
  });
});

describe("a class from the game's stylesheet module", () => {
  it("takes the first token, because gameMainScreen carries a transition class too", () => {
    assert.equal(firstClassToken("game-main-screen_TRK child-opacity-transition_nkS"), "game-main-screen_TRK");
    assert.equal(firstClassToken("toolbar_QYu"), "toolbar_QYu");
  });

  it("is null for anything but a non-empty string", () => {
    assert.equal(firstClassToken(undefined), null);
    assert.equal(firstClassToken(""), null);
    assert.equal(firstClassToken("   "), null);
    assert.equal(firstClassToken(42), null);
  });
});
```

- [ ] **Step 2: Run it** — fails, module not found.

- [ ] **Step 3: Implement `vanillaLayoutPure.ts`**

```ts
/** The two properties the lens patches on vanilla's elements. */
export type PatchedProperty = "justifyContent" | "zIndex";

const CSS_NAME: Record<PatchedProperty, string> = { justifyContent: "justify-content", zIndex: "z-index" };

export interface StyledElement {
  style: { removeProperty(name: string): unknown } & Partial<Record<PatchedProperty, string>>;
}

/**
 * Set one inline style on an element we do not render, and return the
 * restore.
 *
 * The game styles these elements from its stylesheet, so their inline value
 * is normally "" — and restoring "" is the trap: a browser reads it as
 * "unset the inline value", Cohtml reads it as a value, rejects it and logs
 * "Trying to set justifyContent property to invalid value!" on every menu
 * close. So a previous value is assigned back and an absent one is removed.
 */
export function setInlineStyle(element: StyledElement, property: PatchedProperty, value: string): () => void {
  const previous = element.style[property];
  element.style[property] = value;

  return () => {
    if (previous) {
      element.style[property] = previous;
      return;
    }

    element.style.removeProperty(CSS_NAME[property]);
  };
}

/**
 * The selector token of a stylesheet-module class.
 *
 * A module value can carry more than one class — `gameMainScreen` is
 * "game-main-screen_TRK child-opacity-transition_nkS" — and only the first
 * names the element. Null for a missing key, so a caller can make its patch
 * a no-op instead of guessing at a hashed name.
 */
export function firstClassToken(classes: unknown): string | null {
  if (typeof classes !== "string") {
    return null;
  }

  const token = classes.trim().split(/\s+/)[0];

  return token ? token : null;
}
```

- [ ] **Step 4: Implement `vanillaLayout.ts`** (the game-facing half)

```ts
import { getModule } from "cs2/modding";
import { useEffect } from "react";
import { firstClassToken, setInlineStyle } from "./vanillaLayoutPure";

export { firstClassToken, setInlineStyle } from "./vanillaLayoutPure";

const GAME_MAIN_SCREEN = "game-ui/game/components/game-main-screen.module.scss";
const TOOLBAR = "game-ui/game/components/toolbar/toolbar.module.scss";

/** A class the game's stylesheet module exports, or null — never a guess. */
export function vanillaClass(modulePath: string, key: string): string | null {
  let classes: unknown;

  try {
    classes = getModule(modulePath, "classes");
  } catch {
    return null;
  }

  return firstClassToken((classes as Record<string, unknown> | undefined)?.[key]);
}

/** Vanilla's `.toolLayout`: the side + main + side trio the menu sits in. */
export function findVanillaToolLayout(doc: Document): HTMLElement | null {
  const cls = vanillaClass(GAME_MAIN_SCREEN, "toolLayout");

  return cls ? doc.querySelector<HTMLElement>(`.${cls}`) : null;
}

/**
 * Vanilla's bottom toolbar, as the child of `game-main-screen` carrying the
 * toolbar module's own class.
 *
 * A child of the screen rather than a document-wide match, because the pair
 * whose paint order we change are defined by being siblings; and the
 * module's class rather than `className.startsWith("toolbar_")`, because a
 * prefix on a hashed name is a guess that also matches our own toolbars.
 */
export function findVanillaToolbar(doc: Document): HTMLElement | null {
  const screenClass = vanillaClass(GAME_MAIN_SCREEN, "gameMainScreen");
  const toolbarClass = vanillaClass(TOOLBAR, "toolbar");

  if (!screenClass || !toolbarClass) {
    return null;
  }

  const screen = doc.querySelector<HTMLElement>(`.${screenClass}`);

  if (!screen) {
    return null;
  }

  for (const child of Array.from(screen.children)) {
    if (child instanceof HTMLElement && child.classList.contains(toolbarClass)) {
      return child;
    }
  }

  return null;
}

/**
 * The two things vanilla's layout has to do differently while the lens is
 * open, applied on mount and undone on unmount.
 *
 * 1. `toolLayout` left-aligned. Vanilla centres side + main + side (990px)
 *    in 1267px, putting the main column at x=403; this panel and its
 *    control pane need 980px from that edge and the tool-options column
 *    sits at 145→398 beside it. Left-aligned, the column starts at 264 and
 *    everything fits. Only vanilla's element decides it — a container of
 *    ours can neither shift left over the options column nor fit to the
 *    right (measured; see the phase-6 spec).
 *
 * 2. The toolbar sunk to `z-index: -1`. The chirper hangs off `toolbar`, we
 *    hang off `main-container`, both are children of `game-main-screen` and
 *    paint in tree order at `z-index: auto` — so the toast covered the
 *    control pane and no z-index of OURS could change it. Raising
 *    main-container broke the game's portalled dropdowns (they count on tree
 *    order); lowering the toolbar changes exactly the one pair. Verified
 *    live: toast hidden, Locked/Unlocked popup draws over the pane, the
 *    toolbar still renders (the screen paints no background) and is still
 *    hit-testable.
 *
 * Imperative and scoped to the mount because these are vanilla's elements:
 * a stylesheet rule would restyle the game for the whole session, including
 * while the panel is closed. A missing module or class makes the patch a
 * no-op.
 */
export function useVanillaLayoutForLens(): void {
  useEffect(() => {
    const restores: Array<() => void> = [];
    const layout = findVanillaToolLayout(document);
    const toolbar = findVanillaToolbar(document);

    if (layout) restores.push(setInlineStyle(layout, "justifyContent", "flex-start"));
    if (toolbar) restores.push(setInlineStyle(toolbar, "zIndex", "-1"));

    return () => {
      for (const restore of restores) restore();
    };
  }, []);
}
```

- [ ] **Step 5: Use it in `BuildingMenuSurface.tsx`** — delete the `getModule` import if only `AssetMenuTheme` remains (it stays: `AssetMenuTheme.assetPanel` is used), delete `GameMainScreneTheme`, delete both effects with their comments, add `import { useVanillaLayoutForLens } from "mods/BuildingMenu/vanillaLayout";` and call `useVanillaLayoutForLens();` after `catalogHeight`. Delete `useEffect` from the react import if unused.

- [ ] **Step 6: Re-point the surface regex tests** in `buildingLensUx.test.ts`: `surfaceSourceFor` reads `../src/mods/BuildingMenu/vanillaLayout.ts`; the assertions become
  `assert.match(src, /setInlineStyle\(layout, "justifyContent", "flex-start"\)/)`,
  `assert.doesNotMatch(src, /AlignmentStyle/)`, and for the restore test read `vanillaLayoutPure.ts`:
  `assert.match(pure, /const previous = element\.style\[property\]/)`, `assert.match(pure, /element\.style\.removeProperty\(CSS_NAME\[property\]\)/)`. Update the test names' prose only where it names the file.

- [ ] **Step 7: Run** — `npm test`, `tsc`, `just test findit-building-menu`.

- [ ] **Step 8: Commit** — `refactor(findit): the two vanilla layout patches become one tested hook that selects by the game's own stylesheet classes (cm-jjlv.10.2)`; close cm-jjlv.10.2.

---

### Task 3: `useCatalogWindow` and `useScrollAnchor` over a root ref

**Files:**
- Create: `FindIt/UI/src/mods/BuildingCatalog/useCatalogWindow.ts`, `FindIt/UI/src/mods/BuildingCatalog/useScrollAnchor.ts`
- Modify: `FindIt/UI/src/mods/BuildingCatalog/BuildingCatalog.tsx` (delete `findScrollContainer` 137–156, the reveal effect 204–273, the anchor effect 449–585, `loadMore` + the frame loop 586–660; add `rootRef`)

**Interfaces:**
- Consumes: Task 1's `findScrollContainer`, `lastCatalogRow`.
- Produces:
  ```ts
  export type BuildingCatalogPageStatus = "indexing" | "ready" | "empty";
  export interface CatalogWindow { items: BuildingCatalogEntry[]; totalCount: number; offset: number; limit: number; status: BuildingCatalogPageStatus; hasMore: boolean; loadMore(): void }
  export function useCatalogWindow(rootRef: RefObject<HTMLElement>, scope: { viewMode: string; groupBy: string }): CatalogWindow
  export function useScrollAnchor(rootRef: RefObject<HTMLElement>, anchorKey: string, itemCount: number): void
  export function useRevealExpandedRow(rootRef: RefObject<HTMLElement>, expandedId: number | null, detailClassName: string): void
  ```

- [ ] **Step 1: `useCatalogWindow.ts`** — move `BuildingCatalog$`, `BuildingCatalogBindingPage`, the `items/totalCount/offset/limit/status/hasMore` derivation, `loadMore`, and the bottom-of-list frame-loop effect (with its "polls because Cohtml emits no scroll event" comment) into:

```ts
import { bindValue, trigger, useValue } from "cs2/api";
import { useEffect, type RefObject } from "react";
import mod from "../../../mod.json";
import type { BuildingCatalogEntry, BuildingCatalogPage } from "domain/buildingCatalog";
import { loadMoreCatalogCommand } from "domain/buildingCatalogContracts";
import { shouldLoadMore } from "domain/catalogWindow";
import { findScrollContainer, lastCatalogRow } from "./catalogDom";

export type BuildingCatalogPageStatus = "indexing" | "ready" | "empty";
type BuildingCatalogBindingPage = BuildingCatalogPage & { status?: BuildingCatalogPageStatus };

const BuildingCatalog$ = bindValue<BuildingCatalogBindingPage>(mod.id, "BuildingCatalog");

export interface CatalogWindow { /* as above */ }

export function useCatalogWindow(rootRef: RefObject<HTMLElement>, scope: { viewMode: string; groupBy: string }): CatalogWindow {
  const page = useValue(BuildingCatalog$);
  const items = page?.items ?? [];
  const totalCount = page?.totalCount ?? 0;
  const offset = page?.offset ?? 0;
  const limit = page?.limit ?? 100;
  const status: BuildingCatalogPageStatus = page?.status ?? (page ? (totalCount === 0 ? "empty" : "ready") : "indexing");
  const hasMore = page?.hasMore ?? false;

  function loadMore(): void {
    if (!hasMore) return;
    const command = loadMoreCatalogCommand();
    trigger(mod.id, command.method, ...command.args);
  }

  useEffect(() => {
    if (!hasMore || items.length === 0) return;
    let handle = 0;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      const root = rootRef.current;
      const row = root ? lastCatalogRow(root) : null;
      const scroller = root && row ? findScrollContainer(row, root) : null;
      if (scroller && shouldLoadMore({ scrollTop: scroller.scrollTop, clientHeight: scroller.clientHeight, scrollHeight: scroller.scrollHeight })) {
        loadMore();
        return;
      }
      handle = requestAnimationFrame(step);
    };
    handle = requestAnimationFrame(step);
    return () => { cancelled = true; cancelAnimationFrame(handle); };
  }, [hasMore, items.length, scope.viewMode, scope.groupBy]);

  return { items, totalCount, offset, limit, status, hasMore, loadMore };
}
```

Keep every explanatory comment from the original next to the code it explains (the `hasMore`-only re-entry guard, the "polls instead of listening" block, the "items.length rather than items" note).

- [ ] **Step 2: `useScrollAnchor.ts`** — move the anchor retry loop (`useScrollAnchor`) and the ResizeObserver reveal (`useRevealExpandedRow`) verbatim, with `EXPANDED_ROW_REVEAL_MARGIN`, replacing each `document.querySelectorAll(...)` + last-match with `lastCatalogRow(root, id)` and each `findScrollContainer(row)` with `findScrollContainer(row, root)`; both hooks begin with `const root = rootRef.current; if (!root) return;` inside the effect. `useRevealExpandedRow` takes the detail class name (`styles.rowDetails`) as an argument so the hook does not import the stylesheet.

- [ ] **Step 3: Wire `BuildingCatalog.tsx`** — `const rootRef = useRef<HTMLDivElement>(null);` on the root div; `const { items, totalCount, limit, status, hasMore, loadMore } = useCatalogWindow(rootRef, { viewMode, groupBy });`; `useRevealExpandedRow(rootRef, expandedId, styles.rowDetails);` after `expandedId`; `useScrollAnchor(rootRef, anchorKey, items.length);` after `anchorKey`. Remove the now-unused imports (`CATALOG_ANCHOR_MAX_FRAMES`, `anchorScrollTop`, `revealScrollTop`, `isAnchorMeasurable`, `isAnchorOnScreen`, `isScrollContainer`, `shouldLoadMore`, `AnchorGeometry`, `loadMoreCatalogCommand`, `getLensAnchor`, `useEffect`).

- [ ] **Step 4: Verify** — `grep -n "document\." src/mods/BuildingCatalog/*.ts*` prints nothing; `tsc` clean; both suites green (`buildingLensUx` regexes over `BuildingCatalog.tsx` still hold — nothing they match moved in this task).

- [ ] **Step 5: Commit** — `refactor(findit): the catalog window and the scroll hooks measure inside a root ref, never the document (cm-jjlv.10.3)`; close cm-jjlv.10.3.

---

### Task 4: `TableRow` and `TableView`

**Files:**
- Create: `FindIt/UI/src/mods/BuildingCatalog/TableRow.tsx`, `FindIt/UI/src/mods/BuildingCatalog/TableView.tsx`
- Modify: `FindIt/UI/src/mods/BuildingCatalog/BuildingCatalog.tsx` (the `tableMode ? (…) :` branch becomes `<TableView …/>`; `metricColumns` moves to `TableView.tsx`), `FindIt/UI/test/buildingLensUx.test.ts:14-17` (`buildingCatalogSource` = concatenation of `BuildingCatalog.tsx`, `TableView.tsx`, `TableRow.tsx`), `:224-226` (`{footer}` inside TableView), `FindIt/UI/test/supportedUpgradesField.test.ts:37` (`TableRow.tsx`).

**Interfaces:**
- Produces:
  ```tsx
  export interface TableRowLabels { place: string; inspect: string; locked: string; built: string }
  export interface TableRowProps {
    entry: BuildingCatalogEntry; expanded: boolean; nameBudget: number;
    separators: NumberSeparators; labels: TableRowLabels;
    columnStyle(metric: BuildingLensMetric): CSSProperties;
    resolveFacetLabel(groupId: string, value: string): string | null;
    hoverCard: HoverCardContext; onPlace(entry: BuildingCatalogEntry): void; onToggleExpanded(id: number): void;
  }
  export const TableRow: (props: TableRowProps) => JSX.Element
  export interface TableViewProps extends Omit<TableRowProps, "entry" | "expanded"> {
    items: BuildingCatalogEntry[]; status: BuildingCatalogPageStatus; emptyState: ReactNode;
    density: BuildingLensDensityTier; sortColumn: SortColumn; descending: boolean; onSort(column: SortColumn): void;
    expandedId: number | null; footer: ReactNode;
  }
  export const TableView: (props: TableViewProps) => JSX.Element
  ```
  (`NumberSeparators` is `ReturnType<typeof getNumberSeparators>`; `HoverCardContext` is `ReturnType<typeof useHoverCardContext>` — export the aliases from the files that own the functions if they are not already named types.)

- [ ] **Step 1: `TableRow.tsx`** — move lines 800–962 of the current file (the `<div key={entry.id} className={styles.row} …>` through its closing tag, with every comment) into a component; `isExpanded` → `expanded`; `activate(entry)` → `onPlace(entry)`; `toggleExpanded(entry.id)` → `onToggleExpanded(entry.id)`; `placeLabel` etc. → `labels.place` etc.; `translate` is obtained inside via `useLocalization()` for `resolveAssetDescription`. The `comparePlaceLabel`/`compareRemoveLabel` locals are unused today — delete them.

- [ ] **Step 2: `TableView.tsx`** — move `metricColumns` and lines 716–969 (the fragment: column header, `Scrollable`, group headings, the rows map, `{catalogFooter}`) into a component; the rows map body becomes `<TableRow key={entry.id} entry={entry} expanded={expandedId === entry.id} {...rowProps}/>`; `catalogFooter` → `footer`; the empty/indexing block reads `emptyState` (the container passes `scopeNoticeBlock ?? <div className={styles.empty}>{emptyStateMessage}</div>` for "empty" and the indexing div for "indexing" — build `emptyState` in the container from `status`).

- [ ] **Step 3: The container** — `BuildingCatalog.tsx` renders
  `tableMode ? <TableView items={items} status={status} emptyState={emptyState} density={density} columnStyle={columnStyle} nameBudget={nameBudget} separators={separators} labels={rowLabels} resolveFacetLabel={resolveFacetLabel} hoverCard={hoverCard} sortColumn={sortColumn} descending={descending} onSort={setSort} expandedId={expandedId} onToggleExpanded={toggleExpanded} onPlace={activate} footer={catalogFooter} /> : (…unchanged grouped branch…)`. Remove imports that only the table used. `wc -l` under 350.

- [ ] **Step 4: Tests** — re-point as listed in Files; run `npm test`, `tsc`, `just test findit-building-menu`. Also `grep -c "document\." src/mods/BuildingCatalog/*.tsx` → 0.

- [ ] **Step 5: Commit** — `refactor(findit): the table is TableView + TableRow; BuildingCatalog.tsx is the container it always claimed to be (cm-jjlv.10.4)`; close cm-jjlv.10.4.

---

### Task 5: Live verification, docs, close

- [ ] **Step 1:** Build; `cs2-status` must read no-game; `just deploy-isolated findit-building-menu 949230-c`; launch on `949230-c` (`--no-steam --headless --check-menu`, CDP 9557); `Error initializing mod` count 0; load Porterville 3.
- [ ] **Step 2:** With the pinned driver + a CDP `Runtime.evaluate` (add an `eval <js>` command to `scratchpad/qa9444.mjs` over the same `connectWs` session if it lacks one): open Roads; evaluate
  - `document.querySelector('[class*="lensRow"]').getBoundingClientRect().left` → 264;
  - `getComputedStyle(<toolbar found as: game-main-screen child with class from toolbar.module.scss>).zIndex` → "-1";
  - counts: `document.querySelectorAll('[data-catalog-entry]').length` vs `document.querySelector('[class*="catalog_"]').querySelectorAll('[data-catalog-entry]').length` — equal;
  - set the view mode to table via the store? (UI-only) — instead click the Table button via CDP `game_click`/eval `onSelect`: `document.querySelector('[aria-label="Table"]')?.click()` (Cohtml supports `.click()`); then `document.querySelector('[class*="rowDetailsButton"]').click()` on a row near the fold and read the scroller's `scrollTop` before/after (reveal);
  - set the rows' `scrollTop = scrollHeight`, wait 2 s, read `FindItBuildingMenu.BuildingCatalog.items.length` > 100 (window grows);
  - trigger `FindItBuildingMenu.SetCurrentPrefab`-equivalent is a placement — instead exercise the anchor by `setLensAnchor` is not reachable; verify via close + reopen after scrolling: `scrollTop` > 0 before close, row of the last-clicked entry within the viewport after reopen (the anchor is written on Place; if placement cannot be driven headless, record the anchor check as "code moved verbatim, not re-driven" honestly).
  - close the menu; evaluate `toolLayout.style.justifyContent === ""` and toolbar `style.zIndex === ""`; grep the UI log (`Cohtml`/`UI.log` under the prefix's Logs) for "invalid value" → 0 new lines.
  - totals (Roads 403, All 10,536), exceptions 0.
- [ ] **Step 3:** `docs/verification.md` section `## 2026-09-01 — split the catalog; honest vanilla seams (phase 6)`: line counts before/after, the readings above, what could not be driven. Stop the game (lock/stop/unlock under `CS2_PREFIX=949230-c CDP_URL=http://127.0.0.1:9557`).
- [ ] **Step 4:** close cm-jjlv.10.5 and cm-jjlv.10; commit `docs(findit): verify phase 6 live — the seams hold through honest selectors, the hooks measure inside the root (cm-jjlv.10.5)`; merge to master in the MAIN checkout with `git -C`, test the merged tree, push; update memory `findit-remediation-state.md`.
