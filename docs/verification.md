# FindIt Building Menu Successor — Verification

This fork is an internal successor, not a publishable release. Its runtime
identity is `FindItBuildingMenu`; distribution remains gated on upstream
license confirmation and assignment of a new PDX publisher identity.

## Local build commands

Run these from `cs2-findit-building-menu/`:

```bash
./build.sh backend
./build.sh ui
./build.sh test
./build.sh package

# browserless successor UI contracts
(cd FindIt/UI && npm test)
```

`./build.sh all` runs the backend and UI builds. Packaging writes only to
`artifacts/FindItBuildingMenu/`; it does not touch either game Mods directory.
The optional deploy action requires an explicit `CSII_SUCCESSOR_MODS_DIR` and
refuses to overwrite an existing target:

```bash
CSII_SUCCESSOR_MODS_DIR=/path/to/empty/isolated/Mods ./build.sh deploy
```

Do not point this at a directory containing the original `FindIt` payload.

For a game smoke test, use `just deploy-isolated findit-building-menu`. The
recipe isolates both game `Mods` roots and also checks the Proton cache/local
root listed by `mod_directory.json`. It relocates only known workspace mod
folders (including `BootDiagnostics`, the upstream `FindIt`, and their
`.disabled` variants) into the sibling
`.cache/Mods/.codex-isolated-backup/<timestamp>/` directory. Unknown user mod
folders are left untouched, and the backup is reversible; no known non-kept
`.mjs` bundle remains under the cache scanner root after the deploy.

`./build.sh test` runs the net10 xUnit project at
`FindItBuildingMenu.Tests/` with `SkipBuildUI=true`; it does not launch the
game. `FindIt/UI/npm test` runs the browserless Node contract suite with the
Gameface engine bridge represented as typed trigger payloads; it covers
placement, locate, picker, search/category bindings, sort direction, bounded
compare state, and page-offset normalization. The current pure catalog suite
covers search, categories, analytical ranges, nullable sorting, paging,
bounded limits, empty sources, null inputs, and the native `IJsonWriter`
property shape.

Latest local result: backend build, UI webpack build, 23 backend catalog/icon/filter tests, 17 UI
contract/layout tests, package identity guard, isolated deployment to both game Mods
roots, and packaging all passed. The backend also avoids Unity `SystemAPI` calls that
require the user-scoped source-generator/postprocessor toolchain; explicit
`EntityQuery` and system-handle APIs keep the successor self-contained. The
inherited category accessors also return empty collections while the
asynchronous index is not ready, so opening the lens during startup cannot
throw on a missing `Any` category.

The category-scoped Education & Research capacity-floor slice is covered by the
22 backend catalog/icon tests and 6 browserless UI contract tests. Its presets are
bounded to `Any`, `100+`, `500+`, and `1000+`; the C# binding clears the floor
when the active subcategory leaves Education & Research.

The live Gameface assertion passed on 2026-07-27 in the developed save
`Codex Preview Smoke 20260726` after deploying the isolated successor. Opening
the Building Lens in Service Buildings → Education & Research exposed the
capacity presets; selecting `500+` reduced the bounded catalog from 44 to 24
entries and every visible analytics row had capacity ≥ 500. Switching to
Electricity hid the education-only control, and returning to Education &
Research reset the selected preset to `Any` and restored 44 entries. Evidence
is archived in
`tools/e2e/artifacts/e2e-20260727-findit-education-capacity-live/` (manifest,
observations, and two screenshots).

## Building Lens facet contract verification (2026-08-01)

The typed facet slice is locally verified and has a live Gameface assertion.
The backend suite passes 28/28 tests and covers
case-insensitive OR-within-facet matching, AND-across-facet matching,
missing-value exclusion, stable `BuildingFlags` names, bounded distinct facet
options, JSON property shape, and toggle/clear selection transitions. The UI
contract suite passes 19/19 tests and covers exact toggle/clear trigger payloads
and selected-option state reduction. `npm run build` and `./build.sh backend`
also pass; the isolated package/deploy completed to both game Mods roots. The
backend emits only the repository's existing nullable warnings.

