using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>One field the asset menu can be sorted by: the ids that name it, how it orders
	/// entries, and the value two entries tie on.</summary>
	public sealed class BuildingCatalogSortColumn : IDescriptor
	{
		private readonly DescriptorIds _ids;

		internal BuildingCatalogSortColumn(
			string id,
			Func<IOrderedEnumerable<BuildingCatalogEntry>, bool, IOrderedEnumerable<BuildingCatalogEntry>> thenBy,
			Func<BuildingCatalogEntry, object?> tieValue,
			params string[] aliases)
		{
			Id = id;
			ThenBy = thenBy;
			TieValue = tieValue;
			_ids = new DescriptorIds(id, aliases);
		}

		/// <summary>The id the picker sends.</summary>
		public string Id { get; }

		/// <summary>This column's order beneath the keys already applied, descending when asked.</summary>
		public Func<IOrderedEnumerable<BuildingCatalogEntry>, bool, IOrderedEnumerable<BuildingCatalogEntry>> ThenBy { get; }

		/// <summary>The value two entries tie on, or null when the entry has none.</summary>
		/// <remarks>Not the order's key, which is typed so each field keeps its own comparer: whether two
		/// entries tie is a weaker question, which equality alone settles.</remarks>
		public Func<BuildingCatalogEntry, object?> TieValue { get; }

		DescriptorIds IDescriptor.Ids => _ids;
	}

	/// <summary>The columns the picker offers, in its order; any other id sorts by <see cref="Name"/>.</summary>
	/// <remarks>Here rather than in the UI because the backend answers which of them can reorder the
	/// current set. The UI's ids are generated from <see cref="Ids"/> by SharedContractsTests.</remarks>
	public static class BuildingCatalogSortColumns
	{
		/// <summary>The game's own order, which no other column reproduces: see BuildingCatalogEntry.UIOrder.</summary>
		/// <remarks>Name second, so two assets vanilla gave the same priority do not swap under the
		/// cursor. A tie is judged by name alone.</remarks>
		public static readonly BuildingCatalogSortColumn Default = new(
			"Default",
			(seed, descending) => descending
				? seed.ThenByDescending(entry => entry.UIOrder).ThenByDescending(entry => entry.Name, StringComparer.OrdinalIgnoreCase)
				: seed.ThenBy(entry => entry.UIOrder).ThenBy(entry => entry.Name, StringComparer.OrdinalIgnoreCase),
			entry => entry.Name);

		public static readonly BuildingCatalogSortColumn Name = Text("Name", entry => entry.Name);

		public static readonly IReadOnlyList<BuildingCatalogSortColumn> All = new[]
		{
			// First, and the default.
			Default,
			Name,
			Text("Category", entry => entry.Category),
			Measure("ConstructionCost", BuildingCatalogMetrics.Cost, "Cost"),
			Measure("Upkeep", BuildingCatalogMetrics.Upkeep),
			Measure("Workers", BuildingCatalogMetrics.Workers),
			Measure("Capacity", BuildingCatalogMetrics.Capacity),
			Measure("LotWidth", BuildingCatalogMetrics.LotWidth),
			Measure("LotDepth", BuildingCatalogMetrics.LotDepth),
			Whole("BuildingLevel", entry => entry.BuildingLevel),
			// By bay count, not by the flag: sorting on a flag leaves the order inside each of its two
			// buckets untouched.
			Whole("HasParking", entry => entry.ParkingSlots),
			// What a park gives, as its hover card says it: the leisure it provides and the game's
			// attractiveness. Only parks carry them, so the picker offers them only where parks are.
			Optional("Recreation", entry => entry.LeisureEfficiency),
			Optional("Attractiveness", entry => FactOf(entry, "attractiveness")),
		};

		/// <summary>The ids of <see cref="All"/>, in the picker's order.</summary>
		public static readonly IReadOnlyList<string> Ids = All.Select(column => column.Id).ToArray();

		/// <summary>The column an id names, ignoring case; <see cref="Name"/> when it names none.</summary>
		/// <remarks>Untrimmed, unlike the other tables: a padded id names no column.</remarks>
		public static BuildingCatalogSortColumn Find(string? id) => DescriptorIds.Find(All, id) ?? Name;

		private static BuildingCatalogSortColumn Text(string id, Func<BuildingCatalogEntry, string> key) =>
			new(
				id,
				(seed, descending) => descending
					? seed.ThenByDescending(key, StringComparer.OrdinalIgnoreCase)
					: seed.ThenBy(key, StringComparer.OrdinalIgnoreCase),
				key);

		private static BuildingCatalogSortColumn Whole(string id, Func<BuildingCatalogEntry, int> key) =>
			new(
				id,
				(seed, descending) => descending ? seed.ThenByDescending(key) : seed.ThenBy(key),
				entry => key(entry));

		/// <summary>A range metric, read from its own row. An entry may not carry it: those that do
		/// come first, whichever way it runs.</summary>
		private static BuildingCatalogSortColumn Measure(string id, BuildingCatalogMetric metric, params string[] aliases) =>
			Optional(id, metric.EntryValue, aliases);

		/// <summary>A figure an entry may not carry: those that do come first, whichever way it runs.</summary>
		private static BuildingCatalogSortColumn Optional(string id, Func<BuildingCatalogEntry, double?> key, params string[] aliases) =>
			new(
				id,
				(seed, descending) =>
				{
					var presentFirst = seed.ThenBy(entry => key(entry).HasValue ? 0 : 1);
					return descending ? presentFirst.ThenByDescending(key) : presentFirst.ThenBy(key);
				},
				entry => key(entry),
				aliases);

		/// <summary>One of the entry's service facts, by key; null where it has none.</summary>
		private static double? FactOf(BuildingCatalogEntry entry, string key)
		{
			if (entry.ServiceFacts is { } facts)
			{
				foreach (var fact in facts)
				{
					if (string.Equals(fact.Key, key, StringComparison.Ordinal))
					{
						return fact.Value;
					}
				}
			}

			return null;
		}
	}
}
