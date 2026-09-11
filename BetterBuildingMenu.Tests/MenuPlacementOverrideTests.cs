using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class MenuPlacementOverrideTests
	{
		[Fact]
		public void TheGamesOwnPlacementWinsOverTheManagedGroup()
		{
			// Asset UI Manager and Zone Organizer regroup assets in the entity
			// world; the managed UIObject keeps the stock group.
			var (category, menu) = MenuPlacementOverride.Resolve(
				managedCategory: "Police", managedMenu: "Police & Administration",
				placedCategory: "StarQ AUM UIC LocalPolices", placedMenu: "Police & Administration");

			Assert.Equal("StarQ AUM UIC LocalPolices", category);
			Assert.Equal("Police & Administration", menu);
		}

		[Fact]
		public void KeepsTheManagedGroupWhenTheGamePlacesNothing()
		{
			var (category, menu) = MenuPlacementOverride.Resolve(
				managedCategory: "Police", managedMenu: "Police & Administration",
				placedCategory: null, placedMenu: null);

			Assert.Equal("Police", category);
			Assert.Equal("Police & Administration", menu);
		}

		[Fact]
		public void IgnoresABlankPlacement()
		{
			var (category, menu) = MenuPlacementOverride.Resolve("Police", "Police & Administration", " ", "");

			Assert.Equal("Police", category);
			Assert.Equal("Police & Administration", menu);
		}
	}
}
