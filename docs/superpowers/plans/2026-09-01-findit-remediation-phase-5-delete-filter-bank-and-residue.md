# FindIt Remediation Phase 5 — Delete the Filter Bank and the Residue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nothing in the mod runs for a feature that has no UI: the upstream filter bank, favourites, the detailer generators, `ClearGooee`, dead settings and the residue files are gone, and the category processors that feed nothing the lens can show are deleted on the strength of a live census.

**Architecture:** Four deletion tasks that each leave the suite green, then a measured task: the census log lands in Task 4, the live run reads it, and Task 5 deletes only what the census names. Every deletion is gated on `grep` printing nothing for the deleted name.

**Tech Stack:** C# net48 / LangVersion 11 (mod), net10.0 xunit; TypeScript under Cohtml with `node --test`; `just` from the worktree root; `bd` from the MAIN checkout.

**Spec:** `docs/superpowers/specs/2026-09-01-findit-remediation-phase-5-delete-filter-bank-and-residue-design.md`.

## Global Constraints

- Worktree `/var/home/gerbal/Games/CS-Modding-wt/findit-remediation`, branch `findit/phase-5-delete-residue` off `origin/master`. Paths are relative to `cs2-findit-building-menu/`. `just` runs from the worktree root.
- Beads: cm-jjlv.9 with children cm-jjlv.9.1–.5. `bd` from `/var/home/gerbal/Games/CS-Modding`; strip ANSI with `sed -r 's/\x1B\[[0-9;]*[mK]//g'`.
- Tests: `just test findit-building-menu 2>&1 | grep -E "Passed!|Failed!|error CS|# (pass|fail)|\[FAIL\]"`; type check `cd cs2-findit-building-menu/FindIt/UI && npx tsc --noEmit -p .`.
- Commit trailer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_013U8fzQAHmfdVdWfXLX2Eqv`.
- Delete by whole file or whole member; never leave a stub. After each named deletion `grep -rn "<name>" FindIt FindItBuildingMenu.Tests --include=*.cs --include=*.ts --include=*.tsx` must print nothing (comments included — fix or delete the comment).
- Keep: the picker and `Domain/Options/Picker/ObjectFilterOption.cs`, `PrefabTrackingSystem`, `ServiceCoverageOverlaySystem`, `HideRandomAssets`, `FindItUtil.CategorizedPrefabs`.
- Processors are deleted ONLY from the census (Task 5), never from the review's list.

---

### Task 1: The filter bank, its statics, and the legacy-filter binding

**Files:**
- Delete: `FindIt/Domain/Filters.cs`, `FindIt/Domain/Options/BuilderCornerOption.cs`, `BuildingLevelOption.cs`, `ExtraFiltersOption.cs`, `LotDepthOption.cs`, `LotWidthOption.cs`, `PlacementFlagOption.cs`, `RoleOption.cs`, `SortingDirectionOption.cs`, `SortingOption.cs`, `ZoneTypeOption.cs`, `FindIt/Systems/FindItOptionsUISystem.cs`, `FindIt/Domain/BuildingLensLegacyFilterSnapshot.cs`, `FindIt/Domain/Enums/PrefabSorting.cs`
- Modify: `FindIt/Systems/OptionsUISystem.cs`, `FindIt/Systems/PickerUISystem.cs:133-149`, `FindIt/Services/BuildingCatalogAdapter.cs:1015,1030`, `FindIt/Systems/FindItUISystem.Setup.cs:41,111,168,224`, `FindIt/Systems/FindItUISystem.Methods.cs:77-81,179,181-189,215-235,291`, `FindIt/Systems/FindItUISystem.Bindings.cs:816,821`, `FindIt/Domain/BuildingCatalogQuery.cs:27`, `FindIt/Services/BuildingCatalogQueryEngine.cs:200`, `FindIt/Utilities/FindItUtil.cs`, `FindIt/Domain/IndexedPrefabList.cs`, `FindIt/Mod.cs:129,133-159`, `FindIt/Setting.cs` (`StrictSearch`), `FindIt/Systems/PickerToolSystem.cs:139`, `FindIt/Systems/PrefabTrackingSystem.cs:98`, `FindIt/Systems/PrefabIndexingSystem.cs:546`
- Modify TS: `FindIt/UI/src/domain/buildingLensFilterSummary.ts`, `FindIt/UI/src/mods/BuildingCatalog/BuildingCatalog.tsx:112,309,314`, `FindIt/UI/test/buildingLensFilterSummary.test.ts:70-100`
- Modify tests: `FindItBuildingMenu.Tests/BuildingCatalogQueryEngineTests.cs:148-165,499`

**Interfaces:**
- Produces: `OptionsUISystem` with `GetAssetName(PrefabBase)` and abstract `RefreshOptions()` only; `FindItUtil.Find(PrefabBase prefab, out int id)`; `IndexedPrefabList` ordered by `Name` then `PrefabName`; `BuildingCatalogQuery` without `HasParking`.

- [ ] **Step 1: Delete the files**

```bash
git rm -q FindIt/Domain/Filters.cs FindIt/Domain/Options/BuilderCornerOption.cs FindIt/Domain/Options/BuildingLevelOption.cs FindIt/Domain/Options/ExtraFiltersOption.cs FindIt/Domain/Options/LotDepthOption.cs FindIt/Domain/Options/LotWidthOption.cs FindIt/Domain/Options/PlacementFlagOption.cs FindIt/Domain/Options/RoleOption.cs FindIt/Domain/Options/SortingDirectionOption.cs FindIt/Domain/Options/SortingOption.cs FindIt/Domain/Options/ZoneTypeOption.cs FindIt/Systems/FindItOptionsUISystem.cs FindIt/Domain/BuildingLensLegacyFilterSnapshot.cs FindIt/Domain/Enums/PrefabSorting.cs
```

- [ ] **Step 2: Trim `OptionsUISystem` and the picker's stubs**

`FindIt/Systems/OptionsUISystem.cs`: delete the four abstract members `TriggerSearch`, `RefreshLens`, `GetBuildingLensFacetGroup`, `ToggleBuildingLensFacetOption`; keep `RefreshOptions` and `GetAssetName`. Delete `using FindItBuildingMenu.Domain;` if `BuildingCatalogFacetGroup` was its last use.

`FindIt/Systems/PickerUISystem.cs`: delete the `TriggerSearch()` and `RefreshLens()` overrides, the comment beginning `// The picker's own options bank has nothing to do with the building`, and the two facet overrides. `ObjectFilterOption` calls none of them (verify: `grep -n "_optionsUISystem\." FindIt/Domain/Options/Picker/ObjectFilterOption.cs` prints nothing or only `GetAssetName`).

