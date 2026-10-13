import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AFTER_SPAN, CUT_MARK, nameRuns, planName } from "../src/domain/namePlan";
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
    const tram = planName("Tram + Four-Lane Road Double-Decked Suspension Bridge", plate(60), { keep: ["tram"] });

    assert.ok(divided.lines.join(" ").includes("Divided"), JSON.stringify(divided));
    assert.ok(tram.lines.join(" ").startsWith("Tram"), JSON.stringify(tram));
  });

  it("cuts only words that are neither kept nor numbers where no cut of whole words keeps them all", () => {
    // A typed "bridge" is in every name of the family: each must still say which bridge it is.
    const family = [
      ["Four-Lane Extradosed Bridge", "Extradosed", 85],
      ["Two-Lane Wooden Covered Bridge", "Wooden", 85],
      ["Six-Lane Highway Cable-Stayed Bridge", "Highway", 85],
      ["Four-Lane Divided Suspension Bridge", "Divided", 70],
    ] as const;

    for (const [name, distinct, width] of family) {
      const words = planName(name, plate(width), { keep: [distinct, "bridge"] }).lines.join(" ").split(" ");

      assert.ok(words.includes(distinct) && words.includes("Bridge"), `${name}: ${words.join(" ")}`);
      assert.ok(fitsBox(planName(name, plate(width), { keep: [distinct, "bridge"] }).lines, plate(width)), name);
    }

    const tram = planName("Tram + Four-Lane Road Double-Decked Suspension Bridge", plate(100), { keep: ["Double-Decked"] });
    assert.match(tram.lines.join(" "), /(^| )Double-Decked( |…|$)/u, JSON.stringify(tram));
  });

  it("never cuts a number, a level or a size inside it: whole, or clipped as the last resort", () => {
    const station = planName("Gas Station 01 - L1 2x2", plate(50, 1), { keep: ["01"] }).lines.join(" ").split(" ");
    const depot = planName("Depot 123456789", plate(40, 1));

    assert.ok(station.includes("01") && station.includes("2x2"), station.join(" "));
    assert.ok(depot.lines.join(" ").split(" ").includes("123456789"), JSON.stringify(depot));
    assert.equal(depot.lines.length, 1);
  });

  it("cuts a word it may cut to no fewer than a letter each side of the mark", () => {
    const [first] = planName("Four-Lane Extradosed Bridge", plate(85), { keep: ["Extradosed", "bridge"] }).lines[0].split(" ");

    assert.match(first, /^\p{L}+…\p{L}+$/u);
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

  it("draws a box with no room, or none it can say, as the name's shortest cut on one line", () => {
    const none = planName("StoneCornerGarage01", plate(0));

    assert.equal(none.lines.length, 1);
    assert.equal(none.whole, false);
    assert.ok(none.lines[0].startsWith(CUT_MARK) && none.lines[0].endsWith("1"), none.lines[0]);
    assert.deepEqual(planName("StoneCornerGarage01", plate(Number.NaN)), none);
    assert.deepEqual(planName("Four-Lane Road", plate(Number.NaN)), planName("Four-Lane Road", plate(0)));
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
