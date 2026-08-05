using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Domain.UIBinding;
using FindItBuildingMenu.Services;
using FindItBuildingMenu.Utilities;
using Game.Input;
using Game.Prefabs;
using Game.Rendering;
using Game.Tools;

using System.Threading;

namespace FindItBuildingMenu.Systems
{
    internal partial class FindItUISystem : ExtendedUISystemBase
	{
		private bool filterCompleted;
		private bool scrollCompleted;
		private bool settingPrefab;
		private double scrollIndex;
		private CancellationTokenSource searchTokenSource = new();
		private CancellationTokenSource scrollTokenSource = new();
		private readonly BuildingCatalogAdapter _buildingCatalogAdapter = new();
		private BuildingCatalogQuery _buildingCatalogQuery = new();
		private readonly FindItInteractionBoundary _interactionBoundary = new();
		private BuildingCatalogMetricRangeState _buildingMetricRanges = BuildingCatalogMetricRangeState.Empty;
		private string _buildingLensSection = VanillaBuildMenuTaxonomy.AllBuildings;
		private string _buildingLensSubCategory = VanillaBuildMenuTaxonomy.Any;

		private ToolSystem _toolSystem;
		private PrefabSystem _prefabSystem;
		private FindItOptionsUISystem _optionsUISystem;
		private DefaultToolSystem _defaultToolSystem;
		private CameraUpdateSystem _cameraUpdateSystem;

		private ProxyAction _searchKeyBinding;
		private ProxyAction _randomKeyBinding;
		private ProxyAction _arrowLeftBinding;
		private ProxyAction _arrowUpBinding;
		private ProxyAction _arrowRightBinding;
		private ProxyAction _arrowDownBinding;

		private ValueBindingHelper<bool> _IsSearchLoading;
		private ValueBindingHelper<bool> _IsWindowLocked;
		private ValueBindingHelper<bool> _FocusSearchBar;
		private ValueBindingHelper<bool> _ClearSearchBar;
		private ValueBindingHelper<bool> _ShowFindItPanel;
		private ValueBindingHelper<bool> _BuildingLensEnabled = null!;
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
		private ValueBindingHelper<bool> _ShowZoningHierarchy = null!;
		private ValueBindingHelper<ZoneCatalogEntry[]> _ZoneCatalog = null!;
		private ValueBindingHelper<bool> _IsExpanded;
		private ValueBindingHelper<double> _ScrollIndex;
		private ValueBindingHelper<double> _MaxScrollIndex;
		private ValueBindingHelper<double> _ColumnCount;
		private ValueBindingHelper<double> _RowCount;
		private ValueBindingHelper<int> _ActivePrefabId;
		private ValueBindingHelper<int> _CurrentCategoryBinding;
		private ValueBindingHelper<int> _CurrentSubCategoryBinding;
		private ValueBindingHelper<float> _PanelHeight;
		private ValueBindingHelper<float> _PanelWidth;
		private ValueBindingHelper<string> _CurrentSearch;
		private ValueBindingHelper<string> _ViewStyle;
		private ValueBindingHelper<string> _AlignmentStyle;
		private ValueBindingHelper<string> _PrefabCountBinding;
		private ValueBindingHelper<string[]> _AllThumbnails;
		private ValueBindingHelper<CategoryUIEntry[]> _CategoryBinding;
		private ValueBindingHelper<SubCategoryUIEntry[]> _SubCategoryBinding;
		private ValueBindingHelper<PrefabUIEntry[]> _PrefabListBinding;
		private ValueBindingHelper<BuildingCatalogPage> _BuildingCatalogBinding = null!;
		private ValueBindingHelper<BuildingCatalogMetricRangeState> _BuildingCatalogMetricRanges = null!;
		private ValueBindingHelper<BuildingCatalogFacetState> _BuildingLensFacets = null!;
		private IReadOnlyList<int> _buildingCompareIds = Array.Empty<int>();
		private ValueBindingHelper<BuildingCatalogEntry[]> _BuildingCatalogCompare = null!;
		private ValueBindingHelper<string[]> _BuildingLensLegacyFilters = null!;
		private ValueBindingHelper<string> _BuildingCatalogSortColumn = null!;
		private ValueBindingHelper<bool> _BuildingCatalogSortDescending = null!;
		private ValueBindingHelper<string> _BuildingLensSectionBinding = null!;
		private ValueBindingHelper<string> _BuildingLensSubCategoryBinding = null!;
		private ValueBindingHelper<BuildingLensSectionUIEntry[]> _BuildingLensSectionListBinding = null!;
		private ValueBindingHelper<BuildingLensSubCategoryUIEntry[]> _BuildingLensSubCategoryListBinding = null!;
		private ValueBindingHelper<ToolSurfaceDescriptor[]> _ToolSurfaceDescriptorsBinding = null!;

