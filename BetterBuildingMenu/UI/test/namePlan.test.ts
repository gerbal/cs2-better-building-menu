import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { bodyGrid } from "../src/domain/bodyGeometry";
import { NAME_FONT, plateNameRoom } from "../src/domain/listPlate";
import { AFTER_SPAN, CUT_MARK, nameRuns, planFits, planName } from "../src/domain/namePlan";
import { ASSET_MENU_DEFAULT_HEIGHT } from "../src/domain/sharedContracts.generated";
import { textWidth } from "../src/domain/textWidth";

/** A list plate's name room at 100% text, two lines at 11 rem. */
const plate = (width: number, lines = 2) => ({ width, lines, font: 11 });
const fitsBox = (lines: readonly string[], box: { width: number; font: number }) =>
  lines.every((line) => textWidth(line, box.font) <= box.width);

describe("a name planned in its box", () => {
  it("draws whole where it fits its lines, broken between words", () => {
    assert.deepEqual(planName("Covered Pedestrian Bridge", plate(95)), { lines: ["Covered", "Pedestrian Bridge"], whole: true });
    assert.deepEqual(planName("Four-Lane Road", plate(95)), { lines: ["Four-Lane Road"], whole: true });
  });

  it("cuts a one-word name too wide for a line inside it, so it never runs into the numbers beside it", () => {
    const plan = planName("StoneCornerGarage01", plate(60));

    assert.equal(plan.whole, false);
    assert.ok(plan.lines[0].includes(CUT_MARK), plan.lines[0]);
    assert.ok(plan.lines[0].endsWith("01"), plan.lines[0]);
    assert.ok(fitsBox(plan.lines, plate(60)), JSON.stringify(plan.lines));
  });

  it("cuts once, between words, keeping the last word, where catalog names say which", () => {
    const plan = planName("Four-Lane Perpendicular Parking Road", plate(95));

    assert.deepEqual(plan, { lines: [`Four-Lane${CUT_MARK}`, "Parking Road"], whole: false });
  });

  it("keeps the distinguishing word and the typed word through a cut", () => {
    const divided = planName("Four-Lane Divided Suspension Bridge", plate(60), { keep: ["Divided"] });
    const tram = planName("Tram + Four-Lane Road Double-Decked Suspension Bridge", plate(60), { typed: ["tram"] });

    assert.ok(divided.lines.join(" ").includes("Divided"), JSON.stringify(divided));
    assert.ok(tram.lines.join(" ").startsWith("Tram"), JSON.stringify(tram));
  });

  it("cuts the plain words inside first, then the typed words, the distinguishing word last", () => {
    // A typed "bridge" is in every name of the family: each must still say which bridge it is.
    const family = [
      ["Two-Lane Wooden Covered Bridge", "Wooden", ["Two… Wooden", "Covered Bridge"]],
      ["Six-Lane Highway Cable-Stayed Bridge", "Highway", ["Six… Highway", "Cable… Bridge"]],
      // No plain word left to cut: the typed word goes before the word that tells the bridge apart.
      ["Four-Lane Extradosed Bridge", "Extradosed", ["Four-Lane", `Extradosed B${CUT_MARK}e`]],
    ] as const;

    for (const [name, distinct, lines] of family) {
      assert.deepEqual(planName(name, plate(85), { keep: [distinct], typed: ["bridge"] }).lines, lines, name);
    }

    const tram = planName("Tram + Four-Lane Road Double-Decked Suspension Bridge", plate(100), { keep: ["Double-Decked"] });
    assert.match(tram.lines.join(" "), /(^| )Double-Decked( |…|$)/u, JSON.stringify(tram));
  });

  it("keeps a whole word that tells the name apart, and a word a search begins, two letters or more", () => {
    const name = "Large Roundabout with a Tree and Bushes";
    const plain = planName(name, plate(110, 1));

    // A single letter, or a word like "a", is never kept: it tells nothing apart.
    assert.deepEqual(planName(name, plate(110, 1), { keep: ["a"], typed: ["a"] }), plain);
    // A typed word keeps the word it begins, never one it only sits inside.
    assert.deepEqual(planName(name, plate(110, 1), { typed: ["round"] }).lines, [`Large Roundabout${CUT_MARK}`]);
    assert.deepEqual(planName(name, plate(110, 1), { typed: ["ound"] }), plain);
    assert.deepEqual(planName(name, plate(110, 1), { keep: ["Round"] }), plain);
  });

  it("drops a word before a number, and cuts a word inside before it cuts a number", () => {
    // The last word first, but never at the cost of a number while a word could go in its place.
    assert.deepEqual(planName("Plaza 2x2 Corner Large", plate(110, 1)).lines, [`Plaza 2x2${CUT_MARK} Large`]);
    assert.deepEqual(planName("Hangar 2x2", plate(45, 1)).lines, [`H${CUT_MARK}r 2x2`]);
  });

  it("cuts a hyphenated word to a readable head, or keeps it whole: \"F…e\" could be Five-Lane", () => {
    for (const width of [40, 60, 70, 85, 95, 120]) {
      for (const lines of [1, 2]) {
        for (const name of ["Four-Lane Extradosed Bridge", "Six-Lane Highway Cable-Stayed Bridge", "Two-Lane Wooden Covered Bridge"]) {
          const plan = planName(name, plate(width, lines), { typed: ["bridge"] });
          const [first = ""] = plan.lines.join(" ").split(" ");
          const head = first.split(CUT_MARK)[0];

          assert.ok(head === "" || head.length >= name.indexOf("-"), `${name} at ${width}×${lines}: ${plan.lines.join(" / ")}`);
        }
      }
    }
  });

  it("cuts a word to no fewer than a letter each side of the mark while any such cut fits", () => {
    for (const width of [30, 35, 40, 45, 50]) {
      for (const name of ["Underground Parking Garage", "Elementary School", "Transformer Station", "Water Treatment Plant"]) {
        const plan = planName(name, plate(width, 1));

        assert.equal(plan.lines.length, 1, `${name} at ${width}`);
        assert.doesNotMatch(plan.lines[0], /(^|\s)…/u, `${name} at ${width}: ${plan.lines[0]}`);
      }
    }
  });

  it("never opens a cut's tail or a line with a separator", () => {
    assert.deepEqual(planName("Small Underground Parking - Mirrored", plate(95, 1)).lines, [`Small${CUT_MARK} Mirrored`]);

    for (const [name, width] of [["Small Underground Parking Lot - Mirrored", 60], ["Parking Lot - Mirrored", 40], ["Bus Depot – Large", 30]] as const) {
      const plan = planName(name, plate(width, 3));
      assert.ok(plan.lines.every((line) => !/^[-–,]/u.test(line)), `${name} at ${width}: ${plan.lines.join(" / ")}`);
    }
  });

  it("gives twins one shape, the word that tells them apart kept", () => {
    const twins = [1, 2, 3].map((n) => planName(`Wide Quay With Four-Lane Road ${n}`, plate(95, 1)).lines.join(" "));

    assert.deepEqual(twins, [1, 2, 3].map((n) => `Wide${CUT_MARK} Road ${n}`));
  });

  it("never ends a head on a stop word", () => {
    for (const width of [40, 60, 95, 120]) {
      const plan = planName("Fishing And Open Water Fish Farming Area Hub", plate(width));
      const head = plan.lines.join(" ").split(CUT_MARK)[0].trim().split(" ").pop() ?? "";

      assert.notEqual(head.toLowerCase(), "and", `${width}: ${plan.lines.join(" / ")}`);
    }
  });

  it("breaks a hyphenated compound at its hyphen only when every cut keeps too little", () => {
    // In a box this narrow every cut keeps under 60% of the name; at its hyphens it is whole.
    const plan = planName("Two-Lane One-Way Road", plate(30, 5));

    assert.deepEqual(plan, { lines: ["Two-", "Lane", "One-", "Way", "Road"], whole: true });
    // With room for a cut that keeps more, the compound stays whole.
    assert.ok(!planName("Two-Lane One-Way Narrow Road Left", plate(95)).lines.some((line) => line.endsWith("-")));
  });

  it("never leaves an ideograph alone on the last line", () => {
    const plan = planName("第一中学实验学校高中部", plate(34, 4));

    assert.ok(plan.lines[plan.lines.length - 1].length > 1, JSON.stringify(plan.lines));
    assert.ok(plan.whole);
  });

  it("never draws more lines than it is given, nor a line wider than its box", () => {
    const names = [
      "Four-Lane Perpendicular Parking Road", "Lakeside High School (based on the Old Harbour Customs Hall)",
      "Two-Lane One-Way Narrow Road Left", "StoneCornerGarage01", "第一中学实验学校高中部", "Harbour Arch with Twin Tram Lanes",
    ];

    for (const name of names) {
      for (const box of [plate(95), plate(60), plate(150, 1), { width: 120, lines: 1, font: 14.3 }]) {
        const plan = planName(name, box);

        assert.ok(plan.lines.length <= box.lines, `${name} in ${JSON.stringify(box)}: ${plan.lines.join(" / ")}`);
        assert.ok(fitsBox(plan.lines, box), `${name} in ${JSON.stringify(box)}: ${plan.lines.join(" / ")}`);
      }
    }
  });

  it("counts the tracking a label's caps draw with, and cuts a too-wide word inside it, the others whole", () => {
    const square = { width: 56, lines: 2, font: 10, tracking: 0.4 };

    assert.deepEqual(planName("ELEMENTARY SCHOOL", square), { lines: [`ELE${CUT_MARK}ARY`, "SCHOOL"], whole: false });
    assert.deepEqual(planName("PARKS", square), { lines: ["PARKS"], whole: true });
  });

  it("draws nothing for an empty name", () => {
    assert.deepEqual(planName("  ", plate(95)), { lines: [], whole: true });
  });

  it("draws no line in a box with no room, or none it can say: never a line wider than the box", () => {
    assert.deepEqual(planName("StoneCornerGarage01", plate(0)), { lines: [], whole: false });
    assert.deepEqual(planName("StoneCornerGarage01", plate(Number.NaN)), { lines: [], whole: false });
    // Where nothing but the mark fits, the mark: a name was cut, never silently dropped.
    assert.deepEqual(planName("StoneCornerGarage01", plate(textWidth(CUT_MARK, 11))).lines, [CUT_MARK]);
  });
});

