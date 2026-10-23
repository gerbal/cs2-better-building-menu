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
		/// <summary>The game's UI category for the piers and quays it places from Landscaping.</summary>
		public const string PiersAndQuaysCategory = "LandscapingPiersAndQuays";

		/// <param name="isQuayStyle">Whether its Bridge component's build style is Quay.</param>
		/// <param name="uiCategory">The game's UI category for it (UIObject.m_Group), if any.</param>
		public static PrefabSubCategory SubCategoryOf(bool isQuayStyle, string? uiCategory)
		{
			if (isQuayStyle)
			{
				return PrefabSubCategory.Networks_Quays;
			}

			return string.Equals(uiCategory?.Trim(), PiersAndQuaysCategory, StringComparison.Ordinal)
				? PrefabSubCategory.Networks_Piers
				: PrefabSubCategory.Networks_Bridges;
		}
	}
}
