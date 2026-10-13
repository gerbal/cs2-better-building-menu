import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { pillText } from "../src/domain/iconFamilies";
import { bandLines, lockedBlock } from "../src/domain/iconPlate";
import { textWidth } from "../src/domain/textWidth";

const SCALES = [1, 1.25, 1.5];
const member = { id: 1, name: "Boulder 02", familyKey: "Boulder", familyToken: "02" } as BuildingCatalogEntry;
/** The pill's top and the band's, from the icon's top: iconsBody.module.scss's `.pill`, `.pillWord` and `.nameBand`. */
const pillTop = (side: number, scale: number) => side - 2 - 12 * scale;
const bandTop = (side: number, scale: number, lines: number) => side - 1 - 12 * scale * lines;

describe("a locked icon's plate", () => {
  it("say why it waits where the word fits the icon, else draw the lock alone, never cut", () => {
    for (const scale of SCALES) {
      for (const fact of ["MS 4", "MS 10", "Locked"]) {
        const { word } = lockedBlock(fact, 44, scale, false);
        assert.ok(word === "" || (word === fact && textWidth(fact, 10 * scale, "wider") <= 40), `${fact} at ${scale}`);
      }
    }
    assert.equal(lockedBlock("Locked", 44, 1, false).word, "Locked");
    assert.equal(lockedBlock("Locked", 44, 1.5, false).word, "");
    assert.equal(lockedBlock("MS 4", 44, 1.5, false).word, "MS 4");
  });

  it("end the lock and its word above the pill at every text scale, the pill giving way where they would meet", () => {
    const pills = SCALES.map((scale) => {
      const { foot } = lockedBlock("MS 4", 44, scale, false);
      const pill = pillText(member, 44, scale, foot);
      if (pill !== "") assert.ok(foot <= pillTop(44, scale), `at ${scale}`);
      return pill;
    });

    assert.deepEqual(pills, ["02", "", ""]);
    // The lock alone, under the lock's own 4 + 13.
    assert.equal(lockedBlock("Locked", 44, 1.5, false).foot, 17);
  });

  it("keep the icons with names' band under the lock row at every text scale, the band giving up a line where they would meet", () => {
    const lines = SCALES.map((scale) => {
      const { foot } = lockedBlock("MS 4", 44, scale, true);
      const held = bandLines(44, scale, foot);
      assert.ok(foot <= bandTop(44, scale, held), `at ${scale}`);
      return held;
    });

    assert.deepEqual(lines, [2, 1, 1]);
    // An icon with nothing over its band keeps both lines.
    assert.deepEqual(SCALES.map((scale) => bandLines(44, scale, 0)), [2, 2, 2]);
  });
});
