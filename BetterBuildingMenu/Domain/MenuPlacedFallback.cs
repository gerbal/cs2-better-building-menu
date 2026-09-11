namespace BetterBuildingMenu.Domain
{
	/// <summary>The catch-all rule: index anything the vanilla menu places that no processor claimed.</summary>
	public static class MenuPlacedFallback
	{
		/// <remarks>Categories sit in a menu's element buffers too, so a mod's nested tabs would
		/// otherwise be indexed as assets.</remarks>
		public static bool ShouldIndex(bool placedInVanillaMenu, bool isCategory, bool alreadyIndexed) =>
			placedInVanillaMenu && !isCategory && !alreadyIndexed;
	}
}
