using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Domain.UIBinding;
using FindItBuildingMenu.Utilities;
using Game.Prefabs;
using Game.SceneFlow;
using Game.Tools;
using Game.UI;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

using Unity.Entities;

namespace FindItBuildingMenu.Systems
{
    internal partial class FindItUISystem : ExtendedUISystemBase
	{
		internal void UpdateCategoriesAndPrefabList()
		{
			_CategoryBinding.Value = FindItUtil.GetCategories().Select(x => new CategoryUIEntry(x)).ToArray();
			_SubCategoryBinding.Value = FindItUtil.GetSubCategories().Select(x => new SubCategoryUIEntry(x)).ToArray();
			RefreshBuildingLensNavigation();
			RefreshBuildingCatalog();

			var prefabs = GetDisplayedPrefabs();

			_PrefabListBinding.Value = prefabs;
		}

		private void RefreshBuildingCatalog()
		{
			var category = !_BuildingLensEnabled
				&& (FindItUtil.CurrentCategory is PrefabCategory.Buildings or PrefabCategory.ServiceBuildings)
				? FindItUtil.CurrentCategory.ToString()
				: string.Empty;
			var subCategory = string.IsNullOrEmpty(category) || FindItUtil.CurrentSubCategory == PrefabSubCategory.Any
				? string.Empty
				: FindItUtil.CurrentSubCategory.ToString();
			double? effectiveCapacityMinimum = _buildingMetricRanges.MinCapacity;

			BuildingCatalogQuery previousQuery = _buildingCatalogQuery;

			_buildingCatalogQuery = _buildingCatalogQuery with
			{
				SearchText = _CurrentSearch.Value ?? string.Empty,
				Category = category,
				SubCategory = subCategory,
				BuildMenuSection = _BuildingLensEnabled ? _buildingLensSection : string.Empty,
				BuildMenuSubCategory = _BuildingLensEnabled ? _buildingLensSubCategory : string.Empty,
				UiMenu = _BuildingLensEnabled ? _buildingLensUiMenu : string.Empty,
				UiCategory = _BuildingLensEnabled ? _buildingLensUiCategory : string.Empty,
				// Keep the successor lens in lockstep with FindIt's common
				// parking filters. The legacy grid owns the full filter pipeline;
				// the bounded catalog receives the equivalent typed predicate.
				HasParking = FindItUtil.Filters.WithParking
					? true
					: FindItUtil.Filters.WithoutParking
						? false
						: null,
				MinConstructionCost = _buildingMetricRanges.MinCost,
				MaxConstructionCost = _buildingMetricRanges.MaxCost,
				MinUpkeep = _buildingMetricRanges.MinUpkeep,
				MaxUpkeep = _buildingMetricRanges.MaxUpkeep,
				MinWorkers = _buildingMetricRanges.MinWorkers,
				MaxWorkers = _buildingMetricRanges.MaxWorkers,
				MinCapacity = effectiveCapacityMinimum,
				MaxCapacity = _buildingMetricRanges.MaxCapacity,
				MinLotWidth = ToNullableInt(_buildingMetricRanges.MinLotWidth),
				MaxLotWidth = ToNullableInt(_buildingMetricRanges.MaxLotWidth),
				MinLotDepth = ToNullableInt(_buildingMetricRanges.MinLotDepth),
				MaxLotDepth = ToNullableInt(_buildingMetricRanges.MaxLotDepth),
			};

			// Search text, the legacy parking filters, and the lens section all
			// arrive through this rebuild rather than through a handler that
			// resets paging, so a narrowing change used to strand the player on
			// an offset past the new result set.
			_buildingCatalogQuery = _buildingCatalogQuery.ResetWindowIfPredicatesChanged(previousQuery);

			// Entering a menu is the one predicate change the handlers cannot size
			// for themselves: they set the scope and the window in the same `with`,
			// before the query knows it is scoped. Raising the floor here, after the
			// scope is settled, is the single point every path goes through.
			if (_buildingCatalogQuery.Limit < _buildingCatalogQuery.StartingLimit)
			{
				_buildingCatalogQuery = _buildingCatalogQuery with { Limit = _buildingCatalogQuery.StartingLimit };
			}

			BuildingCatalogPage page = _buildingCatalogAdapter.Query(_buildingCatalogQuery);

			// A search that matches nothing in the current section reads as
			// "this building does not exist" when it usually means "not here".
			// Only computed when the scoped result is actually empty, so the
			// extra pass costs nothing in the common case.
			// With auto-widen on, a scoped miss drops the scope itself rather
			// than asking. Cannot recurse: SearchEverything calls back into
			// this method, and by then the section is AllBuildings so the
			// branch fails its own guard.
			if (Mod.Settings.AutoWidenSearch
				&& page.TotalCount == 0
				&& !string.IsNullOrWhiteSpace(_buildingCatalogQuery.SearchText)
				&& _buildingLensSection != VanillaBuildMenuTaxonomy.AllBuildings)
			{
				SearchEverything();
				return;
			}

			_BuildingCatalogMatchesElsewhere.Value =
				page.TotalCount == 0 && !string.IsNullOrWhiteSpace(_buildingCatalogQuery.SearchText)
					? _buildingCatalogAdapter.Query(_buildingCatalogQuery with
					{
						Category = string.Empty,
						SubCategory = string.Empty,
						BuildMenuSection = VanillaBuildMenuTaxonomy.AllBuildings,
						BuildMenuSubCategory = VanillaBuildMenuTaxonomy.Any,
						UiMenu = string.Empty,
						Offset = 0,
					}).TotalCount
					: 0;
			_BuildingCatalogBinding.Value = page with
			{
				Status = BuildingCatalogLensState.GetPageStatus(FindItUtil.IsReady, page.TotalCount),
			};
			// Publish the order the query actually ran with, so the header can
			// never disagree with the rows beneath it.
			_BuildingCatalogSortColumn.Value = _buildingCatalogQuery.EffectiveSortColumn;
			_BuildingCatalogSortDescending.Value = _buildingCatalogQuery.Descending;
			_BuildingCatalogMetricRanges.Value = _buildingMetricRanges;
			_BuildingLensFacets.Value = _buildingCatalogAdapter.GetFacetState(_buildingCatalogQuery);
			_BuildingLensLegacyFilters.Value = CaptureLegacyFilters().Describe().ToArray();
			// At most three ids, so re-projecting alongside the page keeps the
			// tray current once indexing finishes without measurable cost.
			PublishBuildingCompare();
		}

