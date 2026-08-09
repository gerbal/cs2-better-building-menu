import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { optionClickedCommand } from "../src/domain/buildingCatalogContracts.ts";
import {
  clearBuildingLensFacetsCommand,
  facetGroupNeedsScroll,
  facetOptionMarker,
  hasScrollableFacetGroups,
  hasSelectedBuildingLensFacets,
  toggleBuildingLensFacetCommand,
} from "../src/domain/buildingCatalogFacets.ts";
import { getFilterOptionState } from "../src/domain/filterContracts.ts";

const buildingCatalogSource = readFileSync(
  new URL("../src/mods/BuildingCatalog/BuildingCatalog.tsx", import.meta.url),
  "utf8"
);
const buildingCatalogStyles = readFileSync(
  new URL("../src/mods/BuildingCatalog/buildingCatalog.module.scss", import.meta.url),
  "utf8"
);
const topBarSource = readFileSync(new URL("../src/mods/TopBar/TopBar.tsx", import.meta.url), "utf8");

describe("Building Lens filter controls", () => {
  it("dispatches the Extra Filters option through the FindIt binding", () => {
    assert.deepEqual(optionClickedCommand(90, 0, 0), {
      method: "OptionClicked",
      args: [90, 0, 0],
    });
  });

  it("keeps selected state visible while disabling disabled options", () => {
    assert.deepEqual(getFilterOptionState(true, false), {
      selected: true,
      disabled: false,
      interactive: true,
    });
    assert.deepEqual(getFilterOptionState(true, true), {
      selected: false,
      disabled: true,
      interactive: false,
    });
  });

  it("builds exact facet toggle and clear trigger payloads", () => {
    assert.deepEqual(toggleBuildingLensFacetCommand("buildingType", "School"), {
      method: "ToggleBuildingLensFacet",
      args: ["buildingType", "School"],
    });
    assert.deepEqual(clearBuildingLensFacetsCommand(), {
      method: "ClearBuildingLensFacets",
      args: [],
    });
  });

  it("treats extensions as a first-class selectable facet", () => {
    const extensionGroup = {
      id: "extension",
      label: "Extensions",
      options: [{ id: "HospitalWing01", label: "Hospital Wing 01", selected: true }],
    };

    assert.equal(hasSelectedBuildingLensFacets({ groups: [extensionGroup], hasSelection: true }), true);
    assert.equal(facetOptionMarker(extensionGroup.options[0].selected), "✓");
    assert.deepEqual(toggleBuildingLensFacetCommand(extensionGroup.id, extensionGroup.options[0].id), {
      method: "ToggleBuildingLensFacet",
      args: ["extension", "HospitalWing01"],
    });
  });

  it("does not invent an extension filter when indexed metadata is empty", () => {
    const emptyExtensionGroup = { id: "extension", label: "Extensions", options: [] };

    assert.equal(hasSelectedBuildingLensFacets({ groups: [emptyExtensionGroup], hasSelection: false }), false);
    assert.equal(hasScrollableFacetGroups([emptyExtensionGroup]), false);
  });

  it("reports selected facet options without treating available options as active", () => {
    assert.equal(
      hasSelectedBuildingLensFacets({
        groups: [
          {
            id: "buildingType",
            label: "Role",
            options: [{ id: "School", label: "School", selected: false }],
          },
          {
            id: "placement",
            label: "Placement",
            options: [{ id: "RequireRoad", label: "Require road", selected: true }],
          },
        ],
        hasSelection: false,
      }),
      true
    );
  });

  it("exposes a deterministic selected marker and scroll affordance threshold", () => {
    assert.equal(facetOptionMarker(true), "✓");
    assert.equal(facetOptionMarker(false), "○");

    const shortGroup = {
      id: "theme",
      label: "Theme",
      options: Array.from({ length: 8 }, (_, index) => ({ id: `${index}`, label: `${index}`, selected: false })),
    };
    const longGroup = {
      id: "dlc",
      label: "DLC",
      options: Array.from({ length: 9 }, (_, index) => ({ id: `${index}`, label: `${index}`, selected: false })),
    };

    assert.equal(facetGroupNeedsScroll(shortGroup), false);
    assert.equal(facetGroupNeedsScroll(longGroup), true);
    assert.equal(hasScrollableFacetGroups([shortGroup, longGroup]), true);
    assert.equal(hasScrollableFacetGroups([shortGroup]), false);
  });
});

