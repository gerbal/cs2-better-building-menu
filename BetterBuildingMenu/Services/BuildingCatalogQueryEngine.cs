using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Services
{
	/// <summary>
	/// Applies the bounded building-catalog query to already projected entries.
	/// Independent of ECS and the prefab index, so the UI contract is deterministic
	/// and unit-testable.
	/// </summary>
	public static class BuildingCatalogQueryEngine
	{
		/// <summary>
		/// The entries the current view is drawn from, ignoring which facet
		/// options are selected.
		/// </summary>
		/// <remarks>
		/// What the facet lists are counted over, so it must be SCOPED — an unscoped candidate
		/// set offers options a scoped query can never return — and must ignore the facet
		/// selections, or the first pick empties every other dimension.
		/// </remarks>
		public static IEnumerable<BuildingCatalogEntry> InScope(
			IEnumerable<BuildingCatalogEntry> entries,
			BuildingCatalogQuery query)
		{
			if (entries is null)
			{
				throw new ArgumentNullException(nameof(entries));
			}

			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			var terms = SearchTerms.From(query.SearchText);

			return entries.Where(entry => Matches(entry, query, terms, NoFacets));
		}

		/// <summary>How many entries <see cref="Query"/> would find, without ordering or paging them.</summary>
		public static int Count(
			IEnumerable<BuildingCatalogEntry> entries,
			BuildingCatalogQuery query)
		{
			if (entries is null)
			{
				throw new ArgumentNullException(nameof(entries));
			}

			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			var terms = SearchTerms.From(query.SearchText);
			var facets = ActiveFacets(query);

			return entries.Count(entry => Matches(entry, query, terms, facets));
		}

		public static BuildingCatalogPage Query(
			IEnumerable<BuildingCatalogEntry> entries,
			BuildingCatalogQuery query)
		{
			if (entries is null)
			{
				throw new ArgumentNullException(nameof(entries));
			}

			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			var limit = query.EffectiveLimit;
			// Reframed before ordering, because the Roads menu's extra networks are placed
			// behind its own categories by a rewritten priority. Materialised once: Count,
			// Order and ReorderableSortColumns all read this array.
			var terms = SearchTerms.From(query.SearchText);
			var facets = ActiveFacets(query);
			var matching = entries
				.Where(entry => Matches(entry, query, terms, facets))
				.Select(entry => NetworkMenuExtension.Reframe(entry, query.UiMenu))
				.ToArray();
			var totalCount = matching.Length;
			var offset = ClampOffset(query.EffectiveOffset, totalCount, limit);
			var items = Order(matching, query, terms)
				.Skip(offset)
				.Take(limit)
				.ToArray();
			// Both halves, because the window has a ceiling as well as an end. At MaxLimit
			// growing it is a guaranteed no-op, and a Load more button that stays lit and does
			// nothing is worse than none; the count beside it still names what is left.
			var hasMore = offset + items.Length < totalCount
				&& limit < BuildingCatalogQuery.MaxLimit;

			// Over `matching`, not over `items`: the question is whether the sort can order
			// these RESULTS, and a page that happens to tie says nothing about the rest.
			var usableColumns = ReorderableSortColumns(
				matching, query, BuildingCatalogSortColumns.Ids);

			return new BuildingCatalogPage(
				items,
				totalCount,
				offset,
				limit,
				HasMore: hasMore,
				ReorderableSortColumns: usableColumns,
				BestMatchId: FindBestMatchId(items, terms),
				SearchText: query.SearchText ?? string.Empty);
		}

		/// <summary>
		/// The best-scoring row of this window that can be placed: by relevance, then the shorter
		/// name, then page order, as a group orders. Locked and already-built rows are skipped,
		/// because Enter on them does nothing.
		/// </summary>
		private static int? FindBestMatchId(IReadOnlyList<BuildingCatalogEntry> items, SearchTerms terms)
		{
			if (terms.IsEmpty)
			{
				return null;
			}

			BuildingCatalogEntry? best = null;
			var bestScore = 0;
			var bestLength = 0;

			foreach (var entry in items)
			{
				if (entry.IsLocked || entry.IsAlreadyBuilt)
				{
					continue;
				}

				var score = BuildingCatalogRelevance.Score(entry, terms);
				var length = (entry.Name ?? string.Empty).Length;

				if (best is null || score > bestScore || (score == bestScore && length < bestLength))
				{
					best = entry;
					bestScore = score;
					bestLength = length;
				}
			}

			return best?.Id;
		}

		/// <summary>
		/// Holds the requested offset inside the result set. Only the query can
		/// know the total, so this cannot live on <see cref="BuildingCatalogQuery"/>
		/// beside the other bound normalizers.
		/// </summary>
		/// <remarks>
		/// Narrowing a query can leave the offset past the new total, which draws an empty page
		/// under a non-zero total. Clamping to the last populated page keeps the player near
		/// their position; the offset itself is not snapped to a page boundary.
		/// </remarks>
		private static int ClampOffset(int offset, int totalCount, int limit)
		{
			if (totalCount <= 0)
			{
				return 0;
			}

			var lastPopulatedPageStart = (totalCount - 1) / limit * limit;

			return offset > lastPopulatedPageStart ? lastPopulatedPageStart : offset;
		}

		private static bool Matches(BuildingCatalogEntry entry, BuildingCatalogQuery query, SearchTerms terms, ActiveFacet[] facets)
		{
			if (!MatchesVanillaMenuTree(entry, query))
			{
				return false;
			}

			// The fallback strip's tab, matched against whichever property its
			// axis names. Nothing to do when no tab is picked, which is also
			// the case for every menu whose strip is vanilla's categories.
			if (query.StripTabs is { Count: > 0 }
				&& !MatchesAnyStripTab(entry, query.StripTabs))
			{
				return false;
			}

			// The education menu's tier tab. Equality, matching the game: a university
			// grants its own tier and not the ones below it.
			if (query.SchoolTier >= 0 && entry.EducationLevel != query.SchoolTier)
			{
				return false;
			}

			if (!terms.IsEmpty && !terms.FoundIn(entry))
			{
				return false;
			}

			for (var i = 0; i < facets.Length; i++)
			{
				if (!facets[i].Admits(entry))
				{
					return false;
				}
			}

			return (!query.MinLotWidth.HasValue || entry.LotWidth >= query.MinLotWidth.Value)
				&& (!query.MaxLotWidth.HasValue || entry.LotWidth <= query.MaxLotWidth.Value)
				&& (!query.MinLotDepth.HasValue || entry.LotDepth >= query.MinLotDepth.Value)
				&& (!query.MaxLotDepth.HasValue || entry.LotDepth <= query.MaxLotDepth.Value)
				&& InRange(entry.ConstructionCost, query.MinConstructionCost, query.MaxConstructionCost)
				&& InRange(entry.Upkeep, query.MinUpkeep, query.MaxUpkeep)
				&& InRange(entry.Workers, query.MinWorkers, query.MaxWorkers)
				&& InRange(entry.Capacity, query.MinCapacity, query.MaxCapacity);
		}

		/// <summary>
		/// The value an entry answers with on the fallback strip's axis.
		/// </summary>
		/// <remarks>
		/// One place, so the predicate and the counts cannot read the axis differently.
		/// </remarks>
		public static string StripValue(BuildingCatalogEntry entry, string? axis) => axis?.Trim() switch
		{
			StripAxes.Development => entry.DevTreeBranch ?? string.Empty,
			StripAxes.AssetType => AssetTypeOf(entry),
			_ => string.Empty,
		};

		/// <summary>
		/// Whether the entry answers to a strip tab, on whichever axis it names.
		/// </summary>
		/// <remarks>
		/// The row can MIX axes — Water draws its buildings as development nodes and its pipes
		/// as one Networks tab — so an axis belongs to a tab, not to the row. Matched by value
		/// rather than by an axis threaded through every tab, since the value spaces do not overlap.
		/// </remarks>
		public static bool StripMatches(BuildingCatalogEntry entry, string tab) =>
			string.Equals(entry.DevTreeBranch, tab, StringComparison.OrdinalIgnoreCase)
			|| string.Equals(AssetTypeOf(entry), tab, StringComparison.OrdinalIgnoreCase)
			|| DensityMatches(entry, tab);

		/// <summary>
		/// A density tab, which carries its family as well as its tier.
		/// </summary>
		/// <remarks>
		/// BOTH halves are tested, and that is the point: a tab click clears
		/// the category, so matching the tier alone would show every family's
		/// low density under a tab whose count promised one family's.
		/// </remarks>
		private static bool DensityMatches(BuildingCatalogEntry entry, string tab)
		{
			if (!StripAxes.DensityTab.TryParse(tab, out var category, out var tier))
			{
				return false;
			}

			return string.Equals(entry.UiCategory, category, StringComparison.OrdinalIgnoreCase)
				&& string.Equals(BuildingCatalogLabels.DensityTier(entry.ZoneType), tier, StringComparison.Ordinal);
		}

		/// <summary>
		/// Whether this is a thing you place or a line you draw.
		/// </summary>
		/// <remarks>
		/// The one cut every menu has, and a real question rather than a
		/// derived one: a water menu holds pumping stations and pipes, and
		/// reaching for one is not the same job as reaching for the other.
		/// </remarks>
		public static string AssetTypeOf(BuildingCatalogEntry entry) =>
			string.Equals(entry.Category, "Networks", StringComparison.OrdinalIgnoreCase)
				? StripAxes.NetworkValue
				: StripAxes.BuildingValue;

		/// <summary>
		/// The only scope there is: the game's own menu placement.
		/// </summary>
		/// <remarks>
		/// Vanilla's menu is set membership, not a predicate: an asset is in a category iff
		/// UIObjectData.m_Group is that category, and asking the same question is what makes this
		/// view agree with the game's. An asset in no menu at all fails a menu constraint.
		/// </remarks>
		private static bool MatchesVanillaMenuTree(BuildingCatalogEntry entry, BuildingCatalogQuery query)
		{
			string menu = query.UiMenu?.Trim() ?? string.Empty;
			string category = query.UiCategory?.Trim() ?? string.Empty;

			// Unscoped queries are not looking at a vanilla menu, so none of the menu's rules
			// apply to them — including the upgrade exclusion below, which run unscoped would
			// drop every upgrade-bearing asset from the whole catalog.
			if (string.IsNullOrEmpty(menu) && string.IsNullOrEmpty(category))
			{
				return true;
			}

			// The Roads menu is the one place the asset menu shows more than the game does: every
			// network belongs there, not only the ones vanilla files under Roads. See
			// NetworkMenuExtension, which takes nothing out of the menus that hold them.
			var extraNetwork = NetworkMenuExtension.IsExtraNetwork(entry.Category, entry.UiMenu, menu, entry.SubCategory);

			if (!extraNetwork
				&& !string.IsNullOrEmpty(menu)
				&& !string.Equals(entry.UiMenu, menu, StringComparison.OrdinalIgnoreCase))
			{
				return false;
			}

			// Vanilla drops service upgrades from every menu unconditionally
			// (ToolbarUISystem.FilterOutUpgrades): they attach to a building rather than being
			// placed. Scoped to a menu constraint, so asking for everything still finds them.
			if (entry.Extensions is { Length: > 0 })
			{
				return false;
			}

			// Against the category this entry answers to IN THIS MENU. An extra network's own
			// UiCategory names where the game keeps it, so comparing a Roads tab against that
			// would make every extra tab select nothing.
			return string.IsNullOrEmpty(category)
				|| string.Equals(
					NetworkMenuExtension.EffectiveCategory(entry, menu),
					category,
					StringComparison.OrdinalIgnoreCase);
		}

		private static bool InRange(double? value, double? minimum, double? maximum)
		{
			if (!minimum.HasValue && !maximum.HasValue)
			{
				return true;
			}

			return value.HasValue
				&& (!minimum.HasValue || value.Value >= minimum.Value)
				&& (!maximum.HasValue || value.Value <= maximum.Value);
		}

		private static bool MatchesAnyStripTab(BuildingCatalogEntry entry, IReadOnlyList<string> tabs)
		{
			for (var i = 0; i < tabs.Count; i++)
			{
				if (StripMatches(entry, tabs[i]))
				{
					return true;
				}
			}

			return false;
		}

		/// <summary>A facet with something selected, read once per query: its test and its selection.</summary>
		private readonly struct ActiveFacet
		{
			private readonly Func<BuildingCatalogEntry, IReadOnlyList<string>, bool> _matches;
			private readonly IReadOnlyList<string> _selection;

			public ActiveFacet(Func<BuildingCatalogEntry, IReadOnlyList<string>, bool> matches, IReadOnlyList<string> selection)
			{
				_matches = matches;
				_selection = selection;
			}

			public bool Admits(BuildingCatalogEntry entry) => _matches(entry, _selection);
		}

		private static readonly ActiveFacet[] NoFacets = Array.Empty<ActiveFacet>();

		/// <summary>The facets this query narrows by: the ones the engine filters on, with something selected.</summary>
		private static ActiveFacet[] ActiveFacets(BuildingCatalogQuery query)
		{
			List<ActiveFacet>? active = null;

			for (var i = 0; i < BuildingCatalogFacetFields.All.Count; i++)
			{
				var facet = BuildingCatalogFacetFields.All[i];

				if (facet.Matches is { } matches && facet.Selected(query) is { Count: > 0 } selection)
				{
					(active ??= new List<ActiveFacet>()).Add(new ActiveFacet(matches, selection));
				}
			}

			return active?.ToArray() ?? NoFacets;
		}

		private static IOrderedEnumerable<BuildingCatalogEntry> Order(
			IEnumerable<BuildingCatalogEntry> entries,
			BuildingCatalogQuery query,
			SearchTerms terms)
		{
			// Grouping first, so every member of a group is contiguous and paging
			// cuts cleanly. Without this a group splits across a page boundary
			// and its heading describes something other than what follows it.
			IOrderedEnumerable<BuildingCatalogEntry> seed = SeedByGroup(entries, BuildingCatalogGrouping.Resolve(query.GroupBy));
			// Relevance decides within a group while a search is active; the chosen sort breaks
			// ties. Shortest name next: "clinic" ties Medical Clinic with Additional Clinic
			// Center, and the plain one is nearly always what was meant.
			if (!terms.IsEmpty)
			{
				seed = seed
					.ThenByDescending(entry => BuildingCatalogRelevance.Score(entry, terms))
					.ThenBy(entry => (entry.Name ?? string.Empty).Length);
			}

			return BuildingCatalogSortColumns.Find(query.EffectiveSortColumn)
				.ThenBy(seed, query.Descending)
				.ThenBy(x => x.Id);
		}

		/// <summary>
		/// Which of the offered sort columns could actually move a row.
		/// </summary>
		/// <remarks>
		/// A control that responds while the list does not is the signature of a broken one.
		/// ONE pass for all columns: per column it keeps the first value seen in each group and
		/// stops caring once a second, different one turns up.
		/// </remarks>
		public static IReadOnlyList<string> ReorderableSortColumns(
			IEnumerable<BuildingCatalogEntry> entries,
			BuildingCatalogQuery query,
			IReadOnlyList<string> candidates)
		{
			if (entries is null || query is null || candidates is null || candidates.Count == 0)
			{
				return Array.Empty<string>();
			}

			var columns = new BuildingCatalogSortColumn[candidates.Count];

			for (var i = 0; i < candidates.Count; i++)
			{
				columns[i] = BuildingCatalogSortColumns.Find(candidates[i]);
			}

			var dimension = BuildingCatalogGrouping.Resolve(query.GroupBy);
			// group key -> column -> first value seen there.
			var seen = new Dictionary<string, object?[]>(StringComparer.Ordinal);
			var reorderable = new bool[candidates.Count];

			foreach (var entry in entries)
			{
				var group = dimension.PrimaryKey(entry)
					+ ""
					+ dimension.SecondaryKey(entry);

				if (!seen.TryGetValue(group, out var first))
				{
					first = new object?[candidates.Count];

					for (var i = 0; i < candidates.Count; i++)
					{
						first[i] = columns[i].TieValue(entry);
					}

					seen[group] = first;
					continue;
				}

				for (var i = 0; i < candidates.Count; i++)
				{
					if (reorderable[i])
					{
						continue;
					}

					if (!Equals(first[i], columns[i].TieValue(entry)))
					{
						reorderable[i] = true;
					}
				}
			}

			var usable = new List<string>();

			for (var i = 0; i < candidates.Count; i++)
			{
				if (reorderable[i])
				{
					usable.Add(candidates[i]);
				}
			}

			return usable;
		}

		/// <summary>
		/// The ordering the chosen sort is applied on top of.
		/// </summary>
		/// <remarks>
		/// A constant when nothing is grouped, which makes the sort behave
		/// exactly as it did before: OrderBy is stable, so seeding with one key
		/// for every entry changes no relative order.
		/// </remarks>
		private static IOrderedEnumerable<BuildingCatalogEntry> SeedByGroup(
			IEnumerable<BuildingCatalogEntry> entries,
			GroupDimension dimension)
		{
			if (!dimension.IsGrouped)
			{
				return entries.OrderBy(_ => 0);
			}

			return entries
				.OrderBy(dimension.PrimaryKey, StringComparer.OrdinalIgnoreCase)
				.ThenBy(dimension.SecondaryKey, StringComparer.OrdinalIgnoreCase);
		}
	}
}
