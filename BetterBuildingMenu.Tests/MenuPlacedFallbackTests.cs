using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class MenuPlacedFallbackTests
	{
		[Fact]
		public void IndexesAPlacedPrefabNoProcessorClaimed()
		{
			// Water Features' WaterSource tools: placed by the game, a type no
			// processor queries.
			Assert.True(MenuPlacedFallback.ShouldIndex(placedInVanillaMenu: true, isCategory: false, alreadyIndexed: false));
		}

		[Fact]
		public void LeavesCategoriesAlone()
		{
			// ExtraLib's child categories sit in a menu's category buffer like
			// assets do, but they are tabs, not things a tool can arm.
			Assert.False(MenuPlacedFallback.ShouldIndex(placedInVanillaMenu: true, isCategory: true, alreadyIndexed: false));
		}

		[Fact]
		public void DoesNotDuplicateAnEarlierProcessorsEntry()
		{
			Assert.False(MenuPlacedFallback.ShouldIndex(placedInVanillaMenu: true, isCategory: false, alreadyIndexed: true));
		}

		[Fact]
		public void IgnoresPrefabsTheGamePlacesNowhere()
		{
			Assert.False(MenuPlacedFallback.ShouldIndex(placedInVanillaMenu: false, isCategory: false, alreadyIndexed: false));
		}
	}
}
