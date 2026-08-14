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
      // Three options, not two. The tests below select two of them to mean
      // "several within one dimension"; with only two present that was also
      // "every one of them", which buildFilterChips now suppresses because a
      // group with everything selected narrows nothing.
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
  it("puts navigation first, then facets, then metric ranges", () => {
    // The row reads as a history of how the player got here: what the
    // navigation set, then what they added.
    const chips = buildFilterChips({
      section: { id: "Zones", label: "Zones" },
      subCategory: { id: "Residential", label: "Residential" },
      facets: facets("office"),
      metricRanges: { ...emptyRanges, maxCost: 50000, hasSelection: true },
    });

    assert.deepEqual(chips.map((chip) => chip.dimension), [
      "section",
      "subCategory",
      "zone",
      "metric:cost",
    ]);
  });

  it("wears zoning families as chips, between navigation and the facets", () => {
    // Zones are a separate catalog, but a family narrows the visible set just
    // as a facet does, so it gets the same chip and the same removal gesture.
    const chips = buildFilterChips({
      section: { id: "Zones", label: "Zones" },
      zoneFamilies: [
        { id: "ZoneResidential", label: "Residential" },
        { id: "ZoneOffice", label: "Office" },
      ],
      facets: facets("high"),
    });

    assert.deepEqual(chips.map((chip) => chip.dimension), [
      "section",
      "zoneFamily",
      "zoneFamily",
      "zone",
    ]);
    assert.deepEqual(chips[1].remove, {
      method: "ToggleBuildingLensZoneFamily",
      args: ["ZoneResidential"],
    });
  });

  it("contributes no family chips when every family is showing", () => {
    // Empty means all of them, not none — an untouched filter hides nothing.
    assert.deepEqual(buildFilterChips({ zoneFamilies: [] }), []);
    assert.deepEqual(buildFilterChips({ zoneFamilies: null }), []);
  });

  it("makes the section a breadcrumb rather than a filter", () => {
    // There is always an active section, so offering to remove it would be a
    // control that cannot do what it says.
    const [chip] = buildFilterChips({ section: { id: "Zones", label: "Zones" } });

    assert.equal(chip.removable, false);
    assert.equal(chip.remove, null);
  });

  it("composes several selections within one dimension", () => {
    // The whole point of leaving tab strips behind: Office AND high density
    // was previously unaskable.
    const chips = buildFilterChips({ facets: facets("office", "high") });

    assert.deepEqual(chips.map((chip) => chip.label), ["Office", "High density"]);
  });

  it("contributes nothing for a group the backend says is not narrowing", () => {
    // Availability at rest: exhaustive, so both options read selected and
    // nothing is excluded. Chipped, that announced "2 Active — Locked ×
    // Unlocked ×" over an unfiltered menu.
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
    // The case the all-selected heuristic got wrong: a selection stranded by a
    // menu switch. "Require road" carried into Landscaping, where nothing has
    // BuildingFlags, leaves the stranded value as the group's ONLY option — all
    // selected, and excluding everything. Suppressing its chip left a filter
    // with no control attached and no way to clear it.
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
    // hasSelection flag here is what made the rail badge read 2 with nothing
    // narrowed.
    assert.deepEqual(buildFilterChips({ metricRanges: { ...emptyRanges, hasSelection: true } }), []);
  });

  it("omits the subcategory chip when no subcategory is chosen", () => {
    assert.deepEqual(buildFilterChips({ subCategory: { id: "Any", label: "Any" } }), []);
    assert.deepEqual(buildFilterChips({ subCategory: { id: "", label: "" } }), []);
  });

  it("names a removal command that round-trips the selection", () => {
    const chips = buildFilterChips({
      subCategory: { id: "Residential", label: "Residential" },
      facets: facets("office"),
      metricRanges: { ...emptyRanges, minCapacity: 400, hasSelection: true },
    });

    assert.deepEqual(chips[0].remove, { method: "SetBuildingLensSubCategory", args: ["Any"] });
    // Toggling is symmetric, so removal needs no separate C# path.
    assert.deepEqual(chips[1].remove, { method: "ToggleBuildingLensFacet", args: ["zone", "office"] });
    assert.deepEqual(chips[2].remove, { method: "SetBuildingCatalogMetricRange", args: ["capacity", "", ""] });
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
      section: { id: "Zones", label: "Zones" },
      subCategory: { id: "Zones", label: "Zones" },
      facets: facets("office", "high", "eu"),
      metricRanges: { ...emptyRanges, maxCost: 1, maxUpkeep: 2, hasSelection: true },
    });

    assert.equal(new Set(chips.map((chip) => chip.id)).size, chips.length);
  });

  it("falls back to the id when a label is missing", () => {
    const chips = buildFilterChips({ section: { id: "Zones", label: "" } });

    assert.equal(chips[0].label, "Zones");
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
      section: { id: "Zones", label: "Zones" },
      facets: facets("office", "high"),
    });

    assert.equal(chips.length, 3);
    assert.equal(removableChipCount(chips), 2);
  });
});
