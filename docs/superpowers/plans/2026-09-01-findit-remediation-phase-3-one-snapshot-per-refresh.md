# FindIt Remediation Phase 3 — One Snapshot Per Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A refresh projects nothing it projected last time and walks the scoped set once, with a stage breakdown on the `[LENS-REFRESH]` line that shows it.

**Architecture:** Task 1 adds the measurement (and the engine's single enumeration) and takes a live baseline. Task 2 makes the projection cache survive refreshes behind a generation counter. Task 3 moves every per-refresh derivation onto a memoised `CatalogView` built from one scoped pass; the adapter's public methods become delegations so nothing else moves. Task 4 measures again, on the same prefix.

**Tech Stack:** C# net48 / LangVersion 11 (mod), net10.0 xunit; `just` from the worktree root; `bd` from the MAIN checkout; live runs on prefix `949230-c` (CDP 9557) via the pinned bridge client.

**Spec:** `docs/superpowers/specs/2026-09-01-findit-remediation-phase-3-one-snapshot-per-refresh-design.md`.

## Global Constraints

- Worktree `/var/home/gerbal/Games/CS-Modding-wt/findit-remediation`, branch `findit/phase-3-one-snapshot` off `origin/master`. Paths relative to `cs2-findit-building-menu/`.
- Beads cm-jjlv.7 with children cm-jjlv.7.1–.4. `bd` from `/var/home/gerbal/Games/CS-Modding`; strip ANSI with `sed -r 's/\x1B\[[0-9;]*[mK]//g'`.
- Tests: `just test findit-building-menu 2>&1 | grep -E "Passed!|Failed!|error CS|# (pass|fail)|\[FAIL\]"`.
- Commit trailer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_013U8fzQAHmfdVdWfXLX2Eqv`.
- Live runs: `just deploy-isolated findit-building-menu 949230-c` (the bridge is already there), `just launch-cs2 claude-swift-ocelot-gZs --prefix 949230-c --cdp-port 9557 --no-steam --headless --check-menu`; stop with `CS2_PREFIX=949230-c CDP_URL=http://127.0.0.1:9557 just game-stop claude-swift-ocelot-gZs <pid>` after `just game-lock`; gate every launch on `grep -c "Error initializing mod" Modding.log` == 0. The acceptance script from phase 5 is at `/tmp/claude-1000/-var-home-gerbal-Games-CS-Modding/598d2088-3e68-4647-bd94-f0f2b9f36815/scratchpad/phase5-live.sh`; the driver at `.../scratchpad/qa9444.mjs` with `CS2_HTTP=http://127.0.0.1:9557`.
- Every derivation moved onto the view keeps its body verbatim except for the set it reads; the equivalence tests are the proof.
- Do not touch `Project`, `BuildingCatalogEntry`, `CategorizedPrefabs`, or the UI.

---

### Task 1: Stage breakdown, single enumeration, live baseline

**Files:**
- Modify: `FindIt/Services/BuildingCatalogQueryEngine.cs:71-75` (materialise `matching`)
- Modify: `FindIt/Services/BuildingCatalogAdapter.cs:1175-1196` (`LastProjectionMs`, `LastProjectionWasHit`)
- Modify: `FindIt/Systems/FindItUISystem.Methods.cs:47-140` (stopwatches, log line)
- Test: `FindItBuildingMenu.Tests/QueryEnumerationTests.cs` (create)

**Interfaces:**
- Produces: `BuildingCatalogAdapter.LastProjectionMs` (`int`), `LastProjectionWasHit` (`bool`) — reset by `BeginRefresh`, set by `ProjectForMenu`. Log format `[LENS-REFRESH] <total>ms proj=<ms>(hit|miss) page=<ms> bounds=<ms> facets=<ms> counts=<ms> axis=<ms> tabs=<ms> expanded=<ms> tiers=<ms> menu='…' total=… from=…`.

- [ ] **Step 1: Write the failing enumeration test**

Create `FindItBuildingMenu.Tests/QueryEnumerationTests.cs`:

```csharp
using System.Collections;
using System.Collections.Generic;
using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Services;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	public sealed class QueryEnumerationTests
	{
		/// <summary>Counts how many times it is walked; the walk itself is the fact under test.</summary>
		private sealed class Counting : IEnumerable<BuildingCatalogEntry>
		{
			private readonly BuildingCatalogEntry[] _items;
			public int Walks { get; private set; }
			public Counting(params BuildingCatalogEntry[] items) => _items = items;
			public IEnumerator<BuildingCatalogEntry> GetEnumerator() { Walks++; return ((IEnumerable<BuildingCatalogEntry>)_items).GetEnumerator(); }
			IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
		}

		private static BuildingCatalogEntry Entry(int id, string name, int cost) =>
			new(
				Id: id, PrefabName: name, Name: name, Category: "Buildings", SubCategory: "Buildings_Residential",
				Thumbnail: "", LotWidth: 2, LotDepth: 2, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsUniqueMesh: false, IsVanilla: true, PdxModsId: "") with { ConstructionCost = cost };

		[Fact]
		public void QueryWalksItsInputOnce()
		{
			// Count, order and the reorderable-column scan used to each re-run
			// Matches over a lazy Where: three full passes per page for one
			// answer. Materialised once, the count is free and the two scans
			// read an array.
			var source = new Counting(Entry(1, "A", 10), Entry(2, "B", 20), Entry(3, "C", 30));

			var page = BuildingCatalogQueryEngine.Query(source, new BuildingCatalogQuery(SortColumn: "ConstructionCost"));

			Assert.Equal(3, page.TotalCount);
			Assert.Equal(1, source.Walks);
		}
	}
}
```

- [ ] **Step 2: Run it — expect `Assert.Equal(1, 3)` failing** with `just test findit-building-menu 2>&1 | grep -E "QueryWalksItsInputOnce|Failed!|error CS"`.

- [ ] **Step 3: Materialise `matching`**

In `BuildingCatalogQueryEngine.Query` change

```csharp
			var matching = entries
				.Where(entry => Matches(entry, query))
				.Select(entry => NetworkMenuExtension.Reframe(entry, query.UiMenu));
			var totalCount = matching.Count();
```

to

```csharp
			// ONE pass. Count, Order and ReorderableSortColumns all read this,
			// and as a lazy Where each of them re-ran Matches over the whole
			// input — three passes per page, measured on the [LENS-REFRESH]
			// breakdown before this array existed.
			var matching = entries
				.Where(entry => Matches(entry, query))
				.Select(entry => NetworkMenuExtension.Reframe(entry, query.UiMenu))
				.ToArray();
			var totalCount = matching.Length;
```

Run the suite: `QueryWalksItsInputOnce` passes; everything else unchanged.

- [ ] **Step 4: Projection timing on the adapter**

In `BuildingCatalogAdapter`, above `BeginRefresh`, add:

```csharp
		/// <summary>How long the last <see cref="ProjectForMenu"/> took, and whether it was served from cache.</summary>
		/// <remarks>Read by FindItUISystem for the [LENS-REFRESH] breakdown. Reset by <see cref="BeginRefresh"/>.</remarks>
		public int LastProjectionMs { get; private set; }
		public bool LastProjectionWasHit { get; private set; } = true;
```

`BeginRefresh` becomes `public void BeginRefresh() { _projections.Clear(); LastProjectionMs = 0; LastProjectionWasHit = true; }`. In `ProjectForMenu`, the cache hit path stays; the miss path becomes:

```csharp
			var timer = System.Diagnostics.Stopwatch.StartNew();
			var built = ProjectForMenuUncached(menu, contentDlcs).ToArray();
			_projections[key] = built;
			LastProjectionMs += (int)timer.ElapsedMilliseconds;
			LastProjectionWasHit = false;
```

- [ ] **Step 5: Stage stopwatches in `RefreshBuildingCatalog`**

Add a local helper at the top of the method, after `refreshTimer`:

```csharp
			// Per-stage cost, for the breakdown on the log line. A refresh used
			// to be one number, which said that it was slow and nothing about
			// where; cm-jjlv.7 exists to move the where.
			var stage = System.Diagnostics.Stopwatch.StartNew();
			int Lap() { var ms = (int)stage.ElapsedMilliseconds; stage.Restart(); return ms; }
```

Then wrap: `BuildingCatalogPage page = …Query(...)` → `var pageMs = Lap();` after it (and after the `MatchesElsewhere` block, fold both into `pageMs` by placing `Lap()` after the `_BuildingCatalogMatchesElsewhere.Value = …;` statement — note the early `SearchEverything(); return;` above it exits before logging, which is fine). Then after each of `_BuildingCatalogMetricBounds.Value = …;` → `var boundsMs = Lap();`, `_BuildingLensFacets.Value = …;` → `facetsMs`, `_BuildingLensMenuCategoryCounts.Value = …;` → `countsMs`, `_BuildingLensStripAxisBinding.Value = …;` → `axisMs`, `_BuildingLensStripTabs.Value = …;` → `tabsMs`, `_BuildingLensExpandedCategories.Value = …;` → `expandedMs`, `_BuildingLensMenuSchoolTierCounts.Value = …;` → `tiersMs`. Insert `stage.Restart();` immediately before `BuildingCatalogPage page = …` so the query-build lines above are not charged to the page.

Replace the log line with:

```csharp
			Mod.Log.Info(
				$"[LENS-REFRESH] {(int)refreshTimer.ElapsedMilliseconds}ms "
				+ $"proj={_buildingCatalogAdapter.LastProjectionMs}ms({(_buildingCatalogAdapter.LastProjectionWasHit ? "hit" : "miss")}) "
				+ $"page={pageMs} bounds={boundsMs} facets={facetsMs} counts={countsMs} axis={axisMs} tabs={tabsMs} expanded={expandedMs} tiers={tiersMs} "
				+ $"menu='{_buildingCatalogQuery.UiMenu}' total={page.TotalCount} from={caller}");
```

Build: `just build findit-building-menu 2>&1 | grep -E "Build succeeded|error CS"`.

- [ ] **Step 6: Live baseline on 949230-c**

Deploy to `949230-c`, cycle the game there, load Porterville 3, open Roads, Landscaping, Health & Deathcare, Zones, Electricity, then All menus (the phase-5 script does exactly this), and additionally: open Landscaping, fire `FindItBuildingMenu.SearchChanged "tre"` then `"tree"` (two keystrokes), then `""`. Copy every `[LENS-REFRESH]` line into a scratch file — these are the before-numbers for Task 4. Expected shape: every line reads `(miss)`, `proj` is the largest field on the unscoped line, `axis`+`tabs`+`expanded` together rival `page`.

- [ ] **Step 7: Commit**

```bash
git add FindIt/Services FindIt/Systems/FindItUISystem.Methods.cs FindItBuildingMenu.Tests/QueryEnumerationTests.cs
git commit -m "perf(findit): the query walks its input once, and the refresh line says where the time goes (cm-jjlv.7.1)"
```

---

### Task 2: Index generation and a cache that survives refreshes

**Files:**
- Create: `FindIt/Services/SnapshotCache.cs`
- Modify: `FindIt/Systems/PrefabIndexingSystem.cs` (`IndexGeneration`; three bumps), `FindIt/Services/BuildingCatalogAdapter.cs` (`_projections` → cache; `GetFacetState` pack scope), `FindIt/Systems/FindItUISystem.Methods.cs:49` (`BeginRefresh` stays for now)
- Test: `FindItBuildingMenu.Tests/SnapshotCacheTests.cs` (create)

**Interfaces:**
- Produces: `PrefabIndexingSystem.IndexGeneration` (`public static int`, starts 1). `SnapshotKey` (`readonly record struct`) with `static SnapshotKey For(string? menu, IReadOnlyList<string>? dlcUnion, bool ignorePacks, VanillaToolbarSelection selection)`. `SnapshotCache` with `bool TryGet(SnapshotKey key, int generation, out BuildingCatalogEntry[] entries)`, `void Put(SnapshotKey key, int generation, BuildingCatalogEntry[] entries)`, `int Count`.

- [ ] **Step 1: Failing tests**

Create `FindItBuildingMenu.Tests/SnapshotCacheTests.cs`:

```csharp
using System;
using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Services;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	public sealed class SnapshotCacheTests
	{
		private static readonly BuildingCatalogEntry[] Some = Array.Empty<BuildingCatalogEntry>();

		[Fact]
		public void TheSameKeyAndGenerationHits()
		{
			var cache = new SnapshotCache();
			var key = SnapshotKey.For("Roads", null, false, VanillaToolbarSelection.None);

			cache.Put(key, 3, Some);

			Assert.True(cache.TryGet(key, 3, out var hit));
			Assert.Same(Some, hit);
		}

		[Fact]
		public void ADifferentKeyMisses()
		{
			var cache = new SnapshotCache();
			cache.Put(SnapshotKey.For("Roads", null, false, VanillaToolbarSelection.None), 3, Some);

			Assert.False(cache.TryGet(SnapshotKey.For("Zones", null, false, VanillaToolbarSelection.None), 3, out _));
			Assert.False(cache.TryGet(SnapshotKey.For("Roads", null, true, VanillaToolbarSelection.None), 3, out _));
			Assert.False(cache.TryGet(SnapshotKey.For("Roads", new[] { "1" }, false, VanillaToolbarSelection.None), 3, out _));
		}

		[Fact]
		public void ANewGenerationMissesAndEmptiesTheCache()
		{
			// The index changed under every snapshot at once: a re-index, an
			// unlock, a unique being built. Nothing cached can be trusted, so
			// nothing is kept — a stale entry for a menu the player visits
			// later is the bug this exists to prevent.
			var cache = new SnapshotCache();
			var roads = SnapshotKey.For("Roads", null, false, VanillaToolbarSelection.None);
			var zones = SnapshotKey.For("Zones", null, false, VanillaToolbarSelection.None);
			cache.Put(roads, 3, Some);
			cache.Put(zones, 3, Some);

			Assert.False(cache.TryGet(roads, 4, out _));
			Assert.Equal(0, cache.Count);
			Assert.False(cache.TryGet(zones, 4, out _));
		}

		[Fact]
		public void TheToolbarSelectionIsComparedByValue()
		{
			// VanillaToolbarSelection is a struct holding lists, so struct
			// equality would compare list references and every refresh would
			// miss. The key spells the lists out.
			var a = new VanillaToolbarSelection(new[] { 5, 9 }, new[] { 2 }, true, false);
			var b = new VanillaToolbarSelection(new[] { 5, 9 }, new[] { 2 }, true, false);
			var c = new VanillaToolbarSelection(new[] { 5, 9 }, new[] { 3 }, true, false);

			Assert.Equal(SnapshotKey.For("Roads", null, false, a), SnapshotKey.For("Roads", null, false, b));
			Assert.NotEqual(SnapshotKey.For("Roads", null, false, a), SnapshotKey.For("Roads", null, false, c));
		}
	}
}
```

Run: fails to compile (`SnapshotCache` missing).

- [ ] **Step 2: `SnapshotCache.cs`**

```csharp
using System.Collections.Generic;
using System.Linq;
using FindItBuildingMenu.Domain;

namespace FindItBuildingMenu.Services
{
	/// <summary>
	/// Everything that decides what a projected snapshot contains.
	/// </summary>
	/// <remarks>
	/// The toolbar selection is spelled out as strings because
	/// <see cref="VanillaToolbarSelection"/> is a struct holding lists, and
	/// struct equality compares those by reference — every refresh would miss.
	/// The index generation is NOT part of the key: it is the cache's own
	/// clock, and a new generation empties the cache rather than filing a new
	/// entry beside a stale one.
	/// </remarks>
	public readonly record struct SnapshotKey(
		string Menu,
		string DlcUnion,
		bool IgnorePacks,
		string Themes,
		string Packs,
		bool VanillaSelected,
		bool ModsSelected)
	{
		public static SnapshotKey For(
			string? menu,
			IReadOnlyList<string>? dlcUnion,
			bool ignorePacks,
			VanillaToolbarSelection selection) =>
			new(
				menu?.Trim() ?? string.Empty,
				dlcUnion is null ? "*" : string.Join(",", dlcUnion),
				ignorePacks,
				string.Join(",", selection.SelectedThemes),
				string.Join(",", selection.SelectedPacks),
				selection.VanillaSelected,
				selection.ModsSelected);
	}

	/// <summary>
	/// Projected snapshots that survive from one refresh to the next.
	/// </summary>
	/// <remarks>
	/// The projection used to be cleared at the top of every refresh, so it
	/// deduplicated the eight questions one refresh asks and cached nothing
	/// across a keystroke. This holds each scope's projection until the index
	/// itself changes (PrefabIndexingSystem.IndexGeneration), which is the
	/// only event that can make a projected entry wrong.
	/// </remarks>
	public sealed class SnapshotCache
	{
		private readonly Dictionary<SnapshotKey, BuildingCatalogEntry[]> _entries = new();
		private int _generation = -1;

		public int Count => _entries.Count;

		public bool TryGet(SnapshotKey key, int generation, out BuildingCatalogEntry[] entries)
		{
			if (generation != _generation)
			{
				_entries.Clear();
				_generation = generation;
			}

			return _entries.TryGetValue(key, out entries!);
		}

		public void Put(SnapshotKey key, int generation, BuildingCatalogEntry[] entries)
		{
			if (generation != _generation)
			{
				_entries.Clear();
				_generation = generation;
			}

			_entries[key] = entries;
		}
	}
}
```

Run: the four tests pass.

- [ ] **Step 3: The generation counter**

`PrefabIndexingSystem`: add near the other statics

```csharp
		/// <summary>
		/// Bumped whenever an indexed fact changes: a re-index, an unlock, a
		/// unique built or bulldozed. The catalog's snapshot cache is keyed on
		/// it, so a stale projection cannot outlive the change that staled it.
		/// </summary>
		public static int IndexGeneration { get; private set; } = 1;
```

and `IndexGeneration++;` (a) in `RunIndex` immediately before `_finditUISystem.TriggerSearch();` (the one after `FindItUtil.IsReady = true;`), (b) in `ApplyUnlocks` immediately before its `_finditUISystem.TriggerSearch();`, (c) in `OnUniqueAssetStatusChanged` immediately before `_finditUISystem?.RefreshBuildingCatalogFromIndexing();`.

- [ ] **Step 4: The adapter uses the cache**

Replace the `_projections` field with `private readonly SnapshotCache _snapshots = new();`. `BeginRefresh()` becomes `LastProjectionMs = 0; LastProjectionWasHit = true;` only (no clear). Replace `ProjectForMenu` with:

```csharp
		private BuildingCatalogEntry[] ProjectForMenu(
			string? menu,
			IReadOnlyList<string>? contentDlcs = null,
			bool ignorePacks = false)
		{
			var key = SnapshotKey.For(menu, contentDlcs, ignorePacks, ToolbarSelection);

			if (_snapshots.TryGet(key, PrefabIndexingSystem.IndexGeneration, out var cached))
			{
				return cached;
			}

			var timer = System.Diagnostics.Stopwatch.StartNew();
			var built = ProjectForMenuUncached(menu, contentDlcs, ignorePacks).ToArray();
			_snapshots.Put(key, PrefabIndexingSystem.IndexGeneration, built);
			LastProjectionMs += (int)timer.ElapsedMilliseconds;
			LastProjectionWasHit = false;

			return built;
		}
```

`ProjectForMenuUncached` gains the `bool ignorePacks` parameter and passes it: `GetIndexedBuildings(menu, ignorePackSelection: ignorePacks, unionDlcIds: contentDlcs)`. `GetFacetState`'s third argument becomes

```csharp
				// Packs alone are counted before the pack filter runs, because
				// that filter is upstream of InScope and InScope cannot undo it.
				// Only a second snapshot when a pack IS selected; otherwise the
				// pack scope is the ordinary one and costs nothing.
				BuildingCatalogQueryEngine.InScope(
					ToolbarSelection.SelectedPacks.Count > 0
						? ProjectForMenu(query.UiMenu, query.DlcIds, ignorePacks: true)
						: ProjectForMenu(query.UiMenu, query.DlcIds),
					query));
```

Run the suite (green). `grep -n "_projections" FindIt/Services/BuildingCatalogAdapter.cs` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add FindIt/Services FindIt/Systems/PrefabIndexingSystem.cs FindItBuildingMenu.Tests/SnapshotCacheTests.cs
git commit -m "perf(findit): the projection survives refreshes, invalidated by an index generation counter (cm-jjlv.7.2)"
```

---

### Task 3: `CatalogView` — one scoped pass, memoised derivations

**Files:**
- Create: `FindIt/Services/CatalogView.cs`
- Modify: `FindIt/Services/BuildingCatalogAdapter.cs` (public methods delegate; `TabIcon`, `MilestoneIcon`, `SchoolTierIcon` become `internal static`), `FindIt/Systems/FindItUISystem.Methods.cs` (`Build` once)
- Test: `FindItBuildingMenu.Tests/CatalogViewTests.cs` (create)

**Interfaces:**
- Produces: `CatalogView(BuildingCatalogEntry[] snapshot, BuildingCatalogQuery query, Func<BuildingCatalogEntry[]>? packScope = null)` with properties `MenuSet`, `ViewSet`, `TabSet`, `TierSet` (`BuildingCatalogEntry[]`), `Page`, `MetricBounds`, `FacetState`, `MenuCategoryCounts`, `ExpandedCategoryId`, `ExpandedCategoryTabs`, `ExpandedCategories`, `StripAxis`, `StripTabs`, `SchoolTierCounts`. `BuildingCatalogAdapter.Build(BuildingCatalogQuery)`.

- [ ] **Step 1: Failing equivalence tests**

Create `FindItBuildingMenu.Tests/CatalogViewTests.cs`. Fixture: six entries — two Roads-menu networks in categories `RoadsSmallRoads`/`RoadsHighways` with `DevTreeBranch` `"Basic"`/`"Highways"` and depths 0/1, three Electricity buildings (one category, branches `"Electricity"`, `"Electricity"`, `"Gas Power Plant"` with `Capacity` 10/20/30 and `EducationLevel` null), one school in `Education & Research` with `EducationLevel = 2`. Build them with the same positional constructor the engine tests use (`Entry(...)` copied from `BuildingCatalogQueryEngineTests`, then `with { UiMenu = ..., UiCategory = ..., DevTreeBranch = ..., DevTreeBranchDepth = ..., Capacity = ..., EducationLevel = ... }`). Then:

```csharp
		[Fact]
		public void TheViewAnswersWhatTheAdapterUsedToAnswer_MenuSetsFirst()
		{
			var query = new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsHighways", StripTabs: new[] { "Highways" });
			var view = new CatalogView(Fixture, query);

			// MenuSet is the menu with category/tab/tier cleared; ViewSet applies them.
			Assert.Equal(
				BuildingCatalogQueryEngine.InScope(Fixture, query with { UiCategory = "", StripTabs = null, SchoolTier = -1 }).Select(e => e.Id).ToArray(),
				view.MenuSet.Select(e => e.Id).ToArray());
			Assert.Equal(
				BuildingCatalogQueryEngine.InScope(Fixture, query).Select(e => e.Id).ToArray(),
				view.ViewSet.Select(e => e.Id).ToArray());
			Assert.Equal(
				BuildingCatalogQueryEngine.InScope(Fixture, query with { StripTabs = null }).Select(e => e.Id).ToArray(),
				view.TabSet.Select(e => e.Id).ToArray());
		}

		[Fact]
		public void PageBoundsAndFacetsComeFromTheSameSetsTheAdapterUsed()
		{
			var query = new BuildingCatalogQuery(UiMenu: "Electricity", MinCapacity: 15);
			var view = new CatalogView(Fixture, query);

			Assert.Equal(BuildingCatalogQueryEngine.Query(Fixture, query).Items.Select(e => e.Id), view.Page.Items.Select(e => e.Id));
			Assert.Equal(BuildingCatalogAdapter.MetricBoundsOf(BuildingCatalogQueryEngine.InScope(Fixture, query)), view.MetricBounds);
			Assert.Equal(
				BuildingCatalogAdapter.BuildFacetState(BuildingCatalogQueryEngine.InScope(Fixture, query), query, BuildingCatalogQueryEngine.InScope(Fixture, query)).Groups.Select(g => g.Id),
				view.FacetState.Groups.Select(g => g.Id));
		}

		[Fact]
		public void CountsStripAndTiersMatchTheOldDerivations()
		{
			var roads = new CatalogView(Fixture, new BuildingCatalogQuery(UiMenu: "Roads"));
			Assert.Equal(new[] { ("RoadsHighways", 1), ("RoadsSmallRoads", 1) }, roads.MenuCategoryCounts.Select(c => (c.Id, c.Count)).ToArray());
			// Two categories, neither with two branches: no expanded category, no axis.
			Assert.Equal(string.Empty, roads.ExpandedCategoryId);
			Assert.Equal(string.Empty, roads.StripAxis);

			var electricity = new CatalogView(Fixture, new BuildingCatalogQuery(UiMenu: "Electricity"));
			// One category, two branches: the development axis, tabs by depth then name.
			Assert.Equal(StripAxes.Development, electricity.StripAxis);
			Assert.Equal(new[] { ("Electricity", 2), ("Gas Power Plant", 1) }, electricity.StripTabs.Select(t => (t.Id, t.Count)).ToArray());

			var education = new CatalogView(Fixture, new BuildingCatalogQuery(UiMenu: "Education & Research"));
			Assert.Equal(new[] { ("2", 1) }, education.SchoolTierCounts.Select(t => (t.Id, t.Count)).ToArray());
		}

		[Fact]
		public void EveryPropertyWalksTheSnapshotOnce()
		{
			// The whole point: fifteen passes per refresh become one over the
			// snapshot plus cheap passes over the (much smaller) menu set.
			var counting = new CountingList(Fixture);
			var view = new CatalogView(counting.Items, new BuildingCatalogQuery(UiMenu: "Electricity"), packScope: null);
			_ = view.Page; _ = view.MetricBounds; _ = view.FacetState; _ = view.MenuCategoryCounts;
			_ = view.StripAxis; _ = view.StripTabs; _ = view.ExpandedCategories; _ = view.SchoolTierCounts;
			_ = view.StripAxis; _ = view.MenuCategoryCounts;

			Assert.Equal(1, counting.Walks);
		}
```

(`CountingList` wraps the array in an `IEnumerable` that counts `GetEnumerator` calls and exposes it as `Items` typed `BuildingCatalogEntry[]`? No — `CatalogView` takes an array, so counting has to happen at the `MenuSet` boundary instead: make `CatalogView` accept `IReadOnlyList<BuildingCatalogEntry>` and count enumerations of a list wrapper. Use that signature throughout: `IReadOnlyList<BuildingCatalogEntry> snapshot`.)

Run: fails to compile.

- [ ] **Step 2: `CatalogView.cs`**

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using FindItBuildingMenu.Domain;

namespace FindItBuildingMenu.Services
{
	/// <summary>
	/// Every answer one refresh needs, from one pass over the snapshot.
	/// </summary>
	/// <remarks>
	/// The adapter used to answer eight questions per refresh and start each
	/// from the projected snapshot with a full InScope pass — fifteen to
	/// twenty passes, and GetStripAxis alone reached GetMenuCategoryCounts
	/// through three chains. Here the snapshot is scoped to the menu ONCE
	/// (<see cref="MenuSet"/>); everything else is a pass over that much
	/// smaller array, and every property is computed once and kept.
	///
	/// The derivations are the adapter's old bodies, verbatim except for the
	/// set they read; CatalogViewTests holds each against the static helper
	/// it replaces.
	/// </remarks>
	public sealed class CatalogView
	{
		private readonly IReadOnlyList<BuildingCatalogEntry> _snapshot;
		private readonly BuildingCatalogQuery _query;
		private readonly Func<IReadOnlyList<BuildingCatalogEntry>>? _packScope;

		private BuildingCatalogEntry[]? _menuSet, _viewSet, _tabSet, _tierSet;
		private BuildingCatalogPage? _page;
		private BuildingCatalogMetricRangeState? _bounds;
		private BuildingCatalogFacetState? _facets;
		private IReadOnlyList<MenuCategoryCount>? _counts;
		private string? _expandedId, _axis;
		private IReadOnlyList<MenuBranchCount>? _expandedTabs, _stripTabs, _tiers;
		private IReadOnlyList<MenuCategoryTabs>? _expanded;

		public CatalogView(
			IReadOnlyList<BuildingCatalogEntry> snapshot,
			BuildingCatalogQuery query,
			Func<IReadOnlyList<BuildingCatalogEntry>>? packScope = null)
		{
			_snapshot = snapshot ?? throw new ArgumentNullException(nameof(snapshot));
			_query = query ?? throw new ArgumentNullException(nameof(query));
			_packScope = packScope;
		}

		/// <summary>The menu, with category, strip tab and school tier cleared. The one pass over the snapshot.</summary>
		public BuildingCatalogEntry[] MenuSet => _menuSet ??=
			BuildingCatalogQueryEngine.InScope(_snapshot, _query with { UiCategory = string.Empty, StripTabs = null, SchoolTier = -1 }).ToArray();

		/// <summary>What the page is drawn from: menu, category, tab and tier, facets cleared.</summary>
		public BuildingCatalogEntry[] ViewSet => _viewSet ??= BuildingCatalogQueryEngine.InScope(MenuSet, _query).ToArray();

		/// <summary>Menu, category and tier, but no strip tab — what the strip counts.</summary>
		public BuildingCatalogEntry[] TabSet => _tabSet ??= BuildingCatalogQueryEngine.InScope(MenuSet, _query with { StripTabs = null }).ToArray();

		/// <summary>Menu and strip tab, no category or tier — what the school tiers count.</summary>
		public BuildingCatalogEntry[] TierSet => _tierSet ??= BuildingCatalogQueryEngine.InScope(MenuSet, _query with { SchoolTier = -1, UiCategory = string.Empty }).ToArray();

		public BuildingCatalogPage Page => _page ??= BuildingCatalogQueryEngine.Query(MenuSet, _query);

		public BuildingCatalogMetricRangeState MetricBounds => _bounds ??= BuildingCatalogAdapter.MetricBoundsOf(ViewSet);

		public BuildingCatalogFacetState FacetState => _facets ??= BuildingCatalogAdapter.BuildFacetState(
			ViewSet,
			_query,
			_packScope is null ? ViewSet : BuildingCatalogQueryEngine.InScope(_packScope(), _query));

		public IReadOnlyList<MenuCategoryCount> MenuCategoryCounts => _counts ??= MenuSet
			.GroupBy(entry => NetworkMenuExtension.EffectiveCategory(entry, _query.UiMenu) ?? string.Empty)
			.Select(group => new MenuCategoryCount(group.Key, group.Count()))
			.OrderBy(count => count.Id, StringComparer.Ordinal)
			.ToArray();

		public string ExpandedCategoryId => _expandedId ??= ComputeExpandedCategoryId();

		private string ComputeExpandedCategoryId()
		{
			if (MenuCategoryCounts.Count(category => category.Id.Length > 0) < 2)
			{
				return string.Empty;
			}

			return MenuSet
				.Where(entry => !string.IsNullOrEmpty(entry.DevTreeBranch))
				.GroupBy(entry => NetworkMenuExtension.EffectiveCategory(entry, _query.UiMenu) ?? string.Empty)
				.Where(group => group.Key.Length > 0
					&& group.Select(entry => entry.DevTreeBranch).Distinct(StringComparer.Ordinal).Count() > 1)
				.OrderByDescending(group => group.Count())
				.ThenBy(group => group.Key, StringComparer.Ordinal)
				.Select(group => group.Key)
				.FirstOrDefault() ?? string.Empty;
		}

		public IReadOnlyList<MenuBranchCount> ExpandedCategoryTabs => _expandedTabs ??= ComputeExpandedCategoryTabs();

		private IReadOnlyList<MenuBranchCount> ComputeExpandedCategoryTabs()
		{
			var category = ExpandedCategoryId;

			if (category.Length == 0)
			{
				return Array.Empty<MenuBranchCount>();
			}

			// withinCategory = query with { UiCategory = category, StripTabs = null }: the
			// menu set narrowed to that category, tier kept.
			return BuildingCatalogQueryEngine
				.InScope(MenuSet, _query with { UiCategory = category, StripTabs = null })
				.Where(entry => !string.IsNullOrEmpty(entry.DevTreeBranch))
				.GroupBy(entry => entry.DevTreeBranch!)
				.OrderBy(group => group.Min(entry => entry.DevTreeBranchDepth))
				.ThenBy(group => group.Key, StringComparer.Ordinal)
				.Select(group => new MenuBranchCount(
					group.Key,
					group.Count(),
					BuildingCatalogAdapter.TabIcon(group, authored: true)))
				.ToArray();
		}

		public IReadOnlyList<MenuCategoryTabs> ExpandedCategories => _expanded ??= ComputeExpandedCategories();

		private IReadOnlyList<MenuCategoryTabs> ComputeExpandedCategories()
		{
			var density = BuildingCatalogAdapter.BuildDensityTabs(MenuSet, _query.UiMenu);

			if (density.Count > 0)
			{
				return density;
			}

			var branchCategory = ExpandedCategoryId;

			return branchCategory.Length == 0
				? Array.Empty<MenuCategoryTabs>()
				: new[] { new MenuCategoryTabs(branchCategory, ExpandedCategoryTabs.ToArray()) };
		}

		public string StripAxis => _axis ??= ComputeStripAxis();

		private string ComputeStripAxis()
		{
			if (MenuCategoryCounts.Count(category => category.Id.Length > 0) > 1)
			{
				return ExpandedCategoryId.Length > 0 ? StripAxes.Development : string.Empty;
			}

			var best = string.Empty;
			var bestLargest = int.MaxValue;

			foreach (var axis in new[] { StripAxes.Development, StripAxes.AssetType })
			{
				var tabs = StripTabsFor(TabSet, axis);

				if (tabs.Count < 2)
				{
					continue;
				}

				var largest = tabs.Max(tab => tab.Count);

				if (largest < bestLargest)
				{
					best = axis;
					bestLargest = largest;
				}
			}

			return best;
		}

		public IReadOnlyList<MenuBranchCount> StripTabs => _stripTabs ??= ComputeStripTabs();

		private IReadOnlyList<MenuBranchCount> ComputeStripTabs()
		{
			var axis = StripAxis;

			if (axis.Length == 0)
			{
				return Array.Empty<MenuBranchCount>();
			}

			var tabs = StripTabsFor(TabSet, axis);

			if (axis != StripAxes.AssetType)
			{
				return tabs;
			}

			// The old code re-queried with StripTabs = [Buildings]; that is the
			// tab set narrowed to entries answering to the Buildings tab.
			var buildingNodes = StripTabsFor(
				TabSet.Where(entry => BuildingCatalogQueryEngine.StripMatches(entry, StripAxes.BuildingValue)).ToArray(),
				StripAxes.Development);

			if (buildingNodes.Count < 2)
			{
				return tabs;
			}

			return buildingNodes
				.Concat(tabs.Where(tab => tab.Id != StripAxes.BuildingValue))
				.ToArray();
		}

		private static IReadOnlyList<MenuBranchCount> StripTabsFor(IEnumerable<BuildingCatalogEntry> set, string axis) =>
			set
				.GroupBy(entry => BuildingCatalogQueryEngine.StripValue(entry, axis))
				.Where(group => group.Key.Length > 0)
				.Select(group => new
				{
					Tab = new MenuBranchCount(
						group.Key,
						group.Count(),
						BuildingCatalogAdapter.TabIcon(group, axis == StripAxes.Development)),
					Depth = group.Min(entry => entry.DevTreeBranchDepth),
				})
				.OrderBy(x => axis == StripAxes.Development ? x.Depth : 0)
				.ThenByDescending(x => axis == StripAxes.Development ? 0 : x.Tab.Count)
				.ThenBy(x => x.Tab.Id, StringComparer.Ordinal)
				.Select(x => x.Tab)
				.ToArray();

		public IReadOnlyList<MenuBranchCount> SchoolTierCounts => _tiers ??= TierSet
			.Where(entry => entry.EducationLevel is >= 1 and <= 4)
			.GroupBy(entry => entry.EducationLevel!.Value)
			.Select(group => new MenuBranchCount(
				group.Key.ToString(System.Globalization.CultureInfo.InvariantCulture),
				group.Count(),
				BuildingCatalogAdapter.SchoolTierIcon))
			.OrderBy(count => count.Id, StringComparer.Ordinal)
			.ToArray();
	}
}
```

Read the adapter's current `StripTabsFor` ordering/`TabIcon` call and `GetExpandedCategoryTabs` before pasting: the bodies above must match them line for line except for the source set — fix any drift toward the adapter, not away from it.

- [ ] **Step 3: The adapter delegates**

In `BuildingCatalogAdapter`: make `TabIcon`, `MilestoneIcon` `internal static` and `SchoolTierIcon` `internal const`. Add:

```csharp
		/// <summary>One view per refresh: every answer below comes from it.</summary>
		public CatalogView Build(BuildingCatalogQuery query)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			var snapshot = ProjectForMenu(query.UiMenu, query.DlcIds);

			return new CatalogView(
				snapshot,
				query,
				ToolbarSelection.SelectedPacks.Count > 0
					? () => ProjectForMenu(query.UiMenu, query.DlcIds, ignorePacks: true)
					: null);
		}
```

Replace the bodies of `Query`, `GetMetricBounds`, `GetFacetState`, `GetMenuCategoryCounts`, `GetExpandedCategoryId`, `GetExpandedCategoryTabs`, `GetExpandedCategories`, `GetStripAxis`, `GetStripTabs`, `GetMenuSchoolTierCounts` with `=> Build(query).<Property>;` (keeping their null checks inside `Build`). Delete the now-private `StripTabsFor` and the `acrossCategories`/`unscoped`/`withinCategory`/`acrossTabs`/`acrossTiers` locals with them. Keep the doc comments on the public methods; add one line to each: `/// <remarks>Delegates to <see cref="Build"/>; see CatalogView.</remarks>`.

`FindItUISystem.RefreshBuildingCatalog`: after the window clamp, `var view = _buildingCatalogAdapter.Build(_buildingCatalogQuery);` and read `view.Page`, `view.MetricBounds`, `view.FacetState`, `view.MenuCategoryCounts`, `view.StripAxis`, `view.StripTabs`, `view.ExpandedCategories`, `view.SchoolTierCounts` in place of the adapter calls (the stopwatch laps stay). `MatchesElsewhere` becomes `_buildingCatalogAdapter.Build(_buildingCatalogQuery with { UiMenu = string.Empty, Offset = 0 }).Page.TotalCount`.

Run the suite: green, `CatalogViewTests` included. `grep -n "StripTabsFor\|acrossCategories\|acrossTiers" FindIt/Services/BuildingCatalogAdapter.cs` prints nothing.

- [ ] **Step 4: Commit**

```bash
git add FindIt/Services FindIt/Systems/FindItUISystem.Methods.cs FindItBuildingMenu.Tests/CatalogViewTests.cs
git commit -m "perf(findit): one scoped pass per refresh — CatalogView memoises what the adapter recomputed fifteen times (cm-jjlv.7.3)"
```

---

### Task 4: Measure again, record, close

**Files:**
- Modify: `docs/verification.md`

- [ ] **Step 1: Live after-run** — same prefix, same save, same sequence as Task 1 Step 6 (five menus, All menus, `tre`/`tree`/`""` inside Landscaping), plus reopen Landscaping a second time. Expected: first refresh of each menu `(miss)` with `proj` unchanged from Task 1; the second refresh and every keystroke `proj=0ms(hit)`; `axis+tabs+expanded` collapse to a few ms; totals identical to phase 5 (Roads 403, Landscaping 522, Health & Deathcare 31, Zones 74, Electricity 17, All 10,536); All menus second refresh under 150 ms; zero exceptions; `Error initializing mod` 0.

- [ ] **Step 2: Record** — `## 2026-09-01 — one snapshot per refresh (phase 3)` in `docs/verification.md`: the before/after breakdown lines side by side for each action, the totals, and the cache behaviour (what invalidates it). Stop the game, release the lock.

- [ ] **Step 3: Beads and commit**

```bash
cd /var/home/gerbal/Games/CS-Modding && bd close cm-jjlv.7.1 cm-jjlv.7.2 cm-jjlv.7.3 cm-jjlv.7.4 --reason="phase 3 landed" && bd close cm-jjlv.7 --reason="…numbers…" && bd comment cm-2xvs.25 "…the after-number for the reopen…"
git add docs/verification.md && git commit -m "docs(findit): verify phase 3 live — before/after stage breakdown on the same prefix (cm-jjlv.7.4)"
```

Then the suite on the tip, `git status` clean, superpowers:finishing-a-development-branch (merge authorized; verify the merged tree; never force).
