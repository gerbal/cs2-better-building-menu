using BetterBuildingMenu.Domain.Enums;

using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Which of the nets the game builds with its Bridge component are bridges.
	/// </summary>
	/// <remarks>
	/// The component is the game's for anything raised over water or ground: its build styles are
	/// Elevated, Raised and Quay, and the Landscaping piers carry it too. Headed "Bridges" in Roads,
	/// quays and piers read as bridges they are not, so each has its own subcategory.
	/// </remarks>
	public static class BridgeNets
	{
		/// <summary>The game's UI category for the piers and quays it places from Landscaping, as its
		/// UIObject.m_Group names it (read from the indexing log, 2026-10-22).</summary>
		public const string PiersAndQuaysCategory = "PiersAndQuays";

		/// <param name="isQuayStyle">Whether its Bridge component's build style is Quay.</param>
		/// <param name="uiCategory">The game's UI category for it (UIObject.m_Group), if any.</param>
		/// <param name="prefabName">The prefab's name: the piers the game files elsewhere (Ferry Pier
		/// with the pathways, Fishing and Oil Pier with none) say so only there.</param>
		/// <param name="isPathway">Whether it is a PathwayPrefab: a bike or pedestrian bridge.</param>
		public static PrefabSubCategory SubCategoryOf(bool isQuayStyle, string? uiCategory, string? prefabName, bool isPathway)
		{
			if (isQuayStyle)
			{
				return PrefabSubCategory.Networks_Quays;
			}

			if (string.Equals(uiCategory?.Trim(), PiersAndQuaysCategory, StringComparison.Ordinal)
				|| (prefabName?.IndexOf("Pier", StringComparison.Ordinal) ?? -1) >= 0)
			{
				return PrefabSubCategory.Networks_Piers;
			}

			return isPathway ? PrefabSubCategory.Networks_PathBridges : PrefabSubCategory.Networks_Bridges;
		}

		/// <summary>Whether a subcategory is one of the bridge-type nets this splits.</summary>
		public static bool IsBridgeType(string? subCategory) =>
			subCategory?.Trim() is nameof(PrefabSubCategory.Networks_Bridges)
				or nameof(PrefabSubCategory.Networks_Quays)
				or nameof(PrefabSubCategory.Networks_Piers)
				or nameof(PrefabSubCategory.Networks_PathBridges);
	}
}
