import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GROUP_DIMENSIONS,
  UNGROUPED_LABEL,
  fitGroupLabel,
  fitLabelToWidth,
  flattenGroupedRows,
  groupDimensionLabel,
  groupDimensionsFor,
  groupTreeFromPaths,
  headingBands,
  isEducationMenu,
  levelDrawsHeading,
  shouldShowHeading,
  type GroupedEntry,
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
    // it — and the game owns the id of the OUTER level alone. Given it too,
    // the renderer resolves every tier heading to the category's own name.
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
    const unstamped: (GroupedEntry & { id: number })[] = [{ id: 1 }, { id: 2 }];
    assert.deepEqual(groupTreeFromPaths(unstamped), []);
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

  it("counts a level of one-building sub-groups as drawing no heading", () => {
    // Its neighbours then reserve no heading row on its account.
    const children = (paths: string[][]) => groupTreeFromPaths(paths.map((path, i) => item(i + 1, path)))[0].children;
    assert.equal(levelDrawsHeading(children([["Fire", "Tower"], ["Fire", "Depot"]]), 1), false);
    assert.equal(levelDrawsHeading(children([["Fire", "Tower"], ["Fire", "Depot"], ["Fire", "Depot"]]), 1), true);
    // A top-level group of one still heads.
    assert.equal(levelDrawsHeading(groupTreeFromPaths([item(1, ["Fire"]), item(2, ["Police"])]), 0), true);
  });
});

describe("Flattening groups for the table", () => {
  type Row = GroupedEntry & { id: number; name: string };
  const key = (e: Row) => String(e.id);
  const line = (r: ReturnType<typeof flattenGroupedRows<Row>>[number]) =>
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
    // Grouping the Roads menu by asset type puts every entry under one root,
    // because they are all Networks. Judging the whole tree by that root
    // suppresses the headings underneath it and names none of them.
    const rows = flattenGroupedRows(
      [
        item(1, ["Networks", "Roads"], { name: "Alley" }),
        item(3, ["Networks", "Roads"], { name: "Road" }),
        item(2, ["Networks", "Bridges"], { name: "Quay" }),
        item(4, ["Networks", "Bridges"], { name: "Viaduct" }),
      ],
      key,
    );

    assert.deepEqual(rows.map(line), ["  # Roads", "Alley", "Road", "  # Bridges", "Quay", "Viaduct"]);
  });

  it("draws no sub-heading over a single building, and leaves it in place", () => {
    // The card already names the one building, so a sub-heading over it says it
    // twice and spends a line on it. A top-level group of one still heads.
    const rows = flattenGroupedRows(
      [
        item(1, ["Fire", "Station"], { name: "Fire Station" }),
        item(2, ["Fire", "Station"], { name: "Fire Station 2" }),
        item(3, ["Fire", "Tower"], { name: "Firewatch Tower" }),
        item(4, ["Fire", "Depot"], { name: "Depot" }),
        item(5, ["Fire", "Depot"], { name: "Depot 2" }),
        item(6, ["Prison", "Prison"], { name: "Prison" }),
      ],
      key,
    );

    assert.deepEqual(rows.map(line), [
      "# Fire",
      "  # Station",
      "Fire Station",
      "Fire Station 2",
      "Firewatch Tower",
      "  # Depot",
      "Depot",
      "Depot 2",
      "# Prison",
      "Prison",
    ]);
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

describe("Fitting a heading", () => {
  it("fits a label to the width it was actually given, not to a tile count", () => {
    // A one-card group is wider than a tile-count estimate assumes, so a
    // heading that fits the box whole is cut by an estimate that counts tiles
    // rather than measuring it.
    assert.equal(fitLabelToWidth("GAS POWER PLANT", 166, 105), "GAS POWER PLANT");

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

  it("budgets a heading at three tiles of room however few tiles it has", () => {
    // A budget straight from the tile count cuts every name in a run of small
    // groups — "ROAD SER…" over one tile — so the estimate floors at
    // GROUP_LABEL_MIN_TILES and leaves the measured fit to cut a long heading.
    assert.equal(fitGroupLabel("ROAD SERVICES", 1), "ROAD SERVICES");
    assert.equal(fitGroupLabel("GAS POWER PLANT", 1), "GAS POWER PLANT");
    assert.equal(fitGroupLabel("CENTRAL INTELLIGENCE BUREAU", 1), "CENTRAL INTELLIGENCE BUREAU");
    assert.equal(fitGroupLabel("BASIC", 1), "BASIC");
    assert.equal(fitGroupLabel("POLICE HEADQUARTERS", 9), "POLICE HEADQUARTERS");
  });

  it("still clips a heading that outruns three tiles", () => {
    // The engine draws a hard clip rather than an ellipsis, so the "…" is put
    // there rather than asked for.
    const cut = fitGroupLabel("CENTRAL INTELLIGENCE BUREAU HEADQUARTERS", 1);
    assert.ok(cut.endsWith("…"), `expected an ellipsis, got ${cut}`);
    // More tiles, more room.
    assert.equal(fitGroupLabel("CENTRAL INTELLIGENCE BUREAU HEADQUARTERS", 9), "CENTRAL INTELLIGENCE BUREAU HEADQUARTERS");
  });

  it("keeps a one-tile heading long enough to name something", () => {
    // A budget straight from the tile width would leave "C…", which identifies
    // nothing; the count beside it is what the width is really being spent on.
    assert.ok(fitGroupLabel("WELFARE OFFICE", 1).length >= 7);
  });
});

describe("Heading bands", () => {
  const at = (key: string, top: number | null, heading: number | null) => ({ key, top, heading });

  it("gives every group on a line the tallest heading on that line", () => {
    // Tiles beside a heading sit on its baseline whether or not they have one.
    assert.deepEqual(headingBands([at("a", 0, 22), at("b", 0, null), at("c", 0, 30)]), { a: 30, b: 30, c: 30 });
  });

  it("gives a line with no heading on it no band, whatever the row's other lines hold", () => {
    // A headingless group that wrapped below its headed sibling kept the
    // sibling's band, as empty space between a title and its first row.
    assert.deepEqual(headingBands([at("a", 0, 22), at("b", 120, null)]), { a: 22, b: null });
  });

  it("sizes each line to its own headings", () => {
    assert.deepEqual(headingBands([at("a", 0, 22), at("b", 120, 30), at("c", 120, null)]), { a: 22, b: 30, c: 30 });
  });

  it("falls back to the row's tallest heading until every position is measured", () => {
    assert.deepEqual(headingBands([at("a", null, 22), at("b", 120, null)]), { a: 22, b: 22 });
  });

  it("has no band anywhere when nothing is headed", () => {
    assert.deepEqual(headingBands([at("a", 0, null), at("b", 120, null)]), { a: null, b: null });
  });
});
