# Better Building Menu — structure & comment review

**Scope.** All of `BetterBuildingMenu/` (Domain, Services, Systems, Utilities, UI/src, UI/test, UI stylesheets) plus `BetterBuildingMenu.Tests/`. Files read whole, not grepped. Everything below is cited; I mark **verified** where I read the code the comment describes, **suspicious** where I did not. All paths relative to `/var/home/gerbal/Games/CS-Modding/cs2-better-building-menu/`.

**Baseline.** ~41,400 source lines carry **~12,800 comment lines (31%)**. Excluding stylesheets: 11,401 comment lines in 2,025 blocks across .cs/.ts/.tsx. Density by area: Domain 36%, Services 39%, Systems 34%, UI/src (.ts/.tsx) 34%, UI stylesheets 29%, Utilities 13%. **58% of comment lines sit in blocks of 9 or more lines**; only 10% in 1-2 line blocks. The problem is not density — it is that the comments are essays.

**A caveat on sourcing.** Parts of this review were produced by parallel sweeps whose citations I re-checked. Two sweeps produced line numbers that did not survive checking (one cited an 80-line file at line 498). Everything marked **verified** below is what I read myself. A handful of lower-value "wrong line target" claims I have marked **suspicious** rather than verified.

---

## 1. Structure and organization

### 1.1 The Systems layer

**`Systems/PrefabIndexingSystem.cs` (4,103 lines) is six systems in one.** ECS lifecycle, prefab indexing, a vanilla-menu audit *with its own logging* (`:1043`, `:1179` — 273 lines of report generation), milestone/dev-tree indexing, localization formatting, an async PDX-mods HTTP call (`:2992`), zone and extractor-area indexing, and parking-lane geometry math (`:4002-4090`). `PopulateAnalyticalData` is **620 lines** (`:1528-2147`), `RunIndex` 280 (`:558`), `IndexZones` 243 (`:3213`), `AddPrefab` 204 (`:1324`). `RunIndex` has five separate `if (full)` blocks (`:739, :760, :775, :795, :800`). Lines `:807-1316` are indented one tab deeper than the rest of the class — a cosmetic tell that a region was moved without reflow.

**The `BuildingMenuUISystem` partial split does not follow responsibility.** `Setup.cs` (352 lines) holds fields + `OnCreate` + `OnUpdate`; `Bindings.cs` (664) holds 36 members including ECS component removal (`ClearVanillaMenuHighlights`, `:38`), reflection into private vanilla bindings (`:108-119`), and camera-adjacent code (`JumpTo`, `:654`); `Methods.cs` (376) is a residual bucket. Concretely: every `CreateTrigger` registration lives in `Setup.cs:272-307` while every handler lives in `Bindings.cs` — tracing one trigger needs two files. "Bindings" and "Methods" are not categories.

**`Systems/OptionsUISystem.cs` is entirely dead** (verified). Nothing derives from the abstract class; `RefreshOptions()` (`:23`) has no implementer; `GetAssetName` (`:30`) has no caller — `PrefabIndexingSystem.cs:2983` declares its own private copy. `Domain/UIBinding/OptionItemUIEntry.cs` likewise has no reference outside itself.

### 1.2 Dead members (all verified by repo-wide grep including tests)

- `BuildingMenuUISystem.Methods.cs:269` `ClearSearch()` — zero callers, which makes the whole `ClearSearchBar` binding chain unreachable: `Setup.cs:48`, `Setup.cs:190`, `Setup.cs:290`, `BuildingMenuHeader.tsx:25`, `:72`, `:88-97`.
- `BuildingMenuUISystem.Setup.cs:163` `GetBuildingLensFacetGroup` — zero callers.
- `BuildingMenuUISystem.Bindings.cs:521` `ToggleBuildingLensFacetOption` — zero callers.
- In `Services/BuildingCatalogAdapter.cs`, ten public accessors have zero external references — `GetFacetState` (`:146`), `GetExpandedCategoryId` (`:234`), `GetExpandedCategoryTabs` (`:242`), `GetExpandedCategories` (`:305`), `GetStripTabs` (`:321`), `MilestoneIcon` (`:360`), `GetMenuSchoolTierCounts` (`:470`), `GetMetricBounds` (`:492`), `Query` (`:653`), `TryGet` (`:684`) — all superseded by `Build(query)` + `CatalogView`. They carry roughly 200 of the file's 761 comment lines.
- **Stylesheets:** `mods/BuildingGrid/buildingGrid.module.scss:452-523` — the whole `.card`/`.cardName`/`.cardWarn`/`.cardGood`/`.cardLine`/`.cardLabel`/`.cardValue` block is dead. `BuildingGrid.tsx:20` is the only importer of this stylesheet and references `styles.card*` **zero** times; every live `styles.card*` user is in `BuildingHoverCard.tsx:448-471`, against `buildingHoverCard.module.scss`. That file's own header (`:1-2`) says the card "moved out of buildingGrid.module.scss" — the move was never finished.
- **Stylesheets:** `mods/BuildingCatalog/buildingCatalog.module.scss:1009-1050` — seven `.metric*` rules (`.metricCost` through `.metricParking`) that are **empty**: 21 comment lines, zero declarations. `mods/LensToolOptions/LensToolOptions.module.scss:4-7` is an empty `.option {}` whose body is only a comment.

