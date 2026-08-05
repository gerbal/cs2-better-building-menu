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
		string BuildMenuSubCategory = "")
	{
		public int EffectiveOffset => Offset < 0 ? 0 : Offset;

		public int EffectiveLimit => Limit switch
		{
			< 1 => 1,
			> 500 => 500,
			_ => Limit,
		};

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
