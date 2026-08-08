import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RAIL_BANK_THRESHOLD, railHomeFor, railPlacement } from "../src/domain/railPlacement.ts";

const group = (id: string, n: number) => ({
  id,
  label: id,
  options: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, label: `o${i}`, selected: false })),
});

describe("Rail placement", () => {
  it("sends short dimensions to the options bank", () => {
    assert.equal(railHomeFor(1), "bank");
    assert.equal(railHomeFor(RAIL_BANK_THRESHOLD), "bank");
  });

  it("keeps middling dimensions in the rail as a plain dropdown", () => {
    assert.equal(railHomeFor(RAIL_BANK_THRESHOLD + 1), "dropdown");
    assert.equal(railHomeFor(20), "dropdown");
  });

  it("gives long dimensions a searchable dropdown", () => {
    assert.equal(railHomeFor(21), "searchableDropdown");
    assert.equal(railHomeFor(109), "searchableDropdown");
  });

  it("treats an empty dimension as bank rather than crashing", () => {
    assert.equal(railHomeFor(0), "bank");
  });

  it("places every group in the facet state", () => {
    const placed = railPlacement({
      groups: [group("availability", 2), group("dlc", 13), group("extension", 109)],
      hasSelection: false,
    });
    assert.deepEqual(placed, [
      { id: "availability", home: "bank" },
      { id: "dlc", home: "dropdown" },
      { id: "extension", home: "searchableDropdown" },
    ]);
  });
});
