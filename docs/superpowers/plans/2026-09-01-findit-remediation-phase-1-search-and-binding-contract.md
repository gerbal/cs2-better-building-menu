# FindIt Remediation, Phase 1: Search Path and Binding Contract — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make lens search cost one catalog refresh instead of a discarded 2.7 s fuzzy scan, and put a test on the C#↔TS binding boundary that names every orphan on either side — then delete the orphans it names.

**Architecture:** The lens's search predicate is a plain `Contains` in `BuildingCatalogQueryEngine`; the off-thread `ProcessSearch` worker that `SearchChanged` currently waits on writes `_cachedSearch`, which nothing on the lens path reads. Task 1 replaces the worker with a main-thread deadline (`SearchDebounce`, a pure class polled from `OnUpdate`) so the refresh runs 250 ms after the last keystroke with no thread, no token and no flag. Task 2 adds an xunit test that reads `Systems/*.cs` and `UI/src/**` as text and diffs the two sets of binding names; Tasks 3–4 delete what it flags. Task 5 verifies live and closes the beads.

**Tech Stack:** C# (.NET Framework 4.8 mod, `LangVersion` 11; tests on net10.0 xunit via `FindItBuildingMenu.Tests`), TypeScript React UI under `FindIt/UI` (`node --test`), `just` recipes at the repo root.

**Spec:** `docs/superpowers/specs/2026-09-01-architecture-review.md` — findings 1, 5 and the parts of 7 and 9 they touch; recommendation items 1 and 2. Later phases (items 3–8) get their own plans; this one must leave the mod shippable on its own.

## Global Constraints

- All work happens in the worktree `/var/home/gerbal/Games/CS-Modding-wt/findit-remediation` on branch `findit/architecture-remediation`. Game launches and `bd` commands run from the main checkout `/var/home/gerbal/Games/CS-Modding` (the worktree cannot discover the Dolt port).
- `net48` + `LangVersion 11`: no list patterns, no `Environment.TickCount64`, no `TimeProvider`. `System.Diagnostics.Stopwatch` is fine.
- The whole C# + TS suite must stay green after every task: `just test findit-building-menu` from the worktree root (428 C# / 630 TS today; the counts go DOWN in Tasks 1, 3 and 4 because dead code's tests go with it — record the new counts in the commit message).
- Every deletion of a C# binding is paired with the removal of its `ValueBindingHelper` field, every `.Value =` write, and any helper left with zero callers. Do not leave a field that is assigned and never published.
- No new source-regex tests except the manifest test in Task 2, which exists precisely to make a *boundary* visible; do not add regex guards over implementation files.
- Beads: `cm-yfd5` and `cm-2xvs.25` are the open bugs Task 1 addresses; Task 5 closes `cm-yfd5` with the measured number and comments on `cm-2xvs.25`. Beads: epic `cm-jjlv`; Task 1 = `cm-jjlv.1`, Task 2 = `cm-jjlv.2`, Task 3 = `cm-jjlv.3`, Task 4 = `cm-jjlv.4`, Task 5 = `cm-jjlv.5`. Later phases: `cm-jjlv.6` (taxonomy), `.7` (snapshot pass), `.8` (view store), `.9` (filter bank + residue), `.10` (BuildingCatalog split), `.11` (test harness).
- Commit after every task with a message in the repo's style: `type(findit): sentence in lower case (bead-id)`. No `Co-Authored-By` trailer is required by the repo; the harness adds its own.

---

### Task 1: Replace the search worker with a main-thread debounce

**Files:**
- Create: `FindIt/Domain/SearchDebounce.cs`
- Create: `FindItBuildingMenu.Tests/SearchDebounceTests.cs`
- Modify: `FindIt/Systems/FindItUISystem.Setup.cs:11,17,19,359-374`
- Modify: `FindIt/Systems/FindItUISystem.Methods.cs:14,307-352`
- Modify: `FindIt/Systems/FindItUISystem.Bindings.cs:612-630,1019-1041`
- Modify: `FindIt/Utilities/FindItUtil.cs:20,59-78,308-328,358-390` (delete)
- Delete: `FindItBuildingMenu.Tests/SearchFilterTests.cs`
- Modify: `FindItBuildingMenu.Tests/BuildingCatalogQueryEngineTests.cs:840` (delete one assertion)

**Interfaces:**
- Consumes: `FindItUISystem.RefreshBuildingCatalog()` (existing, private, `Methods.cs:50`), `_IsSearchLoading` (existing `ValueBindingHelper<bool>`, `Setup.cs:54`).
- Produces: `FindItBuildingMenu.Domain.SearchDebounce` with `Schedule(TimeSpan now)`, `Cancel()`, `bool TryFire(TimeSpan now)`, `bool Pending`. `FindItUISystem.TriggerSearch()` keeps its name and visibility (`OptionsUISystem.TriggerSearch` is abstract and `FindItOptionsUISystem`/`PickerUISystem` override it) but now only schedules.

