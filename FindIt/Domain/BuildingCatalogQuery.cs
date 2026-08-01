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
		double? MaxWaterConsumption = null)
	{
		public int EffectiveOffset => Offset < 0 ? 0 : Offset;

		public int EffectiveLimit => Limit switch
		{
			< 1 => 1,
			> 500 => 500,
			_ => Limit,
		};

		public string EffectiveSortColumn => string.IsNullOrWhiteSpace(SortColumn) ? "Name" : SortColumn;
	}
}
