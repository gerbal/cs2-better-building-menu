using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Utilities;

using Game.UI.Menu;

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

		private void OpenModOptions()
		{
			// VIEW's More options: the mod's own page, on its one tab. Closing Options lands on the
			// pause menu, which is the game's. A failure costs the player a click, never the session.
			try
			{
				var options = World.GetExistingSystemManaged<OptionsUISystem>();
				if (options is null)
				{
					Mod.Log.Warn("Could not open the mod's Options page: the game's Options system is missing");
					return;
				}

				var target = OptionRows.OptionsPage(Mod.Settings.id, BetterBuildingMenuSettings.SETTINGS);
				options.OpenPage(target.Page, target.Section, isAdvanced: false);
			}
			catch (Exception ex)
			{
				Mod.Log.Warn(ex, "Could not open the mod's Options page");
			}
		}

		/// <summary>The open menu's own VIEW, kept across sessions, saved once; "" or a kind no body draws goes back to Default view.</summary>
		/// <remarks>The save re-pushes the picks, which redraws the body. See docs/design-notes.md, "Each menu's own view and group".</remarks>
		private void SetAssetMenuView(string kind)
		{
			var kept = MenuPicks.With(Mod.Settings.MenuViews, _assetMenu.Menu, BodyViews.SanitizePick(kind, Knobs.DeveloperMode));

			if (_assetMenu.Menu.Length == 0 || string.Equals(kept, Mod.Settings.MenuViews, StringComparison.Ordinal))
			{
				return;
			}

			Mod.Settings.MenuViews = kept;
			Mod.Settings.ApplyAndSave();
		}
	}
}
