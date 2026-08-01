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

Latest local result: backend build, UI webpack build, 22 backend catalog/icon tests, 6 UI
contract tests, package identity guard, isolated deployment to both game Mods
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
