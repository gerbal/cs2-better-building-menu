using System.Linq;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The Roads menu gathers every network, roads first.
	/// </summary>
	public sealed class NetworkMenuExtensionTests
	{
		private static BuildingCatalogEntry Network(
			string name,
			string subCategory,
			string? menu,
			string? uiCategory,
			int priority = 0) =>
			new(
				Id: name.GetHashCode(),
				Name: name,
				PrefabName: name,
				Category: "Networks",
				SubCategory: subCategory,
				Thumbnail: "",
				LotWidth: 0,
				LotDepth: 0,
				BuildingLevel: 0,
				ZoneType: ZoneTypeFilter.Any,
				HasParking: false,
				IsUniqueMesh: false,
				IsVanilla: true,
				PdxModsId: "",
				UiMenu: menu,
				UiCategory: uiCategory,
				UiCategoryPriority: priority);

		private static BuildingCatalogEntry Road(string name, string uiCategory, int priority) =>
			Network(name, "Networks_Roads", NetworkMenuExtension.RoadsMenu, uiCategory, priority);

		[Fact]
		public void OnlyTheRoadsMenuGathersEverything()
		{
			// Every other menu stays a faithful reproduction of the game's tree.
			// If this ever answers true for Transportation, seaways appear twice
			// in the menu that already holds them.
			Assert.True(NetworkMenuExtension.IsExtended("Roads"));
			Assert.True(NetworkMenuExtension.IsExtended("roads"));
			Assert.False(NetworkMenuExtension.IsExtended("Transportation"));
			Assert.False(NetworkMenuExtension.IsExtended(""));
			Assert.False(NetworkMenuExtension.IsExtended(null));
		}

		[Fact]
		public void AnAssetAlreadyInRoadsIsNotAnExtra()
		{
			// It reaches the menu through the game's own tree, so rewriting its
			// category would move a road out of Small Roads and into a group
			// named after our taxonomy.
			Assert.False(NetworkMenuExtension.IsExtraNetwork("Networks", "Roads", "Roads"));
			Assert.True(NetworkMenuExtension.IsExtraNetwork("Networks", "Transportation", "Roads"));
			// A network the game files in no menu at all still belongs here.
			Assert.True(NetworkMenuExtension.IsExtraNetwork("Networks", null, "Roads"));
			// A building in another menu does not, whatever menu is asking.
			Assert.False(NetworkMenuExtension.IsExtraNetwork("ServiceBuildings", "Transportation", "Roads"));
		}

		[Fact]
		public void FiveSubcategoriesAreNotGatheredIntoRoads()
		{
			// Stops and routes are transit operation rather than track you lay;
			// power lines, pipes and waterways answer to the utility that owns
			// them. Gathered in, they made Roads longer without making a road
			// easier to find.
			foreach (var subCategory in new[]
			{
				"Networks_Stops",
				"Networks_Routes",
				"Networks_Waterways",
				"Networks_PowerLines",
				"Networks_Pipes",
			})
			{
				Assert.False(
					NetworkMenuExtension.IsGathered(subCategory),
					$"{subCategory} should not be gathered into Roads");
				Assert.False(
					NetworkMenuExtension.IsExtraNetwork("Networks", "Transportation", "Roads", subCategory),
					$"{subCategory} should not reach Roads through the extension");
			}

			// The gathering still does its job for everything else.
			foreach (var subCategory in new[] { "Networks_Tracks", "Networks_Paths", "Networks_Lanes" })
			{
				Assert.True(
					NetworkMenuExtension.IsExtraNetwork("Networks", "Transportation", "Roads", subCategory),
					$"{subCategory} should still be gathered");
			}
		}

		[Fact]
		public void AnExcludedNetworkFiledUnderRoadsIsUntouched()
		{
			// The exclusion is on the GATHERING. A network the game itself puts
			// in Roads is not reached by it at all — IsExtraNetwork already
			// requires the entry's own menu to be something other than Roads —
			// so this cannot hide anything vanilla places there.
			Assert.False(NetworkMenuExtension.IsExtraNetwork("Networks", "Roads", "Roads", "Networks_Stops"));
		}

		[Fact]
		public void AnExtraIsHeadedByItsKindRatherThanByWhereTheGameKeepsIt()
		{
			var track = Network("Tram Track", "Networks_Tracks", "Transportation", "TransportationTram", 40);
			var reframed = NetworkMenuExtension.Reframe(track, "Roads");

			// TransportationTram is right about the game and useless as a heading
			// in a menu about networks — and its priority belongs to a different
			// menu's ordering, so it would land in the middle of the roads.
			Assert.Equal("Tracks", reframed.UiCategory);
			Assert.Equal("Roads", reframed.UiMenu);
			Assert.True(reframed.UiCategoryPriority >= NetworkMenuExtension.ExtraGroupPriorityBase);
		}

		[Fact]
		public void ReframingLeavesEveryOtherMenuAlone()
		{
			var track = Network("Tram Track", "Networks_Tracks", "Transportation", "TransportationTram", 40);

			Assert.Same(track, NetworkMenuExtension.Reframe(track, "Transportation"));
			Assert.Same(track, NetworkMenuExtension.Reframe(track, null));
		}

		[Fact]
		public void RoadsComeFirstAndTheExoticNetworksFollow()
		{
			var entries = new[]
			{
				Network("Tram Track", "Networks_Tracks", "Transportation", "TransportationTram", 40),
				Road("Alley", "RoadsSmall", 10),
				Network("Pedestrian Path", "Networks_Paths", "Landscaping", "PropsNature", 20),
				Road("Highway", "RoadsHighway", 30),
			};

			var page = BuildingCatalogQueryEngine.Query(
				entries,
				new BuildingCatalogQuery { UiMenu = "Roads", GroupBy = BuildingCatalogGrouping.MenuCategory });

			// Roads first, then the extras in the order PrefabSubCategory declares
			// them — Networks_Tracks before Networks_Paths — rather than
			// alphabetically or by the priority their own menu gave them.
			Assert.Equal(
				new[] { "Alley", "Highway", "Tram Track", "Pedestrian Path" },
				page.Items.Select(item => item.Name).ToArray());
		}

		[Fact]
		public void PickingAnExtraTabSelectsTheGroupUnderIt()
		{
			var entries = new[]
			{
				Network("Tram Track", "Networks_Tracks", "Transportation", "TransportationTram", 40),
				Road("Alley", "RoadsSmall", 10),
			};

			// The tab's id is what Reframe writes, not the entry's own
			// UiCategory. Comparing against the latter would make every extra tab
			// select nothing, which is the failure the shared EffectiveCategory
			// exists to prevent.
			var page = BuildingCatalogQueryEngine.Query(
				entries,
				new BuildingCatalogQuery { UiMenu = "Roads", UiCategory = "Tracks" });

			Assert.Equal(new[] { "Tram Track" }, page.Items.Select(item => item.Name).ToArray());
		}

		[Fact]
		public void TheRoadsMenusOwnTabsStillSelectOnlyRoads()
		{
			var entries = new[]
			{
				Network("Tram Track", "Networks_Tracks", "Transportation", "TransportationTram", 40),
				Road("Alley", "RoadsSmall", 10),
			};

			var page = BuildingCatalogQueryEngine.Query(
				entries,
				new BuildingCatalogQuery { UiMenu = "Roads", UiCategory = "RoadsSmall" });

			Assert.Equal(new[] { "Alley" }, page.Items.Select(item => item.Name).ToArray());
		}

		[Fact]
		public void ATabAndItsCountAgreeOnWhichCategoryAnExtraNetworkIsIn()
		{
			// The bug this pins: the strip's counts grouped on the entry's own
			// UiCategory while the tab SELECTED on EffectiveCategory. For an
			// extra network those differ — a seaway's own category is
			// TransportationShip and its Roads tab is "Ship" — so ten Roads tabs
			// reported nothing and showed assets when clicked.
			var seaway = Network("Medium Seaway", "Networks_Ship", "Transportation", "TransportationShip");

			var tab = NetworkMenuExtension.EffectiveCategory(seaway, NetworkMenuExtension.RoadsMenu);

			Assert.Equal(NetworkMenuExtension.GroupId("Networks_Ship"), tab);
			Assert.NotEqual(seaway.UiCategory, tab);

			// And in its own menu it keeps the game's answer, so this cannot
			// move a seaway out of the Transportation tab it really belongs to.
			Assert.Equal(seaway.UiCategory, NetworkMenuExtension.EffectiveCategory(seaway, "Transportation"));
		}

		[Fact]
		public void ARoadKeepsItsOwnCategoryInTheRoadsMenu()
		{
			// The other half: counting on the effective category must not
			// relabel the assets that reach Roads through the game's own tree.
			var road = Road("Gravel Road", "TransportationRoad", 1);

			Assert.Equal("TransportationRoad", NetworkMenuExtension.EffectiveCategory(road, NetworkMenuExtension.RoadsMenu));
		}
	}
}
