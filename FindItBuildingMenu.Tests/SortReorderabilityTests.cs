using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Services;

using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// Whether the active sort can actually reorder the current result set.
	/// </summary>
	/// <remarks>
	/// cm-ddw3. The sort control responds — the summary flips to "Cost ▲" then
	/// "Cost ▼" — while the list does not move, which is the signature of a
	/// broken control. It is not broken: the field simply ties across the set.
	/// Reproduced live in Signatures, where every building's cost is "Free".
	///
	/// The predicate is per GROUP, not over the whole set, because grouping is
	/// the primary sort key: a field that varies across the menu but is constant
	/// inside every group still cannot move a single row.
	/// </remarks>
	public sealed class SortReorderabilityTests
	{
		private static readonly BuildingCatalogEntry Base = new(
			Id: 0,
			PrefabName: "Base",
			Name: "Base",
			Category: "ServiceBuildings",
			SubCategory: "Any",
			Thumbnail: "",
			LotWidth: 1,
			LotDepth: 1,
			BuildingLevel: 1,
			ZoneType: ZoneTypeFilter.Any,
			HasParking: false,
			IsUniqueMesh: false,
			IsVanilla: true,
			IsFavorited: false,
			PdxModsId: "");

		private static BuildingCatalogEntry Entry(int id, string name, double? cost, string uiCategory = "Cat") =>
			Base with
			{
				Id = id,
				PrefabName = $"P{id}",
				Name = name,
				UiMenu = "Menu",
				UiCategory = uiCategory,
				ConstructionCost = cost,
			};

		private static BuildingCatalogQuery Query(string sort, string groupBy = "none") =>
			new() { SortColumn = sort, GroupBy = groupBy };

		[Fact]
		public void SaysASortCannotReorderWhenEveryValueTies()
		{
			// Signatures by Cost: every building is Free. Clicking the control
			// does nothing and nothing says why.
			var entries = new[]
			{
				Entry(1, "Waveform Tower", 0),
				Entry(2, "Halo Heights", 0),
				Entry(3, "The Grass Crown", 0),
			};

			Assert.False(BuildingCatalogQueryEngine.SortCanReorder(entries, Query("cost")));
		}

		[Fact]
		public void SaysASortCanReorderWhenTheValuesDiffer()
		{
			var entries = new[]
			{
				Entry(1, "Water Pipe", 1000),
				Entry(2, "EE Water Tower", 18000),
			};

			Assert.True(BuildingCatalogQueryEngine.SortCanReorder(entries, Query("cost")));
		}

		[Fact]
		public void TreatsAMissingValueAsDistinctFromAPresentOne()
		{
			// The engine orders present-before-absent, so a set split between
			// "has a cost" and "has none" genuinely reorders.
			var entries = new[]
			{
				Entry(1, "Priced", 1000),
				Entry(2, "Unpriced", null),
			};

			Assert.True(BuildingCatalogQueryEngine.SortCanReorder(entries, Query("cost")));
		}

		[Fact]
		public void AsksPerGroup_NotAcrossTheWholeSet()
		{
			// THE case a whole-set distinct count gets wrong. Two groups, two
			// distinct costs overall — but constant inside each group, so the
			// sort cannot move one row. Grouping is the primary sort key.
			var entries = new[]
			{
				Entry(1, "A", 1000, "Small Roads"),
				Entry(2, "B", 1000, "Small Roads"),
				Entry(3, "C", 5000, "Highways"),
				Entry(4, "D", 5000, "Highways"),
			};

			Assert.False(BuildingCatalogQueryEngine.SortCanReorder(entries, Query("cost", "menuCategory")));

			// Ungrouped, the same entries reorder fine.
			Assert.True(BuildingCatalogQueryEngine.SortCanReorder(entries, Query("cost")));
		}

		[Fact]
		public void ASingleEntryCannotBeReordered()
		{
			Assert.False(BuildingCatalogQueryEngine.SortCanReorder(new[] { Entry(1, "Only", 1000) }, Query("cost")));
			Assert.False(BuildingCatalogQueryEngine.SortCanReorder(Array.Empty<BuildingCatalogEntry>(), Query("cost")));
		}

		[Fact]
		public void HandlesTheNameFallbackLikeTheOrderingDoes()
		{
			// Anything the switch does not name falls through to Name, so the
			// reorderability question has to fall through the same way or it
			// would report "inert" for the default sort.
			var entries = new[] { Entry(1, "Alpha", 0), Entry(2, "Beta", 0) };

			Assert.True(BuildingCatalogQueryEngine.SortCanReorder(entries, Query("name")));
			Assert.True(BuildingCatalogQueryEngine.SortCanReorder(entries, Query("somethingUnknown")));
		}

		[Fact]
		public void CoversEverySortColumnTheOrderingUnderstands()
		{
			// The reorderability check and the ordering read the same fields
			// from two different switches, which is exactly how two views of one
			// fact drift apart. This reads Order's own case labels out of the
			// source and requires SortValueOf to answer for each of them.
			var source = File.ReadAllText(Path.Combine(
				RepoRoot(), "FindIt", "Services", "BuildingCatalogQueryEngine.cs"));

			var order = source.Substring(source.IndexOf("IOrderedEnumerable<BuildingCatalogEntry> ordered =", StringComparison.Ordinal));
			order = order.Substring(0, order.IndexOf("return ordered", StringComparison.Ordinal));

			var columns = Regex.Matches(order, @"""(?<name>[a-z]+)""")
				.Cast<Match>()
				.Select(match => match.Groups["name"].Value)
				.Distinct(StringComparer.Ordinal)
				.ToArray();

			Assert.NotEmpty(columns);

			var entries = new[] { Entry(1, "A", 1000), Entry(2, "B", 2000) };

			foreach (var column in columns)
			{
				// Not asserting a particular answer — asserting it does not
				// throw and does not silently fall through to Name for a column
				// the ordering handles explicitly.
				var handled = BuildingCatalogQueryEngine.HandlesSortColumn(column);

				Assert.True(handled, $"SortValueOf does not handle '{column}', which Order sorts by");
				_ = BuildingCatalogQueryEngine.SortCanReorder(entries, Query(column));
			}
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
