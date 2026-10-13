using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Utilities;
using System;
using System.Linq;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		/// <summary>
		/// Re-publish the asset menu after something changed what it should show.
		/// </summary>
		/// <remarks>
		/// The index hands its entries over in name order, so that order decides the ties
		/// the catalog's own sort leaves open.
		/// </remarks>
		internal void RefreshAssetMenu()
		{
			RefreshAssetMenuNavigation();
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
			var menu = _assetMenu.Menu;
			var view = _buildingCatalogAdapter.Build(
				source,
				_assetMenu.Query,
				_toolbarSelection,
				built => built.GroupFor(_assetMenu.Query.GroupBy, _assetMenu.Query.SearchText));
			BuildingCatalogPage page = view.Page;
			// What a GROUP pick is compared with: the menu's own grouping, which takes a menu's own pick away.
			_menuDefaultGroup = view.DefaultGroupBy;

			// A search that matches nothing in the current section reads as "this building does
			// not exist" when it usually means "not here". With auto-widen on a scoped miss drops
			// the scope instead of asking; it cannot recurse, because the retry is unscoped. Not
			// on an index still being built: during a load everything misses, and the scope it
			// dropped would stay dropped once the city's pass lands.
			if (Mod.Settings.AutoWidenSearch
				&& source.Index.IsReady
				&& page.TotalCount == 0
				&& !string.IsNullOrWhiteSpace(_assetMenu.Query.SearchText)
				&& _assetMenu.Query.IsScopedToMenu)
			{
				SearchEverything();
				return;
			}

			// Counted over the query "Search everywhere" runs, so the notice promises what
			// the button delivers.
			_BuildingCatalogMatchesElsewhere.Value =
				page.TotalCount == 0 && !string.IsNullOrWhiteSpace(_assetMenu.Query.SearchText)
					? _buildingCatalogAdapter.Build(source, _assetMenu.EverywhereQuery(), _toolbarSelection).Page.TotalCount
					: 0;
			var pageMs = Lap();
			// The window the page served is the one the state keeps, so Load more grows from the anchored row.
			_assetMenu = _assetMenu.CoverAnchor(page.AnchorIndex);
			// And the step Enter's target takes, which stops at the list's ends.
			_assetMenu = _assetMenu.KeepEnterStep(page.EnterStep);
			_BuildingCatalogBinding.Value = page with
			{
				Status = AssetMenuState.GetPageStatus(source.Index.IsReady, page.TotalCount),
				// The UI puts the list in place once per start. See docs/design-notes.md, "Opening on the building's tab".
				ListStart = _assetMenu.ListStart,
			};
			// Publish the order the query actually ran with, so the header can
			// never disagree with the rows beneath it.
			_BuildingCatalogSortColumn.Value = _assetMenu.Query.EffectiveSortColumn;
			_BuildingCatalogSortDescending.Value = _assetMenu.Query.Descending;
			_BuildingCatalogGroupBy.Value = view.EffectiveGroupBy;
			_AssetMenuGroupDimensions.Value = view.GroupDimensions;
			_BuildingCatalogMetricRanges.Value = _assetMenu.MetricRanges;
			// Recomputed with the catalog so the bounds follow the menu. They come
			// from InScope, which drops the metric selections, so narrowing a range
			// cannot shrink the bounds it was typed against.
			_BuildingCatalogMetricBounds.Value = view.MetricBounds;
			var boundsMs = Lap();
			_AssetMenuFacets.Value = view.FacetState;
			var facetsMs = Lap();
			// Alongside the facets and for the same reason: the strip is a filter
			// too, and a tab that cannot say how much is behind it is the same
			// dead end as a facet option that cannot.
			_AssetMenuCategoryCounts.Value = view.MenuCategoryCounts.ToArray();
			_AssetMenuAllCount.Value = view.AllCount;
			var countsMs = Lap();
			// Resolved ahead of the tabs counted on it, so the log times the two apart.
			_ = view.StripAxis;
			var axisMs = Lap();
			// The rail can change this behind the row's back, so republish it
			// with the rest of the state rather than only when a tab is clicked.
			_AssetMenuStripTabBinding.Value =
				_assetMenu.Query.StripTabs?.ToArray() ?? Array.Empty<string>();
			_AssetMenuStripTabs.Value = view.StripTabs.ToArray();
			var tabsMs = Lap();
			// One binding, a list: zones divide three families into tiers at once, which a
			// single (category, tabs) pair could not describe.
			_AssetMenuExpandedCategories.Value = view.ExpandedCategories.ToArray();
			var expandedMs = Lap();
			_AssetMenuTierBracket.Value = view.TierBracket;
			_tierParent = view.TierBracket.ParentCategory;
			var tiersMs = Lap();
			// Read before the shares' own builds add theirs: the line below times this refresh's projection.
			var projectionMs = _buildingCatalogAdapter.LastProjectionMs;
			var projectionWasHit = _buildingCatalogAdapter.LastProjectionWasHit;
			var sharesCounted = PublishMenuShares(source);
			var sharesMs = Lap();
			refreshTimer.Stop();
			// Every refresh, and named by its caller: one line per user action is the only way
			// a redundant refresh is visible at all. At Debug, which a development build turns
			// on (see Mod.Log) and a release leaves off, where it would be a line in the
			// player's log for every search, filter and menu opened.
			if (Mod.Log.isLevelEnabled(Colossal.Logging.Level.Debug))
			{
				Mod.Log.Debug($"[ASSET-MENU-REFRESH] {(int)refreshTimer.ElapsedMilliseconds}ms "
					+ $"proj={projectionMs}ms({(projectionWasHit ? "hit" : "miss")}) "
					+ $"page={pageMs} bounds={boundsMs} facets={facetsMs} counts={countsMs} axis={axisMs} tabs={tabsMs} expanded={expandedMs} tiers={tiersMs} shares={sharesMs} "
					+ $"menu='{_assetMenu.Menu}' total={page.TotalCount} from={caller}");

				// On a line of its own, as it runs once per index generation: its cost shows apart from the refresh's.
				if (sharesCounted)
				{
					Mod.Log.Debug($"[ASSET-MENU-SHARES] {sharesMs}ms menu='{_assetMenu.Menu}' generation={source.Generation}");
				}
			}
		}

		/// <summary>What the look's Auto rule reads of the open menu, counted once per index generation; true when it counted.</summary>
		/// <remarks>
		/// Over the whole menu, with nothing of the toolbar's row, a filter or a search, so a filter never
		/// changes a body; with the toolbar's row untouched that is this refresh's own snapshot, cached.
		/// Only the open menu: a unique placed or an unlock moves the generation, and Auto reads no other.
		/// A count that throws is tried again next refresh. See docs/design-notes.md, "The bodies".
		/// </remarks>
		private bool PublishMenuShares(CatalogSource source)
		{
			try
			{
				if (!_menuShares.Count(_assetMenu.Menu, source.Generation, () => _buildingCatalogAdapter.Build(source, new BuildingCatalogQuery(UiMenu: _assetMenu.Menu), VanillaToolbarSelection.None).MenuSet))
				{
					return false;
				}
			}
			catch (Exception e)
			{
				if (!_menuSharesWarned)
				{
					_menuSharesWarned = true;
					Mod.Log.Warn(e, $"Could not count the share of '{_assetMenu.Menu}'; its body is the list until a count succeeds");
				}

				return false;
			}

			_MenuShares.Value = _menuShares.Shares;

			return true;
		}

		/// <summary>Publishes the milestone names the UI labels locked assets with.</summary>
		private void RefreshAssetMenuNavigation()
		{
			// Dense by index: entry N is milestone N's name. Every asset ships a bare milestone
			// index and the UI reads the name out of here, so the names resolve once per index
			// pass rather than once per asset.
			_AssetMenuMilestonesBinding.Value = _indexer.Index.Progression.MilestoneNames();

		}
	}
}
