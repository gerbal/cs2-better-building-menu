import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

/**
 * The version lives in five files, and a release bump that misses one ships a
 * wrong number somewhere, such as the UI bundle's banner. The csproj is the one
 * the DLL carries; the rest must agree.
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

describe("the publish configuration", () => {
  it("is well-formed XML where the changelog's text can break it", () => {
    // ModPublisher refuses a file with a bare ampersand before it signs in, and
    // the changelog is prose that names things like "Shrubs & Bushes". Every &
    // must open an entity.
    const xml = read("../../Properties/PublishConfiguration.xml");
    assert.doesNotMatch(xml, /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/);
    assert.doesNotMatch(xml.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, ""), /</);
  });
});