### 1.3 Domain/ is not a pure-logic layer

18 of 54 files import game assemblies. Five are hard ECS dependencies: `PrefabIndex.cs` (`Game.Prefabs`, `Unity.Mathematics`), `PrefabIndexBase.cs` (holds a live `PrefabBase`), `VanillaMenuPlacement.cs` (`Unity.Entities`), `ZoningSurface.cs` (`Game.Zones`), `Interfaces/IPrefabCategoryProcessor.cs` (`EntityQueryDesc[]`). Thirteen more take `Colossal.UI.Binding` for `IJsonWritable`, so the "pure" layer owns the wire format.

The cost is visible in `BetterBuildingMenu.Tests/BetterBuildingMenu.Tests.csproj`, which must link 18 game DLLs to run unit tests. The layer knows: `Domain/BuildingCatalogEntry.cs:10-11` advertises "no ECS handles," and `Domain/VanillaMenuAudit.cs:11-15` explains that `VanillaMenuPlacementFact` exists precisely because `VanillaMenuPlacement` carries an `Entity` — both types in the same folder.

### 1.4 The UI split

**mods/ vs domain/ is mostly respected**, with three leaks: `domain/menuSurfacePort.ts:1`, `domain/textScaleSetting.ts:1`, `domain/unitSettings.ts:1` all import from `cs2/api`. No `mods/` folder is unreferenced.

**Test-only production code.** `domain/filterContracts.ts` is imported only by `test/buildingLensUx.test.ts:11`. Roughly 15 further exports are reachable only from tests — the coherent cluster is `domain/zoningHierarchy.ts` (`formatZoneLots:122`, `sortZonesForDisplay:190`, `zoneAsCatalogEntry:227`, `selectZoneCommand:261`; from production the module is reached only as `import type { ZoneFootprint }`), plus `menuProgression.ts:40/:107/:139/:143`, `buildingGroups.ts:210` (`milestoneLabel`), `buildingCatalogFacets.ts:38/:54/:59`, `buildingCatalogContracts.ts:122/:135`, `catalogWindow.ts:74` (`nextWindowLimit`), `tileLabel.ts:70` (`tileLabelCharBudget`), `filterRail.ts:132` (`hasAnyRailSelection`), `vanillaMenuCategories.ts:188` (`shouldWidenCategoryStrip`).

### 1.5 C#/TS duplication with no drift test

- **Verified divergence:** `Domain/BuildingCatalogGrouping.cs:84-93` `DensityOrder` includes `Mixed` and `LowRent`; `UI/src/domain/zoningHierarchy.ts:172` `DENSITY_ORDER` omits both, so `densityRank` (`:174`) sorts them after `"Any"`.
- **Verified divergence:** `Domain/BuildingLensWidth.cs:39` `Min = 1000f` against `buildingLensLayout.ts:8` `700 + 35 = 735`, untested — only `Max`, `ControlPane` and the heights are pinned (`BuildingLensDimensionTests.cs`).
- The 13 group-dimension ids are hard-coded in `BuildingCatalogGrouping.cs:60-63`, `buildingGroups.ts:24-37` and `buildingGroups.ts:55-100`; the 11 sort columns in `BuildingCatalogQuery.cs:79-87`, `buildingCatalogContracts.ts:20-31` and `buildingLensSortPresentation.ts:31-44`.

### 1.6 Vocabulary

Repo-wide: `Lens` 884, `Menu` 1448, `Catalog` 782, `Panel` 408, `picker` 121, `FindIt` 34.

"Picker" names four different things — the group-by dropdown (`BuildingCatalogGrouping.cs:59`), the sort dropdown (`BuildingCatalogPage.cs:29`), the extension menu (`Setup.cs:96`), and the removed Find It object tool (`LocaleHelper.cs:104`). One surface is called a *drawer* (`BuildingCatalogFacet.cs:6`), a *rail* (`BuildingCatalogQuery.cs:60`), and a *panel* (`BuildingCatalogFacetSelection.cs:152`) — the last saying it moved, which the first two do not know.