- [ ] **Step 1: Write the failing test**

Create `FindItBuildingMenu.Tests/SearchDebounceTests.cs`:

```csharp
using FindItBuildingMenu.Domain;

using System;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The search debounce: one refresh, a fixed delay after the LAST keystroke.
	/// </summary>
	/// <remarks>
	/// This replaces a Task.Run worker that ran the legacy fuzzy search over
	/// the whole index and then raised a flag OnUpdate polled. The lens never
	/// read that search's result (cm-yfd5), so all the worker ever did for the
	/// lens was delay the refresh by 250ms plus 2.7s of wasted work. A deadline
	/// polled from OnUpdate is the same debounce with no thread, no token and
	/// no flag.
	/// </remarks>
	public sealed class SearchDebounceTests
	{
		private static readonly TimeSpan Delay = TimeSpan.FromMilliseconds(250);

		[Fact]
		public void DoesNotFireBeforeTheDelayHasPassed()
		{
			var debounce = new SearchDebounce(Delay);

			debounce.Schedule(TimeSpan.FromSeconds(10));

			Assert.True(debounce.Pending);
			Assert.False(debounce.TryFire(TimeSpan.FromSeconds(10)));
			Assert.False(debounce.TryFire(TimeSpan.FromSeconds(10) + TimeSpan.FromMilliseconds(249)));
			Assert.True(debounce.Pending);
		}

		[Fact]
		public void FiresOnceWhenTheDelayHasPassed()
		{
			var debounce = new SearchDebounce(Delay);

			debounce.Schedule(TimeSpan.FromSeconds(10));

			Assert.True(debounce.TryFire(TimeSpan.FromSeconds(10) + Delay));
			Assert.False(debounce.Pending);
			// Firing consumes the deadline: the next frame must not fire again.
			Assert.False(debounce.TryFire(TimeSpan.FromSeconds(11)));
		}

		[Fact]
		public void ReschedulingPushesTheDeadlineOut()
		{
			// Two keystrokes 100ms apart produce ONE refresh, 250ms after the second.
			var debounce = new SearchDebounce(Delay);

			debounce.Schedule(TimeSpan.FromSeconds(10));
			debounce.Schedule(TimeSpan.FromSeconds(10) + TimeSpan.FromMilliseconds(100));

			Assert.False(debounce.TryFire(TimeSpan.FromSeconds(10) + TimeSpan.FromMilliseconds(300)));
			Assert.True(debounce.TryFire(TimeSpan.FromSeconds(10) + TimeSpan.FromMilliseconds(350)));
		}

		[Fact]
		public void CancelDropsThePendingDeadline()
		{
			var debounce = new SearchDebounce(Delay);

			debounce.Schedule(TimeSpan.FromSeconds(10));
			debounce.Cancel();

			Assert.False(debounce.Pending);
			Assert.False(debounce.TryFire(TimeSpan.FromSeconds(20)));
		}

		[Fact]
		public void NeverFiresWhenNothingWasScheduled()
		{
			var debounce = new SearchDebounce(Delay);

			Assert.False(debounce.Pending);
			Assert.False(debounce.TryFire(TimeSpan.Zero));
			Assert.False(debounce.TryFire(TimeSpan.FromDays(1)));
		}
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run from the worktree root: `dotnet test cs2-findit-building-menu/FindItBuildingMenu.Tests --filter SearchDebounceTests 2>&1 | tail -5`
Expected: build error `The type or namespace name 'SearchDebounce' could not be found`.

- [ ] **Step 3: Write the minimal implementation**

Create `FindIt/Domain/SearchDebounce.cs`:

```csharp
using System;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// A deadline that fires once, a fixed delay after the last time it was set.
	/// </summary>
	/// <remarks>
	/// Polled from the UI system's OnUpdate rather than run on a timer or a
	/// worker: the refresh it gates must happen on the main thread anyway, so
	/// the cheapest correct debounce is a timestamp compared once per frame.
	/// Takes the clock as an argument so the tests need no real time.
	/// </remarks>
	public sealed class SearchDebounce
	{
		private readonly TimeSpan _delay;
		private TimeSpan? _dueAt;

		public SearchDebounce(TimeSpan delay)
		{
			_delay = delay;
		}

		public bool Pending => _dueAt.HasValue;

		public void Schedule(TimeSpan now) => _dueAt = now + _delay;

		public void Cancel() => _dueAt = null;

		/// <summary>True exactly once per Schedule, the first poll at or past the deadline.</summary>
		public bool TryFire(TimeSpan now)
		{
			if (_dueAt is not { } dueAt || now < dueAt)
			{
				return false;
			}

			_dueAt = null;
			return true;
		}
	}
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `dotnet test cs2-findit-building-menu/FindItBuildingMenu.Tests --filter SearchDebounceTests 2>&1 | tail -3`
Expected: `Passed! - Failed: 0, Passed: 5`.

