import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_GROUP_DIMENSION,
  GROUP_DIMENSIONS,
  PROGRESSION_UNGATED_LABEL,
  SCHOOL_TIERS,
  UNGROUPED_LABEL,
  fitGroupLabel,
  fitLabelToWidth,
  flattenGroupedRows,
  groupDimensionLabel,
  groupDimensionsFor,
  groupTreeFromPaths,
  isEducationMenu,
  isGroupDimension,
  milestoneLabel,
  shouldShowHeading,
} from "../src/domain/buildingGroups.ts";

/** A page item as C# sends it: its headings already decided. */
const item = (id: number, groupPath: string[], over: Record<string, unknown> = {}) => ({
  id,
  name: `N${id}`,
  groupPath,
  groupLabelId: "",
  ...over,
});

describe("Group dimensions", () => {
  it("recognises every offered id and nothing else", () => {
    for (const dimension of GROUP_DIMENSIONS) {
      assert.ok(isGroupDimension(dimension.id), dimension.id);
    }
    assert.equal(isGroupDimension("assetPack"), false);
    assert.equal(isGroupDimension(""), false);
    assert.equal(isGroupDimension(null), false);
    assert.ok(isGroupDimension(DEFAULT_GROUP_DIMENSION));
  });

  it("puts None last, because it is how grouping is turned off", () => {
    assert.equal(GROUP_DIMENSIONS[GROUP_DIMENSIONS.length - 1].id, "none");
    assert.equal(groupDimensionLabel("none"), "None");
    assert.equal(groupDimensionLabel("menuCategory"), "Category");
  });

  it("names the education menu loosely, like C#", () => {
    assert.equal(isEducationMenu("Education & Research"), true);
    assert.equal(isEducationMenu("education"), true);
    assert.equal(isEducationMenu("Roads"), false);
    assert.equal(isEducationMenu(null), false);
  });

  it("names each school tier the way the game names it", () => {
    assert.deepEqual(
      SCHOOL_TIERS.map((tier) => [tier.level, tier.label]),
      [[1, "Elementary School"], [2, "High School"], [3, "College"], [4, "University"]]
    );
  });
});

