using Colossal.UI.Binding;

using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Normalized metric ranges published to the controlled asset menu drawer.
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

		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.Prop("minCost", MinCost);
			writer.Prop("maxCost", MaxCost);
			writer.Prop("minUpkeep", MinUpkeep);
			writer.Prop("maxUpkeep", MaxUpkeep);
			writer.Prop("minWorkers", MinWorkers);
			writer.Prop("maxWorkers", MaxWorkers);
			writer.Prop("minCapacity", MinCapacity);
			writer.Prop("maxCapacity", MaxCapacity);
			writer.Prop("minLotWidth", MinLotWidth);
			writer.Prop("maxLotWidth", MaxLotWidth);
			writer.Prop("minLotDepth", MinLotDepth);
			writer.Prop("maxLotDepth", MaxLotDepth);
			writer.Prop("hasSelection", HasSelection);
			writer.TypeEnd();
		}
	}
}
