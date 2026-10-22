using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// A bounded query for the asset menu. Range fields are inclusive and are
	/// applied before paging so the returned total is useful to the UI.
	/// </summary>
	public sealed record BuildingCatalogQuery(
		string SearchText = "",
		string SortColumn = "Default",
		// Grouping is a primary sort key, not a separate axis: with paging the two
		// cannot be independent, or a group splits across a page boundary and its
		// heading lies. Empty means the menu's default, from BuildingCatalogGrouping.
		string GroupBy = "",
		// "Unlocked" / "Locked" / "AlreadyBuilt". Empty means all three.
		IReadOnlyList<string>? Availability = null,
		bool Descending = false,
		int Offset = 0,
		// DefaultLimit, which the record's own defaults cannot name.
		int Limit = 40,
		int? MinLotWidth = null,
		int? MaxLotWidth = null,
		int? MinLotDepth = null,
		int? MaxLotDepth = null,
		double? MinConstructionCost = null,
		double? MaxConstructionCost = null,
		double? MinUpkeep = null,
		double? MaxUpkeep = null,
		double? MinWorkers = null,
		double? MaxWorkers = null,
		double? MinCapacity = null,
		double? MaxCapacity = null,
		IReadOnlyList<string>? BuildingTypes = null,
		IReadOnlyList<string>? Provenance = null,
		IReadOnlyList<string>? DlcIds = null,
		IReadOnlyList<string>? Themes = null,
		IReadOnlyList<string>? PlacementFlags = null,
		IReadOnlyList<string>? ZoneTypes = null,
		// The game's own menu placement — UIObject.m_Group — which is the only
		// scope there is.
		string UiMenu = "",
		string UiCategory = "",
		// The fallback strip's selection, as a LIST: the row is single-select, but the
		// same state is offered in the multi-select filter rail, and one field shown
		// twice cannot disagree with itself. The axis is matched by value, not stored.
		IReadOnlyList<string>? StripTabs = null,
		// The school tier the education menu's strip is narrowed to, or -1.
		// SchoolData.m_EducationLevel is 1-based, so 0 is a real value (a capacity
		// upgrade with no tier) and cannot be the sentinel.
		int SchoolTier = -1)
	{
		public int EffectiveOffset => Offset < 0 ? 0 : Offset;

		/// <summary>
		/// The most rows one window will ever hold — a render ceiling, not a page
		/// ceiling, so it sits well above any set a player would read through.
		/// </summary>
		public const int MaxLimit = 2000;

		/// <summary>The window every fresh result set starts at.</summary>
		public const int DefaultLimit = 40;

		/// <summary>How much one Load more adds to the window.</summary>
		public const int WindowStep = 40;

		/// <summary>How many rows this window holds, clamped to <see cref="MaxLimit"/>.</summary>
		public int EffectiveLimit => Limit switch
		{
			< 1 => 1,
			> MaxLimit => MaxLimit,
			_ => Limit,
		};

		/// <summary>Whether this query is pinned to a place in the vanilla build menu.</summary>
		public bool IsScopedToMenu =>
			!string.IsNullOrWhiteSpace(UiMenu) || !string.IsNullOrWhiteSpace(UiCategory);

		public string EffectiveSortColumn => string.IsNullOrWhiteSpace(SortColumn) ? "Default" : SortColumn;

		/// <summary>
		/// This query with the window shrunk back to the base chunk when any predicate
		/// differs from <paramref name="previous"/>, unchanged when only the window moved.
		/// </summary>
		/// <remarks>
		/// A fresh predicate is a fresh set, so it restarts at <see cref="DefaultLimit"/>.
		/// Whole queries are compared rather than named fields, so a new predicate is
		/// covered by default; Offset and Limit are masked out so Load more survives.
		/// </remarks>
		public BuildingCatalogQuery ResetWindowIfPredicatesChanged(BuildingCatalogQuery previous)
		{
			if (previous is null)
			{
				return this;
			}

			return (this with { Offset = 0, Limit = DefaultLimit })
				== (previous with { Offset = 0, Limit = DefaultLimit })
					? this
					: this with { Offset = 0, Limit = DefaultLimit };
		}
	}
}