The first facet groups are Role, Source (vanilla/custom), DLC, Theme, Asset
packs, and Placement. Their values are projected from the existing FindIt
index during `AddPrefab`; no second ECS scan or unbounded browser payload was
introduced. Runtime/map-context dimensions remain deferred. In the developed
save `Codex Preview Smoke 20260726`, the live panel exposed Source, DLC, Theme,
and Placement values (Role and Asset packs correctly omit empty indexed
values). Selecting Placement → `Back access` changed the catalog count from
4,206 to 167 and marked the option selected; Clear restored 4,206 and removed
the selected state. The bounded option columns kept the longer DLC/Placement
lists inside the drawer, and no Gameface console errors were captured.

Earlier failed retries remain useful diagnostics: the attempt
`e2e-20260727-findit-capacity-filter-base-loop` reached platform initialization
but failed in the game's AssetDatabase/GameManager loop before a menu appeared.
An alternate Steam-launched retry reached CDP and loaded the successor but
reproduced the Unity/.NET/Node Modding HEAD-request stall; it is archived in
`e2e-20260727-findit-capacity-steam-toolchain-timeout`.

The 2026-07-27 cached-token retry passed platform initialization but reproduced
the base `AssetDatabase.PopulateFromDataSource` null-reference loop before CDP
became reachable. It was stopped by PID-scoped signal after the owned lock was
released; no UI assertion is claimed. The manifest is archived at
`tools/e2e/artifacts/e2e-20260727-findit-capacity-direct-assetdb-null/manifest.json`.

Latest live parity run (2026-07-26): `just deploy-isolated findit-building-menu`
deployed `BootDiagnostics` plus `FindItBuildingMenu` to both game Mods roots.
On the developed save `Codex Preview Smoke 20260726`, the successor loaded and
registered its UI module without a mod-log exception. The building lens indexed
4,206 records; the Buildings category returned 3,820 and the Industrial
subcategory returned 496. Search for `road` returned one matching depot.

The same run verified the following through real Gameface interactions:

- parking filters returned 2,176 (`WithParking`), 1,644 (`WithoutParking`),
  and 3,820 after clearing;
- paging reached `2 / 43`, and Cost sorting reset to page 1 with ascending
  direction;
- close and reopen hid/restored the lens while preserving its state;
- three compare selections filled the bounded 3/3 tray, and `Place` exposed
  the normal `Snapping`/`Topography` placement options;
- picker activation hid the panel; selecting a result reopened/kept the panel
  and entered the normal placement tool;
- the Nature/OnlyPlaced flow returned 65 tree records, and its locator click
  kept the panel open.

The final Gameface error buffer was quiet, and
`FindItBuildingMenu.log` contained the load/index messages (19,288 total
prefabs) with no `ERROR`, `Exception`, `InvalidOperation`, `KeyNotFound`, or
`NullReference` entries. The durable compare/place manifests finished with
`exceptionCount: 0`:

- `tools/e2e/artifacts/e2e-20260726-findit-successor-final-compare-live-2/manifest.json`
- `tools/e2e/artifacts/e2e-20260726-findit-successor-final-place-live/manifest.json`

The active playset also contributed `MapPreviewMod` from the Paradox local
catalog; the two filesystem Mods roots themselves contained only the
diagnostics and successor folders.

## FindIt surface boundary checklist (manual, not run in this branch)

Verify this checklist only with an isolated `FindItBuildingMenu` successor
package and a developed save. Do not co-install the old BMO or an upstream
`FindIt` payload. The checks are:

- In the Building Lens, select a row and confirm it enters the normal FindIt
  placement flow; fill the bounded compare tray and confirm `Place` uses that
  same flow.
- Locate a placed prefab repeatedly and confirm the cursor cycles through its
  placed instances; change the prefab id and confirm the locate sequence
  resets before cycling the new id.
- Change a picker option and a normal FindIt option, confirming each option
  change reaches its corresponding surface without swapping the three integer
  arguments.
- Confirm ordinary placement and tool-options continuity after lens selection,
  compare placement, picker use, and locate; the active tool, picker, and
  placement behavior remain FindIt/system behavior.
- Disable the lens and confirm the legacy FindIt grid retains its normal
  selection, placement, locate, and option behavior.

