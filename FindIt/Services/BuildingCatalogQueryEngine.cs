using FindItBuildingMenu.Domain;

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
			if (!MatchesBuildMenu(entry, query))
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

			if (!MatchesAny(entry.BuildingType, query.BuildingTypes)
				|| !MatchesAny(entry.Provenance, query.Provenance)
				|| !MatchesAny(entry.DlcId, query.DlcIds)
				|| !MatchesAny(entry.Theme, query.Themes)
				|| !MatchesAny(entry.AssetPacks, query.AssetPacks)
				|| !MatchesAll(entry.PlacementFlags, query.PlacementFlags)
				|| !MatchesAny(entry.Extensions, query.Extensions))
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

		private static bool MatchesAll(IEnumerable<string>? values, IReadOnlyList<string>? selected)
		{
			if (selected is null || selected.Count == 0)
			{
				return true;
			}

			string[] available = values?.ToArray() ?? Array.Empty<string>();
			return selected.All(option => available.Any(value => string.Equals(option, value, StringComparison.OrdinalIgnoreCase)));
		}

		private static IOrderedEnumerable<BuildingCatalogEntry> Order(
			IEnumerable<BuildingCatalogEntry> entries,
			BuildingCatalogQuery query)
		{
			IOrderedEnumerable<BuildingCatalogEntry> ordered = query.EffectiveSortColumn.ToLowerInvariant() switch
			{
				"category" => query.Descending
					? entries.OrderByDescending(x => x.Category, StringComparer.OrdinalIgnoreCase)
					: entries.OrderBy(x => x.Category, StringComparer.OrdinalIgnoreCase),
				"subcategory" => query.Descending
					? entries.OrderByDescending(x => x.SubCategory, StringComparer.OrdinalIgnoreCase)
					: entries.OrderBy(x => x.SubCategory, StringComparer.OrdinalIgnoreCase),
				"lotwidth" => query.Descending
					? entries.OrderByDescending(x => x.LotWidth)
					: entries.OrderBy(x => x.LotWidth),
				"lotdepth" => query.Descending
					? entries.OrderByDescending(x => x.LotDepth)
					: entries.OrderBy(x => x.LotDepth),
				"buildinglevel" => query.Descending
					? entries.OrderByDescending(x => x.BuildingLevel)
					: entries.OrderBy(x => x.BuildingLevel),
				"hasparking" => query.Descending
					? entries.OrderByDescending(x => x.HasParking)
					: entries.OrderBy(x => x.HasParking),
				"zonetype" => query.Descending
					? entries.OrderByDescending(x => x.ZoneType)
					: entries.OrderBy(x => x.ZoneType),
				"constructioncost" or "cost" => OrderNullable(entries, x => x.ConstructionCost, query.Descending),
				"upkeep" => OrderNullable(entries, x => x.Upkeep, query.Descending),
				"workers" => OrderNullable(entries, x => x.Workers, query.Descending),
				"capacity" => OrderNullable(entries, x => x.Capacity, query.Descending),
				"electricity" or "electricityconsumption" => OrderNullable(entries, x => x.ElectricityConsumption, query.Descending),
				"water" or "waterconsumption" => OrderNullable(entries, x => x.WaterConsumption, query.Descending),
				"garbage" or "garbageaccumulation" => OrderNullable(entries, x => x.GarbageAccumulation, query.Descending),
				"watercapacity" => OrderNullable(entries, x => x.WaterCapacity, query.Descending),
				"sewagecapacity" or "sewage" => OrderNullable(entries, x => x.SewageCapacity, query.Descending),
				"groundpollution" => OrderNullable(entries, x => x.GroundPollution, query.Descending),
				"airpollution" => OrderNullable(entries, x => x.AirPollution, query.Descending),
				"noisepollution" or "noise" => OrderNullable(entries, x => x.NoisePollution, query.Descending),
				_ => query.Descending
					? entries.OrderByDescending(x => x.Name, StringComparer.OrdinalIgnoreCase)
					: entries.OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase),
			};

			return ordered.ThenBy(x => x.Id);
		}

		private static IOrderedEnumerable<BuildingCatalogEntry> OrderNullable(
			IEnumerable<BuildingCatalogEntry> entries,
			Func<BuildingCatalogEntry, double?> selector,
			bool descending)
		{
			var presentFirst = entries.OrderBy(entry => selector(entry).HasValue ? 0 : 1);
			return descending
				? presentFirst.ThenByDescending(selector)
				: presentFirst.ThenBy(selector);
		}
	}
}
