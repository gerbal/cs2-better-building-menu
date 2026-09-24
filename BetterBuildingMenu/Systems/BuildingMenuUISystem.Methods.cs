using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Utilities;
using Colossal.Entities;
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
			var menuHasCategories = PrefabIndexingSystem.GetMenuCategories(source.Index, string.IsNullOrEmpty(menu) ? null : menu).Count > 0;
			var view = _buildingCatalogAdapter.Build(
				source,
				_lens.Query,
				_toolbarSelection,
				built => BuildingCatalogGrouping.Effective(
					_lens.Query.GroupBy, menuHasCategories, built.StripAxis, VanillaMenus.IsEducation(menu), built.GroupDimensions));
			BuildingCatalogPage page = view.Page;

			// A search that matches nothing in the current section reads as "this building does
			// not exist" when it usually means "not here". With auto-widen on a scoped miss drops
			// the scope instead of asking; it cannot recurse, because the retry is unscoped.
			if (Mod.Settings.AutoWidenSearch
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
			// a redundant refresh is visible at all. At Info in a development build, where that
			// is the point; at Debug in a release, where it is a line in the player's log for
			// every search, filter and menu opened.
#if DEBUG
			const bool logRefresh = true;
#else
			var logRefresh = Mod.Log.isLevelEnabled(Colossal.Logging.Level.Debug);
#endif
			if (logRefresh)
			{
				var line = $"[LENS-REFRESH] {(int)refreshTimer.ElapsedMilliseconds}ms "
					+ $"proj={_buildingCatalogAdapter.LastProjectionMs}ms({(_buildingCatalogAdapter.LastProjectionWasHit ? "hit" : "miss")}) "
					+ $"page={pageMs} bounds={boundsMs} facets={facetsMs} counts={countsMs} axis={axisMs} tabs={tabsMs} expanded={expandedMs} tiers={tiersMs} "
					+ $"menu='{_lens.Menu}' total={page.TotalCount} from={caller}";
#if DEBUG
				Mod.Log.Info(line);
#else
				Mod.Log.Debug(line);
#endif
			}
		}

		/// <summary>Publishes the milestone names the UI labels locked assets with.</summary>
		private void RefreshBuildingLensNavigation()
		{
			// Dense by index: entry N is milestone N's name. Every asset ships a bare milestone
			// index and the UI reads the name out of here, so the names resolve once per index
			// pass rather than once per asset.
			_BuildingLensMilestonesBinding.Value = PrefabIndexingSystem.GetMilestoneNames();

		}

		/// <summary>
		/// Re-publishes the extension picker's entries when the selection changes.
		/// </summary>
		/// <remarks>
		/// Polled rather than subscribed to SelectedInfoUISystem's event, because the index can
		/// change under a fixed selection too, so the generation is part of the key. The upgradable
		/// resolves as vanilla's UpgradeMenuUISystem does: an extension answers for its parent.
		/// </remarks>
		private void RefreshExtensionMenu()
		{
			var selected = _selectedInfoUISystem.selectedEntity;
			var upgradable = EntityManager.TryGetComponent<Game.Objects.Attached>(selected, out var attached)
				? attached.m_Parent
				: selected;

			if (upgradable == _extensionMenuFor && _indexer.Generation == _extensionMenuGeneration)
			{
				return;
			}

			_extensionMenuFor = upgradable;
			_extensionMenuGeneration = _indexer.Generation;

			if (upgradable == Entity.Null
				|| !EntityManager.TryGetComponent<PrefabRef>(upgradable, out var prefabRef)
				|| _indexer.Index.Get(prefabRef.m_Prefab.Index) is not { } building)
			{
				_BuildingExtensionMenu.Value = BuildingExtensionMenu.Empty;
				return;
			}

			PublishExtensionMenu(building, _indexer.Source);
		}

		// Its own method so the lookup's closure is allocated only on a rebuild, not on
		// every frame RefreshExtensionMenu polls and returns early.
		private void PublishExtensionMenu(PrefabIndex building, CatalogSource source)
		{
			_BuildingExtensionMenu.Value = BuildingExtensionMenu.Build(
				building.Name ?? building.PrefabName ?? string.Empty,
				// Prefab names, not the display names the hover card shows:
				// the UI joins these to vanilla's rows, which are keyed by
				// prefab.name.
				building.SupportedUpgradePrefabNames,
				prefabName => _buildingCatalogAdapter.EntryForPrefabName(source, prefabName));
		}

		internal void TryActivatePrefabTool(int id)
		{
			var prefabBase = _indexer.Index.GetPrefab(id);
			_interactionBoundary.TryActivatePrefab(
				id,
				prefabBase is not null,
				_toolSystem.activePrefab == prefabBase,
				// The boundary calls this only when the prefab exists, which the lambda cannot see.
				() => ActivatePrefabTool(
					id,
					prefabBase ?? throw new InvalidOperationException($"Prefab {id} was armed without existing.")));
		}

		private void ActivatePrefabTool(int id, PrefabBase prefabBase)
		{
			settingPrefab = true;
			_toolSystem.ActivatePrefabTool(prefabBase);
			_ActivePrefabId.Value = id;
			settingPrefab = false;
		}

		/// <summary>Asks for a refresh once typing settles, on the main thread.</summary>
		/// <remarks>
		/// Debounced rather than immediate: the search predicate runs inside the
		/// catalog refresh, so one refresh per keystroke would re-run the whole
		/// query on every character.
		/// </remarks>
		internal void TriggerSearch()
		{
			_IsSearchLoading.Value = true;
			_searchDebounce.Schedule(SearchClock.Elapsed);
		}

		private void OnPrefabChanged(PrefabBase prefab)
		{
			// A prefab we did not arm ourselves normally means the player picked something in
			// vanilla's own UI, and the polite answer is to get out of its way. The binding is
			// mirrored first: it is a fact about what the GAME has armed, not a record of who set it.
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

			// The Zone tool is deliberately not one of those. Picking a zone arms it, so vacating
			// here would close the zoning surface the instant it was used, and the still-selected
			// vanilla Zones menu would draw its own grid into the space.
			if (tool.toolID is "Zone Tool")
			{
				return;
			}

			if (settingPrefab || tool != _defaultToolSystem)
			{
				return;
			}

			// The tool went back to default: Escape, a right-click cancel, or a finished placement,
			// and this handler cannot tell them apart. Deliberately NOT CloseLens and deliberately
			// not touching the selection, or the game's Escape chain opens the pause menu instead.
			SetLensMenuOpen(false);
		}
	}
}
