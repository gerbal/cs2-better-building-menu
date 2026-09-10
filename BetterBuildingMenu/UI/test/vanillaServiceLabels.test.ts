import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveVanillaLabel,
  vanillaCategoryNameKeys,
  vanillaMenuNameKeys,
} from "../src/domain/vanillaServiceLabels.ts";

describe("which key family names a menu or a category", () => {
  it("asks the menu family first for a menu", () => {
    // Services.NAME[GarbageManagement] -> "Garbage Management".
    assert.equal(vanillaMenuNameKeys("GarbageManagement")[0], "Services.NAME[GarbageManagement]");
  });

  it("asks the category family first for a category", () => {
    // Services.NAME[TransportationRoad] does not exist, and asking under it
    // renders the raw prefab id in every language.
    // SubServices.NAME[TransportationRoad] is the one that answers.
    assert.equal(
      vanillaCategoryNameKeys("TransportationRoad")[0],
      "SubServices.NAME[TransportationRoad]"
    );
  });

  it("still tries the other family, since a miss costs one lookup", () => {
    assert.deepEqual(vanillaMenuNameKeys("Zones"), [
      "Services.NAME[Zones]",
      "SubServices.NAME[Zones]",
    ]);
    assert.deepEqual(vanillaCategoryNameKeys("Zones"), [
      "SubServices.NAME[Zones]",
      "Services.NAME[Zones]",
    ]);
  });

  it("asks nothing for an absent id", () => {
    assert.deepEqual(vanillaMenuNameKeys(""), []);
    assert.deepEqual(vanillaMenuNameKeys("   "), []);
    assert.deepEqual(vanillaCategoryNameKeys(null), []);
    assert.deepEqual(vanillaCategoryNameKeys(undefined), []);
  });
});

describe("resolving a label", () => {
  it("takes the first key that answers", () => {
    const answers: Record<string, string> = { "SubServices.NAME[TransportationRoad]": "Road" };

    assert.equal(
      resolveVanillaLabel(
        vanillaCategoryNameKeys("TransportationRoad"),
        (key) => answers[key] ?? null,
        "TransportationRoad"
      ),
      "Road"
    );
  });

  it("falls through to the second family rather than to the id", () => {
    const answers: Record<string, string> = { "Services.NAME[Oddity]": "Oddity, named" };

    assert.equal(
      resolveVanillaLabel(vanillaCategoryNameKeys("Oddity"), (key) => answers[key] ?? null, "raw"),
      "Oddity, named"
    );
  });

  it("falls back to the raw id when nothing answers", () => {
    // This is the visible symptom of asking the wrong family: a chip reading
    // "ZonesCommercial" instead of "Commercial".
    assert.equal(
      resolveVanillaLabel(vanillaCategoryNameKeys("ZonesCommercial"), () => null, "ZonesCommercial"),
      "ZonesCommercial"
    );
  });

  it("treats a blank answer as no answer", () => {
    assert.equal(resolveVanillaLabel(["a"], () => "   ", "fallback"), "fallback");
    assert.equal(resolveVanillaLabel(["a"], () => undefined, "fallback"), "fallback");
  });
});

describe("the menu the lens renamed", () => {
  it("offers our name for Roads ahead of the game's", async () => {
    const { EXTENDED_NETWORK_MENU_KEY, vanillaMenuNameKeys } =
      await import("../src/domain/vanillaServiceLabels.ts");

    // Roads gathers every network, so the game's own "Roads" names fewer
    // assets than this menu holds.
    assert.equal(vanillaMenuNameKeys("Roads")[0], EXTENDED_NETWORK_MENU_KEY);
    assert.equal(vanillaMenuNameKeys("roads")[0], EXTENDED_NETWORK_MENU_KEY);
  });

  it("leaves every other menu with the game's name alone", async () => {
    const { vanillaMenuNameKeys } = await import("../src/domain/vanillaServiceLabels.ts");

    assert.deepEqual(vanillaMenuNameKeys("Transportation"), [
      "Services.NAME[Transportation]",
      "SubServices.NAME[Transportation]",
    ]);
  });

  it("still falls back to the game's name where ours is untranslated", async () => {
    const { resolveVanillaLabel, vanillaMenuNameKeys } =
      await import("../src/domain/vanillaServiceLabels.ts");

    // First, not instead: a language we have not covered gets "Roads" rather
    // than the raw prefab id an unconditional override would leave behind.
    const label = resolveVanillaLabel(
      vanillaMenuNameKeys("Roads"),
      (k) => (k === "Services.NAME[Roads]" ? "Straßen" : null),
      "Roads",
    );

    assert.equal(label, "Straßen");
  });
});