---

## 2. Comment audit

### 2.1 Bucket sizes (block-level, overlapping)

- **(a) factually wrong** — not mechanically countable; I verified **34** distinct sites. Extrapolating from the sample rate (roughly 1 in 4 blocks referencing another symbol was stale), plausibly **10-15% of comment lines**.
- **(b) history/changelog narrative** — 194 blocks / **2,130 lines (18%)** in .cs/.ts/.tsx, plus a large duplicated tail in stylesheets (below).
- **(c) issue ids and frozen measurements** — 106 `cm-xxxx` references, 228 blocks containing a hard measurement; together with (b) the union is **434 blocks / 4,477 lines (39% of all non-SCSS comment lines)**.
- **(d) restates the code** — **near zero.** An automated scan for single-line comments whose words overlap the next line found 3 candidates repo-wide. This codebase does not have a redundancy problem.

### 2.2 A mechanical defect: orphaned doc blocks

**15 C# doc blocks contain two or more `<summary>` tags**, meaning the doc for a deleted or relocated member is still stacked above the next surviving one. Full list: `BuildingCatalogEntry.cs:177` (3), `PrefabIndex.cs:203` (4), `VanillaMenuAudit.cs:71`, `BuildingCatalogAdapter.cs:174` (3), `:332`, `:919`, `:966`, `BuildingMenuUISystem.Bindings.cs:191`, `:409`, `PrefabIndexingSystem.cs:918`, `:974`, `:998`, `:2239`, `:3820`, `:3949`.

There are parallel orphans in TS (e.g. `serviceFacts.ts:559`; `zoningHierarchy.ts:97` — a doc for `getZoneFacts`, deleted) and in plain `//` comments: `Setup.cs:28-30` and `Setup.cs:35-36` are two field comments whose fields are gone; `PrefabIndexingSystem.cs:124-129` describes `_devTreeBranches`/`_devTreeRoots` but sits above the unrelated `_uniqueAssets` (`:130`).

`PrefabIndexingSystem.cs:2263` compounds it: "A narrow exception to the rule below" — the rule is now *above* it (`:2242-2258`), because a field declaration was inserted between the doc and its method.

### 2.3 Comment-to-code ratio failures

`BuildingCatalogAdapter.cs:174-233` is 60:1 over a one-line member; `:919-963` is 45:1 over a field; `VanillaMenuAudit.cs:102-121` is 20:1; `GridUtil.cs:14-32` is 19 lines of removed-branch history over `return BuildingLensWidth.Max;`; `Setting.cs:38-49` is a 12-line obituary for a hot-key, documenting nothing; `buildingCatalog.module.scss:3-32` is a **30-line banner over `$row-gap: 3rem;`** (`:33`); `buildingGrid.module.scss:51-94` interleaves 44 comment lines inside one `.tile` rule.

Other SCSS blocks at 10:1 or worse — `buildingCatalog.module.scss:184-194` over `:195`, `:795-807` over `:808`, `:809-818` over `:819`, `:1354-1372` over `:1373`; `buildingGrid.module.scss:266-283` over `:284`, `:296-308` over `:309`, `:319-328` over `:329`, `:412-432` over `:433-435`; `buildingHoverCard.module.scss:23-31` over `:32`; `buildingList.module.scss:249-258` over `:259`; `buildingMenuSurface.module.scss:254-262` over `:263`, `:278-285` over `:286`; `lensControlPane.module.scss:3-10` over `:11`, `:83-91` over `:92`.

### 2.4 Line references rot fast

22 comments cite `file.cs:line`. Three point inside this repo, and **two are already wrong** (verified): `Setup.cs:148` cites `BuildingCatalogQueryEngine.cs:95`, which is mid-comment about the Load-more button; `LensControlPane.tsx:473` cites `Bindings.cs:161`, a blank line. The third (`FilterRail.tsx:162` pointing at `types/ui.d.ts:371-377`) is accurate today. The other 19 point at decompiled game source (`PrefabUISystem.cs:1603-1645`, `ToolbarUISystem.cs:335-347`, `:924`, `:1357`, `:1422`) and cannot be checked from here at all.

