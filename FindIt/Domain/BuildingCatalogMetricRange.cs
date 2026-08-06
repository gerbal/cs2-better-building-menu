using System;
using System.Globalization;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// One normalized analytical range at the Building Lens binding boundary.
	/// </summary>
	public sealed record BuildingCatalogMetricRange(string MetricId, double? Min, double? Max)
	{
		private const double AnalyticalMaximum = 1_000_000_000d;
		private const double LotMaximum = 10_000d;

		public static bool TryParse(
			string? metricId,
			string? minText,
			string? maxText,
			out BuildingCatalogMetricRange range)
		{
			string id = metricId?.Trim().ToLowerInvariant() ?? string.Empty;
			if (!IsSupported(id))
			{
				range = new BuildingCatalogMetricRange(string.Empty, null, null);
				return false;
			}

			bool integer = id is "lotwidth" or "lotdepth";
			if (!TryParseBound(minText, integer, out double? min)
				|| !TryParseBound(maxText, integer, out double? max))
			{
				range = new BuildingCatalogMetricRange(id, null, null);
				return false;
			}

			if (min.HasValue && max.HasValue && min.Value > max.Value)
			{
				(min, max) = (max, min);
			}

			range = new BuildingCatalogMetricRange(id, min, max);
			return true;
		}

		public static BuildingCatalogQuery Apply(
			BuildingCatalogQuery query,
			string? metricId,
			string? minText,
			string? maxText)
		{
			if (!TryParse(metricId, minText, maxText, out BuildingCatalogMetricRange range))
			{
				return query;
			}

			return range.MetricId switch
			{
				"cost" => query with { MinConstructionCost = range.Min, MaxConstructionCost = range.Max, Offset = 0 },
				"upkeep" => query with { MinUpkeep = range.Min, MaxUpkeep = range.Max, Offset = 0 },
				"workers" => query with { MinWorkers = range.Min, MaxWorkers = range.Max, Offset = 0 },
				"capacity" => query with { MinCapacity = range.Min, MaxCapacity = range.Max, Offset = 0 },
				"lotwidth" => query with { MinLotWidth = ToInt(range.Min), MaxLotWidth = ToInt(range.Max), Offset = 0 },
				"lotdepth" => query with { MinLotDepth = ToInt(range.Min), MaxLotDepth = ToInt(range.Max), Offset = 0 },
				_ => query,
			};
		}

		public static BuildingCatalogQuery Clear(BuildingCatalogQuery query)
		{
			return query with
			{
				MinConstructionCost = null,
				MaxConstructionCost = null,
				MinUpkeep = null,
				MaxUpkeep = null,
				MinWorkers = null,
				MaxWorkers = null,
				MinCapacity = null,
				MaxCapacity = null,
				MinLotWidth = null,
				MaxLotWidth = null,
				MinLotDepth = null,
				MaxLotDepth = null,
				Offset = 0,
			};
		}

		private static bool IsSupported(string metricId)
		{
			return metricId is "cost" or "upkeep" or "workers" or "capacity" or "lotwidth" or "lotdepth";
		}

		private static bool TryParseBound(string? text, bool integer, out double? value)
		{
			if (string.IsNullOrWhiteSpace(text))
			{
				value = null;
				return true;
			}

			if (!double.TryParse(text.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out double parsed)
				|| double.IsNaN(parsed)
				|| double.IsInfinity(parsed))
			{
				value = null;
				return false;
			}

			double maximum = integer ? LotMaximum : AnalyticalMaximum;
			parsed = Math.Min(maximum, Math.Max(0d, parsed));
			value = integer
				? Math.Round(parsed, MidpointRounding.AwayFromZero)
				: Math.Round(parsed, 2, MidpointRounding.AwayFromZero);
			return true;
		}

		private static int? ToInt(double? value)
		{
			return value.HasValue ? (int)value.Value : null;
		}
	}
}
