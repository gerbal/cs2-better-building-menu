using BetterBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The game's own localization keys for concepts the lens re-names.
	/// </summary>
	/// <remarks>
	/// The game ships these category names in every language it supports, so the
	/// lookup asks it first and falls back to the mod's own English key. Partial by
	/// design: the vocabulary the lens invented has no game key to borrow.
	/// </remarks>
	public static class GameLocaleKeys
	{
		private const string CategoryTitle = "Editor.ASSET_CATEGORY_TITLE";

		private static string Title(string path) => $"{CategoryTitle}[{path}]";

		private static readonly Dictionary<string, string> Keys = new(StringComparer.Ordinal)
		{
			// The service menus. These paths are the same leaf names the toolbar's
			// own menu prefabs carry (PrefabIndex.UiMenuName).
			[nameof(PrefabSubCategory.ServiceBuildings_Health)] = Title("Buildings/Services/Health & Deathcare"),
			[nameof(PrefabSubCategory.ServiceBuildings_Water)] = Title("Buildings/Services/Water & Sewage"),
			[nameof(PrefabSubCategory.ServiceBuildings_Electricity)] = Title("Buildings/Services/Electricity"),
			[nameof(PrefabSubCategory.ServiceBuildings_Garbage)] = Title("Buildings/Services/Garbage Management"),
			[nameof(PrefabSubCategory.ServiceBuildings_EducationResearch)] = Title("Buildings/Services/Education & Research"),
			[nameof(PrefabSubCategory.ServiceBuildings_Fire)] = Title("Buildings/Services/Fire & Rescue"),
			[nameof(PrefabSubCategory.ServiceBuildings_Police)] = Title("Buildings/Services/Police & Administration"),
			[nameof(PrefabSubCategory.ServiceBuildings_Parks)] = Title("Buildings/Services/Parks & Recreation"),
			[nameof(PrefabSubCategory.ServiceBuildings_Communications)] = Title("Buildings/Services/Communications"),
			[nameof(PrefabSubCategory.ServiceBuildings_Transportation)] = Title("Buildings/Services/Transportation"),
			[nameof(PrefabSubCategory.ServiceBuildings_Roads)] = Title("Buildings/Services/Roads"),

			// Zoned building groups.
			[nameof(PrefabSubCategory.Buildings_Residential)] = Title("Buildings/Residential"),
			[nameof(PrefabSubCategory.Buildings_Commercial)] = Title("Buildings/Commercial"),
			[nameof(PrefabSubCategory.Buildings_Industrial)] = Title("Buildings/Industrial"),
			[nameof(PrefabSubCategory.Buildings_Office)] = Title("Buildings/Office"),
			[nameof(PrefabSubCategory.Buildings_Miscellaneous)] = Title("Buildings/Misc"),

			// Categories.
			[nameof(PrefabCategory.Buildings)] = Title("Buildings"),
			[nameof(PrefabCategory.ServiceBuildings)] = Title("Buildings/Services"),

			// Network subcategories, from the game's own top-level tree.
			[nameof(PrefabSubCategory.Networks_Roads)] = Title("Roads/Roads"),
			[nameof(PrefabSubCategory.Networks_Intersections)] = Title("Roads/Intersections"),
			[nameof(PrefabSubCategory.Networks_Bridges)] = Title("Bridges"),
			[nameof(PrefabSubCategory.Networks_Tracks)] = Title("Tracks"),
		};

		/// <summary>
		/// The game's key for one of our identifiers, or null when the game has
		/// no counterpart and the mod's own string is the only answer.
		/// </summary>
		public static string? For(string? identifier)
		{
			if (identifier?.Trim() is not { Length: > 0 } trimmed)
			{
				return null;
			}

			return Keys.TryGetValue(trimmed, out var key) ? key : null;
		}

		/// <summary>Exposed so tests can assert the shape of every entry.</summary>
		public static IReadOnlyDictionary<string, string> All => Keys;
	}
}
