import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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
      assert.match(entry.key, /^Tooltip\.LABEL\[BetterBuildingMenu\.[A-Za-z0-9_]+\]$/, entry.key);
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
    // Drift here means the asset menu shows one string and a translator is handed
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
      const key = `Tooltip.LABEL[BetterBuildingMenu.GroupBy_${dimension.id}]`;
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
        /buildingGroups|assetMenuFilterSummary|filterChips|assetMenuMetricFormat/,
        `${entry.key} claims a source no pure module owns`
      );
    }
  });

  it("declares each Locale.json key exactly once", () => {
    // JSON parsers keep the last of a repeated key, so a duplicate silently
    // overrides what came before and every check on the parsed object still
    // passes. This file carries upstream FindIt's strings too, so keys collide.
    const raw = readFileSync(new URL("../../Locale.json", import.meta.url), "utf8");
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const [, declared] of raw.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)) {
      if (seen.has(declared)) duplicates.push(declared);
      seen.add(declared);
    }

    assert.deepEqual(duplicates, [], `duplicate key(s) in Locale.json: ${duplicates.join(", ")}`);
  });
});

describe("Every key the source asks for is a key we ship", () => {
  // The register above is a curated list, not the whole inventory. Locale.json
  // is the shipping contract: a key the source asks for and Locale.json does
  // not carry falls back to its English literal in every language, silently.
  const KEY = /Tooltip\.LABEL\[BetterBuildingMenu\.[A-Za-z0-9_]+\]/g;

  const sourceKeys = () => {
    const found = new Map<string, string[]>();
    const walk = (dir: URL) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
        if (entry.isDirectory()) {
          walk(child);
        } else if (/\.tsx?$/.test(entry.name)) {
          const text = readFileSync(child, "utf8");
          for (const key of text.match(KEY) ?? []) {
            found.set(key, [...(found.get(key) ?? []), entry.name]);
          }
        }
      }
    };
    walk(new URL("../src/", import.meta.url));
    return found;
  };

  it("ships an English string for every key rendered from the UI", () => {
    const missing = [...sourceKeys()]
      .filter(([key]) => !(key in locale))
      .map(([key, files]) => `${key} (${[...new Set(files)].join(", ")})`);

    assert.deepEqual(missing, [], `keys asked for but never shipped:\n  ${missing.join("\n  ")}`);
  });
});
