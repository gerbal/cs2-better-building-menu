using System.Collections.Generic;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// A bounded query for the building lens. Range fields are inclusive and are
	/// applied before paging so the returned total is useful to the UI.
	/// </summary>
	public sealed record BuildingCatalogQuery(
		string SearchText = "",
		string SortColumn = "Name",
		// Grouping is a primary sort key rather than a separate axis: with
		// paging the two cannot be independent, or a group splits across a page
		// boundary and its heading lies about what it contains.
		string GroupBy = "none",
		// "Locked" / "Unlocked". Empty means both.
		IReadOnlyList<string>? Availability = null,
		bool Descending = false,
		int Offset = 0,
		int Limit = 100,
		int? MinLotWidth = null,
		int? MaxLotWidth = null,
		int? MinLotDepth = null,
		int? MaxLotDepth = null,
		int? MinBuildingLevel = null,
		int? MaxBuildingLevel = null,
		double? MinConstructionCost = null,
		double? MaxConstructionCost = null,
		double? MinUpkeep = null,
		double? MaxUpkeep = null,
		double? MinWorkers = null,
		double? MaxWorkers = null,
		double? MinCapacity = null,
		double? MaxCapacity = null,
		double? MinElectricityConsumption = null,
		double? MaxElectricityConsumption = null,
		double? MinWaterConsumption = null,
		double? MaxWaterConsumption = null,
		IReadOnlyList<string>? BuildingTypes = null,
		IReadOnlyList<string>? Provenance = null,
		IReadOnlyList<string>? DlcIds = null,
		IReadOnlyList<string>? Themes = null,
		IReadOnlyList<string>? PlacementFlags = null,
		IReadOnlyList<string>? Extensions = null,
		// Zone density (Low/Row/Medium/High/Signature) was indexed on every
		// entry and sorted on, but had no query field, so the levels the
		// vanilla Zones menu is organised around could not be filtered.
		IReadOnlyList<string>? ZoneTypes = null,
		// The game's own menu placement — UIObject.m_Group — which is the only
		// scope there is.
		string UiMenu = "",
		string UiCategory = "",
		// The fallback strip's selection. The AXIS is not here: nothing in the
		// predicate reads it — a tab is matched by value on whichever axis
		// names it (see BuildingCatalogQueryEngine.StripMatches) — so it lives
		// on the system as a published fact, not on the query as a filter.
		// The strip's tabs, as a LIST. The row itself is single-select and
		// writes one entry, but the same state is offered in the filter rail
		// where every other control is multi-select — and one field shown twice
		// cannot disagree with itself, which two fields would.
		IReadOnlyList<string>? StripTabs = null,
		// The school tier the education menu's strip is narrowed to, or
		// -1. SchoolData.m_EducationLevel is 1-based, so
		// 0 is a real value (a capacity upgrade with no tier) and cannot be the
		// sentinel.
		int SchoolTier = -1)
	{
		/// <summary>
		/// The sort fields the picker offers. Mirrored in
		/// buildingLensSortPresentation.ts's BUILDING_LENS_SORT_OPTIONS.
		/// </summary>
		/// <remarks>
		/// Here rather than in the UI because the backend has to answer which of
		/// them can actually reorder the current set, and asking about a field
		/// the picker never shows would be wasted work.
		/// </remarks>
		public static readonly string[] OfferedSortColumns =
		{
			"Name", "Category", "ConstructionCost", "Upkeep", "Workers",
			"Capacity", "LotWidth", "LotDepth", "BuildingLevel", "HasParking",
		};

		public int EffectiveOffset => Offset < 0 ? 0 : Offset;

		/// <summary>
		/// The most rows one window will ever hold — a render ceiling now, not a
		/// page ceiling. 500 was as far as one page was allowed to reach; the
		/// window grows into this instead, and the whole catalog is 3,667, so a
		/// limit the player can hit by holding Load more has to sit well above
		/// the largest set they might reasonably read through.
		/// </summary>
		public const int MaxLimit = 2000;

		/// <summary>The window every fresh result set starts at.</summary>
		public const int DefaultLimit = 100;

		/// <summary>How much one Load more adds to the window.</summary>
		public const int WindowStep = 100;

		/// <summary>
		/// How many rows this window holds.
		/// </summary>
		/// <remarks>
		/// A menu-scoped query used to be forced to <see cref="MaxLimit"/>, on
		/// the argument that a vanilla menu is one set rather than a sequence of
		/// pages: the player clicked Roads and is looking at "the roads", not at
		/// "rows 1-100 of 157". That argument was against a PAGER, and the pager
		/// is gone — one growing window plus search covers a menu without
		/// inventing a boundary the game does not have.
		///
		/// What the special case did cost is that the window size changed under
		/// the player the moment they entered a menu, and changed back when they
		/// left, for no reason they could see. So the limit is now whatever was
		/// asked for, scoped or not.
		/// </remarks>
		public int EffectiveLimit => Limit switch
		{
			< 1 => 1,
			> MaxLimit => MaxLimit,
			_ => Limit,
		};

		/// <summary>Whether this query is pinned to a place in the vanilla build menu.</summary>
		public bool IsScopedToMenu =>
			!string.IsNullOrWhiteSpace(UiMenu) || !string.IsNullOrWhiteSpace(UiCategory);

		public string EffectiveSortColumn => string.IsNullOrWhiteSpace(SortColumn) ? "Name" : SortColumn;

		/// <summary>
		/// Returns this query with the window shrunk back to the base chunk when
		/// any predicate differs from <paramref name="previous"/>, and unchanged
		/// when only the window itself moved.
		/// </summary>
		/// <remarks>
		/// The individual facet, range, and sort handlers each reset the window
		/// themselves, but the query is also rebuilt wholesale from ambient
		/// state on every refresh — search text, the legacy FindIt parking
		/// filters, the lens section, and the metric drawer all arrive that way
		/// and previously left it untouched. A player who narrowed a result set
		/// after growing the window kept a window sized for the old one. A fresh
		/// predicate is a fresh set, so it starts at <see cref="DefaultLimit"/>.
		/// Comparing whole queries rather than enumerating fields keeps new
		/// predicates covered by default instead of silently opting out until
		/// someone remembers to add them here.
		///
		/// Both Offset and Limit are masked out of that comparison. Load more
		/// changes nothing but Limit, so counting Limit as a predicate would
		/// make the window reset itself the instant it grew.
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
