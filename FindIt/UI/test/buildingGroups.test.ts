import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COST_BANDS,
  DEFAULT_GROUP_DIMENSION,
  FOOTPRINT_BANDS,
  GROUP_DIMENSIONS,
  UNGROUPED_LABEL,
  buildGroupedView,
  defaultGroupDimensionFor,
  costBandLabel,
  footprintBandLabel,
  groupLevelsFor,
  humanizeGroupLabel,
  isGroupDimension,
  shouldShowHeading,
} from "../src/domain/buildingGroups.ts";

const entry = (over: Record<string, unknown> = {}) => ({
  categoryLabel: "Service Buildings",
  subCategoryLabel: "Health & Deathcare",
  buildingType: "Hospital",
  theme: "European",
  provenance: "Base game",
  dlcId: null,
  zoneType: null,
  lotWidth: 4,
  lotDepth: 4,
  constructionCost: 10_000,
  ...over,
});

describe("Group dimensions", () => {
  it("yields two levels for Category and one for everything else", () => {
    // Category's second level is what keeps it useful after navigation: once
    // you are inside Service Buildings a lone SERVICE BUILDINGS heading says
    // nothing, but the subcategory underneath still chunks the set.
    assert.deepEqual(groupLevelsFor(entry(), "category"), [
      "Service Buildings",
      "Health & Deathcare",
    ]);

    for (const dimension of GROUP_DIMENSIONS) {
      if (dimension.id === "none") continue;
      assert.equal(
        groupLevelsFor(entry(), dimension.id).length,
        dimension.depth,
        `${dimension.id} should yield ${dimension.depth} level(s)`
      );
    }
  });

  it("groups by nothing when asked to", () => {
    assert.deepEqual(groupLevelsFor(entry(), "none"), []);
    assert.deepEqual(buildGroupedView([entry()], "none"), []);
  });

  it("names each school tier the way the game names it", () => {
    // SchoolLevel { Elementary = 1, HighSchool, College, University, Outside }.
    assert.deepEqual(groupLevelsFor(entry({ educationLevel: 1 }), "schoolTier"), ["Elementary School"]);
    assert.deepEqual(groupLevelsFor(entry({ educationLevel: 2 }), "schoolTier"), ["High School"]);
    assert.deepEqual(groupLevelsFor(entry({ educationLevel: 3 }), "schoolTier"), ["College"]);
    assert.deepEqual(groupLevelsFor(entry({ educationLevel: 4 }), "schoolTier"), ["University"]);
  });

  it("files the non-tiers with everything that has no tier at all", () => {
    // 0 is a school upgrade that adds capacity without a tier and 5 is the
    // outside connection, so neither is a heading — and neither is a building
    // that is not a school.
    for (const level of [0, 5, null, undefined]) {
      assert.deepEqual(
        groupLevelsFor(entry({ educationLevel: level as never }), "schoolTier"),
        ["Other"],
        `education level ${level} should not become a tier heading`
      );
    }
  });

  it("orders school tiers by career, which the alphabet does not", () => {
    // C# ranks these, so the UI only preserves what it is sent — but the two
    // still have to agree on which order that is. College before University
    // and after High School is the case the alphabet gets wrong.
    const ordered = buildGroupedView(
      [
        entry({ educationLevel: 1 }),
        entry({ educationLevel: 2 }),
        entry({ educationLevel: 3 }),
        entry({ educationLevel: 4 }),
      ],
      "schoolTier"
    );

    assert.deepEqual(ordered.map((node) => node.label), [
      "Elementary School",
      "High School",
      "College",
      "University",
    ]);
  });

  it("carries the game's category id so the heading can be localized", () => {
    // The label is our camel-case split of "TransportationRoad"; the game ships
    // "Road" under SubServices.NAME[TransportationRoad]. The renderer needs the
    // raw id to ask for it, and the label stays as the fallback.
    const nodes = buildGroupedView(
      [entry({ uiMenu: "Transportation", uiCategory: "TransportationRoad" })],
      "menuCategory"
    );

    assert.equal(nodes[0].labelId, "TransportationRoad");
    assert.equal(nodes[0].label, "Road");
  });

  it("carries no id for headings the game does not name", () => {
    // Only menuCategory names something the game owns. Cost bands, footprints
    // and roles are ours, so there is nothing to look up — and "Other" is ours
    // even within menuCategory.
    assert.equal(buildGroupedView([entry()], "cost")[0].labelId, undefined);
    assert.equal(buildGroupedView([entry()], "role")[0].labelId, undefined);
    assert.equal(
      buildGroupedView([entry({ uiCategory: null })], "menuCategory")[0].labelId,
      undefined
    );
  });

  it("prefers the DLC name over the broad provenance for Source", () => {
    assert.deepEqual(groupLevelsFor(entry({ dlcId: "Bridges & Ports" }), "source"), ["Bridges & Ports"]);
    assert.deepEqual(groupLevelsFor(entry({ dlcId: null }), "source"), ["Base game"]);
  });

  it("falls back to the id when a display label is missing, word-split", () => {
    // A raw id is better than a blank heading, but "SERVICEBUILDINGS" under the
    // heading's uppercase styling is not what the player calls it.
    assert.deepEqual(
      groupLevelsFor(entry({ categoryLabel: null, category: "ServiceBuildings", subCategoryLabel: null, subCategory: "Health" }), "category"),
      ["Service Buildings", "Health"]
    );
  });

  it("puts an entry with no value under one explicit heading, never a blank one", () => {
    // A blank heading reads as a rendering bug; "Other" reads as a fact.
    assert.deepEqual(groupLevelsFor(entry({ theme: null }), "theme"), [UNGROUPED_LABEL]);
    assert.deepEqual(groupLevelsFor(entry({ theme: "   " }), "theme"), [UNGROUPED_LABEL]);
    assert.deepEqual(groupLevelsFor(entry({ buildingType: null }), "role"), [UNGROUPED_LABEL]);
  });

  it("recognises its own dimension ids and rejects anything else", () => {
    assert.equal(isGroupDimension("category"), true);
    assert.equal(isGroupDimension("assetPack"), false);
    assert.equal(isGroupDimension(null), false);
  });

  it("defaults to a dimension it actually offers", () => {
    assert.ok(GROUP_DIMENSIONS.some((d) => d.id === DEFAULT_GROUP_DIMENSION));
  });

  it("offers no array-valued dimension", () => {
    // An entry belongs to several asset packs, so grouping by one would put it
    // under several headings and the counts would exceed the result total.
    for (const banned of ["assetPack", "placement", "extension"]) {
      assert.equal(GROUP_DIMENSIONS.some((d) => d.id === (banned as never)), false, banned);
    }
  });
});