- [ ] **Step 3: Cut the bank out of the adapter, the systems and the query**

`BuildingCatalogAdapter.GetIndexedBuildings`: delete `var filters = FindItUtil.Filters.GetFilterList(includeSearch: false).ToArray();` and the trailing `.Where(prefab => filters.All(filter => filter(prefab)))` (the previous `.Where` now ends the expression with `;`).

`FindItUISystem.Setup.cs`: delete `private FindItOptionsUISystem _optionsUISystem;`, `private ValueBindingHelper<string[]> _BuildingLensLegacyFilters = null!;`, `_optionsUISystem = World.GetOrCreateSystemManaged<FindItOptionsUISystem>();`, `_BuildingLensLegacyFilters = CreateBinding("BuildingLensLegacyFilters", Array.Empty<string>());`.

`FindItUISystem.Methods.cs`: in the query build delete the five lines from `HasParking = FindItUtil.Filters.WithParking` to `: null,`; delete `_BuildingLensLegacyFilters.Value = CaptureLegacyFilters().Describe().ToArray();` and the two comment lines above it; delete the comment block beginning `// The options bank's short-facet rows (Availability, Provenance,` through `_optionsUISystem.RefreshOptions();`; delete `CaptureLegacyFilters` whole with its `<summary>`; delete `FindItUtil.Filters.CurrentSearch = string.Empty;` in `ResetBuildingLensMenu`'s neighbourhood (line ~291). Delete `using FindItBuildingMenu.Domain.Enums;` if `ZoneTypeFilter`/`BuildingCornerFilter` were its last uses (they were in `CaptureLegacyFilters`).

