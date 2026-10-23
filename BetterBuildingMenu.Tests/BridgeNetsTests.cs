using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The game puts its Bridge component on quays and piers too (build style Quay, and the
	/// Landscaping piers), and on the hydroelectric dam. Roads headed them all "Bridges".
	/// </summary>
	public sealed class BridgeNetsTests
	{
		[Fact]
		public void AQuayStyleNetIsAQuay()
		{
			Assert.Equal(PrefabSubCategory.Networks_Quays, BridgeNets.SubCategoryOf(isQuayStyle: true, uiCategory: "PiersAndQuays", prefabName: "QuaySmall01"));
			Assert.Equal(PrefabSubCategory.Networks_Quays, BridgeNets.SubCategoryOf(isQuayStyle: true, uiCategory: "TransportationShip", prefabName: "HarborQuay01"));
		}

		[Fact]
		public void AnyOtherNetTheGameFilesWithThePiersIsAPier()
		{
			// The game's id, as the indexing log reported it (2026-10-22): Elevated and Raised both.
			Assert.Equal(PrefabSubCategory.Networks_Piers, BridgeNets.SubCategoryOf(isQuayStyle: false, uiCategory: "PiersAndQuays", prefabName: "LeisurePier04Small01"));
		}

		[Fact]
		public void APierTheGameFilesElsewhereIsAPierByItsName()
		{
			Assert.Equal(PrefabSubCategory.Networks_Piers, BridgeNets.SubCategoryOf(isQuayStyle: false, uiCategory: "Pathways", prefabName: "Ferry Pier"));
			Assert.Equal(PrefabSubCategory.Networks_Piers, BridgeNets.SubCategoryOf(isQuayStyle: false, uiCategory: null, prefabName: "Fishing Pier"));
			Assert.Equal(PrefabSubCategory.Networks_Piers, BridgeNets.SubCategoryOf(isQuayStyle: false, uiCategory: null, prefabName: "Oil Pier"));
		}

		[Fact]
		public void EverythingElseIsABridge()
		{
			Assert.Equal(PrefabSubCategory.Networks_Bridges, BridgeNets.SubCategoryOf(isQuayStyle: false, uiCategory: "RoadsLargeRoads", prefabName: "Golden Gate Bridge"));
			Assert.Equal(PrefabSubCategory.Networks_Bridges, BridgeNets.SubCategoryOf(isQuayStyle: false, uiCategory: null, prefabName: "LiftBridge03 Train Track"));
		}

		[Fact]
		public void RoadsGathersQuaysUnderTheirOwnHeadingAndPiersWithThePaths()
		{
			Assert.True(NetworkMenuExtension.IsExtraNetwork("Networks", "Landscaping", "Roads", nameof(PrefabSubCategory.Networks_Quays)));
			Assert.True(NetworkMenuExtension.IsExtraNetwork("Networks", "Landscaping", "Roads", nameof(PrefabSubCategory.Networks_Piers)));
			Assert.Equal("Quays", NetworkMenuExtension.GroupId(nameof(PrefabSubCategory.Networks_Quays)));
			// A pier is a walkway on stilts: it shares the Paths tab, and keeps its own subcategory.
			Assert.Equal("Paths", NetworkMenuExtension.GroupId(nameof(PrefabSubCategory.Networks_Piers)));
			Assert.Equal(
				NetworkMenuExtension.GroupPriority(nameof(PrefabSubCategory.Networks_Paths)),
				NetworkMenuExtension.GroupPriority(nameof(PrefabSubCategory.Networks_Piers)));
		}

		[Fact]
		public void ANetTheGameFilesInElectricityStaysThere()
		{
			// The hydroelectric dam is a bridge-type net placed from the Electricity menu.
			Assert.False(NetworkMenuExtension.IsExtraNetwork("Networks", "Electricity", "Roads", nameof(PrefabSubCategory.Networks_Bridges)));
			Assert.True(NetworkMenuExtension.IsExtraNetwork("Networks", "Transportation", "Roads", nameof(PrefabSubCategory.Networks_Bridges)));
		}
		[Fact]
		public void ABridgeTypeNetTheGameOffersNowhereIsNotGathered()
		{
			// Parts of buildings and bridges (Fishing Pier, "LiftBridge03 Train Track"): no menu
			// offers them on their own, so Roads does not either.
			foreach (var subCategory in new[] { nameof(PrefabSubCategory.Networks_Bridges), nameof(PrefabSubCategory.Networks_Piers), nameof(PrefabSubCategory.Networks_Quays) })
			{
				Assert.False(NetworkMenuExtension.IsExtraNetwork("Networks", null, "Roads", subCategory));
				Assert.False(NetworkMenuExtension.IsExtraNetwork("Networks", "  ", "Roads", subCategory));
			}

			// Any other network with no menu still comes in, as before.
			Assert.True(NetworkMenuExtension.IsExtraNetwork("Networks", null, "Roads", nameof(PrefabSubCategory.Networks_Tracks)));
		}
	}
}