describe("Bands", () => {
  it("lands each cost on the correct side of every edge", () => {
    // Asserted on both sides of every threshold because C# derives the same
    // bands for ordering; a disagreement would sort a group wrongly.
    assert.equal(costBandLabel(0), "₡0–₡5k");
    assert.equal(costBandLabel(COST_BANDS[0] - 1), "₡0–₡5k");
    assert.equal(costBandLabel(COST_BANDS[0]), "₡5k–₡25k");
    assert.equal(costBandLabel(COST_BANDS[1] - 1), "₡5k–₡25k");
    assert.equal(costBandLabel(COST_BANDS[1]), "₡25k–₡100k");
    assert.equal(costBandLabel(COST_BANDS[2]), "₡100k+");
    assert.equal(costBandLabel(999_999), "₡100k+");
  });

  it("declines to band a cost it does not have", () => {
    assert.equal(costBandLabel(null), UNGROUPED_LABEL);
    assert.equal(costBandLabel(undefined), UNGROUPED_LABEL);
    assert.equal(costBandLabel(Number.NaN), UNGROUPED_LABEL);
  });

  it("bands a footprint by its longer side", () => {
    // A 2x6 is a big lot however narrow it is, so the longer side decides.
    assert.equal(footprintBandLabel(2, 2), "2×2 and under");
    assert.equal(footprintBandLabel(2, 6), "6×6 and under");
    assert.equal(footprintBandLabel(FOOTPRINT_BANDS[0], FOOTPRINT_BANDS[0]), "2×2 and under");
    assert.equal(footprintBandLabel(3, 3), "4×4 and under");
    assert.equal(footprintBandLabel(20, 1), "Larger than 6×6");
    assert.equal(footprintBandLabel(null, null), UNGROUPED_LABEL);
    assert.equal(footprintBandLabel(0, 0), UNGROUPED_LABEL);
  });
});

