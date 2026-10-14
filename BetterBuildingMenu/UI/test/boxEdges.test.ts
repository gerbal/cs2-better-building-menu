import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { drawnBodyHeight } from "../src/domain/assetMenuLayout";
import { bodyGrid, lineSpacing, type BodyGridInput } from "../src/domain/bodyGeometry";
import { collapses, DOUBLE_PRESS_MS, GAME_MENU_SCREEN, heightOfLines, heightReadout, isDoublePress, restoreSizeCommand, setCollapsedCommand, snapToLines, widthReadout, type EdgeWords } from "../src/domain/boxEdges";
import { cardGeometry, cardLineSpacing } from "../src/domain/cardsLayout";
import { ASSET_MENU_DEFAULT_HEIGHT, ASSET_MENU_MAX_HEIGHT, ASSET_MENU_MIN_HEIGHT } from "../src/domain/sharedContracts.generated";

const spacingOf = (over: Partial<BodyGridInput>) =>
  lineSpacing({ body: "list", textScale: 1, atLargeText: "moreBuildings", tileSize: 64, plateHeight: 27.25, ...over });
const list = spacingOf({});
const tiles = spacingOf({ body: "tiles" });
const words: EdgeWords = {
  lines: "{0} lines · {1} buildings (game: {2})",
  linesOnly: "{0} lines (game: {1})",
  line: "{0} line · {1} buildings (game: {2})",
  lineOnly: "{0} line (game: {1})",
  collapse: "Release to collapse",
  width: "Width {0} · {1} buildings",
  widthOnly: "Width {0}",
};
/** The most body the box draws, under the top HUD's band. */
const ROOM = drawnBodyHeight(ASSET_MENU_MAX_HEIGHT);

describe("where a release of the top edge lands", () => {
  it("lands on whole List lines: five make the game's own 144.25, seven 202.75", () => {
    assert.equal(heightOfLines(5, list), ASSET_MENU_DEFAULT_HEIGHT);
    assert.equal(snapToLines(150, list), 144.25);
    assert.equal(snapToLines(190, list), 202.75);
    assert.equal(snapToLines(180, list), 173.5);
  });

  it("never lands under the drag's floor: the fewest whole lines at or above it, four List lines", () => {
    assert.equal(snapToLines(ASSET_MENU_MIN_HEIGHT, list), 115);
    assert.equal(snapToLines(20, list), 115);
  });

  it("never lands past the room the box draws its body in: the most whole lines that fit it", () => {
    const top = snapToLines(5000, list);

    assert.ok(ROOM < ASSET_MENU_MAX_HEIGHT);
    assert.ok(top <= ROOM && top + list.pitch > ROOM, `${top}`);
    assert.equal(top, heightOfLines(28, list));
  });

  it("lands near the top of the room on whole lines the body draws there, in every body at 100 % to 150 %", () => {
    const forms: Array<[string, Partial<BodyGridInput>]> = [
      ["list", {}],
      ["list, whole names", { atLargeText: "wholeNames" }],
      ["tiles", { body: "tiles" }],
      ["tiles in Plates", { body: "tiles", tileNameLine: false }],
      ["tiles of 100", { body: "tiles", tileSize: 100 }],
      ["tiles of 120", { body: "tiles", tileSize: 120 }],
      ["icons", { body: "icons" }],
      ["icons of 36", { body: "icons", iconSize: 36 }],
    ];
    const input = (over: Partial<BodyGridInput>, textScale: number, bodyHeight: number): BodyGridInput =>
      ({ body: "list", boxWidth: 706, bodyHeight, textScale, atLargeText: "moreBuildings", tileSize: 64, plateHeight: 27.25, nameLines: 0, ...over });

    for (const textScale of [1, 1.3, 1.5]) {
      for (let pointer = ROOM - 90; pointer <= ROOM; pointer += 0.75) {
        for (const [name, over] of forms) {
          const spacing = lineSpacing(input(over, textScale, 0));
          const landed = snapToLines(pointer, spacing);
          const drawn = bodyGrid(input(over, textScale, drawnBodyHeight(landed))).lines;

          assert.ok(landed <= ROOM, `${name} at ${textScale}, ${pointer}: ${landed}`);
          assert.equal(heightOfLines(drawn, spacing), landed, `${name} at ${textScale}, ${pointer}`);
        }
        for (const knob of [46, 50, 60]) {
          const spacing = cardLineSpacing(knob, textScale);
          const landed = snapToLines(pointer, spacing);

          assert.ok(landed <= ROOM, `cards of ${knob} at ${textScale}, ${pointer}: ${landed}`);
          assert.equal(heightOfLines(cardGeometry(knob, drawnBodyHeight(landed), textScale).lines, spacing), landed, `cards of ${knob} at ${textScale}, ${pointer}`);
        }
      }
    }
  });

  it("keeps the tiles' name line under their whole lines", () => {
    assert.equal(heightOfLines(2, tiles), 144);
    assert.equal(snapToLines(150, tiles), 144);
    assert.equal(snapToLines(190, tiles), 210);
  });

  it("lands on the icons', the large-text plates' and the cards' own lines", () => {
    assert.equal(snapToLines(150, spacingOf({ body: "icons" })), 136);
    // One-line plates keep their picture's overhang above the first and below the last.
    assert.equal(snapToLines(150, spacingOf({ textScale: 1.3 })), 144);
    assert.equal(snapToLines(150, spacingOf({ textScale: 1.3, atLargeText: "wholeNames" })), 144.24);
    assert.equal(snapToLines(150, cardLineSpacing(46, 1)), 142);
  });

  it("holds a height it cannot read, or lines with no length, to the drag's range", () => {
    assert.equal(snapToLines(Number.NaN, list), ASSET_MENU_DEFAULT_HEIGHT);
    assert.equal(snapToLines(40, { pitch: 0, gap: 2, edge: 0, below: 0 }), ASSET_MENU_MIN_HEIGHT);
  });
});

