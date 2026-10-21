using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One metric a player can bound with a range: where its value sits on an entry, on the
	/// query and on the published state, and the keys its bounds are published under.
	/// </summary>
	public sealed class BuildingCatalogMetric
	{
		internal BuildingCatalogMetric(
			string id,
			string jsonKey,
			bool integer,
			Func<BuildingCatalogEntry, double?> entryValue,
			Func<BuildingCatalogQuery, double?> queryMin,
			Func<BuildingCatalogQuery, double?> queryMax,
			Func<BuildingCatalogQuery, double?, double?, BuildingCatalogQuery> queryWith,
			Func<BuildingCatalogMetricRangeState, double?> stateMin,
			Func<BuildingCatalogMetricRangeState, double?> stateMax)
		{
			Id = id;
			MinKey = "min" + jsonKey;
			MaxKey = "max" + jsonKey;
			Integer = integer;
			EntryValue = entryValue;
			QueryMin = queryMin;
			QueryMax = queryMax;
			QueryWith = queryWith;
			StateMin = stateMin;
			StateMax = stateMax;
		}

		/// <summary>The id the UI sends with a range.</summary>
		public string Id { get; }

		public string MinKey { get; }

		public string MaxKey { get; }

		/// <summary>Whether a bound is a whole number: a lot is measured in cells.</summary>
		public bool Integer { get; }

		/// <summary>The entry's value, or null when it does not carry the metric.</summary>
		public Func<BuildingCatalogEntry, double?> EntryValue { get; }

		public Func<BuildingCatalogQuery, double?> QueryMin { get; }

		public Func<BuildingCatalogQuery, double?> QueryMax { get; }

		/// <summary>The query with this metric's range replaced by the bounds given.</summary>
		public Func<BuildingCatalogQuery, double?, double?, BuildingCatalogQuery> QueryWith { get; }

		public Func<BuildingCatalogMetricRangeState, double?> StateMin { get; }

		public Func<BuildingCatalogMetricRangeState, double?> StateMax { get; }
	}

	/// <summary>The metrics a range can bound, in the order the drawer lists them and the state writes them.</summary>
	/// <remarks>
	/// The UI's ids and bound keys are generated from <see cref="All"/>: see
	/// sharedContracts.generated.ts and SharedContractsTests.
	/// </remarks>
	public static class BuildingCatalogMetrics
	{
		public static readonly IReadOnlyList<BuildingCatalogMetric> All = new[]
		{
			new BuildingCatalogMetric(
				"cost", "Cost", integer: false,
				entry => entry.ConstructionCost,
				query => query.MinConstructionCost, query => query.MaxConstructionCost,
				(query, min, max) => query with { MinConstructionCost = min, MaxConstructionCost = max },
				state => state.MinCost, state => state.MaxCost),
			new BuildingCatalogMetric(
				"upkeep", "Upkeep", integer: false,
				entry => entry.Upkeep,
				query => query.MinUpkeep, query => query.MaxUpkeep,
				(query, min, max) => query with { MinUpkeep = min, MaxUpkeep = max },
				state => state.MinUpkeep, state => state.MaxUpkeep),
			new BuildingCatalogMetric(
				"workers", "Workers", integer: false,
				entry => entry.Workers,
				query => query.MinWorkers, query => query.MaxWorkers,
				(query, min, max) => query with { MinWorkers = min, MaxWorkers = max },
				state => state.MinWorkers, state => state.MaxWorkers),
			new BuildingCatalogMetric(
				"capacity", "Capacity", integer: false,
				entry => entry.Capacity,
				query => query.MinCapacity, query => query.MaxCapacity,
				(query, min, max) => query with { MinCapacity = min, MaxCapacity = max },
				state => state.MinCapacity, state => state.MaxCapacity),
			new BuildingCatalogMetric(
				"lotWidth", "LotWidth", integer: true,
				entry => entry.LotWidth,
				query => query.MinLotWidth, query => query.MaxLotWidth,
				(query, min, max) => query with { MinLotWidth = ToInt(min), MaxLotWidth = ToInt(max) },
				state => state.MinLotWidth, state => state.MaxLotWidth),
			new BuildingCatalogMetric(
				"lotDepth", "LotDepth", integer: true,
				entry => entry.LotDepth,
				query => query.MinLotDepth, query => query.MaxLotDepth,
				(query, min, max) => query with { MinLotDepth = ToInt(min), MaxLotDepth = ToInt(max) },
				state => state.MinLotDepth, state => state.MaxLotDepth),
		};

		/// <summary>The metric with this id, ignoring case and surrounding space.</summary>
		public static bool TryFind(string? id, [NotNullWhen(true)] out BuildingCatalogMetric? metric)
		{
			string trimmed = id?.Trim() ?? string.Empty;

			for (int i = 0; i < All.Count; i++)
			{
				if (string.Equals(All[i].Id, trimmed, StringComparison.OrdinalIgnoreCase))
				{
					metric = All[i];
					return true;
				}
			}

			metric = null;
			return false;
		}

		private static int? ToInt(double? value) => value.HasValue ? (int)value.Value : null;
	}
}
