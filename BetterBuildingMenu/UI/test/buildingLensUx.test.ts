import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearBuildingLensFacetsCommand,
  facetGroupNeedsScroll,
  facetOptionMarker,
  hasScrollableFacetGroups,
  hasSelectedBuildingLensFacets,
  toggleBuildingLensFacetCommand,
} from "../src/domain/buildingCatalogFacets.ts";
import { getFilterOptionState } from "../src/domain/filterContracts.ts";

describe("Building Lens filter controls", () => {
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
    // clicking anything, and acting on it closes the lens panel the moment it
    // opens over a stale non-building selection.
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
    // toolbar.clearAssetSelection and the binding goes to Entity.Null. Read as
    // "nothing to do", that leaves the panel up.
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

  it("takes over the menu already open when the setting is switched on", async () => {
    const { watchAction, watchStateWhileOff } = await import("../src/domain/vanillaMenuWatch.ts");

    // Switching the option on mid-session with Education open: without this the
    // vanilla grid stays up until the player clicks another menu.
    assert.equal(watchAction(watchStateWhileOff(), 17102), "open");
    // And nothing to close when no menu is open.
    assert.equal(watchAction(watchStateWhileOff(), null), "ignore");
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