		public bool IsExpanded => _IsExpanded;
		public bool BuildingLensEnabled => _BuildingLensEnabled;
		public string ViewStyle
		{
			get => _ViewStyle;
			set
			{
				Mod.Settings.DefaultViewStyle = _ViewStyle.Value = value;
				Mod.Settings.ApplyAndSave();
				UpdateCategoriesAndPrefabList();
			}
		}
		public string AlignmentStyle
		{
			get => _AlignmentStyle;
			set
			{
				_IsExpanded.Value = false;

				Mod.Settings.DefaultAlignmentStyle = _AlignmentStyle.Value = value;
				Mod.Settings.ApplyAndSave();

				ExpandedToggled();
			}
		}

		protected override void OnCreate()
		{
			base.OnCreate();

			// Instantiating systems 
			_toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
			_optionsUISystem = World.GetOrCreateSystemManaged<FindItOptionsUISystem>();
			_defaultToolSystem = World.GetOrCreateSystemManaged<DefaultToolSystem>();
			_cameraUpdateSystem = World.GetOrCreateSystemManaged<CameraUpdateSystem>();

			// ToolSystem toolSystem = World.DefaultGameObjectInjectionWorld?.GetOrCreateSystemManaged<ToolSystem>(); // I don't know why vanilla game did this.
			_toolSystem.EventPrefabChanged += OnPrefabChanged;
			_toolSystem.EventToolChanged += OnToolChanged;

			// Keybinding caching
			_searchKeyBinding = Mod.Settings.GetAction(nameof(FindItSettings.SearchKeyBinding));
			_searchKeyBinding.shouldBeEnabled = true;

			_randomKeyBinding = Mod.Settings.GetAction(nameof(FindItSettings.RandomKeyBinding));

			_arrowLeftBinding = Mod.Settings.GetAction(nameof(FindItSettings.LeftArrow));
			_arrowUpBinding = Mod.Settings.GetAction(nameof(FindItSettings.UpArrow));
			_arrowRightBinding = Mod.Settings.GetAction(nameof(FindItSettings.RightArrow));
			_arrowDownBinding = Mod.Settings.GetAction(nameof(FindItSettings.DownArrow));

			// These establish the bindings for the categories
			_CurrentCategoryBinding = CreateBinding("CurrentCategory", "SetCurrentCategory", (int)FindItUtil.CurrentCategory, SetCurrentCategory);
			_CurrentSubCategoryBinding = CreateBinding("CurrentSubCategory", "SetCurrentSubCategory", (int)FindItUtil.CurrentSubCategory, SetCurrentSubCategory);

			// These establish the bindings with UI code.
			_FocusSearchBar = CreateBinding("FocusSearchBar", false);
			_ClearSearchBar = CreateBinding("ClearSearchBar", false);
			_ShowFindItPanel = CreateBinding("ShowFindItPanel", false);
			_IsSearchLoading = CreateBinding("IsSearchLoading", false);
			_IsWindowLocked = CreateBinding("IsWindowLocked", false);
			_BuildingLensEnabled = CreateBinding("BuildingLensEnabled", "SetBuildingLensEnabled", false, SetBuildingLensEnabled);
			_IsExpanded = CreateBinding("IsExpanded", "SetIsExpanded", false, _ => ExpandedToggled());
			_ActivePrefabId = CreateBinding("ActivePrefabId", 0);
			// Lets the UI know whether to render the lens in place of the
			// vanilla asset grid. Read once at setup; the setting is not
			// expected to change mid-session.
			_ReplaceVanillaBuildMenu = CreateBinding("ReplaceVanillaBuildMenu", Mod.Settings.ReplaceVanillaBuildMenu);
			_ShowZoningHierarchy = CreateBinding("ShowZoningHierarchy", false);
			_BuildingCatalogMatchesElsewhere = CreateBinding("BuildingCatalogMatchesElsewhere", 0);
			// Layout preferences the UI needs. Read once at setup; these are not
			// expected to change mid-session.
			_LensDefaultToTable = CreateBinding("BuildingLensDefaultToTable", Mod.Settings.BuildingLensDefaultToTable);
			_LensShowShelf = CreateBinding("BuildingLensShowShelf", Mod.Settings.BuildingLensShowShelf);
			_LensShelfSize = CreateBinding("BuildingLensShelfSize", Mod.Settings.BuildingLensShelfSize);
			_LensTileSize = CreateBinding("BuildingLensTileSize", Mod.Settings.BuildingLensTileSize);
			CreateTrigger("SearchEverything", SearchEverything);
			_ZoneCatalog = CreateBinding("ZoneCatalog", new ZoneCatalogEntry[0]);
			_PanelHeight = CreateBinding("PanelHeight", 0f);
			_PanelWidth = CreateBinding("PanelWidth", 0f);
			_ScrollIndex = CreateBinding("ScrollIndex", 0D);
			_MaxScrollIndex = CreateBinding("MaxScrollIndex", 0D);
			_ColumnCount = CreateBinding("ColumnCount", 0D);
			_RowCount = CreateBinding("RowCount", 0D);
			_CurrentSearch = CreateBinding("CurrentSearch", string.Empty);
			_CategoryBinding = CreateBinding("CategoryList", new CategoryUIEntry[] { new(PrefabCategory.Any) });
			_SubCategoryBinding = CreateBinding("SubCategoryList", new SubCategoryUIEntry[] { new(PrefabSubCategory.Any) });
			_PrefabListBinding = CreateBinding("PrefabList", new PrefabUIEntry[0]);
			_BuildingCatalogBinding = CreateBinding("BuildingCatalog", new BuildingCatalogPage(
				Array.Empty<BuildingCatalogEntry>(),
				0,
				0,
				100,
				BuildingCatalogLensState.Indexing));
			_BuildingCatalogMetricRanges = CreateBinding("BuildingCatalogMetricRanges", BuildingCatalogMetricRangeState.Empty);
			_BuildingLensFacets = CreateBinding("BuildingLensFacets", new BuildingCatalogFacetState(Array.Empty<BuildingCatalogFacetGroup>(), false));
			_BuildingCatalogCompare = CreateBinding("BuildingCatalogCompare", Array.Empty<BuildingCatalogEntry>());
			_BuildingLensLegacyFilters = CreateBinding("BuildingLensLegacyFilters", Array.Empty<string>());
			// Sort is a read/write binding rather than a write-only trigger: the
			// order lives in the persistent query, so a UI that could only write
			// it showed a stale indicator over correctly-sorted rows after any
			// remount (panel close, Catalog/Tools switch, lens toggle).
			_BuildingCatalogSortColumn = CreateBinding(
				"BuildingCatalogSortColumn",
				"SetBuildingCatalogSortColumn",
				_buildingCatalogQuery.EffectiveSortColumn,
				SetBuildingCatalogSortColumn);
			_BuildingCatalogSortDescending = CreateBinding(
				"BuildingCatalogSortDescending",
				"SetBuildingCatalogSortDescending",
				_buildingCatalogQuery.Descending,
				SetBuildingCatalogSortDescending);
			_BuildingLensSectionBinding = CreateBinding("BuildingLensSection", "SetBuildingLensSection", _buildingLensSection, SetBuildingLensSection);
			_BuildingLensSubCategoryBinding = CreateBinding("BuildingLensSubCategory", "SetBuildingLensSubCategory", _buildingLensSubCategory, SetBuildingLensSubCategory);
			_BuildingLensSectionListBinding = CreateBinding("BuildingLensSectionList", Array.Empty<BuildingLensSectionUIEntry>());
			_BuildingLensSubCategoryListBinding = CreateBinding("BuildingLensSubCategoryList", Array.Empty<BuildingLensSubCategoryUIEntry>());
			_ToolSurfaceDescriptorsBinding = CreateBinding("ToolSurfaceDescriptors", ToolSurfaceCatalog.GetDescriptors().ToArray());
			_PrefabCountBinding = CreateBinding("PrefabCount", string.Empty);
			_ViewStyle = CreateBinding("ViewStyle", Mod.Settings.DefaultViewStyle);
			_AlignmentStyle = CreateBinding("AlignmentStyle", Mod.Settings.DefaultAlignmentStyle);
			_AllThumbnails = CreateBinding("AllThumbnails", new string[0]);

			CreateBinding("NoAssetImage", () => Mod.Settings.NoAssetImage);

			// These establish UI actions triggering methods on the C# side.
			CreateTrigger<string>("SearchChanged", t => SearchChanged(t));
			CreateTrigger<int>("OnScroll", OnScroll);
			CreateTrigger<double>("SetScrollIndex", SetScrollIndex);
			CreateTrigger("FindItCloseToggled", () => ToggleFindItPanel(false));
			CreateTrigger("FindItIconToggled", FindItIconClicked);
			CreateTrigger<int>("SetCurrentPrefab", TryActivatePrefabTool);
			// The UI watches the game's own toolbar.selectedAssetMenu binding and
			// hands the entity index here; resolving the prefab name and the
			// preset belongs on this side.
			CreateTrigger<int>("VanillaMenuSelected", VanillaMenuSelected);
			CreateTrigger<int>("ToggleFavorited", FindItUtil.ToggleFavorited);
			CreateTrigger("ToggleLock", ToggleLock);
			CreateTrigger("OnSearchFocused", () => _FocusSearchBar.Value = false);
			CreateTrigger("OnSearchCleared", () => _ClearSearchBar.Value = false);
			CreateTrigger("OnRandomButtonClicked", OnRandomButtonClicked);
			CreateTrigger<int>("OnLocateButtonClicked", OnLocateButtonClicked);
			CreateTrigger<int>("OnPdxModsButtonClicked", OnPdxModsButtonClicked);
			CreateTrigger<int>("SetBuildingCatalogOffset", SetBuildingCatalogOffset);
			CreateTrigger<int>("ToggleBuildingCatalogCompare", ToggleBuildingCatalogCompare);
			CreateTrigger("ClearBuildingCatalogCompare", ClearBuildingCatalogCompare);
				CreateTrigger<string, string, string>("SetBuildingCatalogMetricRange", SetBuildingCatalogMetricRange);
				CreateTrigger("ClearBuildingCatalogMetricRanges", ClearBuildingCatalogMetricRanges);
				CreateTrigger<string, string>("ToggleBuildingLensFacet", ToggleBuildingLensFacet);
				CreateTrigger("ClearBuildingLensFacets", ClearBuildingLensFacets);
				CreateTrigger("ClearBuildingLensFilters", ClearBuildingLensFilters);
			CreateTrigger<float>("SetBuildingLensPanelWidth", SetBuildingLensPanelWidth);
			CreateTrigger("CommitBuildingLensPanelWidth", CommitBuildingLensPanelWidth);
			CreateTrigger("ClearThumbnails", () => _AllThumbnails.Value = new string[0]);
		}

