namespace BetterBuildingMenu.Domain.Enums
{
	public enum ZoneTypeFilter
	{
		Any = 0,
		Low = 1,
		Row = 2,
		Medium = 4,
		High = 8,
		Signature = 16,

		/// <summary>Residential over commerce — the game's "Mixed Housing".</summary>
		/// <remarks>
		/// Additive, and deliberately NOT slotted between Medium and High
		/// despite reading there. The existing values are load-bearing for
		/// anything that already compared one, and the reading order is stated
		/// by <see cref="BuildingCatalogGrouping.DensityOrder"/> instead — where
		/// it can be seen, rather than hidden in a numbering nobody reads as an
		/// ordering.
		///
		/// Identified from the zone's own data: a residential zone whose
		/// ZonePropertiesData allows goods to be sold is mixed use. Measured
		/// exact across all thirteen shipped mixed zones, with no false
		/// positives — including UK London Townhouse, which a name test
		/// captures and the data does not.
		/// </remarks>
		Mixed = 32,

		/// <summary>The game's "Low Rent Housing", which is HIGH density.</summary>
		/// <remarks>
		/// The name invites the opposite reading and the name-stem table took
		/// it: "LowRent" contains "Low", and Low was tested first, so every
		/// low-rent zone read as low density.
		///
		/// Measured, these zones pack four residential properties into one unit
		/// of space where high density gets two — which is the mechanic, and
		/// why the ratio is what identifies them.
		/// </remarks>
		LowRent = 64,
	}
}
