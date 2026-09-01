# FindIt Remediation Phase 4 — One Owner Per Presentation State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** groupBy, search order and group labels each have one owner (C#); the TS side keeps the player's view choices in one store and renders what it is sent; the first open of a menu refreshes once.

**Architecture:** Four C#-first tasks, each leaving both suites green and the manifest test honest: effective groupBy (Task 1), relevance (Task 2), group labels + dimensions (Task 3), then the TS store consolidation (Task 4), then the live pass (Task 5). Each moved function is ported with its tests, and the TS original is deleted in the same task so nothing is computed twice at any commit.

**Tech Stack:** C# net48 / LangVersion 11, net10.0 xunit; TypeScript/React 18 under Cohtml, `node --test`; `just` from the worktree root; `bd` from the MAIN checkout; live runs on `949230-c` via the pinned bridge client.

**Spec:** `docs/superpowers/specs/2026-09-01-findit-remediation-phase-4-one-owner-per-presentation-state-design.md`.

## Global Constraints

- Worktree `/var/home/gerbal/Games/CS-Modding-wt/findit-remediation`, branch `findit/phase-4-one-owner` off `origin/master`. Paths relative to `cs2-findit-building-menu/`.
- Beads cm-jjlv.8 with children cm-jjlv.8.1–.5.
- Tests: `just test findit-building-menu 2>&1 | grep -E "Passed!|Failed!|error CS|# (pass|fail)|\[FAIL\]|^not ok"`; type check `cd FindIt/UI && npx tsc --noEmit -p .`.
- Commit trailer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_013U8fzQAHmfdVdWfXLX2Eqv`.
- Port, don't re-specify: every moved function's tests are the TS tests translated; if a ported test fails, the port is wrong, not the test.
- Live runs: deploy with `just deploy-isolated findit-building-menu 949230-c` only while `CS2_PREFIX=949230-c just cs2-status` reads `no-game`; launch `just launch-cs2 claude-swift-ocelot-gZs --prefix 949230-c --cdp-port 9557 --no-steam --headless --check-menu`; stop with `CS2_PREFIX=949230-c CDP_URL=http://127.0.0.1:9557 just game-stop claude-swift-ocelot-gZs <pid>` after `just game-lock`. Gate on `grep -c "Error initializing mod" Modding.log` == 0.

---

### Task 1: C# owns the effective groupBy

**Files:**
- Modify: `FindIt/Domain/BuildingCatalogGrouping.cs` (add `DefaultDimension`, `Effective`), `FindIt/Domain/VanillaMenus.cs` (add `IsEducation`), `FindIt/Services/CatalogView.cs` (resolver, `EffectiveGroupBy`), `FindIt/Services/BuildingCatalogAdapter.cs` (`Build` overload), `FindIt/Systems/FindItUISystem.Methods.cs` (resolver + publish), `FindIt/Systems/FindItUISystem.Bindings.cs` (`SetBuildingCatalogGroupBy` accepts `""`; `ResetBuildingLensMenu` resets `GroupBy`)
- Modify TS: `FindIt/UI/src/mods/BuildingCatalog/BuildingCatalog.tsx:115-232`, `FindIt/UI/src/mods/LensControlPane/LensControlPane.tsx:85-135,300-345,440-450`, `FindIt/UI/src/domain/buildingGroups.ts` (delete `defaultGroupDimensionFor`)
- Tests: `FindItBuildingMenu.Tests/BuildingCatalogGroupingTests.cs` (add), `FindItBuildingMenu.Tests/CatalogViewTests.cs` (add), `FindItBuildingMenu.Tests/BindingManifestTests.cs` (allowlist empty), `FindIt/UI/test/buildingGroups.test.ts` (delete "Default grouping" and the education-default case)

**Interfaces:**
- Produces: `BuildingCatalogGrouping.DefaultDimension(bool menuHasCategories, string? stripAxis, bool educationMenu): string`; `BuildingCatalogGrouping.Effective(string? choice, bool menuHasCategories, string? stripAxis, bool educationMenu): string`; `VanillaMenus.IsEducation(string?)`; `CatalogView.EffectiveGroupBy`; `BuildingCatalogAdapter.Build(query, Func<CatalogView,string>? groupByResolver)`.

- [ ] **Step 1: Failing tests (ported from TS "Default grouping")**

Append to `BuildingCatalogGroupingTests.cs`:

