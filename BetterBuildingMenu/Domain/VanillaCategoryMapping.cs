using System;
using BetterBuildingMenu.Domain.Enums;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Where vanilla files an asset, read off the game's own category id, for
	/// the assets no processor recognises by their components.
	/// </summary>
	/// <remarks>
	/// A few assets vanilla places carry none of the components a processor queries.
	/// The game itself knows where they go — the UIObject group walk records each
	/// asset's menu category — so that category is the answer when evidence runs out.
	/// </remarks>
	public static class VanillaCategoryMapping
	{
		/// <summary>A building's subcategory from a Signatures category id such as "SignaturesCommercial".</summary>
		public static PrefabSubCategory? BuildingSubCategoryFor(string? vanillaCategoryId)
		{
			var id = vanillaCategoryId?.Trim() ?? string.Empty;

			if (id.Length == 0)
			{
				return null;
			}

			if (id.IndexOf("Commercial", StringComparison.OrdinalIgnoreCase) >= 0) return PrefabSubCategory.Buildings_Commercial;
			if (id.IndexOf("Residential", StringComparison.OrdinalIgnoreCase) >= 0) return PrefabSubCategory.Buildings_Residential;
			if (id.IndexOf("Office", StringComparison.OrdinalIgnoreCase) >= 0) return PrefabSubCategory.Buildings_Office;
			if (id.IndexOf("Industrial", StringComparison.OrdinalIgnoreCase) >= 0) return PrefabSubCategory.Buildings_Industrial;

			return PrefabSubCategory.Buildings_Miscellaneous;
		}

		/// <summary>The Signatures menu's categories all begin with the menu's name.</summary>
		public static bool IsSignatureCategory(string? vanillaCategoryId) =>
			(vanillaCategoryId ?? string.Empty).Trim().StartsWith("Signatures", StringComparison.OrdinalIgnoreCase);
	}
}
