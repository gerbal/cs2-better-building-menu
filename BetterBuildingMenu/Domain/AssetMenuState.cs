using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Everything the player has told the asset menu: where they are looking, what they
	/// typed, how the result is ordered, grouped and narrowed, and how much is shown.
	/// </summary>
	/// <remarks>
	/// One immutable record with one transition per trigger, so the asset menu's rules — a
	/// menu forgets its category, tab and tier; a tab and a category exclude each
	/// other — are stated once and testable without a game. A no-op returns <c>this</c>.
	/// Each fact is stored once, in <see cref="Query"/>, so the query is always the one
	/// to run; <see cref="SearchText"/> alone is kept beside it, untrimmed, for the box.
	/// </remarks>
	public sealed record AssetMenuState(
		BuildingCatalogQuery Query,
		string SearchText = "")
	{
		public const string Indexing = "indexing";
		public const string Ready = "ready";
		public const string Empty = "empty";

		/// <summary>Unscoped, unsearched, unfiltered: what the asset menu starts as.</summary>
		public static AssetMenuState Initial => new(new BuildingCatalogQuery());

		/// <summary>The game's menu the asset menu stands in for, or blank for the whole catalog.</summary>
		public string Menu => Query.UiMenu;

		/// <summary>
		/// The menu, while this is the view opening it shows: no category, strip tab or school
		/// tier. Empty otherwise, and with no menu.
		/// </summary>
		/// <remarks>
		/// Carried by the page as BuildingCatalogPage.Menu. A kept asset menu is shown in the
		/// frame its menu is reopened only when its page is exactly what that open shows; see
		/// SelectMenu, which drops the category, tab and tier.
		/// </remarks>
		public string OpeningMenu =>
			string.IsNullOrEmpty(Query.UiCategory) && Query.SchoolTier < 0 && (Query.StripTabs is null || Query.StripTabs.Count == 0)
				? Query.UiMenu
				: string.Empty;

		public string Category => Query.UiCategory;

		public int SchoolTier => Query.SchoolTier;

		/// <summary>The metric bounds in the query, as the drawer shows them.</summary>
		public BuildingCatalogMetricRangeState MetricRanges => BuildingCatalogMetricRangeState.FromQuery(Query);

		// --- Where the player is looking ------------------------------------

		/// <summary>The game's menu the asset menu stands in for. Blank clears the scope.</summary>
		public AssetMenuState SelectMenu(string? name)
		{
			if (name?.Trim() is not { Length: > 0 } trimmed)
			{
				return ClearMenuScope();
			}

			return InScope(Query with { UiMenu = trimmed, UiCategory = string.Empty, SchoolTier = -1, StripTabs = null });
		}

		/// <summary>No menu: the whole catalog, with category, tab and tier forgotten.</summary>
		public AssetMenuState ClearMenuScope() =>
			InScope(Query with { UiMenu = string.Empty, UiCategory = string.Empty, SchoolTier = -1, StripTabs = null });

		/// <summary>One of the menu's categories. Excludes a strip tab and a school tier.</summary>
		public AssetMenuState SelectCategory(string? id) =>
			InScope(Query with { UiCategory = id ?? string.Empty, SchoolTier = -1, StripTabs = null });

		/// <summary>One strip tab. Excludes a category; blank clears the tabs.</summary>
		public AssetMenuState SelectStripTab(string? tab) =>
			InScope(Query with
			{
				UiCategory = string.Empty,
				StripTabs = tab is { Length: > 0 } ? new[] { tab } : null,
			});

		/// <summary>One school tier (1–4); anything below zero is "all". Excludes a category.</summary>
		public AssetMenuState SelectSchoolTier(int tier) =>
			InScope(Query with { UiCategory = string.Empty, SchoolTier = tier < 0 ? -1 : tier });

		/// <summary>The query moved to another tab, carrying the grouping the player left there.</summary>
		private AssetMenuState InScope(BuildingCatalogQuery scoped)
		{
			var pick = Picks.TryGetValue(TabKey(scoped), out var kept) ? kept : default;

			return this with
			{
				Query = ResetWindow(scoped with { GroupBy = pick.GroupBy ?? string.Empty, ThenBy = pick.ThenBy ?? string.Empty }),
			};
		}

		// --- Order, grouping, window ------------------------------------------

		public AssetMenuState SetSortColumn(string? column)
		{
			if (column?.Trim() is not { Length: > 0 })
			{
				return this;
			}

			return this with { Query = ResetWindow(Query with { SortColumn = column }) };
		}

		public AssetMenuState SetDescending(bool descending) =>
			Query.Descending == descending ? this : this with { Query = ResetWindow(Query with { Descending = descending }) };

		/// <summary>The player's grouping choice for this tab; empty means the tab's default.</summary>
		public AssetMenuState SetGroupBy(string? groupBy)
		{
			var next = (groupBy ?? string.Empty).Trim();

			return string.Equals(Query.GroupBy, next, StringComparison.Ordinal)
				? this
				: Kept(Query with { GroupBy = next });
		}

		/// <summary>The player's second grouping choice for this tab; empty means the tab's default.</summary>
		public AssetMenuState SetThenBy(string? thenBy)
		{
			var next = (thenBy ?? string.Empty).Trim();

			return string.Equals(Query.ThenBy, next, StringComparison.Ordinal)
				? this
				: Kept(Query with { ThenBy = next });
		}

		/// <summary>One tab's two grouping picks; empty for its default.</summary>
		public readonly record struct GroupingPick(string? GroupBy, string? ThenBy);

		/// <summary>
		/// Each tab's grouping picks, by <see cref="TabKey"/>: a menu's All, each category, strip tab
		/// and school tier keeps its own, so a grouping only changes where the player changed it
		/// (owner, 2026-10-22). A tab with none opens on its defaults.
		/// </summary>
		public IReadOnlyDictionary<string, GroupingPick> Picks { get; init; } = new Dictionary<string, GroupingPick>(StringComparer.Ordinal);

		/// <summary>The query with a new pick, kept for its tab.</summary>
		private AssetMenuState Kept(BuildingCatalogQuery query)
		{
			var next = new Dictionary<string, GroupingPick>(Picks.Count + 1, StringComparer.Ordinal);

			foreach (var pick in Picks)
			{
				next[pick.Key] = pick.Value;
			}

			var key = TabKey(query);

			if (string.IsNullOrEmpty(query.GroupBy) && string.IsNullOrEmpty(query.ThenBy))
			{
				next.Remove(key);
			}
			else
			{
				next[key] = new GroupingPick(query.GroupBy, query.ThenBy);
			}

			return this with { Query = ResetWindow(query), Picks = next };
		}

		/// <summary>Which tab a query shows: its menu, then its category, strip tab or school tier.</summary>
		private static string TabKey(BuildingCatalogQuery query) =>
			query.UiMenu + TabSeparator + query.UiCategory
			+ TabSeparator + (query.StripTabs is { Count: > 0 } tabs ? string.Join(",", tabs) : string.Empty)
			+ TabSeparator + query.SchoolTier.ToString(System.Globalization.CultureInfo.InvariantCulture);

		private const string TabSeparator = "\u001f";

		/// <summary>One more chunk, up to the ceiling. At the ceiling, nothing.</summary>
		public AssetMenuState LoadMore() => LoadMoreTo(Query.Limit + BuildingCatalogQuery.WindowStep);

		/// <summary>
		/// The window grown to the limit the UI asked for: never by more than one chunk, never
		/// shrunk, never past the ceiling.
		/// </summary>
		/// <remarks>
		/// Idempotent, because the request can arrive twice: a double click, or the scroll poll
		/// firing again before the answer lands.
		/// </remarks>
		public AssetMenuState LoadMoreTo(int requestedLimit)
		{
			var next = Math.Min(
				Math.Min(requestedLimit, Query.Limit + BuildingCatalogQuery.WindowStep),
				BuildingCatalogQuery.MaxLimit);

			return next <= Query.Limit ? this : this with { Query = Query with { Limit = next } };
		}

		// --- Narrowing -----------------------------------------------------------

		public AssetMenuState ToggleFacet(string facetId, string optionId)
		{
			var next = BuildingCatalogFacetSelection.Toggle(Query, facetId, optionId);

			return ReferenceEquals(next, Query) ? this : this with { Query = Narrowed(next) };
		}

		public AssetMenuState ClearFacets() => this with { Query = Narrowed(BuildingCatalogFacetSelection.Clear(Query)) };

		/// <summary>Every facet and metric bound off; the scope, the search and the order stay.</summary>
		public AssetMenuState ClearFilters() => this with
		{
			Query = Narrowed(BuildingCatalogMetricRange.Clear(BuildingCatalogFacetSelection.Clear(Query))),
		};

		/// <summary>An unparsable bound changes nothing.</summary>
		public AssetMenuState SetMetricRange(string metricId, string minText, string maxText)
		{
			return BuildingCatalogMetricRange.TryApply(Query, metricId, minText, maxText, out var applied)
				? this with { Query = Narrowed(applied) }
				: this;
		}

		public AssetMenuState ClearMetricRanges() => this with { Query = Narrowed(BuildingCatalogMetricRange.Clear(Query)) };

		/// <summary>What the player typed, with the line breaks a paste can carry removed.</summary>
		/// <remarks>
		/// The query gets it trimmed and the box keeps it as typed: trimming what the box
		/// echoes would eat the space typed between two words.
		/// </remarks>
		public AssetMenuState Search(string? text)
		{
			var next = (text ?? string.Empty).Replace("\r", string.Empty).Replace("\n", string.Empty);

			return string.Equals(SearchText, next, StringComparison.Ordinal)
				? this
				: this with { SearchText = next, Query = Narrowed(Query with { SearchText = next.Trim() }) };
		}

		/// <summary>
		/// Back to the menu as it opened: filters, search, sort, direction,
		/// grouping, category, tab and tier all dropped; the menu itself kept.
		/// </summary>
		public AssetMenuState ResetMenu() => this with
		{
			// Every tab of this menu forgets its picks; other menus keep theirs.
			Picks = Picks
				.Where(pick => !pick.Key.StartsWith(Query.UiMenu + TabSeparator, StringComparison.Ordinal))
				.ToDictionary(pick => pick.Key, pick => pick.Value, StringComparer.Ordinal),
			SearchText = string.Empty,
			Query = ResetWindow(BuildingCatalogMetricRange.Clear(BuildingCatalogFacetSelection.Clear(Query)) with
			{
				UiCategory = string.Empty,
				SchoolTier = -1,
				StripTabs = null,
				SearchText = string.Empty,
				SortColumn = string.Empty,
				Descending = false,
				GroupBy = string.Empty,
				ThenBy = string.Empty,
			}),
		};

		// --- The query to run -------------------------------------------------

		/// <summary>
		/// The query "Search everywhere" would run: this search with the menu, category, tab
		/// and tier all dropped, so a count of what it finds is what that button delivers.
		/// </summary>
		public BuildingCatalogQuery EverywhereQuery() => ClearMenuScope().Query;

		public static string GetPageStatus(bool isReady, int totalCount)
		{
			if (!isReady)
			{
				return Indexing;
			}

			return totalCount > 0 ? Ready : Empty;
		}

		/// <summary>Navigating or reordering starts the list over, even onto what is already shown.</summary>
		private static BuildingCatalogQuery ResetWindow(BuildingCatalogQuery query) =>
			query with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };

		/// <summary>A narrowing that changed the result set starts the window over; one that did not keeps it.</summary>
		private BuildingCatalogQuery Narrowed(BuildingCatalogQuery next) => next.ResetWindowIfPredicatesChanged(Query);
	}
}
