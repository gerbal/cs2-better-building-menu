using System;

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

			return this with
			{
				Query = ResetWindow(Query with { UiMenu = trimmed, UiCategory = string.Empty, SchoolTier = -1, StripTabs = null }),
			};
		}

		/// <summary>No menu: the whole catalog, with category, tab and tier forgotten.</summary>
		public AssetMenuState ClearMenuScope() => this with
		{
			Query = ResetWindow(Query with { UiMenu = string.Empty, UiCategory = string.Empty, SchoolTier = -1, StripTabs = null }),
		};

		/// <summary>One of the menu's categories. Excludes a strip tab and a school tier.</summary>
		public AssetMenuState SelectCategory(string? id) => this with
		{
			Query = ResetWindow(Query with { UiCategory = id ?? string.Empty, SchoolTier = -1, StripTabs = null }),
		};

		/// <summary>One strip tab. Excludes a category; blank clears the tabs.</summary>
		public AssetMenuState SelectStripTab(string? tab) => this with
		{
			Query = ResetWindow(Query with
			{
				UiCategory = string.Empty,
				StripTabs = tab is { Length: > 0 } ? new[] { tab } : null,
			}),
		};

		/// <summary>One school tier (1–4); anything below zero is "all". Excludes a category.</summary>
		public AssetMenuState SelectSchoolTier(int tier) => this with
		{
			Query = ResetWindow(Query with { UiCategory = string.Empty, SchoolTier = tier < 0 ? -1 : tier }),
		};

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

		/// <summary>The player's grouping choice; empty means the menu's default.</summary>
		public AssetMenuState SetGroupBy(string? groupBy)
		{
			var next = (groupBy ?? string.Empty).Trim();

			return string.Equals(Query.GroupBy, next, StringComparison.Ordinal)
				? this
				: this with { Query = ResetWindow(Query with { GroupBy = next }) };
		}

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
			if (!BuildingCatalogMetricRange.TryParse(metricId, minText, maxText, out _))
			{
				return this;
			}

			return this with { Query = Narrowed(BuildingCatalogMetricRange.Apply(Query, metricId, minText, maxText)) };
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
