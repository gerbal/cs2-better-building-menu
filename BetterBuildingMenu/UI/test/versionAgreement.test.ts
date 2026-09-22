import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

/**
 * The version lives in five files, and a release bump that misses one ships a
 * wrong number somewhere: UI/mod.json said 0.1.0 into the bundle's banner for
 * eleven releases. The csproj is the one the DLL carries; the rest must agree.
 */
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const match = (text: string, pattern: RegExp, where: string): string => {
  const found = pattern.exec(text)?.[1];
  assert.ok(found, `no version found in ${where}`);
  return found;
};

describe("the release version", () => {
  const csproj = match(read("../../BetterBuildingMenu.csproj"), /<Version>([^<]+)<\/Version>/, "BetterBuildingMenu.csproj");

  const others: Array<[string, string]> = [
    ["modinfo.json", JSON.parse(read("../../../modinfo.json")).version],
    ["UI/mod.json", JSON.parse(read("../mod.json")).version],
    ["PublishConfiguration.xml ModVersion", match(read("../../Properties/PublishConfiguration.xml"), /<ModVersion Value="([^"]+)"/, "PublishConfiguration.xml")],
    ["PublishConfiguration.xml ChangeLog", match(read("../../Properties/PublishConfiguration.xml"), /<ChangeLog>\s*([0-9][^\s<]*)/, "the ChangeLog element")],
    ["Changelog.json newest entry", JSON.parse(read("../../Changelog.json"))[0].Version],
  ];

  for (const [where, version] of others) {
    it(`is the csproj's in ${where}`, () => {
      assert.equal(version, csproj);
    });
  }
});
