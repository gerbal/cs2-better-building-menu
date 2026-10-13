namespace BetterBuildingMenu.Domain
{
	/// <summary>What each setting ships with, and what Reset the build menu… puts back.</summary>
	/// <remarks>
	/// Pure, over <see cref="ISettingsValues"/>, so tests check every value without building the
	/// settings class, whose initializers read these same constants, the control pane's
	/// excepted (see <see cref="ControlPaneShownWhenMissing"/>). See docs/design-notes.md,
	/// "Reset the build menu".
	/// </remarks>
	public static class SettingsDefaults
	{
		public const bool ReplaceVanillaBuildMenu = true;

		/// <summary>A new player's control pane: hidden, since the top row holds every control.</summary>
		public const bool ControlPaneShown = false;

		/// <summary>
		/// What a settings file without the pane's key reads as: shown, 0.2.4's default. The settings
		/// class starts here, so an upgrader's missing key keeps the pane, and the migration turns it
		/// off for everyone else.
		/// </summary>
		public const bool ControlPaneShownWhenMissing = true;

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
			values.DevSlotMargin = Tuning.SlotMarginPercent;
			values.DevPickLogger = Tuning.PickLogger;
			values.DevInterfaceStyles = Tuning.InterfaceStyles;
			values.DevTabNames = Tuning.TabNames;
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
