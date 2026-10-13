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

			var unfiltered = BuildingCatalogFacetSelection.Clear(query);

			return entries.Where(entry => Matches(entry, unfiltered));
		}

		/// <summary>
		/// The entries the query matches, its facets included: what a count of the rows a tab
		/// lists counts.
		/// </summary>
		/// <remarks>
		/// InScope's other half. InScope ignores the facet selections, because the facet lists are
		/// counted over it; the tab counts must follow them, as the list does.
		/// </remarks>
		public static IEnumerable<BuildingCatalogEntry> Matching(
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

			return entries.Where(entry => Matches(entry, query));
		}

		/// <param name="labelsOf">A row's headings under the page's grouping, which name its groups' labels; null names each by its key.</param>
		public static BuildingCatalogPage Query(
			IEnumerable<BuildingCatalogEntry> entries,
			BuildingCatalogQuery query,
			Func<BuildingCatalogEntry, BuildingCatalogGrouping.GroupLabels>? labelsOf = null)
		{
			if (entries is null)
			{
				throw new ArgumentNullException(nameof(entries));
			}

			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			// Reframed before ordering, because the Roads menu's extra networks are placed
			// behind its own categories by a rewritten priority. Materialised once: Count,
			// Order and ReorderableSortColumns all read this array.
			var matching = entries
				.Where(entry => Matches(entry, query))
				.Select(entry => NetworkMenuExtension.Reframe(entry, query.UiMenu))
				.ToArray();
			var totalCount = matching.Length;
			// The whole result in display order: the window is a slice of it, and Enter's target
			// is chosen from all of it, wherever its row is. A half-locked tab lists its locked rows last.
			var ordered = Order(matching, query).ToArray();
			var lockedLast = ListsLockedLast(ordered, query);
			var lockedCount = lockedLast ? ordered.Count(entry => entry.IsLocked) : 0;

			if (lockedLast)
			{
				// OrderBy is stable, so rows of one milestone keep the game's order.
				ordered = ordered.Where(entry => !entry.IsLocked).Concat(ordered.Where(entry => entry.IsLocked).OrderBy(entry => entry.UnlockMilestone)).ToArray();
			}

			// What the window slices: the order, less the locked rows while their label is collapsed.
			var visible = lockedLast && query.LockedCollapsed ? ordered.Take(ordered.Length - lockedCount).ToArray() : ordered;
			var sections = lockedLast
				? new[] { new CatalogSection(CatalogSection.LockedId, CatalogSection.Locked, string.Empty, string.Empty, ordered.Length - lockedCount, lockedCount, query.LockedCollapsed) }
				: GroupSections(visible, query.GroupBy, labelsOf);
			// The anchored row's place in that order, and a window that holds it, so the list can open
			// on it. See docs/design-notes.md, "Opening on the building's tab".
			var anchorIndex = query.AnchorId > 0 ? Array.FindIndex(visible, entry => entry.Id == query.AnchorId) : -1;
			var limit = query.CoveringAnchor(anchorIndex).EffectiveLimit;
			var offset = ClampOffset(query.EffectiveOffset, visible.Length, limit);
			var items = visible
				.Skip(offset)
				.Take(limit)
				.ToArray();
			// Both halves, because the window has a ceiling as well as an end. At MaxLimit
			// growing it is a guaranteed no-op, and a Load more button that stays lit and does
			// nothing is worse than none; the readout states the window.
			var hasMore = offset + items.Length < visible.Length
				&& limit < BuildingCatalogQuery.MaxLimit;

			// Over `matching`, not over `items`: the question is whether the sort can order
			// these RESULTS, and a page that happens to tie says nothing about the rest.
			var usableColumns = ReorderableSortColumns(
				matching, query, BuildingCatalogQuery.OfferedSortColumns);

			// Enter's target: the best match, moved by Up and Down through the rows that can be placed.
			// See docs/design-notes.md, "The search field's keys".
			var target = StepTarget(visible, FindBestMatch(visible, query.SearchText), query.EnterStep, out var enterStep);

			return new BuildingCatalogPage(
				items,
				totalCount,
				offset,
				limit,
				HasMore: hasMore,
				ReorderableSortColumns: usableColumns,
				BestMatchId: target?.Id,
				SearchText: query.SearchText ?? string.Empty,
				BestMatch: target,
				AllMatchesLocked: !string.IsNullOrWhiteSpace(query.SearchText) && totalCount > 0 && target is null,
				// At the ceiling with rows past it, Load more cannot reach them: the UI says so instead.
				Capped: limit >= BuildingCatalogQuery.MaxLimit && offset + items.Length < visible.Length,
				AnchorId: query.AnchorId,
				AnchorIndex: anchorIndex,
				EnterStep: enterStep,
				Sections: sections)
			{
				VisibleCount = visible.Length,
			};
		}

		/// <summary>
		/// Whether a tab lists its buildable rows first, then its locked rows by milestone: a tab, not
		/// All; the game's own order, no search; half its rows or more locked; and no groups of its own to
		/// split, so the locked label is the only one.
		/// </summary>
		/// <remarks>
		/// A sort the player picked keeps its order, and a search ranks locked matches in place, dimmed.
		/// See docs/design-notes.md, "Label plates".
		/// </remarks>
		public static bool ListsLockedLast(IReadOnlyList<BuildingCatalogEntry> ordered, BuildingCatalogQuery query)
		{
			var inTab = !string.IsNullOrWhiteSpace(query.UiCategory) || query.StripTabs is { Count: > 0 } || query.SchoolTier >= 0;

			if (ordered.Count == 0
				|| !inTab
				|| !string.IsNullOrWhiteSpace(query.SearchText)
				|| query.Descending
				|| !string.Equals(query.EffectiveSortColumn, BuildingCatalogQuery.DefaultSort, StringComparison.OrdinalIgnoreCase))
			{
				return false;
			}

			if (BuildingCatalogGrouping.IsGrouped(query.GroupBy)
				&& ordered.Select(entry => BuildingCatalogGrouping.PrimaryKey(entry, query.GroupBy)).Distinct(StringComparer.OrdinalIgnoreCase).Skip(1).Any())
			{
				return false;
			}

			return ordered.Count(entry => entry.IsLocked) * 2 >= ordered.Count;
		}

		/// <summary>One label per group of the page's grouping, each with where it starts and its true count; none for fewer than two groups.</summary>
		/// <remarks>The outer level only: a group's tiers keep their order under it without labels of their own.</remarks>
		private static CatalogSection[] GroupSections(
			IReadOnlyList<BuildingCatalogEntry> visible,
			string? groupBy,
			Func<BuildingCatalogEntry, BuildingCatalogGrouping.GroupLabels>? labelsOf)
		{
			if (!BuildingCatalogGrouping.IsGrouped(groupBy) || visible.Count == 0)
			{
				return Array.Empty<CatalogSection>();
			}

			var sections = new List<CatalogSection>();
			var start = 0;

			for (var index = 1; index <= visible.Count; index++)
			{
				if (index < visible.Count
					&& string.Equals(BuildingCatalogGrouping.PrimaryKey(visible[index], groupBy), BuildingCatalogGrouping.PrimaryKey(visible[start], groupBy), StringComparison.OrdinalIgnoreCase))
				{
					continue;
				}

				var labels = labelsOf?.Invoke(visible[start]);
				var label = labels is { Path.Length: > 0 } named ? named.Path[0] : BuildingCatalogGrouping.PrimaryKey(visible[start], groupBy);
				sections.Add(new CatalogSection("group:" + sections.Count, CatalogSection.Group, label, labels?.LabelId ?? string.Empty, start, index - start, false));
				start = index;
			}

			return sections.Count < 2 ? Array.Empty<CatalogSection>() : sections.ToArray();
		}

		/// <summary>
		/// Enter's target: the best-scoring row of the whole result that can be placed, by
		/// relevance, then the shorter name, then display order. Locked and already-built rows
		/// are skipped, because Enter on them does nothing.
		/// </summary>
		/// <remarks>
		/// Over every match, not the window, so a target past the loaded rows, or under a sort
		/// or a grouping that does not lead with it, is still the one armed.
		/// </remarks>
		private static BuildingCatalogBestMatch? FindBestMatch(IReadOnlyList<BuildingCatalogEntry> ordered, string? searchText)
		{
			if (string.IsNullOrWhiteSpace(searchText))
			{
				return null;
			}

			var best = -1;
			var bestScore = 0;
			var bestLength = 0;

			for (var index = 0; index < ordered.Count; index++)
			{
				var entry = ordered[index];

				if (!CanArm(entry))
				{
					continue;
				}

				var score = BuildingCatalogRelevance.Score(entry, searchText);
				var length = (entry.Name ?? string.Empty).Length;

				if (best < 0 || score > bestScore || (score == bestScore && length < bestLength))
				{
					best = index;
					bestScore = score;
					bestLength = length;
				}
			}

			if (best < 0)
			{
				return null;
			}

			return TargetAt(ordered, best);
		}

		/// <summary>
		/// Enter's target moved <paramref name="step"/> rows that can be placed from the best match, in
		/// display order, down for a positive step; it stops at the first or last such row, and
		/// <paramref name="served"/> is the step taken.
		/// </summary>
		/// <remarks>Without a best match there is nothing to move, and no step is served.</remarks>
		private static BuildingCatalogBestMatch? StepTarget(IReadOnlyList<BuildingCatalogEntry> ordered, BuildingCatalogBestMatch? best, int step, out int served)
		{
			served = 0;

			if (best is null || step == 0)
			{
				return best;
			}

			var direction = Math.Sign(step);
			var at = best.Index;

			for (var index = best.Index + direction; index >= 0 && index < ordered.Count && served != step; index += direction)
			{
				if (CanArm(ordered[index]))
				{
					at = index;
					served += direction;
				}
			}

			return at == best.Index ? best : TargetAt(ordered, at);
		}

		/// <summary>Whether Enter can place a row: locked rows and built uniques it cannot.</summary>
		/// <remarks>Equal to the UI's canPlace (buildingLockState.ts): Enter trusts this alone.</remarks>
		private static bool CanArm(BuildingCatalogEntry entry) => !entry.IsLocked && !entry.IsAlreadyBuilt;

		/// <summary>The row at a place in the display order, named as Enter's target.</summary>
		private static BuildingCatalogBestMatch TargetAt(IReadOnlyList<BuildingCatalogEntry> ordered, int index)
		{
			var entry = ordered[index];

			return new BuildingCatalogBestMatch(entry.Id, entry.Name ?? string.Empty, entry.UiMenu ?? string.Empty, index);
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

		private static bool Matches(BuildingCatalogEntry entry, BuildingCatalogQuery query)
		{
			if (!MatchesVanillaMenuTree(entry, query))
			{
				return false;
			}

			// The fallback strip's tab, matched against whichever property its
			// axis names. Nothing to do when no tab is picked, which is also
			// the case for every menu whose strip is vanilla's categories.
			if (query.StripTabs is { Count: > 0 }
				&& !query.StripTabs.Any(tab => StripMatches(entry, tab)))
			{
				return false;
			}

			// The education menu's tier tab. Equality, matching the game: a university
			// grants its own tier and not the ones below it.
			if (query.SchoolTier >= 0 && entry.EducationLevel != query.SchoolTier)
			{
				return false;
			}

			if (!string.IsNullOrWhiteSpace(query.SearchText)
				&& !Contains(entry.Name, query.SearchText)
				&& !Contains(entry.PrefabName, query.SearchText)
				&& !Contains(entry.PdxModsId, query.SearchText))
			{
				return false;
			}

			if (!MatchesAny(AvailabilityOf(entry), query.Availability)
				|| !MatchesAny(entry.BuildingType, query.BuildingTypes)
				|| !MatchesAny(entry.Provenance, query.Provenance)
				// DlcIds is deliberately absent: it is the Content facet's third mechanism,
				// applied in the adapter's ContentVisible so that it UNIONS with the pack and
				// base-game halves rather than intersecting them.
				|| !MatchesAny(entry.Theme, query.Themes)
				// Any, not all, the way every other facet reads: the rail draws them
				// identically, and "road or water" is the question a player asks.
				|| !MatchesAny(entry.PlacementFlags, query.PlacementFlags)
				|| !MatchesZoneType(entry.ZoneType, query.ZoneTypes))
			{
				return false;
			}

			return (!query.MinLotWidth.HasValue || entry.LotWidth >= query.MinLotWidth.Value)
				&& (!query.MaxLotWidth.HasValue || entry.LotWidth <= query.MaxLotWidth.Value)
				&& (!query.MinLotDepth.HasValue || entry.LotDepth >= query.MinLotDepth.Value)
				&& (!query.MaxLotDepth.HasValue || entry.LotDepth <= query.MaxLotDepth.Value)
				&& (!query.MinBuildingLevel.HasValue || entry.BuildingLevel >= query.MinBuildingLevel.Value)
				&& (!query.MaxBuildingLevel.HasValue || entry.BuildingLevel <= query.MaxBuildingLevel.Value)
				&& InRange(entry.ConstructionCost, query.MinConstructionCost, query.MaxConstructionCost)
				&& InRange(entry.Upkeep, query.MinUpkeep, query.MaxUpkeep)
				&& InRange(entry.Workers, query.MinWorkers, query.MaxWorkers)
				&& InRange(entry.Capacity, query.MinCapacity, query.MaxCapacity)
				&& InRange(entry.ElectricityConsumption, query.MinElectricityConsumption, query.MaxElectricityConsumption)
				&& InRange(entry.WaterConsumption, query.MinWaterConsumption, query.MaxWaterConsumption);
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
		/// How many entries answer to each tab, as <see cref="StripMatches"/> matches them, in one walk
		/// over the entries.
		/// </summary>
		/// <remarks>
		/// An entry can only match a tab named by a value it carries, its branch, its asset type or its
		/// density, so each tab is found by those values and StripMatches confirms it. A count per tab
		/// would walk the entries once for every tab.
		/// </remarks>
		public static int[] StripCounts(IEnumerable<BuildingCatalogEntry> entries, IReadOnlyList<string> tabs)
		{
			var counts = new int[tabs.Count];
			var byValue = new Dictionary<string, List<int>>(StringComparer.OrdinalIgnoreCase);
			var densities = false;

			for (var tab = 0; tab < tabs.Count; tab++)
			{
				if (!byValue.TryGetValue(tabs[tab], out var named))
				{
					byValue[tabs[tab]] = named = new List<int>();
				}

				named.Add(tab);
				densities |= StripAxes.DensityTab.TryParse(tabs[tab], out _, out _);
			}

			var counted = new HashSet<int>();

			foreach (var entry in entries)
			{
				counted.Clear();
				Count(entry, entry.DevTreeBranch);
				Count(entry, AssetTypeOf(entry));

				if (densities)
				{
					Count(entry, StripAxes.DensityTab.Format(entry.UiCategory ?? string.Empty, BuildingCatalogLabels.DensityTier(entry.ZoneType)));
				}
			}

			return counts;

			void Count(BuildingCatalogEntry entry, string? value)
			{
				if (value is null || !byValue.TryGetValue(value, out var candidates))
				{
					return;
				}

				foreach (var tab in candidates)
				{
					if (StripMatches(entry, tabs[tab]) && counted.Add(tab))
					{
						counts[tab]++;
					}
				}
			}
		}

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

		/// <summary>Which of the three availability states the entry is in.</summary>
		/// <remarks>
		/// Ordered so the partition holds: locked wins over already-built, because a locked
		/// unique cannot have been built, and already-built wins over unlocked, because that is
		/// the state answering "can I place this".
		/// </remarks>
		public static string AvailabilityOf(BuildingCatalogEntry entry) =>
			entry.IsLocked
				? BuildingCatalogFacetSelection.Availability.Locked
				: entry.IsAlreadyBuilt
					? BuildingCatalogFacetSelection.Availability.AlreadyBuilt
					: BuildingCatalogFacetSelection.Availability.Unlocked;

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

		private static bool Contains(string? value, string search)
		{
			return value is not null
				&& value.Length > 0
				&& value.IndexOf(search, StringComparison.OrdinalIgnoreCase) >= 0;
		}

		/// <summary>
		/// Matches zone density by enum name. An unrecognised name matches nothing rather
		/// than everything: a broken preset should look broken, not wide open.
		/// </summary>
		private static bool MatchesZoneType(ZoneTypeFilter value, IReadOnlyList<string>? selected)
		{
			if (selected is null || selected.Count == 0)
			{
				return true;
			}

			foreach (var name in selected)
			{
				if (Enum.TryParse<ZoneTypeFilter>(name, ignoreCase: true, out var parsed) && parsed == value)
				{
					return true;
				}
			}

			return false;
		}

		private static bool MatchesAny(string? value, IReadOnlyList<string>? selected)
		{
			if (selected is null || selected.Count == 0)
			{
				return true;
			}

			return value is not null
				&& selected.Any(option => string.Equals(option, value, StringComparison.OrdinalIgnoreCase));
		}

		private static bool MatchesAny(IEnumerable<string>? values, IReadOnlyList<string>? selected)
		{
			if (selected is null || selected.Count == 0)
			{
				return true;
			}

			return values is not null
				&& values.Any(value => selected.Any(option => string.Equals(option, value, StringComparison.OrdinalIgnoreCase)));
		}

		private static IOrderedEnumerable<BuildingCatalogEntry> Order(
			IEnumerable<BuildingCatalogEntry> entries,
			BuildingCatalogQuery query)
		{
			// Grouping first, so every member of a group is contiguous and paging
			// cuts cleanly. Without this a group splits across a page boundary
			// and its heading describes something other than what follows it.
			IOrderedEnumerable<BuildingCatalogEntry> seed = SeedByGroup(entries, query);
			// Relevance decides within a group while a search is active; the chosen sort breaks
			// ties. Shortest name next: "clinic" ties Medical Clinic with Additional Clinic
			// Center, and the plain one is nearly always what was meant.
			if (!string.IsNullOrWhiteSpace(query.SearchText))
			{
				seed = seed
					.ThenByDescending(entry => BuildingCatalogRelevance.Score(entry, query.SearchText))
					.ThenBy(entry => (entry.Name ?? string.Empty).Length);
			}

			IOrderedEnumerable<BuildingCatalogEntry> ordered = query.EffectiveSortColumn.ToLowerInvariant() switch
			{
				// A search's own order: after the relevance seeded above, the game's tabs in their order, then
				// its order within each, as Default reads it.
				"match" => seed.ThenBy(x => x.UiCategoryTab).ThenBy(x => x.UIOrder).ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase),
				// The game's own order, and the only sort here that is not a field the
				// player can see. Name second, so two assets vanilla gave the same
				// priority do not swap under the cursor.
				"default" => query.Descending
					? seed.ThenByDescending(x => x.UIOrder).ThenByDescending(x => x.Name, StringComparer.OrdinalIgnoreCase)
					: seed.ThenBy(x => x.UIOrder).ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase),
				"category" => query.Descending
					? seed.ThenByDescending(x => x.Category, StringComparer.OrdinalIgnoreCase)
					: seed.ThenBy(x => x.Category, StringComparer.OrdinalIgnoreCase),
				"subcategory" => query.Descending
					? seed.ThenByDescending(x => x.SubCategory, StringComparer.OrdinalIgnoreCase)
					: seed.ThenBy(x => x.SubCategory, StringComparer.OrdinalIgnoreCase),
				"lotwidth" => query.Descending
					? seed.ThenByDescending(x => x.LotWidth)
					: seed.ThenBy(x => x.LotWidth),
				"lotdepth" => query.Descending
					? seed.ThenByDescending(x => x.LotDepth)
					: seed.ThenBy(x => x.LotDepth),
				"buildinglevel" => query.Descending
					? seed.ThenByDescending(x => x.BuildingLevel)
					: seed.ThenBy(x => x.BuildingLevel),
				"hasparking" => query.Descending
					// By count, not by the boolean: sorting on a flag leaves the order
					// inside each of the two buckets untouched.
					? seed.ThenByDescending(x => x.ParkingSlots)
					: seed.ThenBy(x => x.ParkingSlots),
				"zonetype" => query.Descending
					? seed.ThenByDescending(x => x.ZoneType)
					: seed.ThenBy(x => x.ZoneType),
				"constructioncost" or "cost" => ThenNullable(seed, x => x.ConstructionCost, query.Descending),
				"upkeep" => ThenNullable(seed, x => x.Upkeep, query.Descending),
				"workers" => ThenNullable(seed, x => x.Workers, query.Descending),
				"capacity" => ThenNullable(seed, x => x.Capacity, query.Descending),
				"households" => ThenNullable(seed, x => x.Households, query.Descending),
				"electricity" or "electricityconsumption" => ThenNullable(seed, x => x.ElectricityConsumption, query.Descending),
				"water" or "waterconsumption" => ThenNullable(seed, x => x.WaterConsumption, query.Descending),
				"garbage" or "garbageaccumulation" => ThenNullable(seed, x => x.GarbageAccumulation, query.Descending),
				"watercapacity" => ThenNullable(seed, x => x.WaterCapacity, query.Descending),
				"sewagecapacity" or "sewage" => ThenNullable(seed, x => x.SewageCapacity, query.Descending),
				"groundpollution" => ThenNullable(seed, x => x.GroundPollution, query.Descending),
				"airpollution" => ThenNullable(seed, x => x.AirPollution, query.Descending),
				"noisepollution" or "noise" => ThenNullable(seed, x => x.NoisePollution, query.Descending),
				_ => query.Descending
					? seed.ThenByDescending(x => x.Name, StringComparer.OrdinalIgnoreCase)
					: seed.ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase),
			};

			// A sort by a number leaves ties among equal values: they go to the cheaper
			// building, rows with a cost first, then to the game's own order. The id last, so
			// no two rows swap between refreshes.
			if (SortDefaults.BreaksTiesByCost(query.EffectiveSortColumn))
			{
				ordered = ordered
					.ThenBy(entry => entry.ConstructionCost.HasValue ? 0 : 1)
					.ThenBy(entry => entry.ConstructionCost)
					.ThenBy(entry => entry.UIOrder)
					.ThenBy(entry => entry.Name, StringComparer.OrdinalIgnoreCase);
			}

			return ordered.ThenBy(x => x.Id);
		}

		/// <summary>
		/// The value a column orders by, or null when the entry has none.
		/// </summary>
		/// <remarks>
		/// Deliberately NOT the selector <see cref="Order"/> uses: that one is typed per column
		/// so each field keeps its own comparer. This answers the weaker question "are these two
		/// entries tied on this column", which equality alone settles.
		/// </remarks>
		/// </remarks>
		public static object? SortValueOf(BuildingCatalogEntry entry, string? column) =>
			(column ?? string.Empty).ToLowerInvariant() switch
			{
				"category" => entry.Category,
				"subcategory" => entry.SubCategory,
				"lotwidth" => entry.LotWidth,
				"lotdepth" => entry.LotDepth,
				"buildinglevel" => entry.BuildingLevel,
				"hasparking" => entry.ParkingSlots,
				"zonetype" => entry.ZoneType,
				"constructioncost" or "cost" => entry.ConstructionCost,
				"upkeep" => entry.Upkeep,
				"workers" => entry.Workers,
				"capacity" => entry.Capacity,
				"households" => entry.Households,
				"electricity" or "electricityconsumption" => entry.ElectricityConsumption,
				"water" or "waterconsumption" => entry.WaterConsumption,
				"garbage" or "garbageaccumulation" => entry.GarbageAccumulation,
				"watercapacity" => entry.WaterCapacity,
				"sewagecapacity" or "sewage" => entry.SewageCapacity,
				"groundpollution" => entry.GroundPollution,
				"airpollution" => entry.AirPollution,
				"noisepollution" or "noise" => entry.NoisePollution,
				_ => entry.Name,
			};

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

			// group key -> column -> first value seen there.
			var seen = new Dictionary<string, object?[]>(StringComparer.Ordinal);
			var reorderable = new bool[candidates.Count];

			foreach (var entry in entries)
			{
				var group = BuildingCatalogGrouping.PrimaryKey(entry, query.GroupBy)
					+ ""
					+ BuildingCatalogGrouping.SecondaryKey(entry, query.GroupBy);

				if (!seen.TryGetValue(group, out var first))
				{
					first = new object?[candidates.Count];

					for (var i = 0; i < candidates.Count; i++)
					{
						first[i] = SortValueOf(entry, candidates[i]);
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

					if (!Equals(first[i], SortValueOf(entry, candidates[i])))
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

		private static IOrderedEnumerable<BuildingCatalogEntry> ThenNullable(
			IOrderedEnumerable<BuildingCatalogEntry> seed,
			Func<BuildingCatalogEntry, double?> selector,
			bool descending)
		{
			var presentFirst = seed.ThenBy(entry => selector(entry).HasValue ? 0 : 1);
			return descending
				? presentFirst.ThenByDescending(selector)
				: presentFirst.ThenBy(selector);
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
			BuildingCatalogQuery query)
		{
			if (!BuildingCatalogGrouping.IsGrouped(query.GroupBy))
			{
				return entries.OrderBy(_ => 0);
			}

			return entries
				.OrderBy(entry => BuildingCatalogGrouping.PrimaryKey(entry, query.GroupBy), StringComparer.OrdinalIgnoreCase)
				.ThenBy(entry => BuildingCatalogGrouping.SecondaryKey(entry, query.GroupBy), StringComparer.OrdinalIgnoreCase);
		}
	}
}
