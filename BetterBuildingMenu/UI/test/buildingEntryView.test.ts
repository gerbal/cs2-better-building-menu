import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { entryLabel, entryStateAttributes, entryStateWordOf, isArmedEntry, sortedBadgeText } from "../src/domain/buildingEntryView.ts";
import { FALLBACK_SEPARATORS, formatBuildingMetric, formatLotDimensions } from "../src/domain/assetMenuMetricFormat.ts";
import { entry } from "./harness/entries.ts";

describe("an entry's name", () => {
  it("is its display name, or its prefab name when it has none", () => {
    assert.equal(entryLabel(entry(1, { name: "Clinic", prefabName: "Clinic01" })), "Clinic");
    assert.equal(entryLabel(entry(1, { name: "", prefabName: "Clinic01" })), "Clinic01");
  });
});

describe("the word for why an entry cannot be placed", () => {
  // The hover card's labels carry "Requires" as well, heading the lock conditions.
  const labels = { locked: "Requires", lockedValue: "Locked", alreadyBuilt: "Already built" };

  it("is the hover card's state words, never the conditions' heading", () => {
    assert.equal(entryStateWordOf(entry(1, { isLocked: true }), labels), "Locked");
    assert.equal(entryStateWordOf(entry(1, { isAlreadyBuilt: true }), labels), "Already built");
    assert.equal(entryStateWordOf(entry(1), labels), null);
  });
});

describe("the sorted figure's text", () => {
  it("is nothing when the sort shows no figure", () => {
    assert.equal(sortedBadgeText(entry(1), null, FALLBACK_SEPARATORS), null);
  });

  it("states a lot as the table and the hover card do", () => {
    assert.equal(sortedBadgeText(entry(1, { lotWidth: 6, lotDepth: 4 }), "lot", FALLBACK_SEPARATORS), formatLotDimensions(6, 4));
  });

  it("is nothing for a lot of 0 × 0, which measures nothing", () => {
    assert.equal(sortedBadgeText(entry(1, { lotWidth: 0, lotDepth: 0 }), "lot", FALLBACK_SEPARATORS), null);
  });

  it("formats a figure the entry carries, per distance where it is priced so", () => {
    const road = entry(1, { constructionCost: 1250, costIsPerDistance: true });

    assert.equal(sortedBadgeText(road, "cost", FALLBACK_SEPARATORS), formatBuildingMetric(1250, "cost", FALLBACK_SEPARATORS, true));
  });

  it("is nothing for a figure the entry never carried, not a dash", () => {
    assert.equal(sortedBadgeText(entry(1, { workers: null as unknown as number }), "workers", FALLBACK_SEPARATORS), null);
  });
});

describe("the markers an entry's stylesheet keys off", () => {
  it("writes the vector marker both ways and the state markers only when set", () => {
    assert.deepEqual(
      { ...entryStateAttributes(entry(1, { thumbnail: "a.png" })) },
      { "data-locked": undefined, "data-already-built": undefined, "data-vector-thumb": "false" },
    );
    assert.deepEqual(
      { ...entryStateAttributes(entry(1, { thumbnail: "a.svg", isLocked: true })) },
      { "data-locked": "true", "data-already-built": undefined, "data-vector-thumb": "true" },
    );
    assert.deepEqual(
      { ...entryStateAttributes(entry(1, { thumbnail: "a.png", isAlreadyBuilt: true })) },
      { "data-locked": undefined, "data-already-built": "true", "data-vector-thumb": "false" },
    );
  });

  it("hands every row in the same state the same object, so a row allocates none", () => {
    assert.equal(entryStateAttributes(entry(1, { isLocked: true })), entryStateAttributes(entry(2, { isLocked: true })));
  });
});

describe("whether a view marks an entry as armed", () => {
  it("marks the prefab the game has armed, and no other", () => {
    assert.equal(isArmedEntry(entry(7), 7), true);
    assert.equal(isArmedEntry(entry(8), 7), false);
  });

  it("marks nothing while nothing is armed, which the game states as 0", () => {
    assert.equal(isArmedEntry(entry(0), 0), false);
  });

  it("marks no entry that cannot be placed, as vanilla's tile does not", () => {
    assert.equal(isArmedEntry(entry(7, { isLocked: true }), 7), false);
    assert.equal(isArmedEntry(entry(7, { isUnique: true, isAlreadyBuilt: true }), 7), false);
  });
});
