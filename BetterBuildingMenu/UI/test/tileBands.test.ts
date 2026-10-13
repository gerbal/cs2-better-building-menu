import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { lookAlikeTags } from "../src/domain/lookAlikeTags";
import { CUT_MARK, plansWorkedOut } from "../src/domain/namePlan";
import { textWidth } from "../src/domain/textWidth";
import { bandWidth, bandWork, tileBands } from "../src/domain/tileBands";
import { TAG_FONT, TAG_PADDING, tagRoom } from "../src/domain/tileTag";

const tile = (id: number, name: string, distinctWord = "", isLocked = false): BuildingCatalogEntry => ({ id, name, prefabName: `P${id}`, distinctWord, isLocked } as BuildingCatalogEntry);
const tags = (entries: BuildingCatalogEntry[], tileWidth = 64, textScale = 1) => Object.fromEntries(lookAlikeTags(entries, tileWidth, textScale));
/** No band is said on two tiles. */
const unique = (said: Record<string, string>) => assert.equal(new Set(Object.values(said).map((text) => text.toLowerCase())).size, Object.keys(said).length, JSON.stringify(said));

describe("Plates' name bands", () => {
  const bands = (entries: BuildingCatalogEntry[], tileWidth = 64, textScale = 1) => Object.fromEntries(tileBands(entries, lookAlikeTags(entries, tileWidth, textScale), tileWidth, textScale));

  it("name each look-alike on its band, cut once between words to the band's line, its distinguishing word kept, and no tile alone", () => {
    const zones = [tile(1, "NA Low Density Cabin Housing", "Cabin"), tile(2, "NA Low Density Country Housing", "Country"), tile(3, "Stone Terrace Rowhomes")];

    assert.deepEqual(bands(zones, 120), { 1: `NA${CUT_MARK} Cabin Housing`, 2: `NA${CUT_MARK} Country Housing` });
    // Where no cut between whole words fits, never one inside a word: the tag.
    assert.deepEqual(bands(zones, 64), { 1: "Cabin", 2: "Country" });
  });

  it("say a whole name where it fits the band", () => {
    assert.deepEqual(bands([tile(1, "NA Pack", "Pack"), tile(2, "NA Trailer Homes", "Trailer")], 100), { 1: "NA Pack", 2: "NA Trailer Homes" });
  });

  it("say the tile's tag where a cut band could be another tile's name", () => {
    const run = [
      tile(1, "Oz Low Density Detached Housing", "Detached"),
      tile(2, "Oz Low Density Detached Cottages", "Housing"),
      tile(3, "Oz Low Density Detached Villas", "Housing"),
    ];
    const said = bands(run);
    const tags = Object.fromEntries(lookAlikeTags(run, 64, 1));

    unique(said);
    assert.ok(Object.entries(said).some(([id, text]) => text === tags[id]), JSON.stringify(said));
  });

  it("measure a band as its tag is, in the wider of the game's two fonts: a band that would run over says its tag, and no band is clipped", () => {
    // Two families counted alike, as Landscaping holds them: "#02" alone is said twice.
    const family = (stem: string, first: number) => [1, 2, 3].map((n) => ({ ...tile(first + n, `${stem} 0${n}`, `0${n}`), familyKey: stem, familyToken: `0${n}` }) as BuildingCatalogEntry);
    const stalls = [...family("Food Stall", 0), ...family("Cultivated Flower Bush", 10)];
    const zones = [tile(4, "FR Residential Low", "Residential"), tile(5, "FR Medium Density Row Housing", "Row"), tile(6, "FR Mixed Housing", "Mixed"), tile(7, "FR Low Rent Housing", "Low")];

    assert.deepEqual(bands(stalls, 64, 1.3), Object.fromEntries(lookAlikeTags(stalls, 64, 1.3)));
    assert.equal(bands(stalls, 64, 1.3)[2], "Stall #02");
    assert.equal(bands(zones, 64, 1.5)[4], tags(zones, 64, 1.5)[4]);
    for (const [entries, textScale] of [[stalls, 1.3], [zones, 1.5], [zones, 1]] as const) {
      // Measured as the tag measures itself, in the band it draws in.
      for (const text of Object.values(bands([...entries], 64, textScale))) {
        assert.ok(TAG_PADDING + textWidth(text, TAG_FONT * textScale, "wider") <= bandWidth(64, false), `${text} at ${textScale}`);
      }
    }
  });

  it("keep the word the tag tells a tile apart by, past a word like \"with\" and a single letter alike, or say the tag", () => {
    const runs: [BuildingCatalogEntry[], Record<number, string>][] = [
      [[tile(1, "Small Roundabout with an Asymmetric Center", "an"), tile(2, "Small Roundabout with a Tree and Bushes", "a"), tile(3, "Small Roundabout", "Roundabout")], { 1: "Asymmetric", 2: "Tree", 3: "Roundabout" }],
      [[tile(1, "20ft Container Trailer - K Line", "K"), tile(2, "20ft Container Trailer - Blue", "Blue"), tile(3, "20ft Container Trailer - Green", "Green")], { 1: "K", 2: "Blue", 3: "Green" }],
      [[tile(1, "CN Overpass T Junction", "T"), tile(2, "CN Overpass Roundabout", "Roundabout"), tile(3, "CN Overpass Crossing", "Crossing")], { 1: "T", 2: "Roundabout", 3: "Crossing" }],
    ];

    for (const [run, own] of runs) {
      for (const tileWidth of [64, 80, 100, 120]) {
        const tagged = tags(run, tileWidth);
        for (const [id, text] of Object.entries(bands(run, tileWidth))) {
          assert.ok(text === tagged[id] || text.split(CUT_MARK).join(" ").split(/\s+/).includes(own[Number(id)]), `${text} at ${tileWidth}`);
        }
      }
    }
    assert.notEqual(bands(runs[0][0], 100)[1], `Small${CUT_MARK} Center`);
    assert.notEqual(bands(runs[1][0], 64)[1], `20ft${CUT_MARK} Line`);
  });

  it("say the tile's tag where its band reads as another loaded tile's tag, drawn or not", () => {
    const page = [tile(1, "NA Pack", "Pack"), tile(2, "NA Trailer Homes", "Trailer")];
    // Tags as another pass might hand them over: tile 2's, which its own band stands in for, says tile 1's band.
    const handed = new Map([[1, "Pack"], [2, "NA Pack"]]);

    assert.deepEqual(Object.fromEntries(tileBands(page, handed, 100, 1)), { 1: "Pack", 2: "NA Trailer Homes" });
  });

  it("span the tile from the picture's inset as a tag may, and on a locked tile end at its lock glyph", () => {
    assert.equal(bandWidth(64, false), 62);
    assert.equal(bandWidth(64, true), 45);
    assert.equal(bandWidth(80, true), tagRoom(80, true));
  });

  describe("on a large page, worked out again at each push", () => {
    /** A word of letters alone, so it is no number a cut holds. */
    const letters = (n: number): string => (n < 26 ? "" : letters(Math.floor(n / 26) - 1)) + String.fromCharCode(97 + (n % 26));
    const alike = Array.from({ length: 2_000 }, (_, at) => tile(at + 1, `Oz Low Density Detached ${["Housing", "Cottages", "Villas", "Homes"][at % 4]} ${String(at).padStart(4, "0")}`, String(at).padStart(4, "0")));
    // Runs of every size, as a large menu holds them: numbered families, and look-alikes told apart by a word.
    const stems = ["Cultivated Flower Bush", "Wild Green Bush", "Texture Paint Tool", "Garden Hedge Corner", "Boardwalk Pier", "Shipping Container Stack", "Raised Planter", "Street Light Pole"];
    const varied = Array.from({ length: 1_806 }, (_, at) => {
      const stem = stems[at % stems.length];
      const token = String(Math.floor(at / stems.length) % 40 + 1).padStart(2, "0");
      return at % 3 === 0
        ? tile(at + 1, `${stem} ${letters(at)}`, letters(at))
        : ({ ...tile(at + 1, `${stem} ${token}`, token, at % 7 === 0), familyKey: stem, familyToken: token } as BuildingCatalogEntry);
    });

    for (const [what, page] of [["2,000 look-alikes", alike], ["1,806 tiles in runs", varied]] as const) {
      it(`names ${what}' bands in a bounded pass, and keeps them for a push of the same tiles`, () => {
        // At 150% on the smallest tile few names fit a band, so the larger text is read on a wider tile, where
        // the bands are checked as at 100%.
        for (const [textScale, tileWidth] of [[1, 64], [1.5, 96]] as const) {
          const at = `${textScale} on ${tileWidth}`;
          const tagged = lookAlikeTags(page, tileWidth, textScale);
          const first = tileBands(page, tagged, tileWidth, textScale);

          assert.equal(first.size, tagged.size);
          // The same tiles pushed again, a new array of new rows: the bands kept.
          assert.equal(tileBands(page.map((entry) => ({ ...entry })), tagged, tileWidth, textScale), first);
          // A page whose tags were worked out again, as a Load more or a keystroke does, every name already
          // cut: no name planned again; the page's names indexed once; each band checked against a few loaded
          // names, not the page; and the bands said twice turned to tags in a few passes over them, not one
          // pass a band.
          const [plannedBefore, before] = [plansWorkedOut(), bandWork()];
          tileBands([...page], new Map(tagged), tileWidth, textScale);
          const after = bandWork();
          const checked = [...first].filter(([id, text]) => text !== tagged.get(id)).length;

          assert.equal(plansWorkedOut(), plannedBefore, `plans at ${at}`);
          assert.ok(checked >= tagged.size / 4, `${checked} of ${tagged.size} bands say a name at ${at}`);
          assert.ok(after.indexed - before.indexed <= page.length, `${after.indexed - before.indexed} names indexed of ${page.length} at ${at}`);
          assert.ok(after.compared - before.compared >= checked, `${after.compared - before.compared} names compared for ${checked} named bands at ${at}`);
          assert.ok(after.compared - before.compared <= 4 * tagged.size, `${after.compared - before.compared} names compared for ${tagged.size} bands at ${at}`);
          assert.ok(after.counted - before.counted <= 4 * tagged.size, `${after.counted - before.counted} texts counted for ${tagged.size} bands at ${at}`);
        }
      });
    }
  });
});
