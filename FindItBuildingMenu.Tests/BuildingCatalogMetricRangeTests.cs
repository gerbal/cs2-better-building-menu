using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Services;

namespace FindItBuildingMenu.Tests;

public sealed class BuildingCatalogMetricRangeTests
{
    [Fact]
    public void TryParse_NormalizesReversedAndInvalidMetricInput()
    {
        Assert.True(BuildingCatalogMetricRange.TryParse("capacity", "500", "100", out BuildingCatalogMetricRange capacity));
        Assert.Equal("capacity", capacity.MetricId);
        Assert.Equal(100, capacity.Min);
        Assert.Equal(500, capacity.Max);

        Assert.True(BuildingCatalogMetricRange.TryParse("lotWidth", "3.8", "1.2", out BuildingCatalogMetricRange lotWidth));
        Assert.Equal(1, lotWidth.Min);
        Assert.Equal(4, lotWidth.Max);

        Assert.False(BuildingCatalogMetricRange.TryParse("unsupported", "1", "2", out _));
        Assert.False(BuildingCatalogMetricRange.TryParse("cost", "not-a-number", "", out _));
    }

    [Fact]
    public void Apply_UpdatesOnlySelectedRangeAndResetsOffset()
    {
        BuildingCatalogQuery query = new(
            SearchText: "school",
            SortColumn: "Cost",
            Descending: true,
            Offset: 200,
            MinCapacity: 10,
            MaxCapacity: 900,
            MinWorkers: 2,
            MaxWorkers: 40,
            BuildingTypes: new[] { "School" });

        BuildingCatalogQuery applied = BuildingCatalogMetricRange.Apply(query, "capacity", "500", "100");

        Assert.Equal(0, applied.Offset);
        Assert.Equal(100, applied.MinCapacity);
        Assert.Equal(500, applied.MaxCapacity);
        Assert.Equal(2, applied.MinWorkers);
        Assert.Equal(40, applied.MaxWorkers);
        Assert.Equal("school", applied.SearchText);
        Assert.Equal("Cost", applied.SortColumn);
        Assert.True(applied.Descending);
        Assert.Equal(new[] { "School" }, applied.BuildingTypes);
    }

    [Fact]
    public void Clear_RemovesMetricRangesButPreservesOtherQueryState()
    {
        BuildingCatalogQuery query = new(
            SearchText: "clinic",
            SortColumn: "Upkeep",
            Offset: 300,
            MinConstructionCost: 1000,
            MaxConstructionCost: 5000,
            MinLotWidth: 2,
            MaxLotWidth: 8,
            MinCapacity: 50,
            MaxCapacity: 500,
            BuildingTypes: new[] { "Hospital" });

        BuildingCatalogQuery cleared = BuildingCatalogMetricRange.Clear(query);

        Assert.Equal(0, cleared.Offset);
        Assert.Null(cleared.MinConstructionCost);
        Assert.Null(cleared.MaxConstructionCost);
        Assert.Null(cleared.MinLotWidth);
        Assert.Null(cleared.MaxLotWidth);
        Assert.Null(cleared.MinCapacity);
        Assert.Null(cleared.MaxCapacity);
        Assert.Equal("clinic", cleared.SearchText);
        Assert.Equal("Upkeep", cleared.SortColumn);
        Assert.Equal(new[] { "Hospital" }, cleared.BuildingTypes);
    }

    [Fact]
    public void State_FromQueryPublishesNormalizedSelection()
    {
        BuildingCatalogMetricRangeState state = BuildingCatalogMetricRangeState.FromQuery(
            new BuildingCatalogQuery(MinConstructionCost: 1000, MaxCapacity: 500));

        Assert.Equal(1000, state.MinCost);
        Assert.Equal(500, state.MaxCapacity);
        Assert.True(state.HasSelection);
        Assert.False(BuildingCatalogMetricRangeState.FromQuery(new BuildingCatalogQuery()).HasSelection);
    }

    [Fact]
    public void AppliedRange_ComposesWithCatalogFacetsAndMissingValues()
    {
        BuildingCatalogEntry school = new BuildingCatalogEntry(
            1, "School", "School", "ServiceBuildings", "Education", "", 4, 4, 2,
            FindItBuildingMenu.Domain.Enums.ZoneTypeFilter.Any, false, false, true, "") with
        {
            Capacity = 500,
            BuildingType = "School",
        };
        BuildingCatalogEntry missing = school with { Id = 2, PrefabName = "Missing", Capacity = null };
        BuildingCatalogQuery query = BuildingCatalogMetricRange.Apply(
            new BuildingCatalogQuery(BuildingTypes: new[] { "School" }), "capacity", "500", "500");

        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(new[] { school, missing }, query);

        Assert.Equal(new[] { 1 }, page.Items.Select(item => item.Id).ToArray());
        Assert.Equal(1, page.TotalCount);
    }
}
