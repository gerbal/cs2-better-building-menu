import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reduceBudgetToFit, contentOverflowPx } from "../src/domain/measuredFit.ts";

// Character budgets and rem widths are estimates; the drawn text is the
// fact. Above 1.33px per rem (1440p, ultrawide) text renders 2–3 % wider
// relative to rem than at 1080p, and a budget that exactly fills its line at
// 720p spills a few pixels there. No fixed margin fits both ends — twelve at
// 100rem must stay twelve — so the estimate is corrected from the DOM, the
// way the group headings already are.
describe("a tile line budget corrected from what was drawn", () => {
  it("keeps the budget when the line fits", () => {
    assert.equal(reduceBudgetToFit(17, 187, 180), 17);
    assert.equal(reduceBudgetToFit(17, 187, 187), 17);
  });

  it("shrinks in proportion to the overflow, and always by at least one", () => {
    // "Medium Roundabout": seventeen characters wanting 195px of 187 → 16.
    assert.equal(reduceBudgetToFit(17, 187, 195), 16);
    // A pixel is rounding noise — fractional rem widths land on whole pixels
    // either side — and costs nothing; two is a real overflow.
    assert.equal(reduceBudgetToFit(17, 187, 188), 17);
    assert.equal(reduceBudgetToFit(17, 187, 189), 16);
    // A large one costs more.
    assert.equal(reduceBudgetToFit(17, 100, 200), 8);
  });

  it("never goes below the four characters a line needs to say anything", () => {
    assert.equal(reduceBudgetToFit(5, 10, 100), 4);
    assert.equal(reduceBudgetToFit(4, 10, 100), 4);
  });

  it("ignores a box that has not been laid out", () => {
    assert.equal(reduceBudgetToFit(17, 0, 195), 17);
    assert.equal(reduceBudgetToFit(17, 187, 0), 17);
  });
});

describe("what counts as overflow", () => {
  // Cohtml's scrollWidth equals offsetWidth when nothing overflows, and
  // clientWidth excludes the border, so scrollWidth − clientWidth is never
  // zero on a bordered cell: every table cell at 1440p reported its 2px
  // border as overflow, the measuring effect kept "fixing" it, and the
  // probe that found the "clips" was reading the same thing. A browser
  // keeps scrollWidth at clientWidth when nothing overflows. Both engines
  // agree that content past max(clientWidth, offsetWidth) is overflow.
  it("is content past the larger of client and offset width", () => {
    // (The table cells this was first written for no longer measure — see
    // BuildingCatalog.tsx — but a bordered tile is the same case.)
    // Cohtml, bordered, fits: scroll == offset > client.
    assert.equal(contentOverflowPx(153, 155, 155), 0);
    // Cohtml, bordered, overflowing by three.
    assert.equal(contentOverflowPx(153, 155, 158), 3);
    // A browser, fits: scroll == client < offset.
    assert.equal(contentOverflowPx(153, 155, 153), 0);
    // A browser, overflowing: scroll > offset.
    assert.equal(contentOverflowPx(153, 155, 160), 5);
    // Unbordered span, either engine.
    assert.equal(contentOverflowPx(187, 187, 195), 8);
  });
});

describe("the budget a set of drawn lines allows", () => {
  it("is the tightest correction any line asks for", async () => {
    const { lineBudgetFromDrawn } = await import("../src/domain/measuredFit.ts");
    // Two lines in a 64px box: the first fits, the second overflows by a third.
    const lines = [
      { clientWidth: 64, offsetWidth: 64, scrollWidth: 64 },
      { clientWidth: 64, offsetWidth: 64, scrollWidth: 96 },
    ];
    assert.equal(lineBudgetFromDrawn(12, lines), 8);
  });

  it("leaves the budget alone when every line fits", async () => {
    const { lineBudgetFromDrawn } = await import("../src/domain/measuredFit.ts");
    assert.equal(lineBudgetFromDrawn(12, [{ clientWidth: 64, offsetWidth: 64, scrollWidth: 64 }]), 12);
  });

  it("ignores lines that have not been laid out yet", async () => {
    // Cohtml reports 0 for an element it has not laid out, and the previous
    // text's width for one whose text just changed; a zero box is the first
    // case and must not count as overflow.
    const { lineBudgetFromDrawn } = await import("../src/domain/measuredFit.ts");
    assert.equal(lineBudgetFromDrawn(12, [{ clientWidth: 0, offsetWidth: 0, scrollWidth: 0 }]), 12);
  });
});
