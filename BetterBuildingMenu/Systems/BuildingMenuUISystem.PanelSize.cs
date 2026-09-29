using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Utilities;

using System;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		private void SetBuildingLensPanelHeight(float height)
		{
			_BuildingLensPanelHeight.Value = BuildingLensHeight.Clamp(height);
		}

		private void CommitBuildingLensPanelHeight()
		{
			// Only on release, like the width: a drag publishes on every mouse move, and
			// writing the settings file at that rate is what the live binding avoids.
			var height = BuildingLensHeight.Clamp(_BuildingLensPanelHeight);
			if (Math.Abs(Mod.Settings.BuildingLensPanelHeight - height) < 0.1f)
			{
				return;
			}

			Mod.Settings.BuildingLensPanelHeight = height;
			Mod.Settings.ApplyAndSave();
		}
	}
}
