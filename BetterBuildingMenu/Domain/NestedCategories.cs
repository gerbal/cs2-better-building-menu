using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>One category of a vanilla build menu, with whatever it holds.</summary>
	/// <param name="Key">The category's entity index.</param>
	/// <param name="Subcategories">Categories inside this one, in the game's order. Empty for a
	/// vanilla category; Extra Lib nests them (Extra Assets Importer's Decals holds Misc Decals,
	/// Parking Decals and Road Markings Decals).</param>
	/// <param name="AssetKeys">The entity indices of the assets directly in this category.</param>
	public sealed record CategoryNode(
		int Key,
		string Name,
		int Priority,
		IReadOnlyList<CategoryNode> Subcategories,
		IReadOnlyList<int> AssetKeys);

	/// <summary>One tab of the flattened strip, and the assets it holds.</summary>
	public sealed record LeafTab(int Key, string Name, int Priority, IReadOnlyList<int> AssetKeys);

	/// <summary>
	/// Turns a menu's category tree into the one row of tabs the asset menu draws.
	/// </summary>
	/// <remarks>
	/// Vanilla menus are one level deep, and pass through unchanged, priorities included. A menu
	/// Extra Lib nests becomes a tab per category that holds assets, in the order Extra Lib's
	/// rows show them: each parent's own assets first, then its subcategories in order. Those
	/// tabs are numbered 0, 1, 2… so the UI's stable sort by priority keeps that order, and every
	/// tab of the menu is renumbered so the menu's vanilla tabs keep their places among them.
	/// </remarks>
	public static class NestedCategories
	{
		/// <summary>How deep a tree is followed. Extra Lib's own menus are two levels; the cap only
		/// stops a malformed tree from looping.</summary>
		public const int MaxDepth = 8;

		public static IReadOnlyList<LeafTab> Flatten(IReadOnlyList<CategoryNode> topCategories)
		{
			var nested = false;
			foreach (var category in topCategories)
			{
				if (category.Subcategories.Count > 0)
				{
					nested = true;
					break;
				}
			}

			var tabs = new List<LeafTab>();

			if (!nested)
			{
				foreach (var category in topCategories)
				{
					tabs.Add(new LeafTab(category.Key, category.Name, category.Priority, category.AssetKeys));
				}

				return tabs;
			}

			var visited = new HashSet<int>();
			foreach (var category in topCategories)
			{
				Walk(category, 0, visited, tabs);
			}

			return tabs;
		}

		private static void Walk(CategoryNode category, int depth, HashSet<int> visited, List<LeafTab> tabs)
		{
			if (depth > MaxDepth || !visited.Add(category.Key))
			{
				return;
			}

			if (category.AssetKeys.Count > 0)
			{
				tabs.Add(new LeafTab(category.Key, category.Name, tabs.Count, category.AssetKeys));
			}

			foreach (var subcategory in category.Subcategories)
			{
				Walk(subcategory, depth + 1, visited, tabs);
			}
		}
	}
}
