namespace BetterBuildingMenu.Domain
{
	/// <summary>The category and menu an asset is filed under, and that category's priority: the game's
	/// live placement when it has one, the prefab's own group otherwise.</summary>
	public static class MenuPlacementOverride
	{
		/// <remarks>Mods that regroup the menu at runtime change the entity world's placement and leave
		/// the managed UIObject on the stock group. The priority goes with the category, so an asset
		/// moved into a tab ranks as that tab's own assets do, whether or not the strip draws it.</remarks>
		public static (string? Category, string? Menu, int Priority) Resolve(
			string? managedCategory,
			string? managedMenu,
			int managedPriority,
			string? placedCategory,
			string? placedMenu,
			int placedPriority) =>
			placedCategory?.Trim() is { Length: > 0 } category
				? (category, placedMenu?.Trim() is { Length: > 0 } menu ? menu : managedMenu, placedPriority)
				: (managedCategory, managedMenu, managedPriority);
	}
}
