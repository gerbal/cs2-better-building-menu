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
			// Only on release: a drag publishes on every mouse move, and
			// writing the settings file at that rate is what the live binding avoids.
			var height = AssetMenuHeight.Clamp(_AssetMenuHeight);
			if (Math.Abs(Mod.Settings.AssetMenuHeight - height) < 0.1f)
			{
				return;
			}

			Mod.Settings.AssetMenuHeight = height;
			Mod.Settings.ApplyAndSave();
		}

		private void SetAssetMenuWidthStep(int picked)
		{
			// The binding helper has already published what the UI sent: publish the kept
			// step over it, then save only a release that changes the file. A drag sends
			// once, on release, so there is nothing to wait out.
			var step = WidthSteps.Sanitize(picked);
			_AssetMenuWidthStep.Value = step;

			if (Mod.Settings.AssetMenuWidthStep == step)
			{
				return;
			}

			Mod.Settings.AssetMenuWidthStep = step;
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

		private void SetAssetMenuViewMode(string picked)
		{
			// The binding helper has already published what the UI sent: publish the kept
			// value over it, then save only a pick that changes the file.
			var view = AssetMenuViewMode.Sanitize(picked);
			_AssetMenuViewMode.Value = view;

			if (!AssetMenuViewMode.ShouldSave(Mod.Settings.AssetMenuViewMode, view))
			{
				return;
			}

			Mod.Settings.AssetMenuViewMode = view;
			Mod.Settings.ApplyAndSave();
		}
	}
}