Stylesheets repeat the pattern: `menuCategoryStrip.module.scss:30` cites "buildingCatalog.module.scss:31-35", which is the tail of a column-geometry header plus `$row-gap: 3rem;` — wrong target (verified). **Suspicious**, not re-verified: `buildingHoverCard.module.scss:91`, `buildingGrid.module.scss:505` and `filterRail.module.scss:43` all cite "buildingCatalog.module.scss:778", which is a bare closing brace (nearest real note is `:749-753`); `buildingMenuSurface.module.scss:130` cites ":309", a positioning rule, where the z-index lesson is at `:288-291`.

### 2.5 Ghost identifiers — symbols that exist only inside comments

Verified by repo-wide grep: `TopBar`, `showTopBarRow`, `BuildingLensEnabled`, `_IsWindowLocked`, `LegacyGridVisible`, `_ShowFindItPanel`, `shouldMountLegacyPanel`, `WrapToolOptionsPanel`, `SelectPrefabOnOpen`, `ZoneTypeOption`, `Domain.Options.BuildingLensFacetOptionBase`, `.paging` (`buildingCatalog.module.scss:148`), `railHomeFor`. The last is subtler: `FilterRail.tsx:103` mentions it honestly as history, while `filterRail.test.ts:105` states it in present tense as the test's live rationale.

Three `SPIKE (cm-e98i)` markers survive a spike that shipped: `BuildingCatalogEntry.cs:109`, `Setup.cs:28`, `PrefabIndexingSystem.cs:1372`.

### 2.6 The ten worst offenders

1. **`Services/BuildingCatalogAdapter.cs:958-962` + `Systems/BuildingMenuUISystem.Methods.cs:51-56`** — *"Clear() runs at the top of RefreshBuildingCatalog, so nothing here can outlive the frame that built it."* **Verified wrong.** `BeginRefresh()` (`Adapter.cs:972-976`) resets two telemetry fields only; `SnapshotCache` (`SnapshotCache.cs:58-75`) invalidates on `IndexGeneration` change, and its own doc (`:41-49`) says snapshots "survive from one refresh to the next." Two files assert opposite invalidation models. `Methods.cs:55` also points at `_projections`, renamed `_snapshots` (`Adapter.cs:964`).
2. **`Systems/BuildingMenuUISystem.Methods.cs:175-179`** — summary claims the method *"re-projects the compared ids... drops any that no longer resolve."* The method (`:181-189`) publishes milestone names. **Verified wrong** — leftover from a deleted compare feature.
3. **`Systems/BuildingMenuUISystem.Methods.cs:352-354`** — *"Escape is consumed by the game's native input layer and never reaches the DOM."* **Verified wrong**: `mods/VanillaMenuWatcher/VanillaMenuWatcher.tsx:64-78` installs a capture-phase `keydown` handler on keyCode 27 (`:21-22`) and closes the lens; `domain/vanillaMenuWatch.ts:143` holds the rule and `test/escapeClosesLens.test.ts` covers it. Exact same class as the "Ctrl+N" case.
4. **`Services/BuildingCatalogAdapter.cs:174-233`** — 60 comment lines, three stacked `<summary>`/`<remarks>` pairs, above the single expression-bodied `GetExpandedCategoryId` (`:234`), which has **zero callers**. The middle block documents `GetStripAxis`, 73 lines below and undocumented.
5. **`mods/LensControlPane/LensControlPane.tsx:452-483`** — a 32-line JSX comment explaining three buttons that do not exist, citing `_IsWindowLocked`, `LegacyGridVisible`, `_ShowFindItPanel` and `_BuildingLensEnabled` — **all four exist only inside comments** (verified) — plus the stale `Bindings.cs:161`.
6. **`mods/BuildingMenu/BuildingMenuHeader.tsx:16` and `:42-66`** — *"Shared with TopBar until step 4 finishes and that file goes"* and a 25-line migration log ("What did NOT come across, and why"). **`TopBar`, `showTopBarRow` and `BuildingLensEnabled` exist nowhere in code** (verified). Includes commit `44eeab0` and a frozen pixel measurement: *"the seven tabs take 403..957 and the field 957..1121, inside a 718px row."*
7. **`UI/src/domain/buildingLensMetricFormat.ts:613-614`** — `formatNetworkWidth` documented as *"One decimal... rounding a 17.5m road to 18 would make two different roads read as the same width."* Body (`:628`) delegates to `formatServiceRange`, whose metre branch is `Math.round(value)` (`:580`). **Verified**: it produces exactly the bug the comment says it prevents. The function's own inline comment (`:620-627`) records the later decision that superseded the JSDoc without deleting it.
8. **`Domain/BuildingCatalogGrouping.cs:352-356`** — the separator is a **literal NUL byte (U+0000)** written into the source. `file` reports this 673-line `.cs` as `data`, so `grep`/`rg` skip it silently without `-a`. The comment (`:352-353`) says only *"a separator below every character a prefab name can hold"* and never mentions the character is non-printing — unlike `StripAxes.cs:47-49`, which explains its U+001F.
9. **`Systems/OptionsUISystem.cs:25-28`** — *"The three members below..."* (there is one) *"...See BetterBuildingMenu.Domain.Options.BuildingLensFacetOptionBase."* That namespace and type do not exist; the same dead type is a `<see cref=>` at `Bindings.cs:519`, which cannot resolve. The whole 42-line file is dead.
10. **`Systems/PrefabIndexingSystem.cs:366-369` vs `:390-408`** — the first states, present tense, *"this system declares RequireForUpdate on prefabs carrying Created or Updated"*; the second, 20 lines later, explains that gate was removed. `OnCreate:218-226` builds a query instead. **Verified self-contradiction.**

