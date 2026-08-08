using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Services
{
	/// <summary>
	/// Applies the successor's bounded building-catalog query to already
	/// projected entries. Keeping this operation independent from ECS and the
	/// FindIt index makes the UI contract deterministic and unit-testable.
	/// </summary>
	public static class BuildingCatalogQueryEngine
	{
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
			var matching = entries.Where(entry => Matches(entry, query));
			var totalCount = matching.Count();
			var offset = ClampOffset(query.EffectiveOffset, totalCount, limit);
			var items = Order(matching, query)
				.Skip(offset)
				.Take(limit)
				.ToArray();

			return new BuildingCatalogPage(items, totalCount, offset, limit);
		}

		/// <summary>
		/// Holds the requested offset inside the result set. Only the query can
		/// know the total, so this cannot live on <see cref="BuildingCatalogQuery"/>
		/// beside the other bound normalizers.
		/// </summary>
		/// <remarks>
		/// Narrowing a query (typing a search, picking a facet) can leave the
		/// offset past the new total. Skipping every match would return an empty
		/// page with a non-zero total, which reads on screen as "no buildings
		/// match" above a footer describing rows that are not there. Clamping to
		/// the last populated page keeps the player near their position instead
		/// of resetting them to page 1. The requested offset itself is not
		/// snapped to a page boundary: the pager only ever moves in whole pages,
		/// and callers may legitimately ask for an arbitrary window.
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

			// The menu tree REPLACES the section overlay rather than layering on
			// it. Both describe where an asset lives in the build menu, but only
			// one of them is the game's own answer: UIObject.m_Group is what
			// vanilla itself reads, while VanillaSection is a shape we
			// reconstruct from (Category, SubCategory, ZoneType).
			//
			// Applying both meant a menu member could be dropped for indexing
			// into a section the preset did not name. Roads is pinned to
			// Networks, so its 34 parking lots and 1 service building — which
			// index as ServiceBuildings — vanished: 122 of 157 shown. The same
			// arithmetic cost Transportation 23 of its 53, because bus stops,
			// taxi stops, tram stops and tracks are networks inside a menu
			// pinned to ServiceBuildings.
			//
			// The section stays SET while scoped, and is merely not applied. It
			// is still what the auto-widen brake reads to answer "am I scoped?"
			// (FindItUISystem.Methods.cs), and clearing it would make that check
			// lie.
			if (!IsScopedToMenuTree(query) && !MatchesBuildMenu(entry, query))
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

			if (!string.IsNullOrWhiteSpace(query.Category)
				&& !string.Equals(entry.Category, query.Category, StringComparison.OrdinalIgnoreCase))
			{
				return false;
			}

			if (!string.IsNullOrWhiteSpace(query.SubCategory)
				&& !string.Equals(entry.SubCategory, query.SubCategory, StringComparison.OrdinalIgnoreCase))
			{
				return false;
			}

			if (!MatchesAny(entry.IsLocked ? "Locked" : "Unlocked", query.Availability)
				|| !MatchesAny(entry.BuildingType, query.BuildingTypes)
				|| !MatchesAny(entry.Provenance, query.Provenance)
				|| !MatchesAny(entry.DlcId, query.DlcIds)
				|| !MatchesAny(entry.Theme, query.Themes)
				|| !MatchesAny(entry.AssetPacks, query.AssetPacks)
				// Placement used to require every chosen flag while every other
				// facet took any. The rail draws them identically, so the same
				// gesture meant two different things depending on which row it
				// landed in, and nothing on screen said so. "Road or water"
				// is also the question a player actually asks.
				|| !MatchesAny(entry.PlacementFlags, query.PlacementFlags)
				|| !MatchesAny(entry.Extensions, query.Extensions)
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
				&& (!query.HasParking.HasValue || entry.HasParking == query.HasParking.Value)
				&& InRange(entry.ConstructionCost, query.MinConstructionCost, query.MaxConstructionCost)
				&& InRange(entry.Upkeep, query.MinUpkeep, query.MaxUpkeep)
				&& InRange(entry.Workers, query.MinWorkers, query.MaxWorkers)
				&& InRange(entry.Capacity, query.MinCapacity, query.MaxCapacity)
				&& InRange(entry.ElectricityConsumption, query.MinElectricityConsumption, query.MaxElectricityConsumption)
				&& InRange(entry.WaterConsumption, query.MinWaterConsumption, query.MaxWaterConsumption);
		}

		/// <summary>
		/// SPIKE (cm-e98i). Filters by the placement the GAME gives an asset —
		/// UIObject.m_Group and its menu — rather than by the section we
		/// reconstruct in VanillaBuildMenuTaxonomy.
		///
		/// Vanilla's menu is set membership, not a predicate: an asset is in a
		/// category iff UIObjectData.m_Group is that category. Asking the same
		/// question is what makes our Healthcare view agree with the game's.
		/// An asset that is in no menu at all fails a menu constraint, which is
		/// also vanilla's behaviour — it only ever lists group members.
		/// </summary>
		/// <summary>
		/// Whether this query is asking about a place in the vanilla build menu.
		/// </summary>
		/// <remarks>
		/// The query owns this now, because the page size depends on the same
		/// answer: a menu-scoped query does not page. Two copies of "am I
		/// looking at a menu?" would be two places to disagree.
		/// </remarks>
		private static bool IsScopedToMenuTree(BuildingCatalogQuery query) => query.IsScopedToMenu;

		private static bool MatchesVanillaMenuTree(BuildingCatalogEntry entry, BuildingCatalogQuery query)
		{
			string menu = query.UiMenu?.Trim() ?? string.Empty;
			string category = query.UiCategory?.Trim() ?? string.Empty;

			// Unscoped queries are not looking at a vanilla menu, so none of the
			// menu's rules apply to them — including the upgrade exclusion below,
			// which used to sit outside this guard and therefore ran on EVERY
			// query. That contradicted the comment right next to it and deleted
			// every upgrade-bearing asset from the whole catalog: the Extensions
			// facet could select a value and then match nothing, which is what
			// Query_ExtensionFacetMatchesStableExtensionIdentity caught.
			if (string.IsNullOrEmpty(menu) && string.IsNullOrEmpty(category))
			{
				return true;
			}

			if (!string.IsNullOrEmpty(menu)
				&& !string.Equals(entry.UiMenu, menu, StringComparison.OrdinalIgnoreCase))
			{
				return false;
			}

			// Vanilla drops service upgrades from every menu unconditionally
			// (ToolbarUISystem.FilterOutUpgrades). They are things you attach to a
			// building, not things you build, so a build list that offers them is
			// offering something you cannot place. Scoped to a menu constraint:
			// asking for "everything" should still find them.
			if (entry.Extensions is { Length: > 0 })
			{
				return false;
			}

			return string.IsNullOrEmpty(category)
				|| string.Equals(entry.UiCategory, category, StringComparison.OrdinalIgnoreCase);
		}

		private static bool MatchesBuildMenu(BuildingCatalogEntry entry, BuildingCatalogQuery query)
		{
			string section = query.BuildMenuSection?.Trim() ?? string.Empty;
			if (!string.IsNullOrEmpty(section)
				&& !string.Equals(section, VanillaBuildMenuTaxonomy.AllBuildings, StringComparison.OrdinalIgnoreCase))
			{
				if (string.Equals(section, VanillaBuildMenuTaxonomy.Favorites, StringComparison.OrdinalIgnoreCase))
				{
					if (!entry.IsFavorited)
					{
						return false;
					}
				}
				else if (!VanillaBuildMenuTaxonomy.GetSectionDescriptors()
					.Any(descriptor => string.Equals(descriptor.Id, section, StringComparison.OrdinalIgnoreCase)))
				{
					return false;
				}
				else if (!string.Equals(entry.VanillaSection, section, StringComparison.OrdinalIgnoreCase))
				{
					return false;
				}
			}

			string subCategory = query.BuildMenuSubCategory?.Trim() ?? string.Empty;
			return string.IsNullOrEmpty(subCategory)
				|| string.Equals(subCategory, VanillaBuildMenuTaxonomy.Any, StringComparison.OrdinalIgnoreCase)
				|| string.Equals(entry.VanillaSubCategory, subCategory, StringComparison.OrdinalIgnoreCase);
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
		/// Zone density is an enum on the entry rather than a string, so it is
		/// matched by name. An unrecognised name matches nothing rather than
		/// everything: a broken preset should look broken, not like a filter
		/// that happens to be wide open.
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

			IOrderedEnumerable<BuildingCatalogEntry> ordered = query.EffectiveSortColumn.ToLowerInvariant() switch
			{
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
					// By count, not by the boolean. Sorting on a flag put every
					// entry in one of two buckets and left the order inside them
					// untouched, so on any set that agreed — all of Water &
					// Sewage, for instance — the sort visibly did nothing.
					? seed.ThenByDescending(x => x.ParkingSlots)
					: seed.ThenBy(x => x.ParkingSlots),
				"zonetype" => query.Descending
					? seed.ThenByDescending(x => x.ZoneType)
					: seed.ThenBy(x => x.ZoneType),
				"constructioncost" or "cost" => ThenNullable(seed, x => x.ConstructionCost, query.Descending),
				"upkeep" => ThenNullable(seed, x => x.Upkeep, query.Descending),
				"workers" => ThenNullable(seed, x => x.Workers, query.Descending),
				"capacity" => ThenNullable(seed, x => x.Capacity, query.Descending),
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

			return ordered.ThenBy(x => x.Id);
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