Ownership is deliberately narrow: `FindItUtil.CategorizedPrefabs` and the
existing incremental index own catalog data; `PickerUISystem` and
`PickerToolSystem` own picker state; `FindItUISystem` delegates placement to
the game's `ToolSystem`; and its existing tracking/camera path owns locate and
`JumpTo` camera behavior. The UI `FindItSurfacePort` is only a semantic-command
translation seam. It maps `activatePrefab`, `locatePrefab`, `findItOption`, and
`pickerOption` to the existing C# bindings; it is not a second index, picker,
placement tool, camera controller, or state store.

This branch adds no live evidence. Record a future authorized run's developed
save, isolated package, and durable artifacts here before describing these
checks as passed. For rollback, stop the game, remove `FindItBuildingMenu`,
and restore the old BMO package. Never run both overlapping menu modules
together, and never leave the old package in a `.disabled` folder because the
game can still scan its UI bundle and register duplicate modules.
## Building Lens metric range verification (2026-08-01)

The metric range slice is covered by the typed backend and UI contracts before
the live smoke test:

- `FindItBuildingMenu.Tests` passes 48/48, including normalization, reversed
  bounds, invalid input, nullable-value exclusion, facet composition, and
  Education capacity-floor composition.
- `FindIt/UI/npm test` passes 41/41, including the six metric definitions,
  active-selection count, and exact set/clear trigger payloads.
- `FindIt/UI/npm run build` and `./build.sh package` pass the UI webpack and
  successor identity guard.

The isolated live run completed on the developed save `Codex Preview Smoke
20260726` at 1280×720. The following checklist passed through real Gameface
interactions:

1. Open Building Lens and confirm the collapsed `Metric filters` drawer sits
   beside the categorical `Filters` drawer.
2. Open the drawer and confirm Cost, Upkeep, Workers, Capacity, Lot Width, and
   Lot Depth each expose minimum and maximum inputs without covering the table.
3. Enter a bounded range (for example Capacity `500`–`1000`) and confirm the
   catalog count changes, every visible row satisfies the range, the active
   count becomes `1`, and the normalized values remain visible after refresh.
4. Enter reversed bounds and confirm the drawer swaps them; enter a blank bound
   and confirm that side becomes unbounded. Confirm lot dimensions round to
   integer bounds and analytical values stay at two decimal places.
5. In Service Buildings → Education & Research, select a capacity preset while
   a Capacity minimum is active. Confirm the effective floor is the greater of
   the two values; clear the preset and confirm the metric minimum remains.
6. Use `Clear` in the metric drawer and confirm all six inputs clear, the active
   count disappears, and the unfiltered catalog returns without clearing
   categorical facets.
7. Reopen the lens after closing it and confirm the metric state is still
   reflected by the binding; capture a screenshot and record the final
   Gameface error buffer and mod log.

The run reduced the unfiltered Education & Research catalog from 44 entries to
24 with Capacity `500` minimum. Reversed input `1000`–`500` normalized back to
`500`–`1000`; the `1000+` Education preset composed with the metric minimum and
returned 16 entries, all with capacity ≥ 1000. Clearing metric ranges restored
44 entries while a selected `Source → Base game` facet remained selected. The
Gameface console reported zero exceptions and `FindItBuildingMenu.log` had zero
error/exception/failure markers (its `MISSINGICON` lines are informational).
The screenshot and machine-readable observations are archived in
[`e2e-20260801-building-lens-metric-range-live/`](../../tools/e2e/artifacts/e2e-20260801-building-lens-metric-range-live/).

## Building Lens resize verification (2026-08-01)

The cached-token launch path reproduced the known pre-UI
`AssetDatabase.PopulateFromDataSource`/`GameManager` null-reference loop, so it
was stopped without a Gameface attach. A full Steam → Dowser → Paradox launch
then reached the main menu and the developed save `Codex Preview Smoke
20260726` with the freshly deployed successor DLL. The panel opened through the
normal toolbar magnifier and the Building Lens toggle.

At the current 1280×720 Gameface viewport, the center-aligned lens rendered at
533.3 CSS px for its default 800-unit outer width (765-unit persisted content
plus 35-unit FindIt chrome). The new handle and backend binding were exercised
in the live UI:

