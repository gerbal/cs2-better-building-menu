# Better Building Menu — Verification

This fork is an internal successor, not a publishable release. Its runtime
identity is `BetterBuildingMenu`; distribution remains gated on upstream
license confirmation and assignment of a new PDX publisher identity.

> **Re-run:** `node tools/e2e/building-menu-smoke.mjs --http <cdp http url> --agent <your agent id> --prefix <steam prefix>`
> against a game with a city loaded (repo root; `just e2e` runs its unit tests).
> **Last run:** 2026-09-02 on `db8271f`+rename — `tools/e2e/artifacts/findit-smoke/20260902-202039-db8271f.md` (the mod renamed to BetterBuildingMenu)
> (artifacts are not tracked; the run's report is pasted in the newest section below).
> The sections below are dated records; the newest describes the current build.
> Staleness is the distance between that sha and `HEAD`.

## Local build commands

Run these from `cs2-better-building-menu/`:

```bash
./build.sh backend
./build.sh ui
./build.sh test
./build.sh package

# browserless UI contracts
(cd BetterBuildingMenu/UI && npm test)
```

`./build.sh all` runs the backend and UI builds. Packaging writes only to
`artifacts/BetterBuildingMenu/`; it does not touch either game Mods directory.
The optional deploy action requires an explicit `CSII_SUCCESSOR_MODS_DIR` and
refuses to overwrite an existing target:

```bash
CSII_SUCCESSOR_MODS_DIR=/path/to/empty/isolated/Mods ./build.sh deploy
```

Do not point this at a directory containing the original `FindIt` payload.

For a game smoke test, use `just deploy-isolated better-building-menu`. The
recipe isolates both game `Mods` roots and also checks the Proton cache/local
root listed by `mod_directory.json`. It relocates only known workspace mod
folders (including `BootDiagnostics`, the upstream `FindIt`, and their
`.disabled` variants) into the sibling
`.cache/Mods/.codex-isolated-backup/<timestamp>/` directory. Unknown user mod
folders are left untouched, and the backup is reversible; no known non-kept
`.mjs` bundle remains under the cache scanner root after the deploy.

`./build.sh test` runs the net10 xUnit project at
`BetterBuildingMenu.Tests/` with `SkipBuildUI=true`; it does not launch the
game. `BetterBuildingMenu/UI/npm test` runs the browserless Node contract suite with the
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

## 2026-09-01 — search debounce and binding manifest

Phase 1 of the architecture remediation (`../docs/archive/cs2-better-building-menu/superpowers/plans/2026-09-01-findit-remediation-phase-1-search-and-binding-contract.md`,
beads cm-jjlv.1–.5). Built with `just build findit-building-menu` (0 errors)
and deployed with `just deploy-isolated findit-building-menu`; the game was
restarted because the DLL changed. Suites on the branch tip: C# 412/412,
TS 626/626, `tsc --noEmit` clean.

Live run: `--no-steam --headless`, prefix 949230, save **Porterville 3**.
`--no-steam` hides the DLC, so the lens indexed 3,995 buildings rather than
the 4,206 the 2026-08-02 run saw; the search and reopen costs below are the
per-refresh cost and do not depend on which buildings are present.

**Search.** `SearchChanged` was fired through the mod's own trigger with
`hospital`, `clinic`, and `""`, then with the Landscaping menu open, `tree`
and `""`. Every search settled in exactly ONE refresh, from the debounce's
`OnUpdate` path, and the whole cost is the refresh itself:

```
[LENS-REFRESH] 155ms menu='' total=1 from=OnUpdate                 hospital
[LENS-REFRESH] 165ms menu='' total=2 from=OnUpdate                 clinic
[LENS-REFRESH] 166ms menu='' total=3995 from=OnUpdate              (cleared)
[LENS-REFRESH] 23ms menu='Landscaping' total=12 from=OnUpdate      tree
[LENS-REFRESH] 28ms menu='Landscaping' total=368 from=OnUpdate     (cleared)
```

cm-yfd5 measured 2.7 s per search on this save with the upstream fuzzy
worker (`FindItUtil.ProcessSearch`) on the path. That worker, its
`_cachedSearch` output that nothing read, the `filterCompleted` flag and
the `Task.Run` are gone; `SearchChanged` now schedules a 250 ms
`SearchDebounce` deadline polled from `OnUpdate`, and the lens's own
`Contains` predicate is the only search. No `Search Failed` lines; the mod
log carries zero exceptions for the session and UI.log no errors after load.

**Reopen.** Landscaping was opened (`toolbar.selectAssetMenu` 16930),
closed (`toolbar.clearAssetSelection`), and opened again:

```
[LENS-REFRESH] 24ms menu='Landscaping' total=368 from=RefreshLens
[LENS-REFRESH] 25ms menu='Landscaping' total=368 from=SetBuildingCatalogGroupBy
[LENS-REFRESH] 25ms menu='Landscaping' total=368 from=RefreshLens
```

The first open still refreshes twice: the UI re-derives `groupBy` and pushes
it back (review finding 6, cm-jjlv.8). The second open is one refresh. The
~25 ms per refresh on a 368-entry menu and ~160 ms on the whole 3,995-entry
set is the fan-out cm-jjlv.7 exists to reduce; it is the residual behind
cm-2xvs.25.

**Bindings deleted.** `FindItBuildingMenu.Tests/BindingManifestTests.cs`
now extracts every `CreateBinding`/`CreateTrigger` name from
`FindIt/Systems/*.cs` and every `bindValue`/`trigger`/`createTriggerCommand`/
`method:` name from `UI/src`, and fails when either side names something the
other does not. Its first run listed eleven C# names with no reader and
three UI names with no C# handler; all are gone:

- `BuildingLensMenuToolTip` — written on every menu change from a tooltip
  table in `PrefabIndexingSystem`; no `bindValue` read it. The table and
  `Domain/MenuToolTip.cs` went with it.
- `BuildingLensSortCanReorder` — cm-ddw3's C# half, computed over the whole
  match set every refresh and never displayed. `BuildingCatalogPage.SortCanReorder`
  and the engine's `SortCanReorder`/`HandlesSortColumn` went with it;
  `reorderableSortColumns` stays because `LensControlPane` reads it.
- `BuildingLensMilestoneIcons`, `BuildingLensMenuMilestone` /
  `SetBuildingLensMenuMilestone` — the milestone tab was replaced by the
  dev-tree branch tab; the bindings outlived it.
- `CurrentCategory` / `CurrentSubCategory` (+ `SetCurrentCategory` /
  `SetCurrentSubCategory`) — upstream FindIt's category enums; the lens
  scopes by `UiMenu`/`UiCategory` and the UI never read these.
- `NoAssetImage` — an upstream settings mirror no component consulted.
- `OptionsList`, `AreFiltersSet`, `ClearFilters`, and then `OptionClicked` —
  the upstream filter bank's UI contract; no component mounts the bank.
  The sections still exist and are still applied (review finding 3,
  cm-jjlv.9 removes them).
- UI side: `BuildingLensZoneFamilies` (read, always its default),
  `ToggleBuildingLensZoneFamily` and `SetBuildingLensRole` (emitted into
  nothing), plus the dead `lensRoleCommand`, `setCurrentCategoryCommand`,
  `setCurrentSubCategoryCommand`, `optionClickedCommand` exports and the
  `findItOption` surface action that only produced `OptionClicked`.

`KnownUnreadByUi` in the manifest test allows one name,
`BuildingCatalogGroupBy`, which C# publishes and the UI writes but does not
read; cm-jjlv.8 decides which side owns it.

## 2026-09-01 — one scoping taxonomy (phase 2)

Phase 2 of the architecture remediation (spec
`../docs/archive/cs2-better-building-menu/superpowers/specs/2026-09-01-findit-remediation-phase-2-one-scoping-taxonomy-design.md`,
plan `../docs/archive/cs2-better-building-menu/superpowers/plans/2026-09-01-findit-remediation-phase-2-one-scoping-taxonomy.md`,
beads cm-jjlv.6.1–.4), branch `findit/phase-2-one-taxonomy`. Suites on the
branch tip: C# 364/364 (all four `BindingManifestTests` green), TS 617/617,
`tsc --noEmit` clean. Built with `just build findit-building-menu`, deployed
with `just deploy-isolated findit-building-menu`, game restarted.

Live run: `--no-steam --headless`, prefix 949230, save **Porterville 3**
(DLC absent under `--no-steam`, same as the phase-1 run). Driven through the
cs2-qa bridge pinned to CDP 9444 — the shared instance file was repointed by
another session mid-run, which is why the pinned driver exists.

**1. Menus.** Each toolbar menu opened through `toolbar.selectAssetMenu`,
then `ClearBuildingLensMenuScope` for All menus:

```
[LENS-REFRESH] 40ms menu='Roads' total=228 from=RefreshLens
[LENS-REFRESH] 42ms menu='Roads' total=228 from=SetBuildingCatalogGroupBy
[LENS-REFRESH] 25ms menu='Landscaping' total=368 from=RefreshLens
[LENS-REFRESH] 17ms menu='Health & Deathcare' total=8 from=RefreshLens
[LENS-REFRESH] 15ms menu='Zones' total=22 from=RefreshLens
[LENS-REFRESH] 17ms menu='Electricity' total=15 from=RefreshLens
[LENS-REFRESH] 154ms menu='' total=3995 from=ClearBuildingLensMenuScope
```

Landscaping 368 and unscoped 3,995 equal phase 1's numbers on this save.
Health & Deathcare is 8 — vanilla's own count, the figure the SPIKE in
`PrefabIndex.cs` was written to reach ("our Healthcare view showed 15 where
vanilla shows 8"). The first open still refreshes twice (the UI's groupBy
push-back, cm-jjlv.8); every later menu is one refresh.

**2. Auto-widen.** Inside Landscaping, search `zzzz`:

```
AutoWidenSearch=false: [LENS-REFRESH] 71ms menu='Landscaping' total=0 from=OnUpdate
                       BuildingCatalogMatchesElsewhere=0, BuildingLensMenu='Landscaping'
AutoWidenSearch=true:  [LENS-REFRESH] 162ms menu='' total=0 from=RefreshLens
                       BuildingLensMenu='' (scope released)
```

Before this phase the widening read the section, which only the preset
menus set, so Landscaping never widened; now it is one rule for every
scoped menu.

**3. Strip tabs.** The predicate did not change; this confirms the removed
`StripAxis` query field was not feeding it. Electricity (axis
`development`, tabs `Electricity`=8, …): `SetBuildingLensStripTab
"Electricity"` → `[LENS-REFRESH] 33ms menu='Electricity' total=8`. Zones
(density axis, `ZonesResidential⟂Low Density`=2, `⟂Mixed Housing`=2):
`total=2` and `total=2`.

**4. Zones yield.** `ReplaceVanillaZonesMenu=false` + select Zones →
`LensOwnsCurrentMenu=false`, `BuildingLensMenu=''`. Back to true + select
Zones → `true`, `'Zones'`.

Zero exceptions in the mod log, zero UI.log errors after the load.

**What left.** `VanillaBuildMenuTaxonomy`, `VanillaBuildMenuSelection`,
`VanillaMenuPresets` (replaced by `VanillaMenus.IsZones`), the two section
`UIEntry` structs; the query's `Category`, `SubCategory`,
`BuildMenuSection`, `BuildMenuSubCategory`, `UnlockMilestone` and
`StripAxis`; the engine's `MatchesBuildMenu`; the entry's `VanillaSection`
/`VanillaSubCategory`; the bindings `BuildingLensSection`,
`SetBuildingLensSection`, `BuildingLensSubCategory`,
`SetBuildingLensSubCategory`, `BuildingLensSectionList`,
`BuildingLensSubCategoryList`; the Section and Type chips and
`vanillaBuildMenuContracts.ts`; the section-driven "Role" grouping default.
The query is scoped by `UiMenu`/`UiCategory` and nothing else.

**What stayed, against the review.** `VanillaMenuAudit` and both
`[MENU-AUDIT]`/`[MENU-COVERAGE]` passes: they compare the game's own
placements against the index's tree fields (coverage), not the two
taxonomies against each other, and are the guard that caught the
roads-cost bug. The review text is corrected in place.

## 2026-09-01 — filter bank and residue deleted (phase 5)

Phase 5 of the architecture remediation (spec
`../docs/archive/cs2-better-building-menu/superpowers/specs/2026-09-01-findit-remediation-phase-5-delete-filter-bank-and-residue-design.md`,
plan `../docs/archive/cs2-better-building-menu/superpowers/plans/2026-09-01-findit-remediation-phase-5-delete-filter-bank-and-residue.md`,
beads cm-jjlv.9.1–.5), branch `findit/phase-5-delete-residue`. Run before
phase 3 on purpose: the snapshot cache phase 3 builds would otherwise have
keyed on fifteen filter-bank fields and six sort modes this phase deletes.
Suites on the branch tip: C# 349/349, TS 614/614, `tsc --noEmit` clean.

**Where it ran.** The shared 949230 prefix was held by another session all
afternoon, so this ran on the cloned prefix **949230-c** (CDP 9557, its own
lock) with `--no-steam --headless`, driven through a bridge client pinned
to that port. That prefix sees content 949230 does not under `--no-steam`
— the audit lists `CN_`, `JP_`, `EE_` region-pack assets — so **none of the
totals below compare with the phase-1/2 numbers**; the like-for-like
baseline is master's build run on the same prefix, recorded at the end.

**What the first live run found, and would not have found in tests.**
`Mod.OnLoad` registered `updateSystem.UpdateAt<OptionsUISystem>(...)` on the
abstract base. It had only ever worked because `FindItUISystem.OnCreate`
created `FindItOptionsUISystem` first and the base-type lookup found it;
with that class gone the line constructed the abstract type
(`MissingMethodException`, in Modding.log only), `OnDispose` nulled
`Mod.Settings`, and the mod's own log showed 29 `NullReferenceException`s in
`RunIndex` with `Indexed Prefabs Count: 0`. Found by mapping the IL offset
with `ilspycmd --il-sequence-points` to `Mod.Settings.get_HideRandomAssets`.
Fixed by registering only concrete systems. The same pass also null-guarded
the `HideRandomAssets` query patch (`None` is null on processors that
exclude nothing). New gate for every deploy that removes a system:
`grep -c "Error initializing mod" Modding.log` must be 0.

**Census.** `[PROCESSOR-CENSUS]` on Porterville 3, with every processor
present (`indexed` = prefabs it produced; `lens` = of those, buildings or
networks or placed in any vanilla menu):

| Processor | indexed | lens | |
|---|---:|---:|---|
| ZonedBuilding | 9057 | 9057 | |
| ServiceBuilding | 516 | 516 | |
| Prop | 13828 | 387 | stays (Landscaping's props) — the 13,441 it indexes for nobody is phase 3's number |
| Decals | 199 | 13 | stays (Landscaping/PropsDecals) |
| Pillar | 127 | 127 | |
| MiscBuilding | 32 | 32 | |
| Roundabout | 100 | 100 | |
| Bridges | 96 | 96 | |
| Zone | 89 | 78 | |
| Tracks | 68 | 68 | |
| Roads | 56 | 56 | |
| Intersections | 51 | 51 | |
| Shrub | 45 | 36 | |
| SportProp | 38 | 1 | stays (one placed asset) |
| Surface | 28 | 15 | stays (Areas) |
| Tree | 19 | 19 | |
| Paths | 19 | 19 | |
| UtilityNetworks | 16 | 16 | |
| Fence | 15 | 15 | |
| Terraforming | 9 | 9 | |
| TransportLine | 9 | 9 | |
| Waterways | 3 | 3 | |
| MiscProps | 106 | 0 | **deleted** |
| RoadProps | 71 | 0 | **deleted** |
| Storefront | 62 | 0 | **deleted** |
| Spawners | 22 | 0 | **deleted** |
| Human | 8 | 0 | **deleted** |
| RoadUtilityProps | 2 | 0 | **deleted** |
| Vehicle | 0 | 0 | **deleted** (indexed nothing once the generators were gone) |

The review's "30 processors classify things the lens never lists" was
wrong for 22 of them. Seven went; the index dropped from 24,550 to 24,424
prefabs. `PropPrefabCategoryProcessor` stopped excluding
`QuantityObjectData`, because the generator that used to stand in for those
props is gone and vanilla places the originals.

**Audit, after.** `[MENU-COVERAGE] vanilla shows 1467 assets across its
menus; 3 missing from the index` — down from 11 with the generators gone
and before the quantity-prop fix (the 8 `Trashbin01-04` /
`TrashContainerEmpty01-04` are held as themselves now). The three left are
pre-existing gaps, present with every processor still in place:
`Dome Rural Hotel 01`, `Dome Road House 01` (Signatures) and
`IndustrialModernPlaza01DeliveryVan01` (Landscaping/PropsIndustrial) —
filed as cm-vxuv. Zero exceptions in the mod log across the whole session.

**Menus, phase-5 build on 949230-c** (`[LENS-REFRESH]`, first open of
each; Roads refreshes twice, the groupBy push-back of cm-jjlv.8):

```
60ms  menu='Roads'              total=403
85ms  menu='Landscaping'        total=522
23ms  menu='Health & Deathcare' total=31
23ms  menu='Zones'              total=74
23ms  menu='Electricity'        total=17
506ms menu=''                   total=10536   (All menus)
```

**Settings the options screen offers now:** `ApplyMimic` (hidden; its
attribute registers the picker's Apply action), `AutoWidenSearch`,
`BuildingLensDefaultToTable`, `BuildingLensPanelHeight` (hidden),
`BuildingLensShelfSize`, `BuildingLensShowShelf`, `BuildingLensTileSize`,
`HideRandomAssets`, `OpenPanelOnPicker`, `PickerKeyBinding`,
`ReplaceVanillaBuildMenu`, `ReplaceVanillaZonesMenu`, `SelectPrefabOnOpen`,
`ShowCoverageOverlay`. Every one has a reader.

**What left.** `Filters` and the ten option sections,
`FindItOptionsUISystem`, `BuildingLensLegacyFilterSnapshot` and the
`BuildingLensLegacyFilters` binding, the query's `HasParking`, the search
mirror, `FindItUtil.CurrentCategory/CurrentSubCategory/SetSorting` and the
enumerators, the six sort modes (`IndexedPrefabList` is Name order),
`RegisterAPIs`, `StrictSearch`; favourites end to end; the two prop
generators, `AssetMap`, `GetIconsMap`, `CustomAreaBorderRenderSystem`,
`ClearGooee`; ten dead settings and their locale strings in 15 locales;
`UI.zip` (a 38 MB zipped `node_modules`, now ignored); upstream's
`Changelog.json` and `PublishConfiguration.xml`, replaced with this mod's
own; seven processors. `VanillaMenuAudit` lost its substitution clause and
its "deferred until AssetMap" gate.

**Baseline: master's build (`f3efa90`, phase-2 FindIt) on the same prefix,
same save, same session.** `[LENS-REFRESH]`: Roads 403, Landscaping **514**,
Health & Deathcare 31, Zones 74, Electricity 17, All menus **10,528**.
Phase 5 differs by exactly +8 in Landscaping and +8 unscoped — the
`Trashbin01-04` / `TrashContainerEmpty01-04` quantity props, which master
held only as generated substitutes (`[MENU-COVERAGE] … 3 missing from the
index, 8 replaced by generated variants`) and phase 5 holds as themselves
(`3 missing`). Every other menu is identical, the same three assets are
missing on both, and both runs had zero exceptions. Master also ran the
full index three times per load (24,756 → 24,957 prefabs as the generators
published), where phase 5 runs it once; and master's options screen still
listed `ColumnSize`, `ExpandedColumnSize`, … — the ten dead settings.

## 2026-09-01 — one snapshot per refresh (phase 3)

Phase 3 of the architecture remediation (spec
`../docs/archive/cs2-better-building-menu/superpowers/specs/2026-09-01-findit-remediation-phase-3-one-snapshot-per-refresh-design.md`,
plan `../docs/archive/cs2-better-building-menu/superpowers/plans/2026-09-01-findit-remediation-phase-3-one-snapshot-per-refresh.md`,
beads cm-jjlv.7.1–.4), branch `findit/phase-3-one-snapshot`. Suites on the
tip: C# 358/358 (four `CatalogViewTests`, four `SnapshotCacheTests`, one
`QueryEnumerationTests`), TS 614/614.

**Method.** `[LENS-REFRESH]` now carries a permanent stage breakdown —
`proj=<ms>(hit|miss) page= bounds= facets= counts= axis= tabs= expanded=
tiers=` — and both runs below are that line, same prefix (`949230-c`), same
save (Porterville 3), same session, same sequence: open Roads, Landscaping,
Health & Deathcare, Zones, Electricity, then All menus; then inside
Landscaping type `tre`, `tree`, clear, close, and reopen it. The "before"
build already had the engine's single enumeration (Task 1), so the
difference is the cache and the view alone.

**Before** (`7299d64`: breakdown + single enumeration, no cache across
refreshes, per-method derivations):

```
 62ms proj=25ms(miss) page=26  bounds=0 facets=29  counts=0 axis=0  tabs=1  expanded=3 tiers=0 menu='Roads'              total=403
 58ms proj=24ms(miss) page=26  bounds=0 facets=26  counts=0 axis=1  tabs=1  expanded=1 tiers=0 menu='Roads'              (groupBy push-back)
 54ms proj=13ms(miss) page=15  bounds=0 facets=25  counts=1 axis=1  tabs=1  expanded=5 tiers=3 menu='Landscaping'        total=522
 22ms proj=10ms(miss) page=10  bounds=0 facets=11  counts=0 axis=0  tabs=0  expanded=0 tiers=0 menu='Health & Deathcare' total=31
 31ms proj=11ms(miss) page=12  bounds=0 facets=12  counts=0 axis=0  tabs=5  expanded=0 tiers=0 menu='Zones'              total=74
 25ms proj=11ms(miss) page=12  bounds=0 facets=11  counts=0 axis=1  tabs=0  expanded=0 tiers=0 menu='Electricity'        total=17
342ms proj=97ms(miss) page=115 bounds=5 facets=185 counts=4 axis=10 tabs=13 expanded=3 tiers=2 menu=''                   total=10536 (All menus)
 32ms proj=13ms(miss) page=14  bounds=0 facets=15  … menu='Landscaping' total=522   (reopen)
 31ms proj=13ms(miss) page=14  bounds=0 facets=13  … menu='Landscaping' total=13    (typed "tre")
 33ms proj=14ms(miss) page=14  bounds=0 facets=15  … menu='Landscaping' total=13    (typed "tree")
 78ms proj=26ms(miss) page=28  bounds=4 facets=42  … menu='Landscaping' total=522   (cleared)
 32ms proj=13ms(miss) page=15  bounds=0 facets=14  … menu='Landscaping' total=522   (reopened again)
```

What it says: every refresh re-projected (`miss` on all twelve lines — a
keystroke cost a full projection), and on the whole catalog `facets` was
the largest stage at 185 ms because `GetFacetState` re-scanned and
re-projected the entire index a second time for its pack scope. The page
itself, already single-pass, was 115 ms over 10,536 entries.

**After** (`64fbda8`: `SnapshotCache` keyed on scope and invalidated by
`IndexGeneration`; `CatalogView` with one scoped pass and memoised
derivations):

```
 30ms proj=25ms(miss) page=26 bounds=0 facets=0  counts=0 axis=0 tabs=0  expanded=1 tiers=0  menu='Roads'              total=403
 30ms proj=0ms(hit)   page=28 bounds=0 facets=0  counts=0 axis=0 tabs=0  expanded=0 tiers=0  menu='Roads'              (groupBy push-back)
 16ms proj=13ms(miss) page=15 bounds=0 facets=0  counts=0 axis=0 tabs=0  expanded=0 tiers=0  menu='Landscaping'        total=522
 11ms proj=10ms(miss) page=10 bounds=0 facets=0  counts=0 axis=0 tabs=0  expanded=0 tiers=0  menu='Health & Deathcare' total=31
 13ms proj=11ms(miss) page=12 bounds=0 facets=0  counts=0 axis=0 tabs=0  expanded=0 tiers=0  menu='Zones'              total=74
 12ms proj=10ms(miss) page=11 bounds=0 facets=0  counts=0 axis=1 tabs=0  expanded=0 tiers=0  menu='Electricity'        total=17
105ms proj=0ms(hit)   page=20 bounds=5 facets=26 counts=1 axis=0 tabs=24 expanded=4 tiers=22 menu=''                   total=10536 (All menus)
  3ms proj=0ms(hit)   page=1  … menu='Landscaping' total=522   (reopen)
  1ms proj=0ms(hit)   page=1  … menu='Landscaping' total=13    (typed "tre")
  0ms proj=0ms(hit)   page=0  … menu='Landscaping' total=13    (typed "tree")
  3ms proj=0ms(hit)   page=2  … menu='Landscaping' total=522   (cleared)
  2ms proj=0ms(hit)   page=1  … menu='Landscaping' total=522   (reopened again)
```

Every total is identical to the before run and to phase 5's. Zero
exceptions, `Error initializing mod` 0, audit unchanged (the same three
pre-existing gaps, cm-vxuv).

What changed: the first open of a menu still projects it (that is the
`proj` miss, 10–25 ms, the same figure as before) and then costs nothing
else — every derived stage reads the one scoped pass. Everything after the
first open is a cache hit: a reopen is **3 ms** (was 32), a search
keystroke inside a menu is **0–1 ms** (was 31–33), clearing the search is
3 ms (was 78). All menus is **105 ms** (was 342): the projection was
already cached from the load-time refresh, the page fell from 115 to 20
ms, and `facets` from 185 to 26 because the pack scope no longer rescans
and reprojects the index. The residual on All menus is `tabs=24` and
`tiers=22` — the strip's two axis passes and the tier pass over the
10,536-entry menu set; small, and the next thing to look at if the
whole-catalog refresh ever matters.

What invalidates the cache: `PrefabIndexingSystem.IndexGeneration`,
bumped at the end of every `RunIndex` (full or partial), by `ApplyUnlocks`
when an unlock changed anything, and by a unique being built or
bulldozed. A different menu, DLC union, pack/theme/vanilla/mods
selection is a different key, not an invalidation.

This is the number behind cm-2xvs.25 ("reopening a menu costs a ~2.6 s
stall"): 2.6 s → 25 ms (phase 1) → 3 ms.

## 2026-09-01 — one owner per presentation state (phase 4)

Phase 4 of the architecture remediation (spec
`../docs/archive/cs2-better-building-menu/superpowers/specs/2026-09-01-findit-remediation-phase-4-one-owner-per-presentation-state-design.md`,
plan `../docs/archive/cs2-better-building-menu/superpowers/plans/2026-09-01-findit-remediation-phase-4-one-owner-per-presentation-state.md`,
beads cm-jjlv.8.1–.5), branch `findit/phase-4-one-owner`. Suites on the
tip: C# 389/389, TS 557/557, `BindingManifestTests` with an empty
allowlist.

**What moved to C#.** The effective grouping
(`BuildingCatalogGrouping.DefaultDimension`/`Effective`; the query's
`GroupBy` is the player's choice and `""` is auto), the search relevance
(`BuildingCatalogRelevance.Score`, applied inside each group whenever a
search is active, the sort column breaking ties), the group headings
(`BuildingCatalogGrouping.Labels`, stamped on every page item as
`groupPath`/`groupLabelId`) and the dimensions a menu offers
(`OfferedDimensions` → `BuildingLensGroupDimensions`). The UI lost
`defaultGroupDimensionFor`, the groupBy push-back effect,
`rankBuildingMatches`/`matchScore`/`stableGridOrder`, `buildGroupedView`,
`groupLevelsFor` and ten label helpers (`buildingGroups.ts` 897 → 483
lines), and the three view-state modules became one store
(`lensViewStore.ts`, `useSyncExternalStore`). The density tier table is one
table now (`BuildingCatalogLabels.DensityTier`).

**Method.** Same prefix (`949230-c`), save (Porterville 3), launch
(`--no-steam --headless`) and driver as phase 3. Open Roads, Landscaping,
Health & Deathcare, Zones, Electricity, Education & Research, then All
menus, reading `[LENS-REFRESH]`, `BuildingCatalogGroupBy`,
`BuildingLensGroupDimensions` and the page after each; inside Landscaping
search `tre`; on All menus search a `pdxModsId` taken off the page.

**One refresh per open.** Every menu logged exactly one line, all
`from=RefreshLens`; zero `SetBuildingCatalogGroupBy` lines in the run. The
second `Roads` line of every earlier run — the UI pushing the derived
groupBy back — is gone:

```
34ms proj=25ms(miss) page=31 … expanded=1 menu='Roads'                total=403
20ms proj=14ms(miss) page=19 …            menu='Landscaping'          total=522
12ms proj=10ms(miss) page=11 …            menu='Health & Deathcare'   total=31
13ms proj=10ms(miss) page=12 …            menu='Zones'                total=74
16ms proj=13ms(miss) page=16 …            menu='Electricity'          total=17
11ms proj=10ms(miss) page=11 …            menu='Education & Research' total=43
64ms proj=0ms(hit)   page=21 bounds=6 facets=27 tabs=4 expanded=1 tiers=3 menu='' total=10536 (All menus, from=ClearBuildingLensMenuScope)
```

Totals identical to phase 3. Zero exceptions, `Error initializing mod` 0.

**The effective grouping and the offered dimensions**, as C# publishes
them:

| Menu | `BuildingCatalogGroupBy` | `BuildingLensGroupDimensions` |
|---|---|---|
| Roads | menuCategory | menuCategory, category, subCategory, progression, development, theme, source, footprint, cost, none |
| Landscaping | menuCategory | menuCategory, category, subCategory, theme, source, footprint, cost, none |
| Health & Deathcare | menuCategory | menuCategory, role, development, source, footprint, cost, none |
| Zones | menuCategory | menuCategory, category, subCategory, progression, theme, source, density, footprint, cost, none |
| Electricity | menuCategory | category, subCategory, role, development, source, footprint, cost, none |
| Education & Research | schoolTier | menuCategory, role, schoolTier, development, source, footprint, cost, none |
| All menus | development | all twelve |

`schoolTier` is offered on Education alone; `development` is dropped from
Landscaping (nothing there is tree-gated) and kept on Electricity;
`density` appears only on Zones. The first page item's headings read as
expected: Roads `["Small Roads","Small Roads"]` with `groupLabelId`
`RoadsSmallRoads`, Zones `["Residential","Low Density"]` with
`ZonesResidential`, Education `["Elementary School"]` with no id, Health
`["Healthcare","Hospital"]`.

Two readings differ from the spec's expectations, and the spec was wrong,
not the build: it guessed `development` for Electricity and `category` for
All menus, but `DefaultDimension` takes the same `GetMenuCategories(menu)`
input the deleted `BuildingLensMenuCategories` binding fed the UI's
`defaultGroupDimensionFor`, so these are the defaults the lens already
opened on. Electricity is worth a look later: its menu has one category,
so the default is `menuCategory` while `menuCategory` is not in its offered
list (one bucket — the heading is suppressed, so nothing is drawn wrong).
Filed as a follow-up on cm-jjlv.

**One order per query.** Inside Landscaping, `tre` → 13, in the order C#
now sends and every view renders:

```
Apple Tree, Royal Palm Tree, Coconut Palm Tree, Florida Palm Tree, Sylvester Palm Tree   (word-start hit, shortest name first)
Oak, Birch, Pine, Alder, Poplar …                                                      (prefab-name hit: OakTree01, BirchTree01 …)
```

all under `["Vegetation","From the start"]`. On All menus, searching the
`pdxModsId` `98960` (taken from the first modded item on the page) returns
670 and `items[0].pdxModsId` is `98960` — the search the grid used to drop
to nothing because its own scorer never read that field.

## 2026-09-02 — split the catalog; honest vanilla seams (phase 6)

Phase 6 of the architecture remediation (spec
`../docs/archive/cs2-better-building-menu/superpowers/specs/2026-09-01-findit-remediation-phase-6-split-catalog-and-honest-seams-design.md`,
plan `../docs/archive/cs2-better-building-menu/superpowers/plans/2026-09-01-findit-remediation-phase-6-split-catalog-and-honest-seams.md`,
beads cm-jjlv.10.1–.5), branch `findit/phase-6-split-catalog`. Suites on
the tip: C# 389/389, TS 568/568 (`catalogDom.test.ts` 6, `vanillaLayout.test.ts` 5).

**What moved.** `BuildingCatalog.tsx` 1,011 → 382 lines: `useCatalogWindow`
(the page binding, the window's shape, the bottom-of-list frame loop),
`useScrollAnchor` + `useRevealExpandedRow` (the two DOM-measuring effects),
`TableView` (column header, scroll, interleaved group headings) and
`TableRow` (one row), over `catalogDom.ts` (`lastCatalogRow`,
`findScrollContainer` bounded by the catalog's root). The three
`document.querySelectorAll` sweeps and the unbounded `parentElement` walk
are gone: `grep document\. src/mods/BuildingCatalog` is empty. The two
patches on vanilla's layout left `BuildingMenuSurface.tsx` (279 → 149
lines) for `vanillaLayout.ts`: one hook, one tested `setInlineStyle`
primitive, and every selector a class the game's own stylesheet module
exports — the toolbar is the `game-main-screen` child carrying
`toolbar.module.scss`'s `toolbar`, not the child whose hashed class name
starts with `toolbar_`.

**Why the seams stay.** Finding 8 asked for "a container the mod owns"
instead. Measured against the slot: centred, vanilla's main column starts at
x=403 with its tool-options column at 145→398, and the panel plus control
pane need 980 px — a container of ours can neither shift left over the
options column nor fit to the right. And the chirper/toolbar paint order is
decided between vanilla's own siblings, which nothing inside either can
change. So both patches remain, imperative and scoped to the mount; what
changed is that they are honest and tested.

**Method.** `949230-c`, Porterville 3, `--no-steam --headless`, the pinned
driver with a new `eval` command (CDP `Runtime.evaluate`). Clicks on our
own controls go through the React fiber's `onClick` — Cohtml elements
have no `.click()`.

**Readings.** Opening Roads: one `[LENS-REFRESH]` (`from=RefreshLens`,
total 403); All menus 10,536; `Error initializing mod` 0; exceptions 0;
no "invalid value" line in any log under the prefix.

| Check | Closed | Roads open | Closed again |
|---|---|---|---|
| `toolLayout` inline / computed `justify-content` | — / center | flex-start / flex-start | — / center |
| toolbar (`toolbar_QYu`) inline / computed `z-index` | — / auto | -1 / -1 | — / auto |
| lens row `getBoundingClientRect().left` | | 264.0 (width 984) | |
| `[data-catalog-entry]` in document vs under the catalog root | | 100 / 100 | |

Table view (fourth view-mode button), Roads:

- **Reveal.** Expanding the last row straddling the fold (row top 626.7,
  fold 630.3): `scrollTop` 0 → 162.3, detail bottom 624.3 ≤ fold 630.3.
- **Window.** `scrollTop = scrollHeight` on the rows' scroller: items
  100 → 200 within 4 s, `hasMore` still true (403 total).
- **Anchor.** Scrolled to 900, placed the third visible row (`Gravel
  Road`, id 15937), closed the menu, reopened: the panel comes back in
  Table view (the store survives) and that row sits at 564→625 inside the
  viewport 353→630 — on screen, where the unanchored list would show rows
  0–4.
- The scroller the walk finds is the `Scrollable`'s content element
  (`content_*`, scrollHeight 6,466 vs clientHeight 277) beneath the root;
  the walk never reaches the panel's own `content`/`asset-panel` above it.

**Not driven.** The Chirper toast and the Locked/Unlocked popup (the four
things the z-index comment verified on 2026-08-09) were not re-driven; the
element the new selector finds is the same `toolbar_QYu` node with the same
inline value, so the paint-order argument is unchanged. Whether cs2/ui's
`Scrollable` forwards its declared ref to the scrolling element was not
tested; the bounded walk answers the question without it.

## 2026-09-02 — render harness and scripted smoke (phase 7)

Phase 7 of the architecture remediation (spec
`../docs/archive/cs2-better-building-menu/superpowers/specs/2026-09-02-findit-remediation-phase-7-render-harness-and-scripted-smoke-design.md`,
plan `../docs/archive/cs2-better-building-menu/superpowers/plans/2026-09-02-findit-remediation-phase-7-render-harness-and-scripted-smoke.md`,
beads cm-jjlv.11.1–.6), branch `findit/phase-7-render-harness`.

**Suites on the tip.** C# 389/389; TS unit 548/548 (was 568: the 25
source-regex `it` blocks in `buildingLensUx.test.ts` are gone, 7 of them
moved to `stylesheetContracts.test.ts`, and `supportedUpgradesField`'s two
`.tsx` greps went); TS render 35/35 (`FindIt/UI/test/render/`, run by
`npm run test:render` through the loader in `test/harness/`); `just e2e`
green with `findit-lens-smoke.test.js`.

**What renders now.** `TableRow`, `BuildingHoverCard`, `BuildingMenuHeader`,
`BuildingCatalogComponent` (all four view modes) and `LensControlPane`
render under node through `@swc/core` with `cs2/*` stubbed and the vanilla
component resolver seeded; the assertions are on markup — `aria-label`s,
`data-*` attributes, what sits inside the scroll container — not on source
text. One defect found on day one: the header's search and loading icons
carried no `alt=""`/`aria-hidden` while its other icons did (fixed in
9b1091e).

**The smoke.** `tools/e2e/building-menu-smoke.mjs` replaces the per-phase
session scripts. It refuses a game whose `meta.hello` identity does not
name `--agent` (verified: `--agent nobody` exits 2 and the mod log gains no
`[LENS-REFRESH]` line), refuses without a loaded city, and writes its
report under `tools/e2e/artifacts/findit-smoke/`. Two things it caught
while being written: the bridge does not itself refuse the envelope's
`expectAgent`, so the identity check has to be the caller's; and a log
that ends in a newline counted one line too many, which read as zero
refreshes per open until the count ignored the empty tail.

**This build's run** (Porterville 3 on `949230-c`, the artifact verbatim):

# FindIt lens smoke — 2026-09-02 — bc10568

Result: **PASS**  ·  agent `claude-swift-ocelot-gZs`  ·  cdp `http://127.0.0.1:9557`  ·  prefix `949230-c`

| Menu | Refreshes on open | groupBy | Offered dimensions | Total | First groupPath |
|---|---|---|---|---|---|
| Roads | 1 | menuCategory | menuCategory, category, subCategory, progression, development, theme, source, footprint, cost, none | 403 | ["Small Roads","Small Roads"] |
| Landscaping | 1 | menuCategory | menuCategory, category, subCategory, theme, source, footprint, cost, none | 522 | ["Terraforming","From the start"] |
| Health & Deathcare | 1 | menuCategory | menuCategory, role, development, source, footprint, cost, none | 31 | ["Healthcare","Healthcare"] |
| Zones | 1 | menuCategory | menuCategory, category, subCategory, progression, theme, source, density, footprint, cost, none | 74 | ["Residential","Low Density"] |
| Electricity | 1 | menuCategory | category, subCategory, role, development, source, footprint, cost, none | 17 | ["Electricity","Electricity"] |
| Education & Research | 1 | schoolTier | menuCategory, role, schoolTier, development, source, footprint, cost, none | 43 | ["Elementary School"] |
| All menus | 1 | development | menuCategory, category, subCategory, role, progression, development, theme, source, density, footprint, cost, none | 10536 | |

Search `tre` in Landscaping: 13 matches, first `Apple Tree`.

Exceptions in the mod log: 0 before, 0 after.

```
[LENS-REFRESH] 7ms proj=0ms(hit) page=5 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Roads' total=403 from=RefreshLens
[LENS-REFRESH] 6ms proj=0ms(hit) page=4 bounds=1 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Landscaping' total=522 from=RefreshLens
[LENS-REFRESH] 2ms proj=0ms(hit) page=1 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Health & Deathcare' total=31 from=RefreshLens
[LENS-REFRESH] 2ms proj=0ms(hit) page=1 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Zones' total=74 from=RefreshLens
[LENS-REFRESH] 1ms proj=0ms(hit) page=1 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Electricity' total=17 from=RefreshLens
[LENS-REFRESH] 1ms proj=0ms(hit) page=0 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Education & Research' total=43 from=RefreshLens
[LENS-REFRESH] 69ms proj=0ms(hit) page=21 bounds=7 facets=28 counts=0 axis=0 tabs=4 expanded=1 tiers=4 menu='' total=10536 from=ClearBuildingLensMenuScope
```

Every reading equals the phase-4 record. Phases 1–7 of cm-jjlv are merged;
what remains of the review is cm-jjlv.12 (the one-category default) and
the C# side of finding 9 (`PrefabIndexingSystem`, the adapter's instance
paths and the `FindItUISystem` handlers are still untested), which the
review's plan did not schedule.

## 2026-09-02 — one lens state (phase 8), and the one-category default (cm-jjlv.12)

Phase 8 (spec
`../docs/archive/cs2-better-building-menu/superpowers/specs/2026-09-02-findit-remediation-phase-8-one-lens-state-design.md`,
plan `../docs/archive/cs2-better-building-menu/superpowers/plans/2026-09-02-findit-remediation-phase-8-one-lens-state.md`,
beads cm-jjlv.13.1–.4), branch `findit/phase-8-one-lens-state`, stacked on
`findit/cm-jjlv-12-default-grouping`. Suites on the tip: C# 405/405 (was
390: fifteen `BuildingCatalogLensTransitionTests`, one grouping test), TS
unit 548, TS render 35, `just e2e` green.

**What moved.** `FindItUISystem`'s five state fields (the query, the metric
ranges, the menu, the category, the school tier) are one
`BuildingCatalogLensState`, which now carries `Menu`, `Category`,
`SchoolTier` and `SearchText` and has one transition per trigger:
`SelectMenu`, `ClearMenuScope`, `SelectCategory`, `SelectStripTab`,
`SelectSchoolTier`, `SetSortColumn`, `SetDescending`, `SetGroupBy`,
`LoadMore`, `ToggleFacet`, `ClearFacets`, `ClearFilters`, `ResetMenu`,
`SetMetricRange`, `ClearMetricRanges`, `Search`, and `Compose` (the fold
`RefreshBuildingCatalog` used to do inline). Every handler is
`Apply(_lens.<Transition>(…))` — assign, `PublishScope()`, refresh, skipped
when the transition returned the same instance. `Bindings.cs` 843 → 598
lines. No binding added, removed or renamed. The scoping rules — a menu
forgets the category, the tab and the tier; a tab and a category exclude
each other; Reset keeps the menu and drops everything narrowed; grouping
and sort changes shrink the window; Load more grows it to the ceiling —
are pinned by test without a game.

**cm-jjlv.12.** `BuildingCatalogGrouping.Effective` now takes the offered
dimensions and holds its answer to them: the menu's default, then the
strip's axis, then the picker's first grouping, then none. Live:
Electricity opens on `development` (it read `menuCategory`, which its
picker did not list); every other menu is unchanged.

**The smoke's scope section** (new this phase) is the live proof of the
refactor: Roads narrowed by its first strip tab and by its first
category, with the category clearing the tab, Reset restoring the menu's
403, and Education & Research narrowed to tier 1. The run, verbatim:

# FindIt lens smoke — 2026-09-02 — 08c7818

Result: **PASS**  ·  agent `claude-swift-ocelot-gZs`  ·  cdp `http://127.0.0.1:9557`  ·  prefix `949230-c`

| Menu | Refreshes on open | groupBy | Offered dimensions | Total | First groupPath |
|---|---|---|---|---|---|
| Roads | 1 | menuCategory | menuCategory, category, subCategory, progression, development, theme, source, footprint, cost, none | 403 | ["Small Roads","Small Roads"] |
| Landscaping | 1 | menuCategory | menuCategory, category, subCategory, theme, source, footprint, cost, none | 522 | ["Terraforming","From the start"] |
| Health & Deathcare | 1 | menuCategory | menuCategory, role, development, source, footprint, cost, none | 31 | ["Healthcare","Healthcare"] |
| Zones | 1 | menuCategory | menuCategory, category, subCategory, progression, theme, source, density, footprint, cost, none | 74 | ["Residential","Low Density"] |
| Electricity | 1 | development | category, subCategory, role, development, source, footprint, cost, none | 17 | ["Electricity"] |
| Education & Research | 1 | schoolTier | menuCategory, role, schoolTier, development, source, footprint, cost, none | 43 | ["Elementary School"] |
| All menus | 1 | development | menuCategory, category, subCategory, role, progression, development, theme, source, density, footprint, cost, none | 10536 | |

Search `tre` in Landscaping: 13 matches, first `Apple Tree`.

Exceptions in the mod log: 0 before, 0 after.

## Scope

| Step | Read back | Total |
|---|---|---|
| Roads, open | | 403 |
| strip tab `Communications` | tab ["Communications"] | 1 |
| category `RoadsSmallRoads` | category `RoadsSmallRoads`, tab [] | 24 |
| Reset | category ``, tabs [] | 403 |
| Education & Research, tier 1 | tier 1 | 14 (menu 43) |

```
[LENS-REFRESH] 35ms proj=25ms(miss) page=32 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=1 tiers=0 menu='Roads' total=403 from=RefreshLens
[LENS-REFRESH] 19ms proj=13ms(miss) page=18 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Landscaping' total=522 from=RefreshLens
[LENS-REFRESH] 13ms proj=11ms(miss) page=12 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Health & Deathcare' total=31 from=RefreshLens
[LENS-REFRESH] 14ms proj=11ms(miss) page=13 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Zones' total=74 from=RefreshLens
[LENS-REFRESH] 11ms proj=9ms(miss) page=11 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Electricity' total=17 from=RefreshLens
[LENS-REFRESH] 12ms proj=11ms(miss) page=12 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Education & Research' total=43 from=RefreshLens
[LENS-REFRESH] 67ms proj=0ms(hit) page=21 bounds=7 facets=28 counts=0 axis=0 tabs=4 expanded=1 tiers=3 menu='' total=10536 from=Apply
```

Every reading outside the scope section equals the phase-7 record.
`PrefabIndexingSystem` stays untested by design: its extraction reads
prefab components through Unity's ECS; the per-menu totals above and the
`[MENU-AUDIT]`/`[MENU-COVERAGE]` log lines are its check.

## 2026-09-02 — the open beads: tab icons, the three unindexed assets, the overlap measurements, coexistence

Branch `findit/open-beads` (commits c25ebd1, d71fb08). Suites on the tip:
C# 410/410, TS unit 548, TS render 35.

**cm-2xvs.17, tab icons.** Two causes, both found live. The strip's icon
came from whichever assets a narrowing left in the tab (Transportation's
first tab went Road → Bus under a content pack); `CatalogView` now picks
strip and branch icons from the whole menu — the pack-ignored projection
when the toolbar narrowed it. And Roads' two single-asset parking
categories drew a photographic render in a row of glyphs: a probe showed
the indexer had filled `DevTreeBranchIcon` with the asset's own
`thumbnail://` render when the tree node had none, so `TabIcon`'s
"authored icon" was the photograph; a `thumbnail://` branch icon now counts
as none and the category glyph (`Parking.svg`) is drawn. Live after the
fix: 29 tabs read in Roads, 0 photographs (were 4).

**cm-vxuv, the three assets vanilla places that the index missed.** Live
component dumps: Dome Rural Hotel 01 and Dome Road House 01 are
`BuildingPrefab`s with `BuildingData` + `BuildingPropertyData`
(AllowedSold = Lodging) and no `SpawnableBuildingData`,
`SignatureBuildingData` or `ServiceObjectData`, so neither the zoned nor
the service processor claimed them and the misc-building processor
rejected the property data; it now accepts a property building the game
itself places, with subcategory and the Signature zone type read off the
vanilla category (`VanillaCategoryMapping`, tested).
IndustrialModernPlaza01DeliveryVan01 carries an editor override
`include=Props/Decorations/Industrial exclude=FindIt+FindIt/500/505` —
upstream's generated-vehicle scheme — and the indexing loop honoured the
Find It exclude; a vanilla placement now beats it, as it already beat the
name blacklist. `[MENU-COVERAGE]` prints a missing asset's editor
categories and key components, which is how the van's cause was read off
one log line. After: `[MENU-AUDIT] vanilla shows 1467 assets across its
menus; 0 missing from the index` — Landscaping 526 held, Signatures 138.

**cm-2xvs.12, overlap.** Measured at 1280×720 with Roads open: the filter
rail sits in the control pane (1176..1240 × 519..540) and its dropdown
opens above it (1171..1280 × 479..520), covering 0 % of the catalog
(264..991 × 327..636); the Chirper popup anchors at the right icon strip
(1248, 514) and stacks under the pane by the toolbar z-index patch.
Closed on the measurements.

**cm-wf6g.4, coexistence with upstream Find It.** Upstream 1.1.1 (pdx
cache 77240_27) copied beside ours as a local mod: its C# does not
initialise on this game build (`MissingMethodException:
AssetDatabase.LoadSettings(string,object,object)`), its UI still registers
and extends the same `AssetMenu` seam, and with both present the slot
mounts nothing — our lens stays unscoped (10,587; `tre` → 106) with zero
exceptions of our own. Recorded on the bead as a decision for the user:
yield the seam when the `FindIt` module is present, or declare the two
incompatible as BMO already is.

**This build's smoke** (single-mod, Porterville 3 on `949230-c`):

# FindIt lens smoke — 2026-09-02 — d71fb08

Result: **PASS**  ·  agent `claude-swift-ocelot-gZs`  ·  cdp `http://127.0.0.1:9557`  ·  prefix `949230-c`

| Menu | Refreshes on open | groupBy | Offered dimensions | Total | First groupPath |
|---|---|---|---|---|---|
| Roads | 1 | menuCategory | menuCategory, category, subCategory, progression, development, theme, source, footprint, cost, none | 403 | ["Small Roads","Small Roads"] |
| Landscaping | 1 | menuCategory | menuCategory, category, subCategory, theme, source, footprint, cost, none | 523 | ["Terraforming","From the start"] |
| Health & Deathcare | 1 | menuCategory | menuCategory, role, development, source, footprint, cost, none | 31 | ["Healthcare","Healthcare"] |
| Zones | 1 | menuCategory | menuCategory, category, subCategory, progression, theme, source, density, footprint, cost, none | 74 | ["Residential","Low Density"] |
| Electricity | 1 | development | category, subCategory, role, development, source, footprint, cost, none | 17 | ["Electricity"] |
| Education & Research | 1 | schoolTier | menuCategory, role, schoolTier, development, source, footprint, cost, none | 43 | ["Elementary School"] |
| All menus | 1 | development | menuCategory, category, subCategory, role, progression, development, theme, source, density, footprint, cost, none | 10539 | |

Search `tre` in Landscaping: 13 matches, first `Apple Tree`.

Exceptions in the mod log: 0 before, 0 after.

## Scope

| Step | Read back | Total |
|---|---|---|
| Roads, open | | 403 |
| strip tab `Communications` | tab ["Communications"] | 1 |
| category `RoadsSmallRoads` | category `RoadsSmallRoads`, tab [] | 24 |
| Reset | category ``, tabs [] | 403 |
| Education & Research, tier 1 | tier 1 | 14 (menu 43) |

```
[LENS-REFRESH] 9ms proj=0ms(hit) page=6 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Roads' total=403 from=RefreshLens
[LENS-REFRESH] 19ms proj=13ms(miss) page=18 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Landscaping' total=523 from=RefreshLens
[LENS-REFRESH] 16ms proj=13ms(miss) page=15 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Health & Deathcare' total=31 from=RefreshLens
[LENS-REFRESH] 13ms proj=11ms(miss) page=13 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Zones' total=74 from=RefreshLens
[LENS-REFRESH] 12ms proj=10ms(miss) page=12 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Electricity' total=17 from=RefreshLens
[LENS-REFRESH] 12ms proj=10ms(miss) page=11 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Education & Research' total=43 from=RefreshLens
[LENS-REFRESH] 99ms proj=0ms(hit) page=24 bounds=7 facets=32 counts=0 axis=0 tabs=28 expanded=1 tiers=4 menu='' total=10539 from=Apply
```

## 2026-09-02 — coexisting with upstream Find It (cm-wf6g.4)

The user's requirement: two complementary mods, not a fight. Measured on
`949230-c` with upstream Find It **1.5.8** (pdx cache `77240_58`, the
current release; the 1.1.1 build cached beside it does not initialise on
game 1.6.0 at all) copied into the prefix's Mods folder beside ours.

**What was already true.** With a working upstream, the two composed at the
`AssetMenu` seam by accident of registration order: upstream's extension
blanks the slot while its panel is up and passes through otherwise; ours
mounts when the lens owns the menu. Opening Roads mounted our lens (403);
opening Find It's panel over it unmounted ours and kept our C# scope; closing
it brought ours back. Both logs clean.

**What was not.** Two identical picker glyphs on the toolbar (theirs and
ours — ours is inherited from theirs). Both mods emit images to the shared
`coui://ui-mods/images/` host under the same names, and two of ours differ
from theirs (`findit_lock.svg`, `findit_unlock.svg`), so one mod could load
the other's glyph. And the composition depended on which mod the game
registered last.

**Changes** (commit on `findit/open-beads`):

- `FindItPresent` binding — decided on the first update, because this
  system is created during our own load, two seconds before Find It's
  assembly is loaded (the one-time check at creation read false).
- `shouldMountInAssetMenu` takes `findItPanelShown` (their
  `ShowFindItPanel`, false when absent): we yield the slot while their panel
  is up whatever the registration order. `shouldClearOnEscape` likewise
  leaves the toolbar selection alone while their panel is up, so Escape
  closes their panel and not our menu underneath it.
- The toolbar picker stands down when Find It is present (`ToolbarIcon`);
  theirs covers it.
- Webpack emits our images under `images/FindItBuildingMenu/`; nine
  inherited image files nothing referenced are gone from `src/images`.
- The upstream binding group is assembled at runtime in
  `domain/upstreamFindIt.ts`: `build.sh`'s package guard refuses any
  artifact containing the quoted upstream id, and that guard protects the
  publisher identity, so it stays strict.

**Readings, both installed, after the changes:** `FindItPresent` true;
toolbar shows one picker (`coui://ui-mods/images/PickerPicker.svg`, theirs)
and their magnifier, ours absent; Roads open → lens 403; their panel opened
→ our surface unmounted, `LensOwnsCurrentMenu` still true; their panel
closed → our surface back; their panel with no menu → nothing of ours;
Roads opened under their panel → ours stays down until they close. Smoke
PASS with the single-mod totals (Roads 403, Landscaping 523, All 10,539,
`tre` 13); `Error initializing mod` 0; exceptions 0 in both mod logs;
Player.log's 48 failed UI requests are all upstream's `coui://uil/…` icon
library, none ours. Our index holds 24,834 assets with Find It's generated
prefabs present (24,427 alone); the lens totals do not change because the
generated prefabs sit in no vanilla menu.

**Not covered.** Find It's picker tool with our menu (its picker opens its
own panel with the asset selected, by design); the two `MouseToolOptions`
extensions with a tool armed; a third mod extending the same seam.

