import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bodyGrid, deviceRem, listForm, screenSlots, slotPosition, slotsHeight, wholeLines, type BodyGridInput } from "../src/domain/bodyGeometry";
import { CATALOG_WINDOW_SCROLL_THRESHOLD, CATALOG_WINDOW_STEP, shouldLoadMore } from "../src/domain/catalogWindow";
import { ASSET_MENU_DEFAULT_HEIGHT, ASSET_MENU_MIN_HEIGHT } from "../src/domain/sharedContracts.generated";
import { REFERENCE_ASPECT, widthStepWidths } from "../src/domain/widthSteps";

// The five 16:9 Width steps: 706, 893, 1091, 1280, 1475.
const STEPS = widthStepWidths(REFERENCE_ASPECT);
const input = (over: Partial<BodyGridInput> = {}): BodyGridInput => ({
  body: "list",
  boxWidth: STEPS[0],
  bodyHeight: ASSET_MENU_DEFAULT_HEIGHT,
  textScale: 1,
  atLargeText: "moreBuildings",
  tileSize: 64,
  plateHeight: 27.25,
  nameLines: 0,
  ...over,
});
/** How many of a tab's rows one screen shows. */
const shown = (over: Partial<BodyGridInput>, rows: number) => Math.min(rows, screenSlots(bodyGrid(input(over))));

describe("the list at 100% text", () => {
  it("draws 4 × 5 plates of 171 × 27.25 in the game's own box: 20 a screen", () => {
    const grid = bodyGrid(input());

    assert.equal(grid.form, "plate2");
    assert.deepEqual([grid.cols, grid.lines, grid.cellWidth, grid.cellHeight, grid.nameLines], [4, 5, 171, 27.25, 2]);
    assert.equal(screenSlots(grid), 20);
  });

  it("adds columns at the wider steps, never lines: Medium Roads' 34 show 20 / 25 / 30 / 34 / 34", () => {
    assert.deepEqual(STEPS.map((boxWidth) => shown({ boxWidth }, 34)), [20, 25, 30, 34, 34]);
    assert.deepEqual(STEPS.map((boxWidth) => bodyGrid(input({ boxWidth })).lines), [5, 5, 5, 5, 5]);
  });

  it("shares each step's width among its plates", () => {
    for (const boxWidth of STEPS) {
      const grid = bodyGrid(input({ boxWidth }));
      assert.ok(Math.abs(grid.cols * grid.cellWidth + (grid.cols - 1) * 2 - (boxWidth - 16)) < 1e-9, `${boxWidth}`);
      assert.ok(grid.cellWidth >= 171, `${boxWidth}: ${grid.cellWidth}`);
    }
  });

  it("takes its plate height from the List plate height knob", () => {
    const grid = bodyGrid(input({ plateHeight: 34 }));

    assert.equal(grid.cellHeight, 34);
    assert.equal(grid.lines, 4);
  });
});

describe("the list above 100% text", () => {
  it("draws 3 × 6 one-line plates by default: 18 a screen", () => {
    for (const textScale of [1.1, 1.15, 1.3]) {
      const grid = bodyGrid(input({ textScale }));

      assert.equal(grid.form, "plate1", `${textScale}`);
      assert.deepEqual([grid.cols, grid.lines, grid.nameLines], [3, 6, 1]);
      assert.equal(screenSlots(grid), 18);
    }
  });

  it("draws 3 × 4 two-line plates under Whole names: 12 a screen", () => {
    const grid = bodyGrid(input({ textScale: 1.3, atLargeText: "wholeNames" }));

    assert.equal(grid.form, "plateWhole");
    assert.deepEqual([grid.cols, grid.lines, grid.nameLines], [3, 4, 2]);
  });

  it("fills the game's own body with both forms' lines", () => {
    for (const atLargeText of ["moreBuildings", "wholeNames"]) {
      const grid = bodyGrid(input({ textScale: 1.3, atLargeText }));
      assert.ok(Math.abs(grid.lines * grid.pitchY - 2 - ASSET_MENU_DEFAULT_HEIGHT) < 0.02, atLargeText);
    }
  });

  it("keeps the two-line plate at 100%, whatever At large text says", () => {
    assert.equal(listForm(1, "wholeNames"), "plate2");
  });

  it("gives the name the Name lines knob's lines over the form's own", () => {
    assert.equal(bodyGrid(input({ nameLines: 1 })).nameLines, 1);
    assert.equal(bodyGrid(input({ textScale: 1.3, nameLines: 2 })).nameLines, 2);
    assert.equal(bodyGrid(input({ nameLines: 7 })).nameLines, 2);
  });
});