describe("the readout while the top edge is dragged", () => {
  it("names the lines the release lands on, the buildings they show and the game's own", () => {
    assert.equal(heightReadout(7, 28, words, String), "7 lines · 28 buildings (game: 18)");
    assert.equal(GAME_MENU_SCREEN, 18);
  });

  it("names one line as one", () => {
    assert.equal(heightReadout(1, 6, words, String), "1 line · 6 buildings (game: 18)");
    assert.equal(heightReadout(1, null, words, String), "1 line (game: 18)");
  });

  it("names the lines alone where the body cannot count its buildings, as the cards", () => {
    assert.equal(heightReadout(3, null, words, String), "3 lines (game: 18)");
  });

  it("writes each number as the language groups it", () => {
    assert.equal(heightReadout(32, 1280, words, (count) => count.toLocaleString("en-US")), "32 lines · 1,280 buildings (game: 18)");
  });
});

describe("a release below the body's floor", () => {
  it("collapses the box under the floor, and nowhere from the floor up", () => {
    assert.equal(collapses(ASSET_MENU_MIN_HEIGHT - 0.01), true);
    assert.equal(collapses(0), true);
    assert.equal(collapses(ASSET_MENU_MIN_HEIGHT), false);
    assert.equal(collapses(ASSET_MENU_DEFAULT_HEIGHT), false);
  });

  it("tells C# the box collapsed or opened, which it saves", () => {
    assert.deepEqual(setCollapsedCommand(true), { method: "SetAssetMenuCollapsed", args: [true] });
    assert.deepEqual(setCollapsedCommand(false), { method: "SetAssetMenuCollapsed", args: [false] });
  });
});

describe("a double press on the top edge", () => {
  const first = { at: 1000, x: 500, y: 300 };

  it("is a second press within 400 ms of a click, under three pixels from it", () => {
    assert.equal(DOUBLE_PRESS_MS, 400);
    assert.equal(isDoublePress(first, { at: 1400, x: 502, y: 298 }), true);
    assert.equal(isDoublePress(first, { at: 1000, x: 500, y: 300 }), true);
  });

  it("is not one later, three pixels or more away, after no click, or with the clock gone back", () => {
    assert.equal(isDoublePress(first, { at: 1401, x: 500, y: 300 }), false);
    assert.equal(isDoublePress(first, { at: 1200, x: 503, y: 300 }), false);
    assert.equal(isDoublePress(first, { at: 1200, x: 500, y: 297 }), false);
    assert.equal(isDoublePress(null, { at: 1200, x: 500, y: 300 }), false);
    assert.equal(isDoublePress(first, { at: 900, x: 500, y: 300 }), false);
  });

  it("asks C# for the game's own size, once", () => {
    assert.deepEqual(restoreSizeCommand(), { method: "RestoreAssetMenuSize", args: [] });
  });
});

describe("the readout while a side edge is dragged", () => {
  it("names the step the release lands on and the buildings its width shows", () => {
    assert.equal(widthReadout(3, 30, words, String), "Width 3 · 30 buildings");
  });

  it("names the step alone where the body cannot count its buildings, as the cards", () => {
    assert.equal(widthReadout(5, null, words, String), "Width 5");
  });
});
