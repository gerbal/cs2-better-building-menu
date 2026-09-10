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
			// Only Roads gathers; extending Transportation would list seaways twice.
			Assert.True(NetworkMenuExtension.IsExtended("Roads"));
			Assert.True(NetworkMenuExtension.IsExtended("roads"));
			Assert.False(NetworkMenuExtension.IsExtended("Transportation"));
			Assert.False(NetworkMenuExtension.IsExtended(""));
			Assert.False(NetworkMenuExtension.IsExtended(null));
		}

		[Fact]
		public void AnAssetAlreadyInRoadsIsNotAnExtra()
		{
			// It reaches the menu through the game's own tree; reframing it would move
			// a road out of Small Roads into a group named after our taxonomy.
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
			// Stops and routes are transit operation rather than track you lay; power
			// lines, pipes and waterways answer to the utility that owns them.
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
			// The exclusion applies to the gathering only: IsExtraNetwork requires the
			// entry's own menu to differ from Roads, so nothing the game files under
			// Roads can be hidden by it.
			Assert.False(NetworkMenuExtension.IsExtraNetwork("Networks", "Roads", "Roads", "Networks_Stops"));
		}

		[Fact]
		public void AnExtraIsHeadedByItsKindRatherThanByWhereTheGameKeepsIt()
		{
			var track = Network("Tram Track", "Networks_Tracks", "Transportation", "TransportationTram", 40);
			var reframed = NetworkMenuExtension.Reframe(track, "Roads");

			// TransportationTram is useless as a heading in a menu about networks, and
			// its priority belongs to another menu's ordering.
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

			// The tab's id is what Reframe writes, not the entry's own UiCategory;
			// comparing against the latter makes every extra tab select nothing.
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
			// The strip's counts and the tab's selection have to agree on the
			// category, and for an extra network the entry's own differs from it.
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
			// The other half: the effective category must not relabel the assets that
			// reach Roads through the game's own tree.
			var road = Road("Gravel Road", "TransportationRoad", 1);

			Assert.Equal("TransportationRoad", NetworkMenuExtension.EffectiveCategory(road, NetworkMenuExtension.RoadsMenu));
		}
	}
}
