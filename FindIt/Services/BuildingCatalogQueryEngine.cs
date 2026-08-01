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

			var offset = query.EffectiveOffset;
			var limit = query.EffectiveLimit;
			var matching = entries.Where(entry => Matches(entry, query));
			var totalCount = matching.Count();
			var items = Order(matching, query)
				.Skip(offset)
				.Take(limit)
				.ToArray();

			return new BuildingCatalogPage(items, totalCount, offset, limit);
		}

		private static bool Matches(BuildingCatalogEntry entry, BuildingCatalogQuery query)
		{
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