- [ ] **Step 5: Rewire `FindItUISystem` onto the debounce**

In `FindIt/Systems/FindItUISystem.Setup.cs`, replace the two fields at lines 17 and 19 (`private bool filterCompleted;` and `private CancellationTokenSource searchTokenSource = new();`) with:

```csharp
		// Search is debounced on the main thread: SearchChanged schedules,
		// OnUpdate fires. See SearchDebounce for why there is no worker.
		private static readonly System.Diagnostics.Stopwatch SearchClock = System.Diagnostics.Stopwatch.StartNew();
		private readonly SearchDebounce _searchDebounce = new(TimeSpan.FromMilliseconds(250));
```

Delete `using System.Threading;` (line 11) if nothing else in the file uses the namespace (grep `CancellationToken` in the file first; it does not). Add `using System;` if not present — it is not in the current using list, and `TimeSpan` needs it.

Replace `OnUpdate` (lines 359–374) with:

```csharp
		protected override void OnUpdate()
		{
			if (_searchDebounce.TryFire(SearchClock.Elapsed))
			{
				_IsSearchLoading.Value = false;
				RefreshBuildingCatalog();
			}

			base.OnUpdate();
		}
```

In `FindIt/Systems/FindItUISystem.Methods.cs`, replace `TriggerSearch`, `ClearSearch` and `DelayedSearch` (lines 307–352) with:

```csharp
		/// <summary>Asks for a refresh 250ms after the last call, on the main thread.</summary>
		/// <remarks>
		/// Kept under this name because OptionsUISystem declares it abstract
		/// and the options and picker systems override it. It used to start a
		/// worker that ran the legacy fuzzy search across the whole index and
		/// then raised a flag for OnUpdate; the lens never read that result
		/// (its own predicate is BuildingCatalogQueryEngine's Contains), so the
		/// worker cost 2.7s per precise search for nothing. cm-yfd5.
		/// </remarks>
		internal void TriggerSearch()
		{
			_IsSearchLoading.Value = true;
			_searchDebounce.Schedule(SearchClock.Elapsed);
		}

		internal void ClearSearch()
		{
			_ClearSearchBar.Value = true;
			FindItUtil.Filters.CurrentSearch = string.Empty;
			_searchDebounce.Cancel();
			_IsSearchLoading.Value = false;
			_CurrentSearch.Value = string.Empty;
			RefreshBuildingCatalog();
		}
```

Then remove `using System.Threading.Tasks;` (line 14) if no other `Task` remains in the file (grep `Task` in `Methods.cs`; `OnPrefabChanged` and the rest do not use it).

In `FindIt/Systems/FindItUISystem.Bindings.cs`, `SetCurrentSubCategory` (lines 612–630): delete the `if (FindItUtil.Filters.GetFilterList().Any()) { TriggerSearch(); }` block and its comment — `RefreshLens()` two lines above already refreshed with the legacy filters applied (`BuildingCatalogAdapter.GetIndexedBuildings` applies `GetFilterList(includeSearch: false)` itself). The method becomes:

```csharp
		private void SetCurrentSubCategory(int category)
		{
			FindItUtil.CurrentSubCategory = (PrefabSubCategory)category;

			RefreshLens();
		}
```

In `SearchChanged` (lines 1019–1041) replace the eight-line comment above `TriggerSearch();` with:

```csharp
			// Deliberately no inline RefreshBuildingCatalog() here: every refresh
			// projects the whole building index, and doing that per keystroke made
			// the lens the only search path in the mod without a debounce.
			// TriggerSearch schedules one refresh 250ms after the last keystroke.
			TriggerSearch();
```

- [ ] **Step 6: Delete the worker's dead output in `FindItUtil`**

In `FindIt/Utilities/FindItUtil.cs` delete:
- line 20: `private static List<PrefabIndex> _cachedSearch = new();`
- `GetFilteredPrefabs()` (lines 59–78) — its only caller is a single assertion in a test.
- `ProcessSearch(CancellationToken token)` (lines 308–328) — its only caller was `DelayedSearch`.
- `ApplyFilters<T>` and both of its `<remarks>` blocks (lines 330–390) — its only caller was `ProcessSearch`.
- `using System.Threading;` if no other `CancellationToken` remains in the file.

Delete `FindItBuildingMenu.Tests/SearchFilterTests.cs` outright (it tests `ApplyFilters`).

In `FindItBuildingMenu.Tests/BuildingCatalogQueryEngineTests.cs` delete line 840, `Assert.Empty(FindItUtil.GetFilteredPrefabs());`, leaving the surrounding assertions.

- [ ] **Step 7: Build and run the whole suite**

Run: `just test findit-building-menu 2>&1 | grep -E "Passed!|Failed!|error|# (pass|fail)" | head`
Expected: C# `Passed!` with 5 new tests and `SearchFilterTests`' 5 gone (428 → 428, or thereabouts — record the number), TS `# pass 630`, `# fail 0`. Also `grep -rn "ProcessSearch\|filterCompleted\|searchTokenSource\|DelayedSearch\|_cachedSearch" cs2-findit-building-menu/FindIt --include=*.cs` prints nothing.

