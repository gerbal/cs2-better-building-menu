# Better Building Menu — structure, practices and documentation review

> **Status, 2026-09-24: historical.** A snapshot at `dc1beea`. The eighteen bugs
> in section 1 have been fixed since, and most of its other findings acted on,
> in PRs #2 to #44. The per-load state that section 2.2 called for is done
> (#30). What is still open is on the [roadmap](../roadmap.md), including
> splitting `PrefabIndexingSystem` and naming the UI system's partials. Line
> numbers are as of `dc1beea` and no longer match.

**Date:** 2026-09-22, at `dc1beea` (0.1.12).

**Scope:** every tracked file under `BetterBuildingMenu/`, `BetterBuildingMenu.Tests/` and `docs/`, the root build and metadata files, and the store metadata. Paths are relative to the repository root.

**What ran:**
- `npm ci`, `npm test` and `tsc --noEmit` in `BetterBuildingMenu/UI`. All 658 unit and 77 render tests pass, and `tsc` is clean.
- The C# was not built or tested: this environment has no `dotnet` and no game DLLs. `docs/verification.md` records 428 backend tests passing for 0.1.12.

**Confidence labels:**
- **Verified:** I read the code path end to end, or reproduced the behaviour.
- **Likely:** the code strongly implies the behaviour, but it needs a check in the running game.

Line numbers are for `dc1beea`.

---

## Summary

1. **The 2026-09-10 review's comment work landed; its structural items did not.**
   - Landed: all ten "worst offenders", every P1 item, and the P2 bulk pass. The comment ratio fell from 31% to 17%, and blocks of 9 or more lines fell from 58% of comment lines to 6%.
   - Not landed: every P3 item. `PrefabIndexingSystem.cs` is still 3,390 lines with the audit inside. The partials still have the same names. Neither drift test exists, and both drifted pairs still disagree. The test-only exports are still there.
2. **Eighteen bugs turned up while reading for structure (section 1).**
   - Five are visible to players in normal use: Enter in a grouped search, a trailing space in search, the filter-rail search box, "Load N more", and the untranslated Options screen.
   - Two corrupt the index after load: the partial re-index, and the RoadBuilder filter.
   - One is in the release tooling: `build.sh`'s identity guard fails open.
3. **The largest cheap win is deletion.**
   - About ten indexed fields are computed for every prefab and never read.
   - `PrefabTrackingSystem` scans the whole city every minute for a Locate feature the UI never calls.
   - An `async void` PDX lookup reflects into a private SDK field to fill two dates nothing reads.
   - The UI carries about 730 dead lines of SCSS.
4. **Structure: the domain layer is good; the edges are not.**
   - The query, lens state and grouping rules are small, pure-ish, immutable and well tested.
   - The indexing system and the UI system are the opposite: static global state, bidirectional coupling, synchronous full passes and reflection into game internals.
5. **Most of the planning and verification docs describe the pre-publish Find It fork.**
   - `PLANNING.md`, `docs/roadmap.md` and `docs/layout-concept.md` describe features that no longer exist.
   - So do the first 530 lines of `docs/verification.md`, which open by saying the mod is "not a publishable release".
6. **Release hygiene has several loose ends:**
   - five version sources, one of them stale (`UI/mod.json`, `0.1.0`);
   - no LICENSE file in a public repository whose right to redistribute rests on an MIT statement;
   - no CI;
   - no `.editorconfig`;
   - 13 translations that cover 71 of 271 keys.

---

## 0. What happened to the 2026-09-10 review

| Area | Status |
|---|---|
| Ten worst offenders (§2.6) | All fixed. |
| P0: dead accessors, `OptionsUISystem`, `ClearSearchBar`, NUL byte, dead `.card*` | Fixed, with residue. `BuildingCatalogAdapter.GetMenuCategoryCounts` (`:142`) and `GetStripAxis` (`:189`) still have no callers. One stacked `<summary>` is left (`BuildingCatalogAdapter.cs:444-457`). Raw U+001F bytes remain in `Domain/StripAxes.cs:39` and `Services/BuildingCatalogQueryEngine.cs:489`. |
| P1: verified-wrong comments | All fixed. |
| P2: comment rule and bulk pass | The pass is done: no `cm-` ids, commit hashes, `SPIKE` markers or `file:line` references remain in code. **The rule itself is not in this repository.** `verification.md:2205` says "comment pass under the new rule", but the rule lives in an `AGENTS.md` outside the repo. |
| P3: split `PrefabIndexingSystem` | Open. It has shrunk to 3,390 lines. `LogVanillaMenuAudit`/`LogVanillaMenuCoverage` (`:801-1061`) and `PopulateAnalyticalData` (`:1248-1793`, 546 lines) are still inside. Lines `679-1069` are still indented one level too deep. |
| P3: rename the `BuildingMenuUISystem` partials | Open. All 19 `CreateTrigger` calls are in `Setup.cs`; their handlers are in `Bindings.cs`. |
| P3: two drift tests | Open, and both pairs still disagree: `BuildingLensWidth.Min = 1000f` vs `BUILDING_LENS_MIN_WIDTH = 735`, and C# `DensityOrder` vs TS `DENSITY_ORDER`, which lacks `Mixed` and `LowRent`. In both pairs one side is dead code (§4.2), so delete rather than test. |
| P3: test-only production exports | Open. The whole list from §1.4 is still present. |
| P3: one noun | Open. Counts: `Lens` 899, `Menu` 1,875, `Catalog` 1,442. |

The review document itself now misleads in four ways:
- It has no status banner.
- Its first line has an absolute path from a personal machine.
- It points to an `AGENTS.md` and a `cm-` tracker that aren't in this repository.
- All of its line numbers are stale.

Add a two-line status header pointing here.

---

## 1. Bugs found during the review

These came out of a structure review rather than a bug hunt, so the list is not exhaustive.

### 1.1 Player-visible

| # | Bug | Where | Confidence |
|---|---|---|---|
| U1 | **Enter arms the wrong building, once per group.** `BuildingGrid` and `BuildingList` each add a `document` `keydown` listener that places `topSearchResult(ordered, …)`, and `GroupedResults.renderLeaf` mounts one of them per leaf group. `BuildingCatalogGrouping.Effective` never turns grouping off during a search. One Enter therefore sends N `SetCurrentPrefab` triggers, and whichever listener runs last wins. Ranking is within a group, not across groups, so "top" is not the best overall match. The Table view has no Enter handler at all. | `UI/src/mods/BuildingGrid/BuildingGrid.tsx:133-146`, `BuildingList/BuildingList.tsx:71-84`, `GroupedResults/GroupedResults.tsx:246-258` | Verified (code path) |
| U2 | **A trailing space drops search matches.** The filter tests the raw text with `IndexOf`, but the relevance score trims it, and nothing trims between the text box and the query. So `clinic ` (with the space) excludes every name that ends in "Clinic". With `AutoWidenSearch` on, the zero-hit result then calls `SearchEverything()` and discards the player's menu. The same mismatch makes `BuildingCatalogRelevance`'s subsequence and category tiers unreachable, so their unit tests (for example "dcc" finding Disease Control Center) describe behaviour the product never shows. | `Services/BuildingCatalogQueryEngine.cs:138-144` vs `Domain/BuildingCatalogRelevance.cs:22`; `Domain/BuildingCatalogLensState.cs:168-173`; `Systems/BuildingMenuUISystem.Methods.cs:77-83` | Verified |
| U3 | **"Found N elsewhere" is almost always 0 when a category tab is selected.** The widened count clears `UiMenu` but keeps `UiCategory`, `StripTabs` and `SchoolTier`, and `MatchesVanillaMenuTree` goes on filtering by category. | `Systems/BuildingMenuUISystem.Methods.cs:86-92`; `Services/BuildingCatalogQueryEngine.cs:255-266` | Verified |
| U4 | **The filter-rail search box stores the change event, not the text.** `onChange={setQuery}` passes the event into state, and `filterRailOptions` then calls `query.trim()`. Every other user of the same vanilla `TextInput` reads `event.target.value`. The box appears on any facet with more than 20 options, and nothing renders `FilterRail` in tests. | `UI/src/mods/FilterRail/FilterRail.tsx:112-117`; `UI/src/domain/filterRail.ts:100`; compare `BuildingMenuHeader.tsx:54-58` | Likely (a crash when typing) |
| U5 | **Dragging to resize is 1.5× too fast at 1080p and 2× at 1440p.** `REM_IN_PX = 0.6667` is documented as true "at every resolution". The repo's own stylesheet test says that is the 1280×720 value, because the UI is authored at a 1920 design width. The live check ran at 720p. | `UI/src/domain/buildingLensLayout.ts:248-257`; `UI/test/stylesheetContracts.test.ts:325-328` | Likely |
| U6 | **"Load N more" shows the window size, not the step.** The label uses `Math.min(remaining, limit)`, where `limit` is the current window (100, 200, …), but one click adds `WindowStep = 100`. The comment calling the request idempotent is also wrong: `LoadMore()` adds 100 per trigger, so a double-click, or the rAF loop firing before layout settles, loads 200. | `UI/src/mods/BuildingCatalog/BuildingCatalog.tsx:244`; `useCatalogWindow.ts:47-51`; `Domain/BuildingCatalogLensState.cs:105-119` | Label verified; double-fire likely |
| U7 | **The Options screen is probably untranslated, as raw keys, in 13 languages.** Every `Locale/*.json` has the same 71 keys, and none is an `Options.OPTION[...]` or `OPTION_DESCRIPTION[...]` key. `LocaleHelper` registers each language with no English merge, and its own comment says a missing key "answers … with the id itself". `ja-JP`, `pt-BR` and `uk-UA` are 100% English text. | `BetterBuildingMenu/Locale/*.json`; `Utilities/LocaleHelper.cs:92-96` | Data verified; rendering likely |
| U8 | **The metrics badge and the drawer disagree.** Two functions are both called `countActiveMetricRanges`: `filterRail.ts` counts bounds, `buildingCatalogRanges.ts` counts ranges. A cost range of 10–20 shows 2 on the rail and 1 in the drawer. Separately, `hasMetricRange(undefined)` returns `true`. | `UI/src/domain/filterRail.ts:115-121`; `UI/src/domain/buildingCatalogRanges.ts:109-120` | Verified |
| U9 | **Toggling `ReplaceVanillaBuildMenu` mid-session leaves the two sides disagreeing.** The binding is published once, and `OnSettingsApplied` republishes only the tile size, while C# reads the live setting. This was noted in the last review, and it is still open. Neither the listing nor the option description mentions "takes effect on next load". | `Systems/BuildingMenuUISystem.Setup.cs:151`, `:271-274`; `Bindings.cs:176`, `:242` | Verified |

### 1.2 Indexing correctness

| # | Bug | Where | Confidence |
|---|---|---|---|
| I1 | **A partial re-index reprocesses the whole processor, then loses the duplicate-name numbering.** The Created/Updated query only decides whether to skip; the entities then come from the unfiltered `query`. `AddPrefab` resets `Name` from `GetAssetName`, but `AddNumberToDuplicatePrefabNames` runs only on full passes. One RoadBuilder edit therefore re-indexes every road on the main thread, and "Foo 01"/"Foo 02" become two indistinguishable "Foo" entries until the next full pass. | `Systems/PrefabIndexingSystem.cs:476-493`, `:1074`, `:615-622` | Verified |
| I2 | **The RoadBuilder discard filter is resolved after the pass that needs it.** The first full pass now runs at `OnGameLoaded`, but `roadBuilderDiscarded` is still set in `OnGameLoadingComplete`, and that pass is skipped when lock drift is 0. Discarded RoadBuilder prefabs are therefore indexed on the first load of a session. If RoadBuilder renames the type, `GetType` returns null and `new ComponentType(null, …)` throws inside the game's loading callback. This regressed when indexing moved to `OnGameLoaded`. | `Systems/PrefabIndexingSystem.cs:224-237`, `:259-266`, `:529` | Verified |
| I3 | **A Find It include with a bad category pair drops the asset.** The include values are cast to enums without validation, so a pair the index doesn't lay out throws further down. *Corrected after review:* this row first also called the exclusion gating a bug, since the exclude check is nested inside `m_IncludeCategories.Any()`. That gating is Find It's own rule: a bare `exclude=FindIt` opts an asset out of Find It's prop generators, not its catalog. | `Systems/PrefabIndexingSystem.cs:552-584` | Cast risk likely; gating is intended |
| I4 | **`FormatWords` is culture-sensitive.** It calls `ToUpper()`, which Mono formats as "İndustrial" when the OS locale is Turkish; it builds the fallback display names and the bonus labels. `StringComparer.CurrentCultureIgnoreCase` orders the DLC facet. The net10/ICU test runner cannot show either difference. | `Utilities/SearchUtil.cs:57-64`; `Services/BuildingCatalogAdapter.cs:848` | Verified |

### 1.3 Latent and tooling

| # | Bug | Where | Confidence |
|---|---|---|---|
| L1 | **`PrefabTrackingSystem` is a dead feature with live costs.** Every minute a `System.Timers.Timer` sets `Enabled = true` from a thread-pool thread. The system then materialises every object and edge in the city on the main thread. `_usedPrefabs` starts null and `GetPlacedEntities` dereferences it. The system has no `OnDestroy`, so neither the timer nor `EventPrefabChanged` is ever released. Its only consumer, `OnLocateButtonClicked`, is unreachable: the UI port only ever calls `activatePrefab`. It is also registered in `PrefabUpdate`, which `Mod.cs:94-96` says does not tick every frame. | `Systems/PrefabTrackingSystem.cs:26`, `:52-54`, `:57-89`, `:115-118`; `UI/src/mods/BuildingCatalog/BuildingCatalog.tsx:204` | Verified |
| L2 | **`GenericUIReader<T>` reflects into the private `ValueReaders.s_Readers` in a static initializer.** If a game patch renames that field, the type initializer throws and every `CreateTrigger` fails, so the whole UI goes dead. It also writes into the game's global reader registry. Every trigger in the mod takes a primitive, which the built-in readers already handle, so it isn't needed. Its `ReadGeneric` has an inverted `IsAssignableFrom` check. | `Utilities/ExtendedUISystemBase.cs:321-360` | Verified |
| L3 | **`build.sh package`'s Find It identity guard fails open.** `if rg …; then` treats "rg: command not found" (exit 127) and any `rg` error (exit 2) as "no match", then prints "Package ready". Reproduced with `rg` off `PATH`. | `build.sh:83` | Reproduced |
| L4 | **`FillPdxModsData` is an `async void` launched on every full pass.** It has no try/catch, awaits the SDK sequentially per mod, can overlap itself, and reflects into `PdxSdkPlatform.m_SDKContext`. It fills `InstalledDate`/`UpdatedDate`, which nothing reads. | `Systems/PrefabIndexingSystem.cs:2466-2484`; `Utilities/PdxModsUtil.cs:22` | Verified |
| L5 | **The mod-detection flags are cached for the life of the process.** `Mod.IsRoadBuilderEnabled` and its two siblings are `static bool?` caches. Commit `fe641a0` records that a playset mod can load at the next city load with no restart, so these can go stale. They also use `StartsWith` without a `StringComparison`. | `BetterBuildingMenu/Mod.cs:28-37` | Verified (code); impact likely |

---

## 2. Deviations from C# / Unity DOTS / CS2 practice

### 2.1 ECS and the main thread

- **Full passes are synchronous, unchunked and not atomic.**
  - `RunIndex(true)` clears the live index first (`:452`), then runs a dozen `Index*` steps. Most of those steps have no try/catch.
  - An exception therefore leaves a half-built index and propagates into the game's load or localization dispatch.
  - Fix: build into new structures, swap them in at the end, and wrap the whole pass in a top-level catch that keeps the old index on failure.
- **Queries are built in the update path.**
  - `GetEntityQuery` is called in `RunIndex` and every `Index*` method rather than once in `OnCreate`. `SystemBase` de-duplicates them, so nothing leaks, but the partial pass also mutates the `EntityQueryDesc[]` the processor returned.
  - Cache two queries per processor in `OnCreate`, full and changed-only. That also fixes I1.
- **Disposal of `ToEntityArray(Allocator.Temp)` is inconsistent.** Some sites dispose and some do not. Temp memory is reclaimed at the end of the frame, so this isn't a leak, but `using var` everywhere would read as intentional.
- **Two `TempJob` hash maps and two dependency walks per prefab.**
  - `GetDevTreeBranch` and `GetUnlockRequirements` each call `ProgressionUtils.CollectSubRequirements` for the same entity (`:2083`, `:2153`).
  - Walk once into one reused `Allocator.Temp` map.
  - Iterating the map is in bucket order, so which dev-tree node "wins" for a multi-parent asset is arbitrary.
- **Reflection per prefab.** `CategoryIconAttribute.GetAttribute` does `ToString` + `GetMember` + `GetCustomAttributes` twice per prefab (`:1076-1077`), and throws on undefined values. Build a static table once.
- **Debug strings are built with Debug off.** `Mod.Log.Debug($"\t\tSkipped: {prefab.name}")` (`:600`) builds a string for every rejected entity of every processor. Guard it the way `:517` already does.
- **Refreshes are driven from the indexer.**
  - `OnUniqueAssetStatusChanged` bumps `IndexGeneration` and synchronously calls `RefreshBuildingCatalogFromIndexing()` (`:3072-3077`). That misses the snapshot cache and rebuilds the projection, even while the panel is closed. N placed-unique events in one frame cost N rebuilds.
  - Fix: let `BuildingMenuUISystem.OnUpdate` compare `IndexGeneration` against the last one it published, and refresh once, only while the panel is open. This also removes the indexing→UI back-reference (§2.2).
- **The same system is registered in two phases.**
  - `PrefabIndexingSystem` is registered in both `PrefabUpdate` and `UIUpdate` (`Mod.cs:93-97`), so one system does two jobs.
  - A small `UnlockWatcherSystem` in `UIUpdate` would make the split explicit and avoid a partial pass running twice in one frame.
- **Structural changes in a loop.** `ClearVanillaMenuHighlights` calls `RemoveComponent<UIHighlight>` once per entity (`Bindings.cs:76`). Batch it through a `NativeList` or an `EntityCommandBuffer`.

The idle frame is cheap, and that is worth keeping:
- `OnUpdate` gates on `IsEmptyIgnoreFilter` and dirty flags.
- No `GetterValueBinding` is polled.
- Large payloads are `IJsonWritable`.
- `ApplyUnlocks` patches in place, and `LockStateDrift` avoids a second pass.

### 2.2 Lifecycle, static state, coupling

- **Per-world state is held in statics:**
  - `BuildingMenuUtil.CategorizedPrefabs` and `IsReady` (`IsReady` is never reset at preload);
  - about 15 static caches plus `_instance` in `PrefabIndexingSystem` (`:46-111`);
  - `PrefabIndexingSystem.IndexGeneration`;
  - `BuildingCatalogAdapter.ToolbarSelection` (a public static setter, although the state belongs to one adapter instance);
  - `PlacedUniqueRegistry`;
  - `AssetPackRegistry`, which is written and never read;
  - `PrefabTrackingSystem._usedPrefabs`.

  The tests mutate several of these without an xUnit `[Collection]`, and xUnit runs test classes in parallel.

  An instance `CatalogIndex` (by id, by name, ordered view, placed uniques, generation), created per load and injected, would fix both problems. It would also replace the O(n) LINQ scan in `BuildingMenuUtil.Find`.
- **Indexing and UI depend on each other in both directions.**
  - The UI calls static `PrefabIndexingSystem.*` queries.
  - The indexer creates the UI system in its own `OnCreate` (`:135`) and calls back into it.
  - `Services/BuildingCatalogAdapter.cs:5` imports `BetterBuildingMenu.Systems`.
- **Handlers are never unsubscribed:**
  - `EventUniqueAssetStatusChanged` (`PrefabIndexingSystem.cs:149`);
  - `EventPrefabChanged` and `EventToolChanged` (`Setup.cs:139-140`);
  - the tracking system's timer and event (L1).

  They share the world's lifetime, so the risk is low, but each is a one-line `-=`.
- **`Mod.OnDispose` leaves registrations behind.** It removes neither UI host location nor the locale sources. CS2 only disposes mods at exit, so this is low impact.

### 2.3 Reflection into game internals

| Site | Target | Fails safe? |
|---|---|---|
| `Utilities/ExtendedUISystemBase.cs:323` | `ValueReaders.s_Readers` (private static) | **No.** Every trigger dies (L2). Delete it. |
| `Systems/BuildingMenuUISystem.Bindings.cs:91-99` | `ToolbarUISystem.m_ToolbarGroupsBinding`, `m_AssetMenuCategoriesBinding` | Yes, but **silently**. Log a Warn once when a field is missing, so a game patch shows up in the log. |
| `Utilities/PdxModsUtil.cs:22` | `PdxSdkPlatform.m_SDKContext` | Yes. The feature is dead (L4). |
| `Systems/PrefabIndexingSystem.cs:265` | `Assembly.Load("RoadBuilder").GetType(...)` | **No** (I2). |
| `Systems/PrefabIndexingSystem.cs:157-181` | own-assembly processor discovery, `GetConstructors()[0]` | **No.** A processor without a public constructor throws in `OnCreate`. `List.Sort` is unstable, so the order of overlapping processors (last writer wins at `:1235`) is not deterministic. |

### 2.4 C# idioms and source hygiene

- **Nullable is enabled but nominal.**
  - Legacy types (`PrefabIndexBase`, `PrefabIndex`, `BuildingMenuUtil.GetPrefabBase`, `IPrefabCategoryProcessor`'s `out` parameter) return or store null through non-nullable types.
  - Newer code sprinkles `!` after `string.IsNullOrWhiteSpace`, because net48's BCL isn't annotated.
  - Fix: polyfill `NotNullWhenAttribute`, annotate `TryCreatePrefabIndex(..., [NotNullWhen(true)] out PrefabIndex? ...)`, clear the warnings, then set `<WarningsAsErrors>nullable</WarningsAsErrors>`.
- **`BuildingCatalogEntry` is a positional record with about 68 parameters** (`Domain/BuildingCatalogEntry.cs:13-193`).
  - Its `///` comments on positional parameters attach to nothing; `MenuBranchCount.cs` does it correctly with `<param>`.
  - Its `string[]` members give it reference equality while it looks like a value.
  - It mixes three lifetimes: index-time facts, city state (`IsAlreadyBuilt`) and per-page view state (`GroupPath`, `GroupLabelId`).
  - Better: a nominal record with `required`/`init` properties (polyfill the attributes next to `IsExternalInit`), grouped into sub-records.
- **The JSON writers are written by hand.**
  - There are 15 `Write` methods of `PropertyName("x"); Write(X)`.
  - `uiMenu`/`uiCategory` are serialised on every entry and read by nothing in `UI/src`.
  - The C#/TS contract is checked in one direction only (`UI/test/entryContract.test.ts`).
  - Add the reverse check, or generate the writers.
- **Stringly-typed ids are duplicated across C# and TS:**
  - sort columns (`BuildingCatalogQuery.OfferedSortColumns` vs `buildingCatalogContracts.ts`);
  - group dimensions;
  - facet ids;
  - `Availability.All`;
  - `MaxLimit` 2000 vs TS `MAX_CATALOG_PAGE_SIZE` 500.

  They are held as `public static readonly string[]`, which anyone can mutate. Expose them as `IReadOnlyList<T>`, and generate one shared constants file for both sides.
- **English presentation text is hard-coded in C#.** Examples: "Other", "From the start", "₡5k–₡25k", "2×2 and under", "No DLC required". One of these labels, `BuildingCatalogLabels.DensityTier`, is also the density tab's **match key** (`Adapter.cs:168-170`, `QueryEngine.cs:218`), so translating it would break tab matching.
- **The same helper exists in several copies.**
  - `FormatFacetWords` is byte-identical in `Domain/BuildingCatalogLabels.cs:91-129` and `Services/BuildingCatalogAdapter.cs:993-1031`.
  - There are five word splitters in all, three of them regex-based on the per-page-item path.
- **Formatting is inconsistent, with no `.editorconfig`:**
  - 40 of 162 `.cs` files carry a BOM;
  - 28 files use spaces and the rest tabs, and 4 mix both within one file;
  - 8 files use file-scoped namespaces and 152 block namespaces;
  - raw U+001F bytes appear in two files.
- **`Mod.cs` has residue:** unused `using`s (`Colossal.Core`, `Colossal.Reflection`, `System.Reflection`, `Unity.Entities`), usings that `GlobalUsings.cs` already provides, a `$"betterbuildingmenu"` string with no interpolation, and three blank lines at `:90-92`.
- **`Setting.SetDefaults()` is empty.** The defaults live in property initializers, so anything that calls `SetDefaults` resets nothing.

### 2.5 Layering and testability

- **`Domain/` is not pure.**
  - Hard ECS and game dependencies: `PrefabIndex`/`PrefabIndexBase` (`PrefabBase`, `int2`), `IPrefabCategoryProcessor` (`EntityQueryDesc`), `VanillaMenuPlacement` (`Entity`), `ZoningSurface` (`Game.Zones`).
  - About 15 records implement `IJsonWritable`, so even "pure" tests load `Colossal.UI.Binding`.
  - `BuildingCatalogLabels` reaches `GameManager.instance` through `LocaleHelper`. Its bare `catch` is what lets its tests pass.
- **The tests run on a different runtime from the mod.**
  - The test project references 18 game DLLs and runs on **net10/CoreCLR with ICU**, at the default C# version.
  - The mod runs on **Mono/net48 at C# 11**.
  - The culture-sensitive spots (I4) are exactly the kind of difference this hides.
- **The payoff of fixing this is CI.**
  - Move the `Write` methods into `partial` serialization files.
  - Move `PrefabIndex*`, the processor contract and `VanillaMenuPlacement` to a game-facing folder.
  - Inject the translator.
  - Put the adapter behind an `ICatalogSource`.
  - The remaining core can then compile as `netstandard2.0` (Mono loads it) and be tested on a GitHub runner, with no game DLLs.

### 2.6 Structure

- **`PrefabIndexingSystem.cs` is still a god class.** Of its methods over about 150 lines:
  - `PopulateAnalyticalData` is 546 lines of `if (TryGetComponent<X>)`;
  - `RunIndex` is 231 lines with 8 `if (full)` branches;
  - `IndexZones` is 186;
  - `AddPrefab` is 172.

  It also holds the processor loop, unlock and dev-tree text formatting, parking geometry, the vanilla menu walk, the zone catalog, milestones, the audit and coverage logs, DLC diagnostics, silhouette priming, the PDX lookup, unique tracking and a static query API.

  A split that follows the existing seams: `PrefabFactReader` (split per component family), `UnlockInfoReader`, `VanillaMenuIndex` (with the query API), `ZoneIndex` and `IndexDiagnostics`.
- **About 14 of the 24 `PrefabCategoryProcessor` classes are boilerplate:** "one query, `prefab is T`, fixed category/subcategory".
  - A rule table would replace roughly 600–800 lines with about 60, and give an explicit order in place of discovery by reflection plus an unstable sort.
  - Keep classes for the real classifiers (ZonedBuilding, ServiceBuilding, MiscBuilding, Prop, MenuPlaced, Zone, Lanes, Roundabout, Decals).
  - Processors also read indexing statics (`IsPlacedInVanillaMenu`, `GetZoneDensity`), so they depend on `IndexZones` having run first. Pass an `IndexContext` into `TryCreatePrefabIndex` instead.
- **Most of the three-level `CategorizedPrefabs` index is unread.**
  - The catalog reads `[Any][Any]`.
  - `[Category][SubCategory]` is read by one method.
  - `[Category][Any]` is written and never read, and `RemoveItem` doesn't clear it.
  - `CleanupBrandPrefabs` edits only the sub-lists, so it changes nothing the UI shows.
  - Collapse it to one `Dictionary<int, PrefabIndex>`.
- **The `BuildingMenuUISystem` partials are named by kind, not responsibility** (`Setup`/`Bindings`/`Methods`). Suggested names: `Lifecycle`, `MenuRouting`, `QueryTriggers`, `Publish`. Put each `CreateTrigger` next to its handler.
- **Diagnostics are logged at Info on every full pass.**
  - Two lines per processor, plus `[PROCESSOR-CENSUS]`, `[MENU-AUDIT]`, `[DLC-AUDIT]`, `[MENU-COVERAGE]` and `[ZONE-PARITY]`, the last of which joins every dropped zone name into one line.
  - That is more than 100 lines and real LINQ work per pass, up to twice per load and again on every language change.
  - `[LENS-REFRESH]` logs at Info on every refresh.
  - Move these to Debug, or behind a "diagnostics" setting.

---

## 3. UI (React / TypeScript / SCSS)

### 3.1 Rendering cost

**There is no `React.memo` anywhere in `src/`,** and a drag re-renders the whole catalog on every mouse move:
- `LensResizeHandle` triggers `SetBuildingLensPanelHeight` on every `mousemove`.
- The echo re-renders `BuildingCatalogComponent` (11 `useValue` subscriptions), and with it every row or tile, the control pane and the header.
- Search keystrokes do the same through `CurrentSearch`.
- Children couldn't skip re-rendering even if memoised, because callbacks and the `separators`/`labels` objects are rebuilt on every render (`TableView.tsx:77-86`).

**`TableRow` builds the hover-card context once per row** (`TableRow.tsx:70`). That goes against the hook's own documentation: "Read the live city state ONCE, in the component that owns the list" (`BuildingHoverCard.tsx:85-89`). Grid and List do it correctly. The window can hold 2,000 rows (`BuildingCatalogQuery.MaxLimit`), which makes this about 100k `translate` calls per render.

**The load-more check runs every frame.** `useCatalogWindow`'s rAF loop runs for as long as `hasMore` is true. Each frame it calls `querySelectorAll("[data-catalog-entry]")` over every row and walks up the parents reading `scrollHeight`, which forces a layout read. Find the scroller once, and poll `scrollTop` on a timer instead.

Cheapest order of fixes:
1. `memo(BuildingCatalogComponent)` (it has no props) and `memo(LensControlPane)`.
2. Call `useHoverCardContext` once in `TableView`.
3. A `TableContext` with memoised helpers, and `memo(TableRow)`.
4. Throttle the drag trigger to one per animation frame.

Rows and tiles have fixed heights, so windowed rendering is a natural follow-up.

### 3.2 Bindings and commands

- **About 65 `bindValue` declarations cover roughly 30–38 distinct C# bindings.**
  - More than a dozen are declared 2–4 times, some with **different fallbacks**. For example, `BuildingCatalogSortColumn` has no fallback in two files and `"Name"` in two others; `PanelWidth` is `undefined` in one file and `0` in another.
  - Four subscriptions are never read: `ChipRow.tsx:49-50`, `LensControlPane.tsx:89`, `MenuCategoryStrip.tsx:79`.
  - `LensControlPane` subscribes to the **whole page** (up to 2,000 entries) to read one field, `reorderableSortColumns`.
- **Commands repeat the same plumbing with loose types.**
  - There are four identical command types (`args: any[]`).
  - `trigger(mod.id, command.method, ...command.args)` is copied 12 times.
  - Eight raw-string triggers bypass the command modules entirely.
- Fix: one `src/bindings.ts` with one typed declaration and one fallback per binding, a typed command union with one `send()`, and `reorderableSortColumns` published as its own binding.

### 3.3 Robustness inside vanilla's tree

- **No error boundary.** The mod renders inside the game's UI through `moduleRegistry.extend`, and `src/` has no `componentDidCatch`, so a render error in our code (U4, for one) propagates into the game.
- **`getModule` lookups mostly assume the module exists:**
  - `BuildingMenuSurface.tsx:18` + `:59`, `BuildingMenuHeader.tsx:18-19`, `BuildingCatalogMetricFilters.tsx:66-67` and `FilterRail.tsx:17` would throw if a game update moved the path.
  - `VanillaComponentResolver.tsx:108` uses `!!`.
  - `ExtensionMenu.tsx:16` and `VanillaTabBarHost.tsx:22-28` already do this correctly.
- **`LensToolOptions` calls vanilla's component with no props,** then `.push`es into `result.props.children`, mutating vanilla's element. It throws if vanilla ever returns a single child, and in a React dev build, where children arrays are frozen. Use `cloneElement` with a keyed child.
- Fix: a small `SafeExtension` boundary that falls back to `<Component {...props}/>`, and every `getModule` routed through the resolver.

### 3.4 Architecture and TypeScript

- **`domain/` mostly holds.** 43 modules; three import `cs2/api` (`menuSurfacePort.ts`, `textScaleSetting.ts`, `unitSettings.ts`); none imports React.
  - Move the hooks into `src/bindings/` or `src/hooks/`.
- **Business logic sits in components:**
  - hover-card line assembly (`BuildingHoverCard.tsx:146-357`);
  - facet routing (`LensControlPane.tsx:125-157`);
  - `setSort`, copied word for word in `BuildingCatalog.tsx:207-216` and `LensControlPane.tsx:166-177`.
- **Duplication is justified by comments that are no longer true.**
  - `buildingCatalogContracts.ts:82-89`, `vanillaToolbarSelection.ts:9-22` and `buildingLensMetricFormat.ts:155-156` say a runtime import would break the test runner.
  - It wouldn't: the swc harness resolves extensionless imports, and `buildingLensLayout.ts` already imports `./textScale` at runtime.
  - `entityIndex` is byte-identical in two files.
- **Production code is reachable only from tests.**
  - `domain/filterContracts.ts` and most of `domain/zoningHierarchy.ts`;
  - the milestone-tab functions in `menuProgression.ts`;
  - five of the seven functions in `buildingCatalogFacets.ts`;
  - `getCatalogWindowSummary`. The UI builds its own **ungrouped** "Showing 1200 of …" string instead.
  - `getBuildingLensRowGeometry` and `getBuildingLensCatalogMaxHeight` feed `data-*` attributes that nothing reads.
- **The tests are never typechecked.** `tsconfig.json` excludes `test/`, and TS 4.9 (from `^4.8.4`) can't compile the tests' `.ts`-suffixed imports. That is how `test/harness/render.tsx` builds entry fixtures with a field that doesn't exist (`isUniqueMesh`) and about 14 required fields missing, all hidden by `as BuildingCatalogEntry`.
  - Upgrade to TS 5.x and add a `tsconfig.test.json` with `allowImportingTsExtensions` and `noEmit`.
  - `--noUnusedLocals` finds 19 unused symbols today.

### 3.5 Tooling

**`package.json`:**
- It has no `name` and no `private`.
- `main` and `types` point at `build/index.js` and `build/index.d.ts`, which don't exist.
- `exclude` is not a package.json key.
- `engines: ">=18"` is too low: `module.register` needs Node 20.6+, and `shot-views.mjs` needs Node 22's global `WebSocket`.
- `style-loader` and `tsconfig-paths-webpack-plugin` are unused.
- The test harness imports `@swc/core`, which is installed only as `swc-loader`'s peer dependency (`"peer": true` in the lockfile). Declare it directly.

**`mod.json`:**
- It says `"version": "0.1.0"` and `"author": "T. D. W."`, and webpack stamps both into the shipped bundle's banner.

**Webpack:**
- It is always `mode: "production"` with Terser and no `devtool`, so `npm run dev` rebuilds a minified bundle with no source maps for the Cohtml debugger.
- The `mod.json` alias is unused: every import is relative.

**Lint and format:**
- No ESLint, Prettier or editorconfig.
- The only rules-of-hooks guard is a regex test over one file (`test/vanillaMenuCategories.test.ts:151-161`). `eslint-plugin-react-hooks` would cover `rules-of-hooks` and `exhaustive-deps` everywhere.

**`scripts/`:**
- `shot-views.mjs` and the two probes depend on `cs2-cdp-*.mjs` runners that live in the maintainer's workspace, not in this repository.
- `shot-views.mjs` still writes a `-picker.png` for the removed picker.

### 3.6 SCSS

- **About 730 lines, about 20% of module SCSS, are dead rules**, found by checking each module's classes against `styles.x` in its importers:
  - `buildingMenuHeader.module.scss`, about 270 lines: `.topBar*`, `.buttonsSection*`, `.buildingLensToggle*`, `:global(.legacy-interface)`, …
  - `buildingCatalog.module.scss`, about 230: the old facet drawer (`149-364`), `.capacityFilter*`, `.pageLabel`/`.pageButton`.
  - `buildingMenuSurface.module.scss`, about 140: the `.align*` family, `.topPanel`, `.rightPanel`.
  - Smaller tails in five other files.
  - In `base.scss`, all 5 variables and 3 mixins are unused.
  - Careful: `.scopeNoticeAction, .pageButton` at `buildingCatalog.module.scss:137-140` shares a rule that is still live.
  - Add a test that fails when a module class has no reference.
- **Geometry is duplicated between SCSS and TS, and checked circularly.**
  - `BUILDING_LENS_TABLE_ROW_FURNITURE = 37 + 16 + 8 + 80` mirrors four SCSS values, and its test asserts `=== 37 + 16 + 8 + 80`.
  - `BUILDING_LENS_CONTROL_PANE_TOTAL = 385` equals `$pane-width` + `margin-left`, and nothing checks it.
  - `BuildingMenuSurface.tsx:35` writes `+ 15 + 20` instead of the named constant.
  - Export the SCSS values with ICSS `:export {}` and read them in TS.
- **Repeated patterns:**
  - 22 hand-written `> * + * { margin }` stacks, while `gap` is now used in two files since the Cohtml 2.2 migration (`verification.md:2485`). Pick one.
  - 14 copies of the truncate trio; make it a mixin.
  - `rgba(255,255,255,0.08/0.1/0.12)` more than 30 times; make them tokens.
  - About 80 `!important`s, many in dead blocks.

### 3.7 Tests

**Some "contract" tests regex the source text:**
- `[^}]*` patterns in `stylesheetContracts.test.ts` stop at the first nested block.
- `vectorEffectSafety.test.ts` splits on `}`.
- `tileNameMeasureContract.test.ts` and `tableChevronGlyph.test.ts` would still pass after a rename.

Compile each sheet with `sass` (already a dependency), walk it with `postcss` (already in the tree), and assert declarations per resolved selector.

**Effects never run.** `test/harness/render.tsx` uses `renderToStaticMarkup`. That leaves untested: the rAF loop, the scroll anchor, tile measurement, the Enter and Escape handlers, the drag, and `useVanillaLayoutForLens`. `react-test-renderer` with `act` is already a dependency but is used in two files.

`FilterRail`, `ChipRow`, `BuildingCatalogMetricFilters`, `LensToolOptions` and `LensResizeHandle` have no render test. U1, U4, U6 and U8 would each have been caught by one.

### 3.8 What the UI does well

- **Bindings are declared at module scope.** No trigger fires during render.
- **Every listener, observer and rAF loop has a cleanup.**
- **`lensViewStore` with `useSyncExternalStore` is the right tool.** The panel's view state has to survive the unmount that placing a building causes.
- **`vanillaLayout.ts` is careful with vanilla's DOM.** It scopes its patches to the mount, restores them properly, and `docs/design-notes.md` documents why.
- **`entryContract.test.ts` checks the language boundary.**
- **The "Cohtml drops these declarations" check is effectively a stylelint rule.**

---

## 4. Optimization and refactor opportunities, ranked by value per effort

### 4.1 Quick wins (half a day or less each)

1. **Delete write-only index work.** Everything below was checked by repo-wide grep over C#, tests and `UI/src`:
   - `existingMeshes`/`IsUniqueMesh`, which does an O(n²) `List.Contains` per full pass and is never serialised;
   - `IsResourceIntensive`, which walks every LOD;
   - `IsRandom`/`RandomPrefabs`/`RandomPrefabThumbnails`;
   - `DlcThumbnail`, `ThemeThumbnail` and `PackThumbnails` (packs are computed twice in `AddPrefab`);
   - `Tags`;
   - `CornerType`;
   - `InstalledDate`/`UpdatedDate` with `FillPdxModsData` and `PdxModsUtil`;
   - `_milestoneIcons`;
   - `AssetPackRegistry`;
   - `PrefabTrackingSystem` with the Locate trigger, `InteractionBoundary`'s locate state, `JumpTo`, and the TS locate contracts;
   - `GenericUIReader`.
2. **Coalesce catalog refreshes** by polling `IndexGeneration` from `BuildingMenuUISystem.OnUpdate`, as in §2.1.
3. **`memo` plus one hover context** (§3.1).
4. **One bindings and commands module** (§3.2), deleting the unused subscriptions.
5. **Normalise search once:** trim and lowercase into a `SearchTerm`, make the filter `Score(entry, term) > 0`, and reuse the score for ordering. This fixes U2 and makes the relevance tiers real, or lets you delete them.
6. **Cache enum names and icon attributes** in static tables (`CategoryIconAttribute`, `Category.ToString()` ×4 per projection, `HasFlag` boxing).
7. **Dead SCSS and dead TS exports**, with a guard test and `noUnusedLocals` so they stay gone.

### 4.2 Medium (1–2 days each)

1. **Make the index pass correct and robust:**
   - cache full and changed-only queries per processor in `OnCreate` (I1);
   - re-run name numbering after partial passes;
   - resolve RoadBuilder's type in `OnCreate` with a null check (I2);
   - build into new structures and swap them in at the end (§2.1);
   - move diagnostics to Debug.
2. **Replace the stringly-typed dispatch with descriptor tables** for sort columns, group dimensions, density order and facet ids. Each descriptor carries an id, a typed key and comparer, a rank, and a label id. Generate a `shared-constants.json` that C# embeds and TS imports. Delete the dead C# `BuildingLensWidth.Min`/`Clamp` and TS `DENSITY_ORDER`/`sortZonesForDisplay` rather than writing drift tests for them. This also removes the per-entry boxing and string building in `ReorderableSortColumns` (`QueryEngine.cs:486-517`).
3. **Give `BuildingCatalogLensState` one source of truth.** Today `Menu`/`Category`/`SearchText`/metric ranges live both on the state and on `Query`, and `Compose()` reconciles them. Its implicit window reset relies on record `==`, which compares `IReadOnlyList` members by reference. Derive `Query` from the intent instead.
4. **An error boundary around every extension, and guarded `getModule` lookups** (§3.3).

### 4.3 Larger (2–4 days each)

1. **Split `PrefabIndexingSystem`** along the seams in §2.6, and break `PopulateAnalyticalData` up by component family. The mapping from facts to a `PrefabIndex` then becomes unit-testable.
2. **A pure core assembly** (`netstandard2.0`) plus a game-facing assembly (§2.5). This is the precondition for C# tests in CI, and removes the net10-versus-Mono gap for most of the logic.
3. **A rule table for the boilerplate processors, and an instance `CatalogIndex`** in place of the static `BuildingMenuUtil`/`CategorizedPrefabs`/registries (§2.2, §2.6).
4. **Windowed rendering** for Table, List and Grid, driven by a polled `scrollTop` and the fixed row and tile sizes.
5. **Pick one noun.**
   - `Lens` survives in **persisted** names: the setting keys `BuildingLensPanelHeight` and `BuildingLensTileSize`, and many binding names. Renaming the settings resets every player's values unless the old keys are migrated.
   - Rename the code first, keep the persisted keys, and write down the glossary (Menu = surface, Catalog = data).

---

## 5. Documentation

### 5.1 Per document

| Document | State | Recommendation |
|---|---|---|
| `README.md` | Accurate. Its docs index lists 4 of the 10 docs. | Keep. List every doc. Add a one-paragraph architecture sketch: index → adapter → query engine → `CatalogView` → bindings → React. |
| `PLANNING.md` | **Entirely historical.** It describes the picker, an Education capacity-floor control, a three-building compare tray, "OnlyPlaced" locate, and "keep isolated until … a new PDX publisher identity … only then prepare a public package". Published 2026-09-09. | **Delete.** It duplicates `roadmap.md`. |
| `docs/roadmap.md` | **Stale throughout.** It says it will "not discard the picker" and will "retain … favorites, and random selection … keybindings". It also describes a top-bar button, a Catalog mode, saved presets and multi-column sort, and a "compare tray … implemented and live-smoked". None of these exist. `BootDiagnostics` is a workspace mod. | **Rewrite** as a short list of open work: §0's open P3 items, §1's bugs, a Locate decision, translation coverage. |
| `docs/layout-concept.md` | **Describes a panel that no longer exists.** Widths 735/800/1,235 (actually a fixed width of 1,441), a width setting and alignment modes (none exist), a Compare/Place column, "while the Building Lens is enabled", and "a later iteration may add a height preference" (it exists). | **Delete**, or archive. The live contract is in `buildingLensLayout.ts` and the tests. |
| `docs/verification.md` (2,551 lines) | **Two documents in one.** Lines 1–530 are a stale checklist: "not a publishable release", `tools/e2e/…` and `just` recipes not in this repo, "23 backend / 17 UI tests", picker/compare/locate coverage, the capacity-floor presets, a FindIt surface checklist, Tools mode, a "Current gate" naming `FindIt/UI/mod.json`, and "Release gates" still requiring a license and a new PDX identity. The rest is a valuable dated journal. About 20 links point to `../docs/archive/…`, outside the repo. | **Split.** A short `docs/release-checklist.md` with current commands, counts and the smoke procedure. The journal from 2026-09-01 onward becomes `docs/verification-log.md`. Drop lines 1–530, or move them to an archive. Mark workspace-only tooling as external. |
| `docs/compatibility.md` | The measured sections are good. The top-level "Ranked, by likely trouble" table, "Suggested live order", "Fixes suggested" and "install blocked" are all superseded later in the same file. `compat/probe/*.png` is not in the repo. | **Collapse** to one current table (mod, version tested, our version, result, date), then the measured detail. |
| `docs/publishing.md` | Accurate, but the same build command appears in steps 1 and 2. First-publish steps are mixed into the per-release steps. The "run Update after NewVersion" rule is separated from step 4 by an unrelated section. | **Tidy.** It documents the Debug-package footgun instead of fixing it (see §6). |
| `docs/FORK.md` | The license-blocker paragraph is superseded by the decision paragraph below it. "PublishConfiguration.xml is now a stub … New capture is required" is out of date. The claim that StarFilled is "used for the asset-pack rail" is false: the `assetPack` icon key matches no facet the backend emits (`FilterRail.tsx:56`). `reference-mods/` is external. | **Fix** those three lines. |
| `docs/design-notes.md`, `docs/indexing.md` | Accurate; every cited symbol exists. The only fault is `filterRail.module.scss:84`, which cites a heading that has since been renamed. | Keep. |
| `docs/vanilla-upgrades.md` | Its citations point into `_decompiled/`, which is outside the repo. It says the `ServiceUpgradeData` fallback is "needed" (`:61-69`), but it exists (`PrefabIndexingSystem.cs:1269-1274`), and `:178` contradicts `:61-69`. | Keep. Fix the contradiction and note that `_decompiled` is external. |
| `docs/reviews/2026-09-10-…` | Mostly acted on, but reads as open (§0). | Add a status header. |

The `.disabled` caution appears in four documents. Keep it in README and the release checklist only.

### 5.2 Metadata files

| File | Issue |
|---|---|
| — (no file) | **No `LICENSE`.** The fork publishes on Find It's `MIT` csproj statement, and MIT requires the copyright and permission notice to ship with copies. Add an MIT `LICENSE` naming T. D. W. (upstream) and this fork's author. |
| `BetterBuildingMenu.csproj:14-15` | `<Company>T. D. W.</Company>` and `<Copyright>@2024 MIT license</Copyright>` stamp the upstream author into this DLL's properties. `:20-21` calls `Directory.Build.props` the "workspace's shared" file, but it is in the repo. `:28` cites "SearchUtil's matching rules", which were removed. `LangVersion`, `TargetFramework` and `Nullable` repeat what `Directory.Build.props` already sets. `<Folder Include="Resources\Images\" />` is Visual Studio residue. |
| `Directory.Packages.props` | Declares `Lib.Harmony`, `Mono.Cecil`, `System.Runtime`, `System.Collections` and `System.Runtime.CompilerServices.Unsafe`. None is referenced, and the listing says "No Harmony patches". Its comment ("all cs2-* workspace projects") is workspace residue. |
| **Versions** | There are five sources: the csproj `<Version>`, `modinfo.json`, `PublishConfiguration.xml` `ModVersion`, `Changelog.json`, and `UI/mod.json`, which is **0.1.0** and goes into the bundle banner. The `<ChangeLog>` text in `PublishConfiguration.xml` is hand-copied from `Changelog.json`, and the two 0.1.12 texts already differ. |
| `modinfo.json` | The description promises "browse, search and **compare**". There is no compare feature. I couldn't find what reads this file beyond `build.sh` copying it into the package; confirm that it's needed. |
| `PublishConfiguration.xml` | The LongDescription says "Filter by … density", but density is a tab and a grouping, not a filter. It also doesn't say that switching back to the stock menu needs a restart (U9). |
| `.gitignore` | 368 lines of the generic Visual Studio template, plus `BetterBuildingMenu/Library/ilpp.pid`, which is Unity residue. |

### 5.3 Locale

- `Locale.json` has 271 keys. Every translation has the same 71: the Find It-era keys plus the options headers. That is **200 missing per language**, including all three option labels (U7).
- `ja-JP`, `pt-BR` and `uk-UA` are entirely English.
- About 33 English keys are referenced nowhere, allowing for dynamically built keys. Examples: the `Zone*` family, `Random`, `Expand`, `Shrink`, the `Pollution` family, and `Options.INPUT_MAP[…]`, a key-binding section with no bindings behind it.
- `Options.LABEL[…LotWidth]` and `…LotDepth` are referenced by `buildingCatalogRanges.ts:28-29` but missing.
- 19 more strings are deliberately hard-coded English (`plumbed: false` in `localizableStrings.ts`).
- `crowdin.yml` maps to the files on disk, but it has no `languages_mapping`, and Crowdin's Chinese codes are `zh-CN`/`zh-TW`, not `zh-HANS`/`zh-HANT`. Nothing indicates an active Crowdin project. Either connect it or remove the file, and either fill in or drop the all-English translations.

### 5.4 Comment policy

The rule that drove the 2026-09-10 pass isn't in this repository, so the next contributor, human or AI, can't follow it. Put it in a `CONTRIBUTING.md` (or a checked-in `AGENTS.md`/`CLAUDE.md`), together with:
- the glossary;
- the build, test and release commands;
- the "no Harmony, nothing in the save" boundary;
- how to run the UI suite.

---

## 6. Brainstorm: areas of improvement

**Release engineering**
- **One version source.** Keep `<Version>` in `Directory.Build.props`, and generate `modinfo.json`, `UI/mod.json` and `PublishConfiguration.xml`'s `ModVersion` from it. Also generate its `<ChangeLog>` from the top `Changelog.json` entry, so the step `publishing.md` warns about can't be done wrong.
- **A `./build.sh release`** that forces `Release` for both build and package, fails if the DLL is older than the sources, runs both test suites, and runs the identity guard with `rg` required (or with `grep -E`). The Debug-package mistake of 2026-09-09 is currently prevented only by documentation.
- **CI.** A GitHub Actions workflow for the UI is possible today, with no game needed: `npm ci`, `npm test`, `tsc`, `webpack`, and ESLint once added. C# tests follow once the pure core exists (§4.3).

**Quality gates**
- ESLint with `react-hooks` and `@typescript-eslint`, plus Prettier.
- `.editorconfig` for C# (tabs, file-scoped namespaces, no BOM) and a one-time reformat commit.
- Nullable warnings as errors.
- An unused-SCSS-class test.
- Typechecked tests.

**In-game smoke tests from the repo**
- `scripts/shot-views.mjs` already drives the menu over CDP and captures each view. The fuller smoke runner (`tools/e2e/building-menu-smoke.mjs`) lives in the maintainer's workspace.
- Vendor it here, with its CDP helpers and a README. A release then gets a scripted pass: open each menu, search, place, resize, check the log for errors. Optionally add screenshot diffs at 720p and 1080p, which would have caught U5.

**Observability**
- Route UI exceptions caught by the new error boundary to a C# trigger, so they reach `Modding.log` with the mod's name.
- Put the audit/census logs behind a "Diagnostics" option (off by default). Players get a quiet log, and bug reports can still ask for the census.

**Performance budget**
- The index pass already logs its duration. Record the numbers for a large playset in the verification log, and treat a regression as a release blocker.
- Profile a 2,000-row Table render and a resize drag in the Cohtml debugger before and after §3.1.

**Localisation**
- Decide whether translations are in scope.
- If yes: connect Crowdin with a language mapping, plumb the 19 hard-coded strings, and move the English labels out of C# (§2.4) so the UI translates ids.
- If no: delete the 13 partial files. English everywhere beats raw keys in the Options screen.

**Product**
- **Keyboard:** one Enter handler, with a C#-published best-match id (U1). Arrow-key navigation over the grid would make search-and-place fully keyboard-driven.
- **Locate:** decide. It is wired in C# and missing from the UI. Either add a Locate action to the hover card or the row (querying instances on click, with no background tracking), or delete the chain.
- **Find It legacy:** the `FindIt/...` category-override compatibility, `PickerRemovalTests`, and the Find It-era locale keys each need a keep-or-drop decision, dated in `FORK.md`.

**Architecture docs**
- A one-page `docs/architecture.md` covering the data flow, which system owns which state, the binding catalogue (generated from `BindingManifestTests`), and the "why" links already in `design-notes.md` and `indexing.md`.
- It would replace most of what `PLANNING.md`, `roadmap.md` and `layout-concept.md` try to be.
