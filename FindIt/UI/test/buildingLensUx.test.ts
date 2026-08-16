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
const lensControlPaneSource = readFileSync(
  new URL("../src/mods/LensControlPane/LensControlPane.tsx", import.meta.url),
  "utf8"
);
const lensControlPaneStyles = readFileSync(
  new URL("../src/mods/LensControlPane/lensControlPane.module.scss", import.meta.url),
  "utf8"
);
const buildingCatalogStyles = readFileSync(
  new URL("../src/mods/BuildingCatalog/buildingCatalog.module.scss", import.meta.url),
  "utf8"
);
const topBarSource = readFileSync(new URL("../src/mods/TopBar/TopBar.tsx", import.meta.url), "utf8");
const topBarStyles = readFileSync(
  new URL("../src/mods/TopBar/topBar.module.scss", import.meta.url),
  "utf8"
);

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

  it("does not carry a standing result count", () => {
    // Master's window badge, "100 / 401 buildings". It came here when the
    // toolbar band that held it was deleted, and it is now gone entirely: the
    // grouping headings each carry their own count, the load-more button says
    // when there is more to come, and a figure at the head of the column was a
    // line spent on a number nothing was asking.
    //
    // This asserts the removal on purpose. Master still renders the badge in
    // its own band, so a future merge will bring it back and this is what will
    // notice. getCatalogWindowBadge itself stays — it is master's, still
    // tested in buildingCatalogContracts, and only this branch declines to use
    // it.
    assert.doesNotMatch(lensControlPaneSource, /getCatalogWindowBadge/);
    assert.doesNotMatch(lensControlPaneSource, /windowSummary/);
  });

  it("still says what a search is for, where the search box is not", () => {
    // The one caption that is not restating something already in view: the
    // field is in the panel and this is the far side of the screen.
    assert.match(lensControlPaneSource, /searchContext/);
    assert.match(lensControlPaneSource, /BuildingLensSearchResults/);
  });
});

const mainContainerStylesFor = () =>
  readFileSync(new URL("../src/mods/MainContainer/mainContainer.module.scss", import.meta.url), "utf8");

