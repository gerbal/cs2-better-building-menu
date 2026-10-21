using BetterBuildingMenu.Utilities;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		private void SetAssetMenuHeight(float height) => _AssetMenuHeight.Set(height);

		// Only on release, like the width: a drag publishes on every mouse move, and
		// writing the settings file at that rate is what the live binding avoids.
		private void CommitAssetMenuHeight() => _AssetMenuHeight.Commit();

		private void SetAssetMenuCatalogWidth(float width) => _AssetMenuCatalogWidth.Set(width);

		// On release only, as the height is.
		private void CommitAssetMenuCatalogWidth() => _AssetMenuCatalogWidth.Commit();

		// One click, one write: there is no drag to wait out.
		private void SetControlPaneShown(bool shown) => _ControlPaneShown.SetAndCommit(shown);

		// The binding helper has already published what the UI sent: publish the kept
		// value over it, then save only a pick that changes the file.
		private void SetAssetMenuViewMode(string picked) => _AssetMenuViewMode.SetAndCommit(picked);

		private static void SaveSettings() => Mod.Settings.ApplyAndSave();
	}
}
