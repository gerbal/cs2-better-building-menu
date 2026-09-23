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
		private readonly BuildingCatalogAdapter _buildingCatalogAdapter = new();
		private readonly InteractionBoundary _interactionBoundary = new();
		// Everything the player has told the lens, as one record with one tested
		// transition per trigger. The handlers in Bindings.cs apply a transition,
		// PublishScope() mirrors it to the bindings, RefreshBuildingCatalog runs it.
		private BuildingCatalogLensState _lens = BuildingCatalogLensState.Initial;

		private ToolSystem _toolSystem = null!;
		private PrefabSystem _prefabSystem = null!;
		private DefaultToolSystem _defaultToolSystem = null!;
		// Only for releasing the toolbar's menu selection when the lens closes;
		// see CloseLens.
		private Game.UI.InGame.ToolbarUISystem _toolbarUISystem = null!;


		private ValueBindingHelper<bool> _IsSearchLoading = null!;
		/// <summary>
		/// Whether the lens menu is open.
		/// </summary>
		/// <remarks>
		/// Our own open state rather than a published binding: it makes SetLensMenuOpen
		/// idempotent, tells a cold open from a menu-to-menu switch so the switch gets its extra
		/// refresh, and tells the close paths whether there is anything to close.
		/// </remarks>
		private bool _lensMenuOpen;
		// Whether the index moved since the catalog was last published. See OnUpdate.
		private readonly IndexWatch _indexWatch = new();
		private ValueBindingHelper<bool> _ReplaceVanillaBuildMenu = null!;
		private ValueBindingHelper<int> _BuildingCatalogMatchesElsewhere = null!;
		private ValueBindingHelper<int> _LensTileSize = null!;
		// Set when a toolbar preset is applied, so the game's echo of the armed
		// tool's menu can be told apart from a real click. See MenuEchoGuard.
		private int? _appliedMenuFrame;
		private int _appliedMenuIndex;
		private ValueBindingHelper<string> _BuildingCatalogGroupBy = null!;
		// The grouping dimensions that can act on the current menu set; the picker lists these.
		private ValueBindingHelper<string[]> _BuildingLensGroupDimensions = null!;
		// Whether the menu the toolbar currently has open is one the lens takes
		// over. Lets the vanilla menu stay hidden after the panel is closed, so
		// closing means closed rather than revealing the grid underneath.
		private ValueBindingHelper<bool> _LensOwnsCurrentMenu = null!;
		private ValueBindingHelper<int> _ActivePrefabId = null!;
		private ValueBindingHelper<float> _PanelWidth = null!;
		private ValueBindingHelper<float> _BuildingLensPanelHeight = null!;
		private ValueBindingHelper<string> _CurrentSearch = null!;
		private ValueBindingHelper<BuildingCatalogPage> _BuildingCatalogBinding = null!;
		/// <summary>
		/// The catalog entries behind the selected building's upgrades, for the replaced extension
		/// picker. Presentation only: vanilla's own upgradeMenu.upgrades decides what is listed.
		/// See BuildingExtensionMenu.
		/// </summary>
		private ValueBindingHelper<BuildingExtensionMenu> _BuildingExtensionMenu = null!;
		private Game.UI.InGame.SelectedInfoUISystem _selectedInfoUISystem = null!;
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
		private ValueBindingHelper<BuildingCatalogFacetState> _BuildingLensFacets = null!;
		private ValueBindingHelper<string> _BuildingCatalogSortColumn = null!;

		private ValueBindingHelper<bool> _BuildingCatalogSortDescending = null!;
		// Vanilla's second tier: the tab strip for whichever menu is scoped, and
		// which of its tabs is active. Empty list means "no strip", which is also
		// how vanilla renders a menu with fewer than two categories.
		private ValueBindingHelper<VanillaMenuCategory[]> _BuildingLensMenuCategoriesBinding = null!;
		// Sidecar to the above. See MenuCategoryCount for why it is not a field
		// on the category record.
		private ValueBindingHelper<MenuCategoryCount[]> _BuildingLensMenuCategoryCounts = null!;
		// The strip's fallback axis for menus vanilla gives no categories: the tabs, which tab
		// is picked, and WHICH AXIS they are — published so the row can say so, because the axis
		// varies per menu and a tab row whose meaning changes silently is not learnable.
		private ValueBindingHelper<MenuBranchCount[]> _BuildingLensStripTabs = null!;
		private ValueBindingHelper<string[]> _BuildingLensStripTabBinding = null!;
		// Which category the strip draws as its development branches, and those
		// branches. Empty on the menus that expand nothing.
		private ValueBindingHelper<MenuCategoryTabs[]> _BuildingLensExpandedCategories = null!;
		// The tier segment's other axis. Education navigates by level, not by
		// the milestone the school unlocked at.
		private ValueBindingHelper<MenuBranchCount[]> _BuildingLensMenuSchoolTierCounts = null!;
		private ValueBindingHelper<int> _BuildingLensMenuSchoolTierBinding = null!;
		private ValueBindingHelper<string> _BuildingLensMenuCategoryBinding = null!;
		/// <summary>
		/// The vanilla menu the lens is scoped to, or empty for the whole catalog.
		/// </summary>
		/// <remarks>
		/// Published so the chip row can name it: the scope is set by clicking a toolbar icon,
		/// and would otherwise be applied with nothing on screen saying so.
		/// </remarks>
		private ValueBindingHelper<string> _BuildingLensMenuBinding = null!;
		/// <summary>Every vanilla menu, so one can be chosen as a filter.</summary>
		private ValueBindingHelper<VanillaMenuCategory[]> _BuildingLensMenusBinding = null!;
		// Milestone index -> name, published once. Locked assets carry the index.
		private ValueBindingHelper<string[]> _BuildingLensMilestonesBinding = null!;

		protected override void OnCreate()
		{
			base.OnCreate();

			_toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
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
			_LensOwnsCurrentMenu = CreateBinding("LensOwnsCurrentMenu", false);
			_BuildingCatalogMatchesElsewhere = CreateBinding("BuildingCatalogMatchesElsewhere", 0);
			_BuildingExtensionMenu = CreateBinding("BuildingExtensionMenu", BuildingExtensionMenu.Empty);
			// Seeded here and re-pushed by OnSettingsApplied, so the options screen's Tile
			// size slider takes effect without a reload.
			_LensTileSize = CreateBinding("BuildingLensTileSize", Mod.Settings.BuildingLensTileSize);
			Mod.Settings.onSettingsApplied += OnSettingsApplied;
			CreateTrigger("SearchEverything", SearchEverything);
			_PanelWidth = CreateBinding("PanelWidth", 0f);
			// Seeded from the setting rather than 0: the panel draws from this
			// on its first frame, and a zero height would flash a collapsed
			// catalog before the first drag published anything.
			_BuildingLensPanelHeight = CreateBinding(
				"BuildingLensPanelHeight",
				BuildingLensHeight.Clamp(Mod.Settings.BuildingLensPanelHeight));
			_CurrentSearch = CreateBinding("CurrentSearch", string.Empty);
			_BuildingCatalogBinding = CreateBinding("BuildingCatalog", new BuildingCatalogPage(
				Array.Empty<BuildingCatalogEntry>(),
				0,
				0,
				100,
				BuildingCatalogLensState.Indexing));
			_BuildingCatalogMetricRanges = CreateBinding("BuildingCatalogMetricRanges", BuildingCatalogMetricRangeState.Empty);
			_BuildingCatalogMetricBounds = CreateBinding("BuildingCatalogMetricBounds", BuildingCatalogMetricRangeState.Empty);
			_BuildingLensFacets = CreateBinding("BuildingLensFacets", new BuildingCatalogFacetState(Array.Empty<BuildingCatalogFacetGroup>(), false));
			// Sort is a read/write binding rather than a write-only trigger: the order lives in
			// the persistent query, so a UI that could only write it would show a stale indicator
			// over correctly-sorted rows after any remount.
			_BuildingCatalogSortColumn = CreateBinding(
				"BuildingCatalogSortColumn",
				"SetBuildingCatalogSortColumn",
				_lens.Query.EffectiveSortColumn,
				SetBuildingCatalogSortColumn);
			// Group-by rides with sort for the same reason: it is part of the
			// persistent query, so a write-only trigger would leave the picker
			// showing "Nothing" over grouped rows after any remount.
			_BuildingLensGroupDimensions = CreateBinding("BuildingLensGroupDimensions", Array.Empty<string>());
			_BuildingCatalogGroupBy = CreateBinding(
				"BuildingCatalogGroupBy",
				"SetBuildingCatalogGroupBy",
				_lens.Query.GroupBy,
				SetBuildingCatalogGroupBy);
			_BuildingCatalogSortDescending = CreateBinding(
				"BuildingCatalogSortDescending",
				"SetBuildingCatalogSortDescending",
				_lens.Query.Descending,
				SetBuildingCatalogSortDescending);
			_BuildingLensMenuCategoriesBinding = CreateBinding("BuildingLensMenuCategories", Array.Empty<VanillaMenuCategory>());
			_BuildingLensMenuCategoryCounts = CreateBinding("BuildingLensMenuCategoryCounts", Array.Empty<MenuCategoryCount>());
			_BuildingLensStripTabs = CreateBinding("BuildingLensStripTabs", Array.Empty<MenuBranchCount>());
			_BuildingLensExpandedCategories = CreateBinding("BuildingLensExpandedCategories", Array.Empty<MenuCategoryTabs>());
			// A plain value binding plus its own trigger, rather than the
			// two-in-one form: the value is the LIST both controls share, while
			// the trigger takes the single tab the row clicked.
			_BuildingLensStripTabBinding = CreateBinding("BuildingLensStripTab", Array.Empty<string>());
			_BuildingLensMenuSchoolTierCounts = CreateBinding("BuildingLensMenuSchoolTierCounts", Array.Empty<MenuBranchCount>());
			_BuildingLensMenuSchoolTierBinding = CreateBinding(
				"BuildingLensMenuSchoolTier",
				"SetBuildingLensMenuSchoolTier",
				-1,
				SetBuildingLensMenuSchoolTier);
			_BuildingLensMenuBinding = CreateBinding("BuildingLensMenu", string.Empty);
			_BuildingLensMenusBinding = CreateBinding("BuildingLensMenus", Array.Empty<VanillaMenuCategory>());
			_BuildingLensMilestonesBinding = CreateBinding("BuildingLensMilestones", Array.Empty<string>());
			_BuildingLensMenuCategoryBinding = CreateBinding(
				"BuildingLensMenuCategory",
				"SetBuildingLensMenuCategory",
				string.Empty,
				SetBuildingLensMenuCategory);

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
				CreateTrigger<string, string>("ToggleBuildingLensFacet", ToggleBuildingLensFacet);
				CreateTrigger("ClearBuildingLensFilters", ClearBuildingLensFilters);
				CreateTrigger("ResetBuildingLensMenu", ResetBuildingLensMenu);
				CreateTrigger<string>("SetBuildingLensStripTab", SetBuildingLensStripTab);
				CreateTrigger("ClearBuildingLensMenuScope", ClearBuildingLensMenuScope);
				CreateTrigger<string>("SetBuildingLensMenu", SetBuildingLensMenu);
			CreateTrigger<float>("SetBuildingLensPanelHeight", SetBuildingLensPanelHeight);
			CreateTrigger("CommitBuildingLensPanelHeight", CommitBuildingLensPanelHeight);
		}

		protected override void OnDestroy()
		{
			if (Mod.Settings != null)
			{
				Mod.Settings.onSettingsApplied -= OnSettingsApplied;
			}

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
		/// own type — not this mod's settings class. The panel height needs no re-publishing; it
		/// travels the other way, from the drag handle into the setting.
		/// </remarks>
		private void OnSettingsApplied(Game.Settings.Setting setting)
		{
			_LensTileSize.Value = Mod.Settings.BuildingLensTileSize;
			_ReplaceVanillaBuildMenu.Value = Mod.Settings.ReplaceVanillaBuildMenu;

			// Switched off with the panel up: the menu goes back to its vanilla grid now
			// rather than at the next click.
			if (!Mod.Settings.ReplaceVanillaBuildMenu && _LensOwnsCurrentMenu.Value)
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
			// The indexer bumps IndexGeneration and leaves the rest to us: a pass, an
			// unlock, a unique built or bulldozed. Scheduled like a search, so a burst of
			// them is one refresh, and nothing is rebuilt for a closed panel.
			if (_indexWatch.ShouldRefresh(_lensMenuOpen, PrefabIndexingSystem.IndexGeneration))
			{
				TriggerSearch();
			}

			if (_searchDebounce.TryFire(SearchClock.Elapsed))
			{
				_IsSearchLoading.Value = false;
				RefreshBuildingCatalog();
			}

			RefreshExtensionMenu();

			base.OnUpdate();
		}
	}
}
