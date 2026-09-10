using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Everything the player has told the lens: where they are looking, what they
	/// typed, how the result is ordered, grouped and narrowed, and how much is shown.
	/// </summary>
	/// <remarks>
	/// One immutable record with one transition per trigger, so the lens's rules — a
	/// menu forgets its category, tab and tier; a tab and a category exclude each
	/// other — are stated once and testable without a game. A no-op returns <c>this</c>.
	/// </remarks>
	public sealed record BuildingCatalogLensState(
		BuildingCatalogQuery Query,
		BuildingCatalogMetricRangeState MetricRanges,
		string Menu = "",
		string Category = "",
		int SchoolTier = -1,
		string SearchText = "")
	{
		public const string Indexing = "indexing";
		public const string Ready = "ready";
		public const string Empty = "empty";

		/// <summary>Unscoped, unsearched, unfiltered: what the lens starts as.</summary>
		public static BuildingCatalogLensState Initial => new(new BuildingCatalogQuery(), BuildingCatalogMetricRangeState.Empty);

		// --- Where the player is looking ------------------------------------

		/// <summary>The game's menu the lens stands in for. Blank clears the scope.</summary>
		public BuildingCatalogLensState SelectMenu(string? name)
		{
			if (string.IsNullOrWhiteSpace(name))
			{
				return ClearMenuScope();
			}

			return this with
			{
				Menu = name!.Trim(),
				Category = string.Empty,
				SchoolTier = -1,
				Query = ResetWindow(Query with { StripTabs = null }),
			};
		}

		/// <summary>No menu: the whole catalog, with category, tab and tier forgotten.</summary>
		public BuildingCatalogLensState ClearMenuScope() => this with
		{
			Menu = string.Empty,
			Category = string.Empty,
			SchoolTier = -1,
			Query = ResetWindow(Query with { StripTabs = null }),
		};

		/// <summary>One of the menu's categories. Excludes a strip tab and a school tier.</summary>
		public BuildingCatalogLensState SelectCategory(string? id) => this with
		{
			Category = id ?? string.Empty,
			SchoolTier = -1,
			Query = ResetWindow(Query with { StripTabs = null }),
		};

		/// <summary>One strip tab. Excludes a category; blank clears the tabs.</summary>
		public BuildingCatalogLensState SelectStripTab(string? tab) => this with
		{
			Category = string.Empty,
			Query = ResetWindow(Query with { StripTabs = string.IsNullOrEmpty(tab) ? null : new[] { tab! } }),
		};

		/// <summary>One school tier (1–4); anything below zero is "all". Excludes a category.</summary>
		public BuildingCatalogLensState SelectSchoolTier(int tier) => this with
		{
			Category = string.Empty,
			SchoolTier = tier < 0 ? -1 : tier,
			Query = ResetWindow(Query),
		};

		// --- Order, grouping, window ------------------------------------------

		public BuildingCatalogLensState SetSortColumn(string? column)
		{
			if (string.IsNullOrWhiteSpace(column))
			{
				return this;
			}

			return this with { Query = ResetWindow(Query with { SortColumn = column! }) };
		}

		public BuildingCatalogLensState SetDescending(bool descending) =>
			Query.Descending == descending ? this : this with { Query = ResetWindow(Query with { Descending = descending }) };

		/// <summary>The player's grouping choice; empty means the menu's default.</summary>
		public BuildingCatalogLensState SetGroupBy(string? groupBy)
		{
			var next = (groupBy ?? string.Empty).Trim();

			return string.Equals(Query.GroupBy, next, StringComparison.Ordinal)
				? this
				: this with { Query = ResetWindow(Query with { GroupBy = next }) };
		}

		/// <summary>One more chunk, up to the ceiling. At the ceiling, nothing.</summary>
		public BuildingCatalogLensState LoadMore()
		{
			if (Query.Limit >= BuildingCatalogQuery.MaxLimit)
			{
				return this;
			}

			return this with
			{
				Query = Query with
				{
					Limit = Math.Min(Query.Limit + BuildingCatalogQuery.WindowStep, BuildingCatalogQuery.MaxLimit),
				},
			};
		}

		// --- Narrowing -----------------------------------------------------------

		public BuildingCatalogLensState ToggleFacet(string facetId, string optionId)
		{
			var next = BuildingCatalogFacetSelection.Toggle(Query, facetId, optionId);

			return ReferenceEquals(next, Query) ? this : this with { Query = next };
		}

		public BuildingCatalogLensState ClearFacets() => this with { Query = BuildingCatalogFacetSelection.Clear(Query) };

		/// <summary>Every facet and metric bound off; the scope, the search and the order stay.</summary>
		public BuildingCatalogLensState ClearFilters()
		{
			BuildingCatalogQuery query = BuildingCatalogMetricRange.Clear(
				BuildingCatalogFacetSelection.Clear(Query));

			return this with
			{
				Query = query,
				MetricRanges = BuildingCatalogMetricRangeState.Empty,
			};
		}

		/// <summary>An unparsable bound changes nothing.</summary>
		public BuildingCatalogLensState SetMetricRange(string metricId, string minText, string maxText)
		{
			if (!BuildingCatalogMetricRange.TryParse(metricId, minText, maxText, out BuildingCatalogMetricRange range))
			{
				return this;
			}

			return this with
			{
				MetricRanges = MetricRanges.With(range),
				Query = BuildingCatalogMetricRange.Apply(Query, metricId, minText, maxText),
			};
		}

		public BuildingCatalogLensState ClearMetricRanges() => this with
		{
			MetricRanges = BuildingCatalogMetricRangeState.Empty,
			Query = BuildingCatalogMetricRange.Clear(Query),
		};

		/// <summary>What the player typed, with the line breaks a paste can carry removed.</summary>
		public BuildingCatalogLensState Search(string? text)
		{
			var next = (text ?? string.Empty).Replace("\r", string.Empty).Replace("\n", string.Empty);

			return string.Equals(SearchText, next, StringComparison.Ordinal) ? this : this with { SearchText = next };
		}

		/// <summary>
		/// Back to the menu as it opened: filters, search, sort, direction,
		/// grouping, category, tab and tier all dropped; the menu itself kept.
		/// </summary>
		public BuildingCatalogLensState ResetMenu()
		{
			var cleared = ClearFilters();

			return cleared with
			{
				Category = string.Empty,
				SchoolTier = -1,
				SearchText = string.Empty,
				Query = ResetWindow(cleared.Query with
				{
					StripTabs = null,
					SearchText = string.Empty,
					SortColumn = string.Empty,
					Descending = false,
					GroupBy = string.Empty,
				}),
			};
		}

		// --- The query to run -------------------------------------------------

		/// <summary>
		/// The query the engine runs, with the scope, the search and every metric bound
		/// folded in. The window resets when a predicate moved, never below one chunk.
		/// </summary>
		public BuildingCatalogLensState Compose()
		{
			var composed = (Query with
			{
				SearchText = SearchText,
				UiMenu = Menu,
				UiCategory = Category,
				SchoolTier = SchoolTier,
				MinConstructionCost = MetricRanges.MinCost,
				MaxConstructionCost = MetricRanges.MaxCost,
				MinUpkeep = MetricRanges.MinUpkeep,
				MaxUpkeep = MetricRanges.MaxUpkeep,
				MinWorkers = MetricRanges.MinWorkers,
				MaxWorkers = MetricRanges.MaxWorkers,
				MinCapacity = MetricRanges.MinCapacity,
				MaxCapacity = MetricRanges.MaxCapacity,
				MinLotWidth = ToNullableInt(MetricRanges.MinLotWidth),
				MaxLotWidth = ToNullableInt(MetricRanges.MaxLotWidth),
				MinLotDepth = ToNullableInt(MetricRanges.MinLotDepth),
				MaxLotDepth = ToNullableInt(MetricRanges.MaxLotDepth),
			}).ResetWindowIfPredicatesChanged(Query);

			if (composed.Limit < BuildingCatalogQuery.DefaultLimit)
			{
				composed = composed with { Limit = BuildingCatalogQuery.DefaultLimit };
			}

			return composed == Query ? this : this with { Query = composed };
		}

		public static string GetPageStatus(bool isReady, int totalCount)
		{
			if (!isReady)
			{
				return Indexing;
			}

			return totalCount > 0 ? Ready : Empty;
		}

		private static BuildingCatalogQuery ResetWindow(BuildingCatalogQuery query) =>
			query with { Offset = 0, Limit = BuildingCatalogQuery.DefaultLimit };

		// Truncated, not rounded.
		private static int? ToNullableInt(double? value) =>
			value.HasValue ? (int)value.Value : null;
	}
}
