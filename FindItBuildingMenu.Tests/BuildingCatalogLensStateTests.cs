using FindItBuildingMenu.Domain;

using System;

namespace FindItBuildingMenu.Tests;

public sealed class BuildingCatalogLensStateTests
{
    [Fact]
    public void ClearFilters_ClearsLensFacetsMetricRangesAndEducationCapacityTogether()
    {
        BuildingCatalogQuery query = new(
            SearchText: "school",
            SortColumn: "Capacity",
            Offset: 200,
            MinCapacity: 100,
            MaxCapacity: 1000,
            BuildingTypes: new[] { "School" },
            Themes: new[] { "European" });
        BuildingCatalogMetricRangeState ranges = new(
            MinCost: 5000,
            MaxCost: 100000,
            MinUpkeep: 100,
            MaxUpkeep: 5000,
            MinWorkers: null,
            MaxWorkers: null,
            MinCapacity: 100,
            MaxCapacity: 1000,
            MinLotWidth: null,
            MaxLotWidth: null,
            MinLotDepth: null,
            MaxLotDepth: null);

        BuildingCatalogLensState cleared = new BuildingCatalogLensState(query, ranges).ClearFilters();

        Assert.Null(cleared.Query.BuildingTypes);
        Assert.Null(cleared.Query.Themes);
        Assert.Null(cleared.Query.MinCapacity);
        Assert.Null(cleared.Query.MaxCapacity);
        Assert.Equal("school", cleared.Query.SearchText);
        Assert.Equal(0, cleared.Query.Offset);
        Assert.False(cleared.MetricRanges.HasSelection);
        Assert.Equal(BuildingCatalogMetricRangeState.Empty, cleared.MetricRanges);
    }

    [Fact]
    public void PageStatus_DistinguishesIndexingFromReadyEmptyResults()
    {
        Assert.Equal(BuildingCatalogLensState.Indexing, BuildingCatalogLensState.GetPageStatus(isReady: false, totalCount: 0));
        Assert.Equal(BuildingCatalogLensState.Empty, BuildingCatalogLensState.GetPageStatus(isReady: true, totalCount: 0));
        Assert.Equal(BuildingCatalogLensState.Ready, BuildingCatalogLensState.GetPageStatus(isReady: true, totalCount: 1));

        BuildingCatalogPage page = new(
            Array.Empty<BuildingCatalogEntry>(),
            TotalCount: 0,
            Offset: 0,
            Limit: 100,
            Status: BuildingCatalogLensState.GetPageStatus(isReady: false, totalCount: 0));

        Assert.Equal(BuildingCatalogLensState.Indexing, page.Status);
    }
}
