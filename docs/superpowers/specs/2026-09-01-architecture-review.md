# cs2-findit-building-menu — architecture review (2026-09-01)

Delivered in-session on 2026-09-01 after three read-only deep dives (C# pipeline, TS UI, residue/tests) with every headline claim grep-verified against `master` at `8b29e8a`. This is the spec the remediation plans argue from; the numbered recommendation list at the end is the phase order.


# cs2-findit-building-menu — architecture review

## Verdict

The mod has outgrown its premise. It was scoped as "FindIt's proven foundation plus a building lens" (roadmap: reuse the index, no second scan, don't rewrite placement). What exists today is a new mod wearing FindIt's body: the upstream UI shell is deleted, `PrefabIndexingSystem` is 80% rewritten, and every visible surface is fork code — but the fork still carries, runs, and *gates itself on* upstream machinery whose output nobody reads. The lens layer itself is well-factored at the leaves (pure engine, pure domain helpers, 1,058 green tests) and badly factored at the seams: three scoping taxonomies in one query, two filter languages both silently active, a C#↔TS binding boundary with no contract, and presentation state owned by three parties. The design is recorded as scar tissue — 26% of C# lines are comments, 79 of them cite issue IDs, and there are unresolved `SPIKE` notes and an empty `if (zoning) { }` (`Bindings.cs:496`). Each fix is locally justified; the sum is not a design.

## The structural findings, ranked

**1. The fuzzy search runs on every keystroke and its result is discarded — and the lens refresh waits for it.**
`SearchChanged` → `TriggerSearch` → `Task.Run(DelayedSearch)` → 250 ms → `FindItUtil.ProcessSearch` (spell-check + abbreviation over ~24k prefabs) → `filterCompleted = true` → `OnUpdate` polls the flag → `RefreshBuildingCatalog` (`Methods.cs:311–352`, `Setup.cs:362–371`). The lens's own predicate is a plain `Contains` (`QueryEngine.cs:201–204`). `_cachedSearch` has one reader, `GetFilteredPrefabs`, which has **zero callers** outside `FindItUtil`. So the open P1s cm-yfd5 ("search takes 2.7s because fuzzy fallbacks run") and part of cm-2xvs.25 are the cost of a computation whose output is thrown away. Cutting the worker out of the lens path is an afternoon and fixes both.

**2. Three generations of scoping coexist in a 45-field query.**
`BuildingCatalogQuery` carries `Category/SubCategory` (upstream enums — "Both empty, always", `Methods.cs:64`), `BuildMenuSection/BuildMenuSubCategory` (`VanillaBuildMenuTaxonomy`, a hand-built table that *reconstructs* the vanilla menu from upstream's enums), and `UiMenu/UiCategory` (the game's actual `UIObject.m_Group` answer). The engine uses the reconstruction when unscoped and the real tree when scoped (`QueryEngine.cs:196, 359, 410`). `PrefabIndex.cs:155` says in its own words: "a second source of truth… Remove these two, or commit to them, once that question is answered." The question was answered (the tree covers Roads/Landscaping/Areas, per `Bindings.cs:170`); the removal never happened. (Correction, phase 2: `VanillaMenuAudit` does NOT audit the duplicate — it compares the game's own placements against the index's tree fields, i.e. index coverage, and it stays. See the phase-2 design.) Also `StripAxis` is published as a predicate axis but `StripMatches` ORs across all three axes regardless (`QueryEngine.cs:308`), so it's display-only while pretending otherwise.

**3. The legacy filter bank is orphaned but still applied.**
No TS calls `OptionClicked`/`ClearFilters` and nothing reads `OptionsList`/`AreFiltersSet`; the only writers of `FindItUtil.Filters.*` are the option sections themselves. Yet every refresh builds `GetFilterList()` and applies it inside `GetIndexedBuildings` (`Adapter.cs:1086`), snapshots it into `BuildingLensLegacyFilters`, mirrors `WithParking` into the typed query, and calls `_optionsUISystem.RefreshOptions()` to republish to nobody (`Methods.cs:74, 192, 234`). `RoleOption`/`PlacementFlagOption` are fork additions to a bank the fork then orphaned.

**4. Per-refresh fan-out: ~15–25 synchronous passes on the main thread.**
`RefreshBuildingCatalog` projects the index into a fresh `BuildingCatalogEntry` copy (~55 fields, near-1:1 with `PrefabIndex` — there's no reason for the second type), then `Query` enumerates the lazy match four times, `MatchesElsewhere` runs a second full query, `GetFacetState` bypasses the projection cache deliberately (`Adapter.cs:161`), and `GetMenuCategoryCounts` is reached from five different call chains (`:169, 285, 328, 436, 463`). `_projections` is cleared at the top of every refresh, so it dedupes within one refresh and caches nothing across keystrokes. The `[LENS-REFRESH]` timer exists because this was felt.

**5. The C#↔TS boundary has no contract, and both sides have rotted.**
C# publishes 9 bindings no TS reads (`BuildingLensSortCanReorder` — the cm-ddw3 feature, computed every refresh and never displayed — `BuildingLensMilestoneIcons`, `BuildingLensMenuToolTip`, `OptionsList`, …). TS reads `BuildingLensZoneFamilies` (`LensControlPane.tsx:69`) which C# never publishes, and emits `ToggleBuildingLensZoneFamily` and `SetBuildingLensRole` which no C# handler receives. Every file re-declares its own `bindValue` for shared names (`LensOwnsCurrentMenu` ×4, each with its own default and ad-hoc type). `buildingCatalogContracts.ts` covers ~8 of 27 triggers. Nothing fails at build time when either side renames. `PickerMenuRequest` is a hand-parsed `"index:version:nonce"` string standing in for a message.

**6. Presentation state has three owners; ranking and grouping run twice.**
`groupBy` lives in C# (read/write binding, primary sort key), in a module-global Map with hand-rolled pub/sub (`buildingLensViewState.ts`), and is independently re-derived by `defaultGroupDimensionFor` in *both* `BuildingCatalog.tsx:228` and `LensControlPane.tsx:135`, then pushed back to C# in a `useEffect` — three copies with a render-then-effect lag. Grid/list modes re-rank C#'s sorted page with `rankBuildingMatches` (`BuildingGrid.tsx:82`, `BuildingList.tsx:80`); table mode shows C#'s order. Same query, two orders. `buildGroupedView` (972 lines) rebuilds a group tree from a page C# already group-sorted; band edges are duplicated in `buildingGroups.ts` and `BuildingCatalogGrouping.cs` with a header admitting drift is "caught by tests rather than prevented."

**7. Ambient global state and unguarded threading.**
Six static state holders with no owner: `FindItUtil.CategorizedPrefabs/Filters/IsReady`, `IndexedPrefabList.Sorting` (decides iteration order everywhere via an implicit conversion), thirteen static dictionaries on `PrefabIndexingSystem`, `BuildingCatalogAdapter.ToolbarSelection`, `PlacedUniqueRegistry`, `PrefabTrackingSystem`. `DelayedSearch` reads the index off-thread while `RunIndex`/`ApplyUnlocks`/`ToggleFavorited` mutate it on-thread; `filterCompleted` is a non-volatile bool; `SearchUtil` keeps static scratch arrays. It works because the index is quiescent after load.

**8. Vanilla seams are DOM surgery on hashed class names.**
`BuildingMenuSurface.tsx:97–117` rewrites `.toolLayout` `justify-content`; `:184–207` finds a `game-main-screen` child whose `className.startsWith("toolbar_")` and sets `zIndex=-1`. `findScrollContainer` walks `parentElement`; three `document.querySelectorAll('[data-catalog-entry…]')` sweeps cross component boundaries. ~15 `getModule` paths with no fallback. The mount into the vanilla `AssetMenu` slot is the *right* seam — but the mutations around it fight the wrong tree.

**9. Tests are green and test the leaves.**
428 C# + 630 TS, pure-host, sub-second. Untested: `PrefabIndexingSystem` (the only place metrics/taxonomy are extracted), the adapter's instance paths, every `FindItUISystem` handler, all components, all vanilla seams, and the binding boundary (finding 5 is the proof). Eleven test files read *source as text* — `buildingLensUx.test.ts` has 48 regex assertions against `.tsx`/`.scss` like `/\$row-details-width: 26rem;/`; `SortReorderabilityTests.cs:147` reads `QueryEngine.cs` as a string. These fail on a rename and pass on a bug. The query engine's 1,044-line suite runs over five hand-built entries. `docs/verification.md`'s last live run is 2026-08-02, 328 commits ago; it still describes the compare tray, deleted in `95d44d5`.

**10. Residue with real cost.**
`ClearGooee` deletes another mod's folders from the user's Mods dir on every load (`Mod.cs:171`) — hostile, and shouldn't survive the rename. `Changelog.json` is FindIt v1.5.8's verbatim; `PublishConfiguration.xml` advertises upstream's feature list; a 38 MB `UI.zip` is tracked; `AutoVehiclePropGeneratorSystem`, `AutoQuantityPropGeneratorSystem`, `CustomAreaBorderRenderSystem`, `RegisterAPIs` are detailer features unrelated to a building menu; 30 category processors classify props/trees/decals/vehicles the lens never lists. The retained upstream code is also the thing with no license file — the stated publication blocker. Shedding it isn't tidiness; it's the release path.

## What is genuinely good

`BelongsInCatalog` as a pure tested invariant; `QueryEngine`/`BuildFacetState`/`MetricBoundsOf` static and pure; `ResetWindowIfPredicatesChanged`; `catalogWindow.ts` and `vanillaMenuWatch.ts` as small honest state machines; `shouldMountInAssetMenu` keeping the takeover rule pure; the growing-superset window; dual-phase indexer registration with a correct rationale; the coverage/audit logs that caught the roads-cost bug; uniformly annotated Cohtml `gap` replacements; and comments that cite measurements rather than intentions.

## What I'd do, in order

1. **Cut `ProcessSearch` out of the lens path** — debounce → `RefreshBuildingCatalog` directly. Closes cm-yfd5, most of cm-2xvs.25. One day.
2. **Add a binding manifest test** — extract `CreateBinding/CreateTrigger` names from `Systems/*.cs`, assert every `bindValue/trigger` in `UI/src` against it and vice versa. Would have caught 13 defects above. One day; then delete the orphans it names.
3. **Commit to `UiMenu/UiCategory`**: delete `VanillaBuildMenuTaxonomy`, `BuildMenuSection/SubCategory`, `VanillaMenuPresets`' enum half (not `VanillaMenuAudit` — corrected above). Resolve the SPIKE.
4. **One snapshot pass**: scope once into an `IReadOnlyList<PrefabIndex>` (drop `BuildingCatalogEntry`), derive page/counts/facets/bounds/strip from it, cache across refreshes on an index generation counter.
5. **One TS view store** owning viewMode/groupBy/expanded/anchors; delete `rankBuildingMatches` from grid/list (or make it C#'s ranking); ship `groupKey` from C# and delete `buildGroupedView`.
6. **Delete the orphaned filter bank and the residue** (`Filters`, `Domain/Options`, `FindItOptionsUISystem`, prop generators, `ClearGooee`, `Changelog.json`, `UI.zip`, non-building processors). This is also the license-surface reduction.
7. **Split `BuildingCatalog.tsx`** into `TableView` + `useCatalogWindow` + `useScrollAnchor` taking a real ref; replace the toolbar z-index/justify hacks with an owned container.
8. Replace source-regex tests with a render harness or delete them; script the smoke in `tools/e2e` so `verification.md` staleness is measurable.

Items 1–2 are cheap and de-risk everything after them. Item 3 is the one that changes the shape of the codebase most for the least code.

