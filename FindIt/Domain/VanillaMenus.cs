using System;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// The vanilla toolbar menus the lens treats specially, by the name the
	/// game's UIAssetMenuPrefab carries — the same string assets record as
	/// PrefabIndex.UiMenuName.
	/// </summary>
	/// <remarks>
	/// Two names, not a table. VanillaMenuPresets used to map every service
	/// menu to an upstream (PrefabCategory, PrefabSubCategory) pair; the
	/// menu tree made all of that redundant, and what survived was one
	/// question — "is this Zones?" — asked to honour the ReplaceVanillaZonesMenu
	/// setting. Roads is here because NetworkMenuExtension already named it.
	/// </remarks>
	public static class VanillaMenus
	{
		public const string Roads = "Roads";

		public const string Zones = "Zones";

		public static bool IsZones(string? menu) =>
			string.Equals(menu?.Trim(), Zones, StringComparison.OrdinalIgnoreCase);
	}
}