The run's report:

# FindIt lens smoke — 2026-09-02 — 2e51a78

Result: **PASS**  ·  agent `claude-swift-ocelot-gZs`  ·  cdp `http://127.0.0.1:9557`  ·  prefix `949230-c`

| Menu | Refreshes on open | groupBy | Offered dimensions | Total | First groupPath |
|---|---|---|---|---|---|
| Roads | 1 | menuCategory | menuCategory, category, subCategory, progression, development, theme, source, footprint, cost, none | 403 | ["Small Roads","Small Roads"] |
| Landscaping | 1 | menuCategory | menuCategory, category, subCategory, theme, source, footprint, cost, none | 523 | ["Terraforming","From the start"] |
| Health & Deathcare | 1 | menuCategory | menuCategory, role, development, source, footprint, cost, none | 31 | ["Healthcare","Healthcare"] |
| Zones | 1 | menuCategory | menuCategory, category, subCategory, progression, theme, source, density, footprint, cost, none | 74 | ["Residential","Low Density"] |
| Electricity | 1 | development | category, subCategory, role, development, source, footprint, cost, none | 17 | ["Electricity"] |
| Education & Research | 1 | schoolTier | menuCategory, role, schoolTier, development, source, footprint, cost, none | 43 | ["Elementary School"] |
| All menus | 1 | development | menuCategory, category, subCategory, role, progression, development, theme, source, density, footprint, cost, none | 10539 | |

