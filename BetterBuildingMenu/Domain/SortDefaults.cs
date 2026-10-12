namespace BetterBuildingMenu.Domain
{
	/// <summary>Which way each sort starts, and which sorts break their ties by cost.</summary>
	/// <remarks>
	/// The first click is the UI's, read from the copy of <see cref="BestFirstDescending"/>
	/// generated into sharedContracts.generated.ts. See docs/design-notes.md, "Search and sort
	/// over the whole result".
	/// </remarks>
	public static class SortDefaults
	{
		/// <summary>
		/// The sorts whose first click puts the highest first, because more is better. Every other
		/// sort starts lowest first, which for cost and upkeep is the cheapest.
		/// </summary>
		public static readonly IReadOnlyList<string> BestFirstDescending = new[]
		{
			"Workers", "Capacity", "Households", "WaterCapacity", "SewageCapacity",
		};

		/// <summary>The sorts by a number, spelled as the query engine matches them.</summary>
		public static readonly HashSet<string> Numeric = new(StringComparer.OrdinalIgnoreCase)
		{
			"ConstructionCost", "Cost", "Upkeep", "Workers", "Capacity", "Households", "WaterCapacity",
			"SewageCapacity", "Sewage", "LotWidth", "LotDepth", "BuildingLevel",
			"HasParking", "ZoneType", "Electricity", "ElectricityConsumption", "Water", "WaterConsumption",
			"Garbage", "GarbageAccumulation", "GroundPollution", "AirPollution", "NoisePollution", "Noise",
		};

		/// <summary>Whether a sort's first click puts the highest first.</summary>
		public static bool StartsDescending(string? column) =>
			column is not null && BestFirstDescending.Contains(column.Trim(), StringComparer.OrdinalIgnoreCase);

		/// <summary>Whether a sort is by a number, whose ties go to the cheaper building, then to the game's order.</summary>
		public static bool BreaksTiesByCost(string? column) => column is not null && Numeric.Contains(column.Trim());
	}
}