- a defined +60 px center drag grew the panel from 623.3 to 703.3 px (both
  edges move), and an extreme drag clamped to the 1,235-unit outer maximum of
  823.3 px;
- an extreme reverse drag clamped to 490.0 px, the 735-unit outer minimum;
- pointer release removed the blocker and committed the width;
- toggling the lens off and on restored the committed 1,200-unit content width,
  which was also visible in `FindItBuildingMenu.coc`;
- switching alignment through the existing FindIt option placed the same panel
  correctly at the left edge and right edge, then restored Center.

The final `FindItBuildingMenu.log` contained no error/exception/failure markers;
its remaining `MISSINGICON` entries are informational index fallbacks. The
Player.log still contains the environment's Modding toolchain HEAD-request
timeouts and the Gameface screenshot has the usual black Unity underlay, so
those are not counted as successor UI failures. The spacing/typography follow-up
below records the tested `fontSizeXS` default/expanded metric variant and the
compact `fontSizeXXS` fallback. The test preference was restored to the saved
width observed at the start of that follow-up.

## Building Lens spacing and typography verification (2026-08-01)

The spacing pass was built and deployed with the canonical isolated recipe while
the existing CS2 process (PID 910214) remained protected by the adopted
`codex-live-ui-1` lock. Quality gates completed as follows:

- `./scripts/codex-just.sh build` passed for the workspace mods (Sass emitted
  only its existing legacy-JS-API deprecation warnings).
- `./scripts/codex-just.sh e2e` passed the two E2E unit suites and all five
  lifecycle-guidance checks.
- `cs2-findit-building-menu/FindIt/UI`: `npm test` passed 13/13 and
  `npm run build` emitted the successor bundle.
- `cs2-findit-building-menu/build.sh test` passed 22/22 backend tests.
- `just deploy-isolated findit-building-menu` packaged and copied
  `FindItBuildingMenu` plus `BootDiagnostics` to both game Mods roots.

The settled live Gameface context rendered the new bundle without a restart.
At a 1280×720 viewport, the same header/row metric edges matched exactly at
all three tested outer widths; every reported edge delta was `0.00px`:

| Tier | Outer width | Catalog padding | Row/select height | Metric/header font | Header labels |
| --- | ---: | --- | ---: | --- | --- |
| Compact minimum | 735 rem (490.00px) | `6rem` | `92/88rem` | `6.66666px` (`fontSizeXXS`) | `Cost`, `Upk`, `Wkr`, `Cap`, `Lot`, `Lvl`, `Park` |
| Default boundary | 800 rem (533.33px) | `8rem` | `104/100rem` | `7.99999px` (`fontSizeXS`) | Full localized labels |
| Expanded maximum | 1235 rem (823.33px) | `8rem` | `104/100rem` | `7.99999px` (`fontSizeXS`) | Full localized labels |

At Compact, each abbreviated header retained its full localized `title`
(`Upk` → `Upkeep`, `Wkr` → `Workers`, etc.), and row values retained full
titles such as `Cost 115000`, `Lot dimensions`, and `No parking`. The first
identity name/category lines remained distinct at 12.00px and 10.67px. At the
default saved width observed before the test, the root measured 1077 rem and
was restored to that same width after the checks; no resize preference was
left at a test boundary.

The vanilla FindIt `GridWithText` label reported its existing `12rem` token,
which resolves to the same 8px-scale text as the successor's Default/Expanded
metric token. The successor identity hierarchy remains larger than that label,
while Compact intentionally trades metric size for the minimum-width row
budget. A settled screenshot is archived at
`tools/e2e/artifacts/building-lens-spacing/default-1077.png`.

The live typography probe at the restored Expanded width reported successor
title `16rem`, subtitle `16px`, metric header `7.99999px`, and metric value
`7.99999px` with a `14rem` line box; the vanilla item label reported `12rem`
with a 12px line box. This records the title/subtitle hierarchy separately
from the dense analytical columns.