**Runners-up, all verified:**

- `buildingTileTooltip.ts:48-69` — 22 lines narrating three successive values ("Seven, which is now every field there is... Originally four... Raised from seven") above `= 10`.
- `GameLocaleKeys.cs:40` says "the ten service menus" above **eleven** entries (`:42-52`).
- `BuildingCatalogFacetSelection.cs:86-87` states the ordering backwards ("cannot build yet, can build, already did") and is corrected by `:98-101` fifteen lines below; `All` at `:103` is `{ Unlocked, Locked, AlreadyBuilt }`.
- `Bindings.cs:595-599` describes a zone-catalog republish call that is not there.
- `PrefabIndexingSystem.cs:1552-1557` puts the explanation for Trees/Props being *in* the allow-list inside the `return` branch taken when they are not.
- `PrefabIndexingSystem.cs:777-781` argues with a code review inside production code ("the review's '30 processors classify things the lens never lists' was a guess").
- `PrefabIndexingSystem.cs:768-771` explains a log line as a comparison between two full passes, but `:319-331` now skips the second pass when drift is zero.
- `Setup.cs:193-195` — *"the setting is not expected to change mid-session"* dresses a known defect as a design note; `docs/verification.md:2158` records that `ReplaceVanillaBuildMenu` needs a restart because `OnSettingsApplied` (`:334-337`) re-pushes only the tile size.
- `index.tsx:14` ("extrant") and `:17` ("repalaces") are un-proofread Find It leftovers; `:29-33` places the comment for the `LensToolOptions` extend (`:30`) above the `ToolOptionsVisibility` extend (`:34`).

### 2.7 Stylesheet comments (verified)

**Factually wrong:**

| file:line | claim | verification |
|---|---|---|
| `buildingGrid.module.scss:452-523` | comments at `:456-457, :461-463, :472-480, :502-507, :515-517` describing card layout rules | The whole block is dead; see section 1.2. Every comment in this 72-line range documents rules that style nothing. |
| `buildingHoverCard.module.scss:1-2` | "Moved out of buildingGrid.module.scss when the card stopped belonging to one view mode" | The move was never finished — the originals still sit at `buildingGrid.module.scss:452-523`. |
| `buildingCatalog.module.scss:27`, `:38`, `:1318` | "trailing Place and **compare** controls" / "keeps the width the **compare button** had" / "bumped the Place and compare buttons onto lines of their own" | No compare control exists in any `BuildingCatalog/*.tsx` or in C#. The row has two children (`TableRow.tsx:101`, `:224`). |
| `buildingCatalog.module.scss:1264` vs `:1266-1267` | "Placing is an explicit button now rather than the whole row" **then** "The row itself is the Place control now" | Verbatim contradiction two lines apart. Code: `TableRow.tsx:114` puts `onSelect` calling `onPlace(entry)` on the row-wide button. |
| `buildingCatalog.module.scss:1356` | "the Place button is genuinely disabled" | `TableRow.tsx:109` says the opposite: "NOT disabled when the entry cannot be placed, deliberately." |
| `buildingCatalog.module.scss:148` | "It replaced `.paging` in the shared list above" | `.paging` exists nowhere in the repo. |
| `buildingCatalog.module.scss:192-193` | "a fourth copy already sits dead in groupedResults.module.scss" | That file has no such rule; only a tombstone at `groupedResults.module.scss:225` saying it was moved out. |
| `buildingGrid.module.scss:218-219` | "It belongs with cm-z9lm (Escape), which is **blocked** on the same thing" | Escape ships (`VanillaMenuWatcher.tsx:64-78`). The only keyboard claim in all 13 stylesheets, and it is stale. The line above (`:216`) boasts of "the same dead CSS this file just finished deleting 32 of" while sitting 236 lines above the dead `.card*` block. |
| `lensControlPane.module.scss:10` | "and lensToolOptions' `.item` min-height" | `LensToolOptions.module.scss` (11 lines) has no `.item` and no `min-height`. |
| `menuCategoryStrip.module.scss:30` | "written up at buildingCatalog.module.scss:31-35" | Those lines are the tail of a column-geometry header plus `$row-gap: 3rem;`. Wrong target. |

