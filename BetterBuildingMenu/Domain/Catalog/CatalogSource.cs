namespace BetterBuildingMenu.Domain.Catalog
{
	/// <summary>
	/// What one catalog refresh reads from the indexer, taken once at its start.
	/// </summary>
	/// <remarks>
	/// Every cache the adapter keeps is keyed on <see cref="Generation"/>, which moves
	/// whenever anything a projection depends on changes: a pass, an unlock, a unique
	/// built or bulldozed. See docs/indexing.md, "How the panel hears of a change".
	/// </remarks>
	public readonly record struct CatalogSource(PlacedUniques Placed, int Generation);
}