After width and lens-toggle exercises, the Gameface exception buffer remained
at `0`; `FindItBuildingMenu.log` had no `ERROR`, `Exception`,
`InvalidOperation`, `KeyNotFound`, `NullReference`, or `failed` markers. The
remaining `MISSINGICON` lines are informational index fallbacks.

## Building Lens title, density, and filter verification (2026-08-01)

The title/icon spacing and filter-drawer fixes were deployed through
`just deploy-isolated findit-building-menu` while the existing CS2 process
(PID 910214) remained protected by the adopted
`codex-building-lens-filters-1` lock. The final live run is archived at
`tools/e2e/artifacts/e2e-20260801-080945-rvwp6m/`.

At the settled 1280×720 Gameface viewport, the expanded Building Lens
reported:

- title icon/text gap: `4px` (the 6-rem design gap after Gameface scaling);
- row/selector data geometry: `92/88rem`, with a measured row of `61.33px`;
- title icon: `10.67px` rendered `BuildingZoneSignature.svg` before the title;
- 100 visible catalog rows in the settled viewport.

Opening Filters produced three visible option sections and 23 toggle buttons.
The drawer measured `233.33×118.67px`, began at `y=6.33px`, and used
`position:absolute`, `overflow-y:auto`, and a `640px` max-height, so it remains
visible and bounded instead of rendering above the viewport. Clicking the
Custom Assets toggle added its selected class and enabled Clear Filters;
clicking Clear Filters removed the selected class and restored the disabled
attribute. The run ended with `exceptionCount: 0`.

A separate live result-change probe is archived at
`tools/e2e/artifacts/e2e-20260801-082358-aw5rtx/`. With the Buildings category
selected, the bounded catalog moved from `3,820` entries to `2,176` after
activating With Parking, with 100 rendered rows in both states and no
Gameface exceptions. The table adapter now applies FindIt's existing
non-search filter predicates (theme, DLC, extra filters, placement, and
building options) to the same indexed source; the typed query continues to
own search/category/range paging. Clear Filters also resets both parking
toggles so its disabled state cannot drift from the active catalog predicate.

## Vanilla-aligned Building Lens taxonomy verification (2026-08-01)

After a controlled restart with the rebuilt DLL, the lens opened from the
normal FindIt magnifier and rendered its independent taxonomy. Its top-level
tabs were exactly `All`, `Zones`, `Signature`, `Service`, and `Favorites`;
FindIt's inherited Networks, Nature, Props, and Vehicles tabs were not shown
while the lens was active. The table rendered the title/icon, analytical
columns, visible rows, and the page indicator together.

The live filter matrix was exercised through real Gameface clicks:

- `All` showed mixed building/service rows and `1 / 43` paging for 4,206
  indexed records.
- `Zones` changed the result to building rows (`1 / 37`) and exposed zone
  subcategories; `Zones → Residential` changed again to only
  `Buildings_Residential` rows (`1 / 17`).
- `Service` changed to service rows (`1 / 4`) and exposed service
  subcategories; `Service → Education & Research` showed only
  `ServiceBuildings_EducationResearch` rows (`1 / 1`).

The selected tab and subcategory changed with each result set, proving the
controls are query-backed rather than visual-only. The rebuilt scalar bindings
published their initial values before the React view read them; no
`getValueUnsafe`/binding initialization error appeared after restart, and the
Gameface error buffer stayed quiet. The run ended on the `All` view with the
panel open and its state stable.

## Icon-host audit

The isolated successor must not rely on the optional Unified Icon Library
mod. In the 2026-07-27 live check, direct `coui://uil/...` image probes
returned `error` while `Media/Game/...`, `coui://ui-mods/...`, and the
successor's `coui://finditbuildingmenu/...` host loaded. The successor now
vendors the exact Uil SVGs it references under `FindIt/Resources/Images/Icons`
and rewrites dynamic prefab thumbnail URLs through `IconPath.Normalize`.
After deployment, repeat the live check and confirm category-tab, top-bar,
subcategory, favorite, and visible prefab images all have non-zero rendered
pixels; do not accept DOM geometry alone as icon verification. The 2026-07-31
successor-only run packaged 65 vendored SVGs and passed a direct `Image` probe
for every unique `coui://finditbuildingmenu/...` and custom
`coui://ui-mods/...` source (zero errors). The settled panel screenshot showed
rendered category, subcategory, favorite, and prefab imagery.

