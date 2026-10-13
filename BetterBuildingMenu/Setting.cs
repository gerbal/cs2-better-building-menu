using Colossal.IO.AssetDatabase;
using BetterBuildingMenu.Utilities;
using Game.Input;
using Game.Modding;
using Game.Settings;
using Game.UI;
using Game.UI.Localization;
using Game.UI.Widgets;
using System.Linq;

namespace BetterBuildingMenu
{
    [FileLocation(nameof(BetterBuildingMenu))]
	[SettingsUITabOrder(SETTINGS)]
	[SettingsUIGroupOrder(BEHAVIOR, UIUX, TUNING)]
	[SettingsUIShowGroupName(BEHAVIOR, UIUX, TUNING)]
	public class BetterBuildingMenuSettings : ModSetting, Domain.ISettingsValues
	{
		public const string SETTINGS = "Settings";
		public const string BEHAVIOR = "Behavior";
		public const string UIUX = "UIUX";
		public const string TUNING = "Tuning";

		public BetterBuildingMenuSettings(IMod mod) : base(mod)
		{

		}

		/// <summary>
		/// The height of the asset menu's body, in the same rem-like units as the width, set by
		/// dragging the asset menu's top edge. The box is this and 63.75 for its top row and tab row.
		/// </summary>
		/// <remarks>
		/// Hidden: it is a direct-manipulation value, and a slider in the options screen
		/// would be a second way to say the same thing. See <see cref="Domain.AssetMenuHeight"/>
		/// for the range.
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
		/// Which of the build menu's five widths it draws at, from 1, the game's own, to 5.
		/// </summary>
		/// <remarks>
		/// A number rather than a width, because the widths follow the screen. The menu's right edge
		/// writes the same value. See <see cref="Domain.WidthSteps"/>.
		/// </remarks>
		[SettingsUISection(SETTINGS, UIUX)]
		[SettingsUIDropdown(typeof(BetterBuildingMenuSettings), nameof(WidthStepItems))]
		[SettingsUIDisableByCondition(typeof(BetterBuildingMenuSettings), nameof(ReplaceVanillaBuildMenu), true)]
		[SettingsUIDescription(typeof(BetterBuildingMenuSettings), nameof(AssetMenuWidthStepDescription))]
		public int AssetMenuWidthStep { get; set; } = Domain.WidthSteps.DefaultStep;

		/// <summary>
		/// The body every menu without a VIEW pick of its own draws: Auto, the look's rule per menu, or
		/// one body for all.
		/// </summary>
		/// <remarks>A string, so a body a later release retires reads as another. See <see cref="Domain.BodyViews"/>.</remarks>
		[SettingsUISection(SETTINGS, UIUX)]
		[SettingsUIDropdown(typeof(BetterBuildingMenuSettings), nameof(DefaultViewItems))]
		[SettingsUIDisableByCondition(typeof(BetterBuildingMenuSettings), nameof(ReplaceVanillaBuildMenu), true)]
		[SettingsUIDescription(typeof(BetterBuildingMenuSettings), nameof(DefaultViewDescription))]
		public string DefaultView { get; set; } = Domain.SettingsDefaults.DefaultView;

		/// <summary>
		/// The Tiles view's tile width, in the units the tile label budget also uses: the single number
		/// the tile and its label both size themselves from.
		/// </summary>
		[SettingsUISection(SETTINGS, UIUX)]
		// Step 4, not 8: 64 + 8k never lands on the default, so a player who nudged the
		// slider could not get back to the shipped width.
		[SettingsUISlider(min = 64, max = 144, step = 4, scalarMultiplier = 1, unit = Unit.kInteger)]
		[SettingsUIDisableByCondition(typeof(BetterBuildingMenuSettings), nameof(ReplaceVanillaBuildMenu), true)]
		[SettingsUIDescription(typeof(BetterBuildingMenuSettings), nameof(AssetMenuTileSizeDescription))]
		public int AssetMenuTileSize { get; set; } = Domain.SettingsDefaults.TileSize;

		/// <summary>Above 100% text: the list's more buildings with long names shortened, or fewer with every name whole.</summary>
		/// <remarks>See <see cref="Domain.LargeText"/>.</remarks>
		[SettingsUISection(SETTINGS, UIUX)]
		[SettingsUIDropdown(typeof(BetterBuildingMenuSettings), nameof(AtLargeTextItems))]
		[SettingsUIDisableByCondition(typeof(BetterBuildingMenuSettings), nameof(ReplaceVanillaBuildMenu), true)]
		[SettingsUIDescription(typeof(BetterBuildingMenuSettings), nameof(AtLargeTextDescription))]
		public string AtLargeText { get; set; } = Domain.SettingsDefaults.AtLargeText;

