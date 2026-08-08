import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canPlace, isEntryLocked } from "../src/domain/buildingLockState.ts";

describe("lock state", () => {
  it("reports a locked entry as locked", () => {
    assert.equal(isEntryLocked({ isLocked: true }), true);
    assert.equal(canPlace({ isLocked: true }), false);
  });

  it("reports an unlocked entry as placeable", () => {
    assert.equal(isEntryLocked({ isLocked: false }), false);
    assert.equal(canPlace({ isLocked: false }), true);
  });

  it("treats an absent flag as placeable, because absent is not locked", () => {
    // Zones reach the catalog through zoneAsCatalogEntry, which builds an entry
    // with no isLocked at all. Defaulting to locked would make every zone
    // unbuildable, which is a far worse failure than missing a lock badge.
    assert.equal(isEntryLocked({}), false);
    assert.equal(canPlace({}), true);
  });

  it("survives a null or undefined entry rather than throwing in a render path", () => {
    assert.equal(isEntryLocked(null), false);
    assert.equal(isEntryLocked(undefined), false);
    assert.equal(canPlace(null), true);
  });

  it("does not treat a truthy non-boolean as locked", () => {
    // The value arrives across a C#/JS binding. Only a real true means locked;
    // anything else is a contract violation we should not act on.
    assert.equal(isEntryLocked({ isLocked: "true" } as unknown as { isLocked?: boolean }), false);
    assert.equal(isEntryLocked({ isLocked: 1 } as unknown as { isLocked?: boolean }), false);
  });
});
