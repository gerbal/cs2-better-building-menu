using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.UIBinding;
using BetterBuildingMenu.Utilities;
using Game.Prefabs;
using Game.SceneFlow;
using Game.Tools;
using Game.UI;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

using Unity.Entities;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
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
			// Per-stage cost, for the breakdown on the log line. A refresh used
			// to be one number, which said that it was slow and nothing about
			// where; cm-jjlv.7 exists to move the where.
			var stage = System.Diagnostics.Stopwatch.StartNew();
			int Lap() { var ms = (int)stage.ElapsedMilliseconds; stage.Restart(); return ms; }

			// Both empty, always. These carried BuildingMenuUtil's own category into
			// the query, but only while the lens was off — and the lens is never
			// off now, so the branch that filled them is gone with the latch.
			// The lens states its own scope through UiMenu/UiCategory below.
			// The scope, the search and every metric bound fold into the query here,
			// and the window resets if a predicate moved. See BuildingCatalogLensState.Compose.
			_lens = _lens.Compose();

			stage.Restart();
			// One view, built once; every publish below reads it. See CatalogView.
			var menu = _lens.Query.UiMenu;
			var menuHasCategories = PrefabIndexingSystem.GetMenuCategories(string.IsNullOrEmpty(menu) ? null : menu).Count > 0;
			var view = _buildingCatalogAdapter.Build(
				_lens.Query,
				built => BuildingCatalogGrouping.Effective(
					_lens.Query.GroupBy, menuHasCategories, built.StripAxis, VanillaMenus.IsEducation(menu), built.GroupDimensions));
			BuildingCatalogPage page = view.Page;

			// A search that matches nothing in the current section reads as
			// "this building does not exist" when it usually means "not here".
			// Only computed when the scoped result is actually empty, so the
			// extra pass costs nothing in the common case.
			// With auto-widen on, a scoped miss drops the scope itself rather
			// than asking. Cannot recurse: SearchEverything calls back into
			// this method, and by then the section is AllBuildings so the
			// branch fails its own guard.
			// Fires for every scoped menu now. It used to read the section, which
			// only the preset menus set — so Electricity widened an empty search
			// and Roads, routed through the tree, did not. Same gesture, one rule.
			if (Mod.Settings.AutoWidenSearch
				&& page.TotalCount == 0
				&& !string.IsNullOrWhiteSpace(_lens.Query.SearchText)
				&& _lens.Query.IsScopedToMenu)
			{
				SearchEverything();
				return;
			}

			_BuildingCatalogMatchesElsewhere.Value =
				page.TotalCount == 0 && !string.IsNullOrWhiteSpace(_lens.Query.SearchText)
					? _buildingCatalogAdapter.Build(_lens.Query with
					{
						UiMenu = string.Empty,
						Offset = 0,
					}).Page.TotalCount
					: 0;
			var pageMs = Lap();
			_BuildingCatalogBinding.Value = page with
			{
				Status = BuildingCatalogLensState.GetPageStatus(BuildingMenuUtil.IsReady, page.TotalCount),
			};
			// Publish the order the query actually ran with, so the header can
			// never disagree with the rows beneath it.
			_BuildingCatalogSortColumn.Value = _lens.Query.EffectiveSortColumn;
			_BuildingCatalogSortDescending.Value = _lens.Query.Descending;
			_BuildingCatalogGroupBy.Value = view.EffectiveGroupBy;
			_BuildingLensGroupDimensions.Value = view.GroupDimensions;
			_BuildingCatalogMetricRanges.Value = _lens.MetricRanges;
			// Recomputed with the catalog so the bounds follow the menu. They come
			// from InScope, which drops the metric selections, so narrowing a range
			// cannot shrink the bounds it was typed against.
			_BuildingCatalogMetricBounds.Value = view.MetricBounds;
			var boundsMs = Lap();
			_BuildingLensFacets.Value = view.FacetState;
			var facetsMs = Lap();
			// Alongside the facets and for the same reason: the strip is a filter
			// too, and a tab that cannot say how much is behind it is the same
			// dead end as a facet option that cannot.
			_BuildingLensMenuCategoryCounts.Value = view.MenuCategoryCounts.ToArray();
			var countsMs = Lap();
			// The axis is resolved BEFORE the tabs and stored, because the query
			// carries it: the predicate has to match tabs against the same axis
			// the tabs were counted on.
			_buildingLensStripAxis = view.StripAxis;
			_BuildingLensStripAxisBinding.Value = _buildingLensStripAxis;
			var axisMs = Lap();
			// The rail can change this behind the row's back, so republish it
			// with the rest of the state rather than only when a tab is clicked.
			_BuildingLensStripTabBinding.Value =
				_lens.Query.StripTabs?.ToArray() ?? Array.Empty<string>();
			_BuildingLensStripTabs.Value = view.StripTabs.ToArray();
			var tabsMs = Lap();
			// One binding, a list. It replaced a (category, tabs) pair that could
			// only ever describe ONE expanded category — enough for the
			// development tree, which picks the largest and stops, and not
			// enough for zones, where three families divide into tiers at once.
			_BuildingLensExpandedCategories.Value = view.ExpandedCategories.ToArray();
			var expandedMs = Lap();
			_BuildingLensMenuSchoolTierCounts.Value = view.SchoolTierCounts.ToArray();
			var tiersMs = Lap();
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
				+ $"proj={_buildingCatalogAdapter.LastProjectionMs}ms({(_buildingCatalogAdapter.LastProjectionWasHit ? "hit" : "miss")}) "
				+ $"page={pageMs} bounds={boundsMs} facets={facetsMs} counts={countsMs} axis={axisMs} tabs={tabsMs} expanded={expandedMs} tiers={tiersMs} "
				+ $"menu='{_lens.Query.UiMenu}' total={page.TotalCount} from={caller}");
		}

		/// <summary>
		/// Re-projects the compared ids from the live prefab index and drops any
		/// that no longer resolve, so a stale shortlist cannot outlive the
		/// buildings it names.
		/// </summary>

		private void RefreshBuildingLensNavigation()
		{
			// Dense by index: entry N is milestone N's name. Every asset ships a
			// bare milestone index and the UI reads the name out of here, so the
			// ~20 names are resolved once per index pass instead of once per
			// asset on every unlock-triggered re-index.
			_BuildingLensMilestonesBinding.Value = PrefabIndexingSystem.GetMilestoneNames();

		}

		internal void TryActivatePrefabTool(int id)
		{
			var prefabBase = BuildingMenuUtil.GetPrefabBase(id);
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

		/// <summary>Asks for a refresh 250ms after the last call, on the main thread.</summary>
		/// <remarks>
		/// Kept under this name because OptionsUISystem declares it abstract
		/// and the options and picker systems override it. It used to start a
		/// worker that ran the legacy fuzzy search across the whole index and
		/// then raised a flag for OnUpdate; the lens never read that result
		/// (its own predicate is BuildingCatalogQueryEngine's Contains), so the
		/// worker cost 2.7s per precise search for nothing. cm-yfd5.
		/// </remarks>
		internal void TriggerSearch()
		{
			_IsSearchLoading.Value = true;
			_searchDebounce.Schedule(SearchClock.Elapsed);
		}

		internal void ClearSearch()
		{
			_ClearSearchBar.Value = true;
			_searchDebounce.Cancel();
			_IsSearchLoading.Value = false;
			_lens = _lens.Search(string.Empty);
			_CurrentSearch.Value = string.Empty;
			RefreshBuildingCatalog();
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