describe("the base game's names in a plate's room", () => {
  /** The base game's names, each with its distinguishing word in its menu. */
  const names: [string, string][] = JSON.parse(readFileSync(new URL("./fixtures/baseGameNames.json", import.meta.url), "utf8"));
  const forms = [[1, "moreBuildings"], [1.1, "moreBuildings"], [1.3, "moreBuildings"], [1.5, "moreBuildings"], [1.1, "wholeNames"], [1.3, "wholeNames"], [1.5, "wholeNames"]] as const;

  it("never draws a line wider than its room, nor more than two marks in one, with or without a search", () => {
    for (const [textScale, atLargeText] of forms) {
      const grid = bodyGrid({ body: "list", boxWidth: 706, bodyHeight: ASSET_MENU_DEFAULT_HEIGHT, textScale, atLargeText, tileSize: 64, plateHeight: 27.25, nameLines: 0 });
      const numbers = grid.form === "plate2" ? { first: "¢12,500", second: "1,200", glyph: "person" as const, locked: false } : { first: "¢12,500", second: null, glyph: null, locked: false };
      const box = { width: plateNameRoom(grid, numbers, false, textScale), lines: grid.nameLines, font: NAME_FONT * textScale };

      for (const typed of ["", "a", "e", "ro", "st"]) {
        for (const [name, distinct] of names) {
          const plan = planName(name, box, { keep: [distinct], typed: [typed] });
          const said = `${name} at ${textScale} ${grid.form} "${typed}": ${plan.lines.join(" / ")}`;

          assert.ok(plan.lines.length <= box.lines && planFits(plan.lines, box), said);
          assert.ok(plan.lines.every((line) => line.split(CUT_MARK).length <= 3), said);
        }
      }
    }
  });
});

describe("a line with the typed word in a span", () => {
  it("puts U+200B before the space after the span, which Cohtml would drop", () => {
    assert.deepEqual(nameRuns("Four-Lane Tram Road", "tram"), [
      { text: "Four-Lane ", typed: false },
      { text: "Tram", typed: true },
      { text: `${AFTER_SPAN} Road`, typed: false },
    ]);
  });

  it("dims each word typed, as a cut keeps each", () => {
    assert.deepEqual(nameRuns("Bus Stop Shelter", "stop bus"), [
      { text: "Bus", typed: true },
      { text: `${AFTER_SPAN} `, typed: false },
      { text: "Stop", typed: true },
      { text: `${AFTER_SPAN} Shelter`, typed: false },
    ]);
  });

  it("is one plain run without a query, or where the line does not hold it", () => {
    assert.deepEqual(nameRuns("Four-Lane Road", ""), [{ text: "Four-Lane Road", typed: false }]);
    assert.deepEqual(nameRuns("Four-Lane Road", "tram"), [{ text: "Four-Lane Road", typed: false }]);
  });
});
