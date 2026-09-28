import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIST_NAME_MAX_CHARS,
  listLabel,
  shortenTileLabel,
  stripRedundantNamePrefix,
  tableLabelCharBudget,
  tileLabelLineBudget,
  wrapTileLabel,
} from "../src/domain/tileLabel.ts";

const COMMERCIAL = { category: "Buildings", subCategory: "Commercial", theme: "European" };

describe("redundant name prefixes", () => {
  it("drops the theme and category the tile's own context already states", () => {
    assert.equal(
      stripRedundantNamePrefix("EU Commercial Gas Station 01 - L1 2x2", COMMERCIAL),
      "Gas Station 01 - L1 2x2"
    );
  });

  it("keeps buildings distinguishable that a middle elision would have merged", () => {
    // Both of the tile's lines.
    const budget = tileLabelLineBudget(88) * 2;
    const gas = shortenTileLabel(
      stripRedundantNamePrefix("EU Commercial Gas Station 01 - L1 2x2", COMMERCIAL),
      budget
    );
    const high = shortenTileLabel(
      stripRedundantNamePrefix("EU Commercial High 01 - L1 2x2", COMMERCIAL),
      budget
    );
    assert.notEqual(gas, high);
  });

  it("leaves a name that does not start with its own category alone", () => {
    assert.equal(stripRedundantNamePrefix("Auto Center", COMMERCIAL), "Auto Center");
    assert.equal(stripRedundantNamePrefix("Activity Plaza", COMMERCIAL), "Activity Plaza");
  });

  it("strips a theme prefix even without theme context", () => {
    assert.equal(stripRedundantNamePrefix("NA Commercial Low 01", { subCategory: "Commercial" }), "Low 01");
  });

  it("never strips a name down to nothing or to a bare number", () => {
    assert.equal(stripRedundantNamePrefix("EU Commercial", COMMERCIAL), "Commercial");
    assert.equal(stripRedundantNamePrefix("EU Commercial 01", COMMERCIAL), "EU Commercial 01");
  });

  it("survives missing context, stripping only what it can still be sure of", () => {
    assert.equal(stripRedundantNamePrefix("Auto Center"), "Auto Center");
    // "EU" is a known theme prefix so it goes; "Commercial" stays, because with
    // no category context there is nothing saying it is redundant.
    assert.equal(stripRedundantNamePrefix("EU Commercial Gas Station", {}), "Commercial Gas Station");
  });
});

describe("grid tile label shortening", () => {
  it("leaves a name that already fits alone", () => {
    assert.equal(shortenTileLabel("Auto Center", 20), "Auto Center");
  });

  it("keeps the distinguishing tail, which is what clipping from the right destroyed", () => {
    const budget = 20;
    const a = shortenTileLabel("EU Commercial Gas Station 01 - L1 2x2", budget);
    const b = shortenTileLabel("EU Commercial Gas Station 01 - L1 3x2", budget);

    assert.notEqual(a, b, "tiles that differ only in their tail must still differ once shortened");
    assert.ok(a.endsWith("2x2"), `expected the lot size to survive, got ${a}`);
    assert.ok(b.endsWith("3x2"), `expected the lot size to survive, got ${b}`);
  });

  it("separates levels of the same building", () => {
    const budget = 20;
    const l1 = shortenTileLabel("EU Commercial Gas Station 01 - L1 2x2", budget);
    const l5 = shortenTileLabel("EU Commercial Gas Station 01 - L5 2x2", budget);
    assert.notEqual(l1, l5);
  });

  it("never exceeds its budget", () => {
    const budget = 20;
    for (const name of [
      "EU Commercial Gas Station 01 - L1 2x2",
      "Canopy-Covered Parklet With A Very Long Name Indeed",
      "A",
      "",
    ]) {
      assert.ok(
        shortenTileLabel(name, budget).length <= budget,
        `"${name}" shortened past its budget`
      );
    }
  });

  it("keeps some of the head so the family is still recognisable", () => {
    const shortened = shortenTileLabel("EU Commercial Gas Station 01 - L1 2x2", 20);
    assert.ok(shortened.startsWith("EU"), `expected a recognisable head, got ${shortened}`);
  });

  it("still keeps the tail at a budget too small to be useful", () => {
    const shortened = shortenTileLabel("EU Commercial Gas Station 01 - L1 2x2", 3);
    // At or under the budget, not exactly it: the ellipsis is charged
    // ELLIPSIS_CHARS because it draws nearly twice an average letter, so at a
    // budget of three there is room for the mark and one character of tail.
    assert.ok(shortened.length <= 3, `expected to fit the budget, got ${shortened}`);
    assert.ok(shortened.endsWith("2"), `expected the tail to survive, got ${shortened}`);
    assert.ok(shortened.includes("…"), `expected truncation to be marked, got ${shortened}`);
  });

  it("marks every truncation, so a cut name never reads as the whole name", () => {
    assert.ok(shortenTileLabel("EU Commercial Gas Station 01 - L1 2x2", 20).includes("…"));
    assert.ok(!shortenTileLabel("Auto Center", 20).includes("…"));
  });

  it("scales the budget with the configured tile size", () => {
    assert.equal(tileLabelLineBudget(88), 11);
    assert.ok(tileLabelLineBudget(132) > tileLabelLineBudget(88));
    assert.ok(tileLabelLineBudget(60) < tileLabelLineBudget(88));
  });

  it("keeps a usable budget for nonsense tile sizes", () => {
    // Falls back to DEFAULT_TILE_SIZE (100rem), which budgets 12 per line.
    assert.equal(tileLabelLineBudget(Number.NaN), 12);
    assert.equal(tileLabelLineBudget(0), 12);
    assert.ok(tileLabelLineBudget(1) >= 4);
  });
});

