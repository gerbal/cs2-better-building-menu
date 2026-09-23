import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The upgrades a building supports are not the fact that it is one.
 *
 * `extensions` is a SELF-TAG: PrefabIndexingSystem writes the prefab's own
 * name into it when the prefab is itself an upgrade, and
 * BuildingCatalogQueryEngine drops any asset with a non-empty value from every
 * menu — so a row driven by it can never draw.
 *
 * Widening `extensions` to mean "what can attach to me" would delete every
 * upgradeable building from the build menus, because that exclusion would then
 * match them. The two meanings need two fields, permanently.
 *
 * A behavioural test cannot reach this: both fields are `string[]`, both read
 * through the same field-agnostic `getBuildingExtensionLabels`, and swapping
 * one identifier back would typecheck and pass every existing test.
 */
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

// The two sites that read the field — the expanded table row and the hover
// card — are tested by what they render: tableRow.test.tsx and
// buildingHoverCard.test.tsx list an upgrade from supportedUpgrades.

describe("the upgrades row reads what a building supports", () => {
  it("the entry type keeps both fields, so neither can absorb the other", () => {
    const src = read("../src/domain/buildingCatalog.ts");

    assert.ok(/^\s*extensions\?: string\[\];$/m.test(src), "extensions must survive as its own field");
    assert.ok(/^\s*supportedUpgrades\?: string\[\];$/m.test(src), "supportedUpgrades must be its own field");
  });
});
