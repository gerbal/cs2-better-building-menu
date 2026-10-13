using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The labels a page carries over its whole result, and a half-locked tab's order.</summary>
	public sealed class CatalogSectionsTests
	{
		private static BuildingCatalogEntry Entry(int id, string tab, int order, bool locked = false, int milestone = 0, int tabIndex = 0) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: "Prefab" + id, Name: "Road " + id, Category: "Networks", SubCategory: "Networks_Roads",
				Thumbnail: "", LotWidth: 0, LotDepth: 0, BuildingLevel: 0, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
			with { UiMenu = "Roads", UiCategory = tab, UiCategoryTab = tabIndex, UIOrder = order, IsLocked = locked, UnlockMilestone = milestone };

		private static readonly BuildingCatalogEntry[] Roads =
		{
			Entry(1, "RoadsSmallRoads", 1),
			Entry(2, "RoadsSmallRoads", 2),
			Entry(3, "RoadsSmallRoads", 3),
			Entry(4, "RoadsMediumRoads", 1, tabIndex: 1),
			Entry(5, "RoadsMediumRoads", 2, tabIndex: 1),
		};

		/// <summary>A tab whose rows are half locked or more, in the game's order: locked, open, locked, open, locked.</summary>
		private static readonly BuildingCatalogEntry[] Parking =
		{
			Entry(11, "RoadsParking", 1, locked: true, milestone: 5),
			Entry(12, "RoadsParking", 2),
			Entry(13, "RoadsParking", 3, locked: true, milestone: 2),
			Entry(14, "RoadsParking", 4),
			Entry(15, "RoadsParking", 5, locked: true, milestone: 2),
		};

		private static BuildingCatalogGrouping.GroupLabels TabLabels(BuildingCatalogEntry entry) =>
			BuildingCatalogGrouping.Labels(entry, BuildingCatalogGrouping.MenuCategory);

		[Fact]
		public void AllGroupedByTabCarriesOneSectionPerGroupWithItsTrueCount()
		{
			// A window of two rows still names both groups and counts each whole.
			var page = BuildingCatalogQueryEngine.Query(
				Roads,
				new BuildingCatalogQuery(UiMenu: "Roads", GroupBy: BuildingCatalogGrouping.MenuCategory, Limit: 2),
				TabLabels);

			Assert.Equal(2, page.Items.Count);
			Assert.Collection(
				page.Sections,
				small => Assert.Equal((CatalogSection.Group, "Small Roads", "RoadsSmallRoads", 0, 3), (small.Kind, small.Label, small.LabelId, small.Start, small.Count)),
				medium => Assert.Equal((CatalogSection.Group, "Medium Roads", "RoadsMediumRoads", 3, 2), (medium.Kind, medium.Label, medium.LabelId, medium.Start, medium.Count)));
		}

		[Fact]
		public void AResultOfOneGroupOrNoneCarriesNoSection()
		{
			var tab = BuildingCatalogQueryEngine.Query(
				Roads,
				new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsSmallRoads", GroupBy: BuildingCatalogGrouping.MenuCategory),
				TabLabels);
			var ungrouped = BuildingCatalogQueryEngine.Query(Roads, new BuildingCatalogQuery(UiMenu: "Roads", GroupBy: BuildingCatalogGrouping.None));

			Assert.Empty(tab.Sections);
			Assert.Empty(ungrouped.Sections);
		}

		[Fact]
		public void AHalfLockedTabListsItsBuildableRowsFirstThenItsLockedRowsByMilestone()
		{
			var page = BuildingCatalogQueryEngine.Query(Parking, new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsParking"));

			Assert.Equal(new[] { 12, 14, 13, 15, 11 }, page.Items.Select(entry => entry.Id));
			var locked = Assert.Single(page.Sections);
			Assert.Equal((CatalogSection.LockedId, CatalogSection.Locked, 2, 3, false), (locked.Id, locked.Kind, locked.Start, locked.Count, locked.Collapsed));
		}

		[Fact]
		public void ATabUnderHalfLockedKeepsTheGamesOrder()
		{
			var mostlyOpen = Parking.Take(4).Select(entry => entry.Id == 13 ? entry with { IsLocked = false } : entry).ToArray();

			var page = BuildingCatalogQueryEngine.Query(mostlyOpen, new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsParking"));

			Assert.Equal(new[] { 11, 12, 13, 14 }, page.Items.Select(entry => entry.Id));
			Assert.Empty(page.Sections);
		}

		[Theory]
		[InlineData("", "Default", false, "")]
		[InlineData("RoadsParking", "ConstructionCost", false, "")]
		[InlineData("RoadsParking", "Default", true, "")]
		[InlineData("RoadsParking", "Match", false, "road")]
		public void ALockedOrderWaitsForATabTheGamesOwnOrderAndNoSearch(string tab, string sort, bool descending, string search)
		{
			var page = BuildingCatalogQueryEngine.Query(
				Parking,
				new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: tab, SortColumn: sort, Descending: descending, SearchText: search));

			Assert.DoesNotContain(page.Sections, section => section.Kind == CatalogSection.Locked);
			Assert.NotEqual(new[] { 12, 14, 13, 15, 11 }, page.Items.Select(entry => entry.Id));
		}

		[Fact]
		public void CollapsedLockedRowsLeaveTheWindowAndTheirLabelKeepsTheirCount()
		{
			var page = BuildingCatalogQueryEngine.Query(Parking, new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsParking", LockedCollapsed: true));

			Assert.Equal(new[] { 12, 14 }, page.Items.Select(entry => entry.Id));
			Assert.Equal(5, page.TotalCount);
			Assert.False(page.HasMore);
			var locked = Assert.Single(page.Sections);
			Assert.Equal((2, 3, true), (locked.Start, locked.Count, locked.Collapsed));
		}

		[Fact]
		public void ThePageWritesEachSection()
		{
			var writer = new RecordingJsonWriter();
			var page = BuildingCatalogQueryEngine.Query(Parking, new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsParking"));

			page.Write(writer);

			Assert.Contains("sections", writer.PropertyNames);
			Assert.Equal(
				new[] { "id", "kind", "label", "labelId", "start", "count", "collapsed" },
				writer.PropertyNames.SkipWhile(name => name != "sections").Skip(1).Take(7));
		}

		[Fact]
		public void CollapsingTheLockedRowsKeepsTheWindowAndAnyNewStartOpensThemAgain()
		{
			var state = AssetMenuState.Initial.SelectMenu("Roads").SelectCategory("RoadsParking");

			var collapsed = state.CollapseSection(CatalogSection.LockedId, true);

			Assert.True(collapsed.Query.LockedCollapsed);
			Assert.Equal(state.ListStart, collapsed.ListStart);
			Assert.Equal(state.Query.Limit, collapsed.Query.Limit);
			Assert.Same(collapsed, collapsed.CollapseSection(CatalogSection.LockedId, true));
			Assert.Same(state, state.CollapseSection("group:0", true));
			Assert.False(collapsed.CollapseSection(CatalogSection.LockedId, false).Query.LockedCollapsed);
			Assert.False(collapsed.SelectCategory("RoadsSmallRoads").Query.LockedCollapsed);
			Assert.False(collapsed.ToggleFacet("availability", "Locked").Query.LockedCollapsed);
			Assert.False(collapsed.Search("road").Query.LockedCollapsed);
			Assert.False(collapsed.SetSortColumn("ConstructionCost").Query.LockedCollapsed);
			Assert.False(collapsed.SetGroupBy(BuildingCatalogGrouping.MenuCategory).Query.LockedCollapsed);
			Assert.False(collapsed.OpenMenu("Roads", _ => new MenuOpening("RoadsParking", -1, 0)).Query.LockedCollapsed);
			Assert.True(collapsed.LoadMore().Query.LockedCollapsed);
		}

		[Fact]
		public void CollapsingTheLockedRowsLeavesTheAnchorWhereItIs()
		{
			// A fold is no start: the anchor stays, and the page places it in what the window can reach.
			var state = AssetMenuState.Initial.SelectMenu("Roads").SelectCategory("RoadsSmallRoads").SelectCategory("RoadsParking", armed: 14);

			var collapsed = state.CollapseSection(CatalogSection.LockedId, true);
			var page = BuildingCatalogQueryEngine.Query(Parking, collapsed.Query);

			Assert.Equal(14, state.Anchor);
			Assert.Equal(14, collapsed.Anchor);
			Assert.Equal(1, page.AnchorIndex);
		}

		[Fact]
		public void AFoldedTabOverAWindowOffersOnlyTheRowsThatCanLoad()
		{
			// 130 buildable rows and 140 locked: folded, the window reaches the 130 and no further.
			var tab = Enumerable.Range(1, 270)
				.Select(id => Entry(id, "RoadsParking", id, locked: id > 130, milestone: 1))
				.ToArray();

			var page = BuildingCatalogQueryEngine.Query(tab, new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsParking", LockedCollapsed: true));
			var grown = BuildingCatalogQueryEngine.Query(tab, new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsParking", Limit: 200, LockedCollapsed: true));

			Assert.Equal((270, 130, 100, true), (page.TotalCount, page.VisibleCount, page.Items.Count, page.HasMore));
			Assert.Equal((130, 130, false), (grown.VisibleCount, grown.Items.Count, grown.HasMore));
			Assert.All(grown.Items, entry => Assert.False(entry.IsLocked));
		}

		[Fact]
		public void AnUnfoldedPageCanReachEveryRow()
		{
			var page = BuildingCatalogQueryEngine.Query(Parking, new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsParking"));
			var seed = new BuildingCatalogPage(System.Array.Empty<BuildingCatalogEntry>(), 7, 0, 100);

			Assert.Equal(5, page.VisibleCount);
			Assert.Equal(7, seed.VisibleCount);
		}
	}
}
