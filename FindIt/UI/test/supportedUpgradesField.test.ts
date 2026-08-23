import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * cm-2xvs.19: the upgrades a building supports are not the fact that it is one.
 *
 * `extensions` is a SELF-TAG. PrefabIndexingSystem writes the prefab's own name
 * into it when the prefab is itself an upgrade, and BuildingCatalogQueryEngine
 * reads a non-empty value the way vanilla's FilterOutUpgrades does — drop this
 * from every menu. So for any asset the player can see in a menu, `extensions`
 * is empty by construction, and a row driven by it can never draw. That is the
 * bug: the hover card's "upgrades that can be attached later" row read
 * `entry.extensions`, so in every menu it was dead — for all 17,952 assets, not
 * only the 100 signatures the bead was filed about. The one place it did draw
 * was unscoped search, which is exempt from the exclusion and therefore shows
 * upgrades themselves: there the row named the asset as its own upgrade.
 *
 * The trap in the obvious fix is why this is pinned as text. Widening
 * `extensions` to mean "what can attach to me" would have deleted every
 * upgradeable building from the build menus, because the exclusion above would
 * then match them. The two meanings need two fields, permanently.
 *
 * A behavioural test cannot reach this: both fields are `string[]`, both read
 * through the same field-agnostic `getBuildingExtensionLabels`, and the row is
 * assembled inside the component. Swapping one identifier back would typecheck,
 * pass every existing test, and silently render nothing again.
 */
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

/** Comments stripped, so the prose above a call cannot pass or fail a check. */
const code = (src: string) =>
  src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const SITES = [
  ["hover card", "../src/mods/BuildingHoverCard/BuildingHoverCard.tsx"],
  ["table row detail", "../src/mods/BuildingCatalog/BuildingCatalog.tsx"],
] as const;

describe("the upgrades row reads what a building supports", () => {
  for (const [name, path] of SITES) {
    it(`${name}: names supportedUpgrades, never extensions`, () => {
      const src = code(read(path));

      assert.ok(
        src.includes("entry.supportedUpgrades"),
        `${name} must read entry.supportedUpgrades for the upgrades it lists`,
      );
      assert.ok(
        !src.includes("entry.extensions"),
        `${name} reads entry.extensions, which is empty for every asset a menu can show`,
      );
    });
  }

  it("the entry type keeps both fields, so neither can absorb the other", () => {
    const src = read("../src/domain/buildingCatalog.ts");

    assert.ok(/^\s*extensions\?: string\[\];$/m.test(src), "extensions must survive as its own field");
    assert.ok(/^\s*supportedUpgrades\?: string\[\];$/m.test(src), "supportedUpgrades must be its own field");
  });
});
