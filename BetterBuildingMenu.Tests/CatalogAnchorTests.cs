using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The row a list starts at: its place in the whole order, and a first window that holds it and a step after it.</summary>
	public sealed class CatalogAnchorTests
	{
		private const int Step = BuildingCatalogQuery.WindowStep;

		private static BuildingCatalogEntry Road(int id, string tab = "RoadsHighways", int priority = 0) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: "Road" + id, Name: $"Road {id:D4}", Category: "Networks", SubCategory: "Networks_Roads",
				Thumbnail: "", LotWidth: 2, LotDepth: 2, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
				with { UiMenu = "Roads", UiCategory = tab, UiCategoryPriority = priority };

		/// <summary>Roads named in id order, so sorted by name row N is id N + 1.</summary>
		private static BuildingCatalogEntry[] Roads(int count) => Enumerable.Range(1, count).Select(id => Road(id)).ToArray();

		private static BuildingCatalogQuery ByName(int anchor = 0) => new(SortColumn: "Name", UiMenu: "Roads", AnchorId: anchor);

		/// <summary>Where a row sits in the order a query draws, read from a window that holds them all.</summary>
		private static int PlaceOf(BuildingCatalogEntry[] entries, BuildingCatalogQuery query, int id) =>
			BuildingCatalogQueryEngine.Query(entries, query with { AnchorId = 0, Limit = BuildingCatalogQuery.MaxLimit })
				.Items.Select(entry => entry.Id).ToList().IndexOf(id);

		[Fact]
		public void TheAnchorsPlaceIsItsRowInTheWholeOrderAndMinusOneWithoutIt()
		{
			var anchored = BuildingCatalogQueryEngine.Query(Roads(400), ByName(anchor: 150));

			Assert.Equal(150, anchored.AnchorId);
			Assert.Equal(149, anchored.AnchorIndex);
			Assert.Equal(-1, BuildingCatalogQueryEngine.Query(Roads(400), ByName()).AnchorIndex);
			// An id the result does not hold: a building from another menu.
			Assert.Equal(-1, BuildingCatalogQueryEngine.Query(Roads(400), ByName(anchor: 9999)).AnchorIndex);
		}

		[Fact]
		public void TheFirstWindowHoldsTheAnchoredRowAndAStepAfterIt()
		{
			// A step after it, so the row can sit on the list's first line in any body.
			var page = BuildingCatalogQueryEngine.Query(Roads(400), ByName(anchor: 150));

			Assert.Equal(149 + 1 + Step, page.Limit);
			Assert.Equal(149 + 1 + Step, page.Items.Count);
			Assert.Equal(150, page.Items[149].Id);
			Assert.True(page.HasMore);
			Assert.Equal(BuildingCatalogQuery.DefaultLimit, BuildingCatalogQueryEngine.Query(Roads(400), ByName()).Limit);
		}

		[Fact]
		public void TheWindowStopsAtTheCeilingAndAnAnchorPastItIsNotHeld()
		{
			var near = BuildingCatalogQueryEngine.Query(Roads(3000), ByName(anchor: 1950));
			var past = BuildingCatalogQueryEngine.Query(Roads(3000), ByName(anchor: 2500));

			Assert.Equal(BuildingCatalogQuery.MaxLimit, near.Limit);
			Assert.Equal(1950, near.Items[1949].Id);
			Assert.Equal(BuildingCatalogQuery.MaxLimit, past.Items.Count);
			Assert.Equal(2499, past.AnchorIndex);
			// The list stops before the anchored row and says so; the UI starts it at its top.
			Assert.True(past.Capped);
		}

		[Fact]
		public void AnAnchorTheFiltersRemoveIsNowhereAndGrowsNothing()
		{
			// The armed road is the one unlocked, and the list shows only what is locked.
			var roads = Roads(400).Select(road => road.Id == 150 ? road : road with { IsLocked = true }).ToArray();
			var lockedOnly = ByName(anchor: 150) with { Availability = new[] { BuildingCatalogFacetSelection.Availability.Locked } };

			var page = BuildingCatalogQueryEngine.Query(roads, lockedOnly);

			Assert.Equal(-1, page.AnchorIndex);
			Assert.Equal(BuildingCatalogQuery.DefaultLimit, page.Limit);
			Assert.Equal(149, BuildingCatalogQueryEngine.Query(roads, ByName(anchor: 150)).AnchorIndex);
		}

		[Fact]
		public void TheAnchorsPlaceFollowsTheGrouping()
		{
			// Medium Roads ahead of Highways, so grouping by tab moves a Medium Road up the list.
			var roads = Enumerable.Range(1, 120)
				.Select(id => id % 2 == 0 ? Road(id, "RoadsMediumRoads", priority: 1) : Road(id, "RoadsHighways", priority: 2))
				.ToArray();
			var grouped = ByName(anchor: 2) with { GroupBy = BuildingCatalogGrouping.MenuCategory };

			var page = BuildingCatalogQueryEngine.Query(roads, grouped);

			Assert.True(page.AnchorIndex >= 0);
			Assert.Equal(PlaceOf(roads, grouped, 2), page.AnchorIndex);
			Assert.NotEqual(PlaceOf(roads, ByName(), 2), page.AnchorIndex);
		}

		[Fact]
		public void TheAnchorsPlaceFollowsTheSearch()
		{
			// "road 01" leaves a fraction of the 400, so Road 0150 moves well up from row 149.
			var searched = ByName(anchor: 150) with { SearchText = "road 01" };

			var page = BuildingCatalogQueryEngine.Query(Roads(400), searched);

			Assert.True(page.AnchorIndex >= 0);
			Assert.Equal(PlaceOf(Roads(400), searched, 150), page.AnchorIndex);
			Assert.NotEqual(149, page.AnchorIndex);
		}

		[Fact]
		public void ThePageWritesTheAnchorAndTheStart()
		{
			var page = new BuildingCatalogPage(Array.Empty<BuildingCatalogEntry>(), 0, 0, 100, AnchorId: 150, AnchorIndex: 149, ListStart: 3);
			RecordingJsonWriter writer = new();

			page.Write(writer);

			var at = writer.Tokens.IndexOf("PropertyName:anchorId");
			Assert.Equal(
				new[] { "PropertyName:anchorId", "Write:Int32:150", "PropertyName:anchorIndex", "Write:Int32:149", "PropertyName:listStart", "Write:Int32:3" },
				writer.Tokens.Skip(at).Take(6));
		}
	}
}
