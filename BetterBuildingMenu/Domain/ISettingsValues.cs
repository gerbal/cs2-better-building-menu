namespace BetterBuildingMenu.Domain
{
	/// <summary>Every setting the settings class stores, which the migration and Reset read and write.</summary>
	/// <remarks>
	/// The settings class implements it, and tests implement it on a plain object: building the
	/// settings class writes a static table the game owns. SettingsShapeTests holds it to every
	/// setting the class stores, so a reset cannot miss one.
	/// </remarks>
	public interface ISettingsValues
	{
		int SettingsVersion { get; set; }

		bool Upgrader { get; set; }

		float AssetMenuHeight { get; set; }

		// Read only here: the settings class keeps its setter for the game's loader.
		float AssetMenuCatalogWidth { get; }

		int AssetMenuWidthStep { get; set; }

		string DefaultView { get; set; }

		string AtLargeText { get; set; }

		string HoverCard { get; set; }

		string MenuGroups { get; set; }

		string MenuViews { get; set; }

		bool ControlPaneShown { get; set; }

		string AssetMenuViewMode { get; set; }

		bool ReplaceVanillaBuildMenu { get; set; }

		bool AutoWidenSearch { get; set; }

		int AssetMenuTileSize { get; set; }

		int DevSlotMargin { get; set; }

		bool DevPickLogger { get; set; }

		bool DevInterfaceStyles { get; set; }

		bool DevTabNames { get; set; }

		int DevListShare { get; set; }

		string DevWhatCounts { get; set; }

		string DevAutoLargeText { get; set; }

		int DevCardsFrom { get; set; }

		float DevListPlateHeight { get; set; }

		int DevNameLines { get; set; }

		bool DevTileNameLine { get; set; }

		string DevBlockLabels { get; set; }

		int DevCardHeight { get; set; }

		bool DevSmallMenusGrow { get; set; }

		string DevSearchFlow { get; set; }

		int DevSaidOnceAt { get; set; }

		bool DevDimTypedWord { get; set; }

		int DevIconsAbove { get; set; }

		int DevIconSize { get; set; }

		int DevHoverDelay { get; set; }
	}
}
