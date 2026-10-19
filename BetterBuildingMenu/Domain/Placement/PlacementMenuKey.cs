using BetterBuildingMenu.Domain.Catalog;

namespace BetterBuildingMenu.Domain.Placement
{
	/// <summary>Where a placement is counted: the game menu and the prefab's name.</summary>
	public readonly record struct PlacementKey(string Menu, string Prefab);

	public static class PlacementMenuKey
	{
		/// <summary>The key for a placed prefab, or null when it is not indexed or in no game menu.</summary>
		/// <remarks>
		/// The index entry's own menu, not the catalog row's, which shows some extra networks
		/// under Roads.
		/// </remarks>
		public static PlacementKey? Resolve(CatalogIndex index, int prefabId)
		{
			if (!index.IsReady
				|| index.Get(prefabId) is not { } entry
				|| entry.UiMenuName?.Trim() is not { Length: > 0 } menu
				|| entry.PrefabName.Trim().Length == 0)
			{
				return null;
			}

			return new PlacementKey(menu, entry.PrefabName);
		}
	}
}
