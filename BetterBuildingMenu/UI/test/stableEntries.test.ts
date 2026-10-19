import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reuseUnchanged, sameValue } from "../src/domain/stableEntries.ts";

type Row = { id: number; name: string; facts?: { key: string; value: number }[] | null };

describe("when a new page arrives for the same rows", () => {
  it("hands back the previous object for a row that did not change", () => {
    const before: Row[] = [{ id: 1, name: "Road", facts: [{ key: "cost", value: 4 }] }];
    const first = reuseUnchanged(new Map(), before);
    const after = reuseUnchanged(first.byId, [{ id: 1, name: "Road", facts: [{ key: "cost", value: 4 }] }]);

    assert.equal(after.items[0], before[0]);
  });

  it("takes the new object for a row whose content changed", () => {
    const first = reuseUnchanged(new Map(), [{ id: 1, name: "Road" }]);
    const changed: Row = { id: 1, name: "Road (locked)" };
    const after = reuseUnchanged(first.byId, [changed]);

    assert.equal(after.items[0], changed);
  });

  it("keeps the old rows and takes the appended ones when the window grows", () => {
    const first = reuseUnchanged(new Map(), [{ id: 1, name: "A" }, { id: 2, name: "B" }]);
    const grown: Row[] = [{ id: 1, name: "A" }, { id: 2, name: "B" }, { id: 3, name: "C" }];
    const after = reuseUnchanged(first.byId, grown);

    assert.equal(after.items[0], first.items[0]);
    assert.equal(after.items[1], first.items[1]);
    assert.equal(after.items[2], grown[2]);
    assert.deepEqual([...after.byId.keys()], [1, 2, 3]);
  });

  it("forgets rows the new page no longer holds", () => {
    const first = reuseUnchanged(new Map(), [{ id: 1, name: "A" }, { id: 2, name: "B" }]);
    const after = reuseUnchanged(first.byId, [{ id: 2, name: "B" }]);

    assert.deepEqual([...after.byId.keys()], [2]);
  });
});

describe("when two values are compared", () => {
  it("compares arrays and nested objects by content", () => {
    assert.equal(sameValue([{ a: 1, b: [2, 3] }], [{ a: 1, b: [2, 3] }]), true);
    assert.equal(sameValue([{ a: 1, b: [2, 3] }], [{ a: 1, b: [2, 4] }]), false);
    assert.equal(sameValue({ a: 1 }, { a: 1, b: 2 }), false);
  });

  it("tells null, undefined and a missing key apart from a value", () => {
    assert.equal(sameValue(null, null), true);
    assert.equal(sameValue(null, 0), false);
    assert.equal(sameValue({ a: undefined }, {}), false);
  });
});
