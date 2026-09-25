# Better Building Menu — Verification log

Dated records of live checks, oldest first; the newest entry describes the
current build. What to run before a release is in
[release-checklist.md](release-checklist.md).

The `[LENS-REFRESH]` lines quoted below come from development (Debug) builds,
which still log one per refresh at Info. Since 2026-09-24 a release build logs
them only with Debug logging on.

Entries before 2026-09-01 covered the pre-rename lens: its compare tray,
object picker, locate and capacity-floor presets, all since removed. They were
dropped from this file on 2026-09-22 and remain in git history.

Some entries cite paths that are not in this repository. They belong to the
maintainer's workspace: `../docs/archive/…` design notes, `tools/e2e/…`
scripts and their artefacts, `compat/probe/…` screenshots, and `just` recipes.

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

### FindIt lens smoke — 2026-09-02 — bc10568

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

### FindIt lens smoke — 2026-09-02 — 08c7818

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

#### Scope

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

### FindIt lens smoke — 2026-09-02 — d71fb08

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

#### Scope

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

### FindIt lens smoke — 2026-09-02 — 2e51a78

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

#### Scope

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

### FindIt lens smoke — 2026-09-02 — db8271f

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

#### Scope

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

## 2026-09-09 — 0.1.3: listing rewrite and the Roads/Landscaping claim

The listing, the "Replace the vanilla build menu" option text, two `<remarks>`
in `BuildingMenuUISystem.Bindings.cs` and the `VanillaMenuWatcher.tsx` header
all said Roads and Landscaping keep the vanilla grid. Read against the code:
`VanillaMenuSelected` (Bindings.cs:230) yields to vanilla only when the setting
is off or `GetAssetMenuName` returns empty; no menu name is tested anywhere in
the source (`grep -rn Landscaping` over `.cs/.ts/.tsx`, non-comment hits are
category enums and measurements). Every named vanilla menu is routed. All five
texts corrected; Locale.json is an embedded resource so this needed a package
(0.1.3, NewVersion, "New mod version published"). UI suite 651 + render 69
pass. Not re-verified live: the corrected option text in the Options screen.

## 2026-09-09 — the six options, each flipped live

Prompted by "I don't trust that the options in the options menu actually do
what they say they do." Main prefix (949230), Porterville, desktop launch
(`just launch-cs2 <agent> --prefix 949230 --cdp-port 9444`). Each option was
set through the game's own widget with Options open —
`trigger("options","setValue",["BetterBuildingMenu.BetterBuildingMenu.Mod.BetterBuildingMenuSettings.<Name>"], value)`
— and the value confirmed in `BetterBuildingMenu.coc` before the probe. Menus
were cleared (`toolbar.clearAssetSelection`) and reopened
(`toolbar.selectAssetMenu`) between steps; a menu that is already selected
does not re-fire `VanillaMenuSelected`, which invalidated the first pass.
State read from the mod's bindings and `infoview.activeInfoview$`.

