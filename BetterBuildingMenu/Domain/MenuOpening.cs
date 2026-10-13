namespace BetterBuildingMenu.Domain
{
	/// <summary>Where a menu opens: its tab, Education's level, and the row its list starts at.</summary>
	/// <param name="Category">The tab, or empty for All.</param>
	/// <param name="SchoolTier">Education's level (1-4), or -1 for none.</param>
	/// <param name="Anchor">The row the list starts at, as the index's id, or 0 for its top.</param>
	public sealed record MenuOpening(string Category, int SchoolTier, int Anchor)
	{
		/// <summary>All, at its top: a menu the open rule finds no tab in.</summary>
		public static MenuOpening All { get; } = new(string.Empty, -1, 0);
	}
}
