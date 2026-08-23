import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COST_BANDS,
  DENSITY_TIERS,
  densityTierLabel,
  categoryTierLabel,
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
  groupDimensionsFor,
  isEducationMenu,
  milestoneLabel,
  fitGroupLabel,
  fitLabelToWidth,
  PROGRESSION_UNGATED_LABEL,
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

  it("files a non-school under its own category, not under Other", () => {
    // The education menu opens on this grouping, and its three research
    // buildings under a heading called "Other" said nothing about them —
    // "Research" is what the strip's own tab beside the four levels says.
    assert.deepEqual(
      groupLevelsFor(entry({ educationLevel: null, uiCategory: "Research" }), "schoolTier"),
      ["Research"]
    );
    // A school still wins its tier, category or no category.
    assert.deepEqual(
      groupLevelsFor(entry({ educationLevel: 3, uiCategory: "Education" }), "schoolTier"),
      ["College"]
    );
  });

  it("files the non-tiers with everything that has no tier at all", () => {
    // 0 is a school upgrade that adds capacity without a tier and 5 is the
    // outside connection, so neither is a heading — and neither is a building
    // that is not a school.
    // No category on these fixtures, so the category fallback lands on Other
    // too — what is being pinned is that 0 and 5 never become a TIER heading.
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

  it("lets the menu's own categories beat a development axis", () => {
    // cm-2xvs.23, reported on Roads: ten category tabs on screen and the grid
    // grouped by Development underneath them.
    //
    // GetStripAxis answers "development" for a category menu as soon as ONE of
    // its categories is drawn as branches — it has to, or a branch tab would
    // select nothing. That is a fact about a sub-level, and the picker was
    // reading it as a fact about the whole menu.
    assert.equal(defaultGroupDimensionFor("Networks", true, "development"), "menuCategory");
    assert.equal(defaultGroupDimensionFor("AllBuildings", true, "development"), "menuCategory");
  });

  it("still follows the axis when the menu has no categories of its own", () => {
    // Electricity is the case the fallback exists for: one category, so the
    // strip draws development branches and the grid should agree with them.
    assert.equal(defaultGroupDimensionFor("ServiceBuildings", false, "development"), "development");
    assert.equal(defaultGroupDimensionFor("ServiceBuildings", false, "assetType"), "category");
  });

  it("keeps school tiers ahead of everything, categories included", () => {
    // Education has categories AND a development axis AND school levels; the
    // levels are what its strip actually draws.
    assert.equal(
      defaultGroupDimensionFor("ServiceBuildings", true, "development", true),
      "schoolTier",
    );
  });

  it("groups a scoped menu by the game's own categories", () => {
    // Master's behaviour (4ce4ba5), restored after this branch had changed it
    // to "none". The argument for flat was measured against a panel showing
    // two tile rows; the panel is now 10 tiles wide with a height the player
    // drags, so the scrolling that argument was avoiding is not the cost it
    // was. The categories are the split the strip already puts in the player's
    // head, and grouping by them shows the whole menu at once.
    assert.equal(defaultGroupDimensionFor("Networks", true), "menuCategory");
    // The strip decides, whatever the section is: a menu with categories is
    // scoped to that menu, so the section behind it says nothing extra.
    assert.equal(defaultGroupDimensionFor("ServiceBuildings", true), "menuCategory");
    assert.equal(defaultGroupDimensionFor(null, true), "menuCategory");
  });

  it("still groups where there is no strip to do the dividing", () => {
    assert.equal(defaultGroupDimensionFor("ServiceBuildings", false), "role");
    assert.equal(defaultGroupDimensionFor("AllBuildings", false), "category");
  });

  it("only ever returns a dimension the picker offers", () => {
    for (const section of ["ServiceBuildings", "AllBuildings", "nonsense", ""]) {
      for (const hasCategories of [false, true]) {
        assert.ok(
          GROUP_DIMENSIONS.some((d) => d.id === defaultGroupDimensionFor(section, hasCategories))
        );
      }
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

describe("Which grouping choices a menu offers", () => {
  it("offers School tier only where schools are", () => {
    // Elsewhere it is a dimension that puts the whole result in one "Ungrouped"
    // heading — a control that cannot act, in a picker of controls that can.
    const ids = (menu: string) => groupDimensionsFor(menu).map((d) => d.id);

    assert.ok(ids("Education & Research").includes("schoolTier"));
    assert.ok(!ids("Electricity").includes("schoolTier"));
    assert.ok(!ids("Roads").includes("schoolTier"));
    assert.ok(!ids("").includes("schoolTier"));
  });

  it("leaves every other dimension alone", () => {
    // Role outside a service menu and Density outside zoned buildings are
    // narrow too, but they degrade to a sensible split rather than one bucket.
    assert.equal(groupDimensionsFor("Electricity").length, GROUP_DIMENSIONS.length - 1);
    assert.equal(groupDimensionsFor("Education & Research").length, GROUP_DIMENSIONS.length);
  });

  it("matches the menu's own name, not display text", () => {
    // UIAssetMenuPrefab.name — the same string the census prints and assets
    // carry as UiMenu. Loose so a rename or variant still resolves.
    assert.equal(isEducationMenu("Education & Research"), true);
    assert.equal(isEducationMenu("education"), true);
    assert.equal(isEducationMenu("Roads"), false);
    assert.equal(isEducationMenu(null), false);
  });

  it("names a milestone out of the published table, and falls back to its index", () => {
    const names = ["Tiny Village", "Small Village", "Grand Village"];

    assert.equal(milestoneLabel(0, names), "Tiny Village");
    assert.equal(milestoneLabel(2, names), "Grand Village");
    // Past the end, and a gap inside it: still a definite point in the
    // progression, so it keeps its index rather than joining the unknowns.
    assert.equal(milestoneLabel(7, names), "Milestone 7");
    assert.equal(milestoneLabel(1, ["Tiny Village", "", "Grand Village"]), "Milestone 1");
    assert.equal(milestoneLabel(3, []), "Milestone 3");
    assert.equal(milestoneLabel(3, null), "Milestone 3");
    // Slot 0 is empty in every save: the game's milestones start at 1. An
    // asset there was never gated, so it is not waiting on "Milestone 0".
    assert.equal(milestoneLabel(0, ["", "Small Village"]), PROGRESSION_UNGATED_LABEL);
    assert.equal(milestoneLabel(0, []), PROGRESSION_UNGATED_LABEL);
  });

  it("treats a missing or nonsense milestone as ungrouped", () => {
    assert.equal(milestoneLabel(null, ["Tiny Village"]), UNGROUPED_LABEL);
    assert.equal(milestoneLabel(undefined, ["Tiny Village"]), UNGROUPED_LABEL);
    assert.equal(milestoneLabel(-1, ["Tiny Village"]), UNGROUPED_LABEL);
    assert.equal(milestoneLabel(Number.NaN, ["Tiny Village"]), UNGROUPED_LABEL);
  });

  it("groups by progression, naming the headings from the milestone table", () => {
    const names = ["Tiny Village", "Small Village", "Grand Village"];

    assert.deepEqual(
      groupLevelsFor(entry({ unlockMilestone: 1 }), "progression", names),
      ["Small Village"]
    );

    // The whole point of the dimension: an UNLOCKED asset still reports the
    // milestone it was gated behind. When the backend zeroed it on unlock, an
    // asset left its tier at the moment the player earned it.
    const nodes = buildGroupedView(
      [
        entry({ name: "a", unlockMilestone: 0, isLocked: false }),
        entry({ name: "b", unlockMilestone: 2, isLocked: false }),
        entry({ name: "c", unlockMilestone: 2, isLocked: true }),
      ],
      "progression",
      names
    );

    assert.deepEqual(nodes.map((node) => node.label), ["Tiny Village", "Grand Village"]);
    assert.deepEqual(nodes.map((node) => node.entries.length), [1, 2]);
  });

  it("orders progression headings by milestone, not by arrival", () => {
    const names = ["Tiny Village", "Small Village", "Grand Village"];

    // Fed in the order a name sort would produce.
    const nodes = buildGroupedView(
      [
        entry({ name: "g", unlockMilestone: 2 }),
        entry({ name: "s", unlockMilestone: 1 }),
        entry({ name: "t", unlockMilestone: 0 }),
        entry({ name: "u", unlockMilestone: null }),
      ],
      "progression",
      names
    );

    assert.deepEqual(nodes.map((node) => node.label), [
      "Tiny Village",
      "Small Village",
      "Grand Village",
      UNGROUPED_LABEL,
    ]);
  });

  it("offers progression on every menu, unlike school tier", () => {
    const ids = (menu: string) => groupDimensionsFor(menu).map((dimension) => dimension.id);

    assert.ok(ids("Roads").includes("progression"));
    assert.ok(ids("Electricity").includes("progression"));
    assert.ok(ids("Education & Research").includes("progression"));
  });

  it("groups by the development tree branch the backend resolved", () => {
    // No name table and no fallback logic: unlike progression, the branch
    // arrives as the label, because resolving it needs the game's tree.
    assert.deepEqual(
      groupLevelsFor(entry({ devTreeBranch: "Advanced Electricity" }), "development"),
      ["Advanced Electricity"]
    );

    const nodes = buildGroupedView(
      [
        entry({ name: "a", devTreeBranch: "Basic" }),
        entry({ name: "b", devTreeBranch: "Gas Power Plant" }),
        entry({ name: "c", devTreeBranch: "Basic" }),
      ],
      "development"
    );

    assert.deepEqual(nodes.map((node) => node.label), ["Basic", "Gas Power Plant"]);
    assert.deepEqual(nodes.map((node) => node.entries.length), [2, 1]);
  });

  it("falls back to ungrouped only when the branch never arrived", () => {
    // "Basic" is the real bucket for an asset the tree never gated, so an
    // empty branch means the backend had nothing to say — a modded service
    // with no tree, or an entry from before the field existed.
    assert.deepEqual(groupLevelsFor(entry({ devTreeBranch: "" }), "development"), [UNGROUPED_LABEL]);
    assert.deepEqual(groupLevelsFor(entry({ devTreeBranch: null }), "development"), [UNGROUPED_LABEL]);
    assert.deepEqual(groupLevelsFor(entry({}), "development"), [UNGROUPED_LABEL]);
  });

  it("offers Development everywhere, like Progression", () => {
    const ids = (menu: string) => groupDimensionsFor(menu).map((dimension) => dimension.id);

    assert.ok(ids("Electricity").includes("development"));
    assert.ok(ids("Roads").includes("development"));
    assert.ok(ids("Education & Research").includes("development"));
  });

  it("opens the education menu on its levels", () => {
    // The default has to match what the strip offers, or arriving in the menu
    // shows one EDUCATION heading over ten schools the row had just separated.
    assert.equal(defaultGroupDimensionFor("ServiceBuildings", true, "", true), "schoolTier");
    // Every other menu is unaffected by the education flag being absent.
    assert.equal(defaultGroupDimensionFor("ServiceBuildings", true, ""), "menuCategory");
    assert.equal(defaultGroupDimensionFor("ServiceBuildings", false, "development"), "development");
    assert.equal(defaultGroupDimensionFor("ServiceBuildings", false, "assetType"), "category");
  });

  it("hides a grouping that would put the whole menu in one bucket", () => {
    // Landscaping is the case: nothing there is gated by a development tree,
    // so Development drew one heading over 379 assets — a control that cannot
    // act, in a picker of controls that can.
    const ungated = [
      entry({ devTreeBranch: "Basic", theme: "European" }),
      entry({ devTreeBranch: "Basic", theme: "European" }),
    ];
    const ids = groupDimensionsFor("Landscaping", ungated).map((d) => d.id);

    assert.ok(!ids.includes("development"));
    assert.ok(!ids.includes("theme"));
    // None survives whatever the data: it is how grouping is turned off.
    assert.ok(ids.includes("none"));
  });

  it("keeps a grouping that can split the menu", () => {
    const split = [
      entry({ devTreeBranch: "Basic" }),
      entry({ devTreeBranch: "Nuclear Power Plant" }),
    ];

    assert.ok(groupDimensionsFor("Electricity", split).map((d) => d.id).includes("development"));
  });

  it("offers everything before any entries have arrived", () => {
    // Judging an empty page would shorten the picker and leave it short.
    const ids = groupDimensionsFor("Electricity", []).map((d) => d.id);

    assert.ok(ids.includes("development"));
    assert.equal(ids.length, GROUP_DIMENSIONS.length - 1);
  });

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

describe("Density tiers", () => {
  it("names each tier rather than printing its enum value", () => {
    // These headings read "0", "1", "2", "4", "8" before this existed. It was
    // never seen because the dimension is dropped from the picker whenever its
    // entries share one value — and until zones carried a tier, they always
    // did.
    assert.equal(densityTierLabel(1), "Low Density");
    assert.equal(densityTierLabel(2), "Row Housing");
    assert.equal(densityTierLabel(4), "Medium Density");
    assert.equal(densityTierLabel(32), "Mixed Housing");
    assert.equal(densityTierLabel(64), "Low Rent Housing");
    assert.equal(densityTierLabel(8), "High Density");
  });

  it("orders them the way the player meets them", () => {
    // Mirrors BuildingCatalogGrouping.DensityOrder. The enum values are
    // 1, 2, 4, 32, 64, 8 — deliberately not ascending, because Mixed and Low
    // Rent read between Medium and High but were numbered last.
    assert.deepEqual(
      DENSITY_TIERS.map((tier) => tier.value),
      [1, 2, 4, 32, 64, 8, 16]
    );
  });

  it("falls back to the ungrouped label for an untiered zone", () => {
    assert.equal(densityTierLabel(0), UNGROUPED_LABEL);
    assert.equal(densityTierLabel(null), UNGROUPED_LABEL);
    assert.equal(densityTierLabel(undefined), UNGROUPED_LABEL);
    assert.equal(densityTierLabel(999), UNGROUPED_LABEL);
  });

  it("groups zones by tier name", () => {
    const rows = [
      { id: 1, name: "EU Residential Low", zoneType: 1 },
      { id: 2, name: "EU Residential Mixed", zoneType: 32 },
    ] as never[];

    assert.deepEqual(
      buildGroupedView(rows, "density").map((node) => node.label),
      ["Low Density", "Mixed Housing"]
    );
  });
});

describe("menuCategory sub-grouped by density", () => {
  const zone = (id: number, category: string, zoneType: number) =>
    ({ id, name: `Zone ${id}`, uiCategory: category, uiMenu: "Zones", zoneType } as never);

  it("names the outer level for the category and the inner one for the tier", () => {
    const nodes = buildGroupedView(
      [zone(1, "ZonesResidential", 1), zone(2, "ZonesResidential", 8)],
      "menuCategory"
    );

    assert.equal(nodes.length, 1);
    assert.deepEqual(nodes[0].children.map((n) => n.label), ["Low Density", "High Density"]);
  });

  it("gives the game's id to the CATEGORY level only", () => {
    // The renderer resolves labelId back to the game's own category name. Set
    // on the tier node too, it overrode the tier's label and every one of
    // Residential's six headings drew "Residential Zones".
    const nodes = buildGroupedView(
      [zone(1, "ZonesResidential", 1), zone(2, "ZonesResidential", 8)],
      "menuCategory"
    );

    assert.equal(nodes[0].labelId, "ZonesResidential");
    assert.deepEqual(nodes[0].children.map((n) => n.labelId), [undefined, undefined]);
  });

  it("puts an untiered menu's entries under one child, which draws no heading", () => {
    // Service buildings leave zoneType at Any, so the second level is a single
    // node and shouldShowHeading suppresses it.
    const nodes = buildGroupedView(
      [zone(1, "Healthcare", 0), zone(2, "Healthcare", 0)],
      "menuCategory"
    );

    assert.equal(nodes[0].children.length, 1);
    assert.equal(shouldShowHeading(nodes[0].children), false);
  });
});

describe("categoryTierLabel", () => {
  it("uses the density tier for a zone", () => {
    assert.equal(categoryTierLabel({ zoneType: 64 } as never), "Low Rent Housing");
    assert.equal(categoryTierLabel({ zoneType: 2 } as never), "Row Housing");
  });

  it("uses the development branch for a service building", () => {
    // Measured: the branch partitions its category exactly on every service
    // menu checked — Healthcare's four sum to its 24, Police's four to its 22.
    assert.equal(
      categoryTierLabel({ zoneType: 0, devTreeBranch: "Crematorium" } as never),
      "Crematorium"
    );
  });

  it("does not treat Signature as a density", () => {
    // Every signature building is zoneType 16 and none carries a branch, so
    // taking Signature here would collapse all 100 into one child and never
    // reach the milestone, which is the only thing that varies across them.
    assert.equal(
      categoryTierLabel({ zoneType: 16, unlockMilestone: 9 } as never, ["", "A", "B", "", "", "", "", "", "", "Metropolis"]),
      "Metropolis"
    );
  });

  it("prefers density over a branch when an entry somehow has both", () => {
    assert.equal(
      categoryTierLabel({ zoneType: 1, devTreeBranch: "Hospital" } as never),
      "Low Density"
    );
  });

  it("groups a service menu's category by its branches", () => {
    const rows = [
      { id: 1, name: "A", uiCategory: "Healthcare", zoneType: 0, devTreeBranch: "Hospital" },
      { id: 2, name: "B", uiCategory: "Healthcare", zoneType: 0, devTreeBranch: "Healthcare" },
      { id: 3, name: "C", uiCategory: "Deathcare", zoneType: 0, devTreeBranch: "Crematorium" },
    ] as never[];

    const nodes = buildGroupedView(rows, "menuCategory");

    assert.deepEqual(
      nodes.map((n) => [n.label, n.children.map((c) => c.label)]),
      [["Healthcare", ["Hospital", "Healthcare"]], ["Deathcare", ["Crematorium"]]]
    );
  });
});

describe("transit tiers", () => {
  const transit = (id: number, sub: string, label: string) =>
    ({ id, name: `T${id}`, uiMenu: "Transportation", uiCategory: "TransportationTrain",
       subCategory: sub, subCategoryLabel: label, devTreeBranch: "Train", zoneType: 0 } as never);

  it("splits transit by what an asset is, not by its branch", () => {
    // Its branches are {Road, Train, Tram} against categories
    // {TransportationRoad, TransportationTrain, TransportationTram} — one to
    // one, so the branch divides nothing and every category drew one child.
    const nodes = buildGroupedView(
      [
        transit(1, "Networks_Tracks", "Tracks"),
        transit(2, "ServiceBuildings_Transportation", "Stations"),
        transit(3, "Networks_Routes", "Transit Lines"),
      ],
      "menuCategory"
    );

    assert.deepEqual(
      nodes[0].children.map((n) => n.label),
      ["Tracks", "Stations", "Transit Lines"]
    );
  });

  it("relabels the stations, whose vanilla name says nothing here", () => {
    // The backend resolves that subcategory through the GAME's key, and
    // vanilla calls it "Transportation" — useless as a heading inside the
    // Transportation menu, beside Tracks and Transit Lines.
    const nodes = buildGroupedView(
      [transit(1, "ServiceBuildings_Transportation", "Transportation")],
      "menuCategory"
    );

    assert.equal(nodes[0].children[0].label, "Stations");
  });

  it("does not leak the transit rule into a service menu", () => {
    // A service menu's subcategory is constant across the whole menu, so
    // taking it there would collapse the branch sub-grouping everywhere.
    const nodes = buildGroupedView(
      [
        { id: 1, name: "A", uiMenu: "Health & Deathcare", uiCategory: "Healthcare",
          subCategory: "ServiceBuildings_Health", devTreeBranch: "Hospital", zoneType: 0 },
        { id: 2, name: "B", uiMenu: "Health & Deathcare", uiCategory: "Healthcare",
          subCategory: "ServiceBuildings_Health", devTreeBranch: "Healthcare", zoneType: 0 },
      ] as never[],
      "menuCategory"
    );

    assert.deepEqual(nodes[0].children.map((n) => n.label), ["Hospital", "Healthcare"]);
  });
});