describe("Tile label budget at the tile's actual width", () => {
  it("budgets the twelve characters measured on the running game", () => {
    // Twelve, not thirteen: the name line sits at fontSizeM, where the game's
    // own names measure wider than a fontSizeXS budget assumed and a
    // thirteen-character name overruns the box.
    assert.equal(tileLabelLineBudget(100), 12);
  });

  it("draws two lines, because one could not hold the names", () => {
    assert.equal(wrapTileLabel("Large Elementary School Campus North", tileLabelLineBudget(100)).length, 2);
  });

  it("scales with a larger tile", () => {
    assert.equal(tileLabelLineBudget(144), 17);
  });

  it("never budgets below four characters", () => {
    assert.equal(tileLabelLineBudget(1), 4);
  });
});

describe("Wrapping a name over the tile's lines", () => {
  const LINE = tileLabelLineBudget(100);

  it("breaks at a word rather than mid-word", () => {
    // At one line these read "Bus…lter" and "Sma…epot", which name the family
    // twice and the building never.
    assert.deepEqual(wrapTileLabel("Bus Stop Shelter", LINE), ["Bus Stop", "Shelter"]);
    assert.deepEqual(wrapTileLabel("Small Taxi Depot", LINE), ["Small Taxi", "Depot"]);
  });

  it("uses one line when the name fits on one", () => {
    // "Bus Stop Sign" is thirteen characters, which does not fit a 100rem
    // tile at fontSizeM — it wraps, honestly, to "Bus Stop" / "Sign".
    assert.deepEqual(wrapTileLabel("Bus Stop Sign", LINE), ["Bus Stop", "Sign"]);
    assert.deepEqual(wrapTileLabel("Taxi Stand", LINE), ["Taxi Stand"]);
    assert.deepEqual(wrapTileLabel("Small Park", LINE), ["Small Park"]);
  });

  it("keeps two names apart that one line merged", () => {
    const shelter = wrapTileLabel("Bus Stop Shelter", LINE).join(" ");
    const sign = wrapTileLabel("Bus Stop Sign", LINE).join(" ");
    const taxi = wrapTileLabel("Taxi Shelter", LINE).join(" ");

    assert.notEqual(shelter, sign);
    assert.notEqual(shelter, taxi);
  });

  it("elides only the last line, and only when the name overruns both", () => {
    const lines = wrapTileLabel("Bus Stop Shelter with Bicycle Stands", LINE);

    assert.equal(lines.length, 2);
    assert.ok(!lines[0].includes("…"), `the first line should be whole words, got ${lines[0]}`);
    assert.ok(lines[1].includes("…"), `the overrun should be marked, got ${lines[1]}`);
  });

  it("never draws more lines than it was given, or a line past its budget", () => {
    for (const name of [
      "Bus Stop Shelter with Bicycle Stands",
      "EU Commercial Gas Station 01 - L1 2x2",
      "Canopy-Covered Parklet With A Very Long Name Indeed",
      "Antidisestablishmentarianism Hall",
      "A",
      "",
    ]) {
      const lines = wrapTileLabel(name, LINE);
      assert.ok(lines.length <= 2, `"${name}" drew ${lines.length} lines`);
      for (const line of lines) {
        assert.ok(line.length <= LINE, `"${name}" drew "${line}", past ${LINE}`);
      }
    }
  });

  it("gives a word longer than a line a line of its own rather than swallowing the rest", () => {
    const lines = wrapTileLabel("Antidisestablishmentarianism Hall", LINE);

    assert.equal(lines.length, 2);
    assert.ok(lines[0].includes("…"));
    assert.equal(lines[1], "Hall");
  });

  it("still keeps the distinguishing tail across the wrap", () => {
    const a = wrapTileLabel("Gas Station 01 - L1 2x2", LINE).join(" ");
    const b = wrapTileLabel("Gas Station 01 - L1 3x2", LINE).join(" ");

    assert.notEqual(a, b);
    assert.ok(a.endsWith("2x2"), `expected the lot size to survive, got ${a}`);
    assert.ok(b.endsWith("3x2"), `expected the lot size to survive, got ${b}`);
  });

  it("drops a whole word before it cuts one", () => {
    // "Public…t Lane" leaves a fragment where "…Lane" would leave a gap. With
    // the mark charged what it draws, "Public…Lane" no longer fits a
    // twelve-character line, so that name takes the character cut honestly.
    assert.deepEqual(wrapTileLabel("Underground Bus Stop Lane", LINE), [
      "Underground",
      "Bus…Lane",
    ]);
    assert.deepEqual(wrapTileLabel("One-Way Public Transport Lane", LINE), [
      "One-Way",
      "Publi…Lane",
    ]);
  });

  it("cuts a word only when no whole-word fit is left", () => {
    const lines = wrapTileLabel("Bus Stop Shelter with Bicycle Stands", LINE);

    // "Shelter…Stands" is 14 against a 12-character line, so no pair of whole
    // words fits and the character cut is the honest answer. The head is short
    // because the ellipsis costs what it measures rather than one character.
    assert.equal(lines[1], "She…Stands");
  });

  it("leaves an elided line room for the mark it carries", () => {
    // At the tile's font the label box holds fewer characters than the budget
    // once the mark is paid for, and the stylesheet marks the overflow a
    // SECOND time. Every elided line must come in under the budget.
    for (const name of [
      "Firefighting Helicopter Depot",
      "Disease Control Center",
      "Health Research Institute",
      "Small Emergency Shelter",
      "Early Disaster Warning System",
      "Wastewater Treatment Plant",
    ]) {
      for (const line of wrapTileLabel(name, LINE)) {
        if (!line.includes("…")) continue;

        assert.ok(
          line.length < LINE,
          `${name}: elided line "${line}" spends the whole budget and will overflow`
        );
      }
    }
  });

  it("draws nothing for an empty name", () => {
    assert.deepEqual(wrapTileLabel("", LINE), []);
    assert.deepEqual(wrapTileLabel("   ", LINE), []);
  });
});

