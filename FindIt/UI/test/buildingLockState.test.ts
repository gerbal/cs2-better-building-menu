import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canPlace, isEntryLocked, listLockConditions } from "../src/domain/buildingLockState.ts";

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

describe("lock conditions", () => {
  const names = ["", "Tiny Village", "Small Village", "Large Village", "Grand Village", "Small City"];

  it("says nothing at all for an unlocked entry", () => {
    assert.deepEqual(listLockConditions({ isLocked: false, unlockMilestone: 3 }, names, "Locked"), []);
  });

  it("names the milestone the game names", () => {
    assert.deepEqual(listLockConditions({ isLocked: true, unlockMilestone: 5 }, names, "Locked"), ["Small City"]);
  });

  it("lists the milestone AND the other conditions, milestone first", () => {
    // Knowing one of three gates is not knowing what to do. Milestone leads
    // because it is the coarsest and clears first.
    const reason = listLockConditions(
      { isLocked: true, unlockMilestone: 1, unlockRequirements: ["Advanced Waste Management"] },
      names,
      "Locked"
    );

    assert.deepEqual(reason, ["Tiny Village", "Advanced Waste Management"]);
  });

  it("falls back to the requirement when there is no milestone — the signature-building case", () => {
    const reason = listLockConditions(
      { isLocked: true, unlockMilestone: 0, unlockRequirements: ["Build 5 High Density Residential"] },
      names,
      "Locked"
    );

    assert.deepEqual(reason, ["Build 5 High Density Residential"]);
  });

  it("lists every condition rather than hiding them behind a count", () => {
    const reason = listLockConditions(
      { isLocked: true, unlockRequirements: ["Population 5,000", "Two Universities", "A Harbour"] },
      names,
      "Locked"
    );

    assert.deepEqual(reason, ["Population 5,000", "Two Universities", "A Harbour"]);
  });

  it("does not print the same condition twice when two branches reach it", () => {
    const reason = listLockConditions(
      { isLocked: true, unlockRequirements: ["Population 5,000", "Population 5,000"] },
      names,
      "Locked"
    );

    assert.deepEqual(reason, ["Population 5,000"]);
  });

  it("admits it does not know rather than inventing a reason", () => {
    // Plenty of assets carry no UnlockRequirement buffer at all.
    assert.deepEqual(listLockConditions({ isLocked: true }, names, "Locked"), ["Locked"]);
  });

  it("does not index past the milestone table it was given", () => {
    assert.deepEqual(listLockConditions({ isLocked: true, unlockMilestone: 99 }, names, "Locked"), ["Locked"]);
    assert.deepEqual(listLockConditions({ isLocked: true, unlockMilestone: 2 }, null, "Locked"), ["Locked"]);
  });
});
