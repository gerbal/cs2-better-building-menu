import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { bodyGrid } from "../src/domain/bodyGeometry";
import { NAME_FONT, plateNameRoom } from "../src/domain/listPlate";
import { CUT_MARK, planFits, planName, plansWorkedOut, type NameBox } from "../src/domain/namePlan";
import { wordsApart, type PlateName } from "../src/domain/platesApart";
import { ASSET_MENU_DEFAULT_HEIGHT } from "../src/domain/sharedContracts.generated";

/** The base game's names, each with its distinguishing word in its menu. */
const names: [string, string][] = JSON.parse(readFileSync(new URL("./fixtures/baseGameNames.json", import.meta.url), "utf8"));
const forms = [[1, "moreBuildings"], [1.1, "moreBuildings"], [1.3, "moreBuildings"], [1.5, "moreBuildings"], [1.1, "wholeNames"], [1.3, "wholeNames"], [1.5, "wholeNames"]] as const;

/** A plate's name room in a form, at its text scale, with a cost beside it. */
const roomOf = (textScale: number, atLargeText: string): NameBox => {
  const grid = bodyGrid({ body: "list", boxWidth: 706, bodyHeight: ASSET_MENU_DEFAULT_HEIGHT, textScale, atLargeText, tileSize: 64, plateHeight: 27.25, nameLines: 0 });
  const numbers = grid.form === "plate2" ? { first: "¢12,500", second: "1,200", glyph: "person" as const, locked: false } : { first: "¢12,500", second: null, glyph: null, locked: false };
  return { width: plateNameRoom(grid, numbers, false, textScale), lines: grid.nameLines, font: NAME_FONT * textScale };
};

const page = (room: NameBox, rows: readonly (readonly [string, string])[]): PlateName[] => rows.map(([name, distinct], id) => ({ id, name, distinct, room }));

/** What each plate draws once the pass has told them apart. */
const drawn = (plates: readonly PlateName[], typed: readonly string[] = [""]): string[] => {
  const apart = wordsApart(plates, typed);
  return plates.map((plate) => {
    const hints = apart.get(plate.id);
    return planName(plate.name, plate.room, { keep: [plate.distinct, ...(hints?.keep ?? [])], typed, leads: hints?.leads ?? false }).lines.join("\n");
  });
};

/** Whether lines hold a word whole, a mark at most either side. */
const whole = (text: string, word: string): boolean => text.split(/\s/).some((token) => token.replace(/^…|…$/gu, "").toLowerCase() === word.toLowerCase());

describe("the list's plates told apart over the page", () => {
  const at150 = roomOf(1.5, "moreBuildings");

  it("draws NA Low and NA Tall Aluminum Fence apart at 150% text, where each alone cuts to \"NA… Aluminum…\"", () => {
    const fences = page(at150, [["NA Low Aluminum Fence", "Aluminum"], ["NA Tall Aluminum Fence", "Aluminum"]]);
    const alone = fences.map((plate) => planName(plate.name, plate.room, { keep: [plate.distinct] }).lines.join("\n"));
    const told = drawn(fences);

    assert.deepEqual(alone, [`NA${CUT_MARK} Aluminum${CUT_MARK}`, `NA${CUT_MARK} Aluminum${CUT_MARK}`]);
    assert.notEqual(told[0], told[1]);
    assert.ok(told.every((text) => whole(text, "Aluminum")), told.join(" | "));
    assert.match(told[1], /Tall/);
  });

  it("draws Two-Lane Angled and Two-Lane Divided Angled Parking Road apart at 150% text, one with the mark leading", () => {
    const roads = page(at150, [["Two-Lane Angled Parking Road", "Angled"], ["Two-Lane Divided Angled Parking Road", "Angled"]]);
    const told = drawn(roads);

    assert.equal(planName(roads[0].name, at150, { keep: ["Angled"] }).lines.join(), planName(roads[1].name, at150, { keep: ["Angled"] }).lines.join());
    assert.notEqual(told[0], told[1]);
    assert.ok(told.every((text) => whole(text, "Angled")), told.join(" | "));
    assert.ok(told.some((text) => text.startsWith(CUT_MARK)), told.join(" | "));
  });

  it("leaves a page with no two plates alike as it is, and plans no name again on the next pass", () => {
    const plain = page(at150, [["Elementary School", ""], ["High School", ""], ["University", ""]]);
    wordsApart(plain, [""]);
    const planned = plansWorkedOut();

    assert.equal(wordsApart(plain, [""]).size, 0);
    assert.equal(plansWorkedOut(), planned);
    const fences = page(at150, [["NA Low Aluminum Fence", "Aluminum"], ["NA Tall Aluminum Fence", "Aluminum"]]);
    wordsApart(fences, [""]);
    const again = plansWorkedOut();
    wordsApart(fences, [""]);
    assert.equal(plansWorkedOut(), again);
  });

  it("over the base game's names in every form and search, draws fewer plates alike and never more, and keeps every planner guarantee", () => {
    for (const typedText of ["", "ro", "pa"]) {
      const typed = [typedText];
      for (const [textScale, atLargeText] of forms) {
        const room = roomOf(textScale, atLargeText);
        const seen = new Set<string>();
        const plates = page(room, names.filter(([name]) => !seen.has(name) && seen.add(name) && name.toLowerCase().includes(typedText)));
        const alone = plates.map((plate) => planName(plate.name, room, { keep: [plate.distinct], typed }).lines.join("\n"));
        const told = drawn(plates, typed);
        const pairs = (texts: readonly string[]) => {
          const counts = new Map<string, number>();
          texts.filter(Boolean).forEach((text) => counts.set(text, (counts.get(text) ?? 0) + 1));
          return [...counts.values()].reduce((sum, n) => sum + (n * (n - 1)) / 2, 0);
        };
        const where = `"${typedText}" at ${textScale} ${atLargeText}`;

        assert.ok(pairs(told) <= pairs(alone), where);
        if (typedText === "" && textScale === 1.5 && atLargeText === "moreBuildings") assert.ok(pairs(told) * 2 < pairs(alone), `${where}: ${pairs(told)} of ${pairs(alone)}`);
        plates.forEach((plate, at) => {
          const lines = told[at] === "" ? [] : told[at].split("\n");
          assert.ok(planFits(lines, room) && lines.length <= room.lines, `${where}: ${plate.name} draws ${told[at]}`);
          assert.ok(lines.every((line) => line.split(CUT_MARK).length - 1 <= 2), `${where}: ${plate.name} draws ${told[at]}`);
          if (plate.distinct !== "" && whole(alone[at], plate.distinct)) assert.ok(whole(told[at], plate.distinct), `${where}: ${plate.name} draws ${told[at]}`);
        });
      }
    }
  });
});
