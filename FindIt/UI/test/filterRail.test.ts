import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RAIL_SEARCH_THRESHOLD,
  buildFilterRail,
  filterRailOptions,
  hasAnyRailSelection,
} from "../src/domain/filterRail.ts";

const group = (id: string, label: string, n: number, selected = 0) => ({
  id,
  label,
  options: Array.from({ length: n }, (_, i) => ({
    id: `${id}-${i}`,
    label: `${label} ${i}`,
    selected: i < selected,
  })),
});

const facets = {
  groups: [
    group("buildingType", "Role", 10, 1),
    group("dlc", "DLC", 13),
    group("extension", "Extensions", 109),
    group("zone", "Density", 5),
  ],
  hasSelection: true,
};

describe("Filter rail", () => {
  it("gives every facet group one entry", () => {
    const rail = buildFilterRail(facets, { active: 0 });

    assert.deepEqual(rail.map((d) => d.id), ["buildingType", "dlc", "extension", "zone", "metrics"]);
  });

  it("always ends with metrics so its position never moves", () => {
    // Facet groups come and go with DLC and mods; the metrics entry must not
    // slide around underneath the cursor when they do.
    const rail = buildFilterRail({ groups: [group("dlc", "DLC", 2)], hasSelection: false }, { active: 0 });

    assert.equal(rail[rail.length - 1].id, "metrics");
  });

  it("counts active selections per dimension for the badge", () => {
    const rail = buildFilterRail(facets, { active: 3 });

    assert.equal(rail.find((d) => d.id === "buildingType")!.selected, 1);
    assert.equal(rail.find((d) => d.id === "dlc")!.selected, 0);
    assert.equal(rail.find((d) => d.id === "metrics")!.selected, 3);
  });

  it("marks a dimension too large to scan as needing its own search", () => {
    // Extensions holds 109 options. A popover listing 109 items is the drawer
    // again in a smaller box, so that one gets a search field inside it.
    const rail = buildFilterRail(facets, { active: 0 });

    assert.equal(rail.find((d) => d.id === "extension")!.needsSearch, true);
    assert.equal(rail.find((d) => d.id === "dlc")!.needsSearch, false);
    assert.ok(RAIL_SEARCH_THRESHOLD < 109);
  });

  it("omits a facet group with no options rather than showing a dead icon", () => {
    // Role and Asset packs were both empty for the whole catalog until
    // recently; an icon that opens an empty popover is worse than no icon.
    const rail = buildFilterRail({ groups: [group("dlc", "DLC", 0)], hasSelection: false }, { active: 0 });

    assert.deepEqual(rail.map((d) => d.id), ["metrics"]);
  });

  it("survives absent facet state", () => {
    assert.deepEqual(buildFilterRail(undefined, { active: 0 }).map((d) => d.id), ["metrics"]);
    assert.deepEqual(buildFilterRail(null, undefined).map((d) => d.id), ["metrics"]);
  });
});

describe("Rail popover options", () => {
  it("returns a group's options unfiltered without a query", () => {
    assert.equal(filterRailOptions(facets, "dlc", "").length, 13);
  });

  it("narrows a large group by its own search", () => {
    const found = filterRailOptions(facets, "extension", "Extensions 10");

    assert.ok(found.length > 0 && found.length < 109);
    assert.ok(found.every((o) => /Extensions 10/.test(o.label)));
  });

  it("matches case-insensitively", () => {
    assert.ok(filterRailOptions(facets, "dlc", "dlc 1").length > 0);
  });

  it("returns nothing for an unknown group", () => {
    assert.deepEqual(filterRailOptions(facets, "nope", ""), []);
  });
});

describe("Rail selection state", () => {
  it("reports whether anything is filtered at all", () => {
    assert.equal(hasAnyRailSelection(buildFilterRail(facets, { active: 0 })), true);
    assert.equal(
      hasAnyRailSelection(buildFilterRail({ groups: [group("dlc", "DLC", 3)], hasSelection: false }, { active: 0 })),
      false
    );
  });

  it("counts an active metric range as a filter", () => {
    const rail = buildFilterRail({ groups: [group("dlc", "DLC", 3)], hasSelection: false }, { active: 2 });

    assert.equal(hasAnyRailSelection(rail), true);
  });
});

describe("Active metric range count", () => {
  it("counts only bounds that are actually set", async () => {
    const { countActiveMetricRanges } = await import("../src/domain/filterRail.ts");

    assert.equal(
      countActiveMetricRanges({ minCost: 1000, maxCost: null, minUpkeep: null, hasSelection: true }),
      1
    );
  });

  it("ignores the hasSelection flag that travels with the bounds", async () => {
    const { countActiveMetricRanges } = await import("../src/domain/filterRail.ts");

    // Counting object values naively made `hasSelection: false` register as a
    // set bound, so the metrics badge read 2 with nothing filtered.
    assert.equal(countActiveMetricRanges({ hasSelection: false }), 0);
    assert.equal(countActiveMetricRanges({ hasSelection: true }), 0);
  });

  it("treats zero as a real bound rather than an empty one", async () => {
    const { countActiveMetricRanges } = await import("../src/domain/filterRail.ts");

    // "at most 0 workers" is a legitimate filter.
    assert.equal(countActiveMetricRanges({ maxWorkers: 0, hasSelection: true }), 1);
  });

  it("counts both ends of a range separately", async () => {
    const { countActiveMetricRanges } = await import("../src/domain/filterRail.ts");

    assert.equal(countActiveMetricRanges({ minCost: 10, maxCost: 20, hasSelection: true }), 2);
  });

  it("survives absent state", async () => {
    const { countActiveMetricRanges } = await import("../src/domain/filterRail.ts");

    assert.equal(countActiveMetricRanges(null), 0);
    assert.equal(countActiveMetricRanges(undefined), 0);
  });
});
