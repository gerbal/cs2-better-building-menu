import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideExtensionMenu, type VanillaUpgradeRow } from "../src/domain/extensionMenu.ts";
import type { BuildingCatalogEntry } from "../src/domain/buildingCatalog.ts";

// The picker replaces vanilla's only when it can account for every row vanilla
// lists. Vanilla is the authority on WHAT may be attached; our catalog only
// supplies how each row is presented. So a row we cannot present means the
// whole panel stays vanilla's — never a partial list, never a synthesised row.

const listed = (name: string, over: Partial<VanillaUpgradeRow> = {}): VanillaUpgradeRow => ({
  entity: { index: name.length, version: 1 },
  name,
  locked: false,
  unique: false,
  placed: false,
  ...over,
});

const entry = (prefabName: string, over: Partial<BuildingCatalogEntry> = {}): BuildingCatalogEntry =>
  ({ id: prefabName.length, prefabName, name: `The ${prefabName}`, isLocked: false, isUnique: false, isAlreadyBuilt: false, ...over }) as BuildingCatalogEntry;

describe("whether our extension picker draws", () => {
  it("stays vanilla when the mod is not replacing menus", () => {
    const decision = decideExtensionMenu({
      enabled: false,
      listed: [listed("HearseGarage")],
      entries: [entry("HearseGarage")],
    });

    assert.deepEqual(decision, { mode: "vanilla", reason: "disabled" });
  });

  it("stays vanilla when vanilla lists nothing", () => {
    // The panel is not visible then anyway; this keeps the rule total.
    const decision = decideExtensionMenu({ enabled: true, listed: [], entries: [entry("HearseGarage")] });

    assert.deepEqual(decision, { mode: "vanilla", reason: "nothing-listed" });
  });

  it("stays vanilla when any listed row has no catalog entry, and names it", () => {
    // A cold index (cm-36os), or a mod's upgrade the indexer never saw. Either
    // way the player must still be able to place it, so vanilla draws.
    const decision = decideExtensionMenu({
      enabled: true,
      listed: [listed("HearseGarage"), listed("Columbarium")],
      entries: [entry("HearseGarage")],
    });

    assert.deepEqual(decision, { mode: "vanilla", reason: "unaccounted", missing: ["Columbarium"] });
  });

  it("draws ours in vanilla's order, not the catalog's", () => {
    const decision = decideExtensionMenu({
      enabled: true,
      listed: [listed("Columbarium"), listed("HearseGarage")],
      entries: [entry("HearseGarage"), entry("Columbarium")],
    });

    assert.equal(decision.mode, "ours");
    if (decision.mode !== "ours") return;
    assert.deepEqual(decision.rows.map((row) => row.entry.prefabName), ["Columbarium", "HearseGarage"]);
    assert.deepEqual(decision.rows.map((row) => row.entity), [
      { index: "Columbarium".length, version: 1 },
      { index: "HearseGarage".length, version: 1 },
    ]);
  });

  it("takes locked, unique and built from vanilla, not from the catalog", () => {
    // The catalog's flags are per-prefab and city-wide. Vanilla's are computed
    // for THIS building — CheckExtensionBuiltStatus reads the instance's
    // InstalledUpgrade buffer — so vanilla's win.
    const decision = decideExtensionMenu({
      enabled: true,
      listed: [listed("HearseGarage", { locked: true, unique: true, placed: true })],
      entries: [entry("HearseGarage", { isLocked: false, isUnique: false, isAlreadyBuilt: false })],
    });

    assert.equal(decision.mode, "ours");
    if (decision.mode !== "ours") return;
    const [row] = decision.rows;
    assert.equal(row.entry.isLocked, true);
    assert.equal(row.entry.isUnique, true);
    assert.equal(row.entry.isAlreadyBuilt, true);
  });

  it("drops catalog entries vanilla does not list", () => {
    const decision = decideExtensionMenu({
      enabled: true,
      listed: [listed("HearseGarage")],
      entries: [entry("HearseGarage"), entry("Crematorium01")],
    });

    assert.equal(decision.mode, "ours");
    if (decision.mode !== "ours") return;
    assert.deepEqual(decision.rows.map((row) => row.entry.prefabName), ["HearseGarage"]);
  });
});
