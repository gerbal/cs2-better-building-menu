using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;
using BetterBuildingMenu.Utilities;
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

		private ToolSystem _toolSystem = null!;
		private PrefabSystem _prefabSystem = null!;
		private PrefabIndexingSystem _indexer = null!;
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
		// The grouping dimensions that can act on the current menu set; the picker lists these.
		private ValueBindingHelper<string[]> _AssetMenuGroupDimensions = null!;
		// Whether the menu the toolbar currently has open is one the asset menu takes
		// over. Lets the vanilla menu stay hidden after the asset menu is closed, so
		// closing means closed rather than revealing the grid underneath.
		private ValueBindingHelper<bool> _OwnsCurrentMenu = null!;
		private ValueBindingHelper<int> _ActivePrefabId = null!;
		private ValueBindingHelper<float> _AssetMenuWidth = null!;
		private ValueBindingHelper<float> _AssetMenuHeight = null!;
		private ValueBindingHelper<float> _AssetMenuCatalogWidth = null!;
		private ValueBindingHelper<bool> _ControlPaneShown = null!;
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
		// The strip's fallback axis for menus vanilla gives no categories: the tabs, which tab
		// is picked, and WHICH AXIS they are — published so the row can say so, because the axis
		// varies per menu and a tab row whose meaning changes silently is not learnable.
		private ValueBindingHelper<MenuBranchCount[]> _AssetMenuStripTabs = null!;
		private ValueBindingHelper<string[]> _AssetMenuStripTabBinding = null!;
		// Which category the strip draws as its development branches, and those
		// branches. Empty on the menus that expand nothing.
		private ValueBindingHelper<MenuCategoryTabs[]> _AssetMenuExpandedCategories = null!;
		// The tier segment's other axis. Education navigates by level, not by
		// the milestone the school unlocked at.
		private ValueBindingHelper<MenuBranchCount[]> _AssetMenuSchoolTierCounts = null!;
		private ValueBindingHelper<int> _AssetMenuSchoolTierBinding = null!;
		private ValueBindingHelper<string> _AssetMenuCategoryBinding = null!;
		/// <summary>
		/// The vanilla menu the asset menu is scoped to, or empty for the whole catalog.
		/// </summary>
		/// <remarks>
		/// Published so the chip row can name it: the scope is set by clicking a toolbar icon,
		/// and would otherwise be applied with nothing on screen saying so.
		/// </remarks>
		private ValueBindingHelper<string> _AssetMenuBinding = null!;
		/// <summary>Every vanilla menu, so one can be chosen as a filter.</summary>
		private ValueBindingHelper<VanillaMenuCategory[]> _AssetMenusBinding = null!;
		// Milestone index -> name, published once. Locked assets carry the index.
		private ValueBindingHelper<string[]> _AssetMenuMilestonesBinding = null!;

		protected override void OnCreate()
		{
			base.OnCreate();

			_toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
			_indexer = World.GetOrCreateSystemManaged<PrefabIndexingSystem>();
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
			Mod.Settings.onSettingsApplied += OnSettingsApplied;
			CreateTrigger("SearchEverything", SearchEverything);
			_AssetMenuWidth = CreateBinding("AssetMenuWidth", 0f);
			// Seeded from the setting rather than 0: the asset menu draws from this
			// on its first frame, and a zero height would flash a collapsed
			// catalog before the first drag published anything.
			_AssetMenuHeight = CreateBinding(
				"AssetMenuHeight",
				AssetMenuHeight.Clamp(Mod.Settings.AssetMenuHeight));
			// Seeded from the settings like the height, so the first frame draws the
			// player's width and pane rather than flashing the defaults.
			_AssetMenuCatalogWidth = CreateBinding(
				"AssetMenuCatalogWidth",
				AssetMenuCatalogWidth.Sanitize(Mod.Settings.AssetMenuCatalogWidth));
			_ControlPaneShown = CreateBinding("ControlPaneShown", Mod.Settings.ControlPaneShown);
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
			_AssetMenuStripTabs = CreateBinding("AssetMenuStripTabs", Array.Empty<MenuBranchCount>());
			_AssetMenuExpandedCategories = CreateBinding("AssetMenuExpandedCategories", Array.Empty<MenuCategoryTabs>());
			// A plain value binding plus its own trigger, rather than the
			// two-in-one form: the value is the LIST both controls share, while
			// the trigger takes the single tab the row clicked.
			_AssetMenuStripTabBinding = CreateBinding("AssetMenuStripTab", Array.Empty<string>());
			_AssetMenuSchoolTierCounts = CreateBinding("AssetMenuSchoolTierCounts", Array.Empty<MenuBranchCount>());
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
				CreateTrigger<string, string, string>("SetBuildingCatalogMetricRange", SetBuildingCatalogMetricRange);
				CreateTrigger("ClearBuildingCatalogMetricRanges", ClearBuildingCatalogMetricRanges);
				CreateTrigger<string, string>("ToggleAssetMenuFacet", ToggleAssetMenuFacet);
				CreateTrigger("ClearAssetMenuFilters", ClearAssetMenuFilters);
				CreateTrigger("ResetAssetMenu", ResetAssetMenu);
				CreateTrigger<string>("SetAssetMenuStripTab", SetAssetMenuStripTab);
				CreateTrigger("ClearAssetMenuScope", ClearAssetMenuScope);
				CreateTrigger<string>("SetAssetMenu", SetAssetMenu);
			CreateTrigger<float>("SetAssetMenuHeight", SetAssetMenuHeight);
			CreateTrigger("CommitAssetMenuHeight", CommitAssetMenuHeight);
			CreateTrigger<float>("SetAssetMenuCatalogWidth", SetAssetMenuCatalogWidth);
			CreateTrigger("CommitAssetMenuCatalogWidth", CommitAssetMenuCatalogWidth);
			CreateTrigger<bool>("SetControlPaneShown", SetControlPaneShown);
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

			base.OnDestroy();
		}

		/// <summary>
		/// Re-publishes the settings the UI reads, when the options screen
		/// applies a change.
		/// </summary>
		/// <remarks>
		/// The parameter is the base game's <see cref="Game.Settings.Setting"/> — the delegate's
		/// own type — not this mod's settings class. The asset menu's height needs no re-publishing; it
		/// travels the other way, from the drag handle into the setting.
		/// </remarks>
		private void OnSettingsApplied(Game.Settings.Setting setting)
		{
			_AssetMenuTileSize.Value = Mod.Settings.AssetMenuTileSize;
			_ReplaceVanillaBuildMenu.Value = Mod.Settings.ReplaceVanillaBuildMenu;
			// The sizes too, so an Options reset (SetDefaults) redraws the asset menu at
			// once rather than at the next drag. The height was missed here before.
			_AssetMenuHeight.Value = AssetMenuHeight.Clamp(Mod.Settings.AssetMenuHeight);
			_AssetMenuCatalogWidth.Value = AssetMenuCatalogWidth.Sanitize(Mod.Settings.AssetMenuCatalogWidth);
			_ControlPaneShown.Value = Mod.Settings.ControlPaneShown;

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
