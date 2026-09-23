import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { LOCALIZABLE_STRINGS } from "../src/domain/localizableStrings.ts";
import { GROUP_DIMENSIONS } from "../src/domain/buildingGroups.ts";

/*
 * Locale.json against the code, both ways: every key the code names has an
 * English string, and every string is one the code can ask for. A key only
 * the file knows is a string a translator is paid to translate for nobody.
 */
const MOD = fileURLToPath(new URL("../../", import.meta.url));
const locale: Record<string, string> = JSON.parse(readFileSync(join(MOD, "Locale.json"), "utf8").replace(/^\uFEFF/, ""));

function sources(dir: string, pattern: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "bin" || name === "obj" || name === "test" || name === "build") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path, pattern));
    else if (pattern.test(name)) out.push(readFileSync(path, "utf8"));
  }
  return out;
}

const code = [...sources(MOD, /\.cs$/), ...sources(join(MOD, "UI", "src"), /\.tsx?$/)].join("\n");
const literalKeys = new Set(code.match(/(?:Tooltip|Options)\.[A-Z_]+\[BetterBuildingMenu\.[A-Za-z0-9_.]+\]/g) ?? []);

// The keys the code builds rather than spells.
const enumMembers = (file: string) =>
  [...readFileSync(join(MOD, "Domain", "Enums", file), "utf8").matchAll(/^\s*([A-Z]\w*)\s*(?:=[^,\n]+)?,?\s*$/gm)].map((m) => m[1]);
const setting = readFileSync(join(MOD, "Setting.cs"), "utf8");
const settings = [...setting.matchAll(/public (?:bool|int|float|string) (\w+) \{ get; set; \}/g)].map((m) => m[1]);

// The settings the Options screen draws, which it labels from these keys with
// no fallback of its own: a missing one shows the raw key in every language.
const SETTINGS_CLASS = "BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings";
const MOD_OPTIONS = "BetterBuildingMenu.BetterBuildingMenu.Mod";
const visibleSettings = [...setting.matchAll(/public (?:bool|int|float|string) (\w+) \{ get; set; \}/g)]
  .filter((m) => {
    const before = setting.slice(0, m.index);
    const attributes = before.slice(Math.max(before.lastIndexOf("}"), before.lastIndexOf(";")));
    return !attributes.includes("[SettingsUIHidden]");
  })
  .map((m) => m[1]);
const constants = new Map([...setting.matchAll(/public const string (\w+) = "([^"]+)";/g)].map((m) => [m[1], m[2]]));
const constantsIn = (attribute: string) =>
  [...setting.matchAll(new RegExp(`\\[${attribute}\\(([^)]*)\\)\\]`, "g"))]
    .flatMap((m) => m[1].split(",").map((name) => constants.get(name.trim())))
    .filter((value): value is string => value !== undefined);
const optionsScreenKeys = [
  `Options.SECTION[${MOD_OPTIONS}]`,
  ...constantsIn("SettingsUITabOrder").map((tab) => `Options.TAB[${MOD_OPTIONS}.${tab}]`),
  ...constantsIn("SettingsUIGroupOrder").map((group) => `Options.GROUP[${MOD_OPTIONS}.${group}]`),
  ...visibleSettings.flatMap((name) => [
    `Options.OPTION[${SETTINGS_CLASS}.${name}]`,
    `Options.OPTION_DESCRIPTION[${SETTINGS_CLASS}.${name}]`,
  ]),
];

function builtByCode(key: string): boolean {
  const label = /^Tooltip\.LABEL\[BetterBuildingMenu\.(\w+)\]$/.exec(key)?.[1];
  if (label !== undefined) {
    // BuildingCatalogLabels asks for a category or subcategory by its enum name.
    if (enumMembers("PrefabCategory.cs").includes(label) || enumMembers("PrefabSubCategory.cs").includes(label)) return true;
    if (GROUP_DIMENSIONS.some((dimension) => label === `GroupBy_${dimension.id}`)) return true;
    // One per density tier, held by GameLocaleKeyTests and translated in every
    // language, though BuildingCatalogLabels.DensityTier still draws English.
    if (label.startsWith("Zone") && enumMembers("ZoneTypeFilter.cs").includes(label.slice(4))) return true;
    if (LOCALIZABLE_STRINGS.some((entry) => entry.key === key)) return true;
  }
  // The game names a setting's label, description, section and tab itself.
  const option = /^Options\.(?:OPTION|OPTION_DESCRIPTION)\[BetterBuildingMenu\.BetterBuildingMenu\.Mod\.BetterBuildingMenuSettings\.(\w+)\]$/.exec(key)?.[1];
  if (option !== undefined) return settings.includes(option);
  return /^Options\.(?:SECTION|TAB|GROUP)\[/.test(key);
}

describe("Locale.json against the code", () => {
  it("has an English string for every key the code spells out", () => {
    const missing = [...literalKeys].filter((key) => !(key in locale));

    assert.deepEqual(missing, []);
  });

  it("has an English string for every label the Options screen draws", () => {
    // Guards the derivation too: a regex that matched nothing would pass vacuously.
    assert.ok(visibleSettings.length > 0 && constantsIn("SettingsUIGroupOrder").length > 0);
    const missing = optionsScreenKeys.filter((key) => !(key in locale));

    assert.deepEqual(missing, []);
  });

  it("holds no key the code cannot ask for", () => {
    // Spelled anywhere counts: the unlock requirements are keyed "Requirement.X".
    const orphans = Object.keys(locale).filter((key) => !code.includes(key) && !builtByCode(key));

    assert.deepEqual(orphans, []);
  });

  it("gives every translation only keys the English has", () => {
    // A translation cannot add a string; one the English dropped is dead there too.
    for (const file of readdirSync(join(MOD, "Locale"))) {
      const translation = JSON.parse(readFileSync(join(MOD, "Locale", file), "utf8").replace(/^\uFEFF/, ""));
      const extra = Object.keys(translation).filter((key) => !(key in locale));

      assert.deepEqual(extra, [], file);
    }
  });
});
