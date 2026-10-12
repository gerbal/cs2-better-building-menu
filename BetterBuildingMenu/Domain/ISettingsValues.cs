namespace BetterBuildingMenu.Domain
{
	/// <summary>The settings the migration reads and writes.</summary>
	/// <remarks>
	/// The settings class implements it, and tests implement it on a plain object: building the
	/// settings class writes a static table the game owns.
	/// </remarks>
	public interface ISettingsValues
	{
		int SettingsVersion { get; set; }

		bool Upgrader { get; set; }

		float AssetMenuHeight { get; set; }

		// Read only here: the settings class keeps its setter for the game's loader.
		float AssetMenuCatalogWidth { get; }

		int AssetMenuWidthStep { get; set; }
	}
}
