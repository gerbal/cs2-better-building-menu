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
			Assert.Equal(PrefabSubCategory.Networks_Quays, BridgeNets.SubCategoryOf(isQuayStyle: true, uiCategory: "LandscapingPiersAndQuays"));
			Assert.Equal(PrefabSubCategory.Networks_Quays, BridgeNets.SubCategoryOf(isQuayStyle: true, uiCategory: "TransportationShip"));
		}

		[Fact]
		public void AnyOtherNetTheGameFilesWithThePiersIsAPier()
		{
			Assert.Equal(PrefabSubCategory.Networks_Piers, BridgeNets.SubCategoryOf(isQuayStyle: false, uiCategory: "LandscapingPiersAndQuays"));
		}

		[Fact]
		public void EverythingElseIsABridge()
		{
			Assert.Equal(PrefabSubCategory.Networks_Bridges, BridgeNets.SubCategoryOf(isQuayStyle: false, uiCategory: "RoadsLargeRoads"));
			Assert.Equal(PrefabSubCategory.Networks_Bridges, BridgeNets.SubCategoryOf(isQuayStyle: false, uiCategory: null));
		}

		[Fact]
		public void RoadsGathersQuaysAndPiersUnderTheirOwnHeadings()
		{
			Assert.True(NetworkMenuExtension.IsExtraNetwork("Networks", "Landscaping", "Roads", nameof(PrefabSubCategory.Networks_Quays)));
			Assert.True(NetworkMenuExtension.IsExtraNetwork("Networks", "Landscaping", "Roads", nameof(PrefabSubCategory.Networks_Piers)));
			Assert.Equal("Quays", NetworkMenuExtension.GroupId(nameof(PrefabSubCategory.Networks_Quays)));
			Assert.Equal("Piers", NetworkMenuExtension.GroupId(nameof(PrefabSubCategory.Networks_Piers)));
		}

		[Fact]
		public void ANetTheGameFilesInElectricityStaysThere()
		{
			// The hydroelectric dam is a bridge-type net placed from the Electricity menu.
			Assert.False(NetworkMenuExtension.IsExtraNetwork("Networks", "Electricity", "Roads", nameof(PrefabSubCategory.Networks_Bridges)));
			Assert.True(NetworkMenuExtension.IsExtraNetwork("Networks", "Transportation", "Roads", nameof(PrefabSubCategory.Networks_Bridges)));
		}
	}
}