```csharp
		[Fact]
		public void DefaultOpensOnCategoryWhenNothingNarrowerApplies()
		{
			Assert.Equal("category", BuildingCatalogGrouping.DefaultDimension(false, "", false));
			Assert.Equal("category", BuildingCatalogGrouping.DefaultDimension(false, null, false));
		}

		[Fact]
		public void TheMenusOwnCategoriesBeatADevelopmentAxis()
		{
			// cm-2xvs.23, reported on Roads: ten category tabs on screen and the
			// grid grouped by Development underneath them.
			Assert.Equal("menuCategory", BuildingCatalogGrouping.DefaultDimension(true, "development", false));
		}

		[Fact]
		public void TheAxisDecidesWhenTheMenuHasNoCategoriesOfItsOwn()
		{
			Assert.Equal("development", BuildingCatalogGrouping.DefaultDimension(false, "development", false));
			Assert.Equal("category", BuildingCatalogGrouping.DefaultDimension(false, "assetType", false));
		}

		[Fact]
		public void SchoolTiersComeBeforeEverythingCategoriesIncluded()
		{
			Assert.Equal("schoolTier", BuildingCatalogGrouping.DefaultDimension(true, "development", true));
		}

		[Fact]
		public void AChoiceWinsAndAutoFallsThroughToTheDefault()
		{
			Assert.Equal("cost", BuildingCatalogGrouping.Effective("cost", true, "development", false));
			Assert.Equal("none", BuildingCatalogGrouping.Effective("none", true, "development", false));
			Assert.Equal("menuCategory", BuildingCatalogGrouping.Effective("", true, "development", false));
			Assert.Equal("menuCategory", BuildingCatalogGrouping.Effective(null, true, "development", false));
			// An id the picker does not offer is not a choice.
			Assert.Equal("menuCategory", BuildingCatalogGrouping.Effective("nonsense", true, "development", false));
		}
```

Run: compile errors (`DefaultDimension` missing).

- [ ] **Step 2: Implement**

`BuildingCatalogGrouping.cs`, after `IsGrouped`:

```csharp
		/// <summary>Every dimension the picker offers, by id.</summary>
		public static readonly string[] Dimensions =
		{
			MenuCategory, Category, SubCategory, Role, SchoolTier, Progression, Development, Theme, Source, Density, Footprint, Cost, None,
		};

		public static bool IsDimension(string? value) =>
			!string.IsNullOrWhiteSpace(value)
			&& Array.Exists(Dimensions, dimension => Is(value!.Trim(), dimension));

		/// <summary>
		/// What a menu opens grouped by when the player has not chosen.
		/// </summary>
		/// <remarks>
		/// Moved from buildingGroups.ts's defaultGroupDimensionFor, where it
		/// was re-derived by two components and pushed back to this side in an
		/// effect — the second refresh on every first open of a menu. The
		/// strip and the headings answer the same question, so they should not
		/// open on different answers: the education menu draws school LEVELS in
		/// its category's place, so it is asked first; a menu with categories
		/// of its own groups by them whatever axis the strip derived
		/// (cm-2xvs.23); otherwise the strip's axis decides.
		/// </remarks>
		public static string DefaultDimension(bool menuHasCategories, string? stripAxis, bool educationMenu)
		{
			if (educationMenu) return SchoolTier;
			if (menuHasCategories) return MenuCategory;
			if (Is(stripAxis?.Trim() ?? string.Empty, StripAxes.Development)) return Development;
			if (Is(stripAxis?.Trim() ?? string.Empty, StripAxes.AssetType)) return Category;
			return Category;
		}

		/// <summary>The choice when there is one, otherwise the default. Empty means auto.</summary>
		public static string Effective(string? choice, bool menuHasCategories, string? stripAxis, bool educationMenu) =>
			IsDimension(choice) ? choice!.Trim() : DefaultDimension(menuHasCategories, stripAxis, educationMenu);
```