- [ ] **Step 8: Commit**

```bash
git add cs2-findit-building-menu/FindIt/Domain/SearchDebounce.cs cs2-findit-building-menu/FindItBuildingMenu.Tests/SearchDebounceTests.cs cs2-findit-building-menu/FindIt/Systems cs2-findit-building-menu/FindIt/Utilities/FindItUtil.cs cs2-findit-building-menu/FindItBuildingMenu.Tests
git commit -m "perf(findit): search debounces on the main thread instead of waiting on a discarded fuzzy scan (cm-jjlv.1)"
```

---

### Task 2: The binding manifest test

**Files:**
- Create: `FindItBuildingMenu.Tests/BindingManifestTests.cs`

**Interfaces:**
- Consumes: source text only. C# side: every `CreateBinding`/`CreateTrigger` call in `FindIt/Systems/*.cs`, including the two-name form `CreateBinding("Name", "SetName", value, setter)` which registers a value binding AND a trigger. TS side, non-test files under `FindIt/UI/src`: `bindValue<T>(mod.id, "Name", …)`, `trigger(mod.id, "Name", …)`, `createTriggerCommand("Name", …)`, and `method: "Name"` inside command objects (`filterChips.ts`, `vanillaBuildMenuContracts.ts`, `ChipRow.tsx`), minus commands whose `group` is `"toolbar"` (`zoningHierarchy.ts:selectZoneCommand`).
- Produces: `BindingManifestTests.KnownUnreadByUi` — a `string[]` allowlist of C# bindings the UI does not read yet, each entry citing the bead that will make it read or delete it. Phase 3 (the TS view store) empties it.

- [ ] **Step 1: Write the test**

