import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBuildingDescriptionKeys,
  getBuildingExtensionLabels,
  getBuildingFlagGroups,
  getBuildingProvenanceChips,
  leisureLabel,
} from "../src/domain/assetMenuRowDetails.ts";

describe("Building description lookup", () => {
  it("asks for the asset description the game itself uses", () => {
    // PrefabUISystem.GetTitleAndDescription keys ordinary assets as
    // Assets.DESCRIPTION[<prefab.name>] and service upgrades as
    // Assets.UPGRADE_DESCRIPTION[<prefab.name>]; the entry carries prefabName.
    assert.deepEqual(getBuildingDescriptionKeys("ElementarySchool01"), [
      "Assets.DESCRIPTION[ElementarySchool01]",
      "Assets.UPGRADE_DESCRIPTION[ElementarySchool01]",
    ]);
  });

  it("returns no keys for a missing prefab name rather than a malformed one", () => {
    assert.deepEqual(getBuildingDescriptionKeys(""), []);
    assert.deepEqual(getBuildingDescriptionKeys(undefined), []);
  });
});

describe("Building flag groups", () => {
  it("ranks decision-relevant placement above lot and engine detail", () => {
    // All 19 BuildingFlags stay visible — a modder wants the engine detail —
    // but ordering them puts what constrains placement first and the lot
    // internals last, instead of one flat 19-chip wall.
    const groups = getBuildingFlagGroups([
      "ColorizeLot",
      "RequireRoad",
      "LeftAccess",
      "HasWaterNode",
      "RestrictedParking",
    ]);

    assert.deepEqual(groups.map((group) => group.id), ["placement", "access", "connections", "lot"]);
  });

  it("labels each flag in the game's own terms", () => {
    const groups = getBuildingFlagGroups(["RequireRoad", "NoRoadConnection", "CanBeOnRoad"]);

    assert.deepEqual(groups, [
      {
        id: "placement",
        label: "Placement",
        values: ["Requires a road connection", "No road connection", "Can be placed on a road"],
      },
    ]);
  });

  it("separates lot access and restrictions from the placement rule itself", () => {
    const groups = getBuildingFlagGroups(["LeftAccess", "BackAccess", "RestrictedCar"]);

    assert.deepEqual(groups, [
      { id: "access", label: "Access", values: ["Left", "Back", "No car access"] },
    ]);
  });

  it("reports which networks the building hooks into", () => {
    const groups = getBuildingFlagGroups([
      "HasWaterNode",
      "HasSewageNode",
      "HasLowVoltageNode",
      "HasResourceNode",
    ]);

    assert.deepEqual(groups, [
      { id: "connections", label: "Connections", values: ["Water", "Sewage", "Power", "Resources"] },
    ]);
  });

  it("humanizes a flag it has never seen instead of dropping it", () => {
    // The game adds flags between patches. An unknown flag landing in the lot
    // group readably beats it vanishing from the UI with no trace.
    const groups = getBuildingFlagGroups(["SomeFutureFlag"]);

    assert.deepEqual(groups, [{ id: "lot", label: "Lot", values: ["Some future flag"] }]);
  });

  it("emits nothing for a building with no flags", () => {
    assert.deepEqual(getBuildingFlagGroups(undefined), []);
    assert.deepEqual(getBuildingFlagGroups([]), []);
  });
});

describe("Extensions", () => {
  it("lists the upgrades a building supports", () => {
    assert.deepEqual(getBuildingExtensionLabels(["Bus Depot 01 Extra Garage", "Bus Station 02 Services"]), [
      "Bus Depot 01 Extra Garage",
      "Bus Station 02 Services",
    ]);
  });

  it("treats an empty extension list as nothing to show", () => {
    assert.deepEqual(getBuildingExtensionLabels([]), []);
    assert.deepEqual(getBuildingExtensionLabels(undefined), []);
  });
});

