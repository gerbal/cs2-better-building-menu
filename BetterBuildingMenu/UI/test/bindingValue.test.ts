import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deliveredValue, sameDeliveredValue } from "../src/domain/bindingValue.ts";

// The kept menu reads its bindings through its own useValue, which must deliver and
// skip updates exactly as cs2/api's does, or a shown menu re-renders when the game's
// would not. The rule, read from the game's useValue in game.

describe("what a binding update delivers", () => {
  it("cuts a number to six decimals", () => {
    assert.equal(deliveredValue(0.12345678), 0.123456);
    assert.equal(deliveredValue(2), 2);
  });

  it("delivers zero and everything else as it is", () => {
    const page = { items: [] };

    assert.equal(deliveredValue(0), 0);
    assert.equal(deliveredValue(page), page);
    assert.equal(deliveredValue("Roads"), "Roads");
  });
});

describe("which updates change nothing", () => {
  it("skips an object equal all the way down", () => {
    assert.equal(sameDeliveredValue({ menu: "Roads", items: [{ id: 1 }] }, { menu: "Roads", items: [{ id: 1 }] }), true);
  });

  it("delivers an object that differs anywhere", () => {
    assert.equal(sameDeliveredValue({ menu: "Roads", items: [{ id: 1 }] }, { menu: "Roads", items: [{ id: 2 }] }), false);
    assert.equal(sameDeliveredValue({ a: 1 }, { a: 1, b: 2 }), false);
  });

  it("skips one empty array after another", () => {
    assert.equal(sameDeliveredValue([], []), true);
  });

  it("compares numbers after cutting them", () => {
    assert.equal(sameDeliveredValue(0.123456, 0.1234567), true);
    assert.equal(sameDeliveredValue(0.123456, 0.123457), false);
  });

  it("compares everything else by identity", () => {
    assert.equal(sameDeliveredValue("Roads", "Roads"), true);
    assert.equal(sameDeliveredValue("Roads", "Zones"), false);
    assert.equal(sameDeliveredValue(null, { a: 1 }), false);
  });

  it("stops comparing ten levels down", () => {
    const deep = (leaf: object): object => {
      let node: object = leaf;
      for (let i = 0; i < 11; i++) node = { child: node };
      return node;
    };

    assert.equal(sameDeliveredValue(deep({ x: 1 }), deep({ x: 1 })), false);
  });
});
