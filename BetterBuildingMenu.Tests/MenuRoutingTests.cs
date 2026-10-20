using BetterBuildingMenu.Domain;

using System;
using System.Collections.Generic;
using System.Linq;

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

		private static readonly Dictionary<int, string> Menus = new()
		{
			[11] = "Roads",
			[12] = "Landscaping",
			[13] = "ExtraAssetsMenu",
		};

		[Fact]
		public void OwnsEveryNamedMenuWithAssets()
		{
			var owned = MenuRouting.OwnedMenus(replaceEnabled: true, Menus, menu => menu != "ExtraAssetsMenu");

			Assert.Equal(new[] { new OwnedAssetMenu(11, "Roads"), new OwnedAssetMenu(12, "Landscaping") }, owned);
		}

		[Fact]
		public void OwnsNothingWhileTheReplaceOptionIsOff()
		{
			Assert.Empty(MenuRouting.OwnedMenus(replaceEnabled: false, Menus, _ => true));
		}

		[Fact]
		public void OwnsWhatVanillaMenuSelectedWouldTakeOver()
		{
			// The UI acts on this list a frame before C# hears the selection, so the two
			// must agree on every menu: the list is ShouldYield's complement, menu by menu.
			Func<string, bool> hasAssets = menu => menu == "Roads";

			foreach (var replace in new[] { true, false })
			{
				var owned = MenuRouting.OwnedMenus(replace, Menus, hasAssets).Select(menu => menu.Index).ToHashSet();

				foreach (var (index, name) in Menus)
				{
					Assert.Equal(!MenuRouting.ShouldYield(replace, name, hasAssets(name)), owned.Contains(index));
				}
			}
		}

		[Fact]
		public void ListsMenusInIndexOrder()
		{
			var menus = new Dictionary<int, string> { [30] = "B", [10] = "A", [20] = "C" };

			Assert.Equal(new[] { 10, 20, 30 }, MenuRouting.OwnedMenus(true, menus, _ => true).Select(menu => menu.Index));
		}
	}
}
