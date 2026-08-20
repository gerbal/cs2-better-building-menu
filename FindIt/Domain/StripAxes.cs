namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// The axes the menu strip can fall back to when vanilla gives a menu no
	/// categories of its own.
	/// </summary>
	/// <remarks>
	/// Strings rather than an enum because they cross the UI binding, where an
	/// enum would arrive as a number and the React side would need a second
	/// table to read it back.
	///
	/// Role is deliberately not here. BuildingType describes a simulation
	/// capability rather than the player's category, and the two come apart in
	/// ways that would mislead: the Water Treatment Plant's role is
	/// WaterPumpingStation, the Incineration Plant's is PowerPlant in a garbage
	/// menu, and pipes and lot tools have none at all. It stays a filter facet,
	/// where the player opts into it knowingly.
	/// </remarks>
	public static class StripAxes
	{
		/// <summary>Vanilla's own categories. Not a fallback — the reference.</summary>
		public const string Category = "category";

		/// <summary>The service's development tree, by branch.</summary>
		public const string Development = "development";

		/// <summary>Buildings against networks.</summary>
		public const string AssetType = "assetType";

		public const string BuildingValue = "Buildings";
		public const string NetworkValue = "Networks";
	}
}