| Option | The description says | Measured |
|---|---|---|
| ReplaceVanillaBuildMenu | panel instead of the vanilla grid; off gives the icon row back | Off, then Electricity: `LensOwnsCurrentMenu` false, 0 of our tiles. On again: 15 tiles. Holds for a session that started on. A session that starts off still needs a restart after turning it on: the `ReplaceVanillaBuildMenu` UI binding is created once (Setup.cs:196) and `OnSettingsApplied` re-pushes only the tile size (the 949230-c note above measured that case). |
| AutoWidenSearch | drop the category and search everything | Landscaping, search `school`. Off: total 0, `BuildingCatalogMatchesElsewhere` 6, "Search everything" button shown. On: total 6, no button. Works. |
| BuildingLensTileSize | width of each tile in the grid | 64 → tile `style.width` 64rem, 42.7px measured; 100 → 100rem, 66.7px. Works, live. (Cards view is 98px either way; the slider only says "grid".) |
| ShowCoverageOverlay | switch the map to the service's coverage view while a service building is on the tool; restore after | With the option **off** (coc `false`): Small Police Station → `Police`, City Fire House → `FireRescue`, Small Medical Clinic → `Healthcare`, Tiny Park → `Leisure`, Mailbox → `PostService`, Small Elementary School → `Education`; clear → `null`. Identical with it on. The game does this itself; the option changes nothing a player can see. The alias table in `ServiceCoverageOverlaySystem` has no "Leisure", so parks never resolved through the mod anyway. |
| SelectPrefabOnOpen | selects the first asset when the menu opens | On (the default), Electricity opened: `ActivePrefabId` 0, active tool "Default Tool". The only `SetLensMenuOpen(true, …)` call (Bindings.cs:303) passes `activatePrefab: false`, so the branch at Bindings.cs:570 is unreachable. Dead option. Vanilla, on its own, re-arms the last asset used in a menu when that menu is reopened (every second visit came up with the Object Tool armed). |
| HideRandomAssets | ignores Random/Placeholder assets; needs a reload | On (this profile's value): index 17,325, `[MENU-COVERAGE] vanilla shows 841 … 3 missing` = `TrashpileRandom01`, `BoulderRandom01`, `RockRandom01` (Landscaping). Off, then Load Game from the pause menu: index 17,693, 0 missing, Landscaping search `random` lists exactly those three (Landscaping total 376). Works. On this content it removes three menu assets and 368 index entries. |

**Text problems found on the way.** The AutoWidenSearch description says
"the lens". SelectPrefabOnOpen describes something that never happens.
ShowCoverageOverlay credits the mod with the game's own behaviour. The
`Key-Bindings` tab is in `SettingsUITabOrder` with no binding behind it; the
widget dump returned only the six options, no tab entry. The Ctrl+N comment
above `ReplaceVanillaBuildMenu` in Setting.cs describes a binding that no
longer exists.

**Not tested.** The upgrade-panel replacement (`ExtensionMenu.tsx`) with the
replace option turned off mid-session — it reads the same once-captured
binding, so by code it keeps replacing until restart. A session that starts
with the replace option off (measured on 949230-c above, not repeated).

Settings restored to what the profile had: HideRandomAssets on, tile 100,
the rest default. Game stopped with `game-stop` ("Sent SIGTERM", 0 procs).

**Shipped as 0.1.4 (same day).** Removed `ShowCoverageOverlay` and its
`ServiceCoverageOverlaySystem`, `SelectPrefabOnOpen` and the unreachable
`activatePrefab` branch of `SetLensMenuOpen`, and `HideRandomAssets` with the
`PlaceholderObjectData` query exclusion — Random assets are indexed like
everything else now. `SettingsUITabOrder` lists only the Settings tab; the
Actions/Navigation/Other group names and the Key-Bindings tab label left
Locale.json and the thirteen translations. AutoWidenSearch's description no
longer says "the lens". Release build + package (dll 430,080 bytes; 0 hits
for the removed names, 1 for the new wording), 399 backend tests pass, UI
source untouched. Deployed to both Mods roots; `NewVersion` → "New mod
version published". Not re-verified live: the options page with three
entries.

## 2026-09-10 — comment pass under the new rule

Four comments-only passes (indexer, other C#, UI TypeScript, stylesheets and
tests) after the dead-code commit. Guard: every changed `.cs/.ts/.tsx/.scss`
file stripped of comments is byte-identical to HEAD (`246 changed files, 0
with non-comment differences`). Comment lines 13,708 → 7,528 of 55,403 → 49,069
source lines; C# 26% → 16%, TypeScript 21% → 14%, SCSS 28% → 13%. Long
rationale moved to `docs/indexing.md` and `docs/design-notes.md` with one-line
pointers from the code. Release build clean; 399 backend, 651 UI, 69 render
tests pass. Not verified live: nothing changed that could show in the game.
Follow-ups the passes flagged, all code rather than comments: `.tile
{ position: relative }` in buildingGrid.module.scss anchors nothing now;
`.rowPlaceButton` has a rule but no element; `localizableStrings.ts` names a
`ZoningHierarchy` source that no longer exists; `FolderUtil.SettingsFolder` is
declared and never used; one grouping test's fixture cannot distinguish tab
order from alphabetical order.

### Visual pass after the comment and dead-code commits (2026-09-10, 8cb5a2b)

Main prefix, Porterville, desktop at 1280x720, one display output on.
Build 8cb5a2b deployed to both Mods roots. Index 17,693 prefabs, `[MENU-COVERAGE]
… 841 … 0 missing`, 0 exceptions. Menu totals identical to the 2026-09-09
options audit: Roads 204, Landscaping 376, Electricity 15, Education 13,
Health 8, Zones 22, Parks 50; Landscaping search `school` 0 with 6 elsewhere.
Roads captured in Cards, Grid, Table, hover card and Group-by picker
(`scratchpad/vis/after-*.png`) against the 720p set from 2026-09-09: the tab
strip and its counts, card layout, table columns, picker entries and position
all match. Two differences, both settings or earlier fixes, not regressions:
Grid tiles draw at the default 100rem (66.7px, read from the tile style) where
the baseline had the slider at 144; a road's Lot reads "–" where the baseline
read "0 × 0", which the column-model pass fixed. The driver's hover step picked
a tile scrolled under the panel's fold (the card drew below the window); the
driver now hit-tests the tile centre, and a re-hover of the last visible tile
drew the two-tier card above it as before. Escape: the panel unmounted but
`LensOwnsCurrentMenu` still read true 800 ms later; not conclusive, code
untouched by both commits, unit-covered by `escapeClosesLens.test.ts`.

## 2026-09-10 — Asset Menu Tweaks (Paradox Mods 148616, v1.0.7) alongside

A player report said "nothing happens" with Asset Menu Tweaks installed.
Subscribed to it here through the game's own Paradox Mods browser (a second
Cohtml view, `assetdb://modsui/index.html`; "Add to active playset", then a
restart), Porterville on the main prefix. Modding.log: both mods loaded, UI
modules registered Better Building Menu first, Asset Menu Tweaks second, so
its AssetMenu wrapper sits outside ours; 0 exceptions in either mod's log.
Both extend the same vanilla export; the game's registry chains extensions
(`extend` overrides with `n(current)`), it never drops one.