`FindItUISystem.Bindings.cs` `SearchChanged`: the guard becomes `if (_CurrentSearch == text) { return; }`; delete `FindItUtil.Filters.CurrentSearch = text.Trim();`.

`BuildingCatalogQuery.cs`: delete `bool? HasParking = null,`. `BuildingCatalogQueryEngine.cs:200`: delete the `&& (!query.HasParking.HasValue || entry.HasParking == query.HasParking.Value)` clause (read the surrounding `||`/`&&` chain and leave it well-formed).

- [ ] **Step 4: Trim `FindItUtil`, `IndexedPrefabList`, `Mod`, `Setting`**

`FindItUtil.cs`: delete `Filters`, `CurrentCategory`, `CurrentSubCategory`, `GetCategories`, `GetSubCategories`, `GetUnfilteredPrefabs`, `SetSorting`. Change `Find(PrefabBase prefab, bool setCategory, out int id)` to `Find(PrefabBase prefab, out int id)` and delete its `if (setCategory) { … }` block. Update the three callers (`PrefabTrackingSystem.cs:98`, `PickerToolSystem.cs:139`, `PrefabIndexingSystem.cs:546`) to the two-argument form.

`IndexedPrefabList.cs`: delete `Sorting`, `SortingDescending`, the whole `Sort` method and the `PrefabName`/`PrefabGroupIndex`/`PrefabUIOrder`/`UpdatedDate`/`InstalledDate` key helpers it used (keep any the file still needs — read it). `OrderedList` becomes `_orderedList ??= _dictionary.Values.OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase).ThenBy(x => x.PrefabName, StringComparer.Ordinal).ToList();` with a comment: `// Name order, which was the default of the six upstream sort modes; the sorting option sections that switched between them are gone (cm-jjlv.9), and the lens orders its own page.` Delete `using FindItBuildingMenu.Systems;` if `PrefabTrackingSystem` was its last use.

`Mod.cs`: delete `MainThreadDispatcher.RegisterUpdater(RegisterAPIs);` and the `RegisterAPIs` method (with its local `wrapFunction`). Delete `using System.Reflection;` if `MethodInfo`/`BindingFlags` were its last uses.

`Setting.cs`: delete the `StrictSearch` property and its `[SettingsUISection]`.

`grep -rn "StrictSearch\|Filters\b\|FindItOptionsUISystem\|LegacyFilter\|PrefabSorting\|SetSorting\|CurrentCategory\|CurrentSubCategory\|GetUnfilteredPrefabs\|GetCustomSearchFunction\|RegisterAPIs" FindIt --include=*.cs` must print nothing.

- [ ] **Step 5: TS**

`buildingLensFilterSummary.ts`: delete the `legacyFilters?:` input field with its doc comment; delete the `const legacyFilters = …` line; `count` becomes `facets + activeRanges`; delete the `...legacyFilters.map(...)` spread and its two comment lines; if a `lensCount` local now equals `count`, collapse to one. Update the `BuildingLensFilterSummary.count` doc from `lens-owned or legacy` to `Every constraint narrowing the result.`

`BuildingCatalog.tsx`: delete `const BuildingLensLegacyFilters$ = …;`, `const legacyFilters = useValue(BuildingLensLegacyFilters$);`, and the `legacyFilters,` argument to `getBuildingLensEmptyStateMessage`.

`test/buildingLensFilterSummary.test.ts`: delete the three cases that pass `legacyFilters` (around lines 70–100; they are the ones asserting `Find It:` labels or an empty legacy list).

`grep -rn "legacyFilters\|LegacyFilters" FindIt/UI/src FindIt/UI/test` must print nothing.

- [ ] **Step 6: Tests**

`BuildingCatalogQueryEngineTests.cs`: in `Query_RangeAndParkingFilters_UseInclusiveBounds` delete the `HasParking: false` argument and rename the test `Query_RangeFilters_UseInclusiveBounds` (entry 4 is still the only 3×2, level-2 entry — verify by reading `SampleEntries`; if not, add `MinBuildingLevel: 2, MaxBuildingLevel: 2` are already there and suffice). In `ResetWindowIfPredicatesChanged_ResetsForLegacyFilterAndRangeChanges` replace `(previous with { HasParking = true })` with `(previous with { MinLotWidth = 2 })`, rename it `ResetWindowIfPredicatesChanged_ResetsForRangeChanges`, and fix its comment (`The legacy FindIt parking filters and the metric drawer feed the same query` → `The metric drawer feeds the same query`).