Search `tre` in Landscaping: 13 matches, first `Apple Tree`.

Exceptions in the mod log: 0 before, 0 after.

## Scope

| Step | Read back | Total |
|---|---|---|
| Roads, open | | 403 |
| strip tab `Communications` | tab ["Communications"] | 1 |
| category `RoadsSmallRoads` | category `RoadsSmallRoads`, tab [] | 24 |
| Reset | category ``, tabs [] | 403 |
| Education & Research, tier 1 | tier 1 | 14 (menu 43) |

```
[LENS-REFRESH] 8ms proj=0ms(hit) page=5 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Roads' total=403 from=RefreshLens
[LENS-REFRESH] 23ms proj=16ms(miss) page=22 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Landscaping' total=523 from=RefreshLens
[LENS-REFRESH] 13ms proj=11ms(miss) page=13 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Health & Deathcare' total=31 from=RefreshLens
[LENS-REFRESH] 13ms proj=11ms(miss) page=13 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Zones' total=74 from=RefreshLens
[LENS-REFRESH] 12ms proj=10ms(miss) page=12 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Electricity' total=17 from=RefreshLens
[LENS-REFRESH] 13ms proj=11ms(miss) page=12 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Education & Research' total=43 from=RefreshLens
[LENS-REFRESH] 86ms proj=0ms(hit) page=23 bounds=6 facets=27 counts=0 axis=0 tabs=24 expanded=1 tiers=3 menu='' total=10539 from=Apply
```