Create `FindItBuildingMenu.Tests/BindingManifestTests.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The C#↔TS binding boundary, as a diff of two name sets.
	/// </summary>
	/// <remarks>
	/// Nothing fails at build time when one side renames or abandons a
	/// binding: C# publishes to a name nobody subscribes to, or TS subscribes
	/// to a name nobody publishes and reads its default forever. The 2026-09-01
	/// review found nine of the first kind and three of the second. This reads
	/// both trees as text and requires the sets to agree, so the next one
	/// fails here instead of in the game.
	///
	/// A regex over source is a blunt instrument, and this is the one place
	/// it is the right one: the boundary IS strings, on both sides.
	/// </remarks>
	public sealed class BindingManifestTests
	{
		/// <summary>
		/// C# bindings the UI is known not to read yet. Each entry names the
		/// bead that either wires it or deletes it; an entry without one is a
		/// failure of this test's purpose, not a convenience.
		/// </summary>
		private static readonly string[] KnownUnreadByUi =
		{
			// groupBy is C#-owned and TS re-derives it instead of reading it
			// (review finding 6). The phase-4 view store (cm-jjlv.8) reads it; until then
			// the binding stays so that phase has something to read.
			"BuildingCatalogGroupBy",
		};

		[Fact]
		public void EveryNameTheUiUsesIsRegisteredByCSharp()
		{
			var registered = CSharpNames();
			var used = TypeScriptNames();

			var phantom = used.Except(registered).OrderBy(name => name, StringComparer.Ordinal).ToArray();

			Assert.True(phantom.Length == 0,
				"UI reads or triggers names no C# system registers: " + string.Join(", ", phantom));
		}

		[Fact]
		public void EveryNameCSharpRegistersIsUsedByTheUi()
		{
			var registered = CSharpNames();
			var used = TypeScriptNames();

			var orphaned = registered
				.Except(used)
				.Except(KnownUnreadByUi)
				.OrderBy(name => name, StringComparer.Ordinal)
				.ToArray();

			Assert.True(orphaned.Length == 0,
				"C# registers names the UI never reads or triggers: " + string.Join(", ", orphaned));
		}

		[Fact]
		public void TheAllowlistOnlyNamesThingsThatStillExist()
		{
			// An allowlist entry for a name C# no longer registers, or one the
			// UI has started reading, is stale and must go.
			var registered = CSharpNames();
			var used = TypeScriptNames();

			foreach (var name in KnownUnreadByUi)
			{
				Assert.Contains(name, registered);
				Assert.DoesNotContain(name, used);
			}
		}

		[Fact]
		public void TheExtractorsFindTheBoundaryAtAll()
		{
			// Guards the guards: if a refactor moves the systems or the UI, both
			// sets go empty and the two diffs above pass vacuously.
			Assert.True(CSharpNames().Count > 40, "C# extractor found too few names");
			Assert.True(TypeScriptNames().Count > 40, "TS extractor found too few names");
			Assert.Contains("SearchChanged", CSharpNames());
			Assert.Contains("SearchChanged", TypeScriptNames());
		}

		// Matches CreateBinding("Name", …), CreateTrigger<int>("Name", …), and the
		// two-name CreateBinding("Name", "SetName", value, setter). The generic
		// argument may not contain parentheses, which keeps a lazy match from
		// spanning from one call to the next.
		private static readonly Regex CSharpRegistration = new(
			@"Create(?:Binding|Trigger)\s*(?:<[^()]*?>)?\s*\(\s*""(?<name>\w+)""(?:\s*,\s*""(?<trigger>\w+)"")?",
			RegexOptions.Singleline | RegexOptions.Compiled);

		private static readonly Regex TypeScriptUse = new(
			@"bindValue\s*(?:<[^()]*?>)?\s*\(\s*mod\.id\s*,\s*""(?<name>\w+)""" +
			@"|trigger\s*\(\s*mod\.id\s*,\s*""(?<name>\w+)""" +
			@"|createTriggerCommand\(\s*""(?<name>\w+)""" +
			@"|method:\s*""(?<name>\w+)""",
			RegexOptions.Singleline | RegexOptions.Compiled);

		// Commands aimed at the game's own binding groups, not at this mod.
		private static readonly Regex TypeScriptForeignCommand = new(
			@"group:\s*""(?!FindItBuildingMenu"")\w+""\s*,\s*method:\s*""(?<name>\w+)""",
			RegexOptions.Singleline | RegexOptions.Compiled);

		private static HashSet<string> CSharpNames()
		{
			var names = new HashSet<string>(StringComparer.Ordinal);

			foreach (var file in Directory.EnumerateFiles(Path.Combine(RepoRoot(), "FindIt", "Systems"), "*.cs"))
			{
				foreach (Match match in CSharpRegistration.Matches(File.ReadAllText(file)))
				{
					names.Add(match.Groups["name"].Value);

					if (match.Groups["trigger"].Success)
					{
						names.Add(match.Groups["trigger"].Value);
					}
				}
			}

			return names;
		}

		private static HashSet<string> TypeScriptNames()
		{
			var names = new HashSet<string>(StringComparer.Ordinal);
			var foreign = new HashSet<string>(StringComparer.Ordinal);
			var root = Path.Combine(RepoRoot(), "FindIt", "UI", "src");

			foreach (var file in Directory.EnumerateFiles(root, "*.ts*", SearchOption.AllDirectories))
			{
				if (!file.EndsWith(".ts", StringComparison.Ordinal) && !file.EndsWith(".tsx", StringComparison.Ordinal))
				{
					continue;
				}

				var source = File.ReadAllText(file);

				foreach (Match match in TypeScriptUse.Matches(source))
				{
					names.Add(match.Groups["name"].Value);
				}

				foreach (Match match in TypeScriptForeignCommand.Matches(source))
				{
					foreign.Add(match.Groups["name"].Value);
				}
			}

			names.ExceptWith(foreign);

			return names;
		}

		private static string RepoRoot()
		{
			var dir = new DirectoryInfo(Directory.GetCurrentDirectory());

			while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "FindIt")))
			{
				dir = dir.Parent;
			}

			Assert.NotNull(dir);

			return dir!.FullName;
		}
	}
}
```

- [ ] **Step 2: Run it and record exactly what it names**

Run: `dotnet test cs2-findit-building-menu/FindItBuildingMenu.Tests --filter BindingManifestTests 2>&1 | grep -E "phantom|orphan|UI reads|C# registers|Passed|Failed"`
Expected: `TheExtractorsFindTheBoundaryAtAll` and `TheAllowlistOnlyNamesThingsThatStillExist` pass; the two diff tests FAIL with these exact lists (verified 2026-09-01 by a prototype of the same regexes):

- `EveryNameCSharpRegistersIsUsedByTheUi`: `AreFiltersSet, BuildingLensMenuMilestone, BuildingLensMenuToolTip, BuildingLensMilestoneIcons, BuildingLensSortCanReorder, ClearFilters, CurrentCategory, CurrentSubCategory, NoAssetImage, OptionsList, SetBuildingLensMenuMilestone`
- `EveryNameTheUiUsesIsRegisteredByCSharp`: `BuildingLensZoneFamilies, SetBuildingLensRole, ToggleBuildingLensZoneFamily`

If the lists differ from this, stop and reconcile against `grep` before continuing: a name missing from the expected list is either a real orphan the prototype missed (fine, delete it in Task 3/4) or a regex gap (fix the regex, not the allowlist). `selectAsset` must NOT appear — it is a `"toolbar"` group command and the foreign-command subtraction removes it.

- [ ] **Step 3: Commit the failing test**

The test is committed red on purpose: the next two commits are what turn it green, and the history should show the boundary's state before them.

```bash
git add cs2-findit-building-menu/FindItBuildingMenu.Tests/BindingManifestTests.cs
git commit -m "test(findit): a manifest test over the C#/TS binding boundary, red on 11 orphans and 3 phantoms (cm-jjlv.2)"
```

