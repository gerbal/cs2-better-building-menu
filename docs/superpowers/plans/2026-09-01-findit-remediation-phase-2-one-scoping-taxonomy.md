# FindIt Remediation Phase 2 — One Scoping Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `BuildingCatalogQuery` is scoped by `UiMenu`/`UiCategory` and nothing else; the hand-built section taxonomy, the upstream enum fields, the presets and the milestone plumbing are gone from C# and TS alike.

**Architecture:** Four deletions in an order that keeps the C# compiling at every commit: first the systems stop *using* the taxonomy and the milestone (bindings, handlers, fields), then the query/engine/domain lose the fields and files, then the UI drops its side of the contract (the binding manifest test goes green again), then a live run on Porterville 3 confirms nothing that mattered depended on what left.

**Tech Stack:** C# net48 / LangVersion 11 (mod) and net10.0 (xunit tests); TypeScript React under Cohtml with `node --test`; `just` recipes from the repo root; beads via `bd` from the MAIN checkout `/var/home/gerbal/Games/CS-Modding` (worktrees cannot discover the Dolt port).

**Spec:** `docs/superpowers/specs/2026-09-01-findit-remediation-phase-2-one-scoping-taxonomy-design.md` (this plan's argument; read it first). Review context: `docs/superpowers/specs/2026-09-01-architecture-review.md`, finding 2.

## Global Constraints

- Work in the worktree `/var/home/gerbal/Games/CS-Modding-wt/findit-remediation` on branch `findit/phase-2-one-taxonomy`. Paths below are relative to `cs2-findit-building-menu/` inside it. Every `just` command runs from the worktree root (`/var/home/gerbal/Games/CS-Modding-wt/findit-remediation`).
- Beads: epic cm-jjlv, this phase cm-jjlv.6, task beads cm-jjlv.6.1–.4 (filled in when created). Run `bd` from `/var/home/gerbal/Games/CS-Modding`; strip ANSI from output with `sed -r 's/\x1B\[[0-9;]*[mK]//g'`.
- Test commands: `just test findit-building-menu 2>&1 | grep -E "Passed!|Failed!|error CS|# (pass|fail)|\[FAIL\]"` (C# then TS); `cd cs2-findit-building-menu/FindIt/UI && npx tsc --noEmit -p .` for the type check.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_013U8fzQAHmfdVdWfXLX2Eqv`.
- C# changes need a game restart; a UI reload swaps only the `.mjs`.
- Never add navigation to compensate for a deleted upstream concept (user decision, 2026-09-01).
- `VanillaMenuAudit` stays. Do not delete it because the review said so; the spec explains why the review was wrong.

---

### Task 1: The systems stop using the taxonomy, the presets and the milestone

**Files:**
- Create: `FindIt/Domain/VanillaMenus.cs`
- Modify: `FindIt/Domain/NetworkMenuExtension.cs:10` (`RoadsMenu` forwards)
- Modify: `FindIt/Systems/FindItUISystem.Setup.cs:26-27,37,122-125,259-261`
- Modify: `FindIt/Systems/FindItUISystem.Bindings.cs` (whole `VanillaMenuSelected`; `ResetBuildingLensMilestone` and its six calls; `SetBuildingLensMenu`; `ClearBuildingLensMenuScope`; `SearchEverything`; `SetBuildingLensSection`; `SetBuildingLensSubCategory`)
- Modify: `FindIt/Systems/FindItUISystem.Methods.cs:59-81,127-150,256-274`
- Test: `FindItBuildingMenu.Tests/VanillaMenusTests.cs` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: `FindItBuildingMenu.Domain.VanillaMenus` with `public const string Roads = "Roads"; public const string Zones = "Zones"; public static bool IsZones(string? menu)`. `NetworkMenuExtension.RoadsMenu` keeps its name and value (`VanillaMenus.Roads`). After this task the query fields `Category`, `SubCategory`, `BuildMenuSection`, `BuildMenuSubCategory`, `UnlockMilestone`, `StripAxis` still exist but nothing writes them — Task 2 deletes them.

- [ ] **Step 1: Write the failing test for `VanillaMenus`**

Create `FindItBuildingMenu.Tests/VanillaMenusTests.cs`:

```csharp
using FindItBuildingMenu.Domain;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	public sealed class VanillaMenusTests
	{
		[Theory]
		[InlineData("Zones")]
		[InlineData("zones")]
		[InlineData("  Zones ")]
		public void RecognisesTheZonesMenuTheWayTheToolbarNamesIt(string menu)
		{
			Assert.True(VanillaMenus.IsZones(menu));
		}

		[Theory]
		[InlineData("Roads")]
		[InlineData("Signatures")]
		[InlineData("")]
		[InlineData(null)]
		public void EveryOtherMenuIsNotZones(string? menu)
		{
			Assert.False(VanillaMenus.IsZones(menu));
		}

		[Fact]
		public void TheRoadsNameIsTheOneTheNetworkExtensionAlreadyUses()
		{
			Assert.Equal(NetworkMenuExtension.RoadsMenu, VanillaMenus.Roads);
		}
	}
}
```

- [ ] **Step 2: Run it to see it fail to compile**

Run: `just test findit-building-menu 2>&1 | grep -E "error CS" | head -3`
Expected: `error CS0103: The name 'VanillaMenus' does not exist`.

- [ ] **Step 3: Create `VanillaMenus` and forward `RoadsMenu`**

Create `FindIt/Domain/VanillaMenus.cs`:

```csharp
using System;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// The vanilla toolbar menus the lens treats specially, by the name the
	/// game's UIAssetMenuPrefab carries — the same string assets record as
	/// PrefabIndex.UiMenuName.
	/// </summary>
	/// <remarks>
	/// Two names, not a table. VanillaMenuPresets used to map every service
	/// menu to an upstream (PrefabCategory, PrefabSubCategory) pair; the
	/// menu tree made all of that redundant, and what survived was one
	/// question — "is this Zones?" — asked to honour the ReplaceVanillaZonesMenu
	/// setting. Roads is here because NetworkMenuExtension already named it.
	/// </remarks>
	public static class VanillaMenus
	{
		public const string Roads = "Roads";

		public const string Zones = "Zones";

		public static bool IsZones(string? menu) =>
			string.Equals(menu?.Trim(), Zones, StringComparison.OrdinalIgnoreCase);
	}
}
```

In `FindIt/Domain/NetworkMenuExtension.cs` replace

```csharp
		public const string RoadsMenu = "Roads";
```

with

```csharp
		public const string RoadsMenu = VanillaMenus.Roads;
```

- [ ] **Step 4: Run the new test**

Run: `just test findit-building-menu 2>&1 | grep -E "Passed!|Failed!|error CS|VanillaMenus"`
Expected: `Passed!` for C# (the TS line follows). The three `VanillaMenusTests` pass.

- [ ] **Step 5: Delete the section and milestone fields and bindings in `Setup.cs`**

In `FindIt/Systems/FindItUISystem.Setup.cs` delete these lines exactly:

```csharp
		private string _buildingLensSection = VanillaBuildMenuTaxonomy.AllBuildings;
		private string _buildingLensSubCategory = VanillaBuildMenuTaxonomy.Any;
```

```csharp
		// The progression tab, or AnyMilestone. Cleared alongside the category
		// wherever the scope changes: a tier index means nothing across menus,
		// so carrying one into a new menu would open it already narrowed to a
		// tier the player never picked.
		private int _buildingLensUnlockMilestone = BuildingCatalogQuery.AnyMilestone;
```

```csharp
		private ValueBindingHelper<string> _BuildingLensSectionBinding = null!;
		private ValueBindingHelper<string> _BuildingLensSubCategoryBinding = null!;
		private ValueBindingHelper<BuildingLensSectionUIEntry[]> _BuildingLensSectionListBinding = null!;
		private ValueBindingHelper<BuildingLensSubCategoryUIEntry[]> _BuildingLensSubCategoryListBinding = null!;
```

```csharp
			_BuildingLensSectionBinding = CreateBinding("BuildingLensSection", "SetBuildingLensSection", _buildingLensSection, SetBuildingLensSection);
			_BuildingLensSubCategoryBinding = CreateBinding("BuildingLensSubCategory", "SetBuildingLensSubCategory", _buildingLensSubCategory, SetBuildingLensSubCategory);
			_BuildingLensSectionListBinding = CreateBinding("BuildingLensSectionList", Array.Empty<BuildingLensSectionUIEntry>());
			_BuildingLensSubCategoryListBinding = CreateBinding("BuildingLensSubCategoryList", Array.Empty<BuildingLensSubCategoryUIEntry>());
```

Keep `_buildingLensStripAxis` (line 41) and `_BuildingLensStripAxisBinding`: the UI reads the axis for its default grouping.

- [ ] **Step 6: Rewrite `VanillaMenuSelected` in `Bindings.cs`**

Replace the whole method body from `private void VanillaMenuSelected(int menuEntityIndex)` down to the closing brace before the `/// <summary>` of `VanillaMenuDeselected` with:

```csharp
		private void VanillaMenuSelected(int menuEntityIndex)
		{
			if (!Mod.Settings.ReplaceVanillaBuildMenu)
			{
				YieldMenuToVanilla();
				return;
			}

			// Opening the lens makes the game re-assert the armed tool's menu,
			// so one click arrives as two selections. Routing the second
			// reverted the player's choice within the same tick.
			if (MenuEchoGuard.IsEcho(_appliedMenuFrame, _appliedMenuIndex, UnityEngine.Time.frameCount, menuEntityIndex))
			{
				return;
			}

			// The menu's own name is the whole constraint the query needs:
			// assets carry the menu the game placed them in (PrefabIndex.UiMenuName,
			// read off UIObject.m_Group), so a name reproduces vanilla's set
			// exactly. GetAssetMenuName resolves the UIAssetMenuPrefab's name,
			// which is that same string, so it needs no translation. There used
			// to be a preset table in front of this that mapped the service
			// menus onto upstream FindIt's category enums; the tree covers every
			// menu — Roads alone is 9 categories, 157 assets — so the table only
			// ever narrowed what the tree already answered.
			var menuName = PrefabIndexingSystem.GetAssetMenuName(menuEntityIndex);

			if (string.IsNullOrEmpty(menuName))
			{
				// A menu the index never saw — a modded toolbar entry that was
				// added after indexing, or one with no prefab. The player asked
				// for that menu, so get out of its way: the lens panel sits over
				// exactly where the vanilla asset grid appears, and leaving it up
				// would hide the menu they just clicked.
				YieldMenuToVanilla();
				return;
			}

			if (VanillaMenus.IsZones(menuName) && !Mod.Settings.ReplaceVanillaZonesMenu)
			{
				// The player kept the familiar zone grid; leave it alone and get
				// out of its way, exactly as for an unknown menu.
				YieldMenuToVanilla();
				return;
			}

			_buildingLensUiMenu = menuName;
			// A different menu has different tabs, so the old selection cannot
			// survive the switch.
			_buildingLensUiCategory = string.Empty;
			ResetBuildingLensStripTab();
			ResetBuildingLensSchoolTier();
			RefreshBuildingLensMenuCategories();

			_appliedMenuIndex = menuEntityIndex;
			_appliedMenuFrame = UnityEngine.Time.frameCount;
			_LensOwnsCurrentMenu.Value = true;
			_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };

			// activatePrefab: false. Opening a menu must not re-arm the prefab
			// from the LAST menu — that is what desynced the toolbar. Arming a
			// water pipe makes the game re-assert Water as the selected menu, so
			// the highlight sat on Water while the lens showed Electricity, and
			// clicking the lit Water icon closed a menu the player never opened.
			//
			// The echo guard was written for the same re-assertion and only
			// stopped it reaching US; the game's own selection still moved. This
			// removes the re-assertion instead of ignoring it.
			//
			// Exactly one refresh, whichever way we got here.
			//
			// SetLensMenuOpen(true) ends in RefreshLens — but it FIRST
			// early-returns when the panel is already visible, which is
			// precisely the menu-to-menu switch. So the refresh cannot live
			// only inside the toggle (a switch would get none) and cannot
			// live only outside it (a cold open would get two).
			//
			// Measured both ways: three refreshes fired per open before
			// this, and dropping the outside pair silently left the strip
			// showing the PREVIOUS menu's counts on every switch.
			var wasOpen = _lensMenuOpen;
			SetLensMenuOpen(true, activatePrefab: false);

			if (wasOpen)
			{
				RefreshLens();
			}
		}
```

- [ ] **Step 7: Delete the milestone reset and its calls**

In `Bindings.cs` delete the method and its doc comment:

```csharp
		/// <summary>Drops the tier narrowing, without refreshing on its own.</summary>
		/// <remarks>
		/// Every caller is already on its way to <c>RefreshBuildingCatalog</c>
		/// for a scope change of its own, so refreshing here would run the query
		/// twice for one gesture.
		/// </remarks>
		private void ResetBuildingLensMilestone()
		{
			_buildingLensUnlockMilestone = BuildingCatalogQuery.AnyMilestone;
		}
```

Then delete every remaining line `ResetBuildingLensMilestone();` (there are five left after Step 6: in `ReleaseMenuScope`, `SetBuildingLensMenuCategory`, `SetBuildingLensMenu`, `ClearBuildingLensMenuScope`, `ResetBuildingLensMenu`). Change the remark on `ResetBuildingLensStripTab` from `Same contract as ResetBuildingLensMilestone above.` to `Every caller is already on its way to RefreshBuildingCatalog for a scope change of its own, so refreshing here would run the query twice for one gesture.` — that remark was the milestone method's and is now the only copy.

Run: `grep -n "Milestone" FindIt/Systems/FindItUISystem.Bindings.cs FindIt/Systems/FindItUISystem.Setup.cs`
Expected: only `_BuildingLensMilestonesBinding` (Setup) — the names binding stays.

- [ ] **Step 8: Trim `SetBuildingLensMenu`, `ClearBuildingLensMenuScope`, `SearchEverything`; delete the two section handlers**

In `SetBuildingLensMenu`, delete from the comment `// Zones are assignment tools rather than buildings, so that menu gets` through the empty `if (zoning) { }` block (eight lines ending with the block's `}`), leaving `RefreshBuildingLensMenuCategories();` as the next statement after the `_buildingCatalogQuery = ... DefaultLimit };` line.

In `ClearBuildingLensMenuScope`, delete from `// The section and subcategory go too, because the MENU set them, not` through `FindItUtil.CurrentSubCategory = PrefabSubCategory.Any;` (the comment, the `VanillaBuildMenuSelection widened = ...` block, the four `_buildingLens…`/`_BuildingLens…` assignments and the two `FindItUtil` writes). Also delete the four-line comment starting `// The zoning view is a different renderer over a different catalog,` — it describes a renderer that no longer exists. What remains of the method:

```csharp
		private void ClearBuildingLensMenuScope()
		{
			_buildingLensUiMenu = string.Empty;
			_buildingLensUiCategory = string.Empty;
			ResetBuildingLensStripTab();
			ResetBuildingLensSchoolTier();

			_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };

			RefreshBuildingLensMenuCategories();
			RefreshBuildingLensNavigation();
			RefreshBuildingCatalog();
		}
```

Rewrite `SearchEverything` as:

```csharp
		private void SearchEverything()
		{
			// The menu scope has to go, or "search everything" searches the one
			// menu the player already knows has nothing — the control that
			// exists to escape an empty result could not escape it.
			ReleaseMenuScope();
			_buildingCatalogQuery = _buildingCatalogQuery with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };

			// One call, not three. RefreshLens IS
			// RefreshBuildingLensNavigation followed by RefreshBuildingCatalog,
			// so the three lines this replaces ran each of them TWICE — and on
			// the one path where that costs most, since searching everything is
			// by definition the unscoped 10,528-entry query.
			RefreshLens();
		}
```

Delete the methods `SetBuildingLensSection` and `SetBuildingLensSubCategory` whole (from `private void SetBuildingLensSection(string section)` through the closing brace of `SetBuildingLensSubCategory`, including the comment above `SetBuildingLensSection`'s body).

Delete `using FindItBuildingMenu.Domain.Enums;` from the top of `Bindings.cs` — its last uses were the `PrefabCategory` writes.

Run: `grep -n "VanillaBuildMenu\|VanillaMenuPresets\|_buildingLensSection\|_buildingLensSubCategory\|PrefabCategory\|PrefabSubCategory" FindIt/Systems/FindItUISystem.Bindings.cs`
Expected: nothing.

- [ ] **Step 9: Trim `Methods.cs`**

In `RefreshBuildingCatalog`, delete

```csharp
			var category = string.Empty;
			var subCategory = string.Empty;
```

and, inside the `with { … }` that builds the query, the lines

```csharp
				Category = category,
				SubCategory = subCategory,
				BuildMenuSection = _buildingLensSection,
				BuildMenuSubCategory = _buildingLensSubCategory,
```

```csharp
				UnlockMilestone = _buildingLensUnlockMilestone,
				StripAxis = _buildingLensStripAxis,
```

Change the auto-widen condition from `&& _buildingLensSection != VanillaBuildMenuTaxonomy.AllBuildings)` to `&& _buildingCatalogQuery.IsScopedToMenu)` and add above the `if`:

```csharp
			// Fires for every scoped menu now. It used to read the section, which
			// only the preset menus set — so Electricity widened an empty search
			// and Roads, routed through the tree, did not. Same gesture, one rule.
```

In the `MatchesElsewhere` widening `with { … }`, delete the four lines `Category = string.Empty,`, `SubCategory = string.Empty,`, `BuildMenuSection = VanillaBuildMenuTaxonomy.AllBuildings,`, `BuildMenuSubCategory = VanillaBuildMenuTaxonomy.Any,` leaving `UiMenu = string.Empty,` and `Offset = 0,`.

In `RefreshBuildingLensNavigation`, delete everything after the `_BuildingLensMilestonesBinding.Value = PrefabIndexingSystem.GetMilestoneNames();` line up to the closing brace of the method: the `VanillaBuildMenuSelection selection = …` block, the four assignments, the two `…ListBinding.Value = …` publishes and the four-line comment about the static tool catalog.

Run: `grep -n "VanillaBuildMenu\|_buildingLensSection\|_buildingLensSubCategory\|UnlockMilestone\|StripAxis =" FindIt/Systems/FindItUISystem.Methods.cs`
Expected: nothing.

- [ ] **Step 10: Run the suites**

Run: `just test findit-building-menu 2>&1 | grep -E "Passed!|Failed!|error CS|\[FAIL\]|# (pass|fail)"`
Expected: C# `Failed: 1` — `BindingManifestTests.EveryNameTheUiUsesIsRegisteredByCSharp` (the UI still reads `BuildingLensSection`, `BuildingLensSubCategory`, `BuildingLensSectionList`, `BuildingLensSubCategoryList` and fires `SetBuildingLensSection`, `SetBuildingLensSubCategory`; Task 3 removes them). Everything else passes. If anything else fails, stop.

- [ ] **Step 11: Commit**

```bash
git add FindIt/Domain/VanillaMenus.cs FindIt/Domain/NetworkMenuExtension.cs FindIt/Systems FindItBuildingMenu.Tests/VanillaMenusTests.cs
git commit -m "refactor(findit): the lens scopes by the menu tree alone; section, preset and milestone state leave the systems (cm-jjlv.6.1)"
```

---

### Task 2: The query, the engine and the domain lose the dead scopings

**Files:**
- Modify: `FindIt/Domain/BuildingCatalogQuery.cs:10-12,52-74,85,88`
- Modify: `FindIt/Services/BuildingCatalogQueryEngine.cs:146-217,266-273,404-436`
- Modify: `FindIt/Domain/BuildingCatalogEntry.cs:57-58,213-217`
- Modify: `FindIt/Services/BuildingCatalogAdapter.cs:1267-1280`
- Modify: `FindIt/Domain/GameLocaleKeys.cs:62-66`
- Modify: `FindIt/Domain/VanillaMenuAudit.cs:56` (class summary)
- Modify: `FindIt/Domain/PrefabIndex.cs:146-165` (resolve the SPIKE comment)
- Delete: `FindIt/Domain/VanillaBuildMenuTaxonomy.cs`, `FindIt/Domain/VanillaBuildMenuSelection.cs`, `FindIt/Domain/VanillaMenuPresets.cs`, `FindIt/Domain/UIBinding/BuildingLensSectionUIEntry.cs`, `FindIt/Domain/UIBinding/BuildingLensSubCategoryUIEntry.cs`
- Delete tests: `FindItBuildingMenu.Tests/VanillaBuildMenuTaxonomyTests.cs`, `VanillaMenuPresetTests.cs`, `NetworkSectionTests.cs`
- Modify tests: `BuildingCatalogQueryEngineTests.cs`, `BuildingCatalogProgressionTests.cs`, `GameLocaleKeyTests.cs:61`

**Interfaces:**
- Consumes: Task 1 (nothing in `Systems/` references the fields any more).
- Produces: `BuildingCatalogQuery` without `Category`, `SubCategory`, `BuildMenuSection`, `BuildMenuSubCategory`, `UnlockMilestone`, `AnyMilestone`, `StripAxis`. `BuildingCatalogEntry` without `VanillaSection`, `VanillaSubCategory`. `BuildingCatalogQueryEngine.Matches` starts with `MatchesVanillaMenuTree` and has no other scope predicate.

- [ ] **Step 1: Delete the query fields**

In `FindIt/Domain/BuildingCatalogQuery.cs` delete:

```csharp
		string Category = "",
		string SubCategory = "",
```

```csharp
		string BuildMenuSection = "",
		string BuildMenuSubCategory = "",
		// SPIKE (cm-e98i): the game's own menu placement, used instead of our
		// reconstructed section when the lens was opened from a vanilla menu.
```

(keep the `string UiMenu = "",` and `string UiCategory = "",` lines that follow; put a new comment above them: `// The game's own menu placement — UIObject.m_Group — which is the only scope there is.`)

```csharp
		// The progression tier the menu strip is narrowed to, or AnyMilestone.
		// An int rather than a string because a milestone IS its index: the
		// name is a lookup, and two milestones can share neither index nor
		// position. -1 rather than a nullable so the record still has a
		// plain default and the UI can send one number for "no narrowing".
		//
		// Spelled -1 rather than AnyMilestone because a record's primary
		// constructor cannot see its own type's constants. Query_DefaultsToAny
		// Milestone pins the two together so they cannot drift apart silently.
		int UnlockMilestone = -1,
		// The fallback strip's axis and the tab picked on it. Two fields
		// because the axis decides WHICH property the tab is matched against:
		// the strip picks whichever axis cuts the menu best, so the same tab
		// string means a development branch on one menu and an asset type on
		// another. See BuildingCatalogAdapter.GetStripAxis.
		string StripAxis = "",
```

Replace the deleted `StripAxis` comment with this one above `StripTabs`:

```csharp
		// The fallback strip's selection. The AXIS is not here: nothing in the
		// predicate reads it — a tab is matched by value on whichever axis
		// names it (see BuildingCatalogQueryEngine.StripMatches) — so it lives
		// on the system as a published fact, not on the query as a filter.
```

Delete the stray `/// <summary>The <see cref="UnlockMilestone"/> value that narrows nothing.</summary>` line (it sits above the `OfferedSortColumns` summary) and `public const int AnyMilestone = -1;`.

- [ ] **Step 2: Delete the engine predicates**

In `FindIt/Services/BuildingCatalogQueryEngine.cs`, inside `Matches`:

- Delete the milestone block: the four comment lines beginning `// The progression tab. Equality on the index, not a "this tier and` and the `if (query.UnlockMilestone != BuildingCatalogQuery.AnyMilestone && entry.UnlockMilestone != query.UnlockMilestone) { return false; }`.
- Delete the whole block from `// The menu tree REPLACES the section overlay rather than layering on` through the `if (!IsScopedToMenuTree(query) && !MatchesBuildMenu(entry, query)) { return false; }` — nineteen comment lines and the four-line `if`.
- Delete the two enum predicates:

```csharp
			if (!string.IsNullOrWhiteSpace(query.Category)
				&& !string.Equals(entry.Category, query.Category, StringComparison.OrdinalIgnoreCase))
			{
				return false;
			}

			if (!string.IsNullOrWhiteSpace(query.SubCategory)
				&& !string.Equals(entry.SubCategory, query.SubCategory, StringComparison.OrdinalIgnoreCase))
			{
				return false;
			}
```

Delete `IsScopedToMenuTree` with its `/// <summary>`…`/// </remarks>` block (it ends `Two copies of "am I looking at a menu?" would be two places to disagree.`). Delete `MatchesBuildMenu` whole (from `private static bool MatchesBuildMenu(` to its closing brace).

Above `MatchesVanillaMenuTree` add:

```csharp
		/// <summary>
		/// The only scope there is: the game's own menu placement.
		/// </summary>
		/// <remarks>
		/// There used to be a second predicate here, over a section taxonomy
		/// rebuilt from upstream FindIt's category enums, applied whenever no
		/// menu was named. Layering it on the tree had cost Roads 35 of its 157
		/// members and Transportation 23 of 53 (members that indexed into a
		/// section the preset did not name), so the tree already replaced it
		/// when scoped; now the tree is all there is, scoped or not.
		/// </remarks>
```

Run: `grep -n "Category\b\|SubCategory\b\|UnlockMilestone\|BuildMenu\|VanillaBuildMenu" FindIt/Services/BuildingCatalogQueryEngine.cs | grep -v "entry\.\|x\.\|\"category\"\|\"subcategory\"\|UiCategory\|EffectiveCategory\|AssetCategory"`
Expected: nothing (only `entry.Category`, `entry.SubCategory` sort/group reads and the `"category"`/`"subcategory"` column names remain).

- [ ] **Step 3: Delete the entry fields, the projection call and the taxonomy files**

`FindIt/Domain/BuildingCatalogEntry.cs`: delete `string? VanillaSection = null,` and `string? VanillaSubCategory = null,`, and the five-line comment in `Write` beginning `// VanillaSection and VanillaSubCategory are NOT written.`.

`FindIt/Services/BuildingCatalogAdapter.cs`, in `Project`: delete `VanillaBuildMenuTag? vanillaTag = VanillaBuildMenuTaxonomy.Resolve(prefab.Category, prefab.SubCategory, prefab.ZoneType);` and the blank line after it, and the two arguments `VanillaSection: vanillaTag?.Section,` and `VanillaSubCategory: vanillaTag?.SubCategory,`.

`FindIt/Domain/GameLocaleKeys.cs`: delete

```csharp
			[VanillaBuildMenuTaxonomy.ServiceBuildings] = Title("Buildings/Services"),
			[VanillaBuildMenuTaxonomy.AllBuildings] = Title("All"),
```

and change the comment `// Categories and lens sections.` to `// Categories.`.

`FindIt/Domain/VanillaMenuAudit.cs`: above `public static class VanillaMenuAudit` add

```csharp
	/// <summary>
	/// Compares the game's own menu placements against what the index holds,
	/// by the tree fields the index reads off the same UIObject.m_Group.
	/// </summary>
	/// <remarks>
	/// A coverage audit, not a taxonomy one: it says which assets vanilla
	/// offers under a menu that the indexer failed to hold, and which we
	/// file under a menu the game has no such menu for. It is the check
	/// that caught the roads-cost bug. It outlived the section taxonomy it
	/// was once mistaken for auditing.
	/// </remarks>
```

`FindIt/Domain/PrefabIndex.cs`: replace the ten-line `// SPIKE (cm-e98i): the game's own answer to "where does this asset live` … `// Remove these two, or commit to them, once that question is answered.` comment with:

```csharp
		// The game's own answer to "where does this asset live in the build
		// menu". Vanilla's menu is not a predicate over a flat list — each
		// category IS its own UIGroupElement buffer and membership is exactly
		// UIObjectData.m_Group == that category. These two fields are the only
		// scoping the lens has (cm-jjlv.6); the section taxonomy that used to
		// rebuild the same relationship from (Category, SubCategory, ZoneType)
		// is gone, along with the Healthcare view that showed 15 where vanilla
		// shows 8.
```

Then:

```bash
git rm -q FindIt/Domain/VanillaBuildMenuTaxonomy.cs FindIt/Domain/VanillaBuildMenuSelection.cs FindIt/Domain/VanillaMenuPresets.cs FindIt/Domain/UIBinding/BuildingLensSectionUIEntry.cs FindIt/Domain/UIBinding/BuildingLensSubCategoryUIEntry.cs
git rm -q FindItBuildingMenu.Tests/VanillaBuildMenuTaxonomyTests.cs FindItBuildingMenu.Tests/VanillaMenuPresetTests.cs FindItBuildingMenu.Tests/NetworkSectionTests.cs
```

Run: `grep -rn "VanillaBuildMenu\|VanillaMenuPresets\|VanillaMenuPreset\b\|VanillaSection\|VanillaSubCategory\|BuildingLensSectionUIEntry\|BuildingLensSubCategoryUIEntry" FindIt --include=*.cs`
Expected: nothing.

- [ ] **Step 4: Fix the engine tests**

In `FindItBuildingMenu.Tests/BuildingCatalogQueryEngineTests.cs`:

Add, after the `SampleEntries` field, a scoped copy of the fixture — the tests that filtered by the upstream `Category` now scope by menu, which is the only scope there is:

```csharp
    /// <summary>
    /// The same five, filed under the menus vanilla would put them in. The
    /// tests that used to narrow by upstream's Category narrow by UiMenu now.
    /// </summary>
    private static readonly IReadOnlyList<BuildingCatalogEntry> MenuedEntries = SampleEntries
        .Select(entry => entry with
        {
            UiMenu = entry.Category == "Buildings" ? "Zones" : "Health & Deathcare",
        })
        .ToArray();
```

(`System.Linq` is already imported via the existing `.Select` uses; if not, add `using System.Linq;`.)

Then:

- `Query_SearchAndCategoryFilters_AreCaseInsensitive` → rename to `Query_SearchAndMenuScope_AreCaseInsensitive`; use `MenuedEntries` and `new BuildingCatalogQuery(SearchText: "POWER", UiMenu: "zones")`. Same assertions.
- `Query_RangeSubcategoryAndParkingFilters_UseInclusiveBounds` → rename to `Query_RangeAndParkingFilters_UseInclusiveBounds`; delete the `SubCategory: "ServiceBuildings_Health",` argument. Same assertions (entry 4 is the only 3×2, level-2, no-parking entry).
- Delete `Query_BuildMenuSectionsAndSubcategoriesFilterProjectedEntries` and `Query_UnknownBuildMenuSectionDoesNotFallBackToAllBuildings` whole.
- `Query_PagesAfterFilteringAndReportsUnpagedTotal`, `Query_ClampsOffsetPastTheEndToTheLastPage` (the one at ~552 with `Offset: 200, Limit: 100`) and `Query_ClampsOffsetToTheLastPopulatedPageNotToZero`: use `MenuedEntries` and replace `Category: "Buildings"` with `UiMenu: "Zones"` in each. Update the comment `// Category "Buildings" orders to [1, 5, 2]; the last page holds id 2.` to `// Zones holds [1, 5, 2] in name order; the last page holds id 2.`
- `ResetWindowIfPredicatesChanged_ResetsForLegacyFilterAndRangeChanges`: replace `(previous with { BuildMenuSection = "Education" })` with `(previous with { UiMenu = "Education & Research" })`.
- `Query_EducationCapacityFloorIsCategoryScopedAndInclusive`: append `UiMenu = "Education & Research"` inside `smallSchool`'s `with { Capacity = 100 }` (so `with { Capacity = 100, UiMenu = "Education & Research" }`; `missingCapacity` derives from it and inherits the menu); replace the query's `Category: "servicebuildings", SubCategory: "servicebuildings_educationresearch",` with `UiMenu: "education & research",`. Rename to `Query_EducationCapacityFloorIsMenuScopedAndInclusive`.
- Delete `Query_MenuScopeReplacesTheSectionOverlayRatherThanLayeringOnIt` whole (there is no overlay to replace).

In `FindItBuildingMenu.Tests/BuildingCatalogProgressionTests.cs`:

- Delete `QueryDefaultsToAnyMilestone`, `NarrowsToASingleTier`, `TierIsExactRatherThanCumulative`, `UnlockedAssetsKeepTheirTier` whole. Keep `ReturnsEverythingWhenNoTierIsSelected` but rename it `ReturnsEverythingTheFixtureHolds` (it is now the fixture's smoke test).
- In `TheStripTabNarrowsOnWhicheverAxisNamesIt`, delete the three `StripAxis: StripAxes.Development, ` / `StripAxis: StripAxes.AssetType, ` arguments so the queries read `new BuildingCatalogQuery(StripTabs: new[] { "Basic" })`, `new BuildingCatalogQuery(StripTabs: new[] { StripAxes.NetworkValue })`, `new BuildingCatalogQuery(StripTabs: new[] { "Basic" })`. The `mixed` case's comment becomes the point of the test: add above the `mixed` query `// There is no axis on the query at all; the tab's value is what names it.`
- Update the class summary from `The progression tab strip: narrowing a menu to one tier of the game's own unlock progression.` to `The fallback tab strip and the entry's milestone facts. The progression TAB is gone (cm-jjlv.3); what stays is the strip's value matching.`

In `FindItBuildingMenu.Tests/GameLocaleKeyTests.cs` replace `Assert.Null(GameLocaleKeys.For(VanillaBuildMenuTaxonomy.Networks));` with `Assert.Null(GameLocaleKeys.For("Networks"));` and keep the comment.

- [ ] **Step 5: Run the suites**

Run: `just test findit-building-menu 2>&1 | grep -E "Passed!|Failed!|error CS|\[FAIL\]|# (pass|fail)"`
Expected: C# `Failed: 1` — still only `EveryNameTheUiUsesIsRegisteredByCSharp`. Total C# tests should be about 412 − (4 taxonomy + 8 preset + 8 network-section + 2 engine + 4 progression + 1 engine) + 3 = ~388. If any other test fails, read its name before touching anything: a grouping or label test failing means an `entry.Category` read was deleted by mistake.

- [ ] **Step 6: Commit**

```bash
git add -A FindIt/Domain FindIt/Services FindItBuildingMenu.Tests
git commit -m "refactor(findit): one scoping taxonomy — the query is UiMenu/UiCategory and nothing else (cm-jjlv.6.2)"
```

---

### Task 3: The UI drops the section and type chips

**Files:**
- Modify: `FindIt/UI/src/mods/ChipRow/ChipRow.tsx:7,37-43,55,61-64,78-84,146-157,166-178,183-186,215-236`
- Modify: `FindIt/UI/src/domain/lensScopeChips.ts`
- Modify: `FindIt/UI/src/domain/filterChips.ts:35-37,46-48,52-53,114-127`
- Delete: `FindIt/UI/src/domain/vanillaBuildMenuContracts.ts`, `FindIt/UI/test/vanillaBuildMenuContracts.test.ts`
- Modify: `FindIt/UI/src/domain/buildingGroups.ts:215-220,286-288`
- Modify: `FindIt/UI/src/mods/BuildingCatalog/BuildingCatalog.tsx:115-116,193,228`
- Modify: `FindIt/UI/src/mods/LensControlPane/LensControlPane.tsx:49,111,133`
- Modify tests: `FindIt/UI/test/lensScopeChips.test.ts`, `filterChips.test.ts`, `buildingGroups.test.ts:303-378,673-677`

**Interfaces:**
- Consumes: Task 1's binding set (no `BuildingLensSection*` on the C# side).
- Produces: `lensScopeChipsFor(state): { menu: boolean; menuCategory: boolean }`; `LensScopeState = { menu?, menuCategory?, menuCategoryCount? }`; `defaultGroupDimensionFor(menuHasCategories = false, stripAxis = "", educationMenu = false)`; `FilterChipInput` without `section`/`subCategory`.

- [ ] **Step 1: Rewrite the `lensScopeChips` tests to the new shape**

Replace `FindIt/UI/test/lensScopeChips.test.ts` with:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isScopedToMenu,
  lensScopeChipsFor,
  type LensScopeState,
} from "../src/domain/lensScopeChips.ts";

const state = (over: Partial<LensScopeState> = {}): LensScopeState => ({
  menu: "",
  menuCategory: "",
  menuCategoryCount: 0,
  ...over,
});

describe("menu scope", () => {
  it("treats empty and whitespace as unscoped", () => {
    assert.equal(isScopedToMenu(""), false);
    assert.equal(isScopedToMenu("   "), false);
    assert.equal(isScopedToMenu(null), false);
    assert.equal(isScopedToMenu(undefined), false);
    assert.equal(isScopedToMenu("GarbageManagement"), true);
  });
});

describe("which navigation chips get drawn", () => {
  it("always offers the menu chip, so a menu can be picked without the toolbar", () => {
    // A bottom-bar icon is a shortcut to a menu. If the menu is a facet then it
    // has to be reachable from the filters too, or Zones is a view only the
    // toolbar can produce.
    assert.equal(lensScopeChipsFor(state()).menu, true);
    assert.equal(lensScopeChipsFor(state({ menu: "Roads" })).menu, true);
    assert.equal(lensScopeChipsFor(null).menu, true);
  });

  it("offers the category chip only where there is a choice to make", () => {
    // Same threshold as the tab strip: Water & Sewage has one category, and a
    // control whose only value is the one already set is not a control.
    assert.equal(lensScopeChipsFor(state({ menu: "WaterSewage", menuCategoryCount: 1 })).menuCategory, false);
    assert.equal(lensScopeChipsFor(state({ menu: "Transportation", menuCategoryCount: 6 })).menuCategory, true);
  });

  it("offers no category chip outside a menu", () => {
    // The categories are a menu's; "All menus" has none of its own.
    assert.equal(lensScopeChipsFor(state({ menuCategoryCount: 6 })).menuCategory, false);
  });

  it("draws exactly two kinds of chip", () => {
    // Section and Type used to be here. They were our own taxonomy, applied
    // only when no menu was scoped, and the taxonomy is gone (cm-jjlv.6).
    assert.deepEqual(Object.keys(lensScopeChipsFor(state())).sort(), ["menu", "menuCategory"]);
  });

  it("survives a null state before the first publish", () => {
    assert.deepEqual(lensScopeChipsFor(null), { menu: true, menuCategory: false });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd cs2-findit-building-menu/FindIt/UI && node --test --experimental-strip-types test/lensScopeChips.test.ts 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 2` (the two-kinds and null-state cases see four keys).

- [ ] **Step 3: Rewrite `lensScopeChips.ts`**

Replace the file with:

```ts
/**
 * Which navigation chips the current scope justifies drawing.
 *
 * One rule, and it is the whole module: **a chip is drawn only when the state
 * it writes is actually applied to the result.**
 *
 * That rule exists because it was broken. The lens once had its own section
 * and type taxonomy, applied only when no vanilla menu was scoped — and the
 * Section and Type chips stayed on screen through a menu-scoped query:
 * clickable, restyling themselves as if they had taken effect, and discarded
 * by the query. This module hid them. The taxonomy itself has since gone
 * (cm-jjlv.6): the game's menu tree is the only scope, so the two chips left
 * are the menu and the category within it.
 */

export interface LensScopeState {
  /** The vanilla menu the lens is scoped to. Empty means the whole catalog. */
  menu?: string | null;
  /** The category within that menu. Empty means all of them. */
  menuCategory?: string | null;
  /** How many categories the scoped menu has. */
  menuCategoryCount?: number | null;
}

export interface LensScopeChips {
  /** The menu chip — picks a menu, and offers to drop the one that is set. */
  menu: boolean;
  /** The category chip — picks among the scoped menu's categories. */
  menuCategory: boolean;
}

export function isScopedToMenu(menu: string | null | undefined): boolean {
  return typeof menu === "string" && menu.trim() !== "";
}

export function lensScopeChipsFor(state: LensScopeState | null | undefined): LensScopeChips {
  const scoped = isScopedToMenu(state?.menu);

  return {
    menu: true,
    menuCategory: scoped && (state?.menuCategoryCount ?? 0) > 1,
  };
}
```

Run the same `node --test` line. Expected: `# fail 0`.

- [ ] **Step 4: Trim `ChipRow.tsx`**

- Replace the import on line 7 with nothing (delete it) and add, after the `styles` import, a local type:

```ts
/** One row of a picker: an id to fire, an icon to draw, a name to read. */
interface VanillaBuildMenuTab {
  id: string;
  icon: string;
  toolTip: string;
}
```

- Delete `const SUBCATEGORY_ANY = "Any";` and the four `bindValue`s `BuildingLensSection$`, `BuildingLensSubCategory$`, `BuildingLensSectionList$`, `BuildingLensSubCategoryList$`.
- Change `type PickerId = "section" | "subCategory" | "menuCategory" | "menu" | null;` to `type PickerId = "menuCategory" | "menu" | null;`.
- Delete the four `useValue` lines for `section`, `subCategory`, `sectionList`, `subCategoryList`.
- In the `lensScopeChipsFor({ … })` call delete `showZoning: false,` and `subCategoryCount: subCategoryList.length,`.
- Delete the `tabLabel` helper (three lines starting `const tabLabel = `).
- `openList`: replace the whole conditional with

```ts
  const openList = picker === "menuCategory"
    ? categoryTabs
    : picker === "menu"
      ? menuTabs
      : null;
```

- `isChosen`: replace with `const isChosen = (id: string) => (picker === "menuCategory" ? id === menuCategory : id === menu);`
- In `choose`, delete the last two statements (`fire(picker === "section" ? lensSectionCommand(id) : lensSubCategoryCommand(id)); setPicker(null);`) — every remaining branch returns. Then simplify: since both branches return, `choose` becomes

```ts
  const choose = (id: string) => {
    fire(
      picker === "menuCategory"
        ? { method: "SetBuildingLensMenuCategory", args: [id] }
        : { method: "SetBuildingLensMenu", args: [id] }
    );
    setPicker(null);
  };
```

- Delete `const allTypesLabel = …;` (its only use was the type chip).
- Delete the two JSX blocks for the section and subCategory breadcrumbs, including their comments: from `{/* The section and type breadcrumbs describe the building catalog. In` through the `)}` that closes `chips.subCategory && renderBreadcrumb(…)`. Also delete the trailing `{/* The zoning view has no chip of its own. …*/}` comment block — the zoning view is gone.
- In the file header comment change `What remains here is identity: which section, which type, which zone families — "what am I looking at", which belongs beside the results.` to `What remains here is identity: which menu, which category within it — "what am I looking at", which belongs beside the results.`

- [ ] **Step 5: Trim `filterChips.ts` and its tests**

`FindIt/UI/src/domain/filterChips.ts`:
- Delete `section?: { id: string; label: string } | null;` and `subCategory?: { id: string; label: string } | null;` from `FilterChipInput`.
- Delete `/** Ids the subcategory uses for "no subcategory chosen". */` and `const SUBCATEGORY_ANY = "Any";`.
- Delete the `removable` doc comment's sentence about the section chip: replace the four-line `/** False only for the section chip: … */` with `/** Whether the chip has a removal gesture at all. */`.
- In `buildFilterChips`, delete the `section` block (from `const section = input?.section;` through its `chips.push({ … remove: null, });` — about ten lines) and the `subCategory` block (from `const subCategory = input?.subCategory;` through its `}` — fourteen lines).
- In the header comment, delete the sentence `Scope and zone family used to be tab strips. They are not navigation — they narrow the set exactly as Role or Cost do — and rendering them as strips cost a permanent 27px band per dimension and made them mutually exclusive by construction, so "Office AND high density" could not be asked for at all.` and keep the rest.

`FindIt/UI/test/filterChips.test.ts`:
- `puts navigation first, then facets, then metric ranges` → rename `puts facets first, then metric ranges`; delete the `section:` and `subCategory:` lines from its input and the `"section",` / `"subCategory",` entries from the expected array.
- Delete `makes the section a breadcrumb rather than a filter`, `omits the subcategory chip when no subcategory is chosen`.
- `names a removal command that round-trips the selection`: delete the `subCategory:` input line and the `assert.deepEqual(chips[0].remove, { method: "SetBuildingLensSubCategory", … })` line; renumber `chips[1]` → `chips[0]` and `chips[2]` → `chips[1]`.
- `gives every chip an id unique across dimensions`: delete the `section:` and `subCategory:` input lines.
- Delete `falls back to the id when a label is missing` (it only tested the section chip).
- `counts only what the Clear button can actually reset`: delete the `section:` input line; change `assert.equal(chips.length, 3);` to `assert.equal(chips.length, 2);`.

- [ ] **Step 6: Delete the contracts file; trim the two readers and `buildingGroups`**

```bash
git rm -q FindIt/UI/src/domain/vanillaBuildMenuContracts.ts FindIt/UI/test/vanillaBuildMenuContracts.test.ts
```

`FindIt/UI/src/domain/buildingGroups.ts`: change the signature to

```ts
export function defaultGroupDimensionFor(
  menuHasCategories: boolean = false,
  stripAxis: string = "",
  educationMenu: boolean = false,
): GroupDimensionId {
```

and replace the final `return typeof section === "string" && section.trim().toLowerCase() === "servicebuildings" ? "role" : DEFAULT_GROUP_DIMENSION;` with `return DEFAULT_GROUP_DIMENSION;`. Add above that return: `// No section to read any more (cm-jjlv.6): the "Role" default it used to pick for the Service Buildings section went with the section.`

`FindIt/UI/src/mods/BuildingCatalog/BuildingCatalog.tsx`: delete the comment `// The section decides the grouping until the player picks one themselves.` and `const BuildingLensSection$ = …;`, the `const section = useValue(BuildingLensSection$);` line, and change the call to `defaultGroupDimensionFor(menuHasCategories, stripAxis, isEducationMenu(menu))`. In the comment above the `useEffect` change `This fires for a section change too, not just an explicit pick` to `This fires for a menu change too, not just an explicit pick`.

`FindIt/UI/src/mods/LensControlPane/LensControlPane.tsx`: delete `const BuildingLensSection$ = …;` and `const section = useValue(BuildingLensSection$);`; change the call to `defaultGroupDimensionFor(menuHasCategories, stripAxis, isEducationMenu(menu))`. The comment at ~209 `Identity first: which menu, which section, which category` becomes `Identity first: which menu, which category`.

`FindIt/UI/test/buildingGroups.test.ts`, the `Per-section defaults` describe (lines ~303-378): rename it `Default grouping` and rewrite its cases:

```ts
describe("Default grouping", () => {
  it("opens on category when nothing narrower applies", () => {
    // The Service Buildings section used to open on Role. The section is gone
    // (cm-jjlv.6), and every scoped service menu has either categories or a
    // strip axis, so the case this served no longer arises.
    assert.equal(defaultGroupDimensionFor(), "category");
    assert.equal(defaultGroupDimensionFor(false), "category");
    assert.equal(defaultGroupDimensionFor(false, ""), "category");
  });

  it("lets the menu's own categories beat a development axis", () => {
    // cm-2xvs.23, reported on Roads: ten category tabs on screen and the grid
    // grouped by Development underneath them.
    //
    // GetStripAxis answers "development" for a category menu as soon as ONE of
    // its categories is drawn as branches — it has to, or a branch tab would
    // select nothing. That is a fact about a sub-level, and the picker was
    // reading it as a fact about the whole menu.
    assert.equal(defaultGroupDimensionFor(true, "development"), "menuCategory");
  });

  it("still follows the axis when the menu has no categories of its own", () => {
    // Electricity is the case the fallback exists for: one category, so the
    // strip draws development branches and the grid should agree with them.
    assert.equal(defaultGroupDimensionFor(false, "development"), "development");
    assert.equal(defaultGroupDimensionFor(false, "assetType"), "category");
  });

  it("keeps school tiers ahead of everything, categories included", () => {
    // Education has categories AND a development axis AND school levels; the
    // levels are what its strip actually draws.
    assert.equal(defaultGroupDimensionFor(true, "development", true), "schoolTier");
  });

  it("groups a scoped menu by the game's own categories", () => {
    // Master's behaviour (4ce4ba5), restored after this branch had changed it
    // to "none". The argument for flat was measured against a panel showing
    // two tile rows; the panel is now 10 tiles wide with a height the player
    // drags, so the scrolling that argument was avoiding is not the cost it
    // was. The categories are the split the strip already puts in the player's
    // head, and grouping by them shows the whole menu at once.
    assert.equal(defaultGroupDimensionFor(true), "menuCategory");
  });

  it("only ever returns a dimension the picker offers", () => {
    for (const hasCategories of [false, true]) {
      for (const axis of ["", "development", "assetType", "nonsense"]) {
        assert.ok(GROUP_DIMENSIONS.some((d) => d.id === defaultGroupDimensionFor(hasCategories, axis)));
      }
    }
  });
});
```

And at ~673-677 (`opens the education menu on its levels`): change the four calls to `defaultGroupDimensionFor(true, "", true)`, `defaultGroupDimensionFor(true, "")`, `defaultGroupDimensionFor(false, "development")`, `defaultGroupDimensionFor(false, "assetType")`.

- [ ] **Step 7: Run everything and the type check**

Run: `just test findit-building-menu 2>&1 | grep -E "Passed!|Failed!|error CS|\[FAIL\]|# (pass|fail)|not ok"`
Expected: C# `Passed!` (all four `BindingManifestTests` green), TS `# fail 0`, with fewer TS tests than 626 — record the number.

Run: `cd cs2-findit-building-menu/FindIt/UI && npx tsc --noEmit -p . 2>&1 | tail -3`
Expected: no output.

Run: `grep -rn "BuildingLensSection\|BuildingLensSubCategory\|lensSectionCommand\|lensSubCategoryCommand\|SUBCATEGORY_ANY\|showZoning\|subCategoryCount" FindIt/UI/src`
Expected: nothing.

- [ ] **Step 8: Commit**

```bash
git add -A FindIt/UI/src FindIt/UI/test
git commit -m "refactor(findit): the chip row draws the menu and its category, nothing of the old taxonomy (cm-jjlv.6.3)"
```

---

### Task 4: Live verification, docs and beads

**Files:**
- Modify: `docs/verification.md` (append a dated section)

**Interfaces:**
- Consumes: the `[LENS-REFRESH]` log line (`Methods.cs`, `RefreshBuildingCatalog`), `Mod.Log` under `~/.local/share/Steam/steamapps/compatdata/949230/pfx/drive_c/users/steamuser/AppData/LocalLow/Colossal Order/Cities Skylines II/Logs/FindItBuildingMenu.log`, and the cs2-qa MCP (`cs2_status`, `cs2_save_load`, `cs2_query_load`, `cs2_ui_trigger`, `cs2_ui_read`, `cs2_mod_setting`).

- [ ] **Step 1: Build and deploy**

From the worktree root: `just build findit-building-menu 2>&1 | grep -E "Build succeeded|error|Error\(s\)"` then `just deploy-isolated findit-building-menu 2>&1 | tail -4`.
Expected: `Build succeeded`, `0 Error(s)`, deploy lists `FindItBuildingMenu.dll` and `.mjs` in both Mods roots.

- [ ] **Step 2: Launch from the MAIN checkout and load Porterville 3**

From `/var/home/gerbal/Games/CS-Modding`: confirm `just cs2-status` reads `no-game`, then `just launch-cs2 claude-swift-ocelot-gZs --headless --check-menu` (agent id FIRST — a flag first eats it). Then `cs2_status` → `cs2_save_load name="Porterville 3" expectAgent=claude-swift-ocelot-gZs` → poll `cs2_query_load` until `status` is `succeeded` (about five minutes headless).

- [ ] **Step 3: The four checks**

Read `toolbar.toolbarGroups` once with `cs2_ui_read` for the entity indices (on Porterville 3 last run: Roads 16933, Landscaping 16930, Health & Deathcare 16929, Zones 16936, Electricity 16926; re-read, do not trust these).

1. Menus: `toolbar.selectAssetMenu` each of Roads, Landscaping, Health & Deathcare, Zones, Electricity (with `toolbar.clearAssetSelection` between), then `FindItBuildingMenu.ClearBuildingLensMenuScope` for All menus. Read the `[LENS-REFRESH]` lines: Landscaping total must be 368 and the unscoped total 3,995 (phase 1's numbers on this save under `--no-steam`); record every other total.
2. Auto-widen: with Landscaping open, `cs2_mod_setting` `AutoWidenSearch` false, `FindItBuildingMenu.SearchChanged "zzzz"` → read `FindItBuildingMenu.BuildingCatalogMatchesElsewhere` (expect 0) and the `[LENS-REFRESH]` total (expect 0, `menu='Landscaping'`). Set `AutoWidenSearch` true, `SearchChanged "zzzz"` again → the next `[LENS-REFRESH]` has `menu=''` (scope released). Clear with `SearchChanged ""`.
3. Strip tab: open Electricity, read `FindItBuildingMenu.BuildingLensStripTabs` (id + count), fire `FindItBuildingMenu.SetBuildingLensStripTab <first id>` → `[LENS-REFRESH]` total equals that tab's count. Then open Zones, read `BuildingLensExpandedCategories` for a density tab id, fire `SetBuildingLensStripTab` with it → total equals its count.
4. Zones yield: `cs2_mod_setting` `ReplaceVanillaZonesMenu` false, `toolbar.selectAssetMenu` Zones, read `FindItBuildingMenu.LensOwnsCurrentMenu` → false. Set it back to true, select Zones again → true.

Also grep the mod log for `Exception` and `Search Failed` (expect none) and `UI.log` for errors after the load timestamp (expect none).

- [ ] **Step 4: Record it**

Append to `docs/verification.md` a section `## 2026-09-01 — one scoping taxonomy (phase 2)` with: the branch and commits, the suite counts from Task 3 Step 7, the exact `[LENS-REFRESH]` lines for the five menus and All menus, the auto-widen pair, the two strip-tab lines, the Zones-yield readings, and one paragraph listing what left (`VanillaBuildMenuTaxonomy`, `VanillaBuildMenuSelection`, `VanillaMenuPresets`, the query's `Category`/`SubCategory`/`BuildMenuSection`/`BuildMenuSubCategory`/`UnlockMilestone`/`StripAxis`, the six `BuildingLensSection*` bindings, the Section/Type chips) and the one thing that stayed against the review (`VanillaMenuAudit`, with the reason).

- [ ] **Step 5: Stop the game, close beads, commit**

From the main checkout: `just game-lock claude-swift-ocelot-gZs` if the launch released it, `just game-stop claude-swift-ocelot-gZs <Cities2.exe pid>` (pid from `pgrep -x Cities2.exe`, after checking `/proc/<pid>/environ` carries `CS2_AGENT=claude-swift-ocelot-gZs`), wait for exit, `just game-unlock claude-swift-ocelot-gZs`.

```bash
cd /var/home/gerbal/Games/CS-Modding
bd close cm-jjlv.6.1 cm-jjlv.6.2 cm-jjlv.6.3 cm-jjlv.6.4 --reason="phase 2 landed; see docs/verification.md 2026-09-01 phase-2 section"
bd close cm-jjlv.6 --reason="One scoping taxonomy: UiMenu/UiCategory only. Live-verified on Porterville 3."
```

Then in the worktree:

```bash
git add docs/verification.md
git commit -m "docs(findit): verify phase 2 live — the menu tree is the only scope (cm-jjlv.6.4)"
```

Then `just test findit-building-menu` once more on the tip, `git status` clean, and hand off to superpowers:finishing-a-development-branch (merge to master is authorized for tested branches; verify the merged tree; never force).
