using System.Diagnostics.CodeAnalysis;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Whether a toolbar menu the player just opened should be left to the vanilla grid.</summary>
	public static class MenuRouting
	{
		/// <remarks>A menu with a name but nothing indexed under it is one the index cannot fill,
		/// such as a mod's menu built from nested categories; the asset menu would only say "no buildings".</remarks>
		public static bool ShouldYield(bool replaceEnabled, [NotNullWhen(false)] string? menuName, bool menuHasAssets) =>
			!replaceEnabled || string.IsNullOrEmpty(menuName) || !menuHasAssets;
	}
}