---

### Task 3: Delete the C# bindings nothing reads

**Files:**
- Modify: `FindIt/Systems/FindItUISystem.Setup.cs:104,106-107,133,146,177,209-210,234,265,290-294,311,318`
- Modify: `FindIt/Systems/FindItUISystem.Methods.cs:186-189,268`
- Modify: `FindIt/Systems/FindItUISystem.Bindings.cs:85-94,129,242,367-377,387,577,612-617`
- Modify: `FindIt/Systems/FindItOptionsUISystem.cs:52-56` and its `RefreshOptions`/`ClearFilters` bodies
- Modify: `FindIt/Systems/PrefabIndexingSystem.cs` (`_assetMenuToolTips`, `GetAssetMenuToolTip`, the population at ~2370)
- Modify: `FindIt/Domain/BuildingCatalogPage.cs:33,61`, `FindIt/Services/BuildingCatalogQueryEngine.cs:102,112,630-…`
- Delete: `FindIt/Domain/MenuToolTip.cs`, `FindItBuildingMenu.Tests/MenuToolTipTests.cs`, `FindItBuildingMenu.Tests/SortReorderabilityTests.cs`

**Interfaces:**
- Consumes: the orphan list from Task 2.
- Produces: `EveryNameCSharpRegistersIsUsedByTheUi` green. `BuildingCatalogPage` loses `SortCanReorder`; `BuildingCatalogQueryEngine` loses `SortCanReorder`/`HandlesSortColumn`. `_buildingLensUnlockMilestone`, `ResetBuildingLensMilestone()` and `BuildingCatalogQuery.UnlockMilestone` STAY (now permanently `AnyMilestone`; cm-jjlv.6 removes them with the taxonomy).

- [ ] **Step 1: Delete the eleven registrations and everything that only existed to feed them**

Work name by name; after each, `grep -rn "<field>" FindIt --include=*.cs` must print nothing.

1. `CurrentCategory` / `CurrentSubCategory` (with triggers `SetCurrentCategory` / `SetCurrentSubCategory`): delete `Setup.cs:106-107` (fields), `:209-210` (registrations and the comment above), `Bindings.cs:87-94` (`SetCurrentCategory`) and `SetCurrentSubCategory` (the three-line method Task 1 left). `FindItUtil.CurrentCategory`/`CurrentSubCategory` statics stay — `Bindings.cs:600-601` still reset them.
2. `BuildingLensMenuToolTip`: delete `Setup.cs:104` (field) and `:230-234` (comment + registration), `Bindings.cs:129` and `:242` (writes). Then `PrefabIndexingSystem.GetAssetMenuToolTip` has no callers: delete it, the `_assetMenuToolTips` dictionary, and the lines around `:2370` that fill it (`var toolTip = MenuToolTip.FromIconPath(...)` and the `_assetMenuToolTips[...] = toolTip` write — read the surrounding ten lines; keep anything else that loop does). Then `MenuToolTip` has no callers: delete `FindIt/Domain/MenuToolTip.cs` and `FindItBuildingMenu.Tests/MenuToolTipTests.cs`.
3. `BuildingLensSortCanReorder`: delete `Setup.cs:130-133` (remarks + field), `:262-265` (comment + registration), `Methods.cs:187-189` (comment + write). Then delete the `SortCanReorder` field from `BuildingCatalogPage` (`:33` and the `writer.Write(SortCanReorder)` at `:61`), the `canReorder` computation and `SortCanReorder:` argument in `BuildingCatalogQueryEngine.Query` (`:102`, `:112`), and the `SortCanReorder`/`HandlesSortColumn` static methods (`:630` onward — read to the end of `HandlesSortColumn`). Delete `FindItBuildingMenu.Tests/SortReorderabilityTests.cs`. Leave a one-line note on bead `cm-ddw3` in Task 5: the C# half was computed and never displayed; the bead stays open as a UX ask.
4. `BuildingLensMenuMilestone` / `SetBuildingLensMenuMilestone`: delete `Setup.cs:146` (field), `:290-294` (registration), `Bindings.cs:360-377` (`SetBuildingLensMenuMilestone` and its remarks), the write at `:387` inside `ResetBuildingLensMilestone`, and the write at `:577`. Keep `_buildingLensUnlockMilestone` and `ResetBuildingLensMilestone()`.
5. `BuildingLensMilestoneIcons`: delete `Setup.cs:176-177` (comment + field), `:311` (registration), `Methods.cs:268` (write). `PrefabIndexingSystem.GetMilestoneIcons` stays — `BuildingCatalogAdapter.cs:609` reads it.
6. `NoAssetImage`: delete `Setup.cs:318`. `Mod.Settings.NoAssetImage` stays (it is a settings field).
7. `OptionsList`, `AreFiltersSet`, `ClearFilters` in `FindItOptionsUISystem.cs:52-56`: delete the two `CreateBinding`s, the `CreateTrigger("ClearFilters", …)`, the `_optionsList`/`_filtersSet` fields and every write to them. `RefreshOptions()` becomes a method that rebuilds `_sections` and publishes nothing — leave it, its callers in `Methods.cs` are cm-jjlv.9's job. If `ClearFilters()` the method has no other caller after the trigger goes, delete it too. `CreateTrigger<int,int,int>("OptionClicked", …)` STAYS for now — TS still declares the command (Task 4 decides that one).