(Check the constant named `Progression` exists in the file; the grep earlier showed `SchoolTier`, `Theme`, … — add `public const string Progression = "progression";` and `Development = "development"` if absent, next to the others, and confirm `PrimaryKey` handles `progression`/`development`; if it does not today — it did not appear in `PrimaryKey`'s list — add `if (Is(dimension, Progression)) return entry.UnlockMilestone.ToString("D3", CultureInfo.InvariantCulture);` and `if (Is(dimension, Development)) return entry.DevTreeBranchDepth.ToString("D3", CultureInfo.InvariantCulture) + Normalize(entry.DevTreeBranch);` — read the file first; the TS tree ordered those two by `order`, which these keys reproduce.)

`VanillaMenus.cs`: `public static bool IsEducation(string? menu) => (menu ?? string.Empty).IndexOf("Education", StringComparison.OrdinalIgnoreCase) >= 0;` (TS: `/education/i`).

`CatalogView`: add a constructor parameter `Func<CatalogView, string>? groupByResolver = null`, a field, and

```csharp
		private string? _effectiveGroupBy;

		/// <summary>The grouping the page is ordered by: the player's choice, or the menu's default.</summary>
		public string EffectiveGroupBy => _effectiveGroupBy ??= _groupByResolver?.Invoke(this) ?? _query.GroupBy;

		public BuildingCatalogPage Page => _page ??= BuildingCatalogQueryEngine.Query(MenuSet, _query with { GroupBy = EffectiveGroupBy });
```

`BuildingCatalogAdapter.Build` gains `Func<CatalogView, string>? groupByResolver = null` and passes it through.

`FindItUISystem.Methods.cs`, at the `Build` call:

```csharp
			var menu = _buildingCatalogQuery.UiMenu;
			var menuHasCategories = PrefabIndexingSystem.GetMenuCategories(string.IsNullOrEmpty(menu) ? null : menu).Count > 0;
			var view = _buildingCatalogAdapter.Build(
				_buildingCatalogQuery,
				built => BuildingCatalogGrouping.Effective(
					_buildingCatalogQuery.GroupBy, menuHasCategories, built.StripAxis, VanillaMenus.IsEducation(menu)));
```

and after `_BuildingCatalogSortDescending.Value = …;` add `_BuildingCatalogGroupBy.Value = view.EffectiveGroupBy;`.

`Bindings.cs` `SetBuildingCatalogGroupBy`: delete the `if (string.IsNullOrWhiteSpace(groupBy)) { return; }` guard; `var next = (groupBy ?? string.Empty).Trim();`. `ResetBuildingLensMenu`: add `GroupBy = string.Empty,` to the `with { SearchText = string.Empty, SortColumn = string.Empty, … }`. `BuildingCatalogQuery.GroupBy` default becomes `""` (auto) — update its comment: `// The player's choice; empty means the menu's default (BuildingCatalogGrouping.Effective).` Check `Query_DefaultsToAny`-style tests that assert `"none"`: `grep -rn '"none"' FindItBuildingMenu.Tests` and fix the ones asserting the default.

`BindingManifestTests.cs`: `KnownUnreadByUi` becomes `Array.Empty<string>()` with its comment replaced by `// Empty since cm-jjlv.8: the UI reads BuildingCatalogGroupBy. Keep it empty; an entry here is a phase-4 regression.`

- [ ] **Step 3: TS reads the binding**

`BuildingCatalog.tsx`: add `const BuildingCatalogGroupBy$ = bindValue<string>(mod.id, "BuildingCatalogGroupBy", "category");`; replace the `chosenGroupBy`/`groupBy` derivation and the `useEffect` push-back with `const groupBy = (useValue(BuildingCatalogGroupBy$) || "category") as GroupDimensionId;`; delete `LENS_GROUP_KEY`, the `useLensChoice(LENS_GROUP_KEY, …)` line, the `defaultGroupDimensionFor`/`isEducationMenu`/`isGroupDimension` imports if unused, and the two comments about the effect.

`LensControlPane.tsx`: same binding; `groupBy` from it; the picker's `onSelect` becomes `trigger(mod.id, "SetBuildingCatalogGroupBy", dimension.id); setGroupPickerOpen(false);`; Reset menu no longer calls `setChosenGroupBy("")` (C# resets it); delete `LENS_GROUP_KEY` and the `chosenGroupBy` state.

`buildingGroups.ts`: delete `defaultGroupDimensionFor` (and `DEFAULT_GROUP_DIMENSION` if it was its only user — `grep -rn DEFAULT_GROUP_DIMENSION FindIt/UI/src`). `test/buildingGroups.test.ts`: delete the `Default grouping` describe and the `opens the education menu on its levels` case's four `defaultGroupDimensionFor` asserts (keep that case's `ids(...)` asserts if any).

- [ ] **Step 4: Run, commit**

Suites green, `tsc` clean, `grep -rn "defaultGroupDimensionFor\|LENS_GROUP_KEY\|KnownUnreadByUi = {" FindIt FindItBuildingMenu.Tests` prints nothing but the empty-array declaration.

```bash
git add -A FindIt FindItBuildingMenu.Tests
git commit -m "refactor(findit): C# owns the effective groupBy; the UI reads it instead of re-deriving and pushing it back (cm-jjlv.8.1)"
```

---

### Task 2: C# owns relevance

**Files:**
- Create: `FindIt/Domain/BuildingCatalogRelevance.cs`
- Modify: `FindIt/Services/BuildingCatalogQueryEngine.cs` (`Order`)
- Modify TS: `FindIt/UI/src/domain/buildingSearchRank.ts` (keep `getSearchScopeNotice` + its types only), `FindIt/UI/src/mods/BuildingGrid/BuildingGrid.tsx:11,55,76-82,98`, `FindIt/UI/src/mods/BuildingList/BuildingList.tsx:16,78-86`
- Tests: `FindItBuildingMenu.Tests/BuildingCatalogRelevanceTests.cs` (create, ported from `test/buildingSearchRank.test.ts` scoring cases), `BuildingCatalogQueryEngineTests.cs` (add), `FindIt/UI/test/buildingSearchRank.test.ts` (keep scope-notice cases only)