When checking the surrounding world, `Page.captureScreenshot` through Cohtml
captures the Gameface UI layer with a black underlay; it does not include the
Unity 3D world. A black area in that screenshot is therefore not evidence of
a black game scene. Use an actual X-window/root capture for world pixels, while
using Gameface screenshots and DOM/Image probes for UI assertions.

## Test-environment note

Isolated game retries on 2026-07-27 did not reach a menu: the game reported
`AssetDatabase.PopulateFromDataSource`/`GameManager` null references after a
stale `.cache/Mods/playset_config_lock.json` was left by the crashed session.
The lock and the `continue_game.json` pointer were backed up and the pointer
restored; the successor package was redeployed afterward. A post-refactor
successor-only smoke (`codex-findit-ui-contract-1`) reached platform
initialization but reproduced the same base loop before CDP became available,
so it could not produce a new UI assertion. A later clean-pointer retry
(`codex-findit-ui-contract-clean-1`) reached the main menu and entered the
developed save, but remained in `VTBackgroundLoading` at 90% before the
catalog populated; it is likewise not counted as a new live assertion. These
failures are tracked in `cm-8e0` and are not counted as successor runtime
evidence.

## Tool-first construction surfaces

The Building Lens Tools mode is separate from the five building sections. Verify
the following path in a settled world:

1. Open FindIt, enable Building Lens, and confirm the `Catalog` / `Tools` mode
   switch is visible above the building-section navigation.
2. Select `Tools` and confirm the `Construction tools` surface replaces the
   building-section and subcategory rows rather than appearing as another
   building filter row.
3. Confirm Roads, Paths, Lot and terrain tools, Vegetation, Props, and Vehicles
   each have an icon, label, and tooltip. A target that is not exposed by the
   current vanilla toolbar remains visible but disabled with a reason.
4. For each enabled surface, click once and confirm the built-in `toolbar`
   trigger fires first, the native construction menu/tool becomes active, and
   FindIt/Building Lens closes. No building rows or Building Lens page count
   may remain visible after handoff.
5. For loading, locked, missing, or ambiguous targets, confirm the disabled
   entry does not change the current building query, section, subcategory, or
   panel visibility.
6. Return to `Catalog` and confirm the last valid building section/query is
   preserved. Exercise one legacy FindIt category and one normal building
   placement to verify that the native handoff did not rewrite legacy state.

The live matrix was exercised after a controlled restart on 2026-08-01. All
six entries resolved to runtime vanilla toolbar targets and rendered enabled:
Roads, Paths, Lot and terrain tools, Vegetation, Props, and Vehicles. Clicking
each entry closed FindIt after the toolbar trigger; the native selection probes
reported Roads, Pathways, Terraforming, Vegetation, Landscaping, and
Transportation respectively. A second fresh process confirmed the same six
enabled entries and a Roads handoff with no new Gameface errors. The clipped
settled Tools row and DOM model are archived at
`tools/e2e/artifacts/e2e-20260801-tool-surfaces-live/`.

The second restart also covered the binding-recreation path. TopBar and shell
bindings now have inert fallbacks while their first C# update is pending, so
opening Building Lens after a view reload no longer emits the previous
`BuildingLensSection.update`/`getValueUnsafe` exception.

## Building Lens Catalog/Tools mode verification (2026-08-01)

The dedicated mode slice was built and deployed through
`just deploy-isolated findit-building-menu`. Backend tests passed 41/41, UI
tests passed 34/34, `npm run build` and `./build.sh all` passed, and
`git diff --check` was clean for the slice. A full Steam → Paradox → CS2 retry
was required after one direct-launch attempt reproduced the known
`AssetDatabase.PopulateFromDataSource` fatal; the retry reached a settled
developed world and was stopped cleanly afterward.

