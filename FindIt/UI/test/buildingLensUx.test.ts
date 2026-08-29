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
const buildingMenuHeaderSource = readFileSync(
  new URL("../src/mods/BuildingMenu/BuildingMenuHeader.tsx", import.meta.url),
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
  it("makes the row itself the Place control", () => {
    // cm-auzd. Grid, List and Cards all arm the tool when a result is clicked;
    // only the table opened details instead, so the same gesture on the same
    // object did two different things depending on the view. The row is the
    // Place control now and the other three are unchanged.
    assert.match(buildingCatalogSource, /className=\{styles\.rowSelect\}[\s\S]{0,900}?onSelect=\{\(\) => activate\(entry\)\}/);

    // The refusal is named rather than left to a dead control: locked is not
    // the only one — an already-built unique is the other, which is why this
    // goes through entryStateWord rather than isEntryLocked.
    assert.match(buildingCatalogSource, /aria-label=\{\s*entryStateWord\(entry, lockedLabel, builtLabel\)/);
  });

  it("does not disable an unplaceable row, because that would take its hover card too", () => {
    // The old Place BUTTON was disabled when the entry could not be placed,
    // which was right for a small control. The row is not a small control: it
    // carries the hover card, and the hover card is where a locked building
    // says what it is waiting for. Disabling it would hide the explanation
    // exactly when it is needed, so activate() refuses and the label says so.
    assert.doesNotMatch(
      buildingCatalogSource,
      /className=\{styles\.rowSelect\}[\s\S]{0,900}?disabled=/,
      "the row must stay enabled so its hover card survives",
    );
    assert.match(buildingCatalogSource, /data-refused=\{canPlace\(entry\) \? undefined : "true"\}/);
  });

  it("gives expanding a row its own control", () => {
    // A dedicated button rather than the whole row, so the row is free to mean
    // one thing. The chevron also says which way it will go.
    assert.match(buildingCatalogSource, /className=\{classNames\(styles\.rowDetailsButton/);
    assert.match(buildingCatalogSource, /styles\.rowDetailsButton[\s\S]{0,400}?onSelect=\{\(\) => toggleExpanded\(entry\.id\)\}/);
    assert.match(buildingCatalogStyles, /\.rowDetailsButton\b/);
  });

  it("keeps the trailing reserve and the name budget agreeing", () => {
    // buildingCatalog.module.scss is the authority for what a row reserves to
    // the right of its name, and buildingLensLayout mirrors it so the name can
    // be elided to fit. They drifted once already; a control removed from one
    // and not the other silently mis-sizes every name in the table.
    assert.match(buildingCatalogStyles, /\$table-trailing-reserve: \$row-padding-right \+ \$row-details-width \+ \$row-outer-padding-right;/);
    assert.match(buildingCatalogStyles, /\$row-details-width: 26rem;/);
    assert.doesNotMatch(buildingCatalogStyles, /\$row-place-width/, "Place is the row now; its reserve is gone");
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

  it("provides explicit labels for the header's icon actions", () => {
    // The RULE is what this guards, and it has outlived three implementations.
    // It was asserted against TopBar until step 4 deleted that component; the
    // header the lens owns carries the same controls and labels them BETTER —
    // aria-label on the Button plus a Tooltip, rather than TopBar's
    // visually-hidden span — so the assertion follows the rule to where the
    // controls now live rather than retiring with the file.
    //
    // Two assertions left this list earlier, both because what they guarded was
    // gone rather than because the rule relaxed: "Enable building lens"
    // labelled a toggle whose trigger no longer exists, and `{element.toolTip}`
    // labelled the legacy scope and type strips.
    //
    // Every icon-only control names itself for anything that is not looking at
    // it, and its decorative image says it is decorative.
    for (const control of ["ClearSearch", "CloseMenu"]) {
      assert.match(
        buildingMenuHeaderSource,
        new RegExp(`aria-label=\\{localizedLabel\\("Tooltip.LABEL\\[FindItBuildingMenu.${control}\\]`),
        `${control} has no aria-label`
      );
    }

    assert.match(buildingMenuHeaderSource, /alt=""\s+aria-hidden="true"/);
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

const surfaceStylesFor = () =>
  readFileSync(new URL("../src/mods/BuildingMenu/buildingMenuSurface.module.scss", import.meta.url), "utf8");
const surfaceSourceFor = () =>
  readFileSync(new URL("../src/mods/BuildingMenu/BuildingMenuSurface.tsx", import.meta.url), "utf8");

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

  // The window lock's "draw it as a mask, not a glyph" test was deleted here,
  // not moved. There is no lock control left to draw: it lived in TopBar, which
  // step 4 deleted, and pinning a menu open is meaningless for a surface the
  // game mounts and unmounts on its own menu lifecycle. The glyph lesson
  // survives in the caret's U+25BC comment, which is still live.

  it("gives the Zones menu the same controls as every other menu", () => {
    // This used to assert that the height control sat OUTSIDE a `!showZoning`
    // fragment, because group, sort and view were hidden for the zoning tree —
    // "the hierarchy has no rows to order".
    //
    // Zones are rows now. They come through the same catalog query as every
    // other menu, so there is no zoning branch left to except: no showZoning,
    // and no `omit` dropping Table from the view modes.
    assert.doesNotMatch(lensControlPaneSource, /showZoning/);
    assert.doesNotMatch(lensControlPaneSource, /omit=\{/);
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
    const strip = surfaceStylesFor().match(/\.resizeHandle\s*\{[^}]*\}/)?.[0] ?? "";
    const grip = surfaceStylesFor().match(/\.resizeGrip\s*\{[^}]*\}/)?.[0] ?? "";

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
    // Reclaiming that 253px means reaching into an element vanilla owns and
    // stopping it centring its trio.
    //
    // MainContainer did this too, from an AlignmentStyle binding, and step 4
    // deleted it. The surface had already been doing it for itself, so the
    // behaviour did not move — the DUPLICATE went. What changed is that the
    // condition went with the binding: a floating panel could be anywhere, so
    // it needed a setting; a menu is where the menu is, so flex-start is
    // unconditional.
    assert.match(surfaceSourceFor(), /layout\.style\.justifyContent = "flex-start"/);
    assert.doesNotMatch(surfaceSourceFor(), /AlignmentStyle/);
  });

  it("puts vanilla's layout back when the lens is switched off", () => {
    // The effect reaches across into an element vanilla owns, so the exit path
    // matters as much as the entry: leaving flex-start behind would re-lay
    // every other tool's options for the rest of the session.
    assert.match(surfaceSourceFor(), /const previous = layout\.style\.justifyContent/);
    // Both arms matter. Restoring "" makes Cohtml log "invalid value" and keep
    // OUR flex-start, so the empty case must remove the property instead; skip
    // the non-empty case and a genuine inline value never comes back.
    assert.match(surfaceSourceFor(), /layout\.style\.justifyContent = previous;/);
    assert.match(surfaceSourceFor(), /layout\.style\.removeProperty\("justify-content"\)/);
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
    const headerStyles = readFileSync(
      new URL("../src/mods/BuildingMenu/buildingMenuHeader.module.scss", import.meta.url),
      "utf8"
    );
    const row = headerStyles.match(/\.catalogStripRow\s*\{[^}]*\}/)?.[0] ?? "";
    const tabs = headerStyles.match(/\.catalogStripTabs\s*\{[^}]*\}/)?.[0] ?? "";

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