		/// <summary>
		/// Snapshots the legacy FindIt filter panel so the lens can name the
		/// filters that are narrowing its result set. The adapter applies these
		/// to the lens index, so leaving them out of the summary made the panel
		/// claim nothing was filtering while most of the catalog was hidden.
		/// </summary>
		private static BuildingLensLegacyFilterSnapshot CaptureLegacyFilters()
		{
			Filters filters = FindItUtil.Filters;

			return new BuildingLensLegacyFilterSnapshot(
				HideAds: filters.HideAds,
				HideRandoms: filters.HideRandoms,
				HideVanilla: filters.HideVanilla,
				UniqueMesh: filters.UniqueMesh,
				OnlyPlaced: filters.OnlyPlaced,
				HasDlc: filters.SelectedDlc != int.MinValue,
				WithParking: filters.WithParking,
				WithoutParking: filters.WithoutParking,
				HasZoneType: filters.SelectedZoneType != ZoneTypeFilter.Any,
				HasBuildingCorner: filters.SelectedBuildingCorner != BuildingCornerFilter.Any,
				BuildingLevel: filters.BuildingLevelFilter,
				LotDepth: filters.LotDepthFilter,
				LotWidth: filters.LotWidthFilter,
				ThemeNone: filters.SelectedThemeNone,
				HasTheme: filters.SelectedTheme != null,
				HasAssetPacks: filters.SelectedAssetPacks != null && !filters.SelectedAssetPacks.IsDefault());
		}

		/// <summary>
		/// Re-projects the compared ids from the live prefab index and drops any
		/// that no longer resolve, so a stale shortlist cannot outlive the
		/// buildings it names.
		/// </summary>
		private void PublishBuildingCompare()
		{
			var entries = new List<BuildingCatalogEntry>(_buildingCompareIds.Count);
			var resolvedIds = new List<int>(_buildingCompareIds.Count);

			foreach (int id in _buildingCompareIds)
			{
				if (_buildingCatalogAdapter.TryGet(id, out BuildingCatalogEntry? entry) && entry is not null)
				{
					entries.Add(entry);
					resolvedIds.Add(id);
				}
			}

			if (resolvedIds.Count != _buildingCompareIds.Count)
			{
				_buildingCompareIds = resolvedIds;
			}

			_BuildingCatalogCompare.Value = entries.ToArray();
		}

		private static int? ToNullableInt(double? value)
		{
			return value.HasValue ? (int)value.Value : null;
		}

