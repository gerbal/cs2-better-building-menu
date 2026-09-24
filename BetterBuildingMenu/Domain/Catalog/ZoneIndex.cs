using BetterBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain.Catalog
{
	/// <summary>
	/// The zones as a full pass read them: how each classifies its buildings, its own density
	/// tier, the lots it grows, and the catalog the zoning surface browses.
	/// </summary>
	/// <remarks>
	/// Fixed once built; a new pass builds a new one. Keyed by the zone prefab entity's index,
	/// as <see cref="PrefabIndex.Id"/> is. IndexZones in PrefabIndexingSystem fills it.
	/// </remarks>
	public sealed class ZoneIndex
	{
		private readonly IReadOnlyDictionary<int, ZoneTypeFilter> _types;
		private readonly IReadOnlyDictionary<int, ZoneTypeFilter> _densities;
		private readonly IReadOnlyDictionary<int, ZoneLotSizes> _lotSizes;

		/// <summary>No zones at all, as before the first pass.</summary>
		public static ZoneIndex Empty { get; } = new(
			new Dictionary<int, ZoneTypeFilter>(),
			new Dictionary<int, ZoneTypeFilter>(),
			new Dictionary<int, ZoneLotSizes>(),
			Array.Empty<ZoneCatalogEntry>());

		/// <param name="types">The building-side answer per zone, by which a building is filtered.</param>
		/// <param name="densities">Each zone's own tier, which adds Mixed and LowRent.</param>
		/// <param name="lotSizes">The lot shapes each zone's spawnable buildings actually take.</param>
		/// <param name="catalog">Every assignable zone, grouped by family in the zoning hierarchy.</param>
		public ZoneIndex(
			IReadOnlyDictionary<int, ZoneTypeFilter> types,
			IReadOnlyDictionary<int, ZoneTypeFilter> densities,
			IReadOnlyDictionary<int, ZoneLotSizes> lotSizes,
			IReadOnlyList<ZoneCatalogEntry> catalog)
		{
			_types = types;
			_densities = densities;
			_lotSizes = lotSizes;
			Catalog = catalog;
		}

		/// <summary>Every assignable zone, for the menu audit.</summary>
		public IReadOnlyList<ZoneCatalogEntry> Catalog { get; }

		/// <summary>How a zone classifies the buildings that grow in it. Any when it has no entry.</summary>
		/// <remarks>Kept apart from <see cref="DensityOf"/>, which classifies the zone itself;
		/// widening this one would reclassify thousands of buildings.</remarks>
		public ZoneTypeFilter TypeOf(int zonePrefab) =>
			_types.TryGetValue(zonePrefab, out var type) ? type : ZoneTypeFilter.Any;

		/// <summary>The zone's own density tier. Any when it has none.</summary>
		/// <remarks>Fails soft like <see cref="TypeOf"/>, so a zone the pass never saw reads the
		/// same as an untiered one.</remarks>
		public ZoneTypeFilter DensityOf(int zonePrefab) =>
			_densities.TryGetValue(zonePrefab, out var density) ? density : ZoneTypeFilter.Any;

		/// <summary>The lot shapes a zone grows, or none.</summary>
		public ZoneLotSizes? LotSizesOf(int zonePrefab) =>
			_lotSizes.TryGetValue(zonePrefab, out var sizes) ? sizes : null;
	}
}
