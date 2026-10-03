using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Utilities;

using System;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		private void SetAssetMenuHeight(float height)
		{
			_AssetMenuHeight.Value = AssetMenuHeight.Clamp(height);
		}

		private void CommitAssetMenuHeight()
		{
			// Only on release, like the width: a drag publishes on every mouse move, and
			// writing the settings file at that rate is what the live binding avoids.
			var height = AssetMenuHeight.Clamp(_AssetMenuHeight);
			if (Math.Abs(Mod.Settings.AssetMenuHeight - height) < 0.1f)
			{
				return;
			}

			Mod.Settings.AssetMenuHeight = height;
			Mod.Settings.ApplyAndSave();
		}

		private void SetAssetMenuCatalogWidth(float width)
		{
			_AssetMenuCatalogWidth.Value = AssetMenuCatalogWidth.Sanitize(width);
		}

		private void CommitAssetMenuCatalogWidth()
		{
			// On release only, as the height is.
			var width = AssetMenuCatalogWidth.Sanitize(_AssetMenuCatalogWidth);
			if (Math.Abs(Mod.Settings.AssetMenuCatalogWidth - width) < 0.1f)
			{
				return;
			}

			Mod.Settings.AssetMenuCatalogWidth = width;
			Mod.Settings.ApplyAndSave();
		}

		private void SetControlPaneShown(bool shown)
		{
			// One click, one write: there is no drag to wait out.
			_ControlPaneShown.Value = shown;
			if (Mod.Settings.ControlPaneShown == shown)
			{
				return;
			}

			Mod.Settings.ControlPaneShown = shown;
			Mod.Settings.ApplyAndSave();
		}
	}
}
