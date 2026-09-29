using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Utilities;
using System;
using System.Linq;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		/// <summary>
		/// Re-publish the lens after something changed what it should show.
		/// </summary>
		/// <remarks>
		/// The index hands its entries over in name order, so that order decides the ties
		/// the catalog's own sort leaves open.
		/// </remarks>
		internal void RefreshLens()
		{
			RefreshBuildingLensNavigation();
			RefreshBuildingCatalog();
		}

		private void RefreshBuildingCatalog([System.Runtime.CompilerServices.CallerMemberName] string caller = "")
		{
			// The already-built answers belong to the city, not the index, and they can
			// change without an event reaching us: a mod that switches the game's unique
			// tracker off raises none. Rescanned here, before the snapshots below are
			// keyed. See PrefabIndexingSystem.SyncPlacedUniques.
			_indexer.SyncPlacedUniques();
			// After the rescan, which can itself bump the generation: this publish shows it,
			// and every Build below reads this one source.
			var source = _indexer.Source;
			_indexWatch.Published(source.Generation);

			// Only resets the projection timing counters. The snapshots themselves live across
			// refreshes and are dropped when the indexer's Generation moves; see
			// BuildingCatalogAdapter._snapshots.
			_buildingCatalogAdapter.BeginRefresh();

			var refreshTimer = System.Diagnostics.Stopwatch.StartNew();
			// Per-stage cost, for the breakdown on the log line below.
			var stage = System.Diagnostics.Stopwatch.StartNew();
			int Lap() { var ms = (int)stage.ElapsedMilliseconds; stage.Restart(); return ms; }

			// One view, built once; every publish below reads it. See CatalogView.
			var menu = _lens.Menu;
			var menuHasCategories = source.Index.GetMenuCategories(string.IsNullOrEmpty(menu) ? null : menu).Count > 0;
			var view = _buildingCatalogAdapter.Build(
				source,
				_lens.Query,
				_toolbarSelection,
				built => BuildingCatalogGrouping.Effective(
					_lens.Query.GroupBy, menuHasCategories, built.StripAxis, VanillaMenus.IsEducation(menu), built.GroupDimensions));
			BuildingCatalogPage page = view.Page;

			// A search that matches nothing in the current section reads as "this building does
			// not exist" when it usually means "not here". With auto-widen on a scoped miss drops
			// the scope instead of asking; it cannot recurse, because the retry is unscoped. Not
			// on an index still being built: during a load everything misses, and the scope it
			// dropped would stay dropped once the city's pass lands.
			if (Mod.Settings.AutoWidenSearch
				&& source.Index.IsReady
				&& page.TotalCount == 0
				&& !string.IsNullOrWhiteSpace(_lens.Query.SearchText)
				&& _lens.Query.IsScopedToMenu)
			{
				SearchEverything();
				return;
			}

			// Counted over the query "Search everywhere" runs, so the notice promises what
			// the button delivers.
			_BuildingCatalogMatchesElsewhere.Value =
				page.TotalCount == 0 && !string.IsNullOrWhiteSpace(_lens.Query.SearchText)
					? _buildingCatalogAdapter.Build(source, _lens.EverywhereQuery(), _toolbarSelection).Page.TotalCount
					: 0;
			var pageMs = Lap();
			_BuildingCatalogBinding.Value = page with
			{
				Status = BuildingCatalogLensState.GetPageStatus(source.Index.IsReady, page.TotalCount),
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
			// Resolved ahead of the tabs counted on it, so the log times the two apart.
			_ = view.StripAxis;
			var axisMs = Lap();
			// The rail can change this behind the row's back, so republish it
			// with the rest of the state rather than only when a tab is clicked.
			_BuildingLensStripTabBinding.Value =
				_lens.Query.StripTabs?.ToArray() ?? Array.Empty<string>();
			_BuildingLensStripTabs.Value = view.StripTabs.ToArray();
			var tabsMs = Lap();
			// One binding, a list: zones divide three families into tiers at once, which a
			// single (category, tabs) pair could not describe.
			_BuildingLensExpandedCategories.Value = view.ExpandedCategories.ToArray();
			var expandedMs = Lap();
			_BuildingLensMenuSchoolTierCounts.Value = view.SchoolTierCounts.ToArray();
			var tiersMs = Lap();
			refreshTimer.Stop();
			// Every refresh, and named by its caller: one line per user action is the only way
			// a redundant refresh is visible at all. At Debug, which a development build turns
			// on (see Mod.Log) and a release leaves off, where it would be a line in the
			// player's log for every search, filter and menu opened.
			if (Mod.Log.isLevelEnabled(Colossal.Logging.Level.Debug))
			{
				Mod.Log.Debug($"[LENS-REFRESH] {(int)refreshTimer.ElapsedMilliseconds}ms "
					+ $"proj={_buildingCatalogAdapter.LastProjectionMs}ms({(_buildingCatalogAdapter.LastProjectionWasHit ? "hit" : "miss")}) "
					+ $"page={pageMs} bounds={boundsMs} facets={facetsMs} counts={countsMs} axis={axisMs} tabs={tabsMs} expanded={expandedMs} tiers={tiersMs} "
					+ $"menu='{_lens.Menu}' total={page.TotalCount} from={caller}");
			}
		}

		/// <summary>Publishes the milestone names the UI labels locked assets with.</summary>
		private void RefreshBuildingLensNavigation()
		{
			// Dense by index: entry N is milestone N's name. Every asset ships a bare milestone
			// index and the UI reads the name out of here, so the names resolve once per index
			// pass rather than once per asset.
			_BuildingLensMilestonesBinding.Value = _indexer.Index.Progression.MilestoneNames();

		}
	}
}
