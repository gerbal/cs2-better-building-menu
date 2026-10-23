using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// What Roads gathers from Transportation's Ship category (port roads, the port quay) is one
	/// Ports tab, and the bus category's public transport lanes are Transit lanes: read in game,
	/// 2026-10-22, where both sat in a tab labelled only "Roads".
	/// </summary>
	public sealed class PortTabsTests
	{
		[Fact]
		public void ShipNetworksAreThePortsTab()
		{
			Assert.Equal(NetworkMenuExtension.Ports, NetworkMenuExtension.TabIdOf(nameof(PrefabSubCategory.Networks_Roads), "TransportationShip"));
			Assert.Equal(NetworkMenuExtension.Ports, NetworkMenuExtension.TabIdOf(nameof(PrefabSubCategory.Networks_Quays), "TransportationShip"));
		}

		[Fact]
		public void TheBusCategorysRoadsAreTransitLanes()
		{
			Assert.Equal(NetworkMenuExtension.TransitLanes, NetworkMenuExtension.TabIdOf(nameof(PrefabSubCategory.Networks_Roads), "TransportationRoad"));
		}

		[Fact]
		public void EverythingElseKeepsItsSubcategorysTab()
		{
			Assert.Equal("Tracks", NetworkMenuExtension.TabIdOf(nameof(PrefabSubCategory.Networks_Tracks), "TransportationTrain"));
			Assert.Equal("Paths", NetworkMenuExtension.TabIdOf(nameof(PrefabSubCategory.Networks_Piers), "PiersAndQuays"));
		}

		[Fact]
		public void AGatheredEntryAnswersToItsTab()
		{
			var portRoad = TestEntries.Make(1, "Two-Lane Port Road", category: "Networks", subCategory: nameof(PrefabSubCategory.Networks_Roads)) with
			{
				UiMenu = "Transportation", UiCategory = "TransportationShip",
			};

			Assert.Equal(NetworkMenuExtension.Ports, NetworkMenuExtension.EffectiveCategory(portRoad, "Roads"));
			Assert.Equal(NetworkMenuExtension.Ports, NetworkMenuExtension.Reframe(portRoad, "Roads").UiCategory);
		}
	}
}