## 2026-09-02 — the evaluation's fixes: search headers, no strip under All menus, no repeated sub-heading (cm-mkn6)

Spec: `../docs/archive/cs2-better-building-menu/superpowers/specs/2026-09-02-ux-evaluation-fixes-design.md`, from
findings 1, 2 and 5 of `../docs/archive/cs2-better-building-menu/ux-evaluation-2026-09-02-with-findit.md`. Branch
`findit/ux-eval-fixes`. UI-only: no binding, no C#.

Live on `949230-c`, Porterville 3, with upstream Find It 1.5.8 installed
beside ours (the evaluation's configuration). The first build was deployed
with `deploy-isolated`; the refined band rule was rebuilt with
`npm run build`, copied into the prefix's Mods folder and the page reloaded
over CDP (`Page.reload`), then read back. Frames:
`../docs/archive/cs2-better-building-menu/ux-evaluation-2026-09-02/after-{02,03,11}-*.jpg`.

Groups read off the DOM as (depth, band, unlabeled, label, count, rect):

- **Roads, search `tre`** (was: two-level CUL-DE-SACS flowing beside SMALL
  ROADS, headings sharing two 11px rows, "ROAD SER…"):
  `0 - - Small Roads 2 (269,332,200,73)`, `0 band - Cul-De-Sacs 3
  (269,407,710,84)` → `1 - unlabeled (269,419,200,61)`, `1 - - Roundabouts 2
  (473,419,200,73)`; `0 - - Roundabouts 9 (269,494,632,73)`; `0 - - Road
  Services 1 (269,569,200,73)` — the label whole; `0 - - Pedestrian Bridges 12
  (269,645,706,129)`; `0 - - Paths 1 (269,776,200,73)`. No two top-level
  headings share a y; the one-tile groups carry their names at 200px.
- **Roads** (was: "MEDIUM ROADS / Medium Roads, 15 / 12"): `0 band Medium
  Roads 15 (269,519,710,204)` → `1 unlabeled (269,531,710,117)`, `1 Grand
  Bridge 3 (269,651,216,73)`. "Medium Roads" once. Every other category is a
  lone-child group with no heading row reserved (Small Roads' child at y
  343 = heading + 11px, where it used to sit 12px lower).
- **All menus** (was: a 4-row strip of ~70 tabs, panel top at 219): no
  `.strip_` element in the panel; panel at (264,327,727,309) with the
  search row directly over COMMUNICATIONS; groups by development, one level.
- **Roads' strip** still wraps to two rows (21 tabs at 537px), as the spec
  leaves it.

Gates: C# 410/410, `npm test` 554 unit + 42 render, `tsc --noEmit` clean.
`FindItPresent` true throughout; 0 exceptions in the mod log before and
after. Findings 3, 4, 6, 7, 8 of the evaluation are untouched.

## 2026-09-02 — the rename: FindItBuildingMenu → BetterBuildingMenu

The whole identity moved: directory `cs2-better-building-menu`, backend
`BetterBuildingMenu/`, tests `BetterBuildingMenu.Tests/`, assembly and mod
id `BetterBuildingMenu` (so the binding group, the `coui://betterbuildingmenu`
host, the `images/BetterBuildingMenu/` folder, the log
`Logs/BetterBuildingMenu.log`, the settings file `BetterBuildingMenu.coc`
and every locale key), the silhouette cache host
`coui://betterbuildingmenusilhouettes`, and the types that carried the old
name (`BuildingMenuUISystem`, `BetterBuildingMenuSettings`,
`BuildingMenuUtil`, `InteractionBoundary`, `BuildingMenuGenerated`,
`MenuSurface*`). Names that refer to upstream Find It stay as they are
(`FindItPresent`, `IsFindItLoaded`, `ShowFindItPanel`, the `"FindIt"`
category override, `upstreamFindIt.ts`). The smoke is
`tools/e2e/building-menu-smoke.mjs`; the `just` recipes answer to
`better-building-menu` and still to the old aliases, and treat
`FindItBuildingMenu` as a stale payload to remove on deploy. The
BindingManifest and BuildingLensDimension tests locate the tree by the new
folder.

Live on `949230-c`, Porterville 3, two launches:

1. First launch booted clean (`Loaded BetterBuildingMenu`, 0 init errors,
   0 exceptions) and the smoke FAILED: every menu read 10,539 with 0
   refreshes on open. The settings file is keyed by the mod id, so the
   renamed mod came up on a fresh profile with `ReplaceVanillaBuildMenu`
   off (its deliberate default) and `VanillaMenuSelected` yielded to
   vanilla. Setting it through the bridge changed the C# property but not
   the `ReplaceVanillaBuildMenu` binding, which is created once at setup —
   a restart is needed for the setting to reach the UI. Migrated the old
   `.coc` under the new name (the first line is the settings id and ends
   in CRLF).
2. Second launch, then a third after the silhouette host rename: smoke
   PASS both times — Roads 403, Landscaping 523, Health 31, Zones 74,
   Electricity 17, Education 43, All 10,539; search `tre` 13; scope
   section green; 0 exceptions. DOM image hosts with Roads open:
   `coui://betterbuildingmenu` 19, `coui://betterbuildingmenusilhouettes`
   13 (each drawn at 30px), `coui://ui-mods` 1, no `findit` host left.
   The deployed DLL's strings carry only the new hosts.

Gates: C# 410/410, `npm test` 554 unit + 42 render, `tsc --noEmit` clean,
`just e2e` green. Existing players will see the mod's settings reset once
(it is a new mod to the game), and must turn "Replace vanilla build menu"
on again.

# FindIt lens smoke — 2026-09-02 — db8271f

Result: **PASS**  ·  agent `claude-swift-ocelot-gZs`  ·  cdp `http://127.0.0.1:9557`  ·  prefix `949230-c`

| Menu | Refreshes on open | groupBy | Offered dimensions | Total | First groupPath |
|---|---|---|---|---|---|
| Roads | 1 | menuCategory | menuCategory, category, subCategory, progression, development, theme, source, footprint, cost, none | 403 | ["Small Roads","Small Roads"] |
| Landscaping | 1 | menuCategory | menuCategory, category, subCategory, theme, source, footprint, cost, none | 523 | ["Terraforming","From the start"] |
| Health & Deathcare | 1 | menuCategory | menuCategory, role, development, source, footprint, cost, none | 31 | ["Healthcare","Healthcare"] |
| Zones | 1 | menuCategory | menuCategory, category, subCategory, progression, theme, source, density, footprint, cost, none | 74 | ["Residential","Low Density"] |
| Electricity | 1 | development | category, subCategory, role, development, source, footprint, cost, none | 17 | ["Electricity"] |
| Education & Research | 1 | schoolTier | menuCategory, role, schoolTier, development, source, footprint, cost, none | 43 | ["Elementary School"] |
| All menus | 1 | development | menuCategory, category, subCategory, role, progression, development, theme, source, density, footprint, cost, none | 10539 | |

Search `tre` in Landscaping: 13 matches, first `Apple Tree`.

Exceptions in the mod log: 0 before, 0 after.

## Scope

| Step | Read back | Total |
|---|---|---|
| Roads, open | | 403 |
| strip tab `Communications` | tab ["Communications"] | 1 |
| category `RoadsSmallRoads` | category `RoadsSmallRoads`, tab [] | 24 |
| Reset | category ``, tabs [] | 403 |
| Education & Research, tier 1 | tier 1 | 14 (menu 43) |

```
[LENS-REFRESH] 10ms proj=0ms(hit) page=7 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=1 tiers=0 menu='Roads' total=403 from=RefreshLens
[LENS-REFRESH] 26ms proj=19ms(miss) page=25 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Landscaping' total=523 from=RefreshLens
[LENS-REFRESH] 15ms proj=12ms(miss) page=14 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Health & Deathcare' total=31 from=RefreshLens
[LENS-REFRESH] 19ms proj=15ms(miss) page=18 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Zones' total=74 from=RefreshLens
[LENS-REFRESH] 20ms proj=16ms(miss) page=19 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Electricity' total=17 from=RefreshLens
[LENS-REFRESH] 16ms proj=14ms(miss) page=15 bounds=0 facets=0 counts=0 axis=0 tabs=0 expanded=0 tiers=0 menu='Education & Research' total=43 from=RefreshLens
[LENS-REFRESH] 170ms proj=0ms(hit) page=26 bounds=17 facets=86 counts=0 axis=0 tabs=33 expanded=1 tiers=5 menu='' total=10539 from=Apply
```

artifact: /var/home/gerbal/Games/CS-Modding-wt/findit-remediation/tools/e2e/artifacts/findit-smoke/20260902-202039-db8271f.md

## 2026-09-07 — index at OnGameLoaded (cm-36os)

Prefix `949230-b`, `--no-steam`, same build for both runs. The game's loader runs
`SetGameActive()` and then awaits three progress groups — `LoadTextures` is the
virtual-texturing material pass, a per-frame budget — before raising
`onGameLoadingComplete`, where the full index used to run. On this harness that
wait is ~7 minutes with the city playable and vanilla's menu standing.

| | Load save (13:09) | New Game, Easy, Sweeping Plains (13:36) |
|---|---|---|
| Continue / Start clicked | 13:09:08 (VT 9 %) | 13:36:10 |
| Full pass at OnGameLoaded | 13:09:12 → :17, 17692, locked=0 | 13:36:15 → :20, 17692, **locked=1089** |
| Partial pass (Created/Updated) | — | 13:36:22, **locked=546** — the starting unlocks, applied by the game after deserialise |
| Our menu drawn | 13:10:09 (extension picker, 3 rows) | 13:36:41 (Zones: 22 tiles, 14 locked) |
| Game's `Loading completed` | 13:16:35 (7m27s) | 13:42:26 (6m16s) |
| At loading-complete | full pass (pre-drift-check build): 17692, locked=0 | **skipped**, lock-state drift 0 |

Read off `Logs/BetterBuildingMenu.log` and `Logs/SceneFlow.log`; the New Game
was driven through the main menu over CDP (New Game → Select Mode → Sweeping
Plains → Select Map → Start Game).

Addendum, same day, main prefix through Steam on the real GPU (user-driven load
of a save with locked content): `Full pass at OnGameLoaded` 14:37:35 → :41,
17693 prefabs, locked=241; the game's `Loading completed` at 14:37:54 — **19 s**
later, not seven minutes; drift check 0, second pass skipped. The long wait was
the headless GL harness; the lock-state agreement holds on a save with locks.

## 2026-09-07/08 — hover card contents, units in both systems, 720p pass

Live on the main prefix (949230), autosaves of Porterville. The window was
**1024x768** (Settings.coc, `displayMode: Window`), not the 1280x720 the commit
messages of 7c893c1 and 0e4394b say — the DOM's `innerWidth` of 1024 was
literal and the MCP screenshots were rescaled. The figures below are as
measured; only the label was wrong, and 1024 wide is the harsher width case.
Evidence
is DOM reads over CDP — every card line carries `data-line="<key>"` and every
tier `data-tier` since 18b1117 — because `Page.captureScreenshot` timed out for
the whole of 2026-09-08 on both the MCP client and the standalone script
(`scratchpad/shots/cdp-shot.mjs`); it had worked on 2026-09-07. Cause unknown.

### One card per menu (2026-09-07)

The card's order is one fixed list (`BuildingHoverCard.tsx`): locked, already
built, cost, upkeep and named resources, capacity, leisure, range, speed, width,
parking, households, workers, service facts in `FACT_ORDER`, upgrades, bonuses,
lot — then split into the game's tier (`VANILLA_LINE_KEYS`, `isVanillaFact`,
and per kind `PROMOTED_BY_CATEGORY`) and ours, each keeping that order.

