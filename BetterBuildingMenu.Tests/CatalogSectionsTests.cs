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

		[Fact]
		public void ATabExactlyHalfLockedListsItsLockedRowsLast()
		{
			// Two of four: half is enough.
			var page = BuildingCatalogQueryEngine.Query(Parking.Take(4), new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsParking"));

			Assert.Equal(new[] { 12, 14, 13, 11 }, page.Items.Select(entry => entry.Id));
			var locked = Assert.Single(page.Sections);
			Assert.Equal((CatalogSection.Locked, 2, 2), (locked.Kind, locked.Start, locked.Count));
		}

		[Fact]
		public void ATabJustUnderHalfLockedKeepsTheGamesOrder()
		{
			// Two of five: under half.
			var mostlyOpen = Parking.Select(entry => entry.Id == 15 ? entry with { IsLocked = false } : entry).ToArray();

			var page = BuildingCatalogQueryEngine.Query(mostlyOpen, new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsParking"));

			Assert.Equal(new[] { 11, 12, 13, 14, 15 }, page.Items.Select(entry => entry.Id));
			Assert.Empty(page.Sections);
		}

		[Fact]
		public void ATabUnderItsMenusOwnGroupingStillListsItsLockedRowsLast()
		{
			// The game's view groups a tabbed menu by tab, and a tab is one group of it.
			var page = BuildingCatalogQueryEngine.Query(
				Parking,
				new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsParking", GroupBy: BuildingCatalogGrouping.MenuCategory),
				TabLabels);

			Assert.Equal(new[] { 12, 14, 13, 15, 11 }, page.Items.Select(entry => entry.Id));
			Assert.Equal(CatalogSection.Locked, Assert.Single(page.Sections).Kind);
		}

		[Fact]
		public void ATabAGroupingSplitsKeepsItsGroupsAndNoLockedOrder()
		{
			var priced = Parking.Select(entry => entry with { ConstructionCost = entry.Id <= 12 ? 1_000d : 50_000d }).ToArray();

			var page = BuildingCatalogQueryEngine.Query(
				priced,
				new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsParking", GroupBy: BuildingCatalogGrouping.Cost));

			Assert.Equal(new[] { 11, 12, 13, 14, 15 }, page.Items.Select(entry => entry.Id));
			Assert.Collection(
				page.Sections,
				cheap => Assert.Equal((CatalogSection.Group, 0, 2), (cheap.Kind, cheap.Start, cheap.Count)),
				dear => Assert.Equal((CatalogSection.Group, 2, 3), (dear.Kind, dear.Start, dear.Count)));
		}

		[Fact]
		public void AStripTabOrASchoolLevelStandsForATab()
		{
			var branched = Parking.Select(entry => entry with { DevTreeBranch = "Basic", EducationLevel = 2 }).ToArray();

			var strip = BuildingCatalogQueryEngine.Query(branched, new BuildingCatalogQuery(UiMenu: "Roads", StripTabs: new[] { "Basic" }));
			var level = BuildingCatalogQueryEngine.Query(branched, new BuildingCatalogQuery(UiMenu: "Roads", SchoolTier: 2));

			Assert.Equal(new[] { 12, 14, 13, 15, 11 }, strip.Items.Select(entry => entry.Id));
			Assert.Equal(new[] { 12, 14, 13, 15, 11 }, level.Items.Select(entry => entry.Id));
		}

		[Fact]
		public void RowsLockedBehindTheTreeAloneLeadTheLockedRows()
		{
			// A locked row whose milestone is reached, or that has none, waits on the tree: nearest to opening.
			var withTreeRow = Parking.Append(Entry(16, "RoadsParking", 6, locked: true, milestone: 0)).ToArray();

			var page = BuildingCatalogQueryEngine.Query(withTreeRow, new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsParking"));

			Assert.Equal(new[] { 12, 14, 16, 13, 15, 11 }, page.Items.Select(entry => entry.Id));
		}

		[Fact]
		public void AWhollyLockedTabFoldedKeepsItsLabelAndItsCount()
		{
			var allLocked = Parking.Select(entry => entry with { IsLocked = true }).ToArray();

			var page = BuildingCatalogQueryEngine.Query(allLocked, new BuildingCatalogQuery(UiMenu: "Roads", UiCategory: "RoadsParking", LockedCollapsed: true));

			Assert.Empty(page.Items);
			Assert.Equal((5, 0, false), (page.TotalCount, page.VisibleCount, page.HasMore));
			var locked = Assert.Single(page.Sections);
			Assert.Equal((0, 5, true), (locked.Start, locked.Count, locked.Collapsed));
			Assert.Equal(AssetMenuState.Ready, AssetMenuState.GetPageStatus(true, page.TotalCount));
		}

		[Theory]
		[InlineData("", "Default", false, "")]
		[InlineData("RoadsParking", "ConstructionCost", false, "")]
		[InlineData("RoadsParking", "Default", true, "")]
		[InlineData("RoadsParking", "Default", false, "road")]
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
			Assert.True(collapsed.SetScreenSlots(40).Query.LockedCollapsed);
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
