using Colossal.UI.Binding;

using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Normalized metric ranges published to the controlled Building Lens drawer.
	/// </summary>
	public sealed record BuildingCatalogMetricRangeState(
		double? MinCost,
		double? MaxCost,
		double? MinUpkeep,
		double? MaxUpkeep,
		double? MinWorkers,
		double? MaxWorkers,
		double? MinCapacity,
		double? MaxCapacity,
		double? MinLotWidth,
		double? MaxLotWidth,
		double? MinLotDepth,
		double? MaxLotDepth) : IJsonWritable
	{
		public static BuildingCatalogMetricRangeState Empty { get; } = new(null, null, null, null, null, null, null, null, null, null, null, null);

		public bool HasSelection =>
			MinCost.HasValue || MaxCost.HasValue
			|| MinUpkeep.HasValue || MaxUpkeep.HasValue
			|| MinWorkers.HasValue || MaxWorkers.HasValue
			|| MinCapacity.HasValue || MaxCapacity.HasValue
			|| MinLotWidth.HasValue || MaxLotWidth.HasValue
			|| MinLotDepth.HasValue || MaxLotDepth.HasValue;

		public static BuildingCatalogMetricRangeState FromQuery(BuildingCatalogQuery query)
		{
			return new BuildingCatalogMetricRangeState(
				query.MinConstructionCost,
				query.MaxConstructionCost,
				query.MinUpkeep,
				query.MaxUpkeep,
				query.MinWorkers,
				query.MaxWorkers,
				query.MinCapacity,
				query.MaxCapacity,
				query.MinLotWidth,
				query.MaxLotWidth,
				query.MinLotDepth,
				query.MaxLotDepth);
		}

		public BuildingCatalogMetricRangeState With(BuildingCatalogMetricRange range)
		{
			return range.MetricId switch
			{
				"cost" => this with { MinCost = range.Min, MaxCost = range.Max },
				"upkeep" => this with { MinUpkeep = range.Min, MaxUpkeep = range.Max },
				"workers" => this with { MinWorkers = range.Min, MaxWorkers = range.Max },
				"capacity" => this with { MinCapacity = range.Min, MaxCapacity = range.Max },
				"lotwidth" => this with { MinLotWidth = range.Min, MaxLotWidth = range.Max },
				"lotdepth" => this with { MinLotDepth = range.Min, MaxLotDepth = range.Max },
				_ => this,
			};
		}

		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			WriteNullable(writer, "minCost", MinCost);
			WriteNullable(writer, "maxCost", MaxCost);
			WriteNullable(writer, "minUpkeep", MinUpkeep);
			WriteNullable(writer, "maxUpkeep", MaxUpkeep);
			WriteNullable(writer, "minWorkers", MinWorkers);
			WriteNullable(writer, "maxWorkers", MaxWorkers);
			WriteNullable(writer, "minCapacity", MinCapacity);
			WriteNullable(writer, "maxCapacity", MaxCapacity);
			WriteNullable(writer, "minLotWidth", MinLotWidth);
			WriteNullable(writer, "maxLotWidth", MaxLotWidth);
			WriteNullable(writer, "minLotDepth", MinLotDepth);
			WriteNullable(writer, "maxLotDepth", MaxLotDepth);
			writer.PropertyName("hasSelection");
			writer.Write(HasSelection);
			writer.TypeEnd();
		}

		private static void WriteNullable(IJsonWriter writer, string name, double? value)
		{
			writer.PropertyName(name);
			if (value.HasValue)
			{
				writer.Write(value.Value);
			}
			else
			{
				writer.WriteNull();
			}
		}
	}
}
