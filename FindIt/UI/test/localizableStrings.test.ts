import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  LOCALIZABLE_STRINGS,
  getUnplumbedStrings,
} from "../src/domain/localizableStrings.ts";
import { GROUP_DIMENSIONS, UNGROUPED_LABEL } from "../src/domain/buildingGroups.ts";

const locale = JSON.parse(readFileSync(new URL("../../Locale.json", import.meta.url), "utf8"));

describe("Localizable strings register", () => {
  it("gives every entry a well-formed, unique key", () => {
    const keys = LOCALIZABLE_STRINGS.map((entry) => entry.key);

    assert.equal(new Set(keys).size, keys.length, "duplicate key in the register");

    for (const entry of LOCALIZABLE_STRINGS) {
      assert.match(entry.key, /^Tooltip\.LABEL\[FindItBuildingMenu\.[A-Za-z0-9_]+\]$/, entry.key);
      assert.notEqual(entry.english.trim(), "", entry.key);
      assert.notEqual(entry.source.trim(), "", entry.key);
    }
  });

  it("ships an English string in Locale.json for every key already plumbed", () => {
    // A plumbed key with no entry falls back to the literal in the call site,
    // which works but leaves the English in two places and a translator with
    // nothing to find.
    for (const entry of LOCALIZABLE_STRINGS.filter((candidate) => candidate.plumbed)) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(locale, entry.key),
        `Locale.json is missing ${entry.key}`
      );
    }
  });

  it("agrees with Locale.json about what the English is", () => {
    // Drift here means the panel shows one string and a translator is handed
    // another.
    for (const entry of LOCALIZABLE_STRINGS.filter((candidate) => candidate.plumbed)) {
      if (!Object.prototype.hasOwnProperty.call(locale, entry.key)) continue;
      assert.equal(locale[entry.key], entry.english, entry.key);
    }
  });

  it("registers every group dimension the picker offers", () => {
    // The guard that matters: a new dimension added without a key would render
    // its English label in every language.
    for (const dimension of GROUP_DIMENSIONS) {
      const key = `Tooltip.LABEL[FindItBuildingMenu.GroupBy_${dimension.id}]`;
      assert.ok(
        LOCALIZABLE_STRINGS.some((entry) => entry.key === key),
        `${dimension.id} is not in the localizable register`
      );
    }
  });

  it("registers the strings a pure module still returns as text", () => {
    // These are the ones a translation pass has to plumb, not merely translate:
    // the domain modules cannot call translate, so the domain has to return a
    // key and the component has to render it.
    const unplumbed = getUnplumbedStrings();

    assert.ok(unplumbed.length > 0, "nothing left to plumb means the register is stale");
    assert.ok(
      unplumbed.some((entry) => entry.english === UNGROUPED_LABEL),
      "the Other heading is rendered from a pure module and must be registered"
    );
  });

  it("keeps the unplumbed list honest about where the string comes from", () => {
    for (const entry of getUnplumbedStrings()) {
      assert.match(
        entry.source,
        /buildingGroups|buildingLensFilterSummary|filterChips|buildingLensMetricFormat/,
        `${entry.key} claims a source no pure module owns`
      );
    }
  });
});
