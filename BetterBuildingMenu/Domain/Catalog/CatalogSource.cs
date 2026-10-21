namespace BetterBuildingMenu.Domain.Catalog
{
	/// <summary>
	/// What one catalog refresh reads from the indexer, taken once, after the
	/// placed-unique rescan.
	/// </summary>
	/// <remarks>
	/// <see cref="Index"/> and <see cref="Placed"/> are the live objects, not copies. The
	/// generation is how the asset menu hears of a change; see IndexWatch.
	/// </remarks>
	public readonly record struct CatalogSource(
		CatalogIndex Index, PlacedUniques Placed, int Generation)
	{
		/// <summary>Moves when the index's contents change, but not for a lock or a placed unique,
		/// which move <see cref="Generation"/> alone.</summary>
		/// <remarks>Null when the source does not tell the two apart: then every generation is a
		/// change of contents.</remarks>
		public int? ContentGeneration { get; init; }
	}
}
