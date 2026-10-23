using BetterBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The game's own localization keys for concepts the asset menu re-names.
	/// </summary>
	/// <remarks>
	/// The game ships these category names in every language it supports, so the
	/// lookup asks it first and falls back to the mod's own English key. Partial by
	/// design: the vocabulary the asset menu invented has no game key to borrow. See
	/// docs/design-notes.md, "Labels in the game's words".
	/// </remarks>
	public static class GameLocaleKeys
	{
		private const string CategoryTitle = "Editor.ASSET_CATEGORY_TITLE";

		private static string Title(string path) => $"{CategoryTitle}[{path}]";

		// The toolbar's own menu and tab names, the words a player already reads
		// in the vanilla build menu.
		private static string Service(string name) => $"Services.NAME[{name}]";

		private static string SubService(string name) => $"SubServices.NAME[{name}]";

		// The service menus. Their category paths are the same leaf names the toolbar's
		// own menu prefabs carry (PrefabIndex.UiMenuName).
		private static Dictionary<string, string> ServiceKeys()
		{
			var keys = new Dictionary<string, string>();

			foreach (var menu in ServiceMenus.All)
			{
				keys[menu.SubCategory.ToString()] = menu.TitledByCategoryPath
					? Title("Buildings/Services/" + menu.Name)
					: Service(menu.Name);
			}

			return keys;
		}

		private static readonly Dictionary<string, string> Keys = WithZoneTabs(new(ServiceKeys(), StringComparer.Ordinal)
		{
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
			[nameof(PrefabSubCategory.Networks_Quays)] = Title("Quays"),
			[nameof(PrefabSubCategory.Networks_Piers)] = Title("Piers"),
			[nameof(PrefabSubCategory.Networks_PathBridges)] = Title("Path bridges"),
			[nameof(PrefabSubCategory.Networks_Tracks)] = Title("Tracks"),

			// Network subcategories that are a vanilla Roads tab. Highways are the
			// roads with highway rules, and Pathways the pathway prefabs, exactly as
			// the toolbar files them.
			[nameof(PrefabSubCategory.Networks_Highways)] = SubService("RoadsHighways"),
			[nameof(PrefabSubCategory.Networks_Upgrades)] = SubService("RoadsServices"),
			[nameof(PrefabSubCategory.Networks_Paths)] = SubService("Pathways"),

			[nameof(PrefabCategory.Any)] = Title("All"),

			// Props. The zoned ones are the Landscaping tabs' own ids. Park and Lights
			// have a game name too, but "Park" and "Lights" say less than ours do, and
			// the game leaves "Fences" English in German.
			[nameof(PrefabCategory.Props)] = Title("Props"),
			[nameof(PrefabSubCategory.Props_Residential)] = SubService("PropsResidential"),
			[nameof(PrefabSubCategory.Props_Commercial)] = SubService("PropsCommercial"),
			[nameof(PrefabSubCategory.Props_Industrial)] = SubService("PropsIndustrial"),
			[nameof(PrefabSubCategory.Props_Decals)] = SubService("PropsDecals"),

			// Foliage, from the editor's tree. The Trees category itself also holds
			// rocks and spawners, which the editor's "Foliage" does not.
			[nameof(PrefabSubCategory.Trees_Trees)] = Title("Foliage/Trees"),
			[nameof(PrefabSubCategory.Trees_Shrubs)] = Title("Foliage/Bushes"),
			[nameof(PrefabSubCategory.Trees_Spawners)] = Title("Locations/Spawners"),

			// Zones, which are the Zones menu; its tabs follow.
			[nameof(PrefabCategory.Zones)] = Service("Zones"),
		});

		// The Zones menu's tabs, one per zoning family, by the UI group the game files its
		// zones under. Extractors is the tab vanilla calls Specialized Industry.
		private static Dictionary<string, string> WithZoneTabs(Dictionary<string, string> keys)
		{
			foreach (var family in ZoningCatalog.All)
			{
				keys[family.SubCategory.ToString()] = SubService(family.Group);
			}

			return keys;
		}

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

		// A role takes the name of the plain building it is built around, as #78 named
		// the school levels, where the game has one: Hospital01 is "Hospital" in every
		// language. The roles with no single typical building take the toolbar tab
		// they sit under, and the rest keep ours: School spans four levels, and
		// neither "Electricity" nor "Small Emergency Shelter" names a role.
		private static readonly Dictionary<string, string> RoleKeys = new(StringComparer.Ordinal)
		{
			["Hospital"] = AssetName("Hospital01"),
			["FireStation"] = AssetName("FireStation01"),
			["PoliceStation"] = AssetName("PoliceStation01"),
			["Prison"] = AssetName("Prison01"),
			["WaterPumpingStation"] = AssetName("WaterPumpingStation01"),
			["WastewaterTreatmentPlant"] = AssetName("WastewaterTreatmentPlant01"),
			["SewageOutlet"] = AssetName("SewageOutlet01"),
			["GarbageFacility"] = SubService("GarbageManagement"),
			["DeathcareFacility"] = SubService("Deathcare"),
			["PostFacility"] = SubService("CommunicationsPost"),
			["TelecomFacility"] = SubService("CommunicationsTelecom"),
		};

		private static string AssetName(string prefab) => $"Assets.NAME[{prefab}]";

		/// <summary>The game's key for a building role, or null when ours is the only name.</summary>
		public static string? ForRole(string? role) =>
			role?.Trim() is { Length: > 0 } trimmed && RoleKeys.TryGetValue(trimmed, out var key) ? key : null;

		/// <summary>Exposed so tests can assert the role keys' shape and uniqueness.</summary>
		public static IReadOnlyDictionary<string, string> Roles => RoleKeys;

		/// <summary>
		/// The game's key for a theme prefab's name, as its own theme picker reads
		/// it. A modded theme has none, and the lookup falls back to the name.
		/// </summary>
		public static string? ForTheme(string? themeName) =>
			themeName?.Trim() is { Length: > 0 } trimmed ? $"Assets.THEME[{trimmed}]" : null;

		/// <summary>Exposed so tests can assert the shape of every entry.</summary>
		public static IReadOnlyDictionary<string, string> All => Keys;
	}
}
