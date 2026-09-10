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
		/// Additive, and deliberately not slotted between Medium and High despite
		/// reading there: the existing values are load-bearing, and the reading order is
		/// stated by <see cref="BuildingCatalogGrouping.DensityOrder"/> instead.
		/// </remarks>
		Mixed = 32,

		/// <summary>The game's "Low Rent Housing", which is HIGH density.</summary>
		/// <remarks>
		/// The name invites the opposite reading, so the tier comes from the mechanic
		/// instead: a low-rent zone packs markedly more residential properties into a
		/// unit of space than a high-density one does.
		/// </remarks>
		LowRent = 64,
	}
}
