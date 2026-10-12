using Colossal.IO.AssetDatabase;
using BetterBuildingMenu.Utilities;
using Game.Input;
using Game.Modding;
using Game.Settings;
using Game.UI;
using Game.UI.Localization;

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
		/// The width 0.2.4 stored for the build menu, or <see
		/// cref="Domain.AssetMenuCatalogWidth.Default"/> for the room beside the control pane.
		/// </summary>
		/// <remarks>
		/// Legacy: only the settings migration reads it, once, and nothing writes it. Declared so
		/// the game keeps the key in the file until then.
		/// </remarks>
		[SettingsUIHidden]
		public float AssetMenuCatalogWidth { get; set; } = Domain.AssetMenuCatalogWidth.Default;

		/// <summary>Whether the control pane beside the build menu is shown, toggled from the menu's header.</summary>
		[SettingsUIHidden]
		public bool ControlPaneShown { get; set; } = Domain.SettingsDefaults.ControlPaneShown;

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
		/// Hidden: the build menu's right edge sets it. A number rather than a width, because the
		/// widths follow the screen. See
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
		public bool ReplaceVanillaBuildMenu { get; set; } = Domain.SettingsDefaults.ReplaceVanillaBuildMenu;

		// A search that finds nothing in the current section offers to widen by
		// default rather than widening on its own, so the section scope is not
		// silently discarded. Players who mostly search globally can flip it.
		[SettingsUISection(SETTINGS, BEHAVIOR)]
		[SettingsUIDisableByCondition(typeof(BetterBuildingMenuSettings), nameof(ReplaceVanillaBuildMenu), true)]
		[SettingsUIDescription(typeof(BetterBuildingMenuSettings), nameof(AutoWidenSearchDescription))]
		public bool AutoWidenSearch { get; set; }

		/// <summary>
		/// Grid tile width, in the units the tile label budget also uses: the single number the
		/// tile and its label both size themselves from.
		/// </summary>
		[SettingsUISection(SETTINGS, UIUX)]
		// Step 4, not 8: 64 + 8k never lands on the default, so a player who nudged the
		// slider could not get back to the shipped width.
		[SettingsUISlider(min = 64, max = 144, step = 4, scalarMultiplier = 1, unit = Unit.kInteger)]
		[SettingsUIDisableByCondition(typeof(BetterBuildingMenuSettings), nameof(ReplaceVanillaBuildMenu), true)]
		[SettingsUIDescription(typeof(BetterBuildingMenuSettings), nameof(AssetMenuTileSizeDescription))]
		public int AssetMenuTileSize { get; set; } = Domain.SettingsDefaults.TileSize;

		/// <summary>
		/// The Reset the build menu… button: every setting back to how it ships, once the player
		/// confirms.
		/// </summary>
		/// <remarks>
		/// A setter and no getter, so the game draws a button and never saves it. See
		/// docs/design-notes.md, "Reset the build menu".
		/// </remarks>
		[SettingsUISection(SETTINGS, UIUX)]
		[SettingsUIButton]
		[SettingsUIConfirmation]
		[SettingsUIDisableByCondition(typeof(BetterBuildingMenuSettings), nameof(ReplaceVanillaBuildMenu), true)]
		[SettingsUIDescription(typeof(BetterBuildingMenuSettings), nameof(ResetBuildMenuDescription))]
		public bool ResetBuildMenu
		{
			set
			{
				Domain.SettingsDefaults.Reset(this);
				ApplyAndSave();
			}
		}

		/// <summary>Puts every option back to the value it ships with.</summary>
		/// <remarks>
		/// The initializers above read the same constants. See docs/design-notes.md, "Reset the
		/// build menu".
		/// </remarks>
		public override void SetDefaults()
		{
			Domain.SettingsDefaults.Apply(this);
		}

		/// <summary>A row's description while Replace is on or off. See <see cref="Domain.OptionRows"/>.</summary>
		/// <remarks>The game calls a description getter with no arguments, so each row that waits for Replace has its own below.</remarks>
		private LocalizedString RowDescription(string row) =>
			LocalizedString.Id(Domain.OptionRows.DescriptionId(ReplaceVanillaBuildMenu, GetOptionDescLocaleID(row)));

		private LocalizedString AutoWidenSearchDescription() => RowDescription(nameof(AutoWidenSearch));

		private LocalizedString AssetMenuTileSizeDescription() => RowDescription(nameof(AssetMenuTileSize));

		private LocalizedString ResetBuildMenuDescription() => RowDescription(nameof(ResetBuildMenu));
	}
}