- [ ] **Step 1: Read `test/buildingSearchRank.test.ts` and port every `matchScore`/`rankBuildingMatches` case** to `BuildingCatalogRelevanceTests` as `Assert.True(Score(a) > Score(b))`-style facts (exact > prefix > word-start > substring > field; shortest name wins a tie via the engine, not the score). Then:

```csharp
	[Fact]
	public void Query_RelevanceOrdersWithinAGroupAndTheSortColumnBreaksTies()
	{
		var entries = new[]
		{
			SampleEntries[0] with { Id = 1, Name = "Clinic Annex", ConstructionCost = 1 },
			SampleEntries[0] with { Id = 2, Name = "Clinic", ConstructionCost = 9 },
			SampleEntries[0] with { Id = 3, Name = "Medical Clinic", ConstructionCost = 5 },
			SampleEntries[0] with { Id = 4, Name = "Old Clinic", ConstructionCost = 3 },
		};

		var page = BuildingCatalogQueryEngine.Query(entries, new BuildingCatalogQuery(SearchText: "clinic", SortColumn: "ConstructionCost"));

		// Exact, then prefix, then word-start (two of those: cost breaks the tie).
		Assert.Equal(new[] { 2, 1, 4, 3 }, page.Items.Select(e => e.Id));
	}
```

(Check the word-start scores: "Medical Clinic" and "Old Clinic" are both word-start hits; cost ascending puts 4 (3) before 3 (5).)

- [ ] **Step 2: Implement `BuildingCatalogRelevance`**

```csharp
using System;
using FindItBuildingMenu.Domain;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// How well an entry answers a search, moved from buildingSearchRank.ts.
	/// </summary>
	/// <remarks>
	/// The UI used to re-rank C#'s sorted page in the grid, the list and the
	/// cards but not the table — one query, two orders — and dropped any
	/// entry its own scoring gave 0, so a search by pdx mods id (which the
	/// backend matches) listed in the table and vanished from the grid. The
	/// engine orders by this within each group now, for every view.
	/// </remarks>
	public static class BuildingCatalogRelevance
	{
		public const int Exact = 1000, Prefix = 800, WordStart = 600, Substring = 400, Field = 200;

		public static int Score(BuildingCatalogEntry entry, string? rawQuery)
		{
			var query = (rawQuery ?? string.Empty).Trim();
			if (query.Length == 0 || entry is null) return 0;

			var direct = ScoreText(entry.Name, query);
			if (direct > 0) return direct;

			// Prefab names and ids are how modders refer to assets; a hit there
			// never outranks a display-name hit.
			if (ScoreText(entry.PrefabName, query) > 0) return Field;
			if (ScoreText(entry.PdxModsId, query) > 0) return Field;
			if (ScoreText(entry.Category + " " + entry.SubCategory, query) > 0) return Field;

			return 0;
		}

		private static int ScoreText(string? text, string query)
		{
			var value = (text ?? string.Empty).Trim();
			if (value.Length == 0) return 0;
			if (string.Equals(value, query, StringComparison.OrdinalIgnoreCase)) return Exact;
			if (value.StartsWith(query, StringComparison.OrdinalIgnoreCase)) return Prefix;

			var at = value.IndexOf(query, StringComparison.OrdinalIgnoreCase);
			if (at < 0) return 0;

			return at > 0 && !char.IsLetterOrDigit(value[at - 1]) ? WordStart : Substring;
		}
	}
}
```

(Match the TS `scoreText` exactly — read it in `buildingSearchRank.ts` before writing; if it scores word-start differently, follow it.)

`BuildingCatalogQueryEngine.Order`: after `seed` is computed and before the sort-column switch:

```csharp
			// Relevance decides within a group while a search is active; the
			// chosen sort breaks ties. Every view reads this order now — the
			// grid used to re-rank the page itself and disagree with the table.
			if (!string.IsNullOrWhiteSpace(query.SearchText))
			{
				seed = seed
					.ThenByDescending(entry => BuildingCatalogRelevance.Score(entry, query.SearchText))
					.ThenBy(entry => (entry.Name ?? string.Empty).Length);
			}
```

- [ ] **Step 3: TS deletes its ranking**

