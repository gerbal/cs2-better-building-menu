import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveVanillaLabel,
  vanillaCategoryNameKeys,
  vanillaMenuNameKeys,
} from "../src/domain/vanillaServiceLabels.ts";

describe("which key family names a menu or a category", () => {
  it("asks the menu family first for a menu", () => {
    // Measured live: Services.NAME[GarbageManagement] -> "Garbage Management".
    assert.equal(vanillaMenuNameKeys("GarbageManagement")[0], "Services.NAME[GarbageManagement]");
  });

  it("asks the category family first for a category", () => {
    // Measured live: Services.NAME[TransportationRoad] does NOT exist, and
    // asking under it rendered the raw prefab id in every language.
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
