using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// A bounded query for the building lens. Range fields are inclusive and are
	/// applied before paging so the returned total is useful to the UI.
	/// </summary>
	public sealed record BuildingCatalogQuery(
		string SearchText = "",
		string SortColumn = "Default",
		// Grouping is a primary sort key, not a separate axis: with paging the two
		// cannot be independent, or a group splits across a page boundary and its
		// heading lies. Empty means the menu's default, from BuildingCatalogGrouping.
		string GroupBy = "",
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
		/// <summary>
		/// The sort fields the picker offers, in its order.
		/// </summary>
		/// <remarks>
		/// Here rather than in the UI because the backend has to answer which of them
		/// can actually reorder the current set. The UI's copy is generated from this.
		/// </remarks>
		public static readonly IReadOnlyList<string> OfferedSortColumns = new[]
		{
			// First, and the default. It is the game's own order — see
			// BuildingCatalogEntry.UIOrder — which no other column reproduces,
			// so it is named for what it is rather than for a field.
			"Default",
			"Name", "Category", "ConstructionCost", "Upkeep", "Workers",
			"Capacity", "LotWidth", "LotDepth", "BuildingLevel", "HasParking",
		};

		public int EffectiveOffset => Offset < 0 ? 0 : Offset;

		/// <summary>
		/// The most rows one window will ever hold — a render ceiling, not a page
		/// ceiling, so it sits well above any set a player would read through.
		/// </summary>
		public const int MaxLimit = 2000;

		/// <summary>The window every fresh result set starts at.</summary>
		public const int DefaultLimit = 100;

		/// <summary>How much one Load more adds to the window.</summary>
		public const int WindowStep = 100;

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
