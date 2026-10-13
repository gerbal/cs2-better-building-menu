import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bodyCells, type BlockLabels } from "../src/domain/bodyCells";
import { bodyGrid, deviceRem, labelPlace, labelSlots, listForm, screenSlots, slotPosition, slotsHeight, wholeLines, type BodyGridInput } from "../src/domain/bodyGeometry";
import type { BuildingCatalogEntry, CatalogSection } from "../src/domain/buildingCatalog";
import { CATALOG_WINDOW_SCROLL_THRESHOLD, CATALOG_WINDOW_STEP, shouldLoadMore } from "../src/domain/catalogWindow";
import { ASSET_MENU_DEFAULT_HEIGHT, ASSET_MENU_MIN_HEIGHT } from "../src/domain/sharedContracts.generated";
import { REFERENCE_ASPECT, widthStepWidths } from "../src/domain/widthSteps";
import { declarationsOf } from "./harness/compiledCss";

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

  it("fills the game's own body with both forms' lines, each picture whole inside it", () => {
    for (const atLargeText of ["moreBuildings", "wholeNames"]) {
      const grid = bodyGrid(input({ textScale: 1.3, atLargeText }));
      const height = slotsHeight(grid, screenSlots(grid));
      assert.ok(height <= ASSET_MENU_DEFAULT_HEIGHT && height > ASSET_MENU_DEFAULT_HEIGHT - 0.5, `${atLargeText}: ${height}`);
    }
  });

  it("draws the one-line plate's 24 rem picture whole: six plates of 22, the picture over each a rem above and below", () => {
    const grid = bodyGrid(input({ textScale: 1.3 }));
    const picture = 24;
    const overhang = (picture - grid.cellHeight) / 2;
    const lastPicture = slotPosition(grid, 15).top + grid.cellHeight + overhang;

    assert.deepEqual([grid.cellHeight, grid.y0, grid.pitchY, grid.lines], [22, 1, 24, 6]);
    // The first line's picture starts at the body's top, and the last line's ends inside its foot.
    assert.equal(slotPosition(grid, 0).top - overhang, 0);
    assert.ok(lastPicture <= ASSET_MENU_DEFAULT_HEIGHT, `${lastPicture}`);
    assert.equal(slotsHeight(grid, 18), lastPicture);
  });

  it("keeps a grown one-line plate's picture inside it, from the body's top", () => {
    assert.equal(bodyGrid(input({ textScale: 1.3, menuRows: 7, smallMenusGrow: true })).y0, 0);
  });

  it("keeps the grown one-line plates' and the big form's geometry, from the body's top to its foot", () => {
    const oneLine = bodyGrid(input({ textScale: 1.3, menuRows: 7, smallMenusGrow: true }));
    const big = bodyGrid(input({ menuRows: 7, smallMenusGrow: true }));

    assert.deepEqual([oneLine.form, oneLine.lines, oneLine.cellHeight, oneLine.pitchY, oneLine.y0], ["plate1", 3, 46.75, 48.75, 0]);
    assert.deepEqual([big.form, big.lines, big.cellHeight, big.pitchY, big.y0, big.picture], ["big", 2, 71.125, 73.125, 0, 66]);
    assert.equal(slotsHeight(oneLine, 7), ASSET_MENU_DEFAULT_HEIGHT);
    assert.equal(slotsHeight(big, 7), ASSET_MENU_DEFAULT_HEIGHT);
  });

  it("draws the form's own one-line plates where a menu's labels would grow it to plates shorter than their picture", () => {
    // Fifteen rows and a label's slot: six lines, as many as the form's own, of plates under 24.
    const grid = bodyGrid(input({ textScale: 1.3, menuRows: 15, drawnSlots: 16, smallMenusGrow: true }));

    assert.deepEqual([grid.form, grid.lines, grid.cellHeight, grid.y0], ["plate1", 6, 22, 1]);
    assert.ok(slotsHeight(grid, 16) <= 144, `${slotsHeight(grid, 16)}`);
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

describe("the icons", () => {
  it("draw 15 × 3 of 44 on a 46 pitch at the game's own width, the block centred: 45 a screen", () => {
    const grid = bodyGrid(input({ body: "icons" }));

    assert.equal(grid.form, "icon");
    assert.deepEqual([grid.cols, grid.lines, grid.cellWidth, grid.pitchX, grid.picture, grid.x0, grid.y0], [15, 3, 44, 46, 42, 1, 4.125]);
    assert.equal(screenSlots(grid), 45);
    // The 136 rem block sits 4.125 from the body's top and foot: no sliver scrolls.
    assert.equal(slotsHeight(grid, 45), ASSET_MENU_DEFAULT_HEIGHT);
  });

  it("add columns at the wider steps, never lines: Landscaping shows 45 / 57 / 69 / 81 / 93", () => {
    assert.deepEqual(STEPS.map((boxWidth) => shown({ body: "icons", boxWidth }, 1806)), [45, 57, 69, 81, 93]);
  });

  it("follow the Icon size knob, whatever the text scale", () => {
    assert.equal(shown({ body: "icons", iconSize: 36 }, 1806), 18 * 3);
    assert.equal(shown({ body: "icons", iconSize: 56 }, 1806), 11 * 2);
    assert.equal(shown({ body: "icons", textScale: 1.3 }, 1806), 45);
  });

  it("give a label two icons' slots, 90 × 44; the list and the tiles one", () => {
    const icons = bodyGrid(input({ body: "icons" }));

    assert.equal(labelSlots(icons), 2);
    assert.deepEqual(labelPlace(icons, 0, labelSlots(icons)), { left: 1, top: 4.125, width: 90, height: 44 });
    assert.equal(labelSlots(bodyGrid(input({ body: "tiles" }))), 1);
    assert.equal(labelSlots(bodyGrid(input())), 1);
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

describe("the first step's columns", () => {
  it("are the list's four at 100% text and three above it at every step, and the tiles' ten", () => {
    assert.deepEqual(STEPS.map((boxWidth) => bodyGrid(input({ boxWidth })).firstCols), [4, 4, 4, 4, 4]);
    assert.equal(bodyGrid(input({ boxWidth: STEPS[2], textScale: 1.3 })).firstCols, 3);
    assert.equal(bodyGrid(input({ boxWidth: STEPS[2], body: "tiles" })).firstCols, 10);
  });
});

describe("a small menu's list", () => {
  const grown = (over: Partial<BodyGridInput>) => bodyGrid(input({ smallMenusGrow: true, ...over }));

  it("grows a menu of four lines' rows or fewer into the lines they fill: Water's 16 in 4 lines of 34.56", () => {
    const grid = grown({ menuRows: 16 });

    assert.equal(grid.form, "plate2");
    assert.deepEqual([grid.cols, grid.lines, grid.cellHeight, grid.pitchY], [4, 4, 34.5625, 36.5625]);
  });

  it("draws a menu that fills two lines in the big form, its picture up to 66: Garbage's 7", () => {
    const grid = grown({ menuRows: 7 });

    assert.equal(grid.form, "big");
    assert.deepEqual([grid.cols, grid.lines, grid.cellHeight, grid.picture], [4, 2, 71.125, 66]);
    assert.equal(screenSlots(grid), 8);
  });

  it("keeps the lines a menu grew to at the first step and adds columns at the wider ones", () => {
    const grid = grown({ menuRows: 7, boxWidth: STEPS[2] });

    assert.deepEqual([grid.form, grid.cols, grid.lines, grid.cellHeight], ["big", 6, 2, 71.125]);
    assert.deepEqual(STEPS.map((boxWidth) => grown({ menuRows: 16, boxWidth }).lines), [4, 4, 4, 4, 4]);
  });

  it("grows above 100% text from three columns of six lines: 15 or fewer", () => {
    assert.equal(grown({ menuRows: 15, textScale: 1.3 }).lines, 5);
    assert.equal(grown({ menuRows: 16, textScale: 1.3 }).lines, 6);
  });

  it("gives a grown one-line plate two name lines where it has room for them, unless the Name lines knob says one", () => {
    // Garbage's 7 at 130%: three lines of 46.75, where two name lines need 32.5 and the plate's padding.
    const garbage = grown({ menuRows: 7, textScale: 1.3 });

    assert.deepEqual([garbage.form, garbage.lines, garbage.cellHeight, garbage.nameLines], ["plate1", 3, 46.75, 2]);
    assert.equal(grown({ menuRows: 15, textScale: 1.3 }).nameLines, 1);
    assert.equal(grown({ menuRows: 7, textScale: 1.3, nameLines: 1 }).nameLines, 1);
  });

  it("never grows a menu past the threshold, an uncounted one, the tiles, or with the knob off", () => {
    assert.equal(grown({ menuRows: 17 }).lines, 5);
    assert.equal(grown({ menuRows: 0 }).lines, 5);
    assert.equal(grown({ menuRows: 7, body: "tiles" }).lines, 2);
    assert.equal(grown({ menuRows: 7, body: "tiles" }).cellHeight, 64);
    assert.equal(bodyGrid(input({ menuRows: 7, smallMenusGrow: false })).lines, 5);
  });

  it("leaves a device pixel under its lines, so a body the scroller reads in whole pixels holds them with no scroll", () => {
    // The game's own body, 144.25 rem, reads back as 144.0 at 1080p and at 720p alike.
    for (const pixelRem of [deviceRem(1080), deviceRem(720)]) {
      for (const menuRows of [7, 16]) {
        const grid = grown({ menuRows, pixelRem });

        assert.ok(slotsHeight(grid, menuRows) <= 144, `${menuRows} rows at ${pixelRem}: ${slotsHeight(grid, menuRows)}`);
        assert.ok(slotsHeight(grid, menuRows) >= 144.25 - pixelRem - 1e-9, `${menuRows} rows at ${pixelRem}`);
      }
    }
    const garbage = grown({ menuRows: 7, pixelRem: 1 });
    assert.deepEqual([garbage.form, garbage.picture], ["big", 66]);
  });

  it("draws the big form above 100% text where a body dragged tall gives it the room", () => {
    // Two lines at 130%, each as tall as the big form's floor there: two name and number lines and 10 to spare.
    const floor = 2 * (12.5 + 12) * 1.3 + 10;
    const tall = grown({ menuRows: 3, textScale: 1.3, bodyHeight: 2 * floor + 2.01 });

    assert.deepEqual([tall.form, tall.lines, tall.nameLines, tall.picture], ["big", 2, 2, 66]);
    assert.equal(grown({ menuRows: 3, textScale: 1.3, bodyHeight: 2 * floor + 1.9 }).form, "plate1");
  });

  it("draws the big form from two of the stylesheet's name lines and number lines and 10 rem to spare", () => {
    // Two lines of plates as tall as the big form's floor, and a sixteenth short of it.
    const floor = 2 * (scaled(".name", "line-height") + scaled(".numbers", "line-height")) + 10;
    const at = (cellHeight: number) => grown({ menuRows: 7, bodyHeight: 2 * cellHeight + 2 }).form;

    assert.equal(floor, 59);
    assert.equal(at(floor), "big");
    assert.equal(at(floor - 0.0625), "plate2");
  });
});

/** A list length the stylesheet scales with the game's text, as calc(N rem * var(--fontScale)), at 100%. */
function scaled(selector: string, prop: string): number {
  const value = declarationsOf("mods/Bodies/listBody.module.scss", selector)[prop];
  const factor = /^calc\((\d*\.?\d+)rem \* var\(--fontScale\)\)$/.exec(value ?? "");
  assert.ok(factor, `${selector} ${prop} is ${value}`);
  return Number(factor[1]);
}

describe("a small menu's list with labels", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, at) => ({ id: at + 1 }) as BuildingCatalogEntry);
  const locked = (start: number, count: number): CatalogSection =>
    ({ id: "locked", kind: "locked", label: "", labelId: "", start, count, collapsed: false });
  /** The grid for a menu of these rows, with the slots its body draws at its columns, labels included. */
  const drawn = (count: number, sections: CatalogSection[], blockLabels: BlockLabels, over: Partial<BodyGridInput> = {}) => {
    const plain = bodyGrid(input({ smallMenusGrow: true, menuRows: count, ...over }));
    const slots = bodyCells(rows(count), sections, plain.cols, blockLabels).slots;
    return { grid: bodyGrid(input({ smallMenusGrow: true, menuRows: count, drawnSlots: slots, ...over })), slots };
  };

  it("gains the line a label's slot needs, so Water's 16 and its Locked label stay inside the body", () => {
    const { grid, slots } = drawn(16, [locked(8, 8)], "inline");

    assert.equal(slots, 17);
    assert.equal(grid.lines, 5);
    assert.ok(slotsHeight(grid, slots) <= ASSET_MENU_DEFAULT_HEIGHT, `${slotsHeight(grid, slots)}`);
    for (const pixelRem of [deviceRem(1080), deviceRem(720)]) {
      const { grid: atScreen } = drawn(16, [locked(8, 8)], "inline", { pixelRem });
      assert.ok(slotsHeight(atScreen, slots) <= 144, `${pixelRem}: ${slotsHeight(atScreen, slots)}`);
    }
  });

  it("gains the lines own-line labels take: Garbage's 7 with its Locked label on a line of its own", () => {
    // Three buildable rows, the label's line, then four locked rows: twelve slots at four across.
    const { grid, slots } = drawn(7, [locked(3, 4)], "ownLine");

    assert.equal(slots, 12);
    assert.deepEqual([grid.lines, grid.cellHeight, grid.form], [3, 46.75, "plate2"]);
    assert.ok(slotsHeight(grid, slots) <= ASSET_MENU_DEFAULT_HEIGHT);
  });

  it("keeps a menu's own growth where its labels fit the lines it grew to, and the form's own where they need more", () => {
    const garbage = drawn(7, [locked(4, 3)], "inline").grid;
    // More slots than the form's own lines show: the list scrolls, as it does for a menu that never grew.
    const past = bodyGrid(input({ smallMenusGrow: true, menuRows: 16, drawnSlots: 21 }));

    assert.deepEqual([garbage.lines, garbage.form], [2, "big"]);
    assert.deepEqual([past.lines, past.cellHeight], [5, 27.25]);
  });
});
