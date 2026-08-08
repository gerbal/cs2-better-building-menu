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
			_buildingCatalogQuery = _buildingCatalogQuery.ResetPagingIfPredicatesChanged(previousQuery);

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
			_ToolSurfaceDescriptorsBinding.Value = ToolSurfaceCatalog.GetDescriptors().ToArray();
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
			if ((!settingPrefab && tool == _defaultToolSystem) || tool.toolID is "RoadBuilderTool" or "MoveItTool" or "Terrain Tool" or "Zone Tool")
			{
				ToggleFindItPanel(false);
			}
		}

		public void SetAllThumbnails(IEnumerable<string> thumbnails)
		{
			_AllThumbnails.Value = thumbnails.ToArray();
		}
	}
}