describe("Grouped tree from the page's paths", () => {
  const rows = [
    item(1, ["Service Buildings", "Health & Deathcare"]),
    item(2, ["Service Buildings", "Health & Deathcare"]),
    item(3, ["Service Buildings", "Education & Research"]),
  ];

  it("nests the outer level over the inner and counts through the tree", () => {
    const groups = groupTreeFromPaths(rows);

    assert.equal(groups.length, 1);
    assert.equal(groups[0].label, "Service Buildings");
    assert.equal(groups[0].count, 3);
    assert.deepEqual(groups[0].children.map((c) => [c.label, c.count]), [
      ["Health & Deathcare", 2],
      ["Education & Research", 1],
    ]);
    assert.equal(groups[0].children[0].entries.length, 2);
  });

  it("reports the full path on a nested node", () => {
    const groups = groupTreeFromPaths(rows);

    assert.deepEqual(groups[0].path, ["Service Buildings"]);
    assert.deepEqual(groups[0].children[0].path, ["Service Buildings", "Health & Deathcare"]);
  });

  it("preserves incoming order rather than sorting", () => {
    // The page arrives already ordered by (group key, chosen sort) from C#,
    // "Other" last and milestones in milestone order included. Re-sorting here
    // would disagree with the paging, which is the exact failure this design
    // exists to prevent.
    const groups = groupTreeFromPaths([
      item(1, ["Small Village"]),
      item(2, ["Grand Village"]),
      item(3, [UNGROUPED_LABEL]),
      item(4, ["Big Town"]),
    ]);

    assert.deepEqual(groups.map((g) => g.label), ["Small Village", "Grand Village", UNGROUPED_LABEL, "Big Town"]);
  });

  it("only joins consecutive entries into one node", () => {
    // A heading the order has split is drawn twice rather than merged: merging
    // would draw a tree the rows underneath it do not follow.
    const groups = groupTreeFromPaths([item(1, ["A"]), item(2, ["B"]), item(3, ["A"])]);

    assert.deepEqual(groups.map((g) => [g.label, g.count]), [["A", 1], ["B", 1], ["A", 1]]);
  });

  it("keeps group counts summing to the result total", () => {
    const groups = groupTreeFromPaths(rows);
    const total = groups.reduce((sum, group) => sum + group.count, 0);

    assert.equal(total, rows.length);
  });

  it("carries the game's category id on the outer level only", () => {
    // menuCategory is depth 2 — the category, then the density tier beneath
    // it — and the game owns the id of the OUTER level alone. When the tier
    // node took it too, the renderer resolved every one of Residential's six
    // tier headings to "Residential Zones".
    const groups = groupTreeFromPaths([
      item(1, ["Residential", "Low Density"], { groupLabelId: "ZonesResidential" }),
      item(2, ["Residential", "High Density"], { groupLabelId: "ZonesResidential" }),
    ]);

    assert.equal(groups[0].labelId, "ZonesResidential");
    assert.equal(groups[0].children[0].labelId, undefined);
    assert.equal(groups[0].children[1].labelId, undefined);
  });

  it("carries no id when C# sent none", () => {
    assert.equal(groupTreeFromPaths([item(1, ["Hospital"])])[0].labelId, undefined);
    assert.equal(groupTreeFromPaths([item(1, ["Hospital"], { groupLabelId: "  " })])[0].labelId, undefined);
    assert.equal(groupTreeFromPaths([item(1, ["Hospital"], { groupLabelId: null })])[0].labelId, undefined);
  });

  it("yields nothing for an ungrouped page", () => {
    // "None", or a page C# never stamped: the views draw the flat list.
    assert.deepEqual(groupTreeFromPaths([item(1, []), item(2, [])]), []);
    assert.deepEqual(groupTreeFromPaths([{ id: 1 }, { id: 2 }]), []);
  });

  it("survives absent and empty input", () => {
    assert.deepEqual(groupTreeFromPaths(null), []);
    assert.deepEqual(groupTreeFromPaths(undefined), []);
    assert.deepEqual(groupTreeFromPaths([]), []);
  });

  it("suppresses a heading that covers everything", () => {
    // A lone SERVICE BUILDINGS heading, once you have navigated there, is a
    // label with nothing to distinguish.
    assert.equal(shouldShowHeading(groupTreeFromPaths(rows)), false);
    assert.equal(shouldShowHeading(groupTreeFromPaths(rows)[0].children), true);
  });
});