`buildingSearchRank.ts` keeps `SearchScopeNotice` and `getSearchScopeNotice` (rename the file's header comment accordingly); delete `GridEntry`, `RankableEntry`, `stableGridOrder`, `matchScore`, `rankBuildingMatches`, `topSearchResult`, the scoring constants and helpers. `BuildingGrid.tsx`/`BuildingList.tsx`: `const ordered = entries;` (or use `entries` directly), Enter arms `entries[0]` when `searchText` is non-blank and `entries.length > 0`; fix the imports and the two comments that name `rankBuildingMatches`/`stableGridOrder`. `test/buildingSearchRank.test.ts`: keep only the `getSearchScopeNotice` cases.

- [ ] **Step 4: Run, commit**

```bash
git add -A FindIt FindItBuildingMenu.Tests
git commit -m "refactor(findit): C# owns search relevance; the grid stops re-ranking (and dropping) the page the table shows (cm-jjlv.8.2)"
```

---

### Task 3: C# owns group labels and the offered dimensions

**Files:**
- Modify: `FindIt/Domain/BuildingCatalogGrouping.cs` (`Labels`, `OfferedDimensions`), `FindIt/Domain/BuildingCatalogEntry.cs` (`GroupPath`, `GroupLabelId`, JSON), `FindIt/Services/CatalogView.cs` (`Page` labels, `GroupDimensions`), `FindIt/Services/BuildingCatalogAdapter.cs` (`Build` passes milestone names), `FindIt/Systems/FindItUISystem.Setup.cs`+`Methods.cs` (`BuildingLensGroupDimensions` binding)
- Modify TS: `FindIt/UI/src/domain/buildingGroups.ts` (delete the label helpers; `groupTreeFromPaths`; `groupDimensionsFor` over ids), `FindIt/UI/src/domain/buildingCatalog.ts` (`groupPath`, `groupLabelId`), `FindIt/UI/src/mods/GroupedResults/GroupedResults.tsx:237`, `FindIt/UI/src/mods/BuildingCatalog/BuildingCatalog.tsx:798`, `FindIt/UI/src/mods/LensControlPane/LensControlPane.tsx:321`, `FindIt/UI/src/domain/localizableStrings.ts`, `menuProgression.ts`/`serviceForecast.ts` comments
- Tests: `FindItBuildingMenu.Tests/BuildingCatalogGroupingLabelsTests.cs` (create, ported), `CatalogViewTests.cs` (add), `BuildingCatalogQueryEngineTests.cs` (`PageWrite…` names), `FindIt/UI/test/buildingGroups.test.ts` (rewrite the tree/flatten cases on `groupPath`; delete the label/band/tier cases), `FindIt/UI/test/buildingCatalogContracts.test.ts` fixture

- [ ] **Step 1: Port the TS label tests to C#** — read `test/buildingGroups.test.ts` describes `Bands`, `Heading labels`, `The Other group`, `Density tiers`, `menuCategory sub-grouped by density`, `categoryTierLabel`, `transit tiers`, and the group-tree cases in `Grouped view`; write `BuildingCatalogGroupingLabelsTests` asserting `BuildingCatalogGrouping.Labels(entry, dimension, milestoneNames).Path` (and `.LabelId` for menuCategory) for each. Compile failure first.

- [ ] **Step 2: Implement `Labels` and `OfferedDimensions`**

`BuildingCatalogGrouping`:

```csharp
		public const string Other = "Other";
		public const string ProgressionUngated = "From the start";

		public readonly record struct GroupLabels(string[] Path, string? LabelId);

		/// <summary>The headings an entry files under, for the dimension the page is grouped by.</summary>
		/// <remarks>
		/// Moved from buildingGroups.ts (groupLevelsFor and its helpers) so the
		/// band edges, tier names and category words have one home; the keys
		/// above and these labels are now guaranteed to agree because they read
		/// the same constants. LabelId carries the game's own category id for a
		/// menu-category heading so the UI can localise it; every other label is
		/// final text.
		/// </remarks>
		public static GroupLabels Labels(BuildingCatalogEntry entry, string? groupBy, IReadOnlyList<string>? milestoneNames = null)
		{
			if (entry is null || !IsGrouped(groupBy)) return new(Array.Empty<string>(), null);
			var dimension = groupBy!.Trim();

			if (Is(dimension, Category)) return new(new[] { Text(entry.CategoryLabel) ?? Text(entry.Category) ?? Other, Text(entry.SubCategoryLabel) ?? Text(entry.SubCategory) ?? Other }, null);
			if (Is(dimension, MenuCategory))
			{
				var id = (entry.UiCategory ?? string.Empty).Trim();
				return new(new[] { MenuCategoryLabel(entry), CategoryTierLabel(entry, milestoneNames) }, id.Length == 0 ? null : id);
			}
			if (Is(dimension, SubCategory)) return new(new[] { Text(entry.SubCategoryLabel) ?? Text(entry.SubCategory) ?? Other }, null);
			if (Is(dimension, Role)) return new(new[] { Text(entry.BuildingType) ?? Other }, null);
			if (Is(dimension, Progression)) return new(new[] { MilestoneLabel(entry.UnlockMilestone, milestoneNames) }, null);
			if (Is(dimension, Development)) return new(new[] { Text(entry.DevTreeBranch) ?? Other }, null);
			if (Is(dimension, SchoolTier)) return new(new[] { SchoolTierLabel(entry.EducationLevel) ?? MenuCategoryLabel(entry) }, null);
			if (Is(dimension, Theme)) return new(new[] { Text(entry.Theme) ?? Other }, null);
			if (Is(dimension, Source)) return new(new[] { Text(entry.DlcId) ?? Text(entry.Provenance) ?? Other }, null);
			if (Is(dimension, Density)) return new(new[] { DensityTierLabel(entry.ZoneType) }, null);
			if (Is(dimension, Footprint)) return new(new[] { FootprintBandLabel(entry.LotWidth, entry.LotDepth) }, null);
			if (Is(dimension, Cost)) return new(new[] { CostBandLabel(entry.ConstructionCost) }, null);
			return new(Array.Empty<string>(), null);
		}
```

with private helpers ported line for line from `buildingGroups.ts` (`Text` = trim + `Humanize` (underscores/dashes → spaces, camel split, collapse spaces), `MenuCategoryLabel` (strip the menu's letters as a prefix, then `SplitWords`), `CategoryTierLabel` (density tier except Signature → transit tier (`ServiceBuildings_` → "Stations", else subcategory label) → dev branch → milestone), `DensityTierLabel` over the same order/labels as `DENSITY_TIERS` (map `ZoneTypeFilter` values 1 Low Density, 2 Row Housing, 4 Medium Density, 32 Mixed Housing, 64 Low Rent Housing, 8 High Density, 16 Signature — confirm against `ZoneTypeFilter`'s numeric values), `SchoolTierLabel` (1 Elementary School, 2 High School, 3 College, 4 University), `CostBandLabel` (`₡{n}k` formatting, `CostBands`), `FootprintBandLabel` (`FootprintBands`), `MilestoneLabel` (names[index], else index 0 → `ProgressionUngated`, else `Milestone N`)).

```csharp
		/// <summary>The dimensions that can act on a set: two entries file under different keys.</summary>
		/// <remarks>Moved from buildingGroups.ts's groupDimensionsFor; schoolTier only on the education menu; none always.</remarks>
		public static string[] OfferedDimensions(IEnumerable<BuildingCatalogEntry> entries, bool educationMenu)
		{
			var sample = entries as IReadOnlyList<BuildingCatalogEntry> ?? entries.ToList();
			return Dimensions
				.Where(dimension => educationMenu || !Is(dimension, SchoolTier))
				.Where(dimension => Is(dimension, None) || sample.Count == 0 || sample.Select(entry => PrimaryKey(entry, dimension)).Distinct(StringComparer.OrdinalIgnoreCase).Skip(1).Any())
				.ToArray();
		}
```

`BuildingCatalogEntry`: add `string[]? GroupPath = null, string? GroupLabelId = null` at the end of the parameter list; write `groupPath` (array of strings, empty when null) and `groupLabelId` (`""` when null) after `reorderableSortColumns`… no — these are entry properties: write them after `noisePollution` and before `TypeEnd`. `PageWrite_EmitsStablePageAndEntryPropertyNames` gains `"groupPath", "groupLabelId"` at the corresponding position.

`CatalogView`: constructor gains `IReadOnlyList<string>? milestoneNames = null`; `Page` becomes

```csharp
		public BuildingCatalogPage Page => _page ??= WithGroupLabels(BuildingCatalogQueryEngine.Query(MenuSet, _query with { GroupBy = EffectiveGroupBy }));

		private BuildingCatalogPage WithGroupLabels(BuildingCatalogPage page)
		{
			var dimension = EffectiveGroupBy;
			if (!BuildingCatalogGrouping.IsGrouped(dimension)) return page;
			// The page only — a hundred entries, not the set.
			return page with
			{
				Items = page.Items.Select(entry =>
				{
					var labels = BuildingCatalogGrouping.Labels(entry, dimension, _milestoneNames);
					return entry with { GroupPath = labels.Path, GroupLabelId = labels.LabelId };
				}).ToArray(),
			};
		}

		public string[] GroupDimensions => _dimensions ??= BuildingCatalogGrouping.OfferedDimensions(MenuSet, _educationMenu);
```

(`_educationMenu` comes from a new ctor flag `bool educationMenu = false`; `BuildingCatalogPage.Items` must be settable via `with` — it is a record.) Adapter `Build` passes `PrefabIndexingSystem.GetMilestoneNames()` and `VanillaMenus.IsEducation(query.UiMenu)`. Setup: `_BuildingLensGroupDimensions = CreateBinding("BuildingLensGroupDimensions", Array.Empty<string>());`; Methods: `_BuildingLensGroupDimensions.Value = view.GroupDimensions;` after the groupBy publish.

- [ ] **Step 3: TS renders what it is sent**

`buildingCatalog.ts`: add `groupPath: string[]; groupLabelId: string;` to `BuildingCatalogEntry`; the contracts test fixture gains both. `buildingGroups.ts`: replace `buildGroupedView` with

```ts
export interface GroupPathEntry { id: number; groupPath?: readonly string[] | null; groupLabelId?: string | null }

/**
 * The tree the backend's order implies. Entries arrive grouped and in
 * heading order (BuildingCatalogGrouping sorts by the same keys the labels
 * come from), so a node is a run of consecutive entries sharing a path
 * prefix; nothing here decides what a heading says.
 */
export function groupTreeFromPaths<T extends GroupPathEntry>(entries: readonly T[] | null | undefined): GroupNode<T>[] {
  const roots: GroupNode<T>[] = [];
  for (const entry of entries ?? []) {
    const levels = entry.groupPath ?? [];
    if (levels.length === 0) continue;
    let siblings = roots;
    const path: string[] = [];
    for (let depth = 0; depth < levels.length; depth += 1) {
      const label = levels[depth];
      path.push(label);
      let node = siblings[siblings.length - 1];
      if (!node || node.label !== label) {
        node = { label, path: [...path], count: 0, children: [], entries: [] };
        if (depth === 0 && entry.groupLabelId) node.labelId = entry.groupLabelId;
        siblings.push(node);
      }
      node.count += 1;
      if (depth === levels.length - 1) node.entries.push(entry); else siblings = node.children;
    }
  }
  return roots;
}
```

(`GroupNode` keeps its shape minus `order`.) `flattenGroupedRows(entries, keyOf)` loses its `dimension` parameter and calls `groupTreeFromPaths`. `groupDimensionsFor(offeredIds: readonly string[])` returns `GROUP_DIMENSIONS.filter(d => offeredIds.includes(d.id))`; `LensControlPane.tsx` reads `bindValue<string[]>(mod.id, "BuildingLensGroupDimensions", [])` and passes it. `GroupedResults.tsx:237`: `const groups = groupTreeFromPaths(entries);` — delete its `BuildingLensMilestones$` read if unused. `BuildingCatalog.tsx:798`: `flattenGroupedRows(items, (entry) => String(entry.id))`. Delete from `buildingGroups.ts`: `groupLevelsFor`, `menuCategoryLabel`, `splitWords`, `categoryTierLabel`, `transitTierLabel`, `densityTierLabel`, `schoolTierFor`, `SchoolTier`, `SCHOOL_TIERS`, `DENSITY_TIERS`, `COST_BANDS`, `FOOTPRINT_BANDS`, `costBandLabel`, `footprintBandLabel`, `formatCurrency`, `milestoneLabel`, `PROGRESSION_UNGATED_LABEL`, `UNGROUPED_LABEL`, `humanizeGroupLabel`, `text`, `GroupableEntry`, `isSchoolCategory`/`isTransitMenu` if unused after (`grep`), `DEFAULT_GROUP_DIMENSION`. `localizableStrings.ts`: delete the `GroupOther`, `CostBandUnder/Over`, `FootprintBandUnder/Over`, `ProgressionUngated` entries. Fix the two comments in `menuProgression.ts`/`serviceForecast.ts` to say the tier names live in `BuildingCatalogGrouping.cs`.

Tests: `buildingGroups.test.ts` keeps `Group dimensions` (ids/labels), rewrites `Grouped view` and `Flattening groups for the table` on entries carrying `groupPath`, deletes the label/band/tier/default describes; `buildingLensUx.test.ts` — run and fix any source-regex assertion that named a deleted export.

- [ ] **Step 4: Run, commit**

Both suites green, `tsc` clean, `grep -rn "groupLevelsFor\|buildGroupedView\|COST_BANDS\|DENSITY_TIERS\|SCHOOL_TIERS" FindIt/UI/src` prints nothing.

```bash
git add -A FindIt FindItBuildingMenu.Tests
git commit -m "refactor(findit): C# owns the group headings and the dimensions a menu offers; the UI builds the tree from groupPath (cm-jjlv.8.3)"
```

---

### Task 4: One store

**Files:**
- Create: `FindIt/UI/src/domain/lensViewStore.ts`, `FindIt/UI/test/lensViewStore.test.ts`
- Delete: `FindIt/UI/src/domain/buildingLensViewState.ts`, `FindIt/UI/src/mods/useLensChoice.ts`, `FindIt/UI/test/buildingLensViewState.test.ts`
- Modify: `BuildingCatalog.tsx`, `LensControlPane.tsx`, `BuildingCatalogMetricFilters.tsx`

- [ ] **Step 1: Port `buildingLensViewState.test.ts`** to `lensViewStore.test.ts` against: `getLensView()`, `setLensView({ viewMode })`, `setLensDisclosure(key, open)`/`getLensDisclosure(key, fallback)`, `setLensAnchor(key, id)`/`getLensAnchor(key)`, `getLensAnchorKey(parts)`, `subscribeLensView`, `resetLensView`. Same six facts, plus: `subscribeLensView` fires on `setLensView` and not on an equal value.

- [ ] **Step 2: Implement**

```ts
import { useSyncExternalStore } from "react";

export interface LensView {
  viewMode: string;
  expandedId: number | null;
  disclosures: Readonly<Record<string, boolean>>;
  anchors: Readonly<Record<string, number>>;
}

let state: LensView = { viewMode: "", expandedId: null, disclosures: {}, anchors: {} };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const getLensView = (): LensView => state;
export function setLensView(partial: Partial<LensView>): void {
  const next = { ...state, ...partial };
  if ((Object.keys(partial) as (keyof LensView)[]).every((k) => Object.is(next[k], state[k]))) return;
  state = next;
  emit();
}
export function subscribeLensView(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function resetLensView(): void { state = { viewMode: "", expandedId: null, disclosures: {}, anchors: {} }; listeners.clear(); }
export function useLensView<T>(selector: (view: LensView) => T): T {
  return useSyncExternalStore(subscribeLensView, () => selector(state), () => selector(state));
}
// disclosures + anchors: same fallback semantics the old module had
export const getLensDisclosure = (key: string, fallback = false): boolean => state.disclosures[key] ?? fallback;
export const setLensDisclosure = (key: string, value: boolean): void => setLensView({ disclosures: { ...state.disclosures, [key]: value } });
export interface LensAnchorKeyParts { surface: string; viewMode: string; groupBy?: string }
export const getLensAnchorKey = ({ surface, viewMode, groupBy = "" }: LensAnchorKeyParts): string => `${surface}|${viewMode}|${groupBy}`;
export const getLensAnchor = (key: string): number | null => state.anchors[key] ?? null;
export function setLensAnchor(key: string, entryId: number | null): void {
  const anchors = { ...state.anchors };
  if (entryId === null || !Number.isFinite(entryId)) delete anchors[key]; else anchors[key] = entryId;
  setLensView({ anchors });
}
export const LENS_DISCLOSURE_KEYS = { facets: "facets", metricRanges: "metricRanges" } as const;
```

(`useSyncExternalStore` selectors must return stable references for unchanged state — the selector reads primitives or the frozen sub-objects, which `setLensView` replaces only on change.) `viewMode` "" means "use the default the component computes" (`defaultToTable ? "table" : "grid"`), exactly as `useLensChoice(LENS_VIEW_MODE_KEY, fallback)` did.

- [ ] **Step 3: Migrate the three components**: `useLensChoice(LENS_VIEW_MODE_KEY, fallback)` → `const viewModeChoice = useLensView((v) => v.viewMode) || fallback` and `setLensView({ viewMode })`; `expandedId` `useState` in `BuildingCatalog.tsx` → `useLensView((v) => v.expandedId)` + `setLensView({ expandedId })` (it now survives the remount placing a building causes, which the anchor comment asks for); disclosure/anchor calls keep their names (imports move). Delete the two old modules and the old test.

- [ ] **Step 4: Run, commit**

```bash
git add -A FindIt/UI
git commit -m "refactor(findit): one lens view store — view mode, expanded row, disclosures and anchors behind useSyncExternalStore (cm-jjlv.8.4)"
```

---

### Task 5: Live verification, docs, close

- [ ] **Step 1:** Build, deploy to `949230-c` (gated on `no-game`), launch, load Porterville 3. For Roads, Landscaping, Health & Deathcare, Zones, Electricity, Education & Research: open, read `[LENS-REFRESH]` (exactly one line per open, none `from=SetBuildingCatalogGroupBy`), read `FindItBuildingMenu.BuildingCatalogGroupBy` and `BuildingLensGroupDimensions`. Inside Landscaping: `SearchChanged "tre"`, read `BuildingCatalog.items[0].name`; switch view mode is UI-only — instead confirm via the page that `items` carry `groupPath` and that the first item is the best match by the C# score. Find a modded entry's `pdxModsId` from the unscoped page and search it: `BuildingCatalog.totalCount > 0` and the item is `items[0]`. Totals unchanged; zero exceptions.
- [ ] **Step 2:** `docs/verification.md` section `## 2026-09-01 — one owner per presentation state (phase 4)` with the refresh lines per menu (one each), the groupBy/dimension readings, the search readings, and the list of what moved to C#. Stop the game, release the lock.
- [ ] **Step 3:** `bd close cm-jjlv.8.1 … cm-jjlv.8.5`, `bd close cm-jjlv.8`, commit `docs(findit): verify phase 4 live — one refresh per open, one order per query (cm-jjlv.8.5)`, suite on the tip, `git status` clean, superpowers:finishing-a-development-branch.