**Suspicious** (not re-verified): `buildingGrid.module.scss:93` — "The setting's default is 100 now" is true in `Setting.cs:82`, but `BuildingGrid.tsx:23` still binds with fallback `72`.

**History boilerplate at scale.** **30 near-identical copies** of *"Was `gap: Nrem` — a no-op in this engine, so this spacing never drew"* — 21 in `buildingCatalog.module.scss` (`:83, 95, 209, 222, 269, 308, 337, 374, 408, 441, 454, 499, 531, 554, 588, 607, 695, 752, 774, 871` and one more), 3 in `buildingGrid.module.scss` (`:37, 98, 456`), 2 in `buildingHoverCard.module.scss`, 2 in `buildingList.module.scss` (`:10, 171`), 1 in `chipRow.module.scss` (`:21`), 1 in `groupedResults.module.scss`. History of a value no longer in the file. Five verbatim copies of the *"flex-start, not baseline: Cohtml drops `align-items: baseline`"* note — `buildingHoverCard.module.scss:55-57`, `:64-66`; `buildingGrid.module.scss:494-496`; `buildingCatalog.module.scss:1217-1219`, `:1233-1235`. Seven verbatim copies of *"Width is set inline from getBuildingLensColumnWidths..."* inside the empty rules at `buildingCatalog.module.scss:1009-1050`.

Roughly 40 further "used to / was tried / this was X" sites: `buildingGrid.module.scss:88-94, 108-113, 150-152, 163-168, 251-253, 273-278, 383-387, 415-419`; `buildingCatalog.module.scss:672, 686-689, 725-730, 810-818, 1107-1122, 1187-1189, 1273`; `buildingMenuSurface.module.scss:127-131, 148-152, 155-160, 250-262`; `groupedResults.module.scss:44-50, 57-60, 88-93, 101-102, 132-134, 173-178, 191-193, 224-229`; `lensControlPane.module.scss:9-10, 19-30, 69-70, 133`; `buildingHoverCard.module.scss:71-73, 115-116`; `filterRail.module.scss:99-107`; `buildingList.module.scss:53-57, 134`; `chipRow.module.scss:108-109`; `extensionMenu.module.scss:10-11`; `buildingMenuHeader.module.scss:104-108, 456-459`.

**Issue ids, dates, hashes, measurements in stylesheets.** Dates: `buildingCatalog.module.scss:46`, `:1241` (2026-09-09). Issue ids: `buildingCatalog.module.scss:654` (cm-7kr8), `buildingGrid.module.scss:218` (cm-z9lm). Commit hashes that resolve nowhere in this repo: `buildingCatalog.module.scss:169-175` (`caf59a8`, `190a4a2`) — and that block documents a rule the file does not contain — and `lensControlPane.module.scss:205` (`9ad2692`). Frozen measurements: `buildingCatalog.module.scss:7-8` ("62,397 of them in one session, 392 of the last 400 UI log lines"), `:1001-1003` ("a 4206-entry catalog... clipped 234 of 600 rendered cells"), `:1338-1348` ("109 + 51 = 160"); `buildingGrid.module.scss:74-85`, `:392-400` (hex colours); `buildingList.module.scss:218-232` (sub-pixel pitch arithmetic); `buildingMenuHeader.module.scss:100-102, 148-152, 478-480`; `lensControlPane.module.scss:7-8`, `:65-67` (a transcribed computed-style dump); `groupedResults.module.scss:47-48, 58-60`.

### 2.8 Test comments (verified)