- [ ] **Step 2: Build and run the suite**

Run: `just test findit-building-menu 2>&1 | grep -E "Passed!|Failed!|error CS|# (pass|fail)"`
Expected: no `error CS`; C# `Passed!`; TS unchanged. `EveryNameCSharpRegistersIsUsedByTheUi` now passes; `EveryNameTheUiUsesIsRegisteredByCSharp` still fails on the three phantoms.

- [ ] **Step 3: Commit**

```bash
git add cs2-findit-building-menu/FindIt cs2-findit-building-menu/FindItBuildingMenu.Tests
git commit -m "refactor(findit): delete eleven bindings the UI never read (cm-jjlv.3)"
```

---

### Task 4: Delete the phantom TS reads and triggers

**Files:**
- Modify: `FindIt/UI/src/mods/LensControlPane/LensControlPane.tsx:69,124,193`
- Modify: `FindIt/UI/src/domain/filterChips.ts:53,136-146`
- Modify: `FindIt/UI/src/domain/vanillaBuildMenuContracts.ts:19-22`
- Modify: `FindIt/UI/src/domain/buildingCatalogContracts.ts:60-61,69-70`
- Modify: `FindIt/UI/src/domain/findItSurfaceContracts.ts:37,71` and `FindIt/UI/src/domain/findItSurfacePort.ts` (whatever imports the removed member)
- Modify tests: `FindIt/UI/test/filterChips.test.ts`, `FindIt/UI/test/vanillaBuildMenuContracts.test.ts`, `FindIt/UI/test/buildingCatalogContracts.test.ts:12,14,73-74`, `FindIt/UI/test/buildingLensUx.test.ts:4,38-…`, `FindIt/UI/test/findItSurfaceContracts.test.ts`

**Interfaces:**
- Consumes: the phantom list from Task 2.
- Produces: `EveryNameTheUiUsesIsRegisteredByCSharp` green. `filterChips.ts`'s input type loses `zoneFamilies`; `vanillaBuildMenuContracts.ts` loses `lensRoleCommand`; `buildingCatalogContracts.ts` loses `setCurrentCategoryCommand`, `setCurrentSubCategoryCommand`, `optionClickedCommand`; `findItSurfaceContracts.ts` loses the `OptionClicked` command variant.

- [ ] **Step 1: Remove the zone-family phantom**

`LensControlPane.tsx`: delete line 69 (`const BuildingLensZoneFamilies$ = bindValue<string[]>(mod.id, "BuildingLensZoneFamilies", []);`), line 124 (`const zoneFamilies = useValue(BuildingLensZoneFamilies$) ?? [];`) and the `zoneFamilies: null,` property at line 193. If `zoneFamilies` is referenced anywhere else in the file (`grep -n zoneFamilies`), delete that use too — it can only ever have been `[]`.

`filterChips.ts`: delete the `zoneFamilies?: …` input field (line 53) and the whole `for (const family of input?.zoneFamilies ?? []) { … }` loop (lines 136–146) that emitted `ToggleBuildingLensZoneFamily`. In `UI/test/filterChips.test.ts` delete every test or fixture that passes `zoneFamilies` or asserts on a `ToggleBuildingLensZoneFamily` chip (`grep -n "zoneFamil\|ZoneFamily" test/filterChips.test.ts`).

- [ ] **Step 2: Remove the role trigger and the dead command exports**

`vanillaBuildMenuContracts.ts`: delete `lensRoleCommand` (lines 19–22). In `test/vanillaBuildMenuContracts.test.ts` delete its import and the assertion(s) on it.

`buildingCatalogContracts.ts`: delete `setCurrentCategoryCommand` and `setCurrentSubCategoryCommand` (lines 60–61) and `optionClickedCommand` (lines 69–70). In `test/buildingCatalogContracts.test.ts` delete the two imports (lines 12, 14) and the two assertions (lines 73–74). In `test/buildingLensUx.test.ts` delete the import at line 4 and the test block that starts at line 38 asserting `optionClickedCommand(90, 0, 0)`.