describe("Table name budget", () => {
  it("gives the table more characters than one tile line, at a realistic width", () => {
    // A ~270rem drawable name box is what a 1000rem build menu actually leaves once
    // the metric columns and ASSET_MENU_TABLE_ROW_FURNITURE are taken.
    assert.ok(tableLabelCharBudget(270) > tileLabelLineBudget(100));
  });

  it("matches the measured drawable width", () => {
    // 270rem of name box at 12 chars per 100rem is 32 characters. Handed the
    // whole identity column instead, it shortens nothing.
    assert.equal(tableLabelCharBudget(270), 32);
  });

  it("never returns a budget too small to shorten into", () => {
    // shortenTileLabel needs room for a head, an ellipsis and a tail; below
    // about eight characters it degenerates into an ellipsis and a fragment.
    assert.ok(tableLabelCharBudget(0) >= 8);
    assert.ok(tableLabelCharBudget(-50) >= 8);
    assert.ok(tableLabelCharBudget(Number.NaN) >= 8);
  });

  it("grows with the width", () => {
    assert.ok(tableLabelCharBudget(420) > tableLabelCharBudget(270));
  });
});

describe("The ellipsis costs the same on every path", () => {
  // shortenTileLabel charges the mark three characters, because it draws
  // nearly twice a letter and what survives an elision is capitals.
  // fitLastLine must charge the same, or the line overruns its box.
  it("keeps an elided last line inside the budget once the mark is paid for", () => {
    const LINE = tileLabelLineBudget(100);
    const names = [
      "One-Lane One-Way Perpendicular Parking Road",
      "Two-Lane One-Way Road",
      "Three-Lane Asymmetric Road",
      "Two-Lane Wooden Covered Bridge",
      "Firefighting Helicopter Depot",
    ];

    for (const name of names) {
      for (const line of wrapTileLabel(name, LINE)) {
        const cost = line.length + (line.includes("…") ? 2 : 0);
        assert.ok(cost <= LINE, `"${line}" costs ${cost} of ${LINE} (${name})`);
      }
    }
  });
});

describe("list and card row names", () => {
  it("draws real names whole, the longest vanilla one included", () => {
    const longest = "Fishing And Open Water Fish Farming Area Hub";
    assert.equal(listLabel(longest), longest);
  });

  it("cuts a name an asset ships repeated, so one row cannot span the asset menu", () => {
    const repeated = "Oriental Pearl Radio & TV Tower".repeat(6);
    const drawn = listLabel(repeated);
    assert.ok(drawn.length <= LIST_NAME_MAX_CHARS, drawn);
    assert.ok(drawn.startsWith("Oriental Pearl"), drawn);
    assert.ok(drawn.includes("…"), drawn);
  });
});