At the settled 1280×720 viewport, the `Tools` button rendered a selected state
and the mode DOM reported `data-lens-mode="tools"`. Tools mode rendered all six
native descriptors (`Roads`, `Paths`, `Lot and terrain tools`, `Vegetation`,
`Props`, and `Vehicles`) while the building table had zero row elements, zero
`n / m` paging labels, and zero building category/subcategory buttons. Returning
to `Catalog` restored the prior input value, first row, 100-row page, and
`1 / 43` paging without issuing a catalog query mutation. Evidence is archived
in `tools/e2e/artifacts/e2e-20260801-building-lens-tools-mode/`:
`catalog.png`, `tools.png`, `catalog.json`, and `tools.json`.

The Gameface console contained only normal view-reload and BootDiagnostics
registration entries during the mode transition; no new UI exceptions were
captured. The six native handoff matrix remains covered by the preceding
Tool-first construction surfaces run.

Use `just cs2-status` before any game action. Protect an external running game
with `just game-adopt <agent>` or launch with `just launch-cs2 <agent>`; never
attach Gameface CDP during the logo/loading screen and never kill a foreign lock
holder. Archive the settled UI screenshot, toolbar observations, and final
Gameface error/log summary under a timestamped `tools/e2e/artifacts/` directory.

## Current gate

- Confirm `docs/FORK.md` records the exact upstream revision.
- Confirm `FindIt/UI/mod.json` uses `FindItBuildingMenu` and that the PDX
  publisher configuration has no upstream `77240` ID.
- Confirm the original `cs2-building-menu-overhaul/` working tree is unchanged
  by this fork operation.
- Confirm `./build.sh package` rejects a package if an upstream ID or
  user-scoped `CSII_TOOLPATH` reference appears in its deployable files.

## Release gates after identity migration

1. Build the backend and UI with the workspace-pinned toolchain.
2. Run `./build.sh test`; the pure catalog/filter suite must remain green,
   including numeric sorting, paging, bounded limits, missing fields, empty
   sources, and binding serialization.
   Run `(cd FindIt/UI && npm test)` as well; the successor UI contract suite
   must remain green without a running Gameface session.
3. Deploy only to an isolated Mods directory containing the successor and its
   diagnostics dependency; never test it beside an unrenamed `FindIt` payload.
   The workspace `just deploy-isolated` recipe must be extended with this
   successor before it is used for a live game run.
4. In-game, verify panel open/close, categories, filters, picker continuity,
   and locate behavior on a developed save. The 2026-07-26 parity run covers
   these flows; repeat it after any release-build or identity change.
5. Confirm the upstream maintainer's canonical license notice and obtain a new
   PDX publisher identity before publishing or enabling a public migration.
6. Record the game log and a screenshot for each failed step; do not close the
   successor work item based on a build alone.

## Building Lens facet affordance and readable-label verification (2026-08-01)

The facet readability pass was built, packaged, and deployed with
`just deploy-isolated findit-building-menu`. The backend suite passed 41/41,
the UI contract suite passed 31/31, `./build.sh all` passed, and the package
identity guard passed. The live check used a fresh Steam → Paradox → CS2
process on the developed save `Codex Preview Smoke 20260726` at 1280×720.

The facet drawer now provides a persistent selected/unselected marker (`✓` / `○`),
larger bordered targets, readable source/DLC/asset-pack labels, group-level
scroll arrows, and a toolbar hint when any option column is scrollable. The
settled DOM reported `DLC scrollHeight=237/clientHeight=96` and
`Placement scrollHeight=345/clientHeight=96`; the hint exposed
`data-scroll-hint="true"` and identified two scrollable groups. Long labels are
bounded to their columns with title attributes for the full text.

The live result-change proof selected `DLC → Landmark Buildings`: the catalog
count changed from 4,206 to 9, the selected option rendered `✓`, and paging
changed to `1 / 1`. Clear removed the marker and restored 4,206. No new
Gameface console entries were captured during the interaction. Evidence is
archived in
`tools/e2e/artifacts/e2e-20260801-building-lens-ux-facets/` (selected-state
screenshot and DOM metrics).

## Building Lens extensions facet (2026-08-01)

Building extensions are now a first-class, toggleable facet rather than being
implicitly mixed into role, DLC, or theme filters. The facet is projected from
the existing FindIt prefab index: `BuildingExtensionPrefab`,
`BuildingExtensionData`, and the vanilla `ServiceUpgradeData` marker all retain
the indexed prefab name as a stable extension query ID. Extension rows remain
the same catalog rows as their parent identity; no second discovery path or
duplicate browser entries is introduced. Extension lot dimensions also fall
back to `BuildingExtensionData.m_LotSize` when a row has no `BuildingData`.

