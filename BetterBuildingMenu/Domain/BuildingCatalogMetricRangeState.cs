using Colossal.UI.Binding;

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

		public bool HasSelection
		{
			get
			{
				for (int i = 0; i < BuildingCatalogMetrics.All.Count; i++)
				{
					BuildingCatalogMetric metric = BuildingCatalogMetrics.All[i];
					if (metric.StateMin(this).HasValue || metric.StateMax(this).HasValue)
					{
						return true;
					}
				}

				return false;
			}
		}

		public static BuildingCatalogMetricRangeState FromQuery(BuildingCatalogQuery query)
		{
			double?[] bounds = new double?[BuildingCatalogMetrics.All.Count * 2];
			for (int i = 0; i < BuildingCatalogMetrics.All.Count; i++)
			{
				bounds[2 * i] = BuildingCatalogMetrics.All[i].QueryMin(query);
				bounds[2 * i + 1] = BuildingCatalogMetrics.All[i].QueryMax(query);
			}

			return FromBounds(bounds);
		}

		/// <summary>
		/// A state from a minimum and a maximum per metric, in <see cref="BuildingCatalogMetrics.All"/>'s
		/// order, which is the order of this record's own parameters.
		/// </summary>
		internal static BuildingCatalogMetricRangeState FromBounds(double?[] bounds) =>
			new(bounds[0], bounds[1], bounds[2], bounds[3], bounds[4], bounds[5],
				bounds[6], bounds[7], bounds[8], bounds[9], bounds[10], bounds[11]);

		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			for (int i = 0; i < BuildingCatalogMetrics.All.Count; i++)
			{
				BuildingCatalogMetric metric = BuildingCatalogMetrics.All[i];
				writer.Prop(metric.MinKey, metric.StateMin(this));
				writer.Prop(metric.MaxKey, metric.StateMax(this));
			}

			writer.Prop("hasSelection", HasSelection);
			writer.TypeEnd();
		}
	}
}