Measured: Electricity 15 tiles, Roads 100 of 204 drawn, ownership true,
vanilla grid 0 — our panel intact with its gear button drawn at our panel's
bottom edge. Each of its options flipped through its own triggers
(`TRIGGER:REDESIGNED_TABS`, `WIDESCREEN`, `DENSITY`=2, `HIDE_BADGES`): our
surface kept the same rect, flex column and 100 tiles every time; the
Redesigned Tabs selector needs a `tool-panel_` parent our slot does not have.
With "Replace the vanilla build menu" off, Roads showed vanilla's grid (18
items) and its density option took effect there (24 at High); back on, our
100 tiles returned. A first probe read 0 tiles 1.8 s after the menu switch
and 15/100 at 3.5 s: the surface mounts later behind its wrapper, a timing
artefact and not a defect. The reverse registration order is not testable
here (local mods register before playset mods) but is the safer one by
construction: ours outermost never renders their wrapper while we own the
menu. Conclusion: no conflict; the report needs the player's logs.

Escape, re-read with a 2 s wait: ownership true → false, panel gone. Works.
Asset Menu Tweaks is still in this machine's active playset.

**Both from Paradox Mods (same day).** Local copy moved out of both Mods
roots; the published 0.1.4 (158589, package `158589_5`) subscribed through
the in-game browser next to Asset Menu Tweaks. This boot registered the UI
modules the other way round — Asset Menu Tweaks first, ours second, ours
outermost — which is the reverse of the local-mod run above, so both orders
are now measured. Same results: Electricity 15, Roads 100 of 204, ownership
true, vanilla grid 0; all four of its options on at once left our surface's
rect, column layout and 100 tiles unchanged; Escape closed the panel; 0
exceptions in either mod's log or UI.log. No conflict in either order.
Both mods then removed from the playset through the browser and the local
copy put back, so the next launch loads the workspace build alone.

**No restart needed for a playset mod (same day).** Asset Menu Tweaks was
added to the active playset from the in-game browser with the game already
at the main menu, then Porterville was loaded in the same session. Modding.log
shows a second "Active Playset" block at the city load listing it, `Loaded
AssetMenuTweaks` six seconds later, and both UI modules registered; the
probe read our 15 and 100 tiles with its container present. The game
re-reads the playset at every city load, so a player who subscribes and
then loads a city gets the mod without restarting; the earlier note above
saying a restart is required was wrong (I had restarted without testing).
The browser shows no restart notice either. Asset Menu Tweaks was left in
this machine's playset at the end of the run (the removal script missed
the browser's load window); it is harmless to our checks and one click to
remove.

## 2026-09-10 — the "nothing happens" report, reproduced and fixed (0.1.5)

The reporter had Asset Menu Tweaks and then subscribed to this mod. Done
here the same way: local copy out of both Mods roots, Asset Menu Tweaks in
the playset at boot, our listing added from the in-game browser at the main
menu, Porterville loaded without a restart. Result: a blank white page. The
game injects a new UI module into the live page once the city is up;
`UI.log` then has `TypeError: Cannot read properties of undefined (reading
'length')` from React's memo compare, stack through
`BetterBuildingMenu.mjs` into vanilla's `useToolOptionsVisible`. Our
`ToolOptionsVisibility` wrapped that hook and called `useValue` before it,
so the already-mounted tool options panel rendered with one more hook than
its previous render; React unwound the whole tree. The backend was fine
(index 17,693 at loading-complete, 0 missing). At boot the same code is
harmless because the panel first mounts with the wrapper in place.

Fix: the wrapper reads `LensOwnsCurrentMenu$.value` with no hook, and a new
`ToolOptionsPanelRefresh` extends the `ToolOptionsPanel` component (a type
swap remounts, so its own `useValue` is safe) to re-render the panel when
ownership changes. Tests: `test/render/toolOptionsVisibility.test.tsx`
mounts a panel on the vanilla hook, swaps in the wrapper, re-renders the
same instance — it failed with React's own "Rendered more hooks than during
the previous render" before the fix; `toolOptionsPanelRefresh.test.tsx`
covers the re-render. The harness's `useValue` stub is now a real hook and
its bindings carry `.value`; react-test-renderer added as a dev dependency.
72 render + 651 unit + 399 backend tests pass.

Published as 0.1.5 ("New mod version published") and re-run the same way
against the downloaded package `158589_6`: 0 JS errors, Electricity 15 and
Roads 100 of 204 tiles, ownership true, index at OnGameLoaded. Both mods
removed/left as follows: ours out of the playset, Asset Menu Tweaks still
in it; the local Mods copies restored and updated to 0.1.5.

## 2026-09-10 — the in-session install, second look (0.1.6)

The 0.1.5 crash was in the in-session path but is not what "no effect" looks
like, so the path was walked again with the reporter's order: Asset Menu
Tweaks at boot, ours added from the store at the main menu, the city loaded
at once. Facts measured on the way:

