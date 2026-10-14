import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { bodyGrid } from "../src/domain/bodyGeometry";
import { NAME_FONT, plateNameRoom } from "../src/domain/listPlate";
import { AFTER_SPAN, CUT_MARK, nameRuns, opening, planFits, planName, plansWorkedOut, sketchName, STOP_WORDS } from "../src/domain/namePlan";
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

  it("never drops a distinguishing word that is a number, where a number the row shares can go instead", () => {
    // Read through a leading mark rather than lose the size that tells the row apart.
    assert.deepEqual(planName("Elementary School 2x2 Variant", plate(70, 1), { keep: ["2x2"] }).lines, [`${CUT_MARK}2x2 Variant`]);
  });

  it("keeps a hyphenated name word a typed hyphenated word begins", () => {
    const name = "Wide Quay With Four-Lane Road 1";

    assert.deepEqual(planName(name, plate(110, 1)).lines, [`Wide Quay${CUT_MARK} Road 1`]);
    assert.match(planName(name, plate(110, 1), { typed: ["four-lane"] }).lines.join(" "), /(^| )Four(-Lane|…)/u);
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

  it("plans the same name in the same room once, and forgets the oldest past a window's names, list and tags", () => {
    const name = "Four-Lane Perpendicular Parking Road";
    const plan = planName(name, plate(95));

    assert.equal(planName(name, plate(95)), plan);
    assert.equal(planName(name, plate(95), { keep: [], typed: [] }), plan);
    assert.notEqual(planName(name, plate(95), { keep: ["Perpendicular"] }), plan);
    // A room a hair narrower, within the same hundredth, still gets a plan that fits it.
    assert.ok(planFits(planName("Small Elementary School", plate(57.004, 1)).lines, plate(57.004, 1)));
    assert.ok(planFits(planName("Small Elementary School", plate(57.0, 1)).lines, plate(57.0, 1)));

    // A window's 2,000 names in the list and its tiles' tags, cut at a few rooms each, keep their plans:
    // a switch between the two draws no name planned again.
    for (let at = 0; at < 2_000; at += 1) planName(`Plaza ${at}`, plate(95));
    for (let at = 0; at < 6_000; at += 1) planName(`Plaza ${at % 2_000}`, { width: 40 + Math.floor(at / 2_000), lines: 1, font: 10 }, { lastResort: false });
    assert.equal(planName(name, plate(95)), plan);

    for (let at = 0; at < 8_200; at += 1) planName(`Square ${at}`, plate(95));
    const again = planName(name, plate(95));
    assert.notEqual(again, plan);
    assert.deepEqual(again, plan);
  });

  it("never draws a name every word of which is cut wider than its room at 150%, and says each cut with \"…\"", () => {
    // Variants of a base-game bridge: against the plain bridge their distinguishing word is the dash.
    const box = { width: 153, lines: 1, font: NAME_FONT * 1.5 };
    for (const name of ["Covered Pedestrian Bridge — Bendable & Floodlighted", "Pedestrian Arch Bridge — Bendable & Floodlighted"]) {
      for (const keep of ["—", "", "Bendable", "&", "Bridge"]) {
        const plan = planName(name, box, { keep: [keep] });
        const said = `${name} keeping "${keep}": ${plan.lines.join(" / ")}`;

        assert.ok(plan.lines.length === 1 && planFits(plan.lines, box), said);
        assert.ok(plan.whole || plan.lines[0].includes(CUT_MARK), said);
      }
    }
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

  /** A plate's name room in a form, at its text scale, with a cost beside it. */
  const roomOf = (textScale: number, atLargeText: string) => {
    const grid = bodyGrid({ body: "list", boxWidth: 706, bodyHeight: ASSET_MENU_DEFAULT_HEIGHT, textScale, atLargeText, tileSize: 64, plateHeight: 27.25, nameLines: 0 });
    const numbers = grid.form === "plate2" ? { first: "¢12,500", second: "1,200", glyph: "person" as const, locked: false } : { first: "¢12,500", second: null, glyph: null, locked: false };
    return { width: plateNameRoom(grid, numbers, false, textScale), lines: grid.nameLines, font: NAME_FONT * textScale };
  };

  it("keeps each decoration's size, a number that tells it apart, at large text", () => {
    const sizes = ["1x1", "1x3", "2x2", "2x4"];

    for (const textScale of [1.3, 1.5]) {
      const box = roomOf(textScale, "moreBuildings");
      const plans = sizes.map((size) => planName(`Industrial Manufacturing Decoration 01 ${size} Agriculture`, box, { keep: [size] }).lines.join(" "));

      plans.forEach((plan, at) => assert.ok(plan.split(" ").includes(sizes[at]), `${textScale}: ${plan}`));
      assert.equal(new Set(plans).size, sizes.length, `${textScale}: ${plans.join(" | ")}`);
    }
  });

  it("never draws two look-alikes alike where a cut keeping each one's distinguishing word fits", () => {
    for (const [textScale, atLargeText] of forms) {
      const box = roomOf(textScale, atLargeText);
      // Look-alikes: rows whose names agree up to the word that tells each apart.
      const drawn = new Map<string, string[]>();

      for (const [name, distinct] of names) {
        const words = name.split(/\s+/);
        const at = words.findIndex((word) => word.toLowerCase() === distinct.toLowerCase());
        const plan = planName(name, box, { keep: [distinct] }).lines.join(" ");
        // A single letter or a word like "with" is never kept: it tells nothing apart.
        if (at <= 0 || STOP_WORDS.has(distinct.toLowerCase()) || ([...distinct].length < 2 && !/\d/u.test(distinct))) continue;
        // The shortest cut that keeps the word: the mark, the word, and a mark where words follow it.
        if (textWidth(`${CUT_MARK}${distinct}${at < words.length - 1 ? CUT_MARK : ""}`, box.font) > box.width) continue;

        const tokens = plan.split(" ").map((token) => token.replace(/^…|…$/gu, ""));
        const head = distinct.split("-")[0];
        assert.ok(tokens.includes(distinct) || (distinct.includes("-") && plan.split(" ").some((token) => token.replace(/^…/u, "") === `${head}${CUT_MARK}`)), `${name} at ${textScale} ${atLargeText}: ${plan}`);

        const key = `${words.slice(0, at).join(" ").toLowerCase()}\u0001${plan}`;
        drawn.set(key, [...(drawn.get(key) ?? []), name]);
      }

      for (const [key, alike] of drawn) assert.equal(alike.length, 1, `${textScale} ${atLargeText}: ${alike.join(" | ")} draw ${key.split("\u0001")[1]}`);
    }
  });

  /** The shortest cut keeping a name's first word, by its head where it is hyphenated, and its distinguishing word whole. */
  const headForm = (name: string, distinct: string): string => {
    const [first] = name.split(/\s+/);
    return `${first.includes("-") ? first.split("-")[0] : first}${CUT_MARK} ${distinct}${CUT_MARK}`;
  };

  it("tells two families' look-alikes apart by their first word where a cut keeping it and the distinguishing word fits", () => {
    const words = new Map(names);
    const families = [
      ["Four-Lane Perpendicular Parking Road", "One-Lane One-Way Perpendicular Parking Road", "Two-Lane Divided Perpendicular Parking Road", "Two-Lane Perpendicular Parking Road"],
      ["Four-Lane Highway One-Way Suspension Bridge", "Two-Lane Highway One-Way Suspension Bridge"],
    ];
    const box = roomOf(1.3, "moreBuildings");

    for (const family of families) {
      const plans = family.map((name) => planName(name, box, { keep: [words.get(name) ?? ""] }).lines.join(" "));
      const fits = family.map((name) => textWidth(headForm(name, words.get(name) ?? ""), box.font) <= box.width);

      family.forEach((name, one) => family.forEach((other, two) => {
        if (two <= one || !fits[one] || !fits[two]) return;
        assert.notEqual(plans[one], plans[two], `${name} and ${other} both draw ${plans[one]}`);
      }));
      assert.ok(fits.some(Boolean), family.join(" | "));
    }

    // Over every base-game name in each form: two cut names of two families (their first words differ)
    // never read alike where each one's cut keeping its first word and its distinguishing word fits, and
    // those two cuts differ.
    for (const [textScale, atLargeText] of forms) {
      const box = roomOf(textScale, atLargeText);
      const drawn = new Map<string, string[]>();

      for (const [name, distinct] of new Map(names)) {
        const plan = planName(name, box, { keep: [distinct] });
        if (plan.whole || distinct === "" || STOP_WORDS.has(distinct.toLowerCase())) continue;
        const form = headForm(name, distinct);
        if (textWidth(form, box.font) > box.width) continue;

        const key = plan.lines.join(" ");
        const family = name.split(/\s+/)[0].toLowerCase();
        for (const other of drawn.get(key) ?? []) {
          if (other.split(/\s+/)[0].toLowerCase() === family) continue;
          assert.equal(headForm(other, words.get(other) ?? ""), form, `${textScale} ${atLargeText}: ${name} and ${other} both draw ${key}`);
        }
        drawn.set(key, [...(drawn.get(key) ?? []), name]);
      }
    }
  });

  it("opens a cut around the distinguishing word with the mark where asked, its first word dropped, the word kept whole", () => {
    const box = roomOf(1.5, "moreBuildings");
    const name = "Two-Lane Divided Angled Parking Road";

    assert.equal(planName(name, box, { keep: ["Angled"] }).lines.join(" "), `Two${CUT_MARK} Angled${CUT_MARK}`);
    const leading = planName(name, box, { keep: ["Angled"], leads: true }).lines.join(" ");
    assert.ok(leading.startsWith(CUT_MARK) && leading.split(" ").some((token) => token.replace(/^…|…$/gu, "") === "Angled"), leading);
    // A name that fits whole, or cut between whole words, is planned alike either way.
    assert.deepEqual(planName("Elementary School", box, { leads: true }), planName("Elementary School", box));
  });

  it("keeps the distinguishing word over a typed word at large text, so the parking roads draw apart under \"ro\"", () => {
    const words = new Map(names);
    const parking = [...words.keys()].filter((name) => /(Angled|Perpendicular) Parking Road$/u.test(name));

    assert.ok(parking.length >= 8, parking.join(" | "));
    for (const textScale of [1.3, 1.5]) {
      const box = roomOf(textScale, "moreBuildings");
      const plans = parking.map((name) => planName(name, box, { keep: [words.get(name) ?? ""], typed: ["ro"] }).lines.join(" "));

      parking.forEach((name, at) => {
        const tokens = plans[at].split(" ").map((token) => token.replace(/^…|…$/gu, ""));
        assert.ok(tokens.includes(words.get(name) ?? ""), `${name} at ${textScale}: ${plans[at]}`);
        assert.ok(planFits([plans[at]], box), `${name} at ${textScale}: ${plans[at]}`);
      });
    }
  });

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

describe("a name sketched for a plate away from the screen", () => {
  const baseNames: [string, string][] = JSON.parse(readFileSync(new URL("./fixtures/baseGameNames.json", import.meta.url), "utf8"));

  it("draws whole where the name fits, as its plan does", () => {
    assert.deepEqual(sketchName("Covered Pedestrian Bridge", plate(95)), planName("Covered Pedestrian Bridge", plate(95)));
  });

  it("is cut inside where it does not, its head and its tail kept, without a plan worked out", () => {
    const planned = plansWorkedOut();
    const sketch = sketchName("Four-Lane Perpendicular Parking Road", plate(60, 1));

    assert.equal(plansWorkedOut(), planned);
    assert.equal(sketch.whole, false);
    assert.equal(sketch.lines.length, 1);
    assert.match(sketch.lines[0], /^Four.*….*Road$/);
  });

  it("is kept, so a far plate drawn again, as each keystroke draws it, sketches nothing again, and no plan is counted", () => {
    const planned = plansWorkedOut();
    const sketch = sketchName("Four-Lane Perpendicular Parking Road Kept", plate(60, 1));

    assert.equal(sketchName("Four-Lane Perpendicular Parking Road Kept", plate(60, 1)), sketch);
    assert.equal(plansWorkedOut(), planned);
  });

  it("never draws a line wider than its room nor more lines than it has, over the base game's names at every text scale", () => {
    for (const [width, lines, font] of [[160, 2, 11], [120, 2, 14.3], [130, 1, 16.5], [60, 1, 16.5], [20, 1, 16.5]] as const) {
      for (const [name] of baseNames) {
        const sketch = sketchName(name, { width, lines, font });
        assert.ok(planFits(sketch.lines, { width, lines, font }) && sketch.lines.length <= lines, `${name} in ${width}×${lines} at ${font}: ${sketch.lines.join(" / ")}`);
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

describe("a word as typed words begin it", () => {
  it("lower-cases the word and leaves a letter or a digit of any script where it stands", () => {
    assert.equal(opening("Éclair"), "éclair");
    assert.equal(opening("Žižkov"), "žižkov");
    assert.equal(opening("Москва"), "москва");
    assert.equal(opening("Αθήνα"), "αθήνα");
    assert.equal(opening("東京駅"), "東京駅");
    assert.equal(opening("ひらがな"), "ひらがな");
    assert.equal(opening("カタカナ"), "カタカナ");
    assert.equal(opening("한국"), "한국");
    assert.equal(opening("ไทย"), "ไทย");
    assert.equal(opening("שלום"), "שלום");
    assert.equal(opening("مدينة"), "مدينة");
    assert.equal(opening("नगर"), "नगर");
    assert.equal(opening("4-Lane"), "4-lane");
    assert.equal(opening("2x2"), "2x2");
  });

  it("counts the digits of other scripts as digits, as the Unicode number class did: Arabic-Indic, Persian and fullwidth", () => {
    assert.equal(opening("(\u0663\u0664"), "\u0663\u0664");
    assert.equal(opening("\u00AB\u06F4\u06F5"), "\u06F4\u06F5");
    assert.equal(opening("(\uFF11\uFF12"), "\uFF11\uFF12");
    assert.equal(opening("-\u0669"), "\u0669");
  });

  it("counts Thai, Lao, Myanmar and Khmer digits as digits too", () => {
    assert.equal(opening("(\u0E52\u0E53"), "\u0E52\u0E53");
    assert.equal(opening("(\u0ED1"), "\u0ED1");
    assert.equal(opening("(\u1041\u1049"), "\u1041\u1049");
    assert.equal(opening("(\u17E0"), "\u17E0");
  });

  it("leaves off every opening mark that is neither a letter nor a digit", () => {
    assert.equal(opening("(Large)"), "large)");
    assert.equal(opening("\"Quoted\""), "quoted\"");
    assert.equal(opening("\u2018Quoted"), "quoted");
    assert.equal(opening("-Lane"), "lane");
    assert.equal(opening("\u2014Lane"), "lane");
    assert.equal(opening("[(\u00AB Garage"), "garage");
    assert.equal(opening("(\u00C9clair"), "\u00E9clair");
    assert.equal(opening("(\u6771\u4EAC"), "\u6771\u4EAC");
    assert.equal(opening("(42)"), "42)");
    assert.equal(opening("\u{1F6A7}Roadworks"), "roadworks");
    assert.equal(opening("\u{1F6A7}\u{1F6A7}"), "");
  });

  it("is empty for a word of marks alone", () => {
    assert.equal(opening("\u2014"), "");
    assert.equal(opening("- -"), "");
    assert.equal(opening(""), "");
  });
});
