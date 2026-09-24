namespace BetterBuildingMenu.Domain.Catalog
{
	/// <summary>
	/// What one catalog refresh reads from the indexer, taken once, after the
	/// placed-unique rescan.
	/// </summary>
	/// <remarks>
	/// Every cache the adapter keeps is keyed on <see cref="Generation"/>, which moves
	/// whenever anything a projection depends on changes: a pass, an unlock, a unique
	/// built or bulldozed, a load emptying the index. <see cref="Index"/> and <see cref="Placed"/> are the live
	/// objects, not copies. See docs/indexing.md, "How the panel hears of a change".
	/// </remarks>
	public readonly record struct CatalogSource(CatalogIndex Index, PlacedUniques Placed, int Generation);
}
