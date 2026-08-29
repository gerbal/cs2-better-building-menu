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
		/// <summary>
		/// Re-publish the lens after something changed what it should show.
		/// </summary>
		/// <remarks>
		/// Was <c>UpdateCategoriesAndPrefabList</c>, which described what it did
		/// when the legacy grid existed: rebuild the category and subcategory
		/// binding lists, then page the prefab list. All three of those are gone,
		/// and the name outlived them by a few commits.
		///
		/// The callers that matter are the options panel's sorting sections,
		/// which still reach the lens: CategorizedPrefabs holds IndexedPrefabList,
		/// whose enumerator returns the statically-sorted order, so the legacy
		/// sort still decides ties the catalog's own sort leaves open.
		/// </remarks>
		internal void RefreshLens()
		{
			RefreshBuildingLensNavigation();
			RefreshBuildingCatalog();
		}

		/// <summary>Republishes the catalog when the CITY changed, not the index.</summary>
		/// <remarks>
		/// For the indexing system to call when a unique asset is built or
		/// bulldozed: the prefabs are untouched, so a re-index would be waste,
		/// but what the query returns has changed. See PlacedUniqueRegistry.
		/// </remarks>
		public void RefreshBuildingCatalogFromIndexing() => RefreshBuildingCatalog();

		private void RefreshBuildingCatalog([System.Runtime.CompilerServices.CallerMemberName] string caller = "")
		{
			// One refresh asks the adapter the same question eight times over,
			// and each answer used to rescan the whole index. Clearing here
			// scopes the shared projection to exactly this publish: nothing can
			// go stale across frames, and the eight passes collapse to one per
			// (menu, content-union) pair. See BuildingCatalogAdapter._projections.
			_buildingCatalogAdapter.BeginRefresh();

			var refreshTimer = System.Diagnostics.Stopwatch.StartNew();

			// Both empty, always. These carried FindItUtil's own category into
			// the query, but only while the lens was off — and the lens is never
			// off now, so the branch that filled them is gone with the latch.
			// The lens states its own scope through UiMenu/UiCategory below.
			var category = string.Empty;
			var subCategory = string.Empty;
			double? effectiveCapacityMinimum = _buildingMetricRanges.MinCapacity;

			BuildingCatalogQuery previousQuery = _buildingCatalogQuery;

			_buildingCatalogQuery = _buildingCatalogQuery with
			{
				SearchText = _CurrentSearch.Value ?? string.Empty,
				Category = category,
				SubCategory = subCategory,
				BuildMenuSection = _buildingLensSection,
				BuildMenuSubCategory = _buildingLensSubCategory,
				UiMenu = _buildingLensUiMenu,
				UiCategory = _buildingLensUiCategory,
				UnlockMilestone = _buildingLensUnlockMilestone,
				StripAxis = _buildingLensStripAxis,
				SchoolTier = _buildingLensSchoolTier,
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
			if (_buildingCatalogQuery.Limit < BuildingCatalogQuery.DefaultLimit)
			{
				_buildingCatalogQuery = _buildingCatalogQuery with { Limit = BuildingCatalogQuery.DefaultLimit };
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
			// Recomputed with the catalog so the bounds follow the menu. They come
			// from InScope, which drops the metric selections, so narrowing a range
			// cannot shrink the bounds it was typed against.
			_BuildingCatalogMetricBounds.Value = _buildingCatalogAdapter.GetMetricBounds(_buildingCatalogQuery);
			_BuildingLensFacets.Value = _buildingCatalogAdapter.GetFacetState(_buildingCatalogQuery);
			// Alongside the facets and for the same reason: the strip is a filter
			// too, and a tab that cannot say how much is behind it is the same
			// dead end as a facet option that cannot.
			_BuildingLensMenuCategoryCounts.Value =
				_buildingCatalogAdapter.GetMenuCategoryCounts(_buildingCatalogQuery).ToArray();
			// The axis is resolved BEFORE the tabs and stored, because the query
			// carries it: the predicate has to match tabs against the same axis
			// the tabs were counted on.
			_buildingLensStripAxis = _buildingCatalogAdapter.GetStripAxis(_buildingCatalogQuery);
			_BuildingLensStripAxisBinding.Value = _buildingLensStripAxis;
			// The rail can change this behind the row's back, so republish it
			// with the rest of the state rather than only when a tab is clicked.
			_BuildingLensStripTabBinding.Value =
				_buildingCatalogQuery.StripTabs?.ToArray() ?? Array.Empty<string>();
			_BuildingLensStripTabs.Value =
				_buildingCatalogAdapter.GetStripTabs(_buildingCatalogQuery).ToArray();
			// One binding, a list. It replaced a (category, tabs) pair that could
			// only ever describe ONE expanded category — enough for the
			// development tree, which picks the largest and stops, and not
			// enough for zones, where three families divide into tiers at once.
			_BuildingLensExpandedCategories.Value =
				_buildingCatalogAdapter.GetExpandedCategories(_buildingCatalogQuery).ToArray();
			// Computed by the query itself, over the matched set and in the same
			// pass — see BuildingCatalogQueryEngine.Query.
			_BuildingLensSortCanReorder.Value = page.SortCanReorder;
			_BuildingLensMenuSchoolTierCounts.Value =
				_buildingCatalogAdapter.GetMenuSchoolTierCounts(_buildingCatalogQuery).ToArray();
			_BuildingLensLegacyFilters.Value = CaptureLegacyFilters().Describe().ToArray();
			// At most three ids, so re-projecting alongside the page keeps the
			// tray current once indexing finishes without measurable cost.

			// The options bank's short-facet rows (Availability, Provenance,
			// Placement) decide their own visibility and Selected flags from
			// _BuildingLensFacets, just written above. Nothing else refreshes
			// them when that state changes underneath them — not a rail toggle,
			// not a section switch with the panel already open — so this has to
			// be the one place that always runs after a facet binding changes.
			// FindItOptionsUISystem guards its own re-entrancy for the callers
			// that already refresh the bank themselves (OptionClicked,
			// ClearFilters), so this cannot compound into a double refresh.
			_optionsUISystem.RefreshOptions();

			// cm-2xvs.25. Logged only when it changes by more than a tenth of a
			// second, so a steady state costs one line rather than one per
			// frame — and a regression in this number is visible in a normal
			// session log without anyone having instrumented anything.
			refreshTimer.Stop();
			// Every refresh, and named by its caller.
			//
			// This used to log only when the duration differed from the last by
			// more than 100ms, which hid exactly the bug it should have caught:
			// a single menu click fired THREE full refreshes, and the two cheap
			// ones never reached the log because they were close to each other.
			// One line per user action is not spam — it is the only way the
			// redundancy is visible at all.
			Mod.Log.Info(
				$"[LENS-REFRESH] {(int)refreshTimer.ElapsedMilliseconds}ms "
				+ $"menu='{_buildingCatalogQuery.UiMenu}' total={page.TotalCount} from={caller}");
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
				WithParking: filters.WithParking,
				WithoutParking: filters.WithoutParking,
				HasZoneType: filters.SelectedZoneType != ZoneTypeFilter.Any,
				HasBuildingCorner: filters.SelectedBuildingCorner != BuildingCornerFilter.Any,
				BuildingLevel: filters.BuildingLevelFilter,
				LotDepth: filters.LotDepthFilter,
				LotWidth: filters.LotWidthFilter);
		}

		/// <summary>
		/// Re-projects the compared ids from the live prefab index and drops any
		/// that no longer resolve, so a stale shortlist cannot outlive the
		/// buildings it names.
		/// </summary>

		private static int? ToNullableInt(double? value)
		{
			return value.HasValue ? (int)value.Value : null;
		}

		private void RefreshBuildingLensNavigation()
		{
			// Dense by index: entry N is milestone N's name. Every asset ships a
			// bare milestone index and the UI reads the name out of here, so the
			// ~20 names are resolved once per index pass instead of once per
			// asset on every unlock-triggered re-index.
			_BuildingLensMilestonesBinding.Value = PrefabIndexingSystem.GetMilestoneNames();
			_BuildingLensMilestoneIconsBinding.Value = PrefabIndexingSystem.GetMilestoneIcons();

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

		private void OnPrefabChanged(PrefabBase prefab)
		{
			// A prefab we did not arm ourselves normally means the player picked
			// something in vanilla's own UI, and the polite answer is to get out
			// of its way. That is the legacy panel's rule and it stays the legacy
			// panel's rule.
			//
			// It no longer needs an exception for the lens. This used to read
			// `!settingPrefab && !_LensOwnsCurrentMenu.Value`, because hiding the
			// panel here handed the screen straight back to the vanilla menu we
			// had replaced — reported from play as "clicking Livestock Farming
			// selects the right thing to build and then reverts to the vanilla
			// menu". The lens is now mounted in the game's own asset-menu slot
			// and does not read this binding at all, so there is no screen to
			// hand back and nothing to except.
			// Mirror what the game has armed BEFORE deciding what the legacy
			// panel does about it. This binding is a fact about the game, not a
			// record of who set it, and it used to be written only on our own
			// path — so placing a building, pressing Escape, or arming something
			// from a vanilla surface left it pointing at the last prefab the lens
			// itself had armed.
			//
			// That was invisible while the only consumer was the legacy grid's
			// faint selected state. The lens grid now draws an accent outline on
			// the armed tile, which turned a stale value into a tile claiming "a
			// click on the map places this" when nothing was armed at all.
			if (prefab is null)
			{
				_ActivePrefabId.Value = 0;
			}
			else if (_prefabSystem.TryGetEntity(prefab, out var entity))
			{
				_ActivePrefabId.Value = entity.Index;
			}

			if (!settingPrefab)
			{
				SetLensMenuOpen(false);
			}
		}

		private void OnToolChanged(ToolBaseSystem tool)
		{
			if (tool.toolID is "RoadBuilderTool" or "MoveItTool" or "Terrain Tool")
			{
				// Another tool brings its own UI and wants the screen. Ours goes.
				SetLensMenuOpen(false);
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
			// Driving this tool is what the zoning surface is for, so the legacy
			// panel still declines to vacate for it.
			if (tool.toolID is "Zone Tool")
			{
				return;
			}

			if (settingPrefab || tool != _defaultToolSystem)
			{
				return;
			}

			// The tool went back to default: Escape, a right-click cancel, or a
			// finished placement, and this handler cannot tell them apart —
			// Escape is consumed by the game's native input layer and never
			// reaches the DOM.
			//
			// For the legacy panel a cancel closes it, which is the only close
			// Escape can reach there.
			//
			// The lens used to need excepting here, because that menu is STILL
			// SELECTED on the toolbar and the game drew its own asset grid the
			// instant we vacated — "Escape swapped my menu for the old one",
			// and the same after every placement, which is why the catalog had
			// to learn to restore its scroll position at all. Mounted in the
			// game's own slot it no longer reads this binding, so it holds still
			// without being told to.
			//
			// Still deliberately NOT CloseLens, and still not touching the
			// selection. A previous attempt released it here and, because this
			// branch fires on every return to default, the menu was gone long
			// before the player pressed Escape — so the game's Escape chain found
			// nothing to close and opened the pause menu instead. Escape pausing
			// the game mid-build is worse than the defect it fixed.
			SetLensMenuOpen(false);
		}
	}
}
