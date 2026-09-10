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
		/// <summary>A prop's subcategory from a Landscaping category id such as "PropsIndustrial".</summary>
		public static PrefabSubCategory? PropSubCategoryFor(string? vanillaCategoryId)
		{
			var id = vanillaCategoryId?.Trim() ?? string.Empty;

			if (id.Length == 0 || !id.StartsWith("Props", StringComparison.OrdinalIgnoreCase))
			{
				return null;
			}

			return id.Substring("Props".Length) switch
			{
				var s when Is(s, "Industrial") => PrefabSubCategory.Props_Industrial,
				var s when Is(s, "Commercial") => PrefabSubCategory.Props_Commercial,
				var s when Is(s, "Residential") => PrefabSubCategory.Props_Residential,
				var s when Is(s, "Service") => PrefabSubCategory.Props_Service,
				var s when Is(s, "Park") => PrefabSubCategory.Props_Park,
				var s when Is(s, "Road") => PrefabSubCategory.Props_Road,
				var s when Is(s, "Lights") => PrefabSubCategory.Props_Lights,
				_ => null,
			};
		}

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

		private static bool Is(string value, string name) => string.Equals(value, name, StringComparison.OrdinalIgnoreCase);
	}
}
