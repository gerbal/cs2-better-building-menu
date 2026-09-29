using Colossal.IO.AssetDatabase;
using BetterBuildingMenu.Utilities;
using Game.Input;
using Game.Modding;
using Game.Settings;
using Game.UI;

namespace BetterBuildingMenu
{
    [FileLocation(nameof(BetterBuildingMenu))]
	[SettingsUITabOrder(SETTINGS)]
	[SettingsUIGroupOrder(BEHAVIOR, UIUX)]
	[SettingsUIShowGroupName(BEHAVIOR, UIUX)]
	public class BetterBuildingMenuSettings : ModSetting
	{
		public const string SETTINGS = "Settings";
		public const string BEHAVIOR = "Behavior";
		public const string UIUX = "UIUX";

		private const int DefaultTileSize = 100;

		public BetterBuildingMenuSettings(IMod mod) : base(mod)
		{

		}

		/// <summary>
		/// The catalog's height, in the same rem-like units as the width, set
		/// by dragging the asset menu's top edge.
		/// </summary>
		/// <remarks>
		/// Hidden like the width: it is a direct-manipulation value, and a slider in the options
		/// screen would be a second way to say the same thing. See
		/// <see cref="Domain.AssetMenuHeight"/> for the range.
		/// </remarks>
		[SettingsUIHidden]
		public float AssetMenuHeight { get; set; } = Domain.AssetMenuHeight.Default;

		// On by default: replacing the build menu is what this mod is for. Turning it off
		// restores the vanilla menu wholesale, including the Zones button's own hierarchy.
		[SettingsUISection(SETTINGS, BEHAVIOR)]
		public bool ReplaceVanillaBuildMenu { get; set; } = true;

		// A search that finds nothing in the current section offers to widen by
		// default rather than widening on its own, so the section scope is not
		// silently discarded. Players who mostly search globally can flip it.
		[SettingsUISection(SETTINGS, BEHAVIOR)]
		public bool AutoWidenSearch { get; set; }

		/// <summary>
		/// Grid tile width, in the units the tile label budget also uses: the single number the
		/// tile and its label both size themselves from.
		/// </summary>
		[SettingsUISection(SETTINGS, UIUX)]
		// Step 4, not 8: 64 + 8k never lands on the default, so a player who nudged the
		// slider could not get back to the shipped width.
		[SettingsUISlider(min = 64, max = 144, step = 4, scalarMultiplier = 1, unit = Unit.kInteger)]
		public int AssetMenuTileSize { get; set; } = DefaultTileSize;

		/// <summary>Puts every option back to the value it ships with.</summary>
		/// <remarks>The same values as the initializers above, which apply before anything can call this.</remarks>
		public override void SetDefaults()
		{
			AssetMenuHeight = Domain.AssetMenuHeight.Default;
			ReplaceVanillaBuildMenu = true;
			AutoWidenSearch = false;
			AssetMenuTileSize = DefaultTileSize;
		}
	}
}