Run: `just test findit-building-menu 2>&1 | grep -E "Passed!|Failed!|error CS|# (pass|fail)|\[FAIL\]"`. Expected: all green (the manifest test included — both sides lost `BuildingLensLegacyFilters`). `npx tsc --noEmit -p .` prints nothing.

- [ ] **Step 7: Commit**

```bash
git add -A FindIt FindItBuildingMenu.Tests
git commit -m "refactor(findit): delete the upstream filter bank and everything only it fed (cm-jjlv.9.1)"
```

---

### Task 2: Favourites

**Files:**
- Delete: `FindIt/Domain/CustomPrefabData.cs`
- Modify: `FindIt/Utilities/FindItUtil.cs` (favourites block), `FindIt/Mod.cs:100`, `FindIt/Setting.cs` (`ResetFavorites`), `FindIt/Domain/PrefabIndexBase.cs:16`, `FindIt/Systems/PrefabIndexingSystem.cs:1159,1346-1356`, `FindIt/Domain/Enums/PrefabCategory.cs`, `FindIt/Domain/Enums/PrefabSubCategory.cs:11`, `FindIt/Domain/BuildingCatalogEntry.cs:26,257-258`, `FindIt/Services/BuildingCatalogAdapter.cs:1312`, `FindIt/UI/src/domain/buildingCatalog.ts:66`, `FindIt/UI/test/buildingCatalogContracts.test.ts:41`, the twelve test files that pass `IsFavorited: false`, `BuildingCatalogQueryEngineTests.cs` (`PageWrite_EmitsStablePageAndEntryPropertyNames`)

- [ ] **Step 1: C# deletions**

`FindItUtil.cs`: delete `customPrefabsData`, `FavoritePack`, `IsFavorited`, `ToggleFavorited`, `UpdateFavoritesList`, `ResetFavorites`, `SaveCustomPrefabData`, `LoadCustomPrefabData`, and in `RemoveItem(int)` the `if (IsFavorited(prefabIndex.PrefabName)) { ToggleFavorited(index); }`. Delete `using Colossal.Json;`/`using System.IO;` if now unused. `git rm -q FindIt/Domain/CustomPrefabData.cs`.

`Mod.cs`: delete `FindItUtil.LoadCustomPrefabData();`. `Setting.cs`: delete the `ResetFavorites` property and its three attributes. `Locale.json`: delete its label/description entries (`grep -n "ResetFavorites" FindIt/Locale.json`).

`PrefabIndexBase.cs`: delete `public bool IsFavorited { get; set; }`. `PrefabIndexingSystem.cs`: delete `prefabIndex.IsFavorited = FindItUtil.IsFavorited(prefab.name);` and the `if (prefabIndex.IsFavorited) { … }` block in `AddPrefab`. `PrefabCategory.cs` / `PrefabSubCategory.cs`: delete the `Favorite` members (then `grep -rn "PrefabCategory.Favorite\|PrefabSubCategory.Favorite"` must print nothing — `AddAllCategories` enumerates the enum, so it needs no edit).

`BuildingCatalogEntry.cs`: delete `bool IsFavorited,` and the `writer.PropertyName("isFavorited"); writer.Write(IsFavorited);` pair. `BuildingCatalogAdapter.Project`: delete `IsFavorited: prefab.IsFavorited,`.

- [ ] **Step 2: Tests and TS**

`grep -rln "IsFavorited" FindItBuildingMenu.Tests` → in each file delete the `IsFavorited: false,` (or `IsFavorited: true,`) argument line from the entry fixture. In `PageWrite_EmitsStablePageAndEntryPropertyNames` remove `"isFavorited"` from the expected name array. TS: delete `isFavorited: boolean;` from `buildingCatalog.ts` and `isFavorited: false,` from the contracts test fixture.

Run the suites and `tsc`; expected green. `grep -rn "avorit" FindIt FindItBuildingMenu.Tests --include=*.cs --include=*.ts --include=*.tsx --include=*.json` must print nothing (`Locale.json` included).

