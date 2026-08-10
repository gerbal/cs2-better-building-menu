using Colossal.IO.AssetDatabase;
using FindItBuildingMenu.Utilities;
using Game.Input;
using Game.Modding;
using Game.Settings;
using Game.UI;

namespace FindItBuildingMenu
{
    [FileLocation(nameof(FindItBuildingMenu))]
	[SettingsUITabOrder(SETTINGS, KEYBINDINGS)]
	[SettingsUIGroupOrder(BEHAVIOR, UIUX,DISPLAY, OTHER, ACTIONS, NAVIGATION)]
	[SettingsUIShowGroupName(BEHAVIOR, UIUX,DISPLAY, OTHER, ACTIONS, NAVIGATION)]
	[SettingsUIMouseAction(nameof(FindItBuildingMenu) + "Apply", "CustomUsage")]
	public class FindItSettings : ModSetting
	{
		public const string SETTINGS = "Settings";
		public const string KEYBINDINGS = "KeyBindings";
		public const string ACTIONS = "Actions";
		public const string NAVIGATION = "Navigation";
		public const string BEHAVIOR = "Behavior";
		public const string UIUX = "UIUX";
		public const string DISPLAY = "Display";
		public const string OTHER = "Other";

		public FindItSettings(IMod mod) : base(mod)
		{

		}

		[SettingsUIMouseBinding(nameof(FindItBuildingMenu) + "Apply"), SettingsUIHidden]
		public ProxyBinding ApplyMimic { get; set; }

		[SettingsUIHidden]
		public string DefaultViewStyle { get; set; } = "GridWithText";

		[SettingsUIHidden]
		public string DefaultAlignmentStyle { get; set; } = "Center";

		/// <summary>
		/// The catalog's height, in the same rem-like units as the width, set
		/// by dragging the panel's top edge.
		/// </summary>
		/// <remarks>
		/// Hidden like the width: it is a direct-manipulation value, and a
		/// slider for it in the options screen would be a second way to say the
		/// same thing. See <see cref="Domain.BuildingLensHeight"/> for the
		/// range and for what this replaced.
		/// </remarks>
		[SettingsUIHidden]
		public float BuildingLensPanelHeight { get; set; } = Domain.BuildingLensHeight.Default;

		[SettingsUIButton]
		[SettingsUIConfirmation]
		[SettingsUISection(SETTINGS, OTHER)]
		public bool ResetFavorites { set => FindItUtil.ResetFavorites(); }

		// Ctrl+F also collides with vanilla — "Toggle Follow Selected Citizen" —
		// but it is kept, deliberately. It is FindIt's signature shortcut, the
		// vanilla action needs a citizen selected before it does anything, and
		// the alternative (giving this binding a custom usage so the conflict
		// check stops matching it) would hide the collision rather than resolve
		// it: both actions would still fire on the same key. Moving the key is
		// the honest alternative if the notification is judged worse than the
		// overlap. See CS-Modding cm-q9x9.
		//
		// This machine does not show it: Settings.coc carries a local override
		// clearing the vanilla binding, and an unset binding cannot conflict. It
		// fires on any fresh profile.
		[SettingsUIKeyboardBinding(BindingKeyboard.F, nameof(SearchKeyBinding), ctrl: true)]
		[SettingsUISection(KEYBINDINGS, ACTIONS)]
		public ProxyBinding SearchKeyBinding { get; set; }

		[SettingsUIKeyboardBinding(BindingKeyboard.P, nameof(PickerKeyBinding), ctrl: true)]
		[SettingsUISection(KEYBINDINGS, ACTIONS)]
		public ProxyBinding PickerKeyBinding { get; set; }

		// Ctrl+N, not Ctrl+R: vanilla binds Ctrl+R to "Relocate Selected Object"
		// (Shortcuts map, same default usages as ours), which is a real collision
		// and the source of the "Key binding conflict detected" notification the
		// mod showed on every boot. N is bound nowhere in the game's InputActions
		// asset at all, so it stays clear even under the modifier-insensitive
		// comparison ProxyBinding.PathEquals falls back to.
		[SettingsUIKeyboardBinding(BindingKeyboard.N, nameof(RandomKeyBinding), ctrl: true)]
		[SettingsUISection(KEYBINDINGS, ACTIONS)]
		public ProxyBinding RandomKeyBinding { get; set; }

		[SettingsUIKeyboardBinding(BindingKeyboard.LeftArrow, nameof(LeftArrow))]
		[SettingsUISection(KEYBINDINGS, NAVIGATION)]
		public ProxyBinding LeftArrow { get; set; }

		[SettingsUIKeyboardBinding(BindingKeyboard.RightArrow, nameof(RightArrow))]
		[SettingsUISection(KEYBINDINGS, NAVIGATION)]
		public ProxyBinding RightArrow { get; set; }

		[SettingsUIKeyboardBinding(BindingKeyboard.UpArrow, nameof(UpArrow))]
		[SettingsUISection(KEYBINDINGS, NAVIGATION)]
		public ProxyBinding UpArrow { get; set; }

		[SettingsUIKeyboardBinding(BindingKeyboard.DownArrow, nameof(DownArrow))]
		[SettingsUISection(KEYBINDINGS, NAVIGATION)]
		public ProxyBinding DownArrow { get; set; }

		// Off by default: this takes over the game's primary build UI, which is
		// not something to opt a player into without asking.
		[SettingsUISection(SETTINGS, BEHAVIOR)]
		public bool ReplaceVanillaBuildMenu { get; set; }

