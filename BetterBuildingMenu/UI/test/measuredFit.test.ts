import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reduceBudgetToFit, columnExtraRem, capColumnExtras, mergeColumnExtras } from "../src/domain/measuredFit.ts";

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
    // A small overflow still costs a character, or nothing would change.
    assert.equal(reduceBudgetToFit(17, 187, 188), 16);
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

describe("a metric column widened to what its cells drew", () => {
  it("adds nothing when nothing overflowed", () => {
    assert.equal(columnExtraRem(0, 1.333), 0);
    assert.equal(columnExtraRem(-3, 1.333), 0);
  });

  it("adds the overflow in whole rem plus one of slack", () => {
    // "¢2,437 /km/mo." 117px in a 115px cell at 1.333px per rem → 2px is
    // 1.5rem, so two, plus one.
    assert.equal(columnExtraRem(2, 1.333), 3);
    assert.equal(columnExtraRem(8, 1.0), 9);
  });

  it("caps the extras at the room beside a name of its minimum width", () => {
    // 100rem of room, columns already 90rem wide: only 10rem of extra fits,
    // shared out in order until it runs out.
    const capped = capColumnExtras({ cost: 6, upkeep: 6, workers: 2 }, 90, 100);
    assert.deepEqual(capped, { cost: 6, upkeep: 4, workers: 0 });
  });

  it("leaves extras alone where there is room", () => {
    assert.deepEqual(capColumnExtras({ cost: 3, upkeep: 3 }, 90, 200), { cost: 3, upkeep: 3 });
  });
});

describe("merging a measurement into the current extras", () => {
  // The first version of the catalog's measuring effect set state with a
  // new-but-equal object whenever the cap trimmed a wanted extra, and React
  // re-rendered, re-measured and set again forever: the UI thread blocked
  // and the game froze. The merge answers null when nothing would change.
  it("answers null when no cell overflowed", () => {
    assert.equal(mergeColumnExtras({ cost: 2 }, {}, 1, 100, 300), null);
  });

  it("answers null when the cap leaves every extra as it was", () => {
    // 10rem of room, all already granted to cost; upkeep wants more and
    // cannot have it.
    assert.equal(mergeColumnExtras({ cost: 10 }, { upkeep: 4 }, 1, 90, 100), null);
  });

  it("answers the grown extras otherwise", () => {
    assert.deepEqual(mergeColumnExtras({}, { upkeep: 2 }, 1.333, 90, 300), { upkeep: 3 });
    assert.deepEqual(mergeColumnExtras({ upkeep: 3 }, { upkeep: 2 }, 1.333, 90, 300), { upkeep: 6 });
  });
});
