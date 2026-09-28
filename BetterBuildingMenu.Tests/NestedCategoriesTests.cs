using System;
using System.Linq;
using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class NestedCategoriesTests
	{
		private static CategoryNode Leaf(int key, string name, int priority, params int[] assets) =>
			new(key, name, priority, Array.Empty<CategoryNode>(), assets);

		private static CategoryNode Parent(int key, string name, int priority, params CategoryNode[] subcategories) =>
			new(key, name, priority, subcategories, Array.Empty<int>());

		[Fact]
		public void LeavesAVanillaMenuExactlyAsItWas()
		{
			var tabs = NestedCategories.Flatten(new[] { Leaf(1, "Small Roads", 10, 100, 101), Leaf(2, "Medium Roads", 20, 102) });

			Assert.Equal(new[] { ("Small Roads", 10), ("Medium Roads", 20) }, tabs.Select(tab => (tab.Name, tab.Priority)));
			Assert.Equal(new[] { 100, 101 }, tabs[0].AssetKeys);
		}

		[Fact]
		public void MakesEachExtraAssetsSubcategoryATabInItsParentsOrder()
		{
			// Extra Assets Importer's menu as the census found it: three tabs of subcategories.
			var tabs = NestedCategories.Flatten(new[]
			{
				Parent(1, "Decals", 5, Leaf(11, "RoadMarkings Decals", 2, 110), Leaf(12, "Misc Decals", 1, 111)),
				Parent(2, "NetLanes", 6, Leaf(21, "Fence NetLanes", 1, 120)),
			});

			Assert.Equal(new[] { "RoadMarkings Decals", "Misc Decals", "Fence NetLanes" }, tabs.Select(tab => tab.Name));
			// Numbered in that order, so a stable sort by priority keeps it.
			Assert.Equal(new[] { 0, 1, 2 }, tabs.Select(tab => tab.Priority));
			Assert.Equal(new[] { 111 }, tabs[1].AssetKeys);
		}

		[Fact]
		public void GivesAParentsOwnAssetsATabBeforeItsSubcategories()
		{
			var mixed = new CategoryNode(1, "Surfaces", 5, new[] { Leaf(11, "Grass Surfaces", 1, 110) }, new[] { 100 });

			var tabs = NestedCategories.Flatten(new[] { mixed });

			Assert.Equal(new[] { "Surfaces", "Grass Surfaces" }, tabs.Select(tab => tab.Name));
		}

		[Fact]
		public void RenumbersTheVanillaTabsOfANestedMenuSoTheyKeepTheirPlaces()
		{
			var tabs = NestedCategories.Flatten(new[] { Leaf(1, "Plain", 900, 100), Parent(2, "Nested", 5, Leaf(21, "Inner", 1, 110)) });

			Assert.Equal(new[] { ("Plain", 0), ("Inner", 1) }, tabs.Select(tab => (tab.Name, tab.Priority)));
		}

		[Fact]
		public void DropsAParentWithNothingInItButEmptySubcategories()
		{
			var tabs = NestedCategories.Flatten(new[] { Parent(1, "Empty", 1, Leaf(11, "Nothing", 1)), Parent(2, "Full", 2, Leaf(21, "Some", 1, 120)) });

			Assert.Equal(new[] { "Some" }, tabs.Select(tab => tab.Name));
		}

		[Fact]
		public void StopsAtACategoryThatContainsItself()
		{
			var subcategories = new System.Collections.Generic.List<CategoryNode>();
			var loop = new CategoryNode(1, "Loop", 1, subcategories, new[] { 100 });
			subcategories.Add(loop);

			var tabs = NestedCategories.Flatten(new[] { loop });

			Assert.Single(tabs);
		}
	}
}