- **`UI/test/buildingLensLayout.test.ts:210-211`** — *"less 138 furniture ... 628rem."* `BUILDING_LENS_TABLE_ROW_FURNITURE = 37 + 16 + 8 + 80 = 141` (`domain/buildingLensLayout.ts:154`), so 1026 minus 141 minus 260 = **625**. The assertion uses the constant, so **the test passes green while its comment is wrong** — the worst kind, since a reader trusts a passing test's arithmetic.
- **`UI/test/filterRail.test.ts:227`** — a commit hash is embedded in an **assertion failure message**: "... is drawn nowhere — the exact 593e756 failure". A future failing test will print an unresolvable reference. Also `:91`, `:196`, `:200` (`3fff26e`, `593e756`).
- `UI/test/filterRail.test.ts:105` — rationale built on `railHomeFor`, which exists only in comments.
- `UI/test/localizableStrings.test.ts:105` — names `NoFacetsAvailable`, absent from `src/` and `Locale.json`.
- `UI/test/stylesheetContracts.test.ts:116` — "949230-b", an unresolvable tag.
- **Suspicious:** `UI/test/serviceFacts.test.ts:211` — "UpkeepModifierBinder"; the repo's name is `UpkeepModifierData` (`PrefabIndexingSystem.cs:2082`, `domain/serviceFacts.ts:274`).
- **Suspicious:** `UI/test/tileNameMeasureContract.test.ts:9` — "Roads in Grid at the default tile size" reads as if Grid is the default path; the default is Cards.
- `UI/test/serviceFacts.test.ts:412` and `UI/test/buildingLensMetricFormat.test.ts:574, 642, 666` cite `PrefabUISystem.cs:1603-1645` line numbers in a non-vendored decompiled game file.
- 18 `cm-` ids and 12 "measured DATE" comments across `UI/test/`.
- **Clean:** keyboard claims in tests match real handlers — `test/escapeClosesLens.test.ts` and `test/buildingSearchRank.test.ts:7, :10` (Enter).

Two whole test files exist to prove a deleted feature stays deleted: `BetterBuildingMenu.Tests/PickerRemovalTests.cs` (49 lines) and `UI/test/pickerRemoval.test.ts`. Reasonable as guards, but they pin the legacy Find It vocabulary in place permanently.

---

## 3. Prioritized recommendations

### P0 — deletions that remove the largest comment liability (each is mechanical)

1. **Delete the ten dead `BuildingCatalogAdapter` accessors** — `:146, :234, :242, :305, :321, :360, :470, :492, :653, :684`. Removes ~200 comment lines and four of the seven orphaned doc blocks in one commit. **~1h.**
2. **Delete `Systems/OptionsUISystem.cs` and `Domain/UIBinding/OptionItemUIEntry.cs`**; delete `Bindings.cs:517-522` and `Setup.cs:156-164`; delete `Methods.cs:269-277` (`ClearSearch`) and the now-unreachable `ClearSearchBar` chain (`Setup.cs:48, :190, :290`; `BuildingMenuHeader.tsx:25, :72, :88-97`). **~1h.**
3. **Fix the 15 duplicate-`<summary>` sites** listed in section 2.2: keep the block that matches the following member, delete the rest. Highest signal per minute in this review. **~2h.**
4. **Replace the NUL byte at `BuildingCatalogGrouping.cs:355`** with a backslash-u-0000 escape (or a backslash-u-001F unit separator, matching `StripAxes.cs`) so the file stops being binary to grep. **~10min.**
5. **Delete `buildingGrid.module.scss:452-523`** (dead `.card*` block, 72 lines) and the seven empty `.metric*` rules at `buildingCatalog.module.scss:1009-1050`, plus the empty `.option {}` at `LensToolOptions.module.scss:4-7`. Purely subtractive. **~30min.**

### P1 — the verified-wrong claims (one edit each, ~3h total)

Offenders 1, 2, 3, 6, 7, 10 from section 2.6, plus:

- `GameLocaleKeys.cs:40` ("ten" to eleven).
- `BuildingCatalogFacetSelection.cs:86-87` (ordering stated backwards; delete it and keep `:98-101`).
- `Bindings.cs:595-599` (describes a call that is not there).
- `Setup.cs:28-36` (two orphaned field comments).
- `BuildingLensWidth.cs:46` (names `LensControlPane.tsx`; the constant is in `buildingLensLayout.ts:169`).
- `Setup.cs:148` and `LensControlPane.tsx:473` (both stale in-repo line references — drop the line numbers, name the symbol).
- **Stylesheets:** the three "compare button" comments (`buildingCatalog.module.scss:27, :38, :1318`); the contradiction at `:1264` vs `:1266-1267`; the false "genuinely disabled" at `:1356`; `.paging` at `:148`; the false cross-reference at `:192-193`; `buildingGrid.module.scss:216-219` (Escape is not blocked); `lensControlPane.module.scss:10`; `menuCategoryStrip.module.scss:30`.
- **Tests:** `buildingLensLayout.test.ts:210` (138 to 141, 628 to 625); strip the commit hash from `filterRail.test.ts:227`'s failure message; `filterRail.test.ts:105` (`railHomeFor`); `localizableStrings.test.ts:105` (`NoFacetsAvailable`); `stylesheetContracts.test.ts:116` ("949230-b").