describe("Flattening groups for the table", () => {
  const key = (e: { id: number }) => String(e.id);
  const line = (r: ReturnType<typeof flattenGroupedRows<{ id: number; name: string }>>[number]) =>
    r.kind === "heading" ? `${"  ".repeat(r.depth)}# ${r.label}` : r.entry.name;

  it("puts a heading before each group's rows, at every level", () => {
    // Each root has exactly one child — a lone "Other" — and the per-level
    // rule drops those inner headings while keeping the roots, which is the
    // point of deciding it per level rather than once.
    const rows = flattenGroupedRows(
      [
        item(1, ["Networks", UNGROUPED_LABEL], { name: "Alley" }),
        item(3, ["Networks", UNGROUPED_LABEL], { name: "Road" }),
        item(2, ["Buildings", UNGROUPED_LABEL], { name: "School" }),
      ],
      key,
    );

    assert.deepEqual(rows.map(line), ["# Networks", "Alley", "Road", "# Buildings", "School"]);
  });

  it("still labels the level below a lone parent", () => {
    // The case reported from play: grouping the Roads menu by asset type puts
    // every entry under one root, because they are all Networks. Judging the
    // whole tree by that root suppressed the headings underneath it as well,
    // so the table reordered into Roads, Bridges and Tracks and named none of
    // them.
    const rows = flattenGroupedRows(
      [
        item(1, ["Networks", "Roads"], { name: "Alley" }),
        item(3, ["Networks", "Roads"], { name: "Road" }),
        item(2, ["Networks", "Bridges"], { name: "Quay" }),
      ],
      key,
    );

    assert.deepEqual(rows.map(line), ["  # Roads", "Alley", "Road", "  # Bridges", "Quay"]);
  });

  it("emits a flat list when nothing is grouped", () => {
    const rows = flattenGroupedRows([item(1, [], { name: "Alley" }), item(2, [], { name: "Road" })], key);

    assert.deepEqual(rows.map((r) => r.kind), ["row", "row"]);
  });

  it("draws no heading when one group covers everything", () => {
    // A lone heading names nothing the reader did not already know — the same
    // rule GroupedResults applies.
    const rows = flattenGroupedRows([item(1, ["Networks"]), item(2, ["Networks"])], key);

    assert.deepEqual(rows.map((r) => r.kind), ["row", "row"]);
  });

  it("carries the heading's id and count", () => {
    const rows = flattenGroupedRows(
      [
        item(1, ["Road"], { groupLabelId: "TransportationRoad" }),
        item(2, ["Road"], { groupLabelId: "TransportationRoad" }),
        item(3, ["Train"], { groupLabelId: "TransportationTrain" }),
      ],
      key,
    );
    const heading = rows.find((r) => r.kind === "heading" && r.label === "Road");

    assert.ok(heading && heading.kind === "heading");
    assert.equal(heading.count, 2);
    assert.equal(heading.labelId, "TransportationRoad");
  });

  it("keeps the order the backend already sorted", () => {
    const rows = flattenGroupedRows(
      [
        item(1, ["Networks"], { name: "Zebra" }),
        item(2, ["Networks"], { name: "Alpha" }),
        item(3, ["Buildings"], { name: "School" }),
      ],
      key,
    );

    assert.deepEqual(
      rows.filter((r) => r.kind === "row").map((r) => (r.kind === "row" ? r.entry.name : "")),
      ["Zebra", "Alpha", "School"],
    );
  });

  it("gives every line a stable key", () => {
    const rows = flattenGroupedRows([item(1, ["Networks"]), item(2, ["Buildings"])], key);
    const keys = rows.map((r) => r.key);

    assert.equal(new Set(keys).size, keys.length);
  });

  it("has nothing to say about an empty result", () => {
    assert.deepEqual(flattenGroupedRows([], key), []);
    assert.deepEqual(flattenGroupedRows(null, key), []);
  });
});

describe("Which grouping choices a menu offers", () => {
  const ids = (offered: string[] | null) => groupDimensionsFor(offered).map((d) => d.id);

  it("shows the dimensions C# offered, in picker order", () => {
    // C# publishes the ids in its own order; the picker keeps its own.
    assert.deepEqual(ids(["none", "development", "menuCategory"]), ["menuCategory", "development", "none"]);
  });

  it("ignores an id it has no picker entry for", () => {
    assert.deepEqual(ids(["assetPack", "category"]), ["category"]);
  });

  it("offers everything before C# has said anything", () => {
    // Judging an empty list would shorten the picker and leave it short.
    assert.deepEqual(ids([]), GROUP_DIMENSIONS.map((d) => d.id));
    assert.deepEqual(ids(null), GROUP_DIMENSIONS.map((d) => d.id));
  });

  it("keeps the label the picker shows", () => {
    assert.deepEqual(
      groupDimensionsFor(["schoolTier"]).map((d) => [d.id, d.label, d.depth]),
      [["schoolTier", "School tier", 1]]
    );
  });
});

