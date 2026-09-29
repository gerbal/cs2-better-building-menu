using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Utilities;
using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		/// <summary>
		/// Picks one of the scoped menu's category tabs, or all of them.
		/// </summary>
		/// <remarks>
		/// The empty string is "every category in this menu", the state a menu opens in.
		/// Vanilla has no such tab, but the lens can show a whole menu at once.
		/// </remarks>
		private void SetBuildingLensMenuCategory(string category) => Apply(_lens.SelectCategory(category));

		/// <summary>
		/// Narrows the menu to one branch of its service's development tree.
		/// </summary>
		/// <remarks>
		/// The strip's fallback axis. Single-select, like the category and
		/// progression tabs beside it — the strip asks one question per segment.
		/// </remarks>
		private void SetBuildingLensStripTab(string tab) => Apply(_lens.SelectStripTab(tab));

		/// <summary>Narrows the education menu to one school tier.</summary>
		private void SetBuildingLensMenuSchoolTier(int tier) => Apply(_lens.SelectSchoolTier(tier));

		/// <summary>
		/// Scopes the lens to a vanilla menu chosen from the filters.
		/// </summary>
		/// <remarks>
		/// The same state a bottom-bar icon sets, reached the other way, so the view the menu
		/// chip names stays reachable without the shortcut. Deliberately not VanillaMenuSelected:
		/// that one answers the game, this one answers a player already inside the lens.
		/// </remarks>
		private void SetBuildingLensMenu(string menuName) => Apply(_lens.SelectMenu(menuName), navigation: true);

		/// <summary>
		/// Drops the vanilla-menu scope and shows the whole catalog.
		/// </summary>
		/// <remarks>
		/// The bottom-bar icons are shortcuts to a preconfigured view, not a box the player is
		/// locked inside. The facets deliberately survive: this clears the scope, not the
		/// narrowing chosen within it, so one × does one job.
		/// </remarks>
		private void ClearBuildingLensMenuScope() => Apply(_lens.ClearMenuScope(), navigation: true);

		/// <summary>The scope bindings, from the one state that owns them.</summary>
		private void PublishScope()
		{
			_BuildingLensMenuCategoriesBinding.Value = _indexer.Index.GetMenuCategories(
				string.IsNullOrEmpty(_lens.Menu) ? null : _lens.Menu).ToArray();
			_BuildingLensMenuBinding.Value = _lens.Menu;
			_BuildingLensMenusBinding.Value = _indexer.Index.Menus.AssetMenus().ToArray();
			_BuildingLensMenuCategoryBinding.Value = _lens.Category;
			_BuildingLensMenuSchoolTierBinding.Value = _lens.SchoolTier;
			_BuildingLensStripTabBinding.Value = _lens.Query.StripTabs?.ToArray() ?? Array.Empty<string>();
			_CurrentSearch.Value = _lens.SearchText;
		}

		/// <summary>
		/// One trigger's effect: the transition, the bindings that mirror it, the
		/// refresh. A transition that changed nothing (reference-equal) costs
		/// nothing.
		/// </summary>
		private void Apply(BuildingCatalogLensState next, bool navigation = false)
		{
			if (ReferenceEquals(next, _lens))
			{
				return;
			}

			_lens = next;
			PublishScope();

			if (navigation)
			{
				RefreshBuildingLensNavigation();
			}

			RefreshBuildingCatalog();
		}

		/// <summary>
		/// Widens a search that found nothing here to the whole catalog.
		/// </summary>
		private void SearchEverything()
		{
			_lens = _lens.ClearMenuScope();
			PublishScope();

			RefreshLens();
		}

		private void SetBuildingCatalogSortColumn(string column) => Apply(_lens.SetSortColumn(column));

		/// <summary>
		/// Chooses the heading dimension, which is also the query's primary key.
		/// </summary>
		/// <remarks>
		/// The window shrinks back to the base chunk because grouping reorders the whole result.
		/// Returns early when nothing changed: the UI derives this value from the menu, so it
		/// re-sends it on every menu open.
		/// </remarks>
		private void SetBuildingCatalogGroupBy(string groupBy) => Apply(_lens.SetGroupBy(groupBy));

		/// <remarks>Same idempotence guard as the group-by above.</remarks>
		private void SetBuildingCatalogSortDescending(bool descending) => Apply(_lens.SetDescending(descending));

		/// <summary>
		/// Grows the window to the limit the UI asked for, by one step at most, keeping the
		/// offset at zero. A repeated request changes nothing; see LoadMoreTo.
		/// </summary>
		/// <remarks>
		/// The window is owned here rather than accumulated on the client, because placing a
		/// building unmounts the panel. A bigger Limit over the same predicates returns a longer
		/// prefix of the same order, so the rows on screen keep their identity.
		/// </remarks>
		private void LoadMoreBuildingCatalog(int requestedLimit) => Apply(_lens.LoadMoreTo(requestedLimit));

		private void ToggleBuildingLensFacet(string facetId, string optionId) => Apply(_lens.ToggleFacet(facetId, optionId));

		/// <summary>
		/// Puts a menu back the way it opens.
		/// </summary>
		/// <remarks>
		/// Clear drops only the facets; a menu also accumulates a strip tab, a school level, a
		/// search and a sort, and this is the one gesture back to a known state. Grouping and
		/// view mode are UI-side choices, so the pane clears its own alongside this.
		/// </remarks>
		private void ResetBuildingLensMenu() => Apply(_lens.ResetMenu());

		private void ClearBuildingLensFilters() => Apply(_lens.ClearFilters());

		private void SetBuildingCatalogMetricRange(string metricId, string minText, string maxText) =>
			Apply(_lens.SetMetricRange(metricId, minText, maxText));

		private void ClearBuildingCatalogMetricRanges() => Apply(_lens.ClearMetricRanges());

		private void SearchChanged(string text)
		{
			var next = _lens.Search(text);

			if (ReferenceEquals(next, _lens))
			{
				return;
			}

			_lens = next;
			_CurrentSearch.Value = _lens.SearchText;
			_CurrentSearch.ForceUpdate();
			TriggerSearch();
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

		/// <summary>
		/// Takes the game's own toolbar filter row and applies it to the catalog.
		/// </summary>
		/// <remarks>
		/// The rule is <see cref="VanillaToolbarFilter"/>, transcribed from ToolbarUISystem and
		/// tested against it. All this does is deliver the selection and ask for a redraw.
		/// </remarks>
		private void SetVanillaToolbarSelection(string themes, string packs, bool vanillaSelected, bool modsSelected)
		{
			_toolbarSelection = new VanillaToolbarSelection(
				ParseEntityIndices(themes),
				ParseEntityIndices(packs),
				vanillaSelected,
				modsSelected);

			RefreshBuildingCatalog();
		}

		/// <summary>
		/// "11,22" to [11, 22]. Empty and malformed both mean "nothing selected".
		/// </summary>
		/// <remarks>
		/// Silently skipping a value that will not parse is deliberate: the
		/// alternative is throwing inside a UI trigger, and a filter that cannot
		/// read one entity index should narrow the menu rather than break it.
		/// </remarks>
		private static int[] ParseEntityIndices(string? joined)
		{
			if (joined?.Trim() is not { Length: > 0 })
			{
				return Array.Empty<int>();
			}

			var parts = joined.Split(',');
			var indices = new List<int>(parts.Length);

			foreach (var part in parts)
			{
				if (int.TryParse(part, out var index))
				{
					indices.Add(index);
				}
			}

			return indices.ToArray();
		}
	}
}
