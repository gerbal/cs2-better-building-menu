import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  SHELF_SIZE,
  getShelf,
  recordPlacement,
  resetShelf,
  stableGridOrder,
  type GridEntry,
} from "../src/domain/buildingShelf.ts";

const entry = (id: number, name: string, cost: number | null = 0, lot = 4): GridEntry => ({
  id,
  name,
  thumbnail: "",
  constructionCost: cost,
  lotWidth: lot,
  lotDepth: lot,
});

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

describe("Stable grid order", () => {
  it("orders by size then cost then name, never by mutable state", () => {
    // The whole point: the same building sits in the same place every time.
    // Sorting by anything the player can change destroys that.
    const ordered = stableGridOrder([
      entry(1, "Big Expensive", 900, 8),
      entry(2, "Small Cheap", 100, 2),
      entry(3, "Small Dear", 500, 2),
    ]);

    assert.deepEqual(ordered.map((e) => e.name), ["Small Cheap", "Small Dear", "Big Expensive"]);
  });

  it("breaks ties by name so the order is total", () => {
    const ordered = stableGridOrder([
      entry(1, "Beta", 100, 2),
      entry(2, "Alpha", 100, 2),
    ]);

    assert.deepEqual(ordered.map((e) => e.name), ["Alpha", "Beta"]);
  });

  it("gives the same answer whatever order it receives", () => {
    const a = [entry(1, "A", 100, 2), entry(2, "B", 200, 4), entry(3, "C", 50, 6)];
    const b = [a[2], a[0], a[1]];

    assert.deepEqual(
      stableGridOrder(a).map((e) => e.id),
      stableGridOrder(b).map((e) => e.id)
    );
  });

  it("sorts entries with no cost last rather than treating them as free", () => {
    const ordered = stableGridOrder([
      entry(1, "Unknown", null, 2),
      entry(2, "Cheap", 10, 2),
    ]);

    assert.deepEqual(ordered.map((e) => e.name), ["Cheap", "Unknown"]);
  });

  it("does not mutate its input", () => {
    const source = [entry(2, "B", 200, 4), entry(1, "A", 100, 2)];
    stableGridOrder(source);

    assert.deepEqual(source.map((e) => e.id), [2, 1]);
  });
});