| Menu / tile | Top tier | Dimmed tier |
|---|---|---|
| Roads / Two-Lane Road | Cost ¢4,000 /km · Upkeep ¢487 /km/mo. · Speed limit 80 km/h · Width 16 m | Elevated width 14 m · Carries zoning |
| Zones / EU Low Density Housing | Height 8 m · Homes 1 · Floor space ×0.35 | Upkeep ¢6 /cell/mo. |
| Zones / EU Medium Density Housing | Height 53 m · Homes 2 /cell · Floor space ×2.0 | Upkeep ¢187 /cell/mo. |
| Zones / Forestry | Cost Free · Requires Forest | Lot 4 × 4 |
| Electricity / Small Coal Power Plant | Cost · Upkeep · Coal 20 t/mo. · Capacity 20 MW · Cargo capacity 20 t | Parking · Workers · Jobs · shifts · XP · Lot |
| Health / Small Medical Clinic | Cost · Upkeep · Pharmaceuticals · Capacity 25 patients · Ambulances 3 · Cargo capacity 1 t | Range 2.5 km · Parking · Workers · … |
| Water / Water Pumping Station | Cost · Upkeep · Capacity 100,000 m³/mo. · Draws from Surface Water | Workers · … · Upgrades Extra Pump |
| Water / Water Treatment Plant | Cost · Upkeep · Capacity 400,000 m³/mo. · Purification 50 % | … |
| Communications / Mailbox | Cost ¢100 · Mailbox capacity 1,000 | Range 1 km · XP 10 |
| Communications / Radio Mast | Cost · Upkeep · Capacity 3,000 Gbit/s | Range · Parking · Workers · … |
| Transportation / Small Bus Station | Cost · Upkeep · Comfort 40 | Jobs · shifts · XP · Upgrades · Lot |
| Landscaping / Oak | Cost ¢10 | — |
| Landscaping / Level Terrain Tool | — (no figures block) | — |

