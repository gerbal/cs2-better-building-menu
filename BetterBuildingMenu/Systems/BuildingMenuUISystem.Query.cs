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
		/// The empty string is All, every category in this menu. Vanilla has no such tab, but the
		/// asset menu can show a whole menu at once.
		/// </remarks>
		private void SetAssetMenuCategory(string category) => ApplyTabPick(_assetMenu.SelectCategory(category, ArmedEntryId()));

		/// <summary>
		/// Narrows the menu to one branch of its service's development tree.
		/// </summary>
		/// <remarks>
		/// The strip's fallback axis. Single-select, like the category and
		/// progression tabs beside it — the strip asks one question per segment.
		/// </remarks>
		private void SetAssetMenuStripTab(string tab) => ApplyTabPick(_assetMenu.SelectStripTab(tab, ArmedEntryId()));

		/// <summary>Narrows the education menu to one school tier, in the tab that holds the levels.</summary>
		private void SetAssetMenuSchoolTier(int tier) => ApplyTabPick(_assetMenu.SelectSchoolTier(tier, _tierParent, ArmedEntryId()));

		/// <summary>A tab, strip tab or school tier the player picks: the pick logger counts it, then it applies, its list starting at the armed building.</summary>
		/// <remarks>Each of the three triggers is a click in the tab row, so each counts.</remarks>
		private void ApplyTabPick(AssetMenuState next)
		{
			_placementWatch.TabSwitched();
			Apply(next);
		}

		/// <summary>The scope bindings, from the one state that owns them.</summary>
		private void PublishScope()
		{
			_AssetMenuCategoriesBinding.Value = _indexer.Index.GetMenuCategories(_assetMenu.Menu).ToArray();
			_AssetMenuBinding.Value = _assetMenu.Menu;
			_AssetMenusBinding.Value = _indexer.Index.Menus.AssetMenus().ToArray();
			_AssetMenuCategoryBinding.Value = _assetMenu.Category;
			_AssetMenuSchoolTierBinding.Value = _assetMenu.SchoolTier;
			_AssetMenuStripTabBinding.Value = _assetMenu.Query.StripTabs?.ToArray() ?? Array.Empty<string>();
			_CurrentSearch.Value = _assetMenu.SearchText;
		}

		/// <summary>
		/// One trigger's effect: the transition, the bindings that mirror it, the
		/// refresh. A transition that changed nothing (reference-equal) costs
		/// nothing.
		/// </summary>
		private void Apply(AssetMenuState next, bool navigation = false)
		{
			if (ReferenceEquals(next, _assetMenu))
			{
				return;
			}

			_assetMenu = next;
			PublishScope();

			if (navigation)
			{
				RefreshAssetMenuNavigation();
			}

			RefreshBuildingCatalog();
		}

		/// <summary>
		/// Widens a search that found nothing here to the whole catalog.
		/// </summary>
		private void SearchEverything()
		{
			_assetMenu = _assetMenu.ClearMenuScope();
			PublishScope();

			RefreshAssetMenu();
		}

		/// <summary>A sort pick, which the open menu keeps for this session.</summary>
		private void SetBuildingCatalogSortColumn(string column)
		{
			Apply(_assetMenu.SetSortColumn(column));
			_sessionSorts.Keep(_assetMenu);
		}

		/// <summary>
		/// Chooses the heading dimension, which is also the query's primary key, and keeps it as the open
		/// menu's own, saved once; the menu's default takes its own pick away.
		/// </summary>
		/// <remarks>
		/// The window shrinks back to the base chunk because grouping reorders the whole result.
		/// Returns early when nothing changed. A change drops the open's anchor, so only the group
		/// list's pick sends it; a menu open brings the menu's own back through OpenMenu. While a query
		/// is typed the groups wait and the list lights None, so a pick then is ignored rather than kept
		/// as the menu's own. The binding takes the pick before this runs and no refresh follows, so the
		/// page's None goes back to it.
		/// </remarks>
		private void SetBuildingCatalogGroupBy(string groupBy)
		{
			if (!string.IsNullOrWhiteSpace(_assetMenu.Query.SearchText))
			{
				_BuildingCatalogGroupBy.Value = BuildingCatalogGrouping.None;
				return;
			}

			var kept = MenuPicks.WithGroup(Mod.Settings.MenuGroups, _assetMenu.Menu, BuildingCatalogGrouping.IsDimension(groupBy) ? groupBy.Trim() : MenuPicks.None, _menuDefaultGroup);

			if (_assetMenu.Menu.Length > 0 && !string.Equals(kept, Mod.Settings.MenuGroups, StringComparison.Ordinal))
			{
				Mod.Settings.MenuGroups = kept;
				Mod.Settings.ApplyAndSave();
			}

			Apply(_assetMenu.SetGroupBy(groupBy));
		}

		/// <remarks>Same idempotence guard as the group-by above, and kept per menu as the column is.</remarks>
		private void SetBuildingCatalogSortDescending(bool descending)
		{
			Apply(_assetMenu.SetDescending(descending));
			_sessionSorts.Keep(_assetMenu);
		}

		/// <summary>
		/// Grows the window to the limit the UI asked for, by one step at most, keeping the
		/// offset at zero. A repeated request changes nothing; see LoadMoreTo.
		/// </summary>
		/// <remarks>
		/// The window is owned here rather than accumulated on the client, because placing a
		/// building unmounts the asset menu. A bigger Limit over the same predicates returns a longer
		/// prefix of the same order, so the rows on screen keep their identity.
		/// </remarks>
		private void LoadMoreBuildingCatalog(int requestedLimit) => Apply(_assetMenu.LoadMoreTo(requestedLimit));

		/// <summary>How many buildings one screen of the drawn body holds: the window reaches past it.</summary>
		/// <remarks>A page only for another window: the same rows again would cost a projection for nothing.</remarks>
		private void SetCatalogScreen(int slots)
		{
			var next = _assetMenu.SetScreenSlots(slots);

			if (next.ServesAnotherWindow(_assetMenu, _BuildingCatalogBinding.Value?.AnchorIndex ?? -1))
			{
				Apply(next);
				return;
			}

			// The same rows: the screen is kept for the next start, and no page is built.
			_assetMenu = next;
		}

		/// <summary>A press on the Locked label: the locked rows leave the window, or come back, the list staying where it is.</summary>
		private void SetCatalogSectionCollapsed(string id, bool collapsed) => Apply(_assetMenu.CollapseSection(id, collapsed));

		/// <summary>Up or Down in the search field: Enter's target a row that can be placed further down, or up.</summary>
		private void MoveEnterTarget(int direction) => Apply(_assetMenu.MoveEnterTarget(direction));

		private void ToggleAssetMenuFacet(string facetId, string optionId) => Apply(_assetMenu.ToggleFacet(facetId, optionId));

		private void ClearAssetMenuFilters() => Apply(_assetMenu.ClearFilters());

		private void SetBuildingCatalogMetricRange(string metricId, string minText, string maxText) =>
			Apply(_assetMenu.SetMetricRange(metricId, minText, maxText));

		private void ClearBuildingCatalogMetricRanges() => Apply(_assetMenu.ClearMetricRanges());

		private void SearchChanged(string text)
		{
			var next = _assetMenu.Search(text, ArmedEntryId());

			if (ReferenceEquals(next, _assetMenu))
			{
				return;
			}

			// A typed search clears the tab and the level, and clearing it brings them back, so the tab row
			// is told as the field is.
			_assetMenu = next;
			PublishScope();
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