- The game does not refuse Load while a package is downloading; it holds
  the load's mod-initialisation step until the download lands (load 15:56:40,
  package 15:58:18, "Mods initialized" 15:58:30) and registers the UI modules
  before the city's UI mounts. Download timing therefore cannot change the
  outcome.
- With 0.1.5 in that path: OnLoad 15:58:30, no OnGameLoaded pass (the save
  was deserialised before the mod arrived), catalog empty and every menu
  yielded to vanilla until the loading-complete pass at 16:02:10, after
  which both menus were ours. The loading screen covers the UI for that
  whole window (screenshot `compat/probe/before-complete.png`), so a
  player cannot click into it; the pass runs in the same event that lifts
  the screen. Not player-visible, but 0.1.6 indexes on the first update
  when the indexer is created inside a running city anyway
  (`_indexOnFirstUpdate`; loading-complete still runs its own pass since
  `_indexedAtGameLoaded` stays false).
- After returning to the main menu with a changed playset the game shows
  "List of Enabled Code Mods Changed — The game restart required" with
  Continue and Quit Game (`compat/probe/mods-changed-dialog.png`). Continue
  keeps the in-session path.
- 0.1.6 loaded at boot: OnGameLoaded pass, loading-complete skipped, 0 JS
  errors, both menus owned. The first-update branch itself was NOT observed
  live: the playset auto-updated the entry at boot, and two later attempts
  to remove and re-add the listing in-session missed the store page.