What the sampling changed, all landed and re-read live: a zone card had drawn
an empty top block and dimmed everything (924f39d); Upkeep now follows Cost as
the game binds it (18b1117); trees and props are priced (18b1117); speed limits
were m/s labelled km/h — components are written by `NetInitializeSystem` as
`prefab.m_SpeedLimit / 3.6` (925a046); a zone's utility and pollution
coefficients have no reader anywhere in the game and are gone, Upkeep is per
cell per month, Homes splits on `m_ScaleResidentials` (f232c25); mailbox
capacity, extractor required resource, mail as a count not a weight (bbf75e6).

### Units, both systems (2026-09-08)

The unit system was flipped through the game's own widget —
`trigger("options", "setValue", ["InterfaceSettings.unitSystem"], [1, 0])` with
the Options screen open — and restored the same way. Every unit-bearing line
was rendered through the real formatters in both systems and set against the
binder's unit kind in `PrefabUISystem.BuildDefaultPropertyBinders` and the
shipped bundle's per-kind rule table (`[Ic.<Kind>]` in `Content/Game/UI/index.js`,
which also trims trailing zeros).

| Line | Vanilla kind | Metric | US customary |
|---|---|---|---|
| Road cost / upkeep | moneyPerDistance(/Month) | ¢4,000/km · ¢487/km/mo. | ¢6,437/mi · ¢784/mi/mo. |
| Cargo, garbage, fuel | weight, weightPerMonth | 20 t · 0.13 t · 100 t/mo. | 22.05 tn · 0.14 tn · 110.23 tn/mo. |
| Water/sewage capacity, water use | volumePerMonth | 100,000 m³/mo. | 26,417,200 gal/mo. |
| Power, grid, battery | power, energy | 400 kW · 20 MW · 400 MWh | same |
| Range | length | 400 m · 2.5 km | 437 yd · 1.6 mi |
| Width | (ours) | 16 m | 17 yd |
| Zone height | height | 8 m | 26 ft |
| Speed | (ours) | 80 km/h | 50 mph |
| Purification, comfort | percentage, integer | 50 % · 40 | same |
| Telecom capacity | dataRate | 3,000 Gbit/s | same |

