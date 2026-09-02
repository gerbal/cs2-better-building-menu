import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  SHELF_SIZE,
  getShelf,
  recordPlacement,
  resetShelf,
} from "../src/domain/buildingShelf.ts";

describe("Building shelf", () => {
  beforeEach(() => resetShelf());

  it("starts empty and fills as you place", () => {
    assert.deepEqual(getShelf(), []);

    recordPlacement(7);

    assert.deepEqual(getShelf(), [7]);
  });

  it("ranks by how often you place, not how recently", () => {
    // Recency thrashes: the shelf must hold still so the same building stays
    // under the same pixel. Frequency is what makes a position durable.
    recordPlacement(1);
    recordPlacement(2);
    recordPlacement(2);
    recordPlacement(3);
    recordPlacement(2);
    recordPlacement(3);

    assert.deepEqual(getShelf(), [2, 3, 1]);
  });

  it("keeps a stable order between equally-placed buildings", () => {
    // A tie must not reshuffle on every placement, or positions stop being
    // memorable exactly when the shelf is most used.
    recordPlacement(5);
    recordPlacement(9);
    const first = getShelf();

    recordPlacement(5);
    recordPlacement(9);

    assert.deepEqual(getShelf(), first);
  });

  it("holds a bounded number so positions stay learnable", () => {
    for (let id = 1; id <= SHELF_SIZE + 6; id++) {
      for (let n = 0; n <= SHELF_SIZE + 6 - id; n++) recordPlacement(id);
    }

    assert.equal(getShelf().length, SHELF_SIZE);
    assert.equal(getShelf()[0], 1);
  });
});