What "no effect" still could be, with the logs to look for: the mod not in
the active playset (Modding.log's "Active Playset" block lacks 158589); the
0.1.4 white screen described loosely (UI.log "JS Error" with
BetterBuildingMenu.mjs in the stack); a UI module path missing on their
game build (UI.log "Module … was not found"); or the replace option off.

Cleanup: ours removed from the playset by editing playset_config.json with
the game closed (backup kept beside it), Asset Menu Tweaks left in; local
Mods copies restored at 0.1.6. Store: NewVersion 0.1.6, then an Update to
restore the forum link and the corrected 0.1.6 changelog text.

## 2026-09-11 — popular-mod compatibility, measured

See `docs/compatibility.md` (survey and the measured table). Method: the
cached Paradox packages copied into the local Mods folder as local mods
(two stages, 10 then 15 mods), our 0.1.6 from the store; probes read the
catalog totals, thumbnail hosts and category tabs for Roads, Landscaping,
Zones, Water & Sewage, Police & Administration and ExtraAssetsMenu with the
panel on and off; screenshots under the session scratchpad `compat/probe/`.
Two conflicts (Water Features' tools missing; Extra Assets Importer's menu
taken over but empty), two layout mismatches (Asset UI Manager, Zone
Organizer), the rest clean. Untested: Tree Controller, Line Tool.

## 2026-09-11 — the compatibility fixes verified, and the tab icons

0.1.7 (yield an unfillable menu, index whatever the menu places, follow the
game's live placement) then 0.1.8 (category icons). Live on Porterville with
the relevant mods installed locally: audit 0 missing and 0 misplaced, no
exceptions in any mod log, no JS errors, 416 backend tests. The icon chase
cost two wrong hypotheses; the evidence that settled it was reading the
game's own tab bar img src beside ours in the same session, then the game's
`ImageSystem` surface via ilspycmd. Details in docs/compatibility.md.

## 2026-09-22 — 1.6.2f1, and the forum's three bugs (0.1.11)

The game updated to 1.6.2f1 (build 25127643, Cohtml 1.64 → 2.2.1.3). Full-chain
boot with the unchanged launcher hook, IL patches re-applied (24/24), the mod
rebuilt byte-identical against the new assemblies, 422 backend tests. Live on
Porterville 6 (84 unknown creator-pack prefabs, so the placed-unique census is
not trusted there): audit 15 vanilla menus, 1124 placements, 0 missing; Roads
263 with the tab bar host drawn; 0 JS errors, 0 exceptions. Player.log's
`[MENU-AUDIT] … is not a vanilla menu` lines at boot are the pre-index passes
the mod itself labels NOT CLEAN; the mod's own log shows the clean audit.

The forum thread, read through the game's own Mods UI event bus
(`pdx.get_forum_posts`, mod 158589, PDX version key 7, thread 1941089), gave
three bugs, each measured before the fix and after:

- Full index at boot (Loki, 0.1.9): nine full passes of 2.1–4.3 s in the
  first minute at the main menu, prefab count unchanged, 820 log lines — one
  per mod locale file, because `onActiveDictionaryChanged` fires for every
  source added, not only a language change. `LocaleReindexPolicy` defers those
  to one pass after a second's quiet and runs at once only for a new locale;
  every full pass now logs its trigger. After: zero passes at the menu, one
  `Full pass at OnGameLoaded` (3.4 s) for the load, 174 log lines, audit
  unchanged.
- The Already Built mark (owner, 0.1.10 on 1.6.2f1): 64×64 px over a 26.7 px
  picture in the extension picker AND the Signatures list, cornered at the
  inset. Cohtml 2.2 sizes an auto absolute `<img>` to its intrinsic pixels
  whatever its offsets pin; 1.64 stretched it. Inline `100%`/`20px` sized
  correctly, `auto` did not, and no 64px rule exists anywhere. The mixin now
  states `mark-size($picture)`. After a view reload: 18.8 px inside the 26.7 px
  box in both views.
- No resize on the upgrades picker (Loki): the strip and its drag are now
  `LensResizeHandle`, mounted on both panels against the one
  `BuildingLensPanelHeight`; the picker takes it as a max-height and scrolls.
  Verified with real input through the bridge (`input.frames`, target `ui`,
  screen space is Y-up at the DOM's scale): the binding went 420 → 510 rem,
  the catalog 280 → 340 px, the two-row picker stayed two rows. A synthetic
  `MouseEvent` cannot test this: Cohtml drops the constructor's clientX/Y.

Not verified: placing an upgrade through the picker (Ricke3661's report).
The Object Tool armed through the bridge takes no control point from injected
world frames here, so nothing could be placed to select. The picker's click is
vanilla's own `selectUpgrade` with vanilla's entity (render test), which is as
far as the code can say.

## 2026-09-22 — the unlock pip, confirmed (cm-t8ba)

The fix has been in since 0.1.5 (`ClearVanillaMenuHighlights`, the two reflected
toolbar bindings); what was missing was a save with a fresh unlock. Made one on
Porterville 6 through the bridge: `sys.invoke Game.Prefabs.UnlockSystem
UnlockPrefab(entity, true)` on a locked road ("Large Road", 16079:1) raises the
real `Unlock` event, and `toolbarGroups` reported Roads `highlight: true`
(`UnlockAllSystem` is no use here: it calls `UIHighlightSystem.SkipUpdate`).
Opening Roads in the panel logged `[UNLOCK-PIP] cleared 3 highlight(s) under
'Roads'` — asset, category, menu — and the flag read false, and stayed false
across a close and reopen. The same on Transportation with a locked bus station.
Zones held no locked asset in this save; the clearing is per menu and identical.

## 2026-09-22 — 0.1.11 shipped

Release build (`all`, `test`, `package` under `CS2_BUILD_CONFIG=Release`):
428 backend tests, package stamped 0.1.11 (dll `6de7018a56b6`), the two
card-row fixes present in the packaged stylesheet. Game closed first — the
uploader rotates the login tokens the game reads. `NewVersion` from a scratch
directory with the configuration's image paths made absolute: auto-login,
"New mod version published". One `[L3_Error__] … IOERR_101 Invalid
cross-device link` line came from the SDK's background mod downloader moving
a file between `/tmp` and the prefix, before the upload; not the upload. The
metadata `Update` two minutes later: "Mod metadata Updated" on the first
attempt. The stray `C:` tree the uploader leaves was deleted from the scratch
directory both times; none under the toolchain.

Carries: the locale re-index policy, the badge size, the shared resize edge,
and the two Cards-view row fixes found during the owner's QA the same day.

## 2026-09-22 — the resize edge announces itself (cm-uact.7, first step)

Chosen over auto-fit and header presets after a critical pass: the cheapest
change that does not prejudge whether the "too much screen space" report is
about height at all. What the stylesheets showed: the game draws its own
cursors and never writes a CSS keyword past `default`/`pointer`/`none`, so
the strip's `ns-resize` mapped to nothing — hovering the edge showed no
cursor. Vanilla's draggable value fields use `cursor://vertical-can-resize`
(hover) and `cursor://vertical-resize` (drag); the strip and the drag
blocker now do the same, and the grip rests at the scrollbar thumb's
`rgba(var(--scrollbarColor), 0.6)` instead of 0.35. Live on Porterville 6:
computed cursor `url(cursor://vertical-can-resize)`, grip
`rgba(255,255,255,0.6)` (the root token; not the dark variant some panels
carry). No glyph on the pill: vanilla's grabbable bars carry none. Still
owed before anything larger: the footprint measurement, ours against the
stock icon row at 720p and 1080p, control pane open and closed.

## 2026-09-22 — what the Cohtml 1.64 → 2.2.1.3 jump changed, and the `gap` migration

Version-gated against Coherent's feature changelog and probed live on 2.2.1.3.
The three layout defects fixed earlier today each trace to a 2.2.0 row: images
keep their source aspect ratio by default (the badge), and a new flex algorithm
with real `gap` (the stretched wrapped line, and the rounding wrap). Vanilla's
own 1.6.2 stylesheet already uses `gap` fourteen times and `aspect-ratio` twice.
Still absent on 2.2.1.3, probed: `:not()`/`:has()`/`:is()`/`:where()`,
`:nth-child(an+b)`, `:first-of-type`, `:empty`, `:checked`/`:disabled`, CSS
Grid, `inset`, `min()`/`clamp()`, `position: sticky`, `will-change`,
`object-fit`, `innerText`, `fetch`, `IntersectionObserver`, `structuredClone`,
`Intl`, `scrollIntoView`, `CSS.supports`; `align-items: baseline` still rejected
(2.2 added `vertical-align: baseline`, a different thing). V8 unchanged at 9.4.

The card list now spaces with `gap: 4rem` instead of the negative-margin gutter,
and the zero-height spacer from earlier today is gone: a shrink-to-fit group's
max-content counts gap but not item margins, which was the whole rounding wrap.
Live before the change, with the gap rules injected: all 17 Zones groups on one
line. After the build and a view reload: 17 groups, none multi-line, none
clipped, gaps 2.67 px, lists 38.7 px (2.67 shorter — the gutter's phantom top
margin), cards 33.3 px, pictures 26.7 px. `object-fit: contain` removed from
three rules: never implemented in Cohtml, so never did anything; the deny-list
contract now refuses it and no longer refuses `gap`.

## 2026-09-22 — the grid had the same gutter wrap (owner's QA, Zones in Grid)

Two tiles in a group sized for two stacked into a column; three went two and
one; five fit their row. Same arithmetic as the cards: content width exactly
n × (66.7 tile + 2.67 gutter), zero slack, the negative-margin gutter's
max-content again. `gap: 4rem` on `.tiles` live: every group one line, group
heights 128 → 72 px, widths unchanged. Built, deployed, view reloaded, Grid
reselected: 17 groups, none multi-line, none clipped, gaps 2.67 px, tiles
53.3 px. `.groupRow` keeps its gutter: its wraps are real overflow (bands of
768–2036 px in a 710 px row), and `gap` there changed no line count.

## 2026-09-22 — the height floor is one row of cards (owner's request)

The floor was 200 rem in three unlinked places: the TS clamp, the C# clamp
(a test asserts those two agree) and `.content { min-height }`. First try,
75 rem = heading reserve + list padding + one card, clipped the row: the
catalog's own 8 rem padding top and bottom was uncounted, and Zones groups two
levels deep, so its first row sits under two heading reserves. Measured from
the content top on Porterville 6: 5.3 + 11 + 11 + 2.7 px to the card, 33.3
card, 2.7 + 5.3 below = 71.3 px. Floor set to 108 rem (16 + 2 × 17 + 8 + 50)
in all three, with a stylesheet contract deriving the number and pinning the
`min-height` to the TS constant. Live after a drag past the floor: binding
108, content 72 px, one row fully visible under both headings, 8.7 px below
it. The Grid view's row is 80 rem tall, so at the floor it shows a partial
row; the floor was asked for in cards.

## 2026-09-22 — 0.1.12 shipped

Release build of both sides (`all`, `test`, `package` under Release): 428
backend tests, 658 unit and 77 render on the UI, package stamped 0.1.12 (dll
`5dd2993e3251`) carrying the resize cursor, both `gap` migrations, the grid
fix, the `object-fit` cleanup and the one-row floor. Game closed, `NewVersion`
from a scratch directory with absolute image paths: "New mod version
published". Stray `C:` tree removed from the scratch directory; none under
the toolchain.
The metadata `Update` two minutes later, first attempt: "Mod metadata
Updated". No stray tree afterwards either.

The store's 0.1.12 changelog carried the 0.1.11 section too: the
`<ChangeLog>` element had the new entry added above the old one instead of
replacing it. Trimmed to 0.1.12 in the repo config and the scratch copy, and
a second `Update` (game closed, first attempt) returned "Mod metadata
Updated"; the echoed changelog holds only the 0.1.12 lines.

## 2026-09-24 — card facts against vanilla's binders (by code reading)

Every figure the card draws was set against the binder that shows it in
`PrefabUISystem` (1.6.2f1), and the arithmetic behind it. Not yet checked in
game. Fixed:

- An incinerator's Capacity was its garbage store drawn as megawatts: the
  largest capacity of every role, in the primary role's unit. Capacity is now
  the primary role's own figure. An incinerator is filed as a garbage facility,
  as a landfill is, so its Capacity is a weight like theirs, and its output
  gets vanilla's Power output line. The primary is the first role that has a
  figure: a water treatment plant's pumping station holds no water, so it is
  filed by its sewage, and keeps its 400,000 m³ a month.
- Power output is `PowerProductionBinder`'s sum: the plant plus wind, solar,
  garbage, water, groundwater and an emergency generator, which is a power
  source on its own too.
- Upkeep comes from the `ServiceUpkeepData` buffer alone. A signature or zoned
  building showed its renters' upkeep as the city's. It now has none, so the
  table's Upkeep column, its sort and its range skip those buildings.
- `UpkeepModifierData` is labelled Resource consumption, as vanilla labels it:
  `CityServiceUpkeepSystem` applies it only to the resources a building burns.
- Graduation is points added to a probability (`GraduationSystem` ends on
  `+ graduationModifier`), drawn "+5 %", not "×0.05".
- Student and inmate wellbeing and health, and work conditions, are offsets:
  a negative one is drawn, signed.
- Comfort is read from parking facilities and transport stops as well as
  stations, as vanilla's three COMFORT binders do.
- A groundwater-powered plant draws ground water (`RequiredResourceBinder`).
- A network that owns a building is read from the building.
- Effects take vanilla's units: a whole percentage (the game ships
  `percentageSingleFraction` separately, so `percentage` is whole) for relative
  effects and the absolute city effects `CityModifierBinder.GetModifierUnit`
  names, one decimal otherwise, invariant. The one-decimal unit is a whole
  number from 100 up, and 0.1 for anything smaller that is not zero, as the
  game's UI formats it.
- The deathcare processing rate rounds up; a road with no upkeep has no
  upkeep line; homes per cell keep a decimal; Fish is worded; the shelter's
  vehicles are evacuation buses.
- Stormwater capacity and transport type move to our tier: no binder shows
  them. The elevation cost, which never matched a road, is gone.

Deliberately not matched:

- Network upkeep rounds the per-kilometre product, which is what
  `NetUtils.GetUpkeepCost` charges; vanilla rounds the per-cell figure first
  (¢487/km/mo. against ¢500). So a network under half a cent a cell, whose
  upkeep vanilla leaves off, shows one.
- Power output is one figure, the top of vanilla's range: vanilla shows the
  plant's own output up to that plus every source that can add to it, as
  0–400,000 for an incinerator. The table's column and sort need one number.
- Upkeep is the budget-free figure: vanilla scales it by the service's current
  budget, which is city state, not a fact about the building.
- Vanilla's upkeep is a range whose top prices the burned resources at market;
  the card names each resource and its amount under the upkeep instead.
- The deathcare capacity keeps its "plots" unit, though a crematorium's store
  is bodies held, not plots.
- A telecom facility's capacity keeps its decimal; vanilla rounds it up.
- A percentage effect that rounds to nothing draws no line; vanilla binds every
  one but CriminalMonitorProbability, zeros included.
- Effect numbers are invariant, so a comma-decimal locale reads "1.5" in an
  effect line beside "1,5" elsewhere on the card.

Not drawn then, though vanilla shows them: pollution levels, transformer
capacity and voltages, a pipe's water type, transport stop counts, a network's
auxiliary networks in its cost, and the power-line rule's lighting and layer
tests. All are drawn since; see the next section.

## 2026-09-25 — the tooltip lines the card did not draw (by code reading)

Each line the audit above found missing, transcribed from its binder in
`PrefabUISystem` (1.6.2f1). Not yet checked in game.

- Pollution levels (`PollutionBinder`): ground, air and noise, each graded
  against the thresholds in `UIPollutionConfigurationPrefab`. A figure has to
  pass a threshold to reach its level (`PollutionUIUtils.GetPollutionKey`).
  Shown once the three figures sum to anything; a level of none is left off.
- Voltage: a power plant's from its transformer's low side and its own
  power-line sub-nets (`PowerProductionBinder`), a power line's from its
  network's layers. Anything but one voltage alone reads "Low and high", no
  power line at all included, as `ElectricityUIUtils.GetVoltage` words it.
- Power-line capacity follows `ElectricityConnectionBinder`: a connection that
  is not street lighting, on a network with a power-line layer. It replaces a
  rule of ours that left out every road, so a road whose connection passes the
  binder's test now shows one, as vanilla's tooltip does.
- Transformers (`TransformerCapacityBinder`, `TransformerInputBinder`,
  `TransformerOutputBinder`): the smaller of what the low- and high-voltage
  connections carry, over the sub-nets that start and end on one node; input
  high, output low. A power plant's own transformer shows only its output.
- The pipes a network carries built in (`WaterConnectionBinder`): fresh
  water, sewage or both. A pipe itself is a pipeline, which the binder leaves
  out, so this is a road's line, labelled "Water pipes" beside its features.
- Transport stops (`TransportStopBinder`): a building's passenger stops,
  counted by kind. The first stop decides whether there is a line at all, so a
  building whose first stop takes no passengers shows none; a network shows none.
- Auxiliary networks (`PlaceableNetCostBinder`): a network's cost adds each
  auxiliary network's, and theirs in turn, scaled by (1000 − 2z) / 1000 of its
  offset.

Deliberately not matched:

- The words are the game's own, which it translates into its twelve languages,
  wherever it has them: `Properties.VOLTAGE:0` to `:2`,
  `Properties.WATER_PIPE_TYPE[…]`, `Properties.TRANSFORMER_CAPACITY`,
  `_INPUT` and `_OUTPUT`, `Properties.TRANSPORT_STOP_COUNT[…]`,
  `SelectedInfoPanel.POLLUTION_LEVELS_GROUND`, `_AIR` and `_NOISE` and
  `SelectedInfoPanel.POLLUTION_LEVELS:1` to `:3`. They are in the game's
  `Locale.cok`, checked in game; the refs hold only its assemblies. Two labels
  are ours: "Voltage", and "Water pipes", where the game's "Pipes" would sit
  beside a road's own "Carries" line.
- A network whose own cost for a cell rounds to nothing still shows a cost line;
  vanilla leaves it off. The same rounding choice as below.
- A network's cost is rounded once, per kilometre, with each auxiliary
  network's share added first. Vanilla rounds the network's own cost for a cell
  before multiplying by 125 and truncates each share on its own, so a cell cost
  of 12.4 reads ¢1,550/km on the card and ¢1,500 in vanilla. The rounding
  predates the auxiliary networks, and is the same choice as the network
  upkeep's above.
- A transformer with no capacity draws no capacity line; vanilla binds a zero.
- Stops are one line per kind, where vanilla draws one map of them.
- A network whose sub-objects hold a power plant without one owning the
  network shows no output or voltage; vanilla sums its sub-objects' output.

## 2026-09-25 — the card's vanilla lines in the game's own words (by code reading)

The lines the card draws in vanilla's tier now take the label key vanilla's
binder passes (`PrefabUISystem`, 1.6.2f1), so they read as the game's tooltip
does in each of its twelve languages. Our English stays as the fallback. Not
yet checked in game.

- Cost and upkeep: `Properties.CONSTRUCTION_COST` and `Properties.UPKEEP`, on
  the card only. A network's cost takes the building's key too:
  `PlaceableNetCostBinder` passes `Common.ASSET_CONSTRUCTION_COST`, but no
  locale carries that key (checked in game), so it would read "Cost" in every
  language. The table's columns and the range filters keep ours, which are
  shorter.
- The service figures: `DECEASED_PROCESSING_CAPACITY`,
  `GARBAGE_PROCESSING_CAPACITY`, `MAIL_SORTING_RATE`, `CARGO_CAPACITY`,
  `JAIL_CAPACITY`, `GARBAGE_STORAGE`, `MAIL_BOX_CAPACITY`, `ATTRACTIVENESS`,
  `COMFORT` and `RESOURCE_CONSUMPTION`, all under `Properties.`.
- The vehicle counts: `GARBAGE_TRUCK_COUNT`, `POST_VAN_COUNT`,
  `POST_TRUCK_COUNT`, `AMBULANCE_COUNT`, `HEARSE_COUNT`, `PRISON_VAN_COUNT`,
  `TRANSPORT_VEHICLE_COUNT`, `MAINTENANCE_VEHICLES` and `EVACUATION_BUS_COUNT`.
- Power: `BATTERY_POWER_OUTPUT`, `POWER_LINE_CAPACITY` and
  `POWER_PLANT_OUTPUT`.
- An upgrade's pollution change takes the level's own name,
  `SelectedInfoPanel.POLLUTION_LEVELS_GROUND`, `_AIR` and `_NOISE`, as vanilla
  binds it.
- An extractor's map resource and a pumping station's water source both take
  `Properties.REQUIRED_RESOURCE`, the one binder behind both.

The English changes with them: the two "Processing" lines read as vanilla's
deceased- and garbage-processing lines, "Grid capacity" as its power-line
capacity, "Draws from" as its required resource. A test holds every fact in
vanilla's tier to its binder's exact key, and every other fact to ours.

A label never wraps, and a line is half the card, so a label too long for its
half, as the game's German ones can be, ran into its neighbour. A line now
measures what it drew, two frames after drawing it as the tile names do, and
takes the whole row when it overflows. For that the value keeps its whole
width in a half: in game, a value allowed to shrink was squeezed to 3 px with
its text drawn over the label ("Starkstromleitungskap" under "40 MW" on a
two-lane road in de-DE), and the line reported no overflow. With the row to
itself, a value may wrap. A game string's trailing line break
("Small Roads") is trimmed as C#'s `WordFormat.GameText` trims it. The
reverse-sort button has a key of its own: it shared the table header's hint,
"reverse this sort", and so read in lowercase.

Deliberately not matched:

- Helicopters and purification keep ours. Each is one fact for several of
  vanilla's lines: `MEDICAL_`, `FIRE_` and `POLICE_HELICOPTER_COUNT`, and
  `WATER_` and `SEWAGE_PURIFICATION_RATE`.
- "Voltage" and "Water pipes" stay ours, as recorded above.
- A zone's upkeep stays ours: its renters pay it, where the game's
  `Properties.UPKEEP` names what the city pays to run a building.
- An upgrade that carries both a pollution level and a pollution change shows
  two lines under the same name, as vanilla's does; vanilla tells the change
  apart with an icon, which the card does not draw.
- The headline capacity keeps ours: vanilla names it per service
  (`PATIENT_CAPACITY`, `STUDENT_CAPACITY` and so on) and the card draws one
  line with a unit.

## 2026-09-25 — the owner's decisions on the card's differences from vanilla (#62)

The seven differences #57 left in place, under "Deliberately not matched" in the 2026-09-24
section above, are decided:

- **Changed:** a deathcare facility's capacity is a bare count, as vanilla's `DECEASED_STORAGE`
  binds it with the `integer` unit, where the card said plots: a crematorium's store holds the
  deceased as a cemetery's does. A post facility's mail capacity is a bare count for the same
  reason.
- **Kept, as they were:** a telecom facility's capacity keeps its decimal; a network's upkeep
  rounds the per-kilometre product, what `NetUtils.GetUpkeepCost` charges; upkeep is the
  budget-free figure; upkeep resources are named with their amounts; and an effect that rounds to
  nothing draws no line. For upkeep the owner's reason is that the base figure is the more useful
  reference, where vanilla's moves with the city's budget and prices.
- **Deferred to the translation work:** effect numbers stay invariant, beside their English labels.
  The roadmap's Translations entry carries it.