Fixed from this: water volumes were a literal "m³" through the unit table
(67db0c7); purification was the raw fraction, comfort a "×1.2" multiplier,
telecom capacity a bare truncated int (5707a67). Deliberately not matched:
vanilla's imperial money-per-distance divides by 1.6 (¢4,000/km → ¢2,500/mi),
the wrong direction; ours multiplies.

Guards added: `test/factCoverage.test.ts` reads the indexer's source and checks
every emitted key has a presentation; the render suite has a fixture per kind
of tile (network, zone, tool, tree, service) and one under Freedom (14e3eef).

### Layout pass at 1024x768 (2026-09-08, cm-2xvs acceptance)

Roads, 100 tiles, and Health, 8 tiles, in Cards, List, Grid and Table, measured
off the DOM at 1024x768 (see above): no overlapping tiles, no horizontal scroll, Table rows inside a
198px scroller (scrollHeight 540), the hover card flipping inside the viewport
on the bottom row (453,445 199×142), the Group-by picker (`pickerOptions`)
opening upward at 932,515 with all eight options inside the viewport. The two
collapses the epic recorded are not present. Two clips were, both fixed in
7c893c1: Grid tile names overran a 51px line by 2–9px (budget thirteen was
measured at fontSizeXS; the line is fontSizeM now; twelve fits) and the Table's
Upkeep column clipped "¢2,437 /km/mo." by 2–3px at the narrowest panel (80rem →
84rem). The search box placeholder "Search…" is 2px over its 104px textarea.

### Decisions recorded

- "Requires" stays first on a locked tile; vanilla puts requirements last.
- The dimmed tier's cap of ten stands: the order already drops Lot first.
- A tree's figure is its sapling price; vanilla shows a range only when several
  ages are enabled on the object tool, which is tool state the index cannot see.
- Local-modifier radius is the one vanilla tooltip effect still not drawn.

## 2026-09-09 — resolutions and text scale

Runs on the isolated prefix `949230-b` under gamescope headless (`--no-steam
--headless WxH --resolution WxH`, display mode `Window` restored after), save
"AZ shared testbed 20260830"; the main prefix's `Settings.coc` was returned to
its 1024x768 window. Evidence is the same DOM probe as the 09-08 pass.

