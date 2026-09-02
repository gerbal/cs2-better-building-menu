using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.UIBinding;
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
		// SPIKE (cm-e98i): the vanilla menu the lens was opened from, by name.
		// Empty means "not opened from a vanilla menu", which leaves the query
		// unconstrained by the tree.
		// The axis the fallback strip is drawn on. The SELECTION itself lives on
		// the query as StripTabs, because the filter rail offers the same state
		// and one field shown twice cannot disagree with itself.
		private string _buildingLensStripAxis = string.Empty;
		// The education menu's tier tab, or -1. Cleared with the rest of the
		// scope; a level means nothing outside the menu that teaches.

		private ToolSystem _toolSystem;
		private PrefabSystem _prefabSystem;
		private DefaultToolSystem _defaultToolSystem;
		private CameraUpdateSystem _cameraUpdateSystem;
		// Only for releasing the toolbar's menu selection when the lens closes;
		// see CloseLens.
		private Game.UI.InGame.ToolbarUISystem _toolbarUISystem;


		private ValueBindingHelper<bool> _IsSearchLoading;
		private ValueBindingHelper<bool> _ClearSearchBar;
		/// <summary>
		/// Whether the lens menu is open.
		/// </summary>
		/// <remarks>
		/// Was a published binding called ShowFindItPanel, from when it meant
		/// "draw FindIt's floating panel". There is no such panel: the menu is
		/// mounted by the game in its own asset-menu slot, so nothing in the UI
		/// needs to be told whether it exists. Its last reader was
		/// WrapToolOptionsPanel, deleted with the alignment setting it depended
		/// on.
		///
		/// What the flag actually does, and still does, is hold OUR open state:
		/// it makes SetLensMenuOpen idempotent, it distinguishes a cold open
		/// from a menu-to-menu switch so the switch gets its extra refresh, and
		/// it tells the close paths whether there is anything to close.
		/// </remarks>
		private bool _lensMenuOpen;
		private ValueBindingHelper<bool> _ReplaceVanillaBuildMenu = null!;
		private ValueBindingHelper<int> _BuildingCatalogMatchesElsewhere = null!;
		private ValueBindingHelper<bool> _LensDefaultToTable = null!;
		private ValueBindingHelper<bool> _LensShowShelf = null!;
		private ValueBindingHelper<int> _LensShelfSize = null!;
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
		private ValueBindingHelper<bool> _FindItPresent = null!;
		private bool _findItPresenceChecked;
		/// <summary>
		/// A menu the picker wants opened, as "index:version:nonce".
		/// </summary>
		/// <remarks>
		/// The game's toolbar.selectAssetMenu is a TRIGGER binding, so only the
		/// UI can call it — C# has no route, ToolbarUISystem.SelectAssetMenu
		/// being private. So the request goes out as a value the UI watches and
		/// forwards. The nonce is what makes picking the same building twice
		/// register as two requests rather than one unchanged string.
		/// </remarks>
		private ValueBindingHelper<string> _PickerMenuRequest = null!;
		private int _pickerMenuNonce;
		private ValueBindingHelper<int> _ActivePrefabId;
		private ValueBindingHelper<float> _PanelWidth;
		private ValueBindingHelper<float> _BuildingLensPanelHeight;
		private ValueBindingHelper<string> _CurrentSearch;
		private ValueBindingHelper<BuildingCatalogPage> _BuildingCatalogBinding = null!;
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
		// The strip's fallback axis for menus vanilla gives no categories: the
		// tabs, which tab is picked, and WHICH AXIS they are — published so the
		// row can say so, because the axis varies per menu and a tab row whose
		// meaning changes silently is not learnable.
		private ValueBindingHelper<MenuBranchCount[]> _BuildingLensStripTabs = null!;
		private ValueBindingHelper<string[]> _BuildingLensStripTabBinding = null!;
		private ValueBindingHelper<string> _BuildingLensStripAxisBinding = null!;
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
		/// Published so the chip row can say so. The scope was set by clicking a
		/// toolbar icon and then applied invisibly: nothing on screen named it,
		/// and the Section and Type chips that WERE on screen are the ones the
		/// scope switches off (BuildingCatalogQueryEngine.cs:95).
		/// </remarks>
		private ValueBindingHelper<string> _BuildingLensMenuBinding = null!;
		/// <summary>Every vanilla menu, so one can be chosen as a filter.</summary>
		private ValueBindingHelper<VanillaMenuCategory[]> _BuildingLensMenusBinding = null!;
		// Milestone index -> name, published once. Locked assets carry the index.
		private ValueBindingHelper<string[]> _BuildingLensMilestonesBinding = null!;

		/// <summary>
		/// The live building-lens facet group for one dimension (e.g.
		/// "availability", "provenance", "placement"), or null when the
		/// current catalog offers no options for it. Lets the options bank's
		/// short-facet sections read the same state the filter rail does,
		/// rather than keeping a second copy.
		/// </summary>
		public BuildingCatalogFacetGroup? GetBuildingLensFacetGroup(string facetId) =>
			System.Array.Find(_BuildingLensFacets.Value.Groups, group => group.Id == facetId);
		/// <summary>Upstream Find It's assembly is loaded in this game.</summary>
		internal static bool IsFindItLoaded()
		{
			foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
			{
				if (string.Equals(assembly.GetName().Name, "FindIt", StringComparison.Ordinal))
				{
					return true;
				}
			}

			return false;
		}

		protected override void OnCreate()
		{
			base.OnCreate();

			// Instantiating systems 
			_toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
			_defaultToolSystem = World.GetOrCreateSystemManaged<DefaultToolSystem>();
			_cameraUpdateSystem = World.GetOrCreateSystemManaged<CameraUpdateSystem>();
			_toolbarUISystem = World.GetOrCreateSystemManaged<Game.UI.InGame.ToolbarUISystem>();

			// ToolSystem toolSystem = World.DefaultGameObjectInjectionWorld?.GetOrCreateSystemManaged<ToolSystem>(); // I don't know why vanilla game did this.
			_toolSystem.EventPrefabChanged += OnPrefabChanged;
			_toolSystem.EventToolChanged += OnToolChanged;

			// Keybinding caching



			// These establish the bindings with UI code.
			// Nothing raises this any more: its only writer was the Ctrl+F handler,
			// removed with the hot-key. Kept because TopBar still reads it, and
			// TopBar is FindIt shell that phase 2 (cm-wf6g.2) retires wholesale —
			// unpicking it here would be a change to a surface that is on its way
			// out. It is permanently false, which is the correct behaviour for a
			// menu with no hot-key to focus its search from.
			_ClearSearchBar = CreateBinding("ClearSearchBar", false);
			_IsSearchLoading = CreateBinding("IsSearchLoading", false);
			_ActivePrefabId = CreateBinding("ActivePrefabId", 0);
			// Lets the UI know whether to render the lens in place of the
			// vanilla asset grid. Read once at setup; the setting is not
			// expected to change mid-session.
			_ReplaceVanillaBuildMenu = CreateBinding("ReplaceVanillaBuildMenu", Mod.Settings.ReplaceVanillaBuildMenu);
			_LensOwnsCurrentMenu = CreateBinding("LensOwnsCurrentMenu", false);
			// Whether upstream Find It is loaded beside us (cm-wf6g.4). Its UI
			// ships the same picker; the toolbar shows one. Decided on the first
			// update, not here: mods load in sequence and this system is created
			// during OUR load, two seconds before Find It's assembly appears.
			_FindItPresent = CreateBinding("FindItPresent", false);
			// "<index>:<version>:<nonce>", or empty. The picker asks the game to
			// open a menu through this; see RequestVanillaMenu.
			_PickerMenuRequest = CreateBinding("PickerMenuRequest", string.Empty);
			_BuildingCatalogMatchesElsewhere = CreateBinding("BuildingCatalogMatchesElsewhere", 0);
			// Layout preferences the UI needs. Read once at setup; these are not
			// expected to change mid-session.
			_LensDefaultToTable = CreateBinding("BuildingLensDefaultToTable", Mod.Settings.BuildingLensDefaultToTable);
			_LensShowShelf = CreateBinding("BuildingLensShowShelf", Mod.Settings.BuildingLensShowShelf);
			_LensShelfSize = CreateBinding("BuildingLensShelfSize", Mod.Settings.BuildingLensShelfSize);
			_LensTileSize = CreateBinding("BuildingLensTileSize", Mod.Settings.BuildingLensTileSize);
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
			// Sort is a read/write binding rather than a write-only trigger: the
			// order lives in the persistent query, so a UI that could only write
			// it showed a stale indicator over correctly-sorted rows after any
			// remount (panel close, Catalog/Tools switch, lens toggle).
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
			_BuildingLensStripAxisBinding = CreateBinding("BuildingLensStripAxis", string.Empty);
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
			// The game's own filter row, forwarded from the UI. The equivalent
			// fields on ToolbarUISystem are private, so its four bindings are the
			// reachable route, and the UI is where they can be read.
			//
			// Entity indices arrive comma-joined rather than as int[]: this
			// bridge is happier with flat primitives, and the two lists are
			// short. Parsing is the price of not risking a marshalling failure
			// that would show up as an empty menu.
			CreateTrigger<string, string, bool, bool>("SetVanillaToolbarSelection", SetVanillaToolbarSelection);
			CreateTrigger("OnSearchCleared", () => _ClearSearchBar.Value = false);
			CreateTrigger<int>("OnLocateButtonClicked", OnLocateButtonClicked);
			CreateTrigger("LoadMoreBuildingCatalog", LoadMoreBuildingCatalog);
				CreateTrigger<string, string, string>("SetBuildingCatalogMetricRange", SetBuildingCatalogMetricRange);
				CreateTrigger("ClearBuildingCatalogMetricRanges", ClearBuildingCatalogMetricRanges);
				CreateTrigger<string, string>("ToggleBuildingLensFacet", ToggleBuildingLensFacet);
				CreateTrigger("ClearBuildingLensFacets", ClearBuildingLensFacets);
				CreateTrigger("ClearBuildingLensFilters", ClearBuildingLensFilters);
				CreateTrigger("ResetBuildingLensMenu", ResetBuildingLensMenu);
				CreateTrigger<string>("SetBuildingLensStripTab", SetBuildingLensStripTab);
				// Its own trigger, not folded into SetBuildingLensSubCategory:
				// that one is also the reset path ("All types", and removing a
				// type chip), so clearing the menu there would silently drop
				// Garbage Management back to the whole catalog.
				CreateTrigger("ClearBuildingLensMenuScope", ClearBuildingLensMenuScope);
				CreateTrigger<string>("SetBuildingLensMenu", SetBuildingLensMenu);
			CreateTrigger<float>("SetBuildingLensPanelHeight", SetBuildingLensPanelHeight);
			CreateTrigger("CommitBuildingLensPanelHeight", CommitBuildingLensPanelHeight);
		}

		protected override void OnUpdate()
		{
			if (!_findItPresenceChecked)
			{
				_findItPresenceChecked = true;
				_FindItPresent.Value = IsFindItLoaded();
			}

			if (_searchDebounce.TryFire(SearchClock.Elapsed))
			{
				_IsSearchLoading.Value = false;
				RefreshBuildingCatalog();
			}

			base.OnUpdate();
		}
	}
}
