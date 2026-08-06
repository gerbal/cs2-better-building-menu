namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// Shared Building Lens filter state and the status vocabulary published to
	/// Gameface. The legacy FindIt filter state remains outside this transition;
	/// only lens-owned categorical and metric state is reset.
	/// </summary>
	public sealed record BuildingCatalogLensState(
		BuildingCatalogQuery Query,
		BuildingCatalogMetricRangeState MetricRanges)
	{
		public const string Indexing = "indexing";
		public const string Ready = "ready";
		public const string Empty = "empty";

		public BuildingCatalogLensState ClearFilters()
		{
			BuildingCatalogQuery query = BuildingCatalogMetricRange.Clear(
				BuildingCatalogFacetSelection.Clear(Query));

			return this with
			{
				Query = query,
				MetricRanges = BuildingCatalogMetricRangeState.Empty,
			};
		}

		public static string GetPageStatus(bool isReady, int totalCount)
		{
			if (!isReady)
			{
				return Indexing;
			}

			return totalCount > 0 ? Ready : Empty;
		}
	}
}