		private void RefreshBuildingLensNavigation()
		{
			// Dense by index: entry N is milestone N's name. A locked asset ships
			// a bare index and the UI reads it out of here, so the ~20 names are
			// resolved once per index pass instead of once per locked asset on
			// every unlock-triggered re-index.
			var milestoneCount = 0;
			for (var i = 0; i < 64 && !string.IsNullOrEmpty(PrefabIndexingSystem.GetMilestoneName(i)); i++)
			{
				milestoneCount = i + 1;
			}

			_BuildingLensMilestonesBinding.Value = Enumerable.Range(0, milestoneCount)
				.Select(PrefabIndexingSystem.GetMilestoneName)
				.ToArray();

			VanillaBuildMenuSelection selection = VanillaBuildMenuSelection.Normalize(
				_buildingLensSection,
				_buildingLensSubCategory);
			_buildingLensSection = selection.Section;
			_buildingLensSubCategory = selection.SubCategory;
			_BuildingLensSectionBinding.Value = _buildingLensSection;
			_BuildingLensSubCategoryBinding.Value = _buildingLensSubCategory;
			_BuildingLensSectionListBinding.Value = VanillaBuildMenuTaxonomy.GetSectionDescriptors()
				.Select(descriptor => new BuildingLensSectionUIEntry(descriptor))
				.ToArray();
			_BuildingLensSubCategoryListBinding.Value = VanillaBuildMenuTaxonomy.GetSubcategoryDescriptors(_buildingLensSection)
				.Select(descriptor => new BuildingLensSubCategoryUIEntry(descriptor))
				.ToArray();
			// Publish the static tool catalog alongside the lens navigation values.
			// CreateBinding's initial value can be emitted before the Gameface module
			// subscribes during a view recreation; the refresh path is the same
			// lifecycle used by the working section/subcategory bindings above.
		}


		private PrefabUIEntry[] GetDisplayedPrefabs()
		{
			// in charge of paging prefabs and getting only the displayed prefabs
			// also updates display binding values like columns, rows, scroll, etc.

			var list = FindItUtil.GetFilteredPrefabs();

			var columns = GridUtil.GetCurrentColumnCount();
			var displayedRows = GridUtil.GetCurrentRowCount();
			var rows = Math.Ceiling(list.Count / (float)columns);

			scrollIndex = Math.Max(Math.Min(scrollIndex, rows - displayedRows), 0);

			_ScrollIndex.Value = scrollIndex;
			_MaxScrollIndex.Value = rows - displayedRows;
			_ColumnCount.Value = columns;
			_RowCount.Value = displayedRows;
			_PrefabCountBinding.Value = string.Format(LocaleHelper.GetTooltip("ItemCount"), list.Count.ToString("N0"));

			var uiEntries = new List<PrefabUIEntry>();
			var startIndex = (int)(Math.Floor(scrollIndex) * columns);
			var maxIndex = startIndex + (columns * (2 + displayedRows));

			for (var i = startIndex; i < maxIndex && i < list.Count; i++)
			{
				uiEntries.Add(new PrefabUIEntry(list[i]));
			}

			return uiEntries.ToArray();
		}

		internal void TryActivatePrefabTool(int id)
		{
			var prefabBase = FindItUtil.GetPrefabBase(id);
			_interactionBoundary.TryActivatePrefab(
				id,
				prefabBase is not null,
				_toolSystem.activePrefab == prefabBase,
				() => ActivatePrefabTool(id, prefabBase!));
		}

		private void ActivatePrefabTool(int id, PrefabBase prefabBase)
		{
			settingPrefab = true;
			_toolSystem.ActivatePrefabTool(prefabBase);
			_ActivePrefabId.Value = id;
			settingPrefab = false;
		}

		internal void ScrollTo(int id)
		{
			// Scrolls to a specific prefab using its index from PrefabIndexingSystem

			var list = FindItUtil.GetFilteredPrefabs();
			var index = list.FindIndex(x => x.Id == id);

			if (index > -1)
			{
				var columns = (float)GridUtil.GetCurrentColumnCount();
				var rows = GridUtil.GetCurrentRowCount();

				scrollIndex = Math.Max(0, Math.Floor(index / columns) - (rows / 4));
			}
		}

		internal void TriggerSearch()
		{
			_IsSearchLoading.Value = true;

			Task.Run(DelayedSearch);
		}

		internal void ClearSearch()
		{
			_ClearSearchBar.Value = true;
			FindItUtil.Filters.CurrentSearch = string.Empty;
			filterCompleted = false;
			_IsSearchLoading.Value = false;
			_CurrentSearch.Value = string.Empty;
			RefreshBuildingCatalog();
			searchTokenSource?.Cancel();
		}