describe("the tiles", () => {
  it("draw 10 × 2 tiles of 64 at the game's own width, centred: 20 a screen", () => {
    const grid = bodyGrid(input({ body: "tiles" }));

    assert.deepEqual([grid.cols, grid.lines, grid.cellWidth, grid.x0, grid.y0], [10, 2, 64, 16, 0]);
  });

  it("add columns at the wider steps: Zones › Residential's 62 show 20 / 26 / 32 / 38 / 44", () => {
    assert.deepEqual(STEPS.map((boxWidth) => shown({ body: "tiles", boxWidth }, 62)), [20, 26, 32, 38, 44]);
  });

  it("follow Tile size: 68 gives 9 × 2, 72 one line of 9", () => {
    assert.equal(shown({ body: "tiles", tileSize: 68 }, 99), 18);
    assert.equal(shown({ body: "tiles", tileSize: 72 }, 99), 9);
  });

  it("leave 14.25 under two lines of 64 for the name line, and too little under 68", () => {
    assert.equal(bodyGrid(input({ body: "tiles" })).nameLine, 14.25);
    assert.ok(bodyGrid(input({ body: "tiles", tileSize: 68 })).nameLine < 14);
  });
});

describe("a slot's place", () => {
  it("runs left to right, then down", () => {
    const grid = bodyGrid(input());

    assert.deepEqual(slotPosition(grid, 0), { left: 0, top: 0 });
    assert.deepEqual(slotPosition(grid, 3), { left: 3 * 173, top: 0 });
    assert.deepEqual(slotPosition(grid, 5), { left: 173, top: 29.25 });
  });

  it("makes the slots as tall as their lines, and nothing for none", () => {
    const grid = bodyGrid(input());

    assert.equal(slotsHeight(grid, 20), ASSET_MENU_DEFAULT_HEIGHT);
    assert.equal(slotsHeight(grid, 21), ASSET_MENU_DEFAULT_HEIGHT + 29.25);
    assert.equal(slotsHeight(grid, 0), 0);
  });

  it("keeps a body too narrow or too short for one slot at one column and one line", () => {
    const grid = bodyGrid(input({ boxWidth: 100, bodyHeight: 5 }));

    assert.deepEqual([grid.cols, grid.lines], [1, 1]);
  });
});

describe("the line count", () => {
  it("counts the lines a height shows, the last with no gap below it: the game's own body holds 5 of 29.25", () => {
    assert.equal(wholeLines(144.25, 29.25), 5);
    assert.equal(wholeLines(144.24, 29.25), 4);
    assert.equal(wholeLines(0, 29.25), 1);
  });

  it("takes the gap in the height's own unit", () => {
    // 1.5 px a rem: the game's own body and its pitch in pixels, with the gap in pixels too.
    assert.equal(wholeLines(144.25 * 1.5, 29.25 * 1.5, 2 * 1.5), 5);
  });

  it("allows a device pixel of shortfall: the scroller reports whole pixels, 96 px for 144.25 rem at 720p", () => {
    // A pixel is 1.5 rem at 720p: 96 px reads back as 144.0 rem, and the next whole pixel down, 95 px, as 142.5.
    const pixel = deviceRem(720);

    assert.equal(pixel, 1.5);
    assert.equal(wholeLines(144, 29.25, 2, pixel), 5);
    assert.equal(wholeLines(142.5, 29.25, 2, pixel), 4);
    assert.equal(wholeLines(144, 29.25, 2), 4);
  });

  it("reads a device pixel in rem from the screen, none without one", () => {
    assert.equal(deviceRem(1080), 1);
    assert.equal(deviceRem(0), 0);
    assert.equal(deviceRem(Number.NaN), 0);
  });

  it("is the count the body draws: the grid takes the same pixel", () => {
    assert.equal(bodyGrid(input({ bodyHeight: 144, pixelRem: 1.5 })).lines, 5);
    assert.equal(bodyGrid(input({ bodyHeight: 142.5, pixelRem: 1.5 })).lines, 4);
    assert.equal(bodyGrid(input({ bodyHeight: 144 })).lines, 4);
  });
});

// Guards at the shortest body the box allows. The window rule itself is C#'s (BuildingCatalogQuery.Reach),
// held by AssetMenuScreenTests; these hold what the UI's side of it stands on.
describe("the shortest body", () => {
  it("asks for more only after a scroll, though the load-more band is taller than it", () => {
    const clientHeight = ASSET_MENU_MIN_HEIGHT;
    const scrollHeight = clientHeight + CATALOG_WINDOW_SCROLL_THRESHOLD;

    assert.equal(shouldLoadMore({ scrollTop: 0, clientHeight, scrollHeight }), false);
    assert.equal(shouldLoadMore({ scrollTop: 1, clientHeight, scrollHeight }), true);
  });

  // A geometry fact, not the window rule. 32:9's widest step is outside it: there the shortest body
  // already shows more than half a step, and the window is two screens rather than the step.
  it("shows at most half a step a screen at every 16:9 Width step under the shipped knobs", () => {
    const bodies: Array<Partial<BodyGridInput>> = [
      { body: "list" },
      { body: "list", textScale: 1.3 },
      { body: "list", textScale: 1.3, atLargeText: "wholeNames" },
      { body: "tiles" },
    ];
    for (const boxWidth of STEPS) {
      for (const body of bodies) {
        const slots = screenSlots(bodyGrid(input({ ...body, boxWidth, bodyHeight: ASSET_MENU_MIN_HEIGHT })));
        assert.ok(2 * slots <= CATALOG_WINDOW_STEP, `${boxWidth} ${JSON.stringify(body)}: ${slots}`);
      }
    }
  });
});
