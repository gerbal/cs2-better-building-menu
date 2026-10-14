import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lineSpacing, type BodyGridInput } from "../src/domain/bodyGeometry";
import { GAME_MENU_SCREEN, heightOfLines, heightReadout, snapToLines, type EdgeWords } from "../src/domain/boxEdges";
import { cardLineSpacing } from "../src/domain/cardsLayout";
import { ASSET_MENU_DEFAULT_HEIGHT, ASSET_MENU_MAX_HEIGHT, ASSET_MENU_MIN_HEIGHT } from "../src/domain/sharedContracts.generated";

const spacingOf = (over: Partial<BodyGridInput>) =>
  lineSpacing({ body: "list", textScale: 1, atLargeText: "moreBuildings", tileSize: 64, plateHeight: 27.25, ...over });
const list = spacingOf({});
const tiles = spacingOf({ body: "tiles" });
const words: EdgeWords = { lines: "{0} lines · {1} buildings (game: {2})", linesOnly: "{0} lines (game: {1})" };

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

  it("never lands over the drag's ceiling: the most whole lines under it", () => {
    const top = snapToLines(5000, list);

    assert.ok(top <= ASSET_MENU_MAX_HEIGHT && top + list.pitch > ASSET_MENU_MAX_HEIGHT, `${top}`);
    assert.equal(top, heightOfLines(32, list));
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

  it("names the lines alone where the body cannot count its buildings, as the cards", () => {
    assert.equal(heightReadout(3, null, words, String), "3 lines (game: 18)");
  });

  it("writes each number as the language groups it", () => {
    assert.equal(heightReadout(32, 1280, words, (count) => count.toLocaleString("en-US")), "32 lines · 1,280 buildings (game: 18)");
  });
});