- [ ] **Step 3: Commit**

```bash
git add -A FindIt FindItBuildingMenu.Tests
git commit -m "refactor(findit): delete favourites — no UI ever rendered them (cm-jjlv.9.2)"
```

---

### Task 3: Generators, area borders, ClearGooee, dead settings, residue files

**Files:**
- Delete: `FindIt/Systems/AutoVehiclePropGeneratorSystem.cs`, `FindIt/Systems/AutoQuantityPropGeneratorSystem.cs`, `FindIt/Systems/CustomAreaBorderRenderSystem.cs`, `FindIt/UI.zip`
- Modify: `FindIt/Mod.cs:123,126-127,130,166-169,171-192`, `FindIt/Utilities/FindItUtil.cs` (`AssetMap`, `Find`), `FindIt/Domain/VanillaMenuAudit.cs` (`Compare`), `FindIt/Systems/PrefabIndexingSystem.cs:862-935,1015-1100`, `FindItBuildingMenu.Tests/VanillaMenuAuditTests.cs:27-36,91-107`, `FindIt/Setting.cs`, `FindIt/Locale.json`, `FindIt/Changelog.json`, `FindIt/Properties/PublishConfiguration.xml`, `.gitignore`

- [ ] **Step 1: Systems and the audit**

`git rm -q` the three systems and `FindIt/UI.zip`; append `cs2-findit-building-menu/FindIt/UI.zip` to the repo-root `.gitignore` (the file is a zipped `node_modules`; the line stops a rebuild from re-tracking it).