describe("Milestone names for the strip", () => {
  it("names a milestone out of the published table and falls back to its index", () => {
    const names = ["Tiny Village", "Small Village", "Grand Village"];

    assert.equal(milestoneLabel(0, names), "Tiny Village");
    assert.equal(milestoneLabel(2, names), "Grand Village");
    assert.equal(milestoneLabel(7, names), "Milestone 7");
    assert.equal(milestoneLabel(1, ["Tiny Village", "", "Grand Village"]), "Milestone 1");
    assert.equal(milestoneLabel(3, []), "Milestone 3");
    assert.equal(milestoneLabel(3, null), "Milestone 3");
  });

  it("calls slot zero the ungated tier, never Milestone 0", () => {
    assert.equal(milestoneLabel(0, ["", "Small Village"]), PROGRESSION_UNGATED_LABEL);
    assert.equal(milestoneLabel(0, []), PROGRESSION_UNGATED_LABEL);
  });

  it("files a missing index under Other", () => {
    assert.equal(milestoneLabel(null, ["Tiny Village"]), UNGROUPED_LABEL);
    assert.equal(milestoneLabel(undefined, ["Tiny Village"]), UNGROUPED_LABEL);
    assert.equal(milestoneLabel(-1, ["Tiny Village"]), UNGROUPED_LABEL);
    assert.equal(milestoneLabel(Number.NaN, ["Tiny Village"]), UNGROUPED_LABEL);
  });
});

describe("Fitting a heading", () => {
  it("fits a label to the width it was actually given, not to a tile count", () => {
    // The numbers are the ones measured in Electricity: a one-card group is
    // 166px and "GAS POWER PLANT" wants about 105px, so it fits whole — while
    // the tile-count estimate cut it to "GAS POWE…" over that same 166px.
    assert.equal(fitLabelToWidth("GAS POWER PLANT", 166, 105), "GAS POWER PLANT");
    assert.equal(fitGroupLabel("GAS POWER PLANT", 1), "GAS POWE…");

    // Genuinely too long: 77px of grid tile for a string wanting 190px.
    const cut = fitLabelToWidth("CENTRAL INTELLIGENCE BUREAU", 77, 190);
    assert.ok(cut.endsWith("…"), `expected an ellipsis, got ${cut}`);
    assert.ok(cut.length < "CENTRAL INTELLIGENCE BUREAU".length);
  });

  it("keeps the caller's estimate when it has nothing to measure", () => {
    // An unlaid-out box reports 0. Returning the label whole would overflow
    // the group; returning it unchanged lets the estimate stand.
    assert.equal(fitLabelToWidth("SOLAR POWER STATION", 0, 190), "SOLAR POWER STATION");
    assert.equal(fitLabelToWidth("SOLAR POWER STATION", 166, 0), "SOLAR POWER STATION");
  });

  it("never trims a fitted label below the readable floor", () => {
    // A pathologically narrow box still has to name something.
    assert.ok(fitLabelToWidth("CENTRAL INTELLIGENCE BUREAU", 4, 190).length >= 7);
  });

  it("fits a heading to the width its tiles give it", () => {
    // The engine draws a hard clip rather than an ellipsis, so the "…" is put
    // there rather than asked for.
    assert.equal(fitGroupLabel("CENTRAL INTELLIGENCE BUREAU", 1), "CENTRAL…");
    assert.equal(fitGroupLabel("BASIC", 1), "BASIC");
    // More tiles, more room.
    assert.ok(fitGroupLabel("CENTRAL INTELLIGENCE BUREAU", 4).length > 8);
    assert.equal(fitGroupLabel("POLICE HEADQUARTERS", 9), "POLICE HEADQUARTERS");
  });

  it("keeps a one-tile heading long enough to name something", () => {
    // A budget straight from the tile width would leave "C…", which identifies
    // nothing; the count beside it is what the width is really being spent on.
    assert.ok(fitGroupLabel("WELFARE OFFICE", 1).length >= 7);
  });
});
