using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Whether a toolbar menu the player just opened should be left to the vanilla grid.</summary>
	public static class MenuRouting
	{
		/// <remarks>A menu with a name but nothing indexed under it is one the index cannot fill,
		/// such as a mod's menu built from nested categories; the asset menu would only say "no buildings".</remarks>
		public static bool ShouldYield(bool replaceEnabled, [NotNullWhen(false)] string? menuName, bool menuHasAssets) =>
			!replaceEnabled || string.IsNullOrEmpty(menuName) || !menuHasAssets;

		/// <summary>
		/// The toolbar menus the asset menu would take over if each were selected now, by entity index.
		/// </summary>
		/// <remarks>
		/// <see cref="ShouldYield"/>'s complement, menu by menu, so the UI, which acts on this list
		/// in the frame a menu opens, can never claim a menu VanillaMenuSelected then gives back.
		/// </remarks>
		/// <param name="menus">Every toolbar menu's prefab name, by its entity index.</param>
		/// <param name="menuHasAssets">Whether the index holds anything for that menu.</param>
		public static OwnedAssetMenu[] OwnedMenus(bool replaceEnabled, IReadOnlyDictionary<int, string> menus, Func<string, bool> menuHasAssets)
		{
			if (!replaceEnabled)
			{
				return Array.Empty<OwnedAssetMenu>();
			}

			return menus
				.Where(menu => !ShouldYield(replaceEnabled, menu.Value, !string.IsNullOrEmpty(menu.Value) && menuHasAssets(menu.Value)))
				.OrderBy(menu => menu.Key)
				.Select(menu => new OwnedAssetMenu(menu.Key, menu.Value))
				.ToArray();
		}
	}
}