The backend suite passes 43/43 tests and the UI contract suite passes 36/36.
Coverage includes case-insensitive extension matching, readable camel-case
labels, selected-marker/toggle payloads, clear-state transitions, and omission
of the group when indexed metadata is empty. The successor rebuilt and was
deployed through `just deploy-isolated findit-building-menu` to both isolated
Mods roots after the `ServiceUpgradeData` runtime detection was added.

The settled-world Gameface assertion passed on the developed save
`Codex Preview Smoke 20260726`: the facet drawer exposed 109 extension options.
Selecting `Bicycle Parking Hall 03 Side Entrance` changed the catalog count
from 4,206 to 1, rendered the single `Side Entrance` row, and changed the
option marker from `○` to `✓`; paging became `1 / 1`. Clear restored 4,206
records, 100 rows, and the unselected marker. The console error buffer stayed
at zero. DOM observations and the inline settled screenshot are archived in
`tools/e2e/artifacts/e2e-20260801-building-lens-extensions-live/`.

## Building Lens bounded paging and row-scroll affordance (2026-08-01)

The catalog footer now distinguishes the visible row range from the bounded
page count. Instead of the ambiguous `n / m` label, it reports text such as
`Rows 1–100 of 4206 · Page 1 of 43`; changing pages updates both the range and
page number, while changing sort order resets the range to page one. The
summary is generated by the pure `getCatalogPageSummary` contract so empty,
middle, and final pages have deterministic wording.

The row viewport advertises scrolling in two ways: the native scrollbar is
forced for pages with more records than the rendered rows, and the column
header shows a visible `↕` marker with `title` and `aria-label` of `Scroll
rows`. The marker is omitted when the page has no additional records, keeping
the affordance meaningful for filtered one-row results.

The final settled 1280×720 Gameface check used `Codex Preview Smoke 20260726`.
It reported 4,206 records, `scrollHeight=6266` against
`clientHeight=374`, `overflow-y=scroll`, `data-scrollable=true`, and one
`data-scroll-hint=true` marker. Next-page and Cost-sort interactions produced
the summaries recorded above; the Gameface console error buffer remained at
zero. The final local gates passed with backend tests 43/43, UI tests 38/38,
webpack, package identity checks, and `git diff --check`. Evidence is archived in
`tools/e2e/artifacts/e2e-20260801-building-lens-scroll-pagination-live/`.

## Building Lens UX follow-through verification (2026-08-02)

The accepted UX audit follow-through was built and deployed through
`just deploy-isolated findit-building-menu` while the isolated successor was
the only FindIt-family payload in both Mods roots. The backend suite passed
58/58, the UI suite passed 60/60 after the final pager-label fix, the workspace
build passed, the successor webpack build passed, and `git diff --check` was
clean.

The live check used the adopted process `2016483` at a 1280×720 Gameface
viewport (`Cohtml/1.64.0.7`) in the developed `Small City` / `Porterville`
world. The Building Lens exposed 4,206 indexed records and 43 pages. The
settled UI showed player-facing category/subcategory labels, compact `Name ▲`
sorting with all ten existing choices behind `More sorting`, a unified active
filter summary with `Clear lens filters`, and explicit placement/compare/pager
labels. Metric input `Cost minimum = 100000` settled to `Cost ≥ 100000` and
reduced the result count to 176, demonstrating the debounced binding path.

The live pass also selected and cleared a placement facet, exercised row
placement and comparison actions, and searched for `zzzz-no-match` to verify
the ready-empty copy. After clearing the Gameface event buffer, the action
pass captured zero new console entries and zero new exceptions. The initial
`indexing` copy was not visually captured because the populated save completed
indexing before the first settled observation; its distinct readiness contract
is covered by the backend/UI tests and remains called out in the artifact.

Durable evidence is archived in
`tools/e2e/artifacts/e2e-20260802-findit-ux-followthrough/` (manifest,
observations, and settled screenshot).