describe("Grouped view", () => {
  const rows = [
    entry({ subCategoryLabel: "Health & Deathcare", constructionCost: 1 }),
    entry({ subCategoryLabel: "Health & Deathcare", constructionCost: 2 }),
    entry({ subCategoryLabel: "Education & Research", constructionCost: 3 }),
  ];

  it("nests category over subcategory and counts through the tree", () => {
    const groups = buildGroupedView(rows, "category");

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
    const groups = buildGroupedView(rows, "category");

    assert.deepEqual(groups[0].path, ["Service Buildings"]);
    assert.deepEqual(groups[0].children[0].path, ["Service Buildings", "Health & Deathcare"]);
  });

  it("preserves incoming order rather than sorting", () => {
    // The caller arrives already ordered by (group key, chosen sort) from C#.
    // Re-sorting here would disagree with the paging, which is the exact
    // failure this design exists to prevent.
    const groups = buildGroupedView(rows, "subCategory");

    assert.deepEqual(groups.map((g) => g.label), ["Health & Deathcare", "Education & Research"]);
    assert.deepEqual(groups[0].entries.map((e) => e.constructionCost), [1, 2]);
  });

  it("keeps group counts summing to the result total", () => {
    // The invariant that excludes array-valued dimensions.
    for (const dimension of GROUP_DIMENSIONS) {
      if (dimension.id === "none") continue;

      const groups = buildGroupedView(rows, dimension.id);
      const total = groups.reduce((sum, group) => sum + group.count, 0);
      assert.equal(total, rows.length, `${dimension.id} lost or duplicated entries`);
    }
  });

  it("survives absent and empty input", () => {
    assert.deepEqual(buildGroupedView(null, "category"), []);
    assert.deepEqual(buildGroupedView(undefined, "category"), []);
    assert.deepEqual(buildGroupedView([], "category"), []);
  });

  it("suppresses a heading that covers everything", () => {
    // A lone SERVICE BUILDINGS heading, once you have navigated there, is a
    // label with nothing to distinguish.
    assert.equal(shouldShowHeading(buildGroupedView(rows, "category")), false);
    assert.equal(shouldShowHeading(buildGroupedView(rows, "subCategory")), true);
  });
});

describe("Heading labels", () => {
  it("word-splits an id so the heading does not read as one shout", () => {
    // Headings are uppercased in CSS, so "DeathcareFacility" rendered as
    // "DEATHCAREFACILITY". The facet list already splits its own labels.
    assert.equal(humanizeGroupLabel("DeathcareFacility"), "Deathcare Facility");
    assert.equal(humanizeGroupLabel("WaterPumpingStation"), "Water Pumping Station");
    assert.equal(humanizeGroupLabel("ServiceBuildings_Health"), "Service Buildings Health");
    assert.equal(humanizeGroupLabel("Hospital"), "Hospital");
  });

  it("applies that splitting to the levels it yields", () => {
    assert.deepEqual(
      groupLevelsFor({ buildingType: "DeathcareFacility" }, "role"),
      ["Deathcare Facility"]
    );
  });
});

describe("Per-section defaults", () => {
  it("opens service buildings on Role", () => {
    // What the player came looking for. The category level above it would be
    // one heading reading "Service Buildings" to someone who just clicked
    // Healthcare.
    assert.equal(defaultGroupDimensionFor("ServiceBuildings"), "role");
    assert.equal(defaultGroupDimensionFor("servicebuildings"), "role");
    assert.equal(defaultGroupDimensionFor("  ServiceBuildings  "), "role");
  });

  it("does not apply Role anywhere else", () => {
    // Residential, commercial and industrial prefabs carry no service
    // component, so every one of them would land under "Other".
    assert.equal(defaultGroupDimensionFor("AllBuildings"), "category");
    assert.equal(defaultGroupDimensionFor("SignatureBuildings"), "category");
    assert.equal(defaultGroupDimensionFor("Favorites"), "category");
    assert.equal(defaultGroupDimensionFor(null), "category");
    assert.equal(defaultGroupDimensionFor(undefined), "category");
    assert.equal(defaultGroupDimensionFor(""), "category");
  });

  it("only ever returns a dimension the picker offers", () => {
    for (const section of ["ServiceBuildings", "AllBuildings", "nonsense", ""]) {
      assert.ok(GROUP_DIMENSIONS.some((d) => d.id === defaultGroupDimensionFor(section)));
    }
  });
});

describe("The Other group", () => {
  it("comes last however it arrived", () => {
    // It is the only group defined by absence, so leading with it opens the
    // view on the entries that matched the grouping least.
    const groups = buildGroupedView(
      [
        entry({ buildingType: null }),
        entry({ buildingType: "Hospital" }),
        entry({ buildingType: null }),
      ],
      "role"
    );

    assert.deepEqual(groups.map((g) => [g.label, g.count]), [["Hospital", 1], [UNGROUPED_LABEL, 2]]);
  });

  it("is not invented when every entry has a value", () => {
    const groups = buildGroupedView([entry({ buildingType: "Hospital" })], "role");

    assert.deepEqual(groups.map((g) => g.label), ["Hospital"]);
  });
});

