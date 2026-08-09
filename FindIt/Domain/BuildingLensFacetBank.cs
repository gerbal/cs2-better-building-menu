namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// Where a building-lens facet dimension is drawn: as an icon row in the
	/// options bank, or as an entry in the filter rail.
	/// </summary>
	/// <remarks>
	/// The rule is a single threshold, and both sides of the C#/TS boundary have
	/// to agree on it. The bank draws a dimension of <see cref="BankThreshold"/>
	/// options or fewer; the rail's railHomeFor returns "bank" for the same
	/// range and so declines to draw it. If the two numbers ever diverge, a
	/// dimension is drawn twice in two different idioms — or by neither side.
	///
	/// It lives here, public, rather than as a private const on
	/// BuildingLensFacetOptionBase, for the same reason
	/// <see cref="BuildingLensWidth"/> does: the option classes are internal and
	/// hang off a live UI system, so a contract value buried in one is not
	/// reachable from a test. A duplicated constant nothing checks is how the
	/// two sides drift.
	/// </remarks>
	public static class BuildingLensFacetBank
	{
		/// <summary>
		/// Matches RAIL_BANK_THRESHOLD in UI/src/domain/filterRail.ts, which a
		/// test asserts.
		/// </summary>
		public const int BankThreshold = 8;

		/// <summary>
		/// Whether a dimension of this many options belongs in the options bank.
		/// </summary>
		/// <remarks>
		/// Zero options is not "short enough" — it is a dimension with nothing
		/// to show, and an empty icon row is a heading over blank space.
		/// </remarks>
		public static bool BelongsInBank(int optionCount)
		{
			return optionCount > 0 && optionCount <= BankThreshold;
		}
	}
}
