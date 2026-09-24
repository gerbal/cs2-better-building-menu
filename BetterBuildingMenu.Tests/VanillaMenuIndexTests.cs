using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

using System.Collections.Generic;
using System.Linq;

using Unity.Entities;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The game's build menus as an index carries them, and the adapter reading them from there.
	/// </summary>
	/// <remarks>
	/// Each test builds its own menus, which is the point of the move: two indexes read two
	/// sets of menus, and nothing a test builds is seen by another.
	/// </remarks>
	public sealed class VanillaMenuIndexTests
	{
		private static VanillaMenuCategory Tab(string id, int priority = 0) => new(id, id, string.Empty, priority);

		/// <summary>Menus placing each asset by (id, menu, category), with the tabs given per menu.</summary>
		private static VanillaMenuIndex Menus(
			(int Id, string Menu, string Category)[] placements,
			Dictionary<string, List<VanillaMenuCategory>>? categories = null,
			string[]? menuOrder = null,
			Dictionary<string, Entity>? menuEntities = null,
			Dictionary<int, string>? menuNames = null) =>
			new(
				placements.ToDictionary(placement => placement.Id, placement => new VanillaMenuPlacement(default, placement.Menu, placement.Category)),
				menuNames ?? new Dictionary<int, string>(),
				menuEntities ?? new Dictionary<string, Entity>(),
				(menuOrder ?? System.Array.Empty<string>()).Select(menu => Tab(menu)).ToArray(),
				categories ?? new Dictionary<string, List<VanillaMenuCategory>>());

		private static CatalogIndex ReadyIndex(VanillaMenuIndex menus, params PrefabIndex[] entries) =>
			TestPrefabs.ReadyIndex(new CatalogIndex(menus), entries);

		[Fact]
		public void TheEmptyMenusPlaceNothingAndDrawNothing()
		{
			var menus = new CatalogIndex().Menus;

			Assert.False(menus.IsPlaced(1));
			Assert.False(menus.IsPlacedIn(1, "Roads"));
			Assert.False(menus.TryGetCategory(1, out _));
			Assert.False(menus.TryGetMenuEntity("Roads", out _));
			Assert.Null(menus.MenuName(1));
			Assert.Empty(menus.AssetMenus());
			Assert.Empty(menus.CategoriesOf("Roads"));
		}

		[Fact]
		public void APlacementsMenuMatchesIgnoringCaseAndItsOwnSpaces()
		{
			var menus = Menus(new[] { (1, " Landscaping ", "Terraforming") });

			Assert.True(menus.IsPlaced(1));
			Assert.True(menus.IsPlacedIn(1, "landscaping"));
			Assert.False(menus.IsPlacedIn(1, "Roads"));
			Assert.False(menus.IsPlaced(2));
		}

		[Fact]
		public void ACategoryIsTrimmedAndABlankOneIsNone()
		{
			var menus = Menus(new[] { (1, "Landscaping", " Terraforming "), (2, "Landscaping", "  ") });

			Assert.True(menus.TryGetCategory(1, out var category));
			Assert.Equal("Terraforming", category);
			Assert.False(menus.TryGetCategory(2, out _));
		}

		[Fact]
		public void AMenuEntityIsFoundByItsTrimmedNameIgnoringCase()
		{
			// A plain dictionary: the index ignores case whatever the caller built.
			var entities = new Dictionary<string, Entity>
			{
				["Roads"] = new Entity { Index = 7, Version = 3 },
			};
			var menus = Menus(System.Array.Empty<(int, string, string)>(), menuEntities: entities, menuNames: new() { [7] = "Roads" });

			Assert.True(menus.TryGetMenuEntity(" roads ", out var entity));
			Assert.Equal(7, entity.Index);
			Assert.Equal(3, entity.Version);
			Assert.False(menus.TryGetMenuEntity("  ", out _));
			Assert.Equal("Roads", menus.MenuName(7));
		}

		[Fact]
		public void OnlyAMenuWithTabsIsListed()
		{
			var menus = Menus(
				System.Array.Empty<(int, string, string)>(),
				new() { ["Roads"] = new() { Tab("RoadsSmall") }, ["Zones"] = new() { Tab("ZonesResidential") } },
				menuOrder: new[] { "Zones", "Empty", "Roads" });

			Assert.Equal(new[] { "Zones", "Roads" }, menus.AssetMenus().Select(menu => menu.Id));
			Assert.Empty(menus.CategoriesOf("Empty"));
			Assert.Empty(menus.CategoriesOf(null));
		}

		[Fact]
		public void ATabIsItsPlaceAndPriorityInItsMenusStrip()
		{
			var menus = Menus(
				System.Array.Empty<(int, string, string)>(),
				new() { ["Roads"] = new() { Tab("RoadsSmall", 10), Tab("RoadsRoundabouts", 70), Tab("RoadsCulDeSacs", 70) } });

			Assert.Equal((0, 10), menus.TabOf("Roads", "RoadsSmall"));
			Assert.Equal((2, 70), menus.TabOf("Roads", " RoadsCulDeSacs "));
			Assert.Null(menus.TabOf("Roads", "roadssmall"));
			Assert.Null(menus.TabOf("Zones", "RoadsSmall"));
			Assert.Null(menus.TabOf(null, "RoadsSmall"));
			Assert.Null(menus.TabOf("Roads", null));
		}

		/// <summary>The adapter hands each entry its tab's place in the strip, so the All tab's
		/// headings break a priority tie the way the strip does rather than by name.</summary>
		[Fact]
		public void TheAllTabsHeadingsFollowTheStripOnATie()
		{
			PrefabIndex Placed(int id, string category)
			{
				var entry = TestPrefabs.Entry(id, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);
				entry.UiMenuName = "Roads";
				entry.UiCategoryName = category;
				entry.UiCategoryPriority = 70;
				return entry;
			}

			var index = ReadyIndex(
				Menus(
					new[] { (41, "Roads", "RoadsRoundabouts"), (42, "Roads", "RoadsCulDeSacs") },
					new() { ["Roads"] = new() { Tab("RoadsRoundabouts", 70), Tab("RoadsCulDeSacs", 70) } },
					menuOrder: new[] { "Roads" }),
				Placed(42, "RoadsCulDeSacs"),
				Placed(41, "RoadsRoundabouts"));

			var items = new BuildingCatalogAdapter()
				.Build(
					new CatalogSource(index, new PlacedUniques(), 1),
					new BuildingCatalogQuery(GroupBy: BuildingCatalogGrouping.MenuCategory, UiMenu: "Roads"),
					VanillaToolbarSelection.None)
				.Page.Items;

			Assert.Equal(new[] { "RoadsRoundabouts", "RoadsCulDeSacs" }, items.Select(item => item.UiCategory));
			Assert.Equal(new[] { 0, 1 }, items.Select(item => item.UiCategoryTab));
		}

		private static PrefabIndex PlacedIn(int id, string menu, string category, int priority)
		{
			var entry = TestPrefabs.Entry(id, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);
			entry.UiMenuName = menu;
			entry.UiCategoryName = category;
			entry.UiCategoryPriority = priority;
			return entry;
		}

		private static BuildingCatalogEntry[] Grouped(CatalogIndex index, string menu) =>
			new BuildingCatalogAdapter()
				.Build(
					new CatalogSource(index, new PlacedUniques(), 1),
					new BuildingCatalogQuery(GroupBy: BuildingCatalogGrouping.MenuCategory, UiMenu: menu),
					VanillaToolbarSelection.None)
				.Page.Items.ToArray();

		/// <summary>An asset a mod moved into a tab keeps its old group's priority on its prefab;
		/// the strip's priority is the one its heading ranks by, so the tab is one heading.</summary>
		[Fact]
		public void AMovedAssetRanksByTheTabItWasMovedTo()
		{
			var index = ReadyIndex(
				Menus(
					new[] { (1, "Roads", "RoadsSmall"), (2, "Roads", "RoadsRoundabouts"), (3, "Roads", "RoadsCulDeSacs"), (4, "Roads", "RoadsCulDeSacs") },
					new() { ["Roads"] = new() { Tab("RoadsSmall", 10), Tab("RoadsRoundabouts", 70), Tab("RoadsCulDeSacs", 70) } },
					menuOrder: new[] { "Roads" }),
				PlacedIn(1, "Roads", "RoadsSmall", 10),
				PlacedIn(2, "Roads", "RoadsRoundabouts", 70),
				PlacedIn(3, "Roads", "RoadsCulDeSacs", 70),
				// Moved from RoadsSmall: its managed group still says 10.
				PlacedIn(4, "Roads", "RoadsCulDeSacs", 10));

			var items = Grouped(index, "Roads");

			Assert.Equal(
				new[] { "RoadsSmall", "RoadsRoundabouts", "RoadsCulDeSacs", "RoadsCulDeSacs" },
				items.Select(item => item.UiCategory));
			Assert.All(items.Where(item => item.UiCategory == "RoadsCulDeSacs"), item => Assert.Equal(70, item.UiCategoryPriority));
		}

		[Fact]
		public void EachMenusHeadingsFollowItsOwnStrip()
		{
			var index = ReadyIndex(
				Menus(
					new[] { (5, "Landscaping", "LandscapingPiersAndQuays"), (6, "Landscaping", "LandscapingBikePaths") },
					new()
					{
						["Roads"] = new() { Tab("LandscapingBikePaths", 1), Tab("LandscapingPiersAndQuays", 2) },
						["Landscaping"] = new() { Tab("LandscapingPiersAndQuays", 31), Tab("LandscapingBikePaths", 31) },
					},
					menuOrder: new[] { "Roads", "Landscaping" }),
				PlacedIn(6, "Landscaping", "LandscapingBikePaths", 31),
				PlacedIn(5, "Landscaping", "LandscapingPiersAndQuays", 31));

			Assert.Equal(
				new[] { "LandscapingPiersAndQuays", "LandscapingBikePaths" },
				Grouped(index, "Landscaping").Select(item => item.UiCategory));
		}

		/// <summary>With no menu there is no one strip, so no position is compared.</summary>
		[Fact]
		public void TheUnscopedCatalogComparesNoTabPositions()
		{
			var index = ReadyIndex(
				Menus(
					new[] { (1, "Roads", "RoadsRoundabouts") },
					new() { ["Roads"] = new() { Tab("RoadsRoundabouts", 70) } },
					menuOrder: new[] { "Roads" }),
				PlacedIn(1, "Roads", "RoadsRoundabouts", 70));

			var item = Assert.Single(Grouped(index, string.Empty));

			Assert.Equal(int.MaxValue, item.UiCategoryTab);
			Assert.Equal(70, item.UiCategoryPriority);
		}

		[Fact]
		public void EachIndexReadsItsOwnMenus()
		{
			var placed = new CatalogIndex(Menus(new[] { (1, "Landscaping", "Terraforming") }));
			var unplaced = new CatalogIndex();

			Assert.True(placed.Menus.IsPlaced(1));
			Assert.False(unplaced.Menus.IsPlaced(1));
		}

		[Fact]
		public void AMenuHoldsWhatItsIndexPlacesThere()
		{
			var brush = TestPrefabs.Entry(21, PrefabCategory.Props, PrefabSubCategory.Props_Misc);
			var placed = ReadyIndex(Menus(new[] { (21, "Landscaping", "Terraforming") }), brush);
			var unplaced = ReadyIndex(Menus(System.Array.Empty<(int, string, string)>()), brush);

			Assert.True(BuildingCatalogAdapter.MenuHasAssets(placed, "Landscaping", VanillaToolbarSelection.None));
			Assert.False(BuildingCatalogAdapter.MenuHasAssets(placed, "Roads", VanillaToolbarSelection.None));
			Assert.False(BuildingCatalogAdapter.MenuHasAssets(unplaced, "Landscaping", VanillaToolbarSelection.None));
		}

		[Fact]
		public void TheUnscopedCatalogListsANonBuildingOnlyWhenItsIndexPlacesIt()
		{
			var brush = TestPrefabs.Entry(21, PrefabCategory.Props, PrefabSubCategory.Props_Misc);

			int[] Listed(CatalogIndex index) => new BuildingCatalogAdapter()
				.Build(new CatalogSource(index, new PlacedUniques(), 1), new BuildingCatalogQuery(), VanillaToolbarSelection.None)
				.Page.Items.Select(item => item.Id).ToArray();

			Assert.Equal(new[] { 21 }, Listed(ReadyIndex(Menus(new[] { (21, "Landscaping", "Terraforming") }), brush)));
			Assert.Empty(Listed(ReadyIndex(Menus(System.Array.Empty<(int, string, string)>()), brush)));
		}

		[Fact]
		public void RoadsGathersANetworkOnlyWhenItsIndexPlacesItSomewhere()
		{
			var tram = TestPrefabs.Entry(31, PrefabCategory.Networks, PrefabSubCategory.Networks_Tracks);
			tram.UiMenuName = "Transportation";

			Assert.True(BuildingCatalogAdapter.MenuHasAssets(
				ReadyIndex(Menus(new[] { (31, "Transportation", "TransportationTram") }), tram),
				NetworkMenuExtension.RoadsMenu,
				VanillaToolbarSelection.None));
			Assert.False(BuildingCatalogAdapter.MenuHasAssets(
				ReadyIndex(Menus(System.Array.Empty<(int, string, string)>()), tram),
				NetworkMenuExtension.RoadsMenu,
				VanillaToolbarSelection.None));
		}

		[Fact]
		public void AMenusTabsAreItsOwnExceptRoads()
		{
			var tram = TestPrefabs.Entry(31, PrefabCategory.Networks, PrefabSubCategory.Networks_Tracks);
			tram.UiMenuName = "Transportation";
			var road = TestPrefabs.Entry(32, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);
			road.UiMenuName = NetworkMenuExtension.RoadsMenu;
			var index = ReadyIndex(
				Menus(
					System.Array.Empty<(int, string, string)>(),
					new()
					{
						[NetworkMenuExtension.RoadsMenu] = new() { Tab("RoadsSmall") },
						["Transportation"] = new() { Tab("TransportationTram") },
					}),
				tram,
				road);

			Assert.Equal(new[] { "TransportationTram" }, index.GetMenuCategories("Transportation").Select(tab => tab.Id));
			// Tracks arrive through the extension and get a tab; roads already have the game's.
			Assert.Equal(
				new[] { "RoadsSmall", NetworkMenuExtension.GroupId(nameof(PrefabSubCategory.Networks_Tracks)) },
				index.GetMenuCategories(NetworkMenuExtension.RoadsMenu).Select(tab => tab.Id));
			Assert.Empty(index.GetMenuCategories("Zones"));
		}

		[Fact]
		public void RoadsWithoutTabsOfItsOwnGetsNoExtras()
		{
			var tram = TestPrefabs.Entry(31, PrefabCategory.Networks, PrefabSubCategory.Networks_Tracks);
			tram.UiMenuName = "Transportation";

			Assert.Empty(ReadyIndex(Menus(System.Array.Empty<(int, string, string)>()), tram)
				.GetMenuCategories(NetworkMenuExtension.RoadsMenu));
		}
	}
}
