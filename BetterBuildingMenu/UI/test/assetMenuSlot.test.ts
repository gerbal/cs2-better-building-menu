import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAssetMenuSlotStore } from "../src/domain/assetMenuSlot.ts";

describe("the asset-menu slot the kept menu moves into", () => {
  it("is the slot opened last, until that slot closes", () => {
    const slots = createAssetMenuSlotStore<string>();
    const seen: (string | null)[] = [];
    slots.subscribe((slot) => seen.push(slot?.element ?? null));

    const close = slots.open({ element: "slot" });
    assert.equal(slots.current()?.element, "slot");

    close();
    assert.equal(slots.current(), null);
    assert.deepEqual(seen, ["slot", null]);
  });

  it("keeps a newer slot when an older one closes after it opened", () => {
    const slots = createAssetMenuSlotStore<string>();
    const closeOld = slots.open({ element: "old" });
    slots.open({ element: "new" });

    closeOld();

    assert.equal(slots.current()?.element, "new");
  });

  it("stops telling a listener once it unsubscribes", () => {
    const slots = createAssetMenuSlotStore<string>();
    let calls = 0;
    const unsubscribe = slots.subscribe(() => calls++);

    unsubscribe();
    slots.open({ element: "slot" });

    assert.equal(calls, 0);
  });

  it("reports a failure once, to every listener, and keeps the slot", () => {
    const slots = createAssetMenuSlotStore<string>();
    slots.open({ element: "slot" });
    let calls = 0;
    slots.subscribe(() => calls++);

    slots.fail();
    slots.fail();

    assert.equal(slots.failed(), true);
    assert.equal(calls, 1);
    assert.equal(slots.current()?.element, "slot");
  });
});