		/// <summary>Whether the control pane beside the build menu shows Sort, Filter, Group and View again.</summary>
		/// <remarks>
		/// Starts shown, 0.2.4's default, so a file without the key reads shown, as 0.2.4 reads it. A new
		/// player's off comes from the defaults and the settings migration. See docs/design-notes.md,
		/// "The settings migration".
		/// </remarks>
		[SettingsUISection(SETTINGS, UIUX)]
		[SettingsUIDisableByCondition(typeof(BetterBuildingMenuSettings), nameof(ReplaceVanillaBuildMenu), true)]
		[SettingsUIDescription(typeof(BetterBuildingMenuSettings), nameof(ControlPaneShownDescription))]
		public bool ControlPaneShown { get; set; } = Domain.SettingsDefaults.ControlPaneShownWhenMissing;

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

		/// <summary>
		/// Developer only: writes a line for each building armed, each swap and each placement to
		/// picks.jsonl in the mod's ModsData folder, on this computer.
		/// </summary>
		/// <remarks>Read through Utilities.Knobs, so it counts only in developer mode. See docs/design-notes.md, "The pick logger".</remarks>
		[SettingsUISection(SETTINGS, TUNING)]
		[SettingsUIDeveloper]
		[SettingsUISearchHidden]
		public bool DevPickLogger { get; set; }

		/// <summary>
		/// Developer only: how many more placements, in percent, a building needs than a menu's
		/// weaker slot holder to take its slot.
		/// </summary>
		/// <remarks>Read through Utilities.Knobs, so it counts only in developer mode. See docs/design-notes.md, "Developer knobs".</remarks>
		[SettingsUISection(SETTINGS, TUNING)]
		[SettingsUIDeveloper]
		[SettingsUISearchHidden]
		[SettingsUISlider(min = Domain.Tuning.SlotMarginMin, max = Domain.Tuning.SlotMarginMax, step = 5, scalarMultiplier = 1, unit = Unit.kPercentage)]
		public int DevSlotMargin { get; set; } = Domain.Tuning.SlotMarginPercent;

		/// <summary>
		/// Developer only: whether the build menu follows the game's interface style, or keeps its
		/// look's own colours under every style, to compare.
		/// </summary>
		/// <remarks>Read through Utilities.Knobs, so it counts only in developer mode. See docs/design-notes.md, "Developer knobs".</remarks>
		[SettingsUISection(SETTINGS, TUNING)]
		[SettingsUIDeveloper]
		[SettingsUISearchHidden]
		public bool DevInterfaceStyles { get; set; } = Domain.Tuning.InterfaceStyles;

		/// <summary>
		/// Developer only: whether a box wider than the first Width step names each tab beside its
		/// picture where every tab fits that way, or keeps the picture over the count at every width.
		/// </summary>
		/// <remarks>Read through Utilities.Knobs, so it counts only in developer mode. See docs/design-notes.md, "Developer knobs".</remarks>
		[SettingsUISection(SETTINGS, TUNING)]
		[SettingsUIDeveloper]
		[SettingsUISearchHidden]
		public bool DevTabNames { get; set; } = Domain.Tuning.TabNames;

		/// <summary>Puts every option back to the value it ships with.</summary>
		/// <remarks>
		/// The initializers above read the same constants, except the control pane's: its
		/// initializer reads <see cref="Domain.SettingsDefaults.ControlPaneShownWhenMissing"/>, the
		/// value of a file without the key, and Apply sets the pane to its shipped value. See
		/// docs/design-notes.md, "Reset the build menu".
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

		private LocalizedString AssetMenuWidthStepDescription() => RowDescription(nameof(AssetMenuWidthStep));

		private LocalizedString ControlPaneShownDescription() => RowDescription(nameof(ControlPaneShown));

		private LocalizedString DefaultViewDescription() => RowDescription(nameof(DefaultView));

		private LocalizedString AtLargeTextDescription() => RowDescription(nameof(AtLargeText));

		/// <summary>The Width row's choices: the five steps, by their labels.</summary>
		/// <remarks>Static, so a test reads it without building the settings class.</remarks>
		private static DropdownItem<int>[] WidthStepItems() =>
			Domain.OptionRows.WidthStepLabelIds
				.Select((id, index) => new DropdownItem<int> { value = index + 1, displayName = LocalizedString.Id(id) })
				.ToArray();

		/// <summary>The Default view row's choices: Auto, then each body, by their labels.</summary>
		/// <remarks>Static, so a test reads it without building the settings class.</remarks>
		private static DropdownItem<string>[] DefaultViewItems() => StringItems(Domain.BodyViews.DefaultViews, Domain.OptionRows.DefaultViewLabelIds);

		/// <summary>The At large text row's two choices, by their labels.</summary>
		private static DropdownItem<string>[] AtLargeTextItems() => StringItems(Domain.LargeText.Values, Domain.OptionRows.AtLargeTextLabelIds);

		private static DropdownItem<string>[] StringItems(IReadOnlyList<string> values, IReadOnlyList<string> labelIds) =>
			values.Select((value, index) => new DropdownItem<string> { value = value, displayName = LocalizedString.Id(labelIds[index]) }).ToArray();

		private LocalizedString ResetBuildMenuDescription() => RowDescription(nameof(ResetBuildMenu));
	}
}
