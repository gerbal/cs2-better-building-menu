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
				placements.ToDictionary(placement => placement.Id, placement => new VanillaMenuPlacement(default, placement.Menu, placement.Category, CategoryPriority: 0)),
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

		/// <summary>A partial pass can place an asset in a category that had no tab at the last full
		/// pass. The placement brings the category's own priority, so an asset moved there from
		/// another tab ranks with the category's own assets, and the heading stays whole, in the
		/// menu's view and in the unscoped one.</summary>
		[Fact]
		public void AMovedAssetUnderATabTheStripDoesNotDrawKeepsOneHeading()
		{
			var menus = new VanillaMenuIndex(
				new Dictionary<int, VanillaMenuPlacement>
				{
					[1] = new(default, "Roads", "RoadsSmall", CategoryPriority: 10),
					[2] = new(default, "Roads", "RoadsMedium", CategoryPriority: 20),
					[3] = new(default, "Roads", "ModRoads", CategoryPriority: 40),
					[4] = new(default, "Roads", "ModRoads", CategoryPriority: 40),
				},
				new Dictionary<int, string>(),
				new Dictionary<string, Entity>(),
				new[] { Tab("Roads") },
				// No ModRoads tab: the strip was read before anything was in it.
				new Dictionary<string, List<VanillaMenuCategory>> { ["Roads"] = new() { Tab("RoadsSmall", 10), Tab("RoadsMedium", 20) } });

			// As AddPrefab files an asset: its managed group, overridden by where the game places it.
			PrefabIndex Filed(int id, string groupCategory, int groupPriority)
			{
				var entry = TestPrefabs.Entry(id, PrefabCategory.Networks, PrefabSubCategory.Networks_Roads);
				var placed = menus.Placements[id];
				(entry.UiCategoryName, entry.UiMenuName, entry.UiCategoryPriority) = MenuPlacementOverride.Resolve(
					groupCategory, "Roads", groupPriority, placed.Category, placed.Menu, placed.CategoryPriority);
				return entry;
			}

			var index = ReadyIndex(
				menus,
				Filed(1, "RoadsSmall", 10),
				Filed(2, "RoadsMedium", 20),
				Filed(3, "ModRoads", 40),
				// Moved from RoadsSmall: its managed group still says 10.
				Filed(4, "RoadsSmall", 10));

			var scoped = Grouped(index, "Roads");

			Assert.Equal(
				new[] { "RoadsSmall", "RoadsMedium", "ModRoads", "ModRoads" },
				scoped.Select(item => item.UiCategory));

			foreach (var view in new[] { scoped, Grouped(index, string.Empty) })
			{
				Assert.Single(view
					.Where(item => item.UiCategory == "ModRoads")
					.Select(item => BuildingCatalogGrouping.PrimaryKey(item, BuildingCatalogGrouping.MenuCategory))
					.Distinct());
			}
		}

		/// <summary>A partial pass files every entry the game places under its placement now, re-read
		/// or not, and leaves an entry it no longer places as it was.</summary>
		[Fact]
		public void APartialPassFilesEveryPlacedEntryUnderItsPlacementNow()
		{
			var index = ReadyIndex(
				Menus(new[] { (1, "Roads", "Pathways"), (2, "Roads", "Pathways") }),
				PlacedIn(1, "Roads", "Pathways", 66),
				PlacedIn(2, "Roads", "Pathways", 66));

			index.RefreshPlacements(new Dictionary<int, VanillaMenuPlacement>
			{
				[1] = new(default, "Terraforming", "Pathways", CategoryPriority: 30),
			});

			var moved = index.Get(1);
			var dropped = index.Get(2);
			Assert.NotNull(moved);
			Assert.NotNull(dropped);
			Assert.Equal(("Pathways", "Terraforming", 30), (moved.UiCategoryName, moved.UiMenuName, moved.UiCategoryPriority));
			Assert.Equal(("Pathways", "Roads", 66), (dropped.UiCategoryName, dropped.UiMenuName, dropped.UiCategoryPriority));
		}

		/// <summary>Asset UI Manager moves a whole category to another menu, at a new priority, and
		/// marks nothing changed, so a partial pass re-reads only the prefabs something else touched.
		/// The category must still be one heading in its new menu.</summary>
		[Fact]
		public void ACategoryAModMovesStaysOneHeadingWhenAPartialPassRereadsPartOfIt()
		{
			var index = ReadyIndex(
				Menus(
					new[] { (1, "Roads", "Pathways"), (2, "Roads", "Pathways"), (3, "Terraforming", "TerraformingTools") },
					new()
					{
						["Roads"] = new() { Tab("RoadsSmall", 10), Tab("Pathways", 66) },
						["Terraforming"] = new() { Tab("TerraformingTools", 10) },
					},
					menuOrder: new[] { "Roads", "Terraforming" }),
				PlacedIn(1, "Roads", "Pathways", 66),
				PlacedIn(2, "Roads", "Pathways", 66),
				PlacedIn(3, "Terraforming", "TerraformingTools", 10));

			index.RefreshPlacements(new Dictionary<int, VanillaMenuPlacement>
			{
				[1] = new(default, "Terraforming", "Pathways", CategoryPriority: 30),
				[2] = new(default, "Terraforming", "Pathways", CategoryPriority: 30),
				[3] = new(default, "Terraforming", "TerraformingTools", CategoryPriority: 10),
			});

			// The pass re-read the first pathway for some other reason, and AddPrefab filed it from
			// its managed group and its placement.
			var reread = index.Get(1);
			Assert.NotNull(reread);
			var placed = index.Menus.Placements[1];
			(reread.UiCategoryName, reread.UiMenuName, reread.UiCategoryPriority) = MenuPlacementOverride.Resolve(
				"Pathways", "Roads", 66, placed.Category, placed.Menu, placed.CategoryPriority);

			var items = Grouped(index, "Terraforming");

			Assert.Equal(new[] { "TerraformingTools", "Pathways", "Pathways" }, items.Select(item => item.UiCategory));
			Assert.Single(items
				.Where(item => item.UiCategory == "Pathways")
				.Select(item => BuildingCatalogGrouping.PrimaryKey(item, BuildingCatalogGrouping.MenuCategory))
				.Distinct());
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
		public void PlacementsReadAgainKeepTheMenusAndTheirTabs()
		{
			var menus = Menus(
				new[] { (1, "Roads", "RoadsSmall") },
				new() { ["Roads"] = new() { Tab("RoadsSmall") } },
				menuOrder: new[] { "Roads" },
				menuEntities: new() { ["Roads"] = new Entity { Index = 7, Version = 3 } },
				menuNames: new() { [7] = "Roads" });

			var refreshed = menus.WithPlacements(new Dictionary<int, VanillaMenuPlacement>
			{
				[2] = new(default, "Roads", "RoadsMedium", CategoryPriority: 0),
			});

			Assert.True(refreshed.IsPlacedIn(2, "Roads"));
			Assert.True(refreshed.TryGetCategory(2, out var category));
			Assert.Equal("RoadsMedium", category);
			Assert.False(refreshed.IsPlaced(1));
			Assert.Equal(new[] { "Roads" }, refreshed.AssetMenus().Select(menu => menu.Id));
			Assert.Equal(new[] { "RoadsSmall" }, refreshed.CategoriesOf("Roads").Select(tab => tab.Id));
			Assert.True(refreshed.TryGetMenuEntity(" roads ", out var entity));
			Assert.Equal(7, entity.Index);
			Assert.Equal("Roads", refreshed.MenuName(7));

			// A copy: whoever holds the old table keeps reading it.
			Assert.True(menus.IsPlaced(1));
			Assert.False(menus.IsPlaced(2));
		}

		[Fact]
		public void ARecreatedPrefabIsBackInItsMenuOnceThePlacementsAreReadAgain()
		{
			// The game recreated entity 21 as 22: the index holds the new entry, and the
			// placements it was built with still name the old entity.
			var brush = TestPrefabs.Entry(22, PrefabCategory.Props, PrefabSubCategory.Props_Misc);
			var index = ReadyIndex(Menus(new[] { (21, "Landscaping", "Terraforming") }), brush);
			var before = index.Menus;

			Assert.False(BuildingCatalogAdapter.MenuHasAssets(index, "Landscaping", VanillaToolbarSelection.None));

			index.RefreshPlacements(new Dictionary<int, VanillaMenuPlacement>
			{
				[22] = new(default, "Landscaping", "Terraforming", CategoryPriority: 0),
			});

			Assert.True(BuildingCatalogAdapter.MenuHasAssets(index, "Landscaping", VanillaToolbarSelection.None));
			Assert.False(index.Menus.IsPlaced(21));
			Assert.NotSame(before, index.Menus);
			Assert.True(before.IsPlaced(21));
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
