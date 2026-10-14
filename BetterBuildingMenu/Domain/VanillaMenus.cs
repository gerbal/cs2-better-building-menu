using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The vanilla toolbar menus the asset menu treats specially, by the name the
	/// game's UIAssetMenuPrefab carries — the same string assets record as
	/// PrefabIndex.UiMenuName.
	/// </summary>
	/// <remarks>
	/// Two names, not a table: the menu tree answers everything else. Zones is here
	/// to honour the ReplaceVanillaZonesMenu setting, Roads for NetworkMenuExtension.
	/// </remarks>
	public static class VanillaMenus
	{
		public const string Roads = "Roads";

		public const string Zones = "Zones";

		public static bool IsZones(string? menu) =>
			string.Equals(menu?.Trim(), Zones, StringComparison.OrdinalIgnoreCase);

		/// <summary>The education menu, matched the way the UI's isEducationMenu matches it.</summary>
		public static bool IsEducation(string? menu) =>
			(menu ?? string.Empty).IndexOf("Education", StringComparison.OrdinalIgnoreCase) >= 0;
	}
}