describe("Building Lens action affordances", () => {
  it("keeps Place and compare actions explicitly labeled in catalog rows", () => {
    assert.match(buildingCatalogSource, /className=\{styles\.placeHint\}/);
    // The row itself now opens details; Place is its own button, so the row's
    // label describes inspection and the Place label sits on the Place control.
    // rowInspectLabel rather than inspectLabel: it names the building too
    // ("Details: Small Medical Clinic"), which a row of otherwise identical
    // "Details" controls needs. It also replaced the title= that used to carry
    // that text, because the row now shows the shared hover card and two
    // tooltips on one control is one too many.
    assert.match(buildingCatalogSource, /aria-label=\{rowInspectLabel\}/);
    // Place still names the building, and now also says when it cannot place
    // it: a locked row disables the button, so the label has to explain the
    // refusal rather than leave a dead control with a normal name.
    assert.match(buildingCatalogSource, /aria-label=\{isEntryLocked\(entry\) \? `\$\{rowPlaceLabel\}/);
    assert.match(buildingCatalogSource, /title=\{isEntryLocked\(entry\) \? lockedLabel : rowPlaceLabel\}/);
    assert.match(buildingCatalogSource, /disabled=\{isEntryLocked\(entry\)\}/);
    assert.match(buildingCatalogSource, /aria-label=\{compareLabel\}/);
    assert.match(buildingCatalogSource, /aria-label=\{comparePlaceLabel\}/);
    assert.match(buildingCatalogSource, /aria-label=\{compareRemoveLabel\}/);
  });

  it("separates inspecting a building from committing to placing it", () => {
    // The whole row used to be a Place button, and placement closes the panel,
    // so there was no way to look without committing.
    assert.match(buildingCatalogSource, /onSelect=\{\(\) => toggleExpanded\(entry\.id\)\}/);
    assert.match(buildingCatalogSource, /className=\{styles\.rowPlaceButton\}/);
    assert.match(buildingCatalogSource, /onSelect=\{\(\) => activate\(entry\)\}/);
  });

  it("renders the projected analytical metrics when a row is expanded", () => {
    assert.match(buildingCatalogSource, /getBuildingDetailMetrics\(entry\b/);
    assert.match(buildingCatalogStyles, /\.rowDetails/);
  });

  it("makes the row Place hint visible for hover and keyboard focus", () => {
    assert.match(buildingCatalogStyles, /\.placeHint/);
    assert.match(buildingCatalogStyles, /\.rowSelect:hover[^\{]*\.placeHint/);
    assert.match(buildingCatalogStyles, /\.rowSelect:focus[^\{]*\.placeHint/);
  });

  it("provides explicit labels for TopBar lens and section icon actions", () => {
    assert.match(topBarSource, /styles\.accessibleLabel/);
    assert.match(topBarSource, /Enable building lens/);
    assert.match(topBarSource, /\{element\.toolTip\}/);
  });

  it("has no page controls left to label", () => {
    // The pager is gone: five glyph buttons and "Rows 1-100 of 3677 - Page 1 of
    // 37", below the scroll, in table view only. "Page 19" is not a fact anyone
    // can act on, and the far end of a 43-page catalog was 42 clicks away.
    for (const label of ["firstPageLabel", "previousPageLabel", "nextPageLabel", "lastPageLabel"]) {
      assert.doesNotMatch(buildingCatalogSource, new RegExp(label));
    }

    assert.doesNotMatch(buildingCatalogSource, /setPage\(/);
    assert.doesNotMatch(buildingCatalogSource, /styles\.paging/);
  });

  it("ends the feed with a load-more inside the scroll, in every view mode", () => {
    // Inside, because below the scroll is exactly where the pager was and the
    // reason nobody read it. Every mode, because grid, list and cards had no
    // paging control at all and could only ever see the first hundred rows.
    assert.match(buildingCatalogSource, /const catalogFooter = hasMore \?/);
    assert.match(buildingCatalogSource, /\{catalogFooter\}/);
    assert.match(buildingCatalogSource, /footer=\{catalogFooter\}/);
  });

  it("keeps the count where it can be read without scrolling", () => {
    // It used to live in the pager, below the scroll, so learning how many
    // results there were meant travelling to the end of them.
    assert.match(buildingCatalogSource, /className=\{styles\.toolbar\}[\s\S]*windowSummary/);
  });
});

describe("Building Lens chrome budget", () => {
  it("carries identity and sort in one toolbar rather than stacked bands", () => {
    // Measured live: chrome took 334px of a 625px panel and left the rows 159px
    // (25%). The title band and the sort band were two full-width rows carrying
    // one short line each.
    assert.match(buildingCatalogSource, /className=\{styles\.toolbar\}/);
    assert.doesNotMatch(buildingCatalogSource, /className=\{styles\.heading\}/);
    assert.doesNotMatch(buildingCatalogSource, /className=\{styles\.sortBar\}/);
  });

  it("spends a line on search context only while a search is active", () => {
    // "Buildings from the FindIt index" is a static caption that cost a whole
    // row on every frame; the search variant is the only informative case.
    assert.match(buildingCatalogSource, /searchContext/);
  });

  it("keeps the sort options as a wrapped row under the toolbar", () => {
    assert.match(buildingCatalogSource, /data-sort-options="expanded"/);
  });
});

describe("Vanilla menu interception", () => {
  it("reads an entity index from every shape the toolbar binding uses", async () => {
    const { toolbarEntityIndex } = await import("../src/domain/vanillaMenuWatch.ts");

    // The toolbar binding hands back a bare number in some places and an
    // {index, version} ref in others; ToolbarEntity allows both plus a string.
    assert.equal(toolbarEntityIndex({ index: 42, version: 1 }), 42);
    assert.equal(toolbarEntityIndex(42), 42);
    assert.equal(toolbarEntityIndex("42"), 42);
  });

  it("treats a missing or null selection as no menu rather than entity 0", async () => {
    const { toolbarEntityIndex } = await import("../src/domain/vanillaMenuWatch.ts");

    // Entity.Null is index 0, and firing the trigger for it would reopen the
    // lens every time the player closes a menu.
    assert.equal(toolbarEntityIndex(null), null);
    assert.equal(toolbarEntityIndex(undefined), null);
    assert.equal(toolbarEntityIndex({ index: 0 }), null);
    assert.equal(toolbarEntityIndex("not-a-number"), null);
  });

  it("builds the trigger payload the backend expects", async () => {
    const { vanillaMenuSelectedCommand } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.deepEqual(vanillaMenuSelectedCommand(42), {
      method: "VanillaMenuSelected",
      args: [42],
    });
  });
});

describe("Vanilla menu watcher lifecycle", () => {
  it("ignores the first selection it observes after mounting", async () => {
    const { shouldRouteSelection } = await import("../src/domain/vanillaMenuWatch.ts");

    // The binding emits current state on subscribe. That is not the player
    // clicking anything, and acting on it closed the lens panel the moment it
    // was opened over a stale non-building selection.
    assert.equal(shouldRouteSelection({ seen: false, last: null }, 17102), false);
  });

  it("routes a genuine change after the first observation", async () => {
    const { shouldRouteSelection } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldRouteSelection({ seen: true, last: null }, 17102), true);
    assert.equal(shouldRouteSelection({ seen: true, last: 17106 }, 17102), true);
  });

  it("ignores a repeat of the selection already routed", async () => {
    const { shouldRouteSelection } = await import("../src/domain/vanillaMenuWatch.ts");

    // The binding re-emits on unrelated toolbar churn.
    assert.equal(shouldRouteSelection({ seen: true, last: 17102 }, 17102), false);
  });

  it("treats closing a menu as something to remember, not to route", async () => {
    const { shouldRouteSelection } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(shouldRouteSelection({ seen: true, last: 17102 }, null), false);
  });

  it("reads a dropped selection as a close once a menu has been opened", async () => {
    const { watchAction } = await import("../src/domain/vanillaMenuWatch.ts");

    // Clicking the open menu's icon deselects it: the vanilla button fires
    // toolbar.clearAssetSelection and the binding goes to Entity.Null. Before
    // this, that arrived as "nothing to do" and the panel stayed up.
    assert.equal(watchAction({ seen: true, last: 17102 }, null), "close");
  });

  it("does not close on the null the binding emits before anything is open", async () => {
    const { watchAction } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.equal(watchAction({ seen: false, last: null }, null), "ignore");
    assert.equal(watchAction({ seen: true, last: null }, null), "ignore");
  });

  it("forgets the menu after a close, so the same icon reopens it", async () => {
    const { nextWatchState, watchAction } = await import("../src/domain/vanillaMenuWatch.ts");

    const opened = nextWatchState({ seen: true, last: null }, 17102, "open");
    assert.deepEqual(opened, { seen: true, last: 17102 });

    const closed = nextWatchState(opened, null, "close");
    assert.deepEqual(closed, { seen: true, last: null });

    // Without the reset this would read as a repeat and the icon would go dead.
    assert.equal(watchAction(closed, 17102), "open");
  });

  it("keeps what it knew when an observation says nothing", async () => {
    const { nextWatchState } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.deepEqual(nextWatchState({ seen: true, last: 17102 }, 17102, "ignore"), {
      seen: true,
      last: 17102,
    });
  });

  it("names the close trigger the backend registers", async () => {
    const { vanillaMenuDeselectedCommand } = await import("../src/domain/vanillaMenuWatch.ts");

    assert.deepEqual(vanillaMenuDeselectedCommand(), {
      method: "VanillaMenuDeselected",
      args: [],
    });
  });
});

describe("Out-of-scope search", () => {
  it("offers to widen only when the miss is local", async () => {
    const { getSearchScopeNotice } = await import("../src/domain/buildingSearchRank.ts");

    // "0 results" reads as "this does not exist" when it usually means "not in
    // this category". Only worth saying when there is somewhere else to look.
    assert.deepEqual(getSearchScopeNotice({ searchText: "clinic", shown: 0, elsewhere: 7 }), {
      elsewhere: 7,
      canWiden: true,
    });
  });

  it("stays silent when the catalog genuinely has nothing", async () => {
    const { getSearchScopeNotice } = await import("../src/domain/buildingSearchRank.ts");

    assert.equal(getSearchScopeNotice({ searchText: "zzzz", shown: 0, elsewhere: 0 }), null);
  });

  it("stays silent while results are showing", async () => {
    const { getSearchScopeNotice } = await import("../src/domain/buildingSearchRank.ts");

    assert.equal(getSearchScopeNotice({ searchText: "clinic", shown: 7, elsewhere: 0 }), null);
  });

  it("stays silent when nothing was searched for", async () => {
    const { getSearchScopeNotice } = await import("../src/domain/buildingSearchRank.ts");

    assert.equal(getSearchScopeNotice({ searchText: "", shown: 0, elsewhere: 4 }), null);
    assert.equal(getSearchScopeNotice({ searchText: "  ", shown: 0, elsewhere: 4 }), null);
  });
});
