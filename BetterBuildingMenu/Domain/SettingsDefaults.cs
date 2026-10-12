namespace BetterBuildingMenu.Domain
{
	/// <summary>What each setting ships with, and what Reset the build menu… puts back.</summary>
	/// <remarks>
	/// Pure, over <see cref="ISettingsValues"/>, so tests check every value without building the
	/// settings class, whose initializers read these same constants. See docs/design-notes.md,
	/// "Reset the build menu".
	/// </remarks>
	public static class SettingsDefaults
	{
		public const bool ReplaceVanillaBuildMenu = true;

		public const bool ControlPaneShown = true;

		/// <summary>The grid's tile width: one of the Tile size slider's 64 + 4k.</summary>
		public const int TileSize = 100;

		/// <summary>Every stored setting back to how it ships.</summary>
		/// <remarks>
		/// Not the settings version, which records the migration, nor the legacy width, which only
		/// the migration reads.
		/// </remarks>
		public static void Apply(ISettingsValues values)
		{
			values.AssetMenuHeight = AssetMenuHeight.Default;
			values.AssetMenuWidthStep = WidthSteps.DefaultStep;
			values.Upgrader = false;
			values.ControlPaneShown = ControlPaneShown;
			values.AssetMenuViewMode = AssetMenuViewMode.None;
			values.ReplaceVanillaBuildMenu = ReplaceVanillaBuildMenu;
			values.AutoWidenSearch = false;
			values.AssetMenuTileSize = TileSize;
		}

		/// <summary>The button: every setting as it ships, then a settings version the next load does not migrate.</summary>
		/// <remarks>A later release's version is kept, as the migration keeps a later release's file whole.</remarks>
		public static void Reset(ISettingsValues values)
		{
			Apply(values);
			values.SettingsVersion = Math.Max(values.SettingsVersion, SettingsMigration.Current);
		}
	}
}
