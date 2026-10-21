using BetterBuildingMenu.Domain;

using Colossal.IO.AssetDatabase;

using Game.Prefabs;
using Game.UI;

using System;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities
{
	/// <summary>The game's icon lookups, each of which can throw; see <see cref="IconLookup"/>.</summary>
	/// <remarks>Null on a throw, so each caller falls back as it would for a prefab with no icon.</remarks>
	internal static class GameIcons
	{
		public static string? Thumbnail(PrefabBase prefab) =>
			Guard(() => ImageSystem.GetThumbnail(prefab), prefab);

		public static string? Icon(PrefabBase prefab) =>
			Guard(() => ImageSystem.GetIcon(prefab), prefab);

		/// <param name="owner">The prefab the icon is drawn for, named in the log.</param>
		public static string? IconOrGroupIcon(ImageSystem images, Entity entity, PrefabBase owner) =>
			Guard(() => images.GetIconOrGroupIcon(entity), owner);

		private static string? Guard(Func<string?> lookup, PrefabBase prefab) =>
			IconLookup.OrNull(lookup, ex => Mod.Log.Warn(ex,
				$"Icon lookup failed for prefab '{prefab.name}'"
				+ (prefab.asset?.database == AssetDatabase<ParadoxMods>.instance ? $" (Pdx Mods ID: {prefab.asset.GetMeta().platformID})" : "")));
	}
}
