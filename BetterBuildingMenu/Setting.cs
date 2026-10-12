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
	public class BetterBuildingMenuSettings : ModSetting, Domain.ISettingsValues
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

		/// <summary>
		/// The build menu's width, set by dragging its right edge, or <see
		/// cref="Domain.AssetMenuCatalogWidth.Default"/> for the room beside the control pane.
		/// </summary>
		/// <remarks>Hidden like the height, and for the same reason.</remarks>
		[SettingsUIHidden]
		public float AssetMenuCatalogWidth { get; set; } = Domain.AssetMenuCatalogWidth.Default;

		/// <summary>Whether the control pane beside the build menu is shown, toggled from the menu's header.</summary>
		[SettingsUIHidden]
		public bool ControlPaneShown { get; set; } = true;

		/// <summary>
		/// The settings file's format version: 0 in a file no release has stepped, stored at
		/// load by <see cref="Domain.SettingsMigration"/> once it has run.
		/// </summary>
		/// <remarks>
		/// No initializer, and left out of SetDefaults: the game writes a key only once it differs
		/// from the default object's. See docs/design-notes.md, "The release marker and the
		/// settings version".
		/// </remarks>
		[SettingsUIHidden]
		public int SettingsVersion { get; set; }

		/// <summary>
		/// Which of the build menu's five widths it draws at, from 1, the game's own, to 5.
		/// </summary>
		/// <remarks>
		/// Hidden. A number rather than a width, because the widths follow the screen. See
		/// <see cref="Domain.WidthSteps"/>.
		/// </remarks>
		[SettingsUIHidden]
		public int AssetMenuWidthStep { get; set; } = Domain.WidthSteps.DefaultStep;

		/// <summary>
		/// Whether the settings migration found that this player ran a release from before the
		/// Width steps.
		/// </summary>
		/// <remarks>Hidden. See docs/design-notes.md, "Who is an upgrader".</remarks>
		[SettingsUIHidden]
		public bool Upgrader { get; set; }

		/// <summary>
		/// The view the player last picked in the control pane, or <see
		/// cref="Domain.AssetMenuViewMode.None"/> before any pick.
		/// </summary>
		/// <remarks>Hidden: the control pane is where it is set.</remarks>
		[SettingsUIHidden]
		public string AssetMenuViewMode { get; set; } = Domain.AssetMenuViewMode.None;

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
		/// <remarks>
		/// The same values as the initializers above, which apply before anything can call this.
		/// Not the settings version, which records the migration, nor the legacy width, which only
		/// the migration reads.
		/// </remarks>
		public override void SetDefaults()
		{
			AssetMenuHeight = Domain.AssetMenuHeight.Default;
			AssetMenuWidthStep = Domain.WidthSteps.DefaultStep;
			Upgrader = false;
			ControlPaneShown = true;
			AssetMenuViewMode = Domain.AssetMenuViewMode.None;
			ReplaceVanillaBuildMenu = true;
			AutoWidenSearch = false;
			AssetMenuTileSize = DefaultTileSize;
		}
	}
}
