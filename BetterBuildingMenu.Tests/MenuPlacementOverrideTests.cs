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
			var (category, menu, priority) = MenuPlacementOverride.Resolve(
				managedCategory: "Police", managedMenu: "Police & Administration", managedPriority: 10,
				placedCategory: "StarQ AUM UIC LocalPolices", placedMenu: "Police & Administration", placedPriority: 40);

			Assert.Equal("StarQ AUM UIC LocalPolices", category);
			Assert.Equal("Police & Administration", menu);
			// The tab it was moved to, not the one its managed group names.
			Assert.Equal(40, priority);
		}

		[Fact]
		public void KeepsTheManagedGroupWhenTheGamePlacesNothing()
		{
			var (category, menu, priority) = MenuPlacementOverride.Resolve(
				managedCategory: "Police", managedMenu: "Police & Administration", managedPriority: 10,
				placedCategory: null, placedMenu: null, placedPriority: 40);

			Assert.Equal("Police", category);
			Assert.Equal("Police & Administration", menu);
			Assert.Equal(10, priority);
		}

		[Fact]
		public void IgnoresABlankPlacement()
		{
			var (category, menu, priority) = MenuPlacementOverride.Resolve("Police", "Police & Administration", 10, " ", "", 40);

			Assert.Equal("Police", category);
			Assert.Equal("Police & Administration", menu);
			Assert.Equal(10, priority);
		}

		[Fact]
		public void APlacementWithNoMenuKeepsTheManagedMenuButTakesThePlacedPriority()
		{
			var (category, menu, priority) = MenuPlacementOverride.Resolve("Police", "Police & Administration", 10, "LocalPolices", " ", 40);

			Assert.Equal("LocalPolices", category);
			Assert.Equal("Police & Administration", menu);
			Assert.Equal(40, priority);
		}
	}
}
