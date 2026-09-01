using System.Collections;
using System.Collections.Generic;
using System.Linq;
using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Services;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The view answers what the adapter's per-query methods answered, from
	/// one pass. Equivalence against the static helpers, not a re-specification.
	/// </summary>
	public sealed class CatalogViewTests
	{
		private static BuildingCatalogEntry Entry(int id, string name, string category, string menu, string uiCategory) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: name, Name: name, Category: category, SubCategory: category + "_Any",
				Thumbnail: "", LotWidth: 2, LotDepth: 2, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsUniqueMesh: false, IsVanilla: true, PdxModsId: "")
				with { UiMenu = menu, UiCategory = uiCategory };

		private static readonly BuildingCatalogEntry[] Fixture =
		{
			Entry(1, "Small Road", "Networks", "Roads", "RoadsSmallRoads") with { DevTreeBranch = "Basic", DevTreeBranchDepth = 0 },
			Entry(2, "Highway", "Networks", "Roads", "RoadsHighways") with { DevTreeBranch = "Highways", DevTreeBranchDepth = 1 },
			Entry(3, "Wind Turbine", "ServiceBuildings", "Electricity", "Electricity") with { DevTreeBranch = "Electricity", DevTreeBranchDepth = 0, Capacity = 10 },
			Entry(4, "Coal Plant", "ServiceBuildings", "Electricity", "Electricity") with { DevTreeBranch = "Electricity", DevTreeBranchDepth = 0, Capacity = 20 },
			Entry(5, "Gas Plant", "ServiceBuildings", "Electricity", "Electricity") with { DevTreeBranch = "Gas Power Plant", DevTreeBranchDepth = 1, Capacity = 30 },
			Entry(6, "High School", "ServiceBuildings", "Education & Research", "Education") with { EducationLevel = 2 },
		};

		/// <summary>Counts enumerations; the count is the fact under test.</summary>
		private sealed class CountingList : IReadOnlyList<BuildingCatalogEntry>
		{
			private readonly BuildingCatalogEntry[] _items;
			public int Walks { get; private set; }
			public CountingList(BuildingCatalogEntry[] items) => _items = items;
			public BuildingCatalogEntry this[int index] => _items[index];
			public int Count => _items.Length;
			public IEnumerator<BuildingCatalogEntry> GetEnumerator() { Walks++; return ((IEnumerable<BuildingCatalogEntry>)_items).GetEnumerator(); }
			IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
		}

		[Fact]
		public void TheSetsAreTheScopesTheAdapterUsedToRecompute()
		{
			var query = new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsHighways", StripTabs: new[] { "Highways" });
			var view = new CatalogView(Fixture, query);

			Assert.Equal(
				BuildingCatalogQueryEngine.InScope(Fixture, query with { UiCategory = "", StripTabs = null, SchoolTier = -1 }).Select(e => e.Id),
				view.MenuSet.Select(e => e.Id));
			Assert.Equal(
				BuildingCatalogQueryEngine.InScope(Fixture, query).Select(e => e.Id),
				view.ViewSet.Select(e => e.Id));
			Assert.Equal(
				BuildingCatalogQueryEngine.InScope(Fixture, query with { StripTabs = null }).Select(e => e.Id),
				view.TabSet.Select(e => e.Id));
			Assert.Equal(new[] { 1, 2 }, view.MenuSet.Select(e => e.Id));
			Assert.Equal(new[] { 2 }, view.ViewSet.Select(e => e.Id));
		}

		[Fact]
		public void PageBoundsAndFacetsComeFromTheSameSetsTheAdapterUsed()
		{
			var query = new BuildingCatalogQuery(UiMenu: "Electricity", MinCapacity: 15);
			var view = new CatalogView(Fixture, query);

			Assert.Equal(
				BuildingCatalogQueryEngine.Query(Fixture, query).Items.Select(e => e.Id),
				view.Page.Items.Select(e => e.Id));
			Assert.Equal(new[] { 4, 5 }, view.Page.Items.Select(e => e.Id));
			Assert.Equal(
				BuildingCatalogAdapter.MetricBoundsOf(BuildingCatalogQueryEngine.InScope(Fixture, query)),
				view.MetricBounds);
			Assert.Equal(
				BuildingCatalogAdapter.BuildFacetState(BuildingCatalogQueryEngine.InScope(Fixture, query), query).Groups.Select(g => g.Id),
				view.FacetState.Groups.Select(g => g.Id));
		}

		[Fact]
		public void CountsStripAndTiersMatchTheOldDerivations()
		{
			var roads = new CatalogView(Fixture, new BuildingCatalogQuery(UiMenu: "Roads"));
			Assert.Equal(new[] { ("RoadsHighways", 1), ("RoadsSmallRoads", 1) }, roads.MenuCategoryCounts.Select(c => (c.Id, c.Count)));
			// Two categories, neither with two branches: nothing expanded, no axis, no tabs.
			Assert.Equal(string.Empty, roads.ExpandedCategoryId);
			Assert.Equal(string.Empty, roads.StripAxis);
			Assert.Empty(roads.StripTabs);
			Assert.Empty(roads.ExpandedCategories);

			var electricity = new CatalogView(Fixture, new BuildingCatalogQuery(UiMenu: "Electricity"));
			// One category, two branches: the development axis, tabs by depth then name.
			Assert.Equal(StripAxes.Development, electricity.StripAxis);
			Assert.Equal(new[] { ("Electricity", 2), ("Gas Power Plant", 1) }, electricity.StripTabs.Select(t => (t.Id, t.Count)));
			Assert.Empty(electricity.SchoolTierCounts);

			var education = new CatalogView(Fixture, new BuildingCatalogQuery(UiMenu: "Education & Research"));
			Assert.Equal(new[] { ("2", 1) }, education.SchoolTierCounts.Select(t => (t.Id, t.Count)));
		}

		[Fact]
		public void EveryPropertyWalksTheSnapshotOnce()
		{
			// The whole point: fifteen passes per refresh become one over the
			// snapshot plus cheap passes over the (much smaller) menu set.
			var counting = new CountingList(Fixture);
			var view = new CatalogView(counting, new BuildingCatalogQuery(UiMenu: "Electricity"));

			_ = view.Page; _ = view.MetricBounds; _ = view.FacetState; _ = view.MenuCategoryCounts;
			_ = view.StripAxis; _ = view.StripTabs; _ = view.ExpandedCategories; _ = view.SchoolTierCounts;
			_ = view.StripAxis; _ = view.MenuCategoryCounts; _ = view.Page;

			Assert.Equal(1, counting.Walks);
		}
	}
}
