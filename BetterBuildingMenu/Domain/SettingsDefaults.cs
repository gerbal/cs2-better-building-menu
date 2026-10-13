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

		/// <summary>The Tiles view's tile width: one of the Tile size slider's 64 + 4k, two rows of ten in the game's own menu size.</summary>
		public const int TileSize = 64;

		/// <summary>A new player's Default view: the look's own rule picks each menu's body.</summary>
		public const string DefaultView = BodyViews.Auto;

		/// <summary>No menu has a pick of its own: each draws its default.</summary>
		public const string NoPicks = MenuPicks.None;

		/// <summary>Above 100% text, the list keeps more buildings and shortens long names.</summary>
		public const string AtLargeText = LargeText.MoreBuildings;

		/// <summary>Pointing at a building shows a small card beside the pointer.</summary>
		public const string HoverCard = HoverCards.Pointer;

		/// <summary>Every menu drawn in Standard, the look BBM recommends.</summary>
		public const string MenuLook = Looks.Standard;

		/// <summary>Every stored setting back to how it ships.</summary>
		/// <remarks>
		/// Not the settings version, which records the migration, nor the legacy width and view, which
		/// only the migration reads.
		/// </remarks>
		public static void Apply(ISettingsValues values)
		{
			values.AssetMenuHeight = AssetMenuHeight.Default;
			values.AssetMenuWidthStep = WidthSteps.DefaultStep;
			values.DefaultView = DefaultView;
			values.AtLargeText = AtLargeText;
			values.HoverCard = HoverCard;
			values.MenuLook = MenuLook;
			values.MenuGroups = NoPicks;
			values.MenuViews = NoPicks;
			values.Upgrader = false;
			values.ControlPaneShown = ControlPaneShown;
			values.ReplaceVanillaBuildMenu = ReplaceVanillaBuildMenu;
			values.AutoWidenSearch = false;
			values.AssetMenuTileSize = TileSize;
			values.DevSlotMargin = Tuning.SlotMarginPercent;
			values.DevPickLogger = Tuning.PickLogger;
			values.DevInterfaceStyles = Tuning.InterfaceStyles;
			values.DevTabNames = Tuning.TabNames;
			values.DevListShare = Tuning.ListShare;
			values.DevWhatCounts = Tuning.WhatCounts;
			values.DevAutoLargeText = Tuning.AutoLargeText;
			values.DevCardsFrom = Tuning.CardsFrom;
			values.DevListPlateHeight = Tuning.ListPlateHeight;
			values.DevNameLines = Tuning.NameLines;
			values.DevTileNameLine = Tuning.TileNameLine;
			values.DevBlockLabels = Tuning.BlockLabels;
			values.DevCardHeight = Tuning.CardHeight;
			values.DevSmallMenusGrow = Tuning.SmallMenusGrow;
			values.DevSearchFlow = Tuning.SearchFlow;
			values.DevSaidOnceAt = Tuning.SaidOnceAt;
			values.DevDimTypedWord = Tuning.DimTypedWord;
			values.DevIconsAbove = Tuning.IconsAbove;
			values.DevIconSize = Tuning.IconSize;
			values.DevHoverDelay = Tuning.HoverDelay;
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
