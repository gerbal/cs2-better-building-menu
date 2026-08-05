import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchScore,
  rankBuildingMatches,
  stableGridOrder,
  type GridEntry,
  type RankableEntry,
} from "../src/domain/buildingSearchRank.ts";

const entry = (id: number, name: string, cost: number | null = 0, lot = 4): GridEntry => ({
  id,
  name,
  thumbnail: "",
  constructionCost: cost,
  lotWidth: lot,
  lotDepth: lot,
});

const e = (id: number, name: string, category = "", sub = ""): RankableEntry => ({
  id,
  name,
  prefabName: name.replace(/\s/g, ""),
  category,
  subCategory: sub,
  lotWidth: 4,
  lotDepth: 4,
  constructionCost: 0,
});

describe("Match scoring", () => {
  it("ranks an exact name above a prefix above a word start above a substring", () => {
    const q = "clinic";
    const exact = matchScore(e(1, "Clinic"), q);
    const prefix = matchScore(e(2, "Clinic Center"), q);
    const word = matchScore(e(3, "Medical Clinic"), q);
    const substring = matchScore(e(4, "Policlinical Wing"), q);

    assert.ok(exact > prefix, "exact beats prefix");
    assert.ok(prefix > word, "prefix beats word start");
    assert.ok(word > substring, "word start beats mid-word substring");
    assert.ok(substring > 0);
  });

  it("matches a subsequence so abbreviations work", () => {
    // "dcc" should find "Disease Control Center" — typing initials is how
    // people search a list they already know.
    assert.ok(matchScore(e(1, "Disease Control Center"), "dcc") > 0);
    assert.ok(matchScore(e(2, "Elementary School"), "esc") > 0);
  });

  it("scores a subsequence below any real substring match", () => {
    // Subsequence is generous and would otherwise flood the results.
    const sub = matchScore(e(1, "Disease Control Center"), "dcc");
    const real = matchScore(e(2, "DCC Depot"), "dcc");

    assert.ok(real > sub);
  });

  it("ignores case and surrounding space", () => {
    assert.ok(matchScore(e(1, "Elementary School"), "  ELEMENTARY ") > 0);
  });

  it("returns zero when nothing matches", () => {
    assert.equal(matchScore(e(1, "Elementary School"), "hospital"), 0);
    assert.equal(matchScore(e(1, "Elementary School"), "zzz"), 0);
  });

  it("matches the prefab name so internal ids remain searchable", () => {
    // Modders and power users search by prefab name; it should work without
    // outranking a real display-name hit.
    assert.ok(matchScore(e(1, "Fire Station"), "FireStation") > 0);
  });

  it("finds a building by its category", () => {
    assert.ok(matchScore(e(1, "Some Building", "ServiceBuildings", "Health"), "health") > 0);
  });
});

describe("Ranking", () => {
  it("returns only matches, best first", () => {
    const ranked = rankBuildingMatches(
      [e(1, "Medical Clinic"), e(2, "Clinic"), e(3, "Hospital"), e(4, "Clinic Center")],
      "clinic"
    );

    assert.deepEqual(ranked.map((r) => r.name), ["Clinic", "Clinic Center", "Medical Clinic"]);
  });

  it("prefers the shortest name when relevance ties", () => {
    // Typing "clinic" against a real catalog ties "Medical Clinic",
    // "Additional Clinic Center" and "Small Medical Clinic" on score. The
    // plain one is nearly always what was meant; extra words mean a variant.
    const ranked = rankBuildingMatches(
      [e(1, "Additional Clinic Center"), e(2, "Medical Clinic"), e(3, "Small Medical Clinic")],
      "clinic"
    );

    assert.equal(ranked[0].name, "Medical Clinic");
  });

  it("breaks remaining ties by the same stable order the grid browses in", () => {
    // Equal relevance must not reshuffle between keystrokes.
    const ranked = rankBuildingMatches(
      [
        { ...e(1, "Clinic Nrth"), lotWidth: 8, lotDepth: 8 },
        { ...e(2, "Clinic Sth"), lotWidth: 2, lotDepth: 2 },
      ],
      "clinic"
    );

    // Equal score and equal name length, so the stable order decides.
    assert.deepEqual(ranked.map((r) => r.name), ["Clinic Sth", "Clinic Nrth"]);
  });

  it("returns everything unranked for an empty query", () => {
    // No query means browsing, and browsing wants the stable order, not a
    // relevance order that would move tiles around under the cursor.
    const all = [e(2, "B"), e(1, "A")];

    assert.equal(rankBuildingMatches(all, "").length, 2);
    assert.equal(rankBuildingMatches(all, "   ").length, 2);
  });

  it("survives an empty catalog", () => {
    assert.deepEqual(rankBuildingMatches([], "clinic"), []);
    assert.deepEqual(rankBuildingMatches(undefined, "clinic"), []);
  });

  it("does not mutate its input", () => {
    const source = [e(2, "Clinic B"), e(1, "Clinic A")];
    rankBuildingMatches(source, "clinic");

    assert.deepEqual(source.map((x) => x.id), [2, 1]);
  });
});

describe("Stable grid order", () => {
  it("orders by size then cost then name, never by mutable state", () => {
    // The whole point: the same building sits in the same place every time.
    // Sorting by anything the player can change destroys that.
    const ordered = stableGridOrder([
      entry(1, "Big Expensive", 900, 8),
      entry(2, "Small Cheap", 100, 2),
      entry(3, "Small Dear", 500, 2),
    ]);

    assert.deepEqual(ordered.map((e) => e.name), ["Small Cheap", "Small Dear", "Big Expensive"]);
  });

  it("breaks ties by name so the order is total", () => {
    const ordered = stableGridOrder([
      entry(1, "Beta", 100, 2),
      entry(2, "Alpha", 100, 2),
    ]);

    assert.deepEqual(ordered.map((e) => e.name), ["Alpha", "Beta"]);
  });

  it("gives the same answer whatever order it receives", () => {
    const a = [entry(1, "A", 100, 2), entry(2, "B", 200, 4), entry(3, "C", 50, 6)];
    const b = [a[2], a[0], a[1]];

    assert.deepEqual(
      stableGridOrder(a).map((e) => e.id),
      stableGridOrder(b).map((e) => e.id)
    );
  });

  it("sorts entries with no cost last rather than treating them as free", () => {
    const ordered = stableGridOrder([
      entry(1, "Unknown", null, 2),
      entry(2, "Cheap", 10, 2),
    ]);

    assert.deepEqual(ordered.map((e) => e.name), ["Cheap", "Unknown"]);
  });

  it("does not mutate its input", () => {
    const source = [entry(2, "B", 200, 4), entry(1, "A", 100, 2)];
    stableGridOrder(source);

    assert.deepEqual(source.map((e) => e.id), [2, 1]);
  });
});
