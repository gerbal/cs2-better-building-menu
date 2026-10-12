namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The width 0.2.4 stored for the build menu, which the settings migration turns into a Width
	/// step.
	/// </summary>
	/// <remarks>
	/// Legacy: the setting stays declared so the game keeps its key until the migration reads it,
	/// and nothing writes it. See docs/design-notes.md, "The settings migration".
	/// </remarks>
	public static class AssetMenuCatalogWidth
	{
		/// <summary>Not a width: 0.2.4's default, the room beside the control pane.</summary>
		/// <remarks>
		/// Zero, because no real width is zero, and a value the settings file cannot read
		/// decodes as zero, so it too reads as the default.
		/// </remarks>
		public const float Default = 0f;

		/// <summary>The width <see cref="Default"/> drew: the room beside the control pane, on any screen.</summary>
		/// <remarks>The settings migration gives a 0.2.4 player at the default the Width step nearest it.</remarks>
		public const float UpgraderWidth = 1091f;
	}
}
