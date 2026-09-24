namespace BetterBuildingMenu.Domain
{
	/// <summary>The category and menu an asset is filed under: the game's live placement when it has
	/// one, the prefab's own group otherwise.</summary>
	public static class MenuPlacementOverride
	{
		/// <remarks>Mods that regroup the menu at runtime change the entity world's placement and leave
		/// the managed UIObject on the stock group.</remarks>
		public static (string? Category, string? Menu) Resolve(string? managedCategory, string? managedMenu, string? placedCategory, string? placedMenu) =>
			placedCategory?.Trim() is { Length: > 0 } category
				? (category, placedMenu?.Trim() is { Length: > 0 } menu ? menu : managedMenu)
				: (managedCategory, managedMenu);
	}
}
