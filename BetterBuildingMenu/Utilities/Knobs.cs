using BetterBuildingMenu.Domain;

using Game.SceneFlow;

namespace BetterBuildingMenu.Utilities
{
	/// <summary>The developer knobs' values in this run.</summary>
	/// <remarks>
	/// Read at each call, so a knob moved in Options takes effect at once. See
	/// docs/design-notes.md, "Developer knobs".
	/// </remarks>
	internal static class Knobs
	{
		/// <summary>Whether the game runs in developer mode, the only mode in which a knob's row shows.</summary>
		internal static bool DeveloperMode => GameManager.instance?.configuration?.developerMode == true;

		/// <summary>A knob's value now: the stored one in developer mode, else the shipped one, as before the settings load.</summary>
		internal static T Value<T>(Func<BetterBuildingMenuSettings, T> stored, T shipped) =>
			Mod.Settings is { } settings ? Tuning.Value(DeveloperMode, stored(settings), shipped) : shipped;
	}
}
