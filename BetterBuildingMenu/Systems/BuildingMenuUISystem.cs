using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;
using BetterBuildingMenu.Utilities;
using Colossal.Serialization.Entities;
using Game;
using Game.Input;
using Game.Prefabs;
using Game.Rendering;
using Game.Tools;

using System;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		private bool settingPrefab;
		// Search is debounced on the main thread: SearchChanged schedules,
		// OnUpdate fires. See SearchDebounce for why there is no worker.
		private static readonly System.Diagnostics.Stopwatch SearchClock = System.Diagnostics.Stopwatch.StartNew();
		private readonly SearchDebounce _searchDebounce = new(TimeSpan.FromMilliseconds(250));
		// Handed Mod's silhouette cache rather than reading Mod itself; see its constructor.
		private readonly BuildingCatalogAdapter _buildingCatalogAdapter = new(thumbnail => Mod.Silhouettes?.UrlFor(thumbnail));
		// The game's toolbar filter row, as the UI last reported it. Not reset on a load:
		// the UI forwards the row only when it changes, so a reset would drop a filter the
		// toolbar still shows.
		private VanillaToolbarSelection _toolbarSelection = VanillaToolbarSelection.None;
		private readonly InteractionBoundary _interactionBoundary = new();
		// Everything the player has told the asset menu, as one record with one tested
		// transition per trigger. Each trigger handler applies a transition,
		// PublishScope() mirrors it to the bindings, RefreshBuildingCatalog runs it.
		private AssetMenuState _assetMenu = AssetMenuState.Initial;
		// Each menu's sort this session, which its next open brings back.
		private readonly SessionSorts _sessionSorts = new();
		// The open menu's grouping without a pick of its own, from the last refresh: a GROUP pick of it
		// takes the menu's own pick away.
		private string _menuDefaultGroup = string.Empty;

		private ToolSystem _toolSystem = null!;
		private PrefabSystem _prefabSystem = null!;
		private PrefabIndexingSystem _indexer = null!;
		private PlacementWatchSystem _placementWatch = null!;
		private DefaultToolSystem _defaultToolSystem = null!;
		// Only for releasing the toolbar's menu selection when the asset menu closes;
		// see CloseAssetMenu.
		private Game.UI.InGame.ToolbarUISystem _toolbarUISystem = null!;


		private ValueBindingHelper<bool> _IsSearchLoading = null!;
		/// <summary>
		/// Whether the asset menu is open.
		/// </summary>
		/// <remarks>
		/// Our own open state rather than a published binding: it makes SetAssetMenuOpen
		/// idempotent, tells a cold open from a menu-to-menu switch so the switch gets its extra
		/// refresh, and tells the close paths whether there is anything to close.
		/// </remarks>
		private bool _assetMenuOpen;
		// Whether the index moved since the catalog was last published. See OnUpdate.
		private readonly IndexWatch _indexWatch = new();
		private ValueBindingHelper<bool> _ReplaceVanillaBuildMenu = null!;
		private ValueBindingHelper<int> _BuildingCatalogMatchesElsewhere = null!;
		private ValueBindingHelper<int> _AssetMenuTileSize = null!;
		// Set when a toolbar preset is applied, so the game's echo of the armed
		// tool's menu can be told apart from a real click. See MenuEchoGuard.
		private int? _appliedMenuFrame;
		private int _appliedMenuIndex;
		private ValueBindingHelper<string> _BuildingCatalogGroupBy = null!;
		// Each menu's own GROUP, as the settings keep it, for the control's dot.
		private ValueBindingHelper<MenuPick[]> _AssetMenuGroups = null!;
		// The grouping dimensions that can act on the current menu set; the picker lists these.
		private ValueBindingHelper<string[]> _AssetMenuGroupDimensions = null!;
		// Whether the menu the toolbar currently has open is one the asset menu takes
		// over. Lets the vanilla menu stay hidden after the asset menu is closed, so
		// closing means closed rather than revealing the grid underneath.
		private ValueBindingHelper<bool> _OwnsCurrentMenu = null!;
		private ValueBindingHelper<int> _ActivePrefabId = null!;
		private ValueBindingHelper<float> _AssetMenuHeight = null!;
		private ValueBindingHelper<int> _AssetMenuWidthStep = null!;
		private ValueBindingHelper<bool> _ControlPaneShown = null!;
		private ValueBindingHelper<string> _AssetMenuViewMode = null!;
		// The developer knobs the UI reads, resolved: a stored value counts only in developer mode.
		private ValueBindingHelper<TuningValues> _AssetMenuTuning = null!;
		private ValueBindingHelper<string> _CurrentSearch = null!;
		private ValueBindingHelper<BuildingCatalogPage> _BuildingCatalogBinding = null!;
		/// <summary>
		/// The catalog entries behind the selected building's upgrades, for the replaced extension
		/// picker. Presentation only: vanilla's own upgradeMenu.upgrades decides what is listed.
		/// See BuildingExtensionMenu.
		/// </summary>
		private ValueBindingHelper<BuildingExtensionMenu> _BuildingExtensionMenu = null!;
		private Game.UI.InGame.SelectedInfoUISystem _selectedInfoUISystem = null!;
		// The selection HandSelectionToTheGame saw last frame, to tell a new one from a kept one.
		private Unity.Entities.Entity _lastSelectedEntity;
		/// <summary>The upgradable the extension menu was last built for, and the index it was built from.</summary>
		private Unity.Entities.Entity _extensionMenuFor;
		private int _extensionMenuGeneration;
		private ValueBindingHelper<BuildingCatalogMetricRangeState> _BuildingCatalogMetricRanges = null!;
		/// <summary>
		/// The spread each metric has in the current view, so the range fields can
		/// open at real numbers instead of blank.
		/// </summary>
		/// <remarks>
		/// Separate from the selection above and deliberately the same shape: one
		/// says what the player asked for, the other what is there to ask about.
		/// </remarks>
		private ValueBindingHelper<BuildingCatalogMetricRangeState> _BuildingCatalogMetricBounds = null!;
		private ValueBindingHelper<BuildingCatalogFacetState> _AssetMenuFacets = null!;
		private ValueBindingHelper<string> _BuildingCatalogSortColumn = null!;

		private ValueBindingHelper<bool> _BuildingCatalogSortDescending = null!;
		// Vanilla's second tier: the tab strip for whichever menu is scoped, and
		// which of its tabs is active. Empty list means "no strip", which is also
		// how vanilla renders a menu with fewer than two categories.
		private ValueBindingHelper<VanillaMenuCategory[]> _AssetMenuCategoriesBinding = null!;
		// Sidecar to the above. See MenuCategoryCount for why it is not a field
		// on the category record.
		private ValueBindingHelper<MenuCategoryCount[]> _AssetMenuCategoryCounts = null!;
		// The All cell's count: every row the filters and the search leave in the menu.
		private ValueBindingHelper<int> _AssetMenuAllCount = null!;
		// The strip's fallback axis for menus vanilla gives no categories: the tabs, which tab
		// is picked, and WHICH AXIS they are — published so the row can say so, because the axis
		// varies per menu and a tab row whose meaning changes silently is not learnable.
		private ValueBindingHelper<MenuBranchCount[]> _AssetMenuStripTabs = null!;
		private ValueBindingHelper<string[]> _AssetMenuStripTabBinding = null!;
		// Which category the strip draws as its development branches, and those
		// branches. Empty on the menus that expand nothing.
		private ValueBindingHelper<MenuCategoryTabs[]> _AssetMenuExpandedCategories = null!;
		// Education's levels, as chips beside the tab that holds its schools. Education
		// navigates by level, not by the milestone the school unlocked at.
		private ValueBindingHelper<TierBracket> _AssetMenuTierBracket = null!;
		// That tab, as the last refresh found it: a level's pick lights it too.
		private string _tierParent = string.Empty;
		private ValueBindingHelper<int> _AssetMenuSchoolTierBinding = null!;
		private ValueBindingHelper<string> _AssetMenuCategoryBinding = null!;
		/// <summary>
		/// The vanilla menu the asset menu is scoped to, or empty for the whole catalog.
		/// </summary>
		/// <remarks>
		/// Published so the top row and the tab row can name it: the scope is set by clicking a
		/// toolbar icon, and would otherwise be applied with nothing on screen saying so.
		/// </remarks>
		private ValueBindingHelper<string> _AssetMenuBinding = null!;
		/// <summary>Every vanilla menu, so the tab row can draw the open one's icon.</summary>
		private ValueBindingHelper<VanillaMenuCategory[]> _AssetMenusBinding = null!;
		// Milestone index -> name, published once. Locked assets carry the index.
		private ValueBindingHelper<string[]> _AssetMenuMilestonesBinding = null!;

		protected override void OnCreate()
		{
			base.OnCreate();

			_toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
			_indexer = World.GetOrCreateSystemManaged<PrefabIndexingSystem>();
			_placementWatch = World.GetOrCreateSystemManaged<PlacementWatchSystem>();
			_defaultToolSystem = World.GetOrCreateSystemManaged<DefaultToolSystem>();
			_toolbarUISystem = World.GetOrCreateSystemManaged<Game.UI.InGame.ToolbarUISystem>();
			_selectedInfoUISystem = World.GetOrCreateSystemManaged<Game.UI.InGame.SelectedInfoUISystem>();

			_toolSystem.EventPrefabChanged += OnPrefabChanged;
			_toolSystem.EventToolChanged += OnToolChanged;




			// These establish the bindings with UI code.
			_IsSearchLoading = CreateBinding("IsSearchLoading", false);
			_ActivePrefabId = CreateBinding("ActivePrefabId", 0);
			// Seeded here and re-pushed by OnSettingsApplied: the UI's menu watcher and
			// the upgrades panel read it, and C# reads the setting live.
			_ReplaceVanillaBuildMenu = CreateBinding("ReplaceVanillaBuildMenu", Mod.Settings.ReplaceVanillaBuildMenu);
			_OwnsCurrentMenu = CreateBinding("OwnsCurrentMenu", false);
			_BuildingCatalogMatchesElsewhere = CreateBinding("BuildingCatalogMatchesElsewhere", 0);
			_BuildingExtensionMenu = CreateBinding("BuildingExtensionMenu", BuildingExtensionMenu.Empty);
			// Seeded here and re-pushed by OnSettingsApplied, so the options screen's Tile
			// size slider takes effect without a reload.
			_AssetMenuTileSize = CreateBinding("AssetMenuTileSize", Mod.Settings.AssetMenuTileSize);
			CreateTrigger("SearchEverything", SearchEverything);
			// Seeded from the setting rather than 0: the asset menu draws from this
			// on its first frame, and a zero height would flash a collapsed
			// catalog before the first drag published anything.
			_AssetMenuHeight = CreateBinding(
				"AssetMenuHeight",
				AssetMenuHeight.Clamp(Mod.Settings.AssetMenuHeight));
			// Read/write, and seeded from the settings like the height, so the first frame
			// draws the player's step and pane rather than flashing the defaults.
			_AssetMenuWidthStep = CreateBinding(
				"AssetMenuWidthStep",
				"SetAssetMenuWidthStep",
				WidthSteps.Sanitize(Mod.Settings.AssetMenuWidthStep),
				SetAssetMenuWidthStep);
			_ControlPaneShown = CreateBinding("ControlPaneShown", Mod.Settings.ControlPaneShown);
			// Read/write like the sort, so the UI can draw the stored view until the player
			// picks one, and seeded here like the pane.
			_AssetMenuViewMode = CreateBinding(
				"AssetMenuViewMode",
				"SetAssetMenuViewMode",
				AssetMenuViewMode.Sanitize(Mod.Settings.AssetMenuViewMode),
				SetAssetMenuViewMode);
			_AssetMenuTuning = CreateBinding("AssetMenuTuning", CurrentTuning());
			// Only now, with every binding OnSettingsApplied re-pushes created.
			Mod.Settings.onSettingsApplied += OnSettingsApplied;
			_CurrentSearch = CreateBinding("CurrentSearch", string.Empty);
			_BuildingCatalogBinding = CreateBinding("BuildingCatalog", new BuildingCatalogPage(
				Array.Empty<BuildingCatalogEntry>(),
				0,
				0,
				100,
				AssetMenuState.Indexing));
			_BuildingCatalogMetricRanges = CreateBinding("BuildingCatalogMetricRanges", BuildingCatalogMetricRangeState.Empty);
			_BuildingCatalogMetricBounds = CreateBinding("BuildingCatalogMetricBounds", BuildingCatalogMetricRangeState.Empty);
			_AssetMenuFacets = CreateBinding("AssetMenuFacets", new BuildingCatalogFacetState(Array.Empty<BuildingCatalogFacetGroup>(), false));
			// Sort is a read/write binding rather than a write-only trigger: the order lives in
			// the persistent query, so a UI that could only write it would show a stale indicator
			// over correctly-sorted rows after any remount.
			_BuildingCatalogSortColumn = CreateBinding(
				"BuildingCatalogSortColumn",
				"SetBuildingCatalogSortColumn",
				_assetMenu.Query.EffectiveSortColumn,
				SetBuildingCatalogSortColumn);
			// Group-by rides with sort for the same reason: it is part of the
			// persistent query, so a write-only trigger would leave the picker
			// showing "Nothing" over grouped rows after any remount.
			_AssetMenuGroupDimensions = CreateBinding("AssetMenuGroupDimensions", Array.Empty<string>());
			_AssetMenuGroups = CreateBinding("AssetMenuGroups", MenuPicks.Parse(Mod.Settings.MenuGroups).ToArray());
			_BuildingCatalogGroupBy = CreateBinding(
				"BuildingCatalogGroupBy",
				"SetBuildingCatalogGroupBy",
				_assetMenu.Query.GroupBy,
				SetBuildingCatalogGroupBy);
			_BuildingCatalogSortDescending = CreateBinding(
				"BuildingCatalogSortDescending",
				"SetBuildingCatalogSortDescending",
				_assetMenu.Query.Descending,
				SetBuildingCatalogSortDescending);
			_AssetMenuCategoriesBinding = CreateBinding("AssetMenuCategories", Array.Empty<VanillaMenuCategory>());
			_AssetMenuCategoryCounts = CreateBinding("AssetMenuCategoryCounts", Array.Empty<MenuCategoryCount>());
			_AssetMenuAllCount = CreateBinding("AssetMenuAllCount", -1);
			_AssetMenuStripTabs = CreateBinding("AssetMenuStripTabs", Array.Empty<MenuBranchCount>());
			_AssetMenuExpandedCategories = CreateBinding("AssetMenuExpandedCategories", Array.Empty<MenuCategoryTabs>());
			// A plain value binding plus its own trigger, rather than the
			// two-in-one form: the value is the LIST both controls share, while
			// the trigger takes the single tab the row clicked.
			_AssetMenuStripTabBinding = CreateBinding("AssetMenuStripTab", Array.Empty<string>());
			_AssetMenuTierBracket = CreateBinding("AssetMenuTierBracket", TierBracket.Empty);
			_AssetMenuSchoolTierBinding = CreateBinding(
				"AssetMenuSchoolTier",
				"SetAssetMenuSchoolTier",
				-1,
				SetAssetMenuSchoolTier);
			_AssetMenuBinding = CreateBinding("AssetMenu", string.Empty);
			_AssetMenusBinding = CreateBinding("AssetMenus", Array.Empty<VanillaMenuCategory>());
			_AssetMenuMilestonesBinding = CreateBinding("AssetMenuMilestones", Array.Empty<string>());
			_AssetMenuCategoryBinding = CreateBinding(
				"AssetMenuCategory",
				"SetAssetMenuCategory",
				string.Empty,
				SetAssetMenuCategory);

			// These establish UI actions triggering methods on the C# side.
			CreateTrigger<string>("SearchChanged", t => SearchChanged(t));
			CreateTrigger<int>("SetCurrentPrefab", TryActivatePrefabTool);
			// The UI watches the game's own toolbar.selectedAssetMenu binding and
			// hands the entity index here; resolving the prefab name and the
			// preset belongs on this side.
			CreateTrigger<int>("VanillaMenuSelected", VanillaMenuSelected);
			// Its other half: the same binding going to Entity.Null, which is how
			// a toolbar menu reports being closed.
			CreateTrigger("VanillaMenuDeselected", VanillaMenuDeselected);
			// The game's own filter row, forwarded from the UI: the equivalent fields on
			// ToolbarUISystem are private, so its bindings are the reachable route. Entity indices
			// arrive comma-joined, because this bridge is happier with flat primitives.
			CreateTrigger<string, string, bool, bool>("SetVanillaToolbarSelection", SetVanillaToolbarSelection);
			CreateTrigger<int>("LoadMoreBuildingCatalog", LoadMoreBuildingCatalog);
			// Up and Down in the search field move Enter's target; the page says where it stops.
			CreateTrigger<int>("MoveEnterTarget", MoveEnterTarget);
				CreateTrigger<string, string, string>("SetBuildingCatalogMetricRange", SetBuildingCatalogMetricRange);
				CreateTrigger("ClearBuildingCatalogMetricRanges", ClearBuildingCatalogMetricRanges);
				CreateTrigger<string, string>("ToggleAssetMenuFacet", ToggleAssetMenuFacet);
				CreateTrigger("ClearAssetMenuFilters", ClearAssetMenuFilters);
				CreateTrigger<string>("SetAssetMenuStripTab", SetAssetMenuStripTab);
			CreateTrigger<float>("SetAssetMenuHeight", SetAssetMenuHeight);
			CreateTrigger("CommitAssetMenuHeight", CommitAssetMenuHeight);
			// VIEW's More options.
			CreateTrigger("OpenModOptions", OpenModOptions);
			// Which of our strings the player's language lacks, for the game's words in their place.
			CreateLocaleBindings();

			// A gamepad cannot reach BBM's menu: the game's own stands in while one is used.
			// Last, so the handler never runs before the bindings it reads exist.
			if (InputManager.instance is { } input)
			{
				input.EventControlSchemeChanged += OnControlSchemeChanged;
			}
		}

		protected override void OnDestroy()
		{
			// Null once Mod.OnDispose has run, which at quit can come first.
			if (Mod.Settings != null)
			{
				Mod.Settings.onSettingsApplied -= OnSettingsApplied;
			}

			// Null if OnCreate threw before setting it.
			if (_toolSystem is not null)
			{
				_toolSystem.EventPrefabChanged -= OnPrefabChanged;
				_toolSystem.EventToolChanged -= OnToolChanged;
			}

			if (InputManager.instance is { } input)
			{
				input.EventControlSchemeChanged -= OnControlSchemeChanged;
			}

			DestroyLocaleBindings();

			base.OnDestroy();
		}

		protected override void OnGamePreload(Purpose purpose, GameMode mode)
		{
			base.OnGamePreload(purpose, mode);

			// A load or a return to the main menu clears the toolbar while the UI is gone, so no
			// deselect arrives to forget a menu given up under the gamepad.
			_gamepadMenu.Forget();
		}

		/// <summary>
		/// Re-publishes the settings the UI reads, when the options screen
		/// applies a change.
		/// </summary>
		/// <remarks>
		/// The parameter is the base game's <see cref="Game.Settings.Setting"/> — the delegate's
		/// own type — not this mod's settings class. The asset menu's sizes travel both ways: from
		/// the drag handles into the settings, and back from here when anything else changes and
		/// applies the settings.
		/// </remarks>
		private void OnSettingsApplied(Game.Settings.Setting setting)
		{
			_AssetMenuTileSize.Value = Mod.Settings.AssetMenuTileSize;
			_ReplaceVanillaBuildMenu.Value = Mod.Settings.ReplaceVanillaBuildMenu;
			// The sizes too, so settings applied from anywhere but a drag (the Options
			// screen, a tool, SetDefaults) redraw the asset menu at once.
			_AssetMenuHeight.Value = AssetMenuHeight.Clamp(Mod.Settings.AssetMenuHeight);
			_AssetMenuWidthStep.Value = WidthSteps.Sanitize(Mod.Settings.AssetMenuWidthStep);
			_ControlPaneShown.Value = Mod.Settings.ControlPaneShown;
			_AssetMenuViewMode.Value = AssetMenuViewMode.Sanitize(Mod.Settings.AssetMenuViewMode);
			_AssetMenuTuning.Value = CurrentTuning();
			_AssetMenuGroups.Value = MenuPicks.Parse(Mod.Settings.MenuGroups).ToArray();

			// Whoever has the menu: with the setting off the watcher sends no deselect, so a menu
			// given up under the gamepad could outlive its close and reopen once switched back on.
			_gamepadMenu.SettingsApplied(Mod.Settings.ReplaceVanillaBuildMenu);

			// Switched off with the asset menu up: the menu goes back to its vanilla grid now
			// rather than at the next click.
			if (!Mod.Settings.ReplaceVanillaBuildMenu && _OwnsCurrentMenu.Value)
			{
				// With the setting off the watcher sends no deselect, so forget the menu here,
				// as VanillaMenuDeselected does. A kept scope filters the next open to it, and
				// a kept index makes switching back on over the same menu read as an echo.
				_appliedMenuIndex = 0;
				_appliedMenuFrame = null;
				ReleaseMenuScope();
				YieldMenuToVanilla();
			}
		}

		/// <summary>The knobs the UI reads, through the one rule every knob is read by.</summary>
		private static TuningValues CurrentTuning() =>
			new(
				Knobs.DeveloperMode,
				Knobs.Value(settings => settings.DevInterfaceStyles, Tuning.InterfaceStyles),
				Knobs.Value(settings => settings.DevTabNames, Tuning.TabNames));

		protected override void OnUpdate()
		{
			// The indexer bumps its Generation and leaves the rest to us: a pass, an
			// unlock, a unique built or bulldozed. Scheduled like a search, so a burst of
			// them is one refresh, and nothing is rebuilt for a closed asset menu.
			if (_indexWatch.ShouldRefresh(_assetMenuOpen, _indexer.Generation))
			{
				TriggerSearch();
			}

			if (_searchDebounce.TryFire(SearchClock.Elapsed))
			{
				_IsSearchLoading.Value = false;
				RefreshBuildingCatalog();
			}

			RefreshExtensionMenu();
			HandSelectionToTheGame();

			base.OnUpdate();
		}
	}
}
