import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { lookAlikeTags } from "../src/domain/lookAlikeTags";
import { tagFits } from "../src/domain/tileTag";

const tile = (id: number, name: string, distinctWord = ""): BuildingCatalogEntry => ({ id, name, prefabName: `P${id}`, distinctWord } as BuildingCatalogEntry);
/** The smallest tile Tile size allows, at 100% text. */
const fits = (text: string) => tagFits(text, 64, 1);
const tags = (entries: BuildingCatalogEntry[], fit: (text: string, entry: BuildingCatalogEntry) => boolean = fits) => Object.fromEntries(lookAlikeTags(entries, fit));

describe("the tiles' look-alike tags", () => {
  it("tag every member of a run sharing a first word by the word that tells it apart, and no tile alone", () => {
    assert.deepEqual(tags([
      tile(1, "NA Low Density Basic Housing", "Basic"),
      tile(2, "NA Low Density Classic Housing", "Classic"),
      tile(3, "NA Low Density Housing", "Housing"),
      tile(4, "Modern Brick SF Rowhomes"),
    ]), { 1: "Basic", 2: "Classic", 3: "Housing" });
  });

  it("say a whole name that fits the tag", () => {
    assert.deepEqual(tags([tile(1, "NA Pack", "Pack"), tile(2, "NA Mobile Homes", "Mobile")]), { 1: "NA Pack", 2: "Mobile" });
  });

  it("are unique on the screen, across two runs too: two words where one would be said twice", () => {
    const two = tags([
      tile(1, "CHI Residential Low Row", "Low"),
      tile(2, "CHI Residential Medium Row", "Medium"),
      tile(3, "UK Low Density Housing", "Low"),
      tile(4, "UK Medium Density Housing", "Medium"),
    ]);

    assert.equal(new Set(Object.values(two)).size, 4, JSON.stringify(two));
    // The run's word tells two runs apart where the next word does not fit.
    assert.deepEqual(two, { 1: "Low Row", 2: "Medium", 3: "UK Low", 4: "UK Medium" });
  });

  it("are unique in their run: two words where one would be said twice", () => {
    const run = tags([
      tile(1, "UK Low Density Detached Housing", "Detached"),
      tile(2, "UK Low Density Detached Cottages", "Housing"),
      tile(3, "UK Low Density Detached Villas", "Housing"),
    ]);

    assert.equal(new Set(Object.values(run)).size, 3, JSON.stringify(run));
  });

  it("are never a bare number: a number says #02", () => {
    assert.deepEqual(tags([tile(1, "Four-Lane Road 1", "1"), tile(2, "Four-Lane Road 2", "2")]), { 1: "#01", 2: "#02" });
    assert.equal(tags([tile(1, "Plaza Corner 5b", "5b"), tile(2, "Plaza Corner 6b", "6b")])[1], "#05b");
  });

  it("find a run whatever the first word's case", () => {
    assert.deepEqual(Object.keys(tags([tile(1, "custom Plaza Long", "Long"), tile(2, "Custom Plaza Wide", "Wide")])), ["1", "2"]);
  });

  it("never read as another tile drawn: a tag that says another's name takes its next form, else none", () => {
    const zones = [
      tile(1, "NA Low Density Housing", "Housing"),
      tile(2, "NA Low Density Basic Housing", "Basic"),
      tile(3, "housing"),
    ];

    assert.deepEqual(tags(zones, (text) => tagFits(text, 100, 1)), { 1: "Density Housing", 2: "Basic" });
    // On the smallest tile no other form fits: the tile goes untagged rather than read as Housing.
    assert.deepEqual(tags(zones), { 2: "Basic" });
  });

  it("never open on a separator: a distinguishing word that only parts two others gives way to the word after it", () => {
    // Room for a word or two, never the whole name.
    const short = (text: string) => text.length <= 10;
    const parted = tags([tile(1, "Plaza Corner Mirrored", "Corner"), tile(2, "Plaza - Mirrored", "-")], short);

    assert.deepEqual(parted, { 1: "Corner", 2: "Mirrored" });
  });

  it("say two words without opening or ending on a separator", () => {
    const short = (text: string) => text.length <= 16;
    const parted = tags([
      tile(1, "Plaza Basic - Mirrored", "Basic"),
      tile(2, "Square Basic Corner", "Basic"),
      tile(3, "Plaza Long Corner", "Long"),
      tile(4, "Square Long - Wide", "Long"),
    ], short);

    assert.equal(parted[1], "Basic - Mirrored", JSON.stringify(parted));
    for (const tag of Object.values(parted)) assert.doesNotMatch(tag, /^[-–—,]|[-–—,]$/u, JSON.stringify(parted));
  });

  it("cut a name once by the name planner where no form in words tells it apart, its distinguishing word and its numbers whole", () => {
    const wide = (text: string) => tagFits(text, 120, 1);
    const cut = tags([tile(1, "Alpha Basic Housing Quarter 01", "Basic"), tile(2, "Alpha Basic Housing Quarter 02", "Basic")], wide);

    assert.equal(new Set(Object.values(cut)).size, 2, JSON.stringify(cut));
    for (const [id, number] of [[1, "01"], [2, "02"]] as const) {
      assert.match(cut[id], /…/u, JSON.stringify(cut));
      assert.match(cut[id], /\bBasic\b/u, JSON.stringify(cut));
      assert.ok(cut[id].endsWith(` ${number}`), JSON.stringify(cut));
      assert.ok(wide(cut[id]), cut[id]);
    }
  });

  it("cut the word that tells a tile apart inside it only where that word alone is wider than the tag", () => {
    const roofs = tags([tile(1, "NL Low Density Gable-Roof Housing", "Gable-Roof"), tile(2, "NL Low Density Gambrel-Roof Housing", "Gambrel-Roof")]);

    assert.equal(roofs[1], "Gable-Roof");
    assert.match(roofs[2], /^Gam.*….*oof$/u, JSON.stringify(roofs));
    assert.ok(fits(roofs[2]), roofs[2]);
    // A number is never cut: a tile whose only word is a number too wide for the tag goes untagged.
    assert.deepEqual(tags([tile(1, "Plaza 12345678901234", "12345678901234"), tile(2, "Plaza Corner", "Corner")]), { 2: "Corner" });
  });

  it("cut a name once: never inside a word as well as between words", () => {
    const large = (text: string) => tagFits(text, 64, 1.3);
    const bridges = tags([
      tile(1, "Four-Lane Truss Arch Bridge 1", "1"),
      tile(2, "Four-Lane Truss Arch Bridge 2", "2"),
      tile(3, "Wide Quay With Four-Lane Road 1", "1"),
      tile(4, "Wide Quay With Four-Lane Road 2", "2"),
    ], large);

    assert.deepEqual(bridges, { 1: "#01", 2: "#02", 3: "Wide… 1", 4: "Wide… 2" });
  });

  it("say the word that tells a tile apart where no form tells two apart, never a longer form that tells no more", () => {
    assert.deepEqual(tags([tile(1, "Plaza, north gate open", "open"), tile(2, "Plaza, south gate open", "open")]), { 1: "open", 2: "open" });
  });

  it("never stand on a word like \"with\" alone: the word after it tells the tile apart", () => {
    assert.deepEqual(tags([tile(1, "Five-Lane Road", ""), tile(2, "Five-Lane Road with Median", "with")]), { 1: "Road", 2: "Median" });
  });

  it("measure each tile's tag in its own room: a locked tile's beside its lock glyph", () => {
    const run = [tile(1, "NA Pack", "Pack"), tile(2, "NA Mobile Homes", "Mobile")];

    assert.equal(tags(run)[1], "NA Pack");
    assert.equal(tags(run, (text, entry) => tagFits(text, 64, 1, entry.id === 1))[1], "Pack");
  });
});