`findItSurfaceContracts.ts`: delete the `{ method: "OptionClicked"; … }` union member (line 37) and the `case` at line 71 that returns it; fix the action type it maps from (delete the corresponding action variant if it exists only to produce this command — read the file's action union). Update `findItSurfacePort.ts` and `test/findItSurfaceContracts.test.ts` for whatever no longer exists. Then in C#, `FindItOptionsUISystem.cs`'s `CreateTrigger<int, int, int>("OptionClicked", OptionClicked)` has no TS declaration left: delete that registration too (keep the `OptionClicked` method only if `RefreshOptions` or a section still calls it; otherwise delete it as well). `PickerOptionClicked` on `PickerUISystem` is used (`PickerComponent.tsx:21`) and stays.

- [ ] **Step 3: Run both suites and the type check**

Run from the worktree root: `just test findit-building-menu 2>&1 | grep -E "Passed!|Failed!|error|# (pass|fail)"` and then `cd cs2-findit-building-menu/FindIt/UI && npx tsc --noEmit -p . 2>&1 | tail -3`.
Expected: all four `BindingManifestTests` pass; TS `# fail 0` with fewer tests than 630 (record the number); `tsc` prints nothing.

- [ ] **Step 4: Commit**

```bash
git add cs2-findit-building-menu/FindIt/UI/src cs2-findit-building-menu/FindIt/UI/test cs2-findit-building-menu/FindIt/Systems/FindItOptionsUISystem.cs
git commit -m "refactor(findit): delete the three phantom UI bindings and the dead command exports (cm-jjlv.4)"
```

---

### Task 5: Live verification, docs and beads

**Files:**
- Modify: `docs/verification.md` (add a dated section)
- Modify: `docs/roadmap.md` if it lists cm-yfd5 or the search stall as open

**Interfaces:**
- Consumes: the `[LENS-REFRESH]` log line `RefreshBuildingCatalog` already emits per refresh (`Methods.cs:50-…`, timer `refreshTimer`), and `Mod.Log` output under the game's `Logs/` directory for the prefix.

- [ ] **Step 1: Build and deploy**

From the worktree root: `just build findit-building-menu 2>&1 | tail -3` then `just deploy-isolated findit-building-menu 2>&1 | tail -5`. Expected: `Build succeeded`, deploy reports the DLL and UI bundle copied. C# changed, so the game must be (re)started — a UI reload keeps the old DLL.

- [ ] **Step 2: Launch from the MAIN checkout and load the Porterville 3 save**

From `/var/home/gerbal/Games/CS-Modding` (not the worktree — worktree launches bypass the shared game lock): use the project's launch recipe (`just launch-cs2 …` per `AGENTS.md`), load the save cm-yfd5 was measured on (Porterville 3), open the lens.

- [ ] **Step 3: Measure the two numbers the beads quote**

In the lens search box type `hospital`, then `clinic`, then clear. Then close and reopen the Landscaping menu twice. Read the mod log:

```bash
grep -E "LENS-REFRESH" "$(ls -t ~/.local/share/Steam/steamapps/compatdata/949230*/pfx/drive_c/users/steamuser/AppData/LocalLow/Colossal\ Order/Cities\ Skylines\ II/Logs/FindItBuildingMenu.log 2>/dev/null | head -1)" | tail -12
```

(Adjust the path to wherever `Mod.Log` writes for the deployed prefix — `just deploy-isolated` prints it.) Expected: each search settles in ONE refresh whose wall time is the refresh cost alone (tens to low hundreds of ms), not 2.7 s; no `Search Failed` lines; reopen cost is whatever the refresh fan-out costs (record it — that is the residual for cm-2xvs.25 and is phase 3's number to beat).

- [ ] **Step 4: Record it**

Append to `docs/verification.md` a section headed `## 2026-09-01 — search debounce and binding manifest` with the exact log lines, the save name, and the numbers, and note that `BuildingLensMenuToolTip`, `BuildingLensSortCanReorder`, `BuildingLensMilestoneIcons`, `BuildingLensMenuMilestone`, `CurrentCategory/SubCategory`, `NoAssetImage`, `OptionsList`, `AreFiltersSet`, `ClearFilters` are gone and why.

- [ ] **Step 5: Close and comment beads (from the main checkout)**

```bash
cd /var/home/gerbal/Games/CS-Modding
bd close cm-yfd5 --reason="The fuzzy scan is no longer on the lens path at all: SearchChanged debounces 250ms on the main thread and refreshes once. Measured <N>ms per search on Porterville 3 (was 2.7s)."
bd comment cm-2xvs.25 "Search worker removed (phase 1). Reopen now settles in <N>ms; the remainder is the per-refresh fan-out, tracked by cm-jjlv.7."
bd comment cm-ddw3 "The C# SortCanReorder computation was deleted in phase 1: it was published every refresh and never read by the UI. Reopen the UI half here if the indicator is still wanted."
bd close cm-jjlv.1 cm-jjlv.2 cm-jjlv.3 cm-jjlv.4 cm-jjlv.5
```

- [ ] **Step 6: Commit**

```bash
git add cs2-findit-building-menu/docs
git commit -m "docs(findit): verify the search debounce live and record the binding deletions (cm-jjlv.5)"
```

Then run `just test findit-building-menu` one last time on the branch tip, and `git status` must be clean. Merge/push follows the standing authorization for tested branches (never force).
