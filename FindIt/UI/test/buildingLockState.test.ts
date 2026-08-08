import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canPlace, describeLockReason, isEntryLocked } from "../src/domain/buildingLockState.ts";

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

describe("lock reason", () => {
  const names = ["", "Tiny Village", "Small Village", "Large Village", "Grand Village", "Small City"];

  it("says nothing at all for an unlocked entry", () => {
    assert.equal(describeLockReason({ isLocked: false, unlockMilestone: 3 }, names, "Locked"), "");
  });

  it("names the milestone the game names", () => {
    assert.equal(describeLockReason({ isLocked: true, unlockMilestone: 5 }, names, "Locked"), "Small City");
  });

  it("prefers the milestone over a tech requirement, since it gates first", () => {
    const reason = describeLockReason(
      { isLocked: true, unlockMilestone: 1, unlockRequirements: ["Advanced Waste Management"] },
      names,
      "Locked"
    );

    assert.equal(reason, "Tiny Village");
  });

  it("falls back to the requirement when there is no milestone — the signature-building case", () => {
    const reason = describeLockReason(
      { isLocked: true, unlockMilestone: 0, unlockRequirements: ["Build 5 High Density Residential"] },
      names,
      "Locked"
    );

    assert.equal(reason, "Build 5 High Density Residential");
  });

  it("names the first requirement and counts the rest rather than truncating", () => {
    const reason = describeLockReason(
      { isLocked: true, unlockRequirements: ["Population 5,000", "Two Universities", "A Harbour"] },
      names,
      "Locked"
    );

    assert.equal(reason, "Population 5,000 +2");
  });

  it("admits it does not know rather than inventing a reason", () => {
    // Plenty of assets carry no UnlockRequirement buffer at all.
    assert.equal(describeLockReason({ isLocked: true }, names, "Locked"), "Locked");
  });

  it("does not index past the milestone table it was given", () => {
    assert.equal(describeLockReason({ isLocked: true, unlockMilestone: 99 }, names, "Locked"), "Locked");
    assert.equal(describeLockReason({ isLocked: true, unlockMilestone: 2 }, null, "Locked"), "Locked");
  });
});