- **1280x720, true** (`innerWidth` 1280, Player.log "Window resolution:
  1280x720"): Cards, List, Grid clean — no overlaps, no horizontal scroll, no
  clipped text; the grid budget of twelve (7c893c1/0e4394b) confirmed at this
  size. Hover card on the bottom-right tile 706,568 249x91 inside the viewport.
  Table: Upkeep column clean; four name cells clipped by 2–4px ("One-Lane
  One-Way Perpend…" 220>218, "Medium Roundabout with a…" 222>218) — the
  table's thirteen-per-100rem name budget is a character too generous for
  wide names; open.
- **Larger sizes, set in-game.** Editing `Settings.coc` never took under the
  headless display (the game applied "1280x720x60Hz Window" from its fallback
  each boot), but the Graphics page's resolution widget did:
  `trigger("options","setValue",["GraphicsSettings.resolution"], <item>)` with
  an item from the widget's own list, then `confirmDisplay`. The list is the
  mode set the game accepts, and on a 2560x1440 headless screen it offered
  2560x1440, 2560x1080 and 2048x1152 among others. Measured, `innerWidth`
  confirming each:
  - **1920x1080**: Cards, List, Grid clean; hover card 1015,853 374x136 inside
    the viewport; Table five name cells 1 % over (the same rows as at 720p —
    fixed in 57b4165, the name budget is twelve per 100rem now).
  - **2560x1440**: Cards, List clean; Grid five tiles 3–8px over on
    seventeen-character lines ("Medium Roundabout" 195px in 187); Table 2px
    over on three headers and cells.
  - **2560x1080 (21:9)**: no overlaps, no horizontal scroll; hover card
    1082,854 374x136 inside the viewport; Grid eight tiles 2–4px over, Table
    Upkeep cells 2–4px over ("¢2,437 /km/mo." 117 in 115).
  The residual at 1440p and ultrawide was one class: at 1.33px per rem and
  above, text renders 2–3 % wider relative to rem than at 1080p, so a budget
  that exactly fills its line at 720p/1080p spills a few pixels, and no fixed
  character margin fits both ends (twelve at 100rem must stay twelve).

### Measured fit (2026-09-09, 2532304 → 6b84e4b)

The group headings' answer — measure the drawn text and shorten to it — now
applies to tile names (`TileName`: an overflowing line feeds back a smaller
character budget) and to the table's metric columns (whatever a column's
cells drew past its estimate is added back in rem, capped at the room beside
a name of its minimum width). `domain/measuredFit.ts` holds the arithmetic.
Getting it right took four live cycles, each a lesson worth keeping:

- 2532304 froze the game: the measuring effect had no dependency array and
  set an equal-but-new object on every render. The merge now answers null
  when nothing changes (14c0e29).
- 9b4ebaa measured only on mount, in the Cards view, where no cell exists;
  the table view and its rows are dependencies now.
- a204225 grew the *cost* column to 252rem: every cell reports a constant
  1–2px of "overflow" that is its **border** — Cohtml's `scrollWidth` equals
  `offsetWidth` when nothing overflows and `clientWidth` excludes the border.
  The table's "2px clips" at 1440p and 21:9 reported above were this, not
  clips; only the grid's were real. Overflow is content past
  max(clientWidth, offsetWidth) (cee1631), and the probe reads the same.
- 68bf34d: the one real table overflow (2px) arrived after the second frame
  with no observed size change; the effect now also re-measures at 50ms,
  250ms, 1s and 2.5s after commit (6b84e4b).

Re-measured with the honest metric: **2560x1440** Grid 0 clips (was five);
**2560x1080** Grid 0 (was eight), Cards 0.

The table half was then **withdrawn** (the commit after 6b84e4b): with the
timed re-measures in place the one real 2px overflow ("¢2,025 /km/mo.") did
widen its column — to 268rem, while the name cell fell to 233px. The row is
a flex layout whose column bases already exceed the room beside the name at
a 1441rem assembly (seven columns 586rem beside a 327rem name in an ~820rem
row), so cells shrink back to what the row allows and an inline width is not
what gets drawn; the same overflow was measured every time. Fitting the
columns to the row is a column-model change, not a measurement, and is
open. The table's honest state at 1440p: one cell in a hundred 2px over.

Two harness notes from the same runs: the game writes a 2560x1080 mode to
`Settings.coc` as `"resolution": { "height": 1080 }` with no width, which
`set-cs2-resolution.py` rejects ("no display resolution block") — repair the
block by hand before the next `--resolution` launch; and `cs2-stop` now takes
down the headless gamescope cage it finds above the game (workspace
c22559a), which had left seven idling.
- **Text scale 125 %** (Interface › Text scale, set through the game's own
  widget: `trigger("options","setValue",["InterfaceSettings.textScale"],125)`
  with Options open — the slider is in percent, and 1.25 drives the body font
  negative): Cards and List size to content and stayed clean; **Grid** tile
  names overran their line by 10–40px ("One-Lane One-Way" 131>93); **Table**
  Cost and Upkeep cells clipped 15–20px ("¢487 /km/mo." 97>77) and three
  headers ("Workers" 52>41). Root: every character budget and column width
  assumed 100 %. The game applies the setting as `--fontScale = s` and
  `--fontScaleChange = s − 1`, with each `--fontSize*` a calc() of the two
  (XS = 12s + (s−1)·1.15·12, S = 14s + (s−1)·1.1·14, M = 14s + 2 +
  (s−1)·1.05·14): at 125 % M is x1.45 and S x1.53. Fixed in 1ffda09 —
  `domain/textScale.ts` states the calc, the tile and table budgets divide by
  their size's ratio, the metric columns multiply by it, read from vanilla's
  `("options","textScale")` binding.
- **Text scale, after the fix, live on the same instance** (497ea87 floors a
  scaled tile budget; 910fa1a caps the column ratio at the room beside a name
  of its minimum width). At 125 %: Grid 0 clips, Cards 0, Table's name cell
  117px with its Cost and Upkeep figures 2–10px over their cells — down from
  15–20px, and the name no longer collapses (it had gone to 13px when the
  columns scaled by the full ratio). At 150 %: Grid one 2px clip ("Wide
  Quay"), Cards 0, Table name kept and figures 25–35px over — a 720p panel
  cannot hold seven metric columns at that size, and the figures clip inside
  their cells rather than the row breaking. The setting was returned to 100 %.

### Screenshots again (2026-09-09)

`Page.captureScreenshot` had hung since 09-08 on both clients. Cause: the
desktop session's display outputs were all disconnected
(`/sys/class/drm/card1-*/dpms` = Off), so the game on the main prefix never
presented a frame and the capture never completed — nothing in the mod or
the tools. Under gamescope headless on `949230-b` both capture paths work
(`game_screenshot` and `scratchpad/shots/cdp-shot.mjs`, ~200KB PNGs of the
UI layer at 1280x720). First visual pass on df464f6, true 1280x720, Roads:
Cards, Grid and Table drawn as the DOM readings said; the hover card with
its two tiers and divider; the Group-by picker opening upward inside the
viewport. One defect the DOM probes could not see: a road's **Lot** reads
"0 × 0" in the Table, where the hover card (via `hasFootprint`) omits it.

### Visual pass across sizes (2026-09-09, 8808213)

Headless `949230-b`, one run, the size switched in-game through the Graphics
widget; `scratchpad/shots/shot-views.mjs` drives Cards, Grid and Table, the
hover card on the bottom-right tile, and the Group-by picker, and captures
each. Frames at **1920x1080**, **2560x1440** and **2560x1080** (and 1280x720
from the run above): tile names whole and wrapped at word boundaries in the
grid; the table's header aligned with its rows with "—" for a road's lot;
the two-tier hover card with its divider; the picker opening upward inside
the viewport. At 21:9 the panel keeps its stored width where the game's own
asset menu sits and leaves the extra width empty — vanilla's behaviour. The
only visual note is cosmetic: a hover card left open persists over the
picker when the pointer is not moved off the tile.

A harness lesson from the same run: the HUD's info button sits at (10,10)
and is `button` index 0 in-game, so "press the first button" does not close
Options there — its back arrow is the button with class `back-button…`
beside the OPTIONS heading, and the Options page stays mounted (offscreen)
after closing, so "is Options open" must be a visibility test.


### The table's column model (2026-09-09, cm-jqne)

The withdrawn measured-fit work left one open question: why the seven
metric cells drew narrower than their inline widths at the default
assembly. The answer was a wrong measurement, not flex. The row had been
read as 820rem and the "room" for the columns derived from it as 422rem;
on the same live row (headless `949230-b`, 1280x720, PanelWidth 1441) with
every column set to its comfortable width by hand, the seven cells drew at
exactly their 586rem, the name still had 327rem, and nothing overflowed.
Re-measured: the panel is 1441 − 385 = 1056rem and the row 1026rem, so the
chrome around the rows is 30rem, not 236, and the room beside a 260rem name
is 628rem.

The columns now move between their minima and their comfortable widths by
that room rather than by the panel's position in its range
(`getBuildingLensColumnWidths`, `tableColumnRoom`): a set that sums to the
room is what keeps the name at its basis, since every metric cell is
`flex: 0 0 auto` and the name is the only item that yields. Below the room
that holds the minimum set (about a 1326rem assembly) the columns sit at
their minima and the name gives way, as it always did there; the text
scale grows the figures only as far as the room allows. Unit-tested against
these numbers, 642 UI tests green.

Live on the new build, same setup, Roads in Table view:

| reading | before | after |
|---|---|---|
| inline widths vs drawn (7 columns) | equal, 422rem | equal, 586rem |
| worst cell overflow, 700 cells | 9px (Upkeep) | 1px |
| names overflowing, 100 rows | 0 | 0 |
| name element | 491rem | 327rem |

Frame `33-table-720-room-fit.png`: "¢4,000 /km" and "¢487 /km/mo." whole,
the Level and Parking headers no longer run together.

One pre-existing defect the probe surfaced: the header row is 1075rem wide
with 50rem of right padding where a row is 1026rem with 4rem, so the
identity header is 431rem against a 407rem identity cell and every metric
header sits 21rem (14px at 720p) right of its column. Queued, not fixed here.

### Tooling promoted from the scratchpad (2026-09-09, cm-th6g)

The scripts the passes above ran from a session scratchpad now live in the
repos, run against the live game before committing:

- `scripts/cs2-cdp-shot.mjs <port> <out.png>` (workspace) — the UI layer as
  a PNG over the DevTools protocol.
- `scripts/cs2-cdp-eval.mjs <port> <file.js>` (workspace) — evaluate a probe
  file in the page and print its result.
- `BetterBuildingMenu/UI/scripts/shot-views.mjs <port> <prefix>` — drive
  Cards, Grid and Table, the hover card on the bottom-right tile and the
  Group-by picker with the menu open, writing `<prefix>-<view>.png` each.
- `BetterBuildingMenu/UI/scripts/layout-probe.js` — the geometry probe:
  boxes leaving the viewport, clipped text, overlapping tiles, horizontal
  scroll, with overflow read as content past max(clientWidth, offsetWidth).
- `BetterBuildingMenu/UI/scripts/table-widths-probe.js` — each table
  column's inline width against its drawn header and cell, with overflows;
  the reading behind the column model above and cm-7kr8.

A probe is a synchronous IIFE returning a string: Cohtml's
`Runtime.evaluate` does not await a promise, so an async probe comes back
as `{}`.

### The table header's offset (2026-09-09, cm-7kr8)

Two causes, both in `buildingCatalog.module.scss`. `.columnHeader > * + *`
gives each header the rows' 3rem gap, and `.metricHeader`'s button-chrome
reset (`margin: 0`, same specificity, later in the file) took it straight
back: the row's cells stepped 103rem apart and the headers 100rem, so each
header sat 3rem further left per column — 21rem at Cost down to 3rem at
Parking. And `$table-trailing-reserve` counted no gap before the chevron,
where 33rem trail a 1026rem select inside a 1059rem rows box (chevron 26,
outer padding 4, gap 3), leaving the header's identity 3rem wider than the
cell's. The reset now keeps the gap, the reserve counts it once (37rem),
and `BUILDING_LENS_TABLE_ROW_FURNITURE` mirrors it (141rem; the name
budget it feeds said 332 where the name measured 327, now 329).

Live at 1280x720, PanelWidth 1441, Roads in Table view, from
`UI/scripts/table-widths-probe.js`:

| column | header left → cell left, before | after |
|---|---|---|
| Cost | 843 → 822 (21rem) | 822 → 822 |
| Upkeep | 943 → 925 (18rem) | 925 → 925 |
| Workers | 1059 → 1044 (15rem) | 1044 → 1044 |
| identity header / cell | 431 / 407 | 407 / 407 |

All seven columns at shift 0, widths unchanged at 586rem, worst overflow
1px across 700 cells, no name clipped. Frame
`34-table-720-header-aligned.png`.

### The table across sizes on the column model (2026-09-09, 875c12c)

Headless `949230-b` on a 2560x1440 screen, the size switched in-game, Roads
in Table view, `UI/scripts/table-widths-probe.js` and `layout-probe.js`
after `shot-views.mjs` (frames `35-1080p-*`, `35-1440p-*`,
`35-ultrawide-*`):

| size | columns (inline = drawn) | header shift | identity | worst cell overflow | clipped text |
|---|---|---|---|---|---|
| 1920x1080 | 586rem | 0 at all seven | 407 / 407 | 0px / 700 | none |
| 2560x1440 | 586rem | 0 | 407 / 407 | 2px | one Upkeep cell, "¢2,025 /km/mo." 157 in 155 |
| 2560x1080 | 586rem | 0 | 407 / 407 | 3px | four Upkeep cells, 118–119 in 116 |

No name clipped at any size (100 rows each), no overlaps, no horizontal
scroll. The Upkeep residual at 1440p and 21:9 is the class recorded in the
resolutions pass above — at 1.33px per rem text draws 2–3 % wider relative
to rem — and is smaller than before (three headers and cells at 1440p, now
one cell). The probe's rem is now the game's: 1/1920 of the width or
1/1080 of the height, whichever is smaller, since at 21:9 the game scales
by height and a width-based unit read 586rem as 439.

### The object picker removed (2026-09-09)

The picker tool went with the Find It separation: Find It ships the same
tool, and two mods binding the same toolbar glyph, the same
`BetterBuildingMenu.Picker` tool id, the same options bank and the same
mouse Apply action was the conflict the separation was for. Removed in
one cut, tests first (C# `PickerRemovalTests`, UI `pickerRemoval.test.ts`):

- C#: `PickerToolSystem`, `PickerUISystem`, `PickerTooltipSystem`,
  `PickerFlags`, `ObjectFilterOption` with `IOptionSection` and
  `OptionSectionUIEntry`; the `Apply` mouse action and its hidden
  `ApplyMimic` binding; the `OpenPanelOnPicker` setting; the
  `FindItPresent` and `PickerMenuRequest` bindings with
  `RequestVanillaMenu` and `IsFindItLoaded`; three `UpdateAt`
  registrations.
- UI: the toolbar glyph (`ToolbarIcon`, `PickerPicker.svg`), the picker's
  options bank (`PickerComponent`, `OptionsPanel`, `ContentViewType`), the
  vanilla-menu opener (`PickerMenuOpener`, `pickerMenuRequest`), the
  `pickerOption` action on the menu surface. `ToolOptionsVisibility` stays,
  for the lens alone, under `mods/ToolOptionsVisibility/`.
- Locale: the five filter-chip labels and the two `OpenPanelOnPicker` rows,
  every language (33 rows, after the 42 key-binding rows earlier today).

The Group-by picker in the control pane and the extension-menu "picker"
(vanilla's upgrade picker, which the extension menu replaces) are different
things and untouched. Suites: UI 641 + 69, C# 399.

### Grid names collapsing to "…e…d" (2026-09-09)

Reported on the main prefix at the default tile size: several Roads tiles
read "…e…d". Measured before touching anything: 77 of 100 Roads tiles
carried an ellipsis and twelve had collapsed to two characters a line;
closing and reopening the menu reproduced the same twelve at once, so it
was the first paint, not stale state. Then the mechanism, in the page: a
line whose text had just been swapped from a long name to a short one still
reported the long text's `scrollWidth` (171px in a 64px box) in the same
tick and read 64px a frame later; a brand-new line read 0. The tile name's
fit loop measured synchronously after every re-render, so each pass saw the
previous text's overflow again and shrank the budget once more, down to the
four-character floor.

Fix: every read waits two frames, the ResizeObserver callback included
(`TileName` in BuildingGrid.tsx), and the per-line arithmetic moved to
`lineBudgetFromDrawn` in domain/measuredFit.ts where it is unit-tested;
`tileNameMeasureContract.test.ts` pins the no-same-tick rule as a source
contract, the way the stylesheet contracts do.

After, same setup (frame `37-grid-100-fixed.png`): 100 tiles, none
collapsed, no line overflowing; 77 still elide, which is the honest budget
of a 64px line at this font — "Three-Lane / Asym…Road", "One-Lane /
One-…Road". That residual is the tile size, not the loop, and is a design
question: a third line, a wider default, or a hyphen-aware cut would each
change it.

## 2026-09-09 — release preparation for Paradox Mods

**Setup.** Main prefix 949230 (Steam + Paradox stack), Porterville save,
window set to 1920x1080 through the Graphics widget for the captures and
restored to 1280x720 afterwards. The deployed build was the Release
configuration package from `artifacts/BetterBuildingMenu` (md5 848dde11…),
copied to both Mods roots before launch.

**Release build live.** Indexed at OnGameLoaded (full pass) and skipped the
OnGameLoadingComplete pass as designed; Roads (204 entries) and Education &
Research (13) opened; Grid, Table and Cards rendered; the hover card drew
the City High School figures (cost, upkeep, capacity, parking, workers,
jobs, evening shift, XP, upgrades, lot).

**Store art.** `Properties/Screenshot_01..04.jpg` (1920x1080, JPEG q90) and
`Properties/Thumbnail.png` (1080x1080, rendered from `Properties/Logo.svg`; the first upload used a crop of the Roads grid). Captured
with `spectacle -b -n -e -a` on the activated game window: the devtools
`Page.captureScreenshot` returns only the UI layer over black, which is
fine for probes and wrong for store images.

**Uploader.** `ModPublisher` from the game's `.ModdingToolchain` runs under
the host dotnet 10 with `DOTNET_ROLL_FORWARD=Major`; auto-login from the
game's stored session succeeded (probe: `Update` against mod id
999999999 → "invalid or does not exist"). Run it from a scratch directory:
run from the toolchain folder it created a `C:/users/...` tree under
`Cities2_Data/Content/Game`, which made `DlcHelper.GetDlcAttributes` throw
and the game quit at boot ("Data is corrupted in Game database"). Details
in `docs/publishing.md`.

**Published.** `Publish` run from a scratch directory at 16:55 with the
configuration's image paths made absolute; the content folder listing
(dll, mjs, css, modinfo, images) was echoed by `-v`; result
"Mod published with Id=158589", access level Unlisted, version 0.1.0,
recommended game version 1.6.*. The listing resolves as "Better Building
Menu - Paradox Mods" at https://mods.paradoxplaza.com/mods/158589/Windows.

**Screenshots retaken (20:2x).** Porterville's frames showed missing assets, so
the four store screenshots were retaken in a new Windy Fjords game (Unlock All,
Unlimited Money, tutorials off, 11:20 in-game) on the main prefix at 1920x1080:
Roads grid, Roads table, Education & Research cards with the City High School
hover card, Education & Research grid. The subscribed Fort Johnson city was
tried first and crashed natively one to three minutes after every load, with
the mod removed from both Mods roots as well; it references assets this install
lacks (CitiesCarCustoms, PetrolPonyGarage, MuscleCar01–05, BusCO01,
NA_PoliceVehicle02, GrandHotel01). Pushed to the listing with `Update`.

**Table chevron (20:38).** The store screenshot showed a missing-glyph box at
the end of every table row: the expand control was U+2304/U+2303, which Noto
Sans lacks. It is now the game's own `Media/Glyphs/StrokeArrowDown.svg` /
`StrokeArrowUp.svg` under a mask (the header's close button's construction).
Live in a new Windy Fjords game at 1920x1080: 100 rows, every one carrying
the masked glyph at 24x24px, zero text spans left; the frame shows plain
down arrows. `Screenshot_03.jpg` retaken and pushed with `Update`.

**0.1.1 published (20:4x).** Metadata updates do not replace the package, so
the chevron fix went up as a new version: `ModVersion` 0.1.1, csproj and
modinfo bumped, Changelog.json entry mirrored into `<ChangeLog>`, Release
package rebuilt (assembly stamped 0.1.1) and pushed with `NewVersion`:
"New mod version published".

**Expanded table rows (20:5x).** In the expanded City High School row the
labels "Ground pollution" and "Air pollution" wrapped under their values and
the Placement chips drew over the second line; every base-game row printed
"DLC -2009". Fixes: a `.rowDetail` / `.rowProvenance` pair is `flex: 0 0 auto`
with `white-space: nowrap` (stylesheet contract), and DlcId's sentinels
(-2009 BaseGame, -1 Invalid, -1111 Virtual) produce no DLC chip (unit test).
Live in a new Windy Fjords game at 1920x1080: the school's block shows every
pair on one line with the chip rows clear beneath, and both rows end with
"Source Vanilla" alone. Published as 0.1.2 with `NewVersion`.
