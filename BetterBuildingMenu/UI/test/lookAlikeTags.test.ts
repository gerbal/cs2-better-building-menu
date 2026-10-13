import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { lookAlikeKey, lookAlikeTags } from "../src/domain/lookAlikeTags";
import { tagFits } from "../src/domain/tileTag";

const tile = (id: number, name: string, distinctWord = "", isLocked = false): BuildingCatalogEntry => ({ id, name, prefabName: `P${id}`, distinctWord, isLocked } as BuildingCatalogEntry);
/** The smallest tile Tile size allows, at 100% text. */
const fits = (text: string) => tagFits(text, 64, 1);
const tags = (entries: BuildingCatalogEntry[], tileWidth = 64, textScale = 1) => Object.fromEntries(lookAlikeTags(entries, tileWidth, textScale));
/** No tag is said on two tiles. */
const unique = (said: Record<string, string>) => assert.equal(new Set(Object.values(said).map((tag) => tag.toLowerCase())).size, Object.keys(said).length, JSON.stringify(said));

describe("the tiles' look-alike tags", () => {
  it("tag every member of a run sharing a first word by the word that tells it apart, and no tile alone", () => {
    assert.deepEqual(tags([
      tile(1, "NA Low Density Cabin Housing", "Cabin"),
      tile(2, "NA Low Density Country Housing", "Country"),
      tile(3, "NA Low Density Housing", "Housing"),
      tile(4, "Stone Terrace Rowhomes"),
    ]), { 1: "Cabin", 2: "Country", 3: "Housing" });
  });

  it("say a whole name that fits the tag", () => {
    assert.deepEqual(tags([tile(1, "NA Pack", "Pack"), tile(2, "NA Trailer Homes", "Trailer")]), { 1: "NA Pack", 2: "Trailer" });
  });

  it("are unique on the screen, across two runs too: two words where one would be said twice", () => {
    const two = tags([
      tile(1, "Bay Residential Low Row", "Low"),
      tile(2, "Bay Residential Medium Row", "Medium"),
      tile(3, "Oz Low Density Housing", "Low"),
      tile(4, "Oz Medium Density Housing", "Medium"),
    ]);

    unique(two);
    // The run's word tells two runs apart where the next word does not fit.
    assert.deepEqual(two, { 1: "Low Row", 2: "Medium", 3: "Oz Low", 4: "Oz Medium" });
  });

  it("are unique in their run: two words where one would be said twice", () => {
    const run = tags([
      tile(1, "Oz Low Density Detached Housing", "Detached"),
      tile(2, "Oz Low Density Detached Cottages", "Housing"),
      tile(3, "Oz Low Density Detached Villas", "Housing"),
    ]);

    unique(run);
    assert.equal(Object.keys(run).length, 3);
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
      tile(2, "NA Low Density Cabin Housing", "Cabin"),
      tile(3, "housing"),
    ];

    assert.deepEqual(tags(zones, 100), { 1: "Density Housing", 2: "Cabin" });
    // On the smallest tile no other form fits: the tile goes untagged rather than read as Housing.
    assert.deepEqual(tags(zones), { 2: "Cabin" });
  });

  it("never open on a separator: a distinguishing word that only parts two others gives way to the word after it", () => {
    const parted = tags([tile(1, "Plaza Corner Mirrored", "Corner"), tile(2, "Plaza - Mirrored", "-")]);

    assert.deepEqual(parted, { 1: "Corner", 2: "Mirrored" });
  });

  it("say two words without opening or ending on a separator", () => {
    const parted = tags([
      tile(1, "Plaza Basic - Mirrored", "Basic"),
      tile(2, "Square Basic Corner", "Basic"),
      tile(3, "Plaza Long Corner", "Long"),
      tile(4, "Square Long - Wide", "Long"),
    ], 100);

    assert.equal(parted[1], "Basic - Mirrored", JSON.stringify(parted));
    for (const tag of Object.values(parted)) assert.doesNotMatch(tag, /^[-–—,]|[-–—,]$/u, JSON.stringify(parted));
  });

  it("cut a name once by the name planner where no form in words tells it apart, its distinguishing word and its numbers whole", () => {
    const wide = (text: string) => tagFits(text, 120, 1);
    const cut = tags([tile(1, "Alpha Basic Housing Quarter 01", "Basic"), tile(2, "Alpha Basic Housing Quarter 02", "Basic")], 120);

    unique(cut);
    for (const [id, number] of [[1, "01"], [2, "02"]] as const) {
      assert.match(cut[id], /…/u, JSON.stringify(cut));
      assert.match(cut[id], /\bBasic\b/u, JSON.stringify(cut));
      assert.ok(cut[id].endsWith(` ${number}`), JSON.stringify(cut));
      assert.ok(wide(cut[id]), cut[id]);
    }
  });

  it("cut the word that tells a tile apart inside it only where that word alone is wider than the tag", () => {
    const roofs = tags([tile(1, "Oz Low Density Gable-Roof Housing", "Gable-Roof"), tile(2, "Oz Low Density Mansard-Roof Housing", "Mansard-Roof")]);

    assert.equal(roofs[1], "Gable-Roof");
    // A hyphenated word keeps a readable head: "M…of" could be another roof.
    assert.equal(roofs[2], "Mansard…", JSON.stringify(roofs));
    assert.ok(fits(roofs[2]), roofs[2]);
    // A number is never cut: a tile whose only word is a number too wide for the tag goes untagged.
    assert.deepEqual(tags([tile(1, "Plaza 12345678901234", "12345678901234"), tile(2, "Plaza Corner", "Corner")]), { 2: "Corner" });
  });

  it("cut a name once: never inside a word as well as between words", () => {
    const bridges = tags([
      tile(1, "Four-Lane Steel Arch Bridge 1", "1"),
      tile(2, "Four-Lane Steel Arch Bridge 2", "2"),
      tile(3, "Wide Quay With Four-Lane Road 1", "1"),
      tile(4, "Wide Quay With Four-Lane Road 2", "2"),
    ], 64, 1.3);

    assert.deepEqual(bridges, { 1: "#01", 2: "#02", 3: "Wide… 1", 4: "Wide… 2" });
  });

  it("draw no tag two tiles would share: where no form tells them apart, neither is tagged", () => {
    assert.deepEqual(tags([tile(1, "Plaza, north gate open", "open"), tile(2, "Plaza, south gate open", "open")]), {});
  });

  it("drop a tag two runs end on from both tiles, and only from them", () => {
    const zones = tags([
      tile(1, "Zed NE High Density Housing", "High"),
      tile(2, "Zed NE Low Density Housing", "Low"),
      tile(3, "Zed SW High Density Housing", "High"),
      tile(4, "Zed SW Low Density Housing", "Low"),
      tile(5, "Zed Trailer Homes", "Trailer"),
    ]);

    assert.deepEqual(zones, { 5: "Trailer" });
  });

  it("say a number in its pair as #02 too", () => {
    const bridges = tags([tile(1, "Harbor Bridge 1", "1"), tile(2, "Harbor Bridge 2", "2"), tile(3, "Canal Road 1", "1"), tile(4, "Canal Road 2", "2")]);

    unique(bridges);
    assert.match(bridges[1], /#01/u, JSON.stringify(bridges));
    assert.doesNotMatch(Object.values(bridges).join(" "), /(^|\s)\d/u, JSON.stringify(bridges));
  });

  it("never cut a word to a single letter on either side of the mark, nor a hyphenated word but to its head", () => {
    const large = tags([tile(1, "Oz Low Density Gable-Roof Housing", "Gable-Roof"), tile(2, "Oz Low Density Mansard-Roof Housing", "Mansard-Roof"), tile(3, "Oz Medium Housing", "Medium")], 64, 1.5);

    assert.ok(Object.keys(large).length > 0);
    for (const tag of Object.values(large)) {
      assert.doesNotMatch(tag, /^[^…]?…|…[^…]$/u, JSON.stringify(large));
      assert.ok(!tag.includes("-") || !tag.includes("…") || /^[^…]+…$/u.test(tag), JSON.stringify(large));
    }
    assert.ok(Object.values(large).every((tag) => !/^(Ga|Ma)[^…]*…[^…]+$/u.test(tag)), JSON.stringify(large));
  });

  it("bound the work: ninety tiles at 150% text measure each tag a few times, not once a rem", () => {
    let measured = 0;
    const counting: typeof tagFits = (...args) => {
      measured += 1;
      return tagFits(...args);
    };
    const themes = ["NA", "EU", "Oz", "CN", "JP", "DE", "FR", "NL", "EE", "USA"];
    const kinds = ["Low Density Cabin Housing", "Low Density Country Housing", "Medium Density Row Housing", "Medium Density Housing", "High Density Housing", "Mixed Housing", "Low Rent Housing", "Low Density Mansard-Roof Housing", "Low Density Waterfront Housing"];
    const words = ["Cabin", "Country", "Row", "Medium", "High", "Mixed", "Rent", "Mansard-Roof", "Waterfront"];
    const zones = themes.flatMap((theme, t) => kinds.map((kind, k) => tile(t * 10 + k + 1, `${theme} ${kind}`, words[k])));

    lookAlikeTags(zones, 64, 1.5, counting);
    assert.ok(measured <= zones.length * 24, `${measured} measures for ${zones.length} tiles`);
  });

  it("work out only the new tiles at a Load more: only the collision pass runs over every tile", () => {
    const counter = () => {
      const count = { measured: 0 };
      const fits: typeof tagFits = (...args) => {
        count.measured += 1;
        return tagFits(...args);
      };
      return { count, fits };
    };
    // Two runs whose tags never read alike, so the new run moves no tile of the old one.
    const syllables = ["ka", "lo", "mi", "nu", "pe", "ri", "so", "tu"];
    const word = (at: number) => `${syllables[at % 8]}${syllables[Math.floor(at / 8) % 8]}`.replace(/^./u, (first) => first.toUpperCase());
    const first = Array.from({ length: 30 }, (_, at) => tile(at + 1, `Alpha Tower ${word(at)}`, word(at)));
    const loaded = Array.from({ length: 30 }, (_, at) => tile(at + 101, `Beta Hall ${word(at + 30)}`, word(at + 30)));

    const page = counter();
    lookAlikeTags(first, 64, 1.5, page.fits);
    const before = page.count.measured;
    const tagsAfter = lookAlikeTags([...first, ...loaded], 64, 1.5, page.fits);
    const atLoadMore = page.count.measured - before;

    const alone = counter();
    lookAlikeTags(loaded, 64, 1.5, alone.fits);

    assert.ok(before > 0 && alone.count.measured > 0);
    assert.equal(atLoadMore, alone.count.measured);
    assert.equal(tagsAfter.size, first.length + loaded.length);
    // The same tiles pushed again measure nothing.
    lookAlikeTags([...first, ...loaded], 64, 1.5, page.fits);
    assert.equal(page.count.measured - before, atLoadMore);
  });

  it("key the tags on what they read, so a page pushed again with the same tiles keeps them", () => {
    const page = [tile(1, "NA Pack", "Pack"), tile(2, "NA Trailer Homes", "Trailer")];

    assert.equal(lookAlikeKey(page.map((entry) => ({ ...entry }))), lookAlikeKey(page));
    assert.notEqual(lookAlikeKey([page[0], { ...page[1], isLocked: true }]), lookAlikeKey(page));
    assert.notEqual(lookAlikeKey([page[0], { ...page[1], distinctWord: "Homes" }]), lookAlikeKey(page));
    assert.notEqual(lookAlikeKey([page[0], { ...page[1], name: "NA Trailer Home" }]), lookAlikeKey(page));
  });

  it("never stand on a word like \"with\" alone: the word after it tells the tile apart", () => {
    assert.deepEqual(tags([tile(1, "Five-Lane Road", ""), tile(2, "Five-Lane Road with Median", "with")]), { 1: "Road", 2: "Median" });
  });

  it("measure each tile's tag in its own room: a locked tile's beside its lock glyph", () => {
    const run = [tile(1, "NA Pack", "Pack"), tile(2, "NA Trailer Homes", "Trailer")];

    assert.equal(tags(run)[1], "NA Pack");
    assert.equal(tags([tile(1, "NA Pack", "Pack", true), run[1]])[1], "Pack");
  });
});
