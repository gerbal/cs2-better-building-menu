using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class MenuRoutingTests
	{
		[Fact]
		public void YieldsWhenTheReplaceOptionIsOff()
		{
			Assert.True(MenuRouting.ShouldYield(replaceEnabled: false, menuName: "Roads", menuHasAssets: true));
		}

		[Fact]
		public void YieldsAMenuTheIndexHasNoNameFor()
		{
			Assert.True(MenuRouting.ShouldYield(replaceEnabled: true, menuName: "", menuHasAssets: true));
			Assert.True(MenuRouting.ShouldYield(replaceEnabled: true, menuName: null, menuHasAssets: true));
		}

		[Fact]
		public void YieldsAMenuWeCannotFill()
		{
			// Extra Assets Importer's menu is built from nested categories the
			// index never descends into; taking it over would draw an empty asset menu.
			Assert.True(MenuRouting.ShouldYield(replaceEnabled: true, menuName: "ExtraAssetsMenu", menuHasAssets: false));
		}

		[Fact]
		public void RoutesANamedMenuWithAssets()
		{
			Assert.False(MenuRouting.ShouldYield(replaceEnabled: true, menuName: "Roads", menuHasAssets: true));
		}
	}
}
