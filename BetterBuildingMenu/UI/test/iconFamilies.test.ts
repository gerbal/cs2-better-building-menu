import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog";
import { familyTones, pillText } from "../src/domain/iconFamilies";

const icon = (id: number, familyKey = "", familyToken = ""): BuildingCatalogEntry => ({ id, name: `Prop ${id}`, familyKey, familyToken } as BuildingCatalogEntry);

describe("the icons' families", () => {
  it("say a member's varying word on its pill, letter and size alike, and nothing for a row in no family", () => {
    assert.equal(pillText(icon(1, "Boulder", "05"), 44, 1), "05");
    assert.equal(pillText(icon(2, "Boardwalk", "2x2"), 44, 1), "2x2");
    assert.equal(pillText(icon(3, "Pier", "2b"), 44, 1), "2b");
    assert.equal(pillText(icon(4), 44, 1), "");
  });

  it("leave off a pill too wide for its icon rather than cut it", () => {
    assert.equal(pillText(icon(1, "Wall", "1000x1000"), 44, 1), "");
    assert.equal(pillText(icon(2, "Boulder", "05"), 44, 1.5), "05");
  });

  it("alternate the plate's tone with each family run, the icons in no family keeping theirs", () => {
    const drawn = [icon(1), icon(2), icon(3, "Boulder", "01"), icon(4, "Boulder", "02"), icon(5, "Boulder", "03"), icon(6), icon(7, "Cairn", "01"), icon(8, "Cairn", "02"), icon(9, "Cairn", "03")];

    assert.deepEqual([...familyTones(drawn).values()], [0, 0, 1, 1, 1, 0, 1, 1, 1]);
    // Two families side by side differ too.
    assert.deepEqual([...familyTones([icon(1, "Boulder", "01"), icon(2, "Boulder", "02"), icon(3, "Cairn", "01")]).values()], [0, 0, 1]);
  });
});
