using System;
using System.Collections.Generic;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// A bounded query for the building lens. Range fields are inclusive and are
	/// applied before paging so the returned total is useful to the UI.
	/// </summary>
	public sealed record BuildingCatalogQuery(
		string SearchText = "",
		string Category = "",
		string SubCategory = "",
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
		bool? HasParking = null,
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
		IReadOnlyList<string>? AssetPacks = null,
		IReadOnlyList<string>? PlacementFlags = null,
		IReadOnlyList<string>? Extensions = null,
		// Zone density (Low/Row/Medium/High/Signature) was indexed on every
		// entry and sorted on, but had no query field, so the levels the
		// vanilla Zones menu is organised around could not be filtered.
		IReadOnlyList<string>? ZoneTypes = null,
		string BuildMenuSection = "",
		string BuildMenuSubCategory = "",
		// SPIKE (cm-e98i): the game's own menu placement, used instead of our
		// reconstructed section when the lens was opened from a vanilla menu.
		string UiMenu = "",
		string UiCategory = "")
	{
		public int EffectiveOffset => Offset < 0 ? 0 : Offset;

		/// <summary>The most rows one page will ever hold.</summary>
		public const int MaxLimit = 500;

		/// <summary>
		/// Page size, which a menu-scoped query does not really have.
		/// </summary>
		/// <remarks>
		/// A vanilla menu is one set, not a sequence of pages. The player
		/// clicked Roads and is looking at "the roads"; splitting that into
		/// "Rows 1-100 of 157, page 1 of 2" invents a boundary the game does
		/// not have — vanilla scrolls a menu and never pages it — and buries
		/// the far half behind a control at the bottom of a list you have to
		/// scroll to reach.
		///
		/// The largest vanilla menu is Landscaping at 366 assets, measured on a
		/// real catalog, so <see cref="MaxLimit"/> already covers every one of
		/// them and a menu-scoped query simply asks for the ceiling. A modded
		/// menu larger than that pages again, which is the right way to
		/// degrade.
		///
		/// Unscoped queries keep their 100. There the set is the whole catalog
		/// — 3,667 buildings — and no page size makes that one thing.
		/// </remarks>
		public int EffectiveLimit
		{
			get
			{
				int requested = IsScopedToMenu ? Math.Max(Limit, MaxLimit) : Limit;

				return requested switch
				{
					< 1 => 1,
					> MaxLimit => MaxLimit,
					_ => requested,
				};
			}
		}

		/// <summary>Whether this query is pinned to a place in the vanilla build menu.</summary>
		public bool IsScopedToMenu =>
			!string.IsNullOrWhiteSpace(UiMenu) || !string.IsNullOrWhiteSpace(UiCategory);

		public string EffectiveSortColumn => string.IsNullOrWhiteSpace(SortColumn) ? "Name" : SortColumn;

		/// <summary>
		/// Returns this query with paging reset to the first page when any
		/// predicate differs from <paramref name="previous"/>, and unchanged
		/// when only the offset moved.
		/// </summary>
		/// <remarks>
		/// The individual facet, range, and sort handlers each reset the offset
		/// themselves, but the query is also rebuilt wholesale from ambient
		/// state on every refresh — search text, the legacy FindIt parking
		/// filters, the lens section, and the metric drawer all arrive that way
		/// and previously left the offset untouched. A player who narrowed a
		/// result set from a later page kept an offset past the new total. The
		/// engine clamps that to a populated page, but landing on the last page
		/// of a brand-new result set is still wrong: a fresh predicate means
		/// page one. Comparing whole queries rather than enumerating fields
		/// keeps new predicates covered by default instead of silently opting
		/// out until someone remembers to add them here.
		/// </remarks>
		public BuildingCatalogQuery ResetPagingIfPredicatesChanged(BuildingCatalogQuery previous)
		{
			if (previous is null)
			{
				return this;
			}

			return (this with { Offset = 0 }) == (previous with { Offset = 0 })
				? this
				: this with { Offset = 0 };
		}
	}
}