		private async Task DelayedSearch()
		{
			// Asyncronously proesses the search method with a 250ms delay
			// the Cancellation Token is used to stop any ongoing searches if a new one is requested
			// and is used to disregard outdated results

			searchTokenSource.Cancel();
			searchTokenSource = new();

			var token = searchTokenSource.Token;

			await Task.Delay(250);

			if (token.IsCancellationRequested)
			{
				return;
			}

			try
			{
				FindItUtil.ProcessSearch(token);

				if (!token.IsCancellationRequested)
				{
					// toggle the filterCompleted to signal to the OnUpdate method
					// that search has concluded and results are ready

					filterCompleted = true;
				}
			}
			catch (Exception ex)
			{
				Mod.Log.Error(ex, "Search Failed");
			}
		}

		internal void RefreshCategoryAndSubCategory()
		{
			_CurrentCategoryBinding.Value = (int)FindItUtil.CurrentCategory;
			_CurrentSubCategoryBinding.Value = (int)FindItUtil.CurrentSubCategory;
		}

		private void OnPrefabChanged(PrefabBase prefab)
		{
			if (!settingPrefab)
			{
				ToggleFindItPanel(false);
				return;
			}

			if (prefab == null)
			{
				_ActivePrefabId.Value = 0;

				return;
			}

			if (_prefabSystem.TryGetEntity(prefab, out var entity))
			{
				_ActivePrefabId.Value = entity.Index;
			}
		}

		private void OnToolChanged(ToolBaseSystem tool)
		{
			if (tool.toolID is "RoadBuilderTool" or "MoveItTool" or "Terrain Tool")
			{
				// Another tool brings its own UI and wants the screen. Ours goes.
				ToggleFindItPanel(false);
				return;
			}

			// The Zone tool is NOT one of those, though it sat in that list.
			//
			// Picking a zone arms it, so hiding the panel here meant the zoning
			// surface closed the instant it was used — and because the vanilla
			// Zones menu is still selected on the toolbar, the game drew its own
			// grid into the space we had just vacated. Reported from play as
			// "selecting a zoning type works, but moves us back to the vanilla
			// zoning menu". It read as intermittent because a SECOND pick does
			// not change the tool, so the handler never runs and the panel stays.
			//
			// Driving this tool is what the zoning surface is for, so it stays,
			// for the same reason and by the same rule as the default-tool branch
			// below: while the lens stands in for a vanilla menu, vacating hands
			// the screen straight back to the menu it replaced.
			if (tool.toolID is "Zone Tool")
			{
				if (_LensOwnsCurrentMenu.Value)
				{
					return;
				}

				ToggleFindItPanel(false);
				return;
			}

			if (settingPrefab || tool != _defaultToolSystem)
			{
				return;
			}

			// The tool went back to default. That is Escape, a right-click
			// cancel, or a finished placement, and this handler cannot tell them
			// apart — Escape is consumed by the game's native input layer and
			// never reaches the DOM.
			//
			// So it stops trying to. While the lens is standing in for a vanilla
			// menu, that menu is STILL SELECTED on the toolbar, and the game
			// draws its own asset grid the instant we vacate the space. Hiding
			// the panel here is what produced "Escape swapped my menu for the old
			// one"; it did the same after every placement, which is why the lens
			// had to learn to restore its scroll position at all.
			//
			// Vanilla's own menu does not close when a tool is cancelled either
			// — it stays open with the grid up, ready for the next pick — so
			// staying open IS the vanilla behaviour, not a departure from it.
			//
			// Escape still closes the menu; it just takes the press the game
			// already spends on it. The first press cancels the tool and we hold
			// still. The second is the game's own "close the open menu", which
			// deselects the toolbar button — and that arrives here as
			// VanillaMenuDeselected, which closes the lens.
			//
			// Deliberately NOT CloseLens, and deliberately not touching the
			// selection. A previous attempt released it here and, because this
			// branch fires on every return to default, the menu was gone long
			// before the player pressed Escape — so the game's Escape chain found
			// nothing to close and opened the pause menu instead. Escape pausing
			// the game mid-build is worse than the defect it fixed.
			if (_LensOwnsCurrentMenu.Value)
			{
				return;
			}

			// Opened from FindIt's own button, so there is no vanilla menu behind
			// us and nothing will be drawn into the gap. Here a cancel closing
			// the panel is the only close Escape can reach.
			ToggleFindItPanel(false);
		}

		public void SetAllThumbnails(IEnumerable<string> thumbnails)
		{
			_AllThumbnails.Value = thumbnails.ToArray();
		}
	}
}