		// The Zones menu opens a zoning hierarchy rather than a filtered
		// building table, so it is separable from the rest: a player may want
		// the service menus replaced but the familiar zone grid kept.
		[SettingsUISection(SETTINGS, BEHAVIOR)]
		[SettingsUIDisableByCondition(typeof(FindItSettings), nameof(IsVanillaMenuReplacementOff))]
		public bool ReplaceVanillaZonesMenu { get; set; } = true;

		// A search that finds nothing in the current section offers to widen by
		// default rather than widening on its own, so the section scope is not
		// silently discarded. Players who mostly search globally can flip it.
		[SettingsUISection(SETTINGS, BEHAVIOR)]
		public bool AutoWidenSearch { get; set; }

		// Grid by default: recognising a thumbnail is the fast path back to the
		// map, and the table is for the rarer moment of genuine comparison.
		// Answers "will it reach" in the coordinate system the player is looking
		// at, rather than as a number in a panel.
		[SettingsUISection(SETTINGS, UIUX)]
		public bool ShowCoverageOverlay { get; set; } = true;

		[SettingsUISection(SETTINGS, UIUX)]
		public bool BuildingLensDefaultToTable { get; set; }

		[SettingsUISection(SETTINGS, UIUX)]
		public bool BuildingLensShowShelf { get; set; } = true;

		// Bounded because a shelf whose shape cannot be learned is just another
		// list; twelve is about the limit of positions worth memorising.
		[SettingsUISection(SETTINGS, UIUX)]
		[SettingsUISlider(min = 4, max = 16, step = 2, scalarMultiplier = 1, unit = Unit.kInteger)]
		[SettingsUIDisableByCondition(typeof(FindItSettings), nameof(IsShelfHidden))]
		public int BuildingLensShelfSize { get; set; } = 12;

		/// <summary>
		/// Grid tile width. 88 was sized around a 12rem label; the tiles now
		/// carry the game's own 16rem one and a 45px thumbnail to match the
		/// vanilla asset grid, and at 88 a name like "Additional Burial Lot"
		/// had nowhere to go.
		/// </summary>
		/// <remarks>
		/// 100 rather than 72 because 100 is what the grid has actually been
		/// drawing: buildingGrid.module.scss overrode this value with an
		/// !important width, which left the tile 100rem wide while the label
		/// budget in tileLabel.ts still sized itself to 72. The override is
		/// gone and this is now the single number both follow.
		/// </remarks>
		[SettingsUISection(SETTINGS, UIUX)]
		// Step 4, not 8: 100 is the default and 64 + 8k never lands on it, so a
		// player who nudged the slider once could not get back to the shipped
		// width.
		[SettingsUISlider(min = 64, max = 144, step = 4, scalarMultiplier = 1, unit = Unit.kInteger)]
		public int BuildingLensTileSize { get; set; } = 100;

		public bool IsVanillaMenuReplacementOff() => !ReplaceVanillaBuildMenu;

		public bool IsShelfHidden() => !BuildingLensShowShelf;

		[SettingsUISection(SETTINGS, BEHAVIOR)]
		public bool OpenPanelOnPicker { get; set; } = true;

		[SettingsUISection(SETTINGS, BEHAVIOR)]
		public bool SelectPrefabOnOpen { get; set; } = true;

		[SettingsUISection(SETTINGS, BEHAVIOR)]
		public bool HideRandomAssets { get; set; }

		[SettingsUISection(SETTINGS, BEHAVIOR)]
		public bool HideBrandsFromAny { get; set; }

		[SettingsUISection(SETTINGS, UIUX)]
		public bool StrictSearch { get; set; }

		[SettingsUISection(SETTINGS, UIUX)]
		public bool NoAssetImage { get; set; }

		[SettingsUISection(SETTINGS, UIUX)]
		public bool SmoothScroll { get; set; }

		[SettingsUISlider(min = 0.2f, max = 2f, step = 0.1f, unit = Unit.kFloatSingleFraction)]
		[SettingsUISection(SETTINGS, UIUX)]
		public float ScrollSpeed { get; set; } = 0.6f;

		[SettingsUISlider(min = 0, max = 200, unit = Unit.kPercentage)]
		[SettingsUISection(SETTINGS, DISPLAY)]
		public float RowSize { get; set; } = 40f;

		[SettingsUISlider(min = 0, max = 200, unit = Unit.kPercentage)]
		[SettingsUISection(SETTINGS, DISPLAY)]
		public float ColumnSize { get; set; } = 40f;

		[SettingsUISlider(min = 0, max = 200, unit = Unit.kPercentage)]
		[SettingsUISection(SETTINGS, DISPLAY)]
		public float ExpandedRowSize { get; set; } = 80f;

		[SettingsUISlider(min = 0, max = 200, unit = Unit.kPercentage)]
		[SettingsUISection(SETTINGS, DISPLAY)]
		public float ExpandedColumnSize { get; set; } = 80f;

		[SettingsUISlider(min = 0, max = 200, unit = Unit.kPercentage)]
		[SettingsUISection(SETTINGS, DISPLAY)]
		public float RightRowSize { get; set; } = 80f;

		[SettingsUISlider(min = 0, max = 200, unit = Unit.kPercentage)]
		[SettingsUISection(SETTINGS, DISPLAY)]
		public float RightColumnSize { get; set; } = 30f;

		public override void SetDefaults()
		{
		}
	}
}