describe("Flattening groups for the table", () => {
  const entry = (id: number, category: string, name: string) =>
    ({ id, name, category, subCategory: "", prefabName: name } as never);
  const entry2 = (id: number, category: string, subCategory: string, name: string) =>
    ({ id, name, category, subCategory, prefabName: name } as never);
  const key = (e: { id: number }) => String(e.id);

  it("puts a heading before each group's rows, at every level", async () => {
    const { flattenGroupedRows } = await import("../src/domain/buildingGroups.ts");

    // "category" nests: asset type, then subcategory. These entries carry no
    // subCategory, so each root has exactly one child — a lone "Other" — and
    // the per-level rule drops those inner headings while keeping the roots,
    // which is the point of deciding it per level rather than once.
    const rows = flattenGroupedRows(
      [entry(1, "Networks", "Alley"), entry(2, "Buildings", "School"), entry(3, "Networks", "Road")],
      "category",
      key,
    );

    assert.deepEqual(
      rows.map((r) => (r.kind === "heading" ? `${"  ".repeat(r.depth)}# ${r.label}` : (r.entry as { name: string }).name)),
      ["# Networks", "Alley", "Road", "# Buildings", "School"],
    );
  });

  it("still labels the level below a lone parent", async () => {
    const { flattenGroupedRows } = await import("../src/domain/buildingGroups.ts");

    // The case reported from play: grouping the Roads menu by asset type puts
    // every entry under one root, because they are all Networks. Judging the
    // whole tree by that root suppressed the headings underneath it as well,
    // so the table reordered into Roads, Bridges and Tracks and named none of
    // them.
    const rows = flattenGroupedRows(
      [
        entry2(1, "Networks", "Roads", "Alley"),
        entry2(2, "Networks", "Bridges", "Quay"),
        entry2(3, "Networks", "Roads", "Road"),
      ],
      "category",
      key,
    );

    assert.deepEqual(
      rows.map((r) => (r.kind === "heading" ? `${"  ".repeat(r.depth)}# ${r.label}` : (r.entry as { name: string }).name)),
      ["  # Roads", "Alley", "Road", "  # Bridges", "Quay"],
    );
  });

  it("emits a flat list when nothing is grouped", async () => {
    const { flattenGroupedRows } = await import("../src/domain/buildingGroups.ts");

    const rows = flattenGroupedRows([entry(1, "Networks", "Alley"), entry(2, "Networks", "Road")], "none", key);

    assert.deepEqual(rows.map((r) => r.kind), ["row", "row"]);
  });

  it("draws no heading when one group covers everything", async () => {
    const { flattenGroupedRows } = await import("../src/domain/buildingGroups.ts");

    // A lone heading names nothing the reader did not already know — the same
    // rule GroupedResults applies.
    const rows = flattenGroupedRows([entry(1, "Networks", "Alley"), entry(2, "Networks", "Road")], "category", key);

    assert.deepEqual(rows.map((r) => r.kind), ["row", "row"]);
  });

  it("counts every entry beneath a heading", async () => {
    const { flattenGroupedRows } = await import("../src/domain/buildingGroups.ts");

    const rows = flattenGroupedRows(
      [entry(1, "Networks", "Alley"), entry(2, "Networks", "Road"), entry(3, "Buildings", "School")],
      "category",
      key,
    );
    const heading = rows.find((r) => r.kind === "heading" && r.label === "Networks");

    assert.equal(heading && heading.kind === "heading" ? heading.count : null, 2);
  });

  it("keeps the order the backend already sorted", async () => {
    const { flattenGroupedRows } = await import("../src/domain/buildingGroups.ts");

    // The C# side orders by (group key, chosen sort). Re-sorting here would
    // silently disagree with the window the backend published.
    const rows = flattenGroupedRows(
      [entry(1, "Networks", "Zebra"), entry(2, "Networks", "Alpha"), entry(3, "Buildings", "School")],
      "category",
      key,
    );

    assert.deepEqual(
      rows.filter((r) => r.kind === "row").map((r) => (r.kind === "row" ? (r.entry as { name: string }).name : "")),
      ["Zebra", "Alpha", "School"],
    );
  });

  it("gives every line a stable key", async () => {
    const { flattenGroupedRows } = await import("../src/domain/buildingGroups.ts");

    const rows = flattenGroupedRows(
      [entry(1, "Networks", "Alley"), entry(2, "Buildings", "School")],
      "category",
      key,
    );
    const keys = rows.map((r) => r.key);

    assert.equal(new Set(keys).size, keys.length);
  });

  it("has nothing to say about an empty result", async () => {
    const { flattenGroupedRows } = await import("../src/domain/buildingGroups.ts");

    assert.deepEqual(flattenGroupedRows([], "category", key), []);
    assert.deepEqual(flattenGroupedRows(null, "category", key), []);
  });
});