### P2 — a comment policy, then a bulk pass (~2-3 days)

`AGENTS.md` has no rule about code comments, which is why this grew. Add one, applying to `.cs`, `.ts`, `.tsx` **and `.scss`**: *a comment says why the code is the way it is, in 3 lines or fewer; no past tense, no issue ids, no measurements, no commit hashes, no file:line references.* Then run the pass:

- **Delete outright:** every `cm-xxxx` reference (106 sites in code, 18 more in tests, 2 in stylesheets — the tracker already holds the story); the three `SPIKE (cm-e98i)` markers (`BuildingCatalogEntry.cs:109`, `Setup.cs:28`, `PrefabIndexingSystem.cs:1372`); every "used to / previously / a previous attempt" clause; the argue-with-the-review comment at `PrefabIndexingSystem.cs:777-781`; the commented-out lines at `Setup.cs:177` and `FolderUtil.cs:17`; the 30 duplicated `gap` obituaries and the 5 duplicated `align-items: baseline` notes (a single sed each); all commit hashes (`buildingCatalog.module.scss:169-175`, `lensControlPane.module.scss:205`, `BuildingMenuHeader.tsx:60`, `filterRail.test.ts:91, :196, :200, :227`).
- **Move to `docs/`:** the migration record in `BuildingMenuHeader.tsx:42-66` and `LensControlPane.tsx:452-483` to `docs/FORK.md`; the load-timing analysis at `PrefabIndexingSystem.cs:239-263` and the audit rationale at `:998-1042` to a new `docs/indexing.md`; every "measured live / measured at Nms / N of M assets" figure to `docs/verification.md`, which already holds figures of exactly this shape (including the stylesheet measurements in section 2.7).
- **Rewrite as one-line "why" comments:** the ratio failures — `GridUtil.cs:14-32`, `Setting.cs:38-49`, `VanillaMenuAudit.cs:102-121`, `BuildingLensHeight.cs:22-55`, `buildingTileTooltip.ts:48-69`, `vanillaMenuWatch.ts:109-142`, `buildingLockState.ts:134-159`, `buildingCatalog.module.scss:3-32`, `buildingGrid.module.scss:51-94`.
- **Fix the typos** at `index.tsx:14` ("extrant") and `:17` ("repalaces").

Expected outcome: **3,500-4,500 comment lines removed** across ~440 blocks.

### P3 — structural, worth doing but not urgent

- **Split `PrefabIndexingSystem.cs`**: lift the audit/coverage reporting (`:1043-1315`, 273 lines) into `Services/VanillaMenuAuditReporter.cs`; the dev-tree and milestone indexing (`:2190-2567`) into `Services/ProgressionIndex.cs`; the parking geometry (`:4002-4090`) into `Utilities/`. **~2 days.** Then break `PopulateAnalyticalData` (`:1528-2147`) by component family. **~1 day.**
- **Rename the `BuildingMenuUISystem` partials by responsibility** — `.Lifecycle.cs` (fields, `OnCreate`, `OnUpdate`, settings), `.MenuRouting.cs` (`VanillaMenuSelected`/`Deselected`, `CloseLens`, `YieldMenuToVanilla`, highlights), `.QueryTriggers.cs` (the `Apply`-based one-liners), `.Publish.cs` (`RefreshBuildingCatalog`, `PublishScope`) — and move each `CreateTrigger` next to its handler. **~half a day.**
- **Add two drift tests** to `BuildingLensDimensionTests.cs`: `BuildingLensWidth.Min` against `BUILDING_LENS_MIN_WIDTH`, and `DensityOrder` against `DENSITY_ORDER`. Both currently disagree. **~1h.**
- **Remove the test-only production code** in section 1.4 — the `domain/zoningHierarchy.ts` cluster (four dead exports plus the deleted `ZoningHierarchy` component still referenced by four `mods/` comments) is one coherent removal; then `domain/filterContracts.ts` and the ~12 remaining dead exports. **~half a day.**
- **Pick one noun.** `Lens` is the fork's word for a thing that is now simply the build menu; `Catalog` is the data, `Menu` is the surface. Renaming `BuildingLens*` to `BuildingMenu*` across bindings and files is mostly mechanical but touches the C#/TS binding names, so it is a **~1 day** commit that should land alone.
