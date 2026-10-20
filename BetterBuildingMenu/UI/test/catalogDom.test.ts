import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findScrollContainer, lastCatalogRow, scrollToTopAbove } from "../src/mods/BuildingCatalog/catalogDom.ts";
import { CATALOG_SCROLL_MIN_OVERFLOW, isScrollContainer } from "../src/domain/catalogWindow.ts";

type Box = { scrollHeight: number; clientHeight: number; parentElement: Box | null };
const box = (over: number, parent: Box | null): Box => ({
  scrollHeight: 100 + over,
  clientHeight: 100,
  parentElement: parent,
});

describe("finding the element that scrolls", () => {
  it("returns the first ancestor that overflows by the threshold", () => {
    const root = box(0, null);
    const scroller = box(CATALOG_SCROLL_MIN_OVERFLOW, root);
    const row = box(0, box(0, scroller));

    assert.equal(findScrollContainer(row, root, isScrollContainer), scroller);
  });

  it("skips a container sub-pixel rounding pushed over by less than the threshold", () => {
    const root = box(0, null);
    const scroller = box(40, root);
    const nearly = box(CATALOG_SCROLL_MIN_OVERFLOW - 1, scroller);
    const row = box(0, nearly);

    assert.equal(findScrollContainer(row, root, isScrollContainer), scroller);
  });

  it("stops at the root rather than walking into the game's own tree", () => {
    // The asset menu's own root never overflows; what is above it is vanilla, and
    // a walk that kept going would land on whatever container of the game's
    // happened to overflow.
    const game = box(500, null);
    const root = box(0, game);
    const row = box(0, box(0, root));

    assert.equal(findScrollContainer(row, root, isScrollContainer), null);
  });

  it("does not return the root itself even when it overflows", () => {
    const root = box(50, null);
    const row = box(0, root);

    assert.equal(findScrollContainer(row, root, isScrollContainer), null);
  });
});

describe("the row a hook should measure", () => {
  const el = (id: number) => ({ id }) as unknown as HTMLElement;
  const root = (rows: HTMLElement[]) =>
    ({
      querySelectorAll: (selector: string) => {
        const m = selector.match(/="(\d+)"/);
        const hits = m ? rows.filter((r) => (r as unknown as { id: number }).id === Number(m[1])) : rows;
        return hits as unknown as NodeListOf<Element>;
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

describe("putting a kept menu back at the top", () => {
  type Scrolled = { scrollTop: number; parentElement: Scrolled | null };
  const at = (scrollTop: number, parent: Scrolled | null): Scrolled => ({ scrollTop, parentElement: parent });

  it("scrolls every scrolled element between the row and the root to the top", () => {
    const root = at(0, null);
    const outer = at(120, root);
    const inner = at(600, outer);
    const row = at(0, inner);

    scrollToTopAbove(row, root);

    assert.equal(inner.scrollTop, 0);
    assert.equal(outer.scrollTop, 0);
  });

  it("leaves the root and everything above it alone", () => {
    const game = at(300, null);
    const root = at(50, game);
    const row = at(0, at(0, root));

    scrollToTopAbove(row, root);

    assert.equal(root.scrollTop, 50);
    assert.equal(game.scrollTop, 300);
  });
});