		protected override void OnUpdate()
		{
			_randomKeyBinding.shouldBeEnabled =
			_arrowLeftBinding.shouldBeEnabled =
			_arrowUpBinding.shouldBeEnabled =
			_arrowRightBinding.shouldBeEnabled =
			_arrowDownBinding.shouldBeEnabled = _ShowFindItPanel || _IsWindowLocked;

			if (filterCompleted)
			{
				filterCompleted = false;
				scrollIndex = 0;

				_IsSearchLoading.Value = false;
				_PrefabListBinding.Value = GetDisplayedPrefabs();
				// Extra Filters complete on the search worker. Refresh the
				// building lens after that worker publishes its result so the
				// typed catalog does not silently diverge from the grid.
				RefreshBuildingCatalog();
			}

			if (scrollCompleted)
			{
				scrollCompleted = false;

				_PrefabListBinding.Value = GetDisplayedPrefabs();
			}

			if (_searchKeyBinding.WasPerformedThisFrame())
			{
				OnSearchKeyPressed();
			}

			if (_ShowFindItPanel || _IsWindowLocked)
			{
				if (_randomKeyBinding.WasPerformedThisFrame())
				{
					OnRandomButtonClicked();
				}

				if (_arrowLeftBinding.WasPerformedThisFrame())
				{
					MoveSelectedItemGrid(-1, 0);
				}

				if (_arrowUpBinding.WasPerformedThisFrame())
				{
					MoveSelectedItemGrid(0, -1);
				}

				if (_arrowRightBinding.WasPerformedThisFrame())
				{
					MoveSelectedItemGrid(1, 0);
				}

				if (_arrowDownBinding.WasPerformedThisFrame())
				{
					MoveSelectedItemGrid(0, 1);
				}
			}

			base.OnUpdate();
		}
	}
}
