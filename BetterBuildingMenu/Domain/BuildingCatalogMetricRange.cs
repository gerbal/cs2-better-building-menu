using System;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One normalized analytical range at the asset menu binding boundary.
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
			if (!TryParse(metricId, minText, maxText, out BuildingCatalogMetric? metric, out double? min, out double? max))
			{
				range = new BuildingCatalogMetricRange(metric?.Id ?? string.Empty, null, null);
				return false;
			}

			range = new BuildingCatalogMetricRange(metric.Id, min, max);
			return true;
		}

		public static BuildingCatalogQuery Apply(
			BuildingCatalogQuery query,
			string? metricId,
			string? minText,
			string? maxText)
		{
			return TryParse(metricId, minText, maxText, out BuildingCatalogMetric? metric, out double? min, out double? max)
				? metric.QueryWith(query, min, max) with { Offset = 0 }
				: query;
		}

		public static BuildingCatalogQuery Clear(BuildingCatalogQuery query)
		{
			for (int i = 0; i < BuildingCatalogMetrics.All.Count; i++)
			{
				query = BuildingCatalogMetrics.All[i].QueryWith(query, null, null);
			}

			return query with { Offset = 0 };
		}

		private static bool TryParse(
			string? metricId,
			string? minText,
			string? maxText,
			[NotNullWhen(true)] out BuildingCatalogMetric? metric,
			out double? min,
			out double? max)
		{
			min = null;
			max = null;
			if (!BuildingCatalogMetrics.TryFind(metricId, out metric)
				|| !TryParseBound(minText, metric.Integer, out min)
				|| !TryParseBound(maxText, metric.Integer, out max))
			{
				return false;
			}

			if (min.HasValue && max.HasValue && min.Value > max.Value)
			{
				(min, max) = (max, min);
			}

			return true;
		}

		private static bool TryParseBound(string? text, bool integer, out double? value)
		{
			if (text?.Trim() is not { Length: > 0 } trimmed)
			{
				value = null;
				return true;
			}

			if (!double.TryParse(trimmed, NumberStyles.Float, CultureInfo.InvariantCulture, out double parsed)
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
	}
}
