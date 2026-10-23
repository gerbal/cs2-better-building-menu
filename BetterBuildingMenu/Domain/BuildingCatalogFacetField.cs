using BetterBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>One filter facet: the ids a toggle answers to, where its selection sits on the query,
	/// and what an entry answers with.</summary>
	public sealed class BuildingCatalogFacetField : IDescriptor
	{
		private readonly DescriptorIds _ids;
		private readonly Func<BuildingCatalogEntry, string?>? _value;
		private readonly Func<BuildingCatalogEntry, IReadOnlyList<string>?>? _values;

		internal BuildingCatalogFacetField(
			string id,
			string? label,
			Func<BuildingCatalogQuery, IReadOnlyList<string>?> selected,
			Func<BuildingCatalogQuery, IReadOnlyList<string>?, BuildingCatalogQuery> queryWith,
			Func<BuildingCatalogEntry, IReadOnlyList<string>, bool>? matches,
			Func<BuildingCatalogEntry, string?>? value = null,
			Func<BuildingCatalogEntry, IReadOnlyList<string>?>? values = null,
			IReadOnlyList<string>? exhaustive = null,
			Func<string, string>? optionValue = null,
			string? alias = null)
		{
			Id = id;
			Label = label;
			Selected = selected;
			QueryWith = queryWith;
			Matches = matches;
			_value = value;
			_values = values;
			Exhaustive = exhaustive;
			OptionValue = optionValue ?? (option => option);
			_ids = alias is null ? new DescriptorIds(id) : new DescriptorIds(id, alias);
		}

		/// <summary>The id the UI sends back.</summary>
		public string Id { get; }

		/// <summary>The rail's heading; null for a facet the adapter does not publish.</summary>
		public string? Label { get; }

		/// <summary>The query's selection on this facet; null or empty when nothing is picked.</summary>
		public Func<BuildingCatalogQuery, IReadOnlyList<string>?> Selected { get; }

		/// <summary>The query with this facet's selection replaced.</summary>
		public Func<BuildingCatalogQuery, IReadOnlyList<string>?, BuildingCatalogQuery> QueryWith { get; }

		/// <summary>Whether an entry answers to a non-empty selection; null where the engine does not filter.</summary>
		public Func<BuildingCatalogEntry, IReadOnlyList<string>, bool>? Matches { get; }

		/// <summary>Every option, when the options cover every asset; null when they are open-ended.</summary>
		public IReadOnlyList<string>? Exhaustive { get; }

		/// <summary>What a toggled option id stands for in the selection; empty when it is not this facet's to toggle.</summary>
		internal Func<string, string> OptionValue { get; }

		/// <summary>Every value the entries answer with, blanks and repeats included.</summary>
		public IEnumerable<string?> ValuesIn(IEnumerable<BuildingCatalogEntry> entries) =>
			_value is not null ? entries.Select(_value)
			: _values is not null ? entries.SelectMany(entry => (IEnumerable<string>?)_values(entry) ?? Array.Empty<string>())
			: Enumerable.Empty<string?>();

		DescriptorIds IDescriptor.Ids => _ids;
	}

	/// <summary>The facets a query can filter on.</summary>
	/// <remarks>FacetIds.All, and through it the UI's FacetId, come from <see cref="Published"/>, the
	/// order the adapter emits its groups in.</remarks>
	public static class BuildingCatalogFacetFields
	{
		public static readonly BuildingCatalogFacetField BuildingType = OneValue(
			FacetIds.BuildingType, "Role",
			query => query.BuildingTypes, (query, selection) => query with { BuildingTypes = selection },
			entry => entry.BuildingType);

		public static readonly BuildingCatalogFacetField Provenance = OneValue(
			FacetIds.Provenance, "Source",
			query => query.Provenance, (query, selection) => query with { Provenance = selection },
			entry => entry.Provenance);

		/// <summary>Progression, which the vanilla menu shows only by greying an asset out.</summary>
		public static readonly BuildingCatalogFacetField Availability = OneValue(
			FacetIds.Availability, "Availability",
			query => query.Availability, (query, selection) => query with { Availability = selection },
			BuildingCatalogFacetSelection.Availability.Of,
			BuildingCatalogFacetSelection.Availability.All);

		/// <summary>Where it came from. Only its DLC options toggle here: the game owns packs and the base game.</summary>
		/// <remarks>The engine does not filter on it: the adapter's ContentVisible applies DlcIds, so it UNIONS
		/// with the game's own selection rather than intersecting it.</remarks>
		public static readonly BuildingCatalogFacetField Content = new(
			FacetIds.Content, "Content",
			query => query.DlcIds, (query, selection) => query with { DlcIds = selection },
			matches: null,
			optionValue: ContentOption.DlcIdOf,
			alias: "dlc");

		public static readonly BuildingCatalogFacetField Theme = OneValue(
			FacetIds.Theme, "Theme",
			query => query.Themes, (query, selection) => query with { Themes = selection },
			entry => entry.Theme);

		/// <summary>Any flag, not all, the way every other facet reads: the rail draws them identically,
		/// and "road or water" is the question a player asks.</summary>
		public static readonly BuildingCatalogFacetField Placement = new(
			FacetIds.Placement, "Placement",
			query => query.PlacementFlags, (query, selection) => query with { PlacementFlags = selection },
			(entry, selection) => MatchesAny(entry.PlacementFlags, selection),
			values: entry => entry.PlacementFlags);

		/// <summary>What a parking building parks; the game has no motorcycle type.</summary>
		public static readonly BuildingCatalogFacetField Vehicle = new(
			FacetIds.Vehicle, "Vehicle",
			query => query.ParkingVehicles, (query, selection) => query with { ParkingVehicles = selection },
			(entry, selection) => entry.ParkingVehicles is { } vehicles && vehicles.Any(vehicle => MatchesAny(vehicle, selection)),
			values: entry => entry.ParkingVehicles);

		/// <summary>Zone density by enum name. Not published: the density tiers are the top bar's tabs.</summary>
		public static readonly BuildingCatalogFacetField Zone = new(
			"zone", label: null,
			query => query.ZoneTypes, (query, selection) => query with { ZoneTypes = selection },
			(entry, selection) => MatchesZoneType(entry.ZoneType, selection),
			alias: "zonetype");

		/// <summary>Every facet, the ones the adapter publishes first in its order.</summary>
		public static readonly IReadOnlyList<BuildingCatalogFacetField> All = new[]
		{
			BuildingType, Provenance, Availability, Content, Theme, Placement, Vehicle, Zone,
		};

		/// <summary>The facets the adapter publishes, in the order it emits them.</summary>
		public static readonly IReadOnlyList<BuildingCatalogFacetField> Published = All.Where(facet => facet.Label is not null).ToArray();

		/// <summary>The facet an id names, ignoring case and surrounding space.</summary>
		public static bool TryFind(string? id, [NotNullWhen(true)] out BuildingCatalogFacetField? facet)
		{
			facet = DescriptorIds.Find(All, id?.Trim());
			return facet is not null;
		}

		/// <summary>A facet each entry answers with one value, matched ignoring case.</summary>
		private static BuildingCatalogFacetField OneValue(
			string id,
			string label,
			Func<BuildingCatalogQuery, IReadOnlyList<string>?> selected,
			Func<BuildingCatalogQuery, IReadOnlyList<string>?, BuildingCatalogQuery> queryWith,
			Func<BuildingCatalogEntry, string?> value,
			IReadOnlyList<string>? exhaustive = null) =>
			new(id, label, selected, queryWith, (entry, selection) => MatchesAny(value(entry), selection), value: value, exhaustive: exhaustive);

		private static bool MatchesAny(string? value, IReadOnlyList<string> selected) =>
			value is not null && selected.ContainsIgnoreCase(value);

		private static bool MatchesAny(IReadOnlyList<string>? values, IReadOnlyList<string> selected)
		{
			if (values is null)
			{
				return false;
			}

			for (var i = 0; i < values.Count; i++)
			{
				if (selected.ContainsIgnoreCase(values[i]))
				{
					return true;
				}
			}

			return false;
		}

		/// <summary>An unrecognised name matches nothing rather than everything: a broken preset should
		/// look broken, not wide open.</summary>
		private static bool MatchesZoneType(ZoneTypeFilter value, IReadOnlyList<string> selected)
		{
			for (var i = 0; i < selected.Count; i++)
			{
				if (Enum.TryParse<ZoneTypeFilter>(selected[i], ignoreCase: true, out var parsed) && parsed == value)
				{
					return true;
				}
			}

			return false;
		}
	}
}