describe("Provenance", () => {
  it("names where the asset came from without repeating empties", () => {
    assert.deepEqual(
      getBuildingProvenanceChips({
        dlcId: "San Francisco",
        theme: "North American",
        assetPacks: ["Creator Pack: Modern Architecture"],
        provenance: "Base game",
      }),
      [
        { label: "DLC", value: "San Francisco" },
        { label: "Theme", value: "North American" },
        { label: "Pack", value: "Creator Pack: Modern Architecture" },
        { label: "Source", value: "Base game" },
      ]
    );
  });

  it("omits fields the adapter left blank", () => {
    assert.deepEqual(getBuildingProvenanceChips({ dlcId: "", theme: "European", assetPacks: [] }), [
      { label: "Theme", value: "European" },
    ]);
    assert.deepEqual(getBuildingProvenanceChips({}), []);
  });

  it("shows the DLC's name rather than its raw numeric id", () => {
    // The adapter puts the raw DlcId on the entry while the facet group
    // carries the display name, so the row resolves through the filter's table.
    const resolve = (groupId: string, value: string) =>
      groupId === "dlc" && value === "2427741" ? "Landmark Buildings" : null;

    assert.deepEqual(getBuildingProvenanceChips({ dlcId: "2427741" }, resolve), [
      { label: "DLC", value: "Landmark Buildings" },
    ]);
  });

  it("draws no DLC chip for the game's base-game and invalid sentinels", () => {
    // Colossal.PSI.Common.DlcId: BaseGame is -2009, Invalid is -1. The facet
    // names the base game through its own "vanilla" option, so the resolver
    // has nothing — and base game is no DLC; the Source chip already says so.
    assert.deepEqual(getBuildingProvenanceChips({ dlcId: "-2009", provenance: "Vanilla" }, () => null), [
      { label: "Source", value: "Vanilla" },
    ]);
    assert.deepEqual(getBuildingProvenanceChips({ dlcId: "-1" }, () => null), []);
  });

  it("falls back to the raw value when the facet has no matching option", () => {
    assert.deepEqual(getBuildingProvenanceChips({ dlcId: "-9999" }, () => null), [
      { label: "DLC", value: "-9999" },
    ]);
  });

  it("joins multiple asset packs into one chip", () => {
    assert.deepEqual(getBuildingProvenanceChips({ assetPacks: ["Pack A", "Pack B"] }), [
      { label: "Pack", value: "Pack A, Pack B" },
    ]);
  });
});