describe("Building Lens chrome budget", () => {
  it("keeps no control chrome in the panel at all", () => {
    // The history this guards: chrome once took 334px of a 625px panel and
    // left the rows 159px, first as two stacked bands and then as one toolbar.
    // The toolbar was gated on `expanded`, which meant every control it held
    // was missing at exactly the strip height the lens rests at. All of it
    // lives in the control plane beside the panel now, so the panel carries
    // results and nothing else.
    for (const gone of [/className=\{styles\.toolbar\}/, /className=\{styles\.heading\}/, /className=\{styles\.sortBar\}/, /data-sort-options="expanded"/]) {
      assert.doesNotMatch(buildingCatalogSource, gone);
    }
  });

  it("carries grouping, sorting and view mode in the control plane", () => {
    // Each of these was unreachable at rest before the pane existed. The count
    // was in this list and has since been dropped outright — see
    // "does not carry a standing result count".
    assert.match(lensControlPaneSource, /GroupBy/);
    assert.match(lensControlPaneSource, /SortBy/);
    assert.match(lensControlPaneSource, /ViewModeBar/);
  });

  it("draws no panel-level controls of its own", () => {
    // This used to assert the opposite — that the pane kept a window lock, a
    // close and a way out of the lens — on the reasoning that each had nowhere
    // else to live. Each turned out to be wrong in its own way, so the whole
    // row went.
    //
    // ToggleLock could not act from here. `_IsWindowLocked` is read in exactly
    // two places and both are about the LEGACY panel, which
    // `(_ShowFindItPanel || _IsWindowLocked) && !_BuildingLensEnabled` hides
    // for as long as the lens is up.
    //
    // SetBuildingLensEnabled(false) did not survive the next click: the
    // toolbar-menu handler sets the flag back to true for every menu it
    // resolves (Bindings.cs:161), and since cm-e98i every menu resolves. The
    // "one-way door" this test was written to prevent could not happen.
    //
    // And the close had no counterpart in vanilla's asset menu, which is what
    // this panel stands in for — there you press the toolbar icon again.
    assert.doesNotMatch(lensControlPaneSource, /"ToggleLock"/);
    assert.doesNotMatch(lensControlPaneSource, /"SetBuildingLensEnabled"/);
    assert.doesNotMatch(lensControlPaneSource, /onCloseMenu/);
    assert.doesNotMatch(lensControlPaneSource, /SetIsExpanded/);
  });

  it("draws the lock as a mask, not a glyph", () => {
    // The font stack has no padlock; a missing character is the one mark that
    // says nothing. Same reasoning as the caret using U+25BC over U+25BE.
    //
    // Asserted against the top bar now. The lens pane drew this too until its
    // control row was deleted; the top bar is where the window lock still has
    // a control, and the lesson is about the glyph, not about which surface.
    assert.match(topBarSource, /mask=\{!IsWindowLocked \? unlock : lock\}/);
  });

  it("puts the height control where the zoning view can reach it as well", () => {
    // Group, sort and view sit inside `!showZoning` because the hierarchy has
    // no rows to order. Height is not about rows, and a zoning tree is exactly
    // the thing you want more than two rows of.
    // Bounded by the fragment the conditional wraps, not by the height row —
    // the prose above that row names SetIsExpanded, and a slice ending there
    // would fail on the explanation rather than on the code.
    const start = lensControlPaneSource.indexOf("!showZoning");
    const end = lensControlPaneSource.indexOf("</>", start);
    assert.ok(start >= 0 && end > start, "expected a !showZoning fragment to bound");
    assert.doesNotMatch(lensControlPaneSource.slice(start, end), /heightToggle/);
  });

  it("still names the search the count is counting", () => {
    // "Buildings from the FindIt index" was a static caption costing a row on
    // every frame; the search variant is the informative case, and it moved
    // with the count rather than being dropped with the toolbar around it.
    assert.match(lensControlPaneSource, /searchContext/);
  });

  it("obeys the chosen view mode at every panel height", () => {
    // Reported as "switching view mode does not work", and it did not: the
    // catalog overrode the choice to "grid" whenever the panel was not
    // expanded, which is the resting default. Pressing List, Cards or Table
    // lit the button in the control plane, left the grid on screen, and gave
    // no reason — measured live, all four modes selected correctly in the pane
    // while the catalog kept rendering tiles.
    //
    // The override was there to spare a player a table clipped to a sliver.
    // That is the player's call to make, not ours to make silently.
    assert.doesNotMatch(buildingCatalogSource, /expanded \? viewMode/);
    assert.doesNotMatch(buildingCatalogSource, /effectiveViewMode/);
  });

  it("gives the height drag a target worth aiming at", () => {
    // The only way to change the height now that the Expand toggle is gone, so
    // it has to be both findable and hittable. Measured at 40x5px on the first
    // attempt: a 5px-tall grab target, at 25% white on a dark panel.
    //
    // The strip is the target and the grip is the mark, which is why they are
    // two elements — a bar sized to be easy to hit would be a bar too heavy to
    // sit on the panel edge.
    const strip = mainContainerStylesFor().match(/\.resizeHandle\s*\{[^}]*\}/)?.[0] ?? "";
    const grip = mainContainerStylesFor().match(/\.resizeGrip\s*\{[^}]*\}/)?.[0] ?? "";

    assert.match(strip, /cursor:\s*ns-resize/);
    // NOT absolute. As an overlay on the panel edge it was invisible and
    // unclickable — measured with elementFromPoint at the grip's own centre,
    // the hit went to a subcategory tab, because the tab strip paints over it
    // whatever z-index it carries. In the flow above the strip it cannot be
    // occluded by it.
    assert.doesNotMatch(strip, /position:\s*absolute/);
    // Taller than the mark it draws, so the edge is grabbable without aiming.
    assert.match(strip, /height:\s*14rem/);
    // A short bar on the edge. Anything wider is a border between two regions.
    // 8rem, because 1rem is 0.6667px: a 5px grip is 8rem, and 5rem draws 3px.
    // Written as 5rem the first time — the fourth px/rem slip on this branch.
    assert.match(grip, /height:\s*8rem/);
    assert.match(grip, /width:\s*75rem/);
  });

  it("left-aligns both layouts together, or not at all", () => {
    // The build menu's left edge is vanilla's tool-main-column, centred by
    // tool-layout along with a side column each side (253 + 475 + 253 in
    // 1267), which is what put the options box at x=145 and the menu at x=403.
    // Reclaiming that 253px needs BOTH halves: MainContainer stops vanilla
    // centring its trio, and our own mirror of that layout stops centring too.
    //
    // Either alone is a visible defect. Vanilla's alone moves the options box
    // to the screen edge and leaves the menu at 403 with a 143px hole beside
    // it; ours alone slides the menu left underneath the options box.
    const mainContainerSource = readFileSync(
      new URL("../src/mods/MainContainer/MainContainer.tsx", import.meta.url),
      "utf8"
    );
    const mainContainerStyles = readFileSync(
      new URL("../src/mods/MainContainer/mainContainer.module.scss", import.meta.url),
      "utf8"
    );

    assert.match(mainContainerSource, /justifyContent\s*=\s*BuildingLensEnabled/);
    assert.match(mainContainerSource, /styles\.lensLeftAligned/);

    const rule = mainContainerStyles.match(/\.lensLeftAligned\.toolLayout\s*\{[^}]*\}/)?.[0] ?? "";
    assert.match(rule, /justify-content:\s*flex-start/);
    // The options column's own width, so the menu lands beside it rather than
    // on it. Same measurement the control plane matches on the other side.
    assert.match(rule, /padding-left:\s*379rem/);
  });

  it("puts vanilla's layout back when the lens is switched off", () => {
    // The effect reaches across into an element vanilla owns, so the exit path
    // matters as much as the entry: leaving flex-start behind would re-lay
    // every other tool's options for the rest of the session.
    const mainContainerSource = readFileSync(
      new URL("../src/mods/MainContainer/MainContainer.tsx", import.meta.url),
      "utf8"
    );

    assert.match(mainContainerSource, /const previous = layout\.style\.justifyContent/);
    assert.match(mainContainerSource, /return \(\) => \{\s*layout\.style\.justifyContent = previous;/);
  });

  it("lets the catalog strip grow rather than slicing a wrapped row of tabs", () => {
    // Measured on Roads & Networks at the narrowed panel width: 20 subcategory
    // tabs, which do not fit the 424px left beside the search field, so the
    // strip wraps. With the row pinned to height: 45rem and overflow: hidden,
    // the second line was cut through the middle — tops at y=89 and y=110, the
    // row ending at y=126 while the lower icons ran to y=132.
    //
    // The fix must not be to stop the wrap: that draws cleanly and silently
    // costs the player five categories. So the row sizes to its content, and
    // the tab container does not clip.
    const row = topBarStyles.match(/\.catalogStripRow\s*\{[^}]*\}/)?.[0] ?? "";
    const tabs = topBarStyles.match(/\.catalogStripTabs\s*\{[^}]*\}/)?.[0] ?? "";

    assert.match(row, /min-height:/);
    assert.doesNotMatch(row, /^\s*height:/m);
    assert.doesNotMatch(row, /overflow:\s*hidden/);
    assert.doesNotMatch(tabs, /overflow:\s*hidden/);
  });

  it("carries the filters and their chips, and injects them nowhere else", () => {
    // They were rendered into the game's own options bank, beside vanilla's
    // Theme, on the argument that filters belong where the game puts filters.
    // Left-aligning vanilla's column trio moved that bank to the screen edge,
    // a full panel's width from the results it narrows, so they came here.
    //
    // Rendering in both places at once is the failure mode this guards: the
    // extension has to be gone, not merely unused.
    assert.match(lensControlPaneSource, /<FilterRail/);
    assert.match(lensControlPaneSource, /buildFilterChips/);

    const registrations = readFileSync(new URL("../src/index.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(registrations, /LensToolOptionsExtend/);
  });

  it("matches the vanilla options bank it sits opposite", () => {
    // Read off the live tool-options bank rather than eyeballed: rows are
    // padding 4rem 12rem with no min-height, and labels are bold 16rem. Ours
    // had drifted on all three, which is visible the moment both banks are on
    // screen together — and they always are.
    const row = lensControlPaneStyles.match(/\.row\s*\{[^}]*\}/)?.[0] ?? "";
    const label = lensControlPaneStyles.match(/\.rowLabel\s*\{[^}]*\}/)?.[0] ?? "";

    assert.match(row, /padding:\s*4rem 12rem/);
    assert.match(label, /font-weight:\s*bold/);
    assert.match(label, /font-size:\s*16rem/);
  });

  it("lets the pane's text buttons size to their text", () => {
    // The icon variant pins a square width, so any control here carrying text
    // has to override it. Measured live when one did not: a button 16px wide
    // around 33px of text, drawing "Shrink Panel" as "S…l".
    //
    // .heightToggle was the third of these and is gone with the Expand control
    // it operated; .clearAll came in with the filter chips and needs the same
    // override for the same reason. .panelButton was the fourth and went with
    // the panel-level control row — see "draws no panel-level controls of its
    // own"; the rule it needed went with it rather than being left behind as a
    // style for nothing.
    for (const rule of [
      /\.pickerSummary\s*\{[^}]*width:\s*auto\s*!important/,
      /\.clearAll\s*\{[^}]*width:\s*auto\s*!important/,
    ]) {
      assert.match(lensControlPaneStyles, rule);
    }
  });

  it("opens the pane's menus upward, away from the bottom bar", () => {
    // The pane is bottom-aligned against the bottom bar, so a menu growing
    // downward opens off the screen.
    assert.match(lensControlPaneStyles, /\.pickerOptions\s*\{[^}]*bottom:/);
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
