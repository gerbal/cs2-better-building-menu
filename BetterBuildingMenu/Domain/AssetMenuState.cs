using System;
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
	/// to run; <see cref="SearchText"/> is kept beside it, untrimmed, for the box, and
	/// <see cref="ListStart"/> for the UI, which puts the list in place once per start.
	/// </remarks>
	/// <param name="ListStart">
	/// How many times the list has started over at its anchor or its top: an open, a tab pick, a sort
	/// or a typed search under Match. See docs/design-notes.md, "Opening on the building's tab".
	/// </param>
	/// <param name="PreSearch">The tab and sort a search began on, which clearing it brings back; null while none is typed.</param>
	public sealed record AssetMenuState(
		BuildingCatalogQuery Query,
		string SearchText = "",
		int ListStart = 0,
		SearchStart? PreSearch = null)
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

		/// <summary>The row the list starts at, as the index's id, or 0 for its top.</summary>
		public int Anchor => Query.AnchorId;

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
				Query = ResetWindow(Query with { UiMenu = trimmed, UiCategory = string.Empty, SchoolTier = -1, StripTabs = null, AnchorId = 0 }),
				PreSearch = null,
			};
		}

		/// <summary>No menu: the whole catalog, with category, tab and tier forgotten.</summary>
		public AssetMenuState ClearMenuScope() => this with
		{
			Query = ResetWindow(Query with { UiMenu = string.Empty, UiCategory = string.Empty, SchoolTier = -1, StripTabs = null, AnchorId = 0 }),
			PreSearch = null,
		};

		/// <summary>
		/// A bar open or a menu switch: the search clears, the menu's own GROUP and SORT come back, and the
		/// list starts on the tab and row the open rule picks.
		/// </summary>
		/// <param name="opening">The open rule, asked about the menu as it opens: no tab and no search. See CatalogView.Opening.</param>
		/// <param name="memory">The menu's own GROUP and its SORT this session; null keeps the query's.</param>
		/// <remarks>A blank name clears the scope, as <see cref="SelectMenu"/> does, without asking the rule.</remarks>
		public AssetMenuState OpenMenu(string? name, Func<BuildingCatalogQuery, MenuOpening> opening, MenuMemory? memory = null)
		{
			var scoped = SelectMenu(name);

			if (scoped.Menu.Length == 0)
			{
				return scoped;
			}

			var remembered = memory is null
				? scoped.Query
				: scoped.Query with { GroupBy = memory.GroupBy, SortColumn = memory.SortColumn, Descending = memory.Descending };
			var unsearched = remembered with { SearchText = string.Empty };
			var picked = opening(unsearched);

			return scoped.Started(unsearched with
			{
				UiCategory = picked.Category,
				SchoolTier = picked.SchoolTier,
				AnchorId = picked.Anchor,
			}) with { SearchText = string.Empty };
		}

		/// <summary>One of the menu's categories. Excludes a strip tab and a school tier.</summary>
		/// <param name="armed">The prefab the game has armed, which the list starts at; see <see cref="TabPicked"/>.</param>
		public AssetMenuState SelectCategory(string? id, int armed = 0) =>
			TabPicked(Query with { UiCategory = id ?? string.Empty, SchoolTier = -1, StripTabs = null }, armed);

		/// <summary>One strip tab. Excludes a category; blank clears the tabs.</summary>
		/// <param name="armed">The prefab the game has armed, which the list starts at; see <see cref="TabPicked"/>.</param>
		public AssetMenuState SelectStripTab(string? tab, int armed = 0) =>
			TabPicked(Query with
			{
				UiCategory = string.Empty,
				StripTabs = tab is { Length: > 0 } ? new[] { tab } : null,
			}, armed);

		/// <summary>One school tier (1–4); anything below zero is "all".</summary>
		/// <remarks>
		/// With the tab that holds the levels, the tab is picked too, so both read lit and the list is
		/// that tab's schools at that level; picking the tab clears a strip tab, as a tab's own pick
		/// does, and the list is what the level counts. Without one, the category is cleared.
		/// </remarks>
		/// <param name="armed">The prefab the game has armed, which the list starts at; see <see cref="TabPicked"/>.</param>
		public AssetMenuState SelectSchoolTier(int tier, string? parent = null, int armed = 0)
		{
			var tab = parent?.Trim() ?? string.Empty;

			return TabPicked(Query with
			{
				UiCategory = tab,
				SchoolTier = tier < 0 ? -1 : tier,
				StripTabs = tab.Length > 0 ? null : Query.StripTabs,
			}, armed);
		}

		// --- Order, grouping, window ------------------------------------------

		/// <summary>A sort starts the list at its top: the anchor goes, so the first rows are the new order's best.</summary>
		/// <remarks>The lit column again is the same state, so reversing it by that pick is one start, made by <see cref="SetDescending"/>.</remarks>
		public AssetMenuState SetSortColumn(string? column)
		{
			if (column?.Trim() is not { Length: > 0 })
			{
				return this;
			}

			return string.Equals(Query.SortColumn, column, StringComparison.Ordinal)
				? this
				: Started(Query with { SortColumn = column, AnchorId = 0 });
		}

		/// <remarks>Match has no direction: relevance has no reverse, so a flip under it would move the list and change nothing.</remarks>
		public AssetMenuState SetDescending(bool descending) =>
			Query.Descending == descending || IsMatch(Query.SortColumn) ? this : Started(Query with { Descending = descending, AnchorId = 0 });

		/// <summary>The player's grouping choice; empty means the menu's default.</summary>
		/// <remarks>Not a start: the anchor goes, as a narrowing's does, so the window is the first chunk.</remarks>
		public AssetMenuState SetGroupBy(string? groupBy)
		{
			var next = (groupBy ?? string.Empty).Trim();

			return string.Equals(Query.GroupBy, next, StringComparison.Ordinal)
				? this
				: this with { Query = ResetWindow(Query with { GroupBy = next, AnchorId = 0 }) };
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

		/// <summary>
		/// The window grown, as the page served it, to hold the anchored row, so Load more grows from
		/// there and not from the first chunk.
		/// </summary>
		/// <param name="anchorIndex">The anchor's place in the order, from the page; -1 when the result does not hold it.</param>
		public AssetMenuState CoverAnchor(int anchorIndex)
		{
			var covered = Query.CoveringAnchor(anchorIndex);

			return ReferenceEquals(covered, Query) ? this : this with { Query = covered };
		}

		/// <summary>Enter's target a row that can be placed further down the list, or up for a negative direction, while a search is typed.</summary>
		/// <remarks>
		/// A row a press, whatever the number; the page says where the walk stops, which <see cref="KeepEnterStep"/>
		/// keeps. A move is no start: the window and the list's place stay. See docs/design-notes.md, "The search field's keys".
		/// </remarks>
		public AssetMenuState MoveEnterTarget(int direction) =>
			direction == 0 || string.IsNullOrWhiteSpace(Query.SearchText)
				? this
				: this with { Query = Query with { EnterStep = Query.EnterStep + Math.Sign(direction) } };

		/// <summary>The step the page serves, which stops at the list's ends, so a key pressed past one moves back at once.</summary>
		public AssetMenuState KeepEnterStep(int served) =>
			Query.EnterStep == served ? this : this with { Query = Query with { EnterStep = served } };

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
		/// The query gets it trimmed and the box keeps it as typed: trimming what the box echoes would
		/// eat the space typed between two words. A search runs over the whole menu, ranked: its first
		/// letter keeps the tab and the sort it began on and clears the tab, the sort turns to Match,
		/// and under Match every new query starts the list at its top, its best first. Clearing it
		/// brings the tab and the sort back, the list starting at the armed building as a tab pick
		/// does. See docs/design-notes.md, "Search over the whole menu".
		/// </remarks>
		/// <param name="armed">The prefab the game has armed, which the list starts at when the search clears.</param>
		public AssetMenuState Search(string? text, int armed = 0)
		{
			var next = (text ?? string.Empty).Replace("\r", string.Empty).Replace("\n", string.Empty);

			if (string.Equals(SearchText, next, StringComparison.Ordinal))
			{
				return this;
			}

			var typed = next.Trim();
			var was = Query.SearchText ?? string.Empty;

			if (string.Equals(typed, was, StringComparison.Ordinal))
			{
				return this with { SearchText = next };
			}

			if (was.Length == 0)
			{
				return Started(Query with
				{
					SearchText = typed,
					UiCategory = string.Empty,
					SchoolTier = -1,
					StripTabs = null,
					SortColumn = BuildingCatalogQuery.MatchSort,
					Descending = false,
					AnchorId = 0,
				}) with { SearchText = next, PreSearch = new SearchStart(Query.UiCategory, Query.SchoolTier, Query.StripTabs, Query.EffectiveSortColumn, Query.Descending) };
			}

			if (typed.Length == 0)
			{
				var back = PreSearch ?? new SearchStart(
					Query.UiCategory,
					Query.SchoolTier,
					Query.StripTabs,
					IsMatch(Query.SortColumn) ? BuildingCatalogQuery.DefaultSort : Query.EffectiveSortColumn,
					Query.Descending);

				return Started(Query with
				{
					SearchText = string.Empty,
					UiCategory = back.Category,
					SchoolTier = back.SchoolTier,
					StripTabs = back.StripTabs,
					SortColumn = back.SortColumn,
					Descending = back.Descending,
					AnchorId = Math.Max(0, armed),
				}) with { SearchText = next, PreSearch = null };
			}

			return IsMatch(Query.SortColumn)
				? Started(Query with { SearchText = typed, AnchorId = 0 }) with { SearchText = next }
				: this with { SearchText = next, Query = Narrowed(Query with { SearchText = typed }) };
		}

		private static bool IsMatch(string? column) =>
			string.Equals(column, BuildingCatalogQuery.MatchSort, StringComparison.OrdinalIgnoreCase);

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

		/// <summary>The list starting over at the query's anchor, or its top: the window resets and the start moves.</summary>
		private AssetMenuState Started(BuildingCatalogQuery next) => this with { Query = ResetWindow(next), ListStart = ListStart + 1 };

		/// <summary>
		/// A tab pick starts its list at the armed building, which the list finds when the tab holds it.
		/// A second click on the lit tab starts it at its top, and so does a pick while a search is
		/// typed, since the search orders that list.
		/// </summary>
		private AssetMenuState TabPicked(BuildingCatalogQuery next, int armed)
		{
			var top = IsSameTab(next, Query) || !string.IsNullOrWhiteSpace(Query.SearchText);

			return Started(next with { AnchorId = top ? 0 : Math.Max(0, armed) });
		}

		/// <summary>Whether two queries narrow the menu to the same tab, strip tab and level.</summary>
		private static bool IsSameTab(BuildingCatalogQuery a, BuildingCatalogQuery b) =>
			string.Equals(a.UiCategory, b.UiCategory, StringComparison.Ordinal)
			&& a.SchoolTier == b.SchoolTier
			&& (a.StripTabs ?? Array.Empty<string>()).SequenceEqual(b.StripTabs ?? Array.Empty<string>(), StringComparer.Ordinal);

		/// <summary>Navigating or reordering starts the list over, even onto what is already shown, and Enter's target with it.</summary>
		private static BuildingCatalogQuery ResetWindow(BuildingCatalogQuery query) =>
			query with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit, EnterStep = 0 };

		/// <summary>A narrowing that changed the result set starts the window over; one that did not keeps it.</summary>
		/// <remarks>
		/// The anchor goes with the old window: its start is served, and only a start's page grows the
		/// window to the anchored row. See docs/design-notes.md, "Opening on the building's tab".
		/// </remarks>
		private BuildingCatalogQuery Narrowed(BuildingCatalogQuery next)
		{
			var reset = next.ResetWindowIfPredicatesChanged(Query);

			return ReferenceEquals(reset, next) ? next : reset with { AnchorId = 0 };
		}
	}

	/// <summary>A menu's own GROUP, or "" for its default, and its SORT this session, which an open brings back.</summary>
	public sealed record MenuMemory(string GroupBy, string SortColumn, bool Descending)
	{
		/// <summary>A menu with no pick of either: its default grouping and the game's own order.</summary>
		public static MenuMemory Defaults => new(string.Empty, BuildingCatalogQuery.DefaultSort, false);
	}

	/// <summary>The tab, level, strip tab and sort a search began on.</summary>
	public sealed record SearchStart(string Category, int SchoolTier, IReadOnlyList<string>? StripTabs, string SortColumn, bool Descending);
}
