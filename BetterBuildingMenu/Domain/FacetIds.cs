namespace BetterBuildingMenu.Domain
{
	/// <summary>The filter dimensions the panel offers, by the id the UI sends back.</summary>
	/// <remarks>
	/// The UI's copy is generated from <see cref="All"/>: see sharedContracts.generated.ts
	/// and SharedContractsTests.
	/// </remarks>
	public static class FacetIds
	{
		public const string BuildingType = "buildingType";
		public const string Provenance = "provenance";
		public const string Availability = "availability";
		public const string Content = "content";
		public const string Theme = "theme";
		public const string Placement = "placement";

		/// <summary>Every facet the adapter can emit, in the order it emits them.</summary>
		public static readonly IReadOnlyList<string> All = new[]
		{
			BuildingType, Provenance, Availability, Content, Theme, Placement,
		};
	}
}
