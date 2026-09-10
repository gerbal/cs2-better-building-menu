import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFilterChips, removableChipCount } from "../src/domain/filterChips.ts";

const emptyRanges = {
  minCost: null, maxCost: null,
  minUpkeep: null, maxUpkeep: null,
  minWorkers: null, maxWorkers: null,
  minCapacity: null, maxCapacity: null,
  minLotWidth: null, maxLotWidth: null,
  minLotDepth: null, maxLotDepth: null,
  hasSelection: false,
};

const facets = (...selected: string[]) => ({
  hasSelection: selected.length > 0,
  groups: [
    {
      id: "zone",
      label: "Zone",
      // Three options, not two. The tests below select two to mean "several
      // within one dimension"; with only two present that is also "every one
      // of them", which buildFilterChips suppresses as narrowing nothing.
      options: [
        { id: "office", label: "Office", selected: selected.includes("office") },
        { id: "high", label: "High density", selected: selected.includes("high") },
        { id: "low", label: "Low density", selected: selected.includes("low") },
      ],
    },
    {
      id: "theme",
      label: "Theme",
      options: [{ id: "eu", label: "European", selected: selected.includes("eu") }],
    },
  ],
});

describe("Filter chips", () => {
  it("puts facets first, then metric ranges", () => {
    // The row reads as a history of how the player got here, in the order
    // the rail offers the controls.
    const chips = buildFilterChips({
      facets: facets("office"),
      metricRanges: { ...emptyRanges, maxCost: 50000, hasSelection: true },
    });

    assert.deepEqual(chips.map((chip) => chip.dimension), [
      "zone",
      "metric:cost",
    ]);
  });

  it("composes several selections within one dimension", () => {
    // The whole point of leaving tab strips behind: Office AND high density.
    const chips = buildFilterChips({ facets: facets("office", "high") });

    assert.deepEqual(chips.map((chip) => chip.label), ["Office", "High density"]);
  });

  it("contributes nothing for a group the backend says is not narrowing", () => {
    // Availability at rest: exhaustive, so both options read selected and
    // nothing is excluded. Chipped, it would announce a filter over an
    // unfiltered menu.
    const exhaustive = {
      hasSelection: true,
      groups: [
        {
          id: "availability",
          label: "Availability",
          narrowing: false,
          options: [
            { id: "Locked", label: "Locked", selected: true },
            { id: "Unlocked", label: "Unlocked", selected: true },
          ],
        },
      ],
    };

    assert.deepEqual(buildFilterChips({ facets: exhaustive }), []);
  });

  it("still chips an all-selected group that IS narrowing", () => {
    // A selection stranded by a menu switch: "Require road" carried into
    // Landscaping, where nothing has BuildingFlags, is the group's ONLY
    // option — all selected, and excluding everything. Its chip has to stay.
    const stranded = {
      hasSelection: true,
      groups: [
        {
          id: "placement",
          label: "Placement",
          narrowing: true,
          options: [{ id: "RequireRoad", label: "Require road", selected: true }],
        },
      ],
    };

    assert.deepEqual(buildFilterChips({ facets: stranded }).map((chip) => chip.label), ["Require road"]);
  });

  it("still chips a group where only some options are selected", () => {
    const partial = {
      hasSelection: true,
      groups: [
        {
          id: "availability",
          label: "Availability",
          narrowing: true,
          options: [
            { id: "Locked", label: "Locked", selected: true },
            { id: "Unlocked", label: "Unlocked", selected: false },
          ],
        },
      ],
    };

    assert.deepEqual(buildFilterChips({ facets: partial }).map((chip) => chip.label), ["Locked"]);
  });

  it("contributes nothing for a facet group with no selections", () => {
    assert.deepEqual(buildFilterChips({ facets: facets() }), []);
  });

  it("contributes nothing for a metric range still at its default", () => {
    // Both bounds unset is the default, not a filter. Trusting the state's own
    // hasSelection flag here makes the rail badge count a filter nobody set.
    assert.deepEqual(buildFilterChips({ metricRanges: { ...emptyRanges, hasSelection: true } }), []);
  });

  it("names a removal command that round-trips the selection", () => {
    const chips = buildFilterChips({
      facets: facets("office"),
      metricRanges: { ...emptyRanges, minCapacity: 400, hasSelection: true },
    });

    // Toggling is symmetric, so removal needs no separate C# path.
    assert.deepEqual(chips[0].remove, { method: "ToggleBuildingLensFacet", args: ["zone", "office"] });
    assert.deepEqual(chips[1].remove, { method: "SetBuildingCatalogMetricRange", args: ["capacity", "", ""] });
  });

  it("reads both bounds, one bound, or neither", () => {
    const labelFor = (ranges: object) =>
      buildFilterChips({ metricRanges: { ...emptyRanges, ...ranges, hasSelection: true } })[0]?.label;

    assert.equal(labelFor({ minCost: 1000, maxCost: 5000 }), "Cost 1,000–5,000");
    assert.equal(labelFor({ minCost: 1000 }), "Cost ≥ 1,000");
    assert.equal(labelFor({ maxCost: 5000 }), "Cost ≤ 5,000");
    assert.equal(labelFor({}), undefined);
  });

  it("gives every chip an id unique across dimensions", () => {
    // A collision would make React reuse the wrong node when a chip is removed.
    const chips = buildFilterChips({
      facets: facets("office", "high", "eu"),
      metricRanges: { ...emptyRanges, maxCost: 1, maxUpkeep: 2, hasSelection: true },
    });

    assert.equal(new Set(chips.map((chip) => chip.id)).size, chips.length);
  });

  it("survives absent, null and malformed state", () => {
    // These bindings can be read during a view recreation, before the first
    // C# refresh tick.
    assert.deepEqual(buildFilterChips(null), []);
    assert.deepEqual(buildFilterChips(undefined), []);
    assert.deepEqual(buildFilterChips({}), []);
    assert.deepEqual(buildFilterChips({ facets: { groups: [], hasSelection: false } }), []);
    assert.deepEqual(
      buildFilterChips({ facets: { groups: [{ id: "z", label: "Z", options: null as any }], hasSelection: false } }),
      []
    );
  });

  it("counts only what the Clear button can actually reset", () => {
    const chips = buildFilterChips({
      facets: facets("office", "high"),
    });

    assert.equal(chips.length, 2);
    assert.equal(removableChipCount(chips), 2);
  });
});
