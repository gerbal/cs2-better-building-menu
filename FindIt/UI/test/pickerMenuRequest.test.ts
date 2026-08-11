import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePickerMenuRequest, toolbarEntityArg } from "../src/domain/pickerMenuRequest.ts";

describe("The picker's open-this-menu request", () => {
  it("reads index, version and nonce", () => {
    assert.deepEqual(parsePickerMenuRequest("16934:1:7"), { index: 16934, version: 1, nonce: 7 });
  });

  it("treats the resting empty value as no request", () => {
    // Not an error. Nothing has been picked yet, which is most of the time.
    assert.equal(parsePickerMenuRequest(""), null);
    assert.equal(parsePickerMenuRequest(null), null);
    assert.equal(parsePickerMenuRequest(undefined), null);
  });

  it("refuses Entity.Null rather than selecting nothing", () => {
    // Index 0 is Entity.Null. Handing that to selectAssetMenu reads as a
    // close, so a malformed request would silently shut the menu instead of
    // opening one.
    assert.equal(parsePickerMenuRequest("0:1:3"), null);
    assert.equal(parsePickerMenuRequest("-4:1:3"), null);
  });

  it("refuses anything it cannot read, without throwing", () => {
    // This runs in a render path; a bad value should leave the toolbar alone.
    assert.equal(parsePickerMenuRequest("16934:1"), null);
    assert.equal(parsePickerMenuRequest("16934:1:2:3"), null);
    assert.equal(parsePickerMenuRequest("abc:1:2"), null);
    assert.equal(parsePickerMenuRequest("16934:x:2"), null);
  });

  it("carries the nonce so the same menu twice is two requests", () => {
    const first = parsePickerMenuRequest("16934:1:1");
    const second = parsePickerMenuRequest("16934:1:2");

    assert.equal(first!.index, second!.index);
    assert.notEqual(first!.nonce, second!.nonce);
  });

  it("hands the game an entity without the nonce", () => {
    // selectAssetMenu takes an Entity; the nonce is our own bookkeeping and
    // has no meaning on the other side.
    assert.deepEqual(toolbarEntityArg({ index: 16934, version: 2, nonce: 9 }), { index: 16934, version: 2 });
  });
});
