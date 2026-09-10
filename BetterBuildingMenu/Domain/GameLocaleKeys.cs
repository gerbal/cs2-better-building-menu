using BetterBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The game's own localization keys for concepts the lens re-names.
	/// </summary>
	/// <remarks>
	/// Building names were already localized — they come from
	/// <c>PrefabUISystem.GetTitleAndDescription</c> through the active
	/// dictionary — but the panel's own chrome was not. Its category and
	/// subcategory labels lived in the mod's Locale.json in English, while the
	/// game ships the same strings in every language it supports.
	///
	/// So the lookup asks the game first and keeps the mod's key as the
	/// fallback. Nothing regresses if a key is missing or the game renames one:
	/// the answer is simply the English string it was before.
	///
	/// The keys were read out of the shipped locale rather than guessed —
	/// `Editor.ASSET_CATEGORY_TITLE[...]` with a path, one entry per category —
	/// and every mapping below was confirmed present in the base game's
	/// Locale.cok.
	///
	/// Deliberately partial. Networks has no single counterpart (the game splits
	/// it across Roads, Bridges and Tracks), and the vocabulary the lens
	/// invented — "Group by", "Cards", the cost bands — is genuinely ours and
	/// has no game key to borrow.
	/// </remarks>
	public static class GameLocaleKeys
	{
		private const string CategoryTitle = "Editor.ASSET_CATEGORY_TITLE";

		private static string Title(string path) => $"{CategoryTitle}[{path}]";

		private static readonly Dictionary<string, string> Keys = new(StringComparer.Ordinal)
		{
			// The eleven service menus. These paths are the same leaf names the
			// toolbar's own menu prefabs carry (PrefabIndex.UiMenuName).
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
			if (string.IsNullOrWhiteSpace(identifier))
			{
				return null;
			}

			return Keys.TryGetValue(identifier.Trim(), out var key) ? key : null;
		}

		/// <summary>Exposed so tests can assert the shape of every entry.</summary>
		public static IReadOnlyDictionary<string, string> All => Keys;
	}
}