`Mod.cs`: delete the three `UpdateAt<…>` lines for the deleted systems, `MainThreadDispatcher.RegisterUpdater(ClearGooee);`, `GetIconsMap`, `ClearGooee`. Delete `using Colossal.PSI.Environment;`/`using System.IO;` if now unused (`EnvPath`, `DirectoryInfo` were `ClearGooee`'s).

`FindItUtil.cs`: delete `AssetMap`; in `Find` delete the `MovingObjectPrefab ? $"Prop_{prefab.name}"` rename and the `AssetMap.TryGetValue` block — `name` is `prefab.name`.

`VanillaMenuAudit.Compare`: delete the `substitutedPrefabNames` parameter, its null check, `substituted`, and the substitution half of `IsHeld` (it becomes `held.Contains(placement.EntityIndex)`); delete the comment beginning `// Substitutions count as held.`. `VanillaMenuAuditTests.cs`: drop the `substituted` parameter from the local `Compare` helper and delete `ASubstitutedAssetCountsAsHeldUnderItsOwnName`.

`PrefabIndexingSystem.LogVanillaMenuAudit`: drop the `FindItUtil.AssetMap.Keys` argument, delete `verdictReady` and make the summary line `report.IsClean ? "" : " — NOT CLEAN"`. `LogVanillaMenuCoverage`: delete the `if (FindItUtil.AssetMap.Count == 0) { … return; }` gate, the `substituted` counter and its `if (FindItUtil.AssetMap.ContainsKey(...)) { substituted++; continue; }`, and any summary text that names `substituted`.

`grep -rn "AssetMap\|AssetReferenceMap\|GetIconsMap\|ClearGooee\|Gooee\|substitut" FindIt --include=*.cs` must print nothing.

- [ ] **Step 2: Settings and locale**

`Setting.cs`: delete `ApplyMimic` (and the class-level `[SettingsUIMouseAction(...)]` attribute if `ApplyMimic` was its only binding — `grep -rn '"Apply"\|Apply"' FindIt --include=*.cs`), `NoAssetImage`, `HideBrandsFromAny`, `SmoothScroll`, `ScrollSpeed`, `RowSize`, `ColumnSize`, `ExpandedRowSize`, `ExpandedColumnSize`, `RightRowSize`, `RightColumnSize`, each with its attributes. Delete the `DISPLAY` group constant from the three `[SettingsUI…Order]`/`ShowGroupName` attributes if nothing else uses it. `PrefabIndexingSystem.cs:1337`: the `if (!Mod.Settings.HideBrandsFromAny || …)` guard becomes an unconditional add. `PickerTooltipSystem.cs:41`: delete the commented-out `NoAssetImage` line.

`Locale.json`: delete every entry whose key names a deleted setting (`grep -n "ApplyMimic\|NoAssetImage\|HideBrandsFromAny\|SmoothScroll\|ScrollSpeed\|RowSize\|ColumnSize\|StrictSearch\|ResetFavorites\|DISPLAY\|Display" FindIt/Locale.json` — read each hit; delete only the ones that are these settings' labels/descriptions/group name).

- [ ] **Step 3: Changelog and publish configuration**

Replace `FindIt/Changelog.json` with:

```json
[
  {
    "Stable": false,
    "Version": "0.1.0",
    "Date": "2026-09-01",
    "ChangeGroups": [
      {
        "Name": "Changes",
        "Changes": [
          "Find It Building Menu: a building lens inside the vanilla build menus, derived from Find It 1.5.8.",
          "Architecture remediation phases 1, 2 and 5: search debounce, one scoping taxonomy, the upstream filter bank and detailer features removed."
        ]
      }
    ]
  }
]
```

Rewrite `Properties/PublishConfiguration.xml`: keep the leading comment and the `DisplayName`, `Thumbnail`, `Screenshot`, `Tag`, `ModVersion`, `GameVersion` elements; `ShortDescription` = `A building lens inside the vanilla build menus: table, grid and list views with facets, metric ranges and a coverage overlay.`; `LongDescription` = a Markdown body of four short paragraphs (what it is; the three views and the facets/ranges; the coverage overlay and the picker; "derived from Find It 1.5.8 by T. D. W.; not a replacement for Find It") with no feature list, thanks or forum link; delete the `ForumLink` element; the `ChangeLog` element mirrors the JSON above as `# v0.1.0` + bullets.

Run the suites (green). Commit:

```bash
git add -A FindIt .gitignore
git commit -m "chore(findit): delete the detailer generators, ClearGooee, dead settings and the upstream residue files (cm-jjlv.9.3)"
```

(`git add -A FindIt` from `cs2-findit-building-menu/`; the `.gitignore` is at the repo root — add it by path from the root.)

---

### Task 4: The processor census

**Files:**
- Modify: `FindIt/Systems/PrefabIndexingSystem.cs` (`RunIndex`, the processor loop and the log block after `Indexed Prefabs Count`)

**Interfaces:**
- Produces: one log line per processor on a full index: `[PROCESSOR-CENSUS] <TypeName> indexed=<n> lens=<m>`.

- [ ] **Step 1: Record per-processor ids during the loop**

At the top of `RunIndex`, after `var existingMeshes = new List<string>();`, add `var census = new Dictionary<string, List<int>>(StringComparer.Ordinal);`. Inside the processor loop, immediately after `AddPrefab(prefab, entity, prefabIndex);`, add:

```csharp
								if (full)
								{
									if (!census.TryGetValue(processor.GetType().Name, out var ids))
									{
										census[processor.GetType().Name] = ids = new List<int>();
									}

									ids.Add(prefabIndex.Id);
								}
```

- [ ] **Step 2: Log it after the counts**

After the `Mod.Log.Info($"Indexed Prefabs Count: …");` line add:

```csharp
			if (full)
			{
				// Which processors feed anything the lens can show. A processor
				// whose every prefab is neither a building/network nor placed in
				// a vanilla menu is indexing for nobody — the review's "30
				// processors classify things the lens never lists" was a guess,
				// and Landscaping's trees say it was wrong; this is the count.
				var all = FindItUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any];

				foreach (var pair in census.OrderBy(pair => pair.Key, StringComparer.Ordinal))
				{
					var lens = pair.Value.Count(id =>
						all.TryGetValue(id, out var indexed)
						&& (indexed.Category is PrefabCategory.Buildings or PrefabCategory.ServiceBuildings or PrefabCategory.Networks
							|| IsPlacedInAnyMenu(id)));

					Mod.Log.Info($"[PROCESSOR-CENSUS] {pair.Key} indexed={pair.Value.Count} lens={lens}");
				}
			}
```

(`IsPlacedInAnyMenu(int)` exists as a public static on this system — check its name with `grep -n "public static bool IsPlacedInAnyMenu" FindIt/Systems/PrefabIndexingSystem.cs`.)

- [ ] **Step 3: Build, deploy, run, read**

`just build findit-building-menu` (0 errors), `just deploy-isolated findit-building-menu`. From the MAIN checkout: `just cs2-status` must read `no-game`; `just launch-cs2 claude-swift-ocelot-gZs --headless --check-menu`; load Porterville 3 (the pinned driver from phase 2 is at `/tmp/claude-1000/-var-home-gerbal-Games-CS-Modding/598d2088-3e68-4647-bd94-f0f2b9f36815/scratchpad/qa9444.mjs` if the shared instance file is not yours; otherwise `cs2_save_load`), wait for `query.load` = `succeeded`, then:

```bash
grep -E "PROCESSOR-CENSUS|MENU-AUDIT\]|MENU-COVERAGE\]|LENS-REFRESH|Exception" "$HOME/.local/share/Steam/steamapps/compatdata/949230/pfx/drive_c/users/steamuser/AppData/LocalLow/Colossal Order/Cities Skylines II/Logs/FindItBuildingMenu.log" | tail -60
```

Record every census line. The audit must already read Missing = 0 on Landscaping with the substitution clause gone (Task 3); if it does not, stop and read the missing names before Task 5 — the quantity-prop originals may need `PropPrefabCategoryProcessor` to accept them.

- [ ] **Step 4: Commit**

```bash
git add FindIt/Systems/PrefabIndexingSystem.cs
git commit -m "feat(findit): a per-processor census on every full index, so processors are deleted by count not by guess (cm-jjlv.9.4)"
```

---

### Task 5: Delete the processors the census names; verify; record

**Files:**
- Delete: every `FindIt/Utilities/PrefabCategoryProcessor/<Name>PrefabCategoryProcessor.cs` whose census line read `lens=0`
- Modify: `docs/verification.md`

- [ ] **Step 1: Delete by census**

For each `lens=0` line: `git rm -q FindIt/Utilities/PrefabCategoryProcessor/<Name>PrefabCategoryProcessor.cs`. Processors are discovered by reflection (`PrefabIndexingSystem` line ~153), so no registration changes. Then `grep -rn "<Name>PrefabCategoryProcessor" FindIt FindItBuildingMenu.Tests` for each must print nothing (a base class another processor derives from is NOT deletable even at `lens=0` — the build will say so; keep it and note it).

Run the suites (green), `just build` (0 errors), `just deploy-isolated`. Stop the game (`just game-stop claude-swift-ocelot-gZs <pid>` after checking `/proc/<pid>/environ`), confirm `no-game`, relaunch, load Porterville 3.

- [ ] **Step 2: Live acceptance**

Read the log: every surviving processor's census line has `lens>0`; `[MENU-AUDIT]` clean, Missing = 0 on every menu; zero `Exception`. Open Roads, Landscaping, Health & Deathcare, Zones, Electricity, then All menus, and read `[LENS-REFRESH]`: Roads 228, unscoped 3,995 unchanged, Landscaping ≥ 368, the others equal to phase 2's (8, 22, 15). Read the options screen's mod page through `cs2_mod_setting list`: the property list must contain no deleted setting.

- [ ] **Step 3: Record, stop the game, close beads, commit**

Append to `docs/verification.md` a section `## 2026-09-01 — filter bank and residue deleted (phase 5)` with the census table (processor, indexed, lens, deleted?), the audit line, the six `[LENS-REFRESH]` lines, the settings list, and one paragraph of what left (from the spec's "What is still running for nobody"). Stop the game and release the lock. From the main checkout: `bd close cm-jjlv.9.1 cm-jjlv.9.2 cm-jjlv.9.3 cm-jjlv.9.4 cm-jjlv.9.5 --reason=…` and `bd close cm-jjlv.9 --reason=…`.

```bash
git add docs/verification.md
git commit -m "docs(findit): verify phase 5 live — census, audit clean without substitutions, totals unchanged (cm-jjlv.9.5)"
```

Then the suite once more on the tip, `git status` clean, and superpowers:finishing-a-development-branch (merge to master authorized for tested branches; verify the merged tree; never force).