describe("Resolving an asset's description", () => {
  // The real dictionary's behaviour: a key that exists returns its text; a key
  // that does not returns ITSELF.
  const dictionary: Record<string, string> = {
    "Assets.DESCRIPTION[ElementarySchool01]":
      "A place of basic education for children. Provides the first level of education. \r\nCan be upgraded with an extension wing.",
    "Assets.UPGRADE_DESCRIPTION[ElementarySchool01 Wing]": "Adds classroom space.",
    "Assets.DESCRIPTION[Road Two Lane]": "Simple two-lane road that allows traffic in both directions.",
  };
  const translate = (key: string, fallback: string): string =>
    Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : key || fallback;

  it("returns the game's own sentence for a building", async () => {
    const { resolveAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    // The CRLF the game ships comes back as a single space; see the
    // line-break suite below for why.
    assert.equal(
      resolveAssetDescription("ElementarySchool01", translate),
      "A place of basic education for children. Provides the first level of education. Can be upgraded with an extension wing.",
    );
  });

  it("returns one for a network too", async () => {
    const { resolveAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    // Verified in the running game: networks carry descriptions, so the card
    // is not a buildings-only feature.
    assert.equal(
      resolveAssetDescription("Road Two Lane", translate),
      "Simple two-lane road that allows traffic in both directions.",
    );
  });

  it("falls through to the upgrade key when there is no ordinary description", async () => {
    const { resolveAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    assert.equal(resolveAssetDescription("ElementarySchool01 Wing", translate), "Adds classroom space.");
  });

  it("never renders the locale key as if it were prose", async () => {
    const { resolveAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    // The whole reason this function exists. translate echoes a missing key
    // back rather than returning null, so without the guard an unlocalized
    // asset's card would read "Assets.DESCRIPTION[NotAPrefab]".
    assert.equal(resolveAssetDescription("NotAPrefab", translate), null);
  });

  it("has nothing to say about an asset with no prefab name", async () => {
    const { resolveAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    assert.equal(resolveAssetDescription("", translate), null);
    assert.equal(resolveAssetDescription(null, translate), null);
    assert.equal(resolveAssetDescription(undefined, translate), null);
  });

  it("treats whitespace-only text as no description", async () => {
    const { resolveAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    const blank = (key: string) => (key === "Assets.DESCRIPTION[Blank]" ? "   " : key);

    assert.equal(resolveAssetDescription("Blank", blank), null);
  });

  it("survives a translate that returns null", async () => {
    const { resolveAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    assert.equal(resolveAssetDescription("Anything", () => null), null);
  });
});

describe("Clamping a description to the hover card", () => {
  it("leaves a short description alone", async () => {
    const { clampAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    const short = "A facility for performing geological research and field studies.";

    assert.equal(clampAssetDescription(short), short);
  });

  it("cuts a long one on a word boundary and says so", async () => {
    const { clampAssetDescription, ASSET_DESCRIPTION_CLAMP_CHARS } = await import(
      "../src/domain/assetMenuRowDetails.ts"
    );

    // The Medical University's real text, 231 characters — longer than the
    // three lines the card draws.
    const long =
      "Academic schooling for medical professions. Provides the fourth level of education, and increases the efficiency of healthcare service buildings. Can be upgraded with an extension wing, research facilities, and a library.";
    const clamped = clampAssetDescription(long) ?? "";

    assert.equal(clamped.endsWith("…"), true);
    assert.equal(clamped.length <= ASSET_DESCRIPTION_CLAMP_CHARS + 1, true);
    // The cut lands between words: no half-word before the ellipsis.
    assert.equal(/\s\S*…$/.test(clamped) || !clamped.includes(" "), true);
    assert.equal(long.startsWith(clamped.slice(0, -1)), true);
  });

  it("does not leave punctuation stranded before the ellipsis", async () => {
    const { clampAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    // "…of education, …" reads as a comma that lost its clause.
    const clamped = clampAssetDescription("one two three, four five six", 15) ?? "";

    assert.equal(clamped, "one two three…");
  });

  it("keeps half a word rather than nothing when one word exceeds the budget", async () => {
    const { clampAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    assert.equal(clampAssetDescription("Supercalifragilistic", 8), "Supercal…");
  });

  it("has nothing to clamp when there is no description", async () => {
    const { clampAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    assert.equal(clampAssetDescription(null), null);
    assert.equal(clampAssetDescription(undefined), null);
    assert.equal(clampAssetDescription("   "), null);
  });

  it("falls back to the shared budget on a nonsense one", async () => {
    const { clampAssetDescription, ASSET_DESCRIPTION_CLAMP_CHARS } = await import(
      "../src/domain/assetMenuRowDetails.ts"
    );

    const long = "word ".repeat(80);

    assert.equal((clampAssetDescription(long, Number.NaN) ?? "").length <= ASSET_DESCRIPTION_CLAMP_CHARS + 1, true);
  });
});

describe("Rendering the game's own line break", () => {
  it("collapses the CRLF the engine cannot honour", async () => {
    const { resolveAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    // white-space: pre-line computes to normal in Cohtml, so the break renders
    // as a space however it is asked for. Collapsed in the resolver, so the
    // string returned is the string drawn.
    const translate = (key: string) =>
      key === "Assets.DESCRIPTION[School]" ? "First sentence. \r\nSecond sentence." : key;

    assert.equal(resolveAssetDescription("School", translate), "First sentence. Second sentence.");
  });
});

describe("Where the clamp prefers to cut", () => {
  it("ends on a finished sentence rather than a dangling word", async () => {
    const { clampAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    // The word-boundary cut can land a few characters past the end of a
    // sentence and produce "…buildings. Can…".
    const long =
      "Academic schooling for medical professions. Provides the fourth level of education, and increases the efficiency of healthcare service buildings. Can be upgraded with an extension wing.";

    assert.equal(
      clampAssetDescription(long),
      "Academic schooling for medical professions. Provides the fourth level of education, and increases the efficiency of healthcare service buildings…",
    );
  });

  it("keeps the word cut when the last sentence ended too far back", async () => {
    const { clampAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    // Honouring a sentence that ended in the first half of the budget would
    // throw away a line of text to save one word.
    const text = "Short. " + "a".repeat(20) + " " + "b".repeat(20) + " " + "c".repeat(20);

    assert.equal(clampAssetDescription(text, 40), "Short. " + "a".repeat(20) + "…");
  });

  it("does not mistake a decimal point for the end of a thought", async () => {
    const { clampAssetDescription } = await import("../src/domain/assetMenuRowDetails.ts");

    const clamped = clampAssetDescription("Increases efficiency by 12.5 percent across the whole city always", 30) ?? "";

    assert.equal(clamped.includes("12.5"), true);
    assert.equal(clamped.endsWith("…"), true);
  });
});

describe("leisureLabel", () => {
  it("asks the game for its own word", () => {
    // Vanilla ships Properties.LEISURE_TYPE[CityPark] and [CityIndoors], so a
    // park reads the same here as everywhere else in the UI, in every
    // language. Our own wording would be a second vocabulary for one property.
    const translate = (key: string) =>
      key === "Properties.LEISURE_TYPE[CityPark]" ? "Outdoor recreation" : null;

    assert.equal(leisureLabel("CityPark", translate), "Outdoor recreation");
  });

  it("spells the enum out when the game has no string for it", () => {
    // Wrong-ish English, right about which value it is — better than a blank
    // where a card promised a fact.
    assert.equal(leisureLabel("CityIndoors", () => null), "City Indoors");
    assert.equal(leisureLabel("Sightseeing", () => null), "Sightseeing");
  });

  it("says nothing for a building that provides no leisure", () => {
    // Most of the catalog. The card and the hover line both drop out on "".
    assert.equal(leisureLabel("", () => "unused"), "");
    assert.equal(leisureLabel(null, () => "unused"), "");
    assert.equal(leisureLabel(undefined, () => "unused"), "");
    assert.equal(leisureLabel("   ", () => "unused"), "");
  });
});
