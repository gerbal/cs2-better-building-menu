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
		public void ATabsPositionIsItsPlaceInItsMenusStrip()
		{
			var menus = Menus(
				System.Array.Empty<(int, string, string)>(),
				new() { ["Roads"] = new() { Tab("RoadsSmall", 10), Tab("RoadsRoundabouts", 70), Tab("RoadsCulDeSacs", 70) } });

			Assert.Equal(0, menus.TabPosition("Roads", "RoadsSmall"));
			Assert.Equal(2, menus.TabPosition("Roads", " RoadsCulDeSacs "));
			Assert.Equal(int.MaxValue, menus.TabPosition("Roads", "roadssmall"));
			Assert.Equal(int.MaxValue, menus.TabPosition("Zones", "RoadsSmall"));
			Assert.Equal(int.MaxValue, menus.TabPosition(null, "RoadsSmall"));
			Assert.Equal(int.MaxValue, menus.TabPosition("Roads", null));
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
