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

public sealed class BuildingCatalogLensTransitionTests
{
    private static BuildingCatalogLensState S() => BuildingCatalogLensState.Initial;

    private static BuildingCatalogLensState Grown(BuildingCatalogLensState state) =>
        state with { Query = state.Query with { Offset = 100, Limit = 300 } };

    [Fact]
    public void SelectingAMenuForgetsTheCategoryTheTabAndTheTierAndResetsTheWindow()
    {
        var before = Grown(S().SelectCategory("Healthcare").SelectStripTab("Hospital").SelectSchoolTier(2));

        var after = before.SelectMenu(" Roads ");

        Assert.Equal("Roads", after.Menu);
        Assert.Equal("", after.Category);
        Assert.Null(after.Query.StripTabs);
        Assert.Equal(-1, after.SchoolTier);
        Assert.Equal(0, after.Query.Offset);
        Assert.Equal(BuildingCatalogQuery.DefaultLimit, after.Query.Limit);
    }

    [Fact]
    public void ABlankMenuClearsTheScope()
    {
        var scoped = S().SelectMenu("Roads").SelectCategory("Highways");

        Assert.Equal(scoped.ClearMenuScope(), scoped.SelectMenu("   "));
        Assert.Equal("", scoped.ClearMenuScope().Menu);
    }

    [Fact]
    public void AStripTabAndACategoryExcludeEachOther()
    {
        var tabbed = S().SelectMenu("Roads").SelectStripTab("Bridges");
        Assert.Equal(new[] { "Bridges" }, tabbed.Query.StripTabs);

        var categorised = tabbed.SelectCategory("Highways");
        Assert.Equal("Highways", categorised.Category);
        Assert.Null(categorised.Query.StripTabs);

        var tabbedAgain = categorised.SelectStripTab("Bridges");
        Assert.Equal("", tabbedAgain.Category);
        Assert.Equal(new[] { "Bridges" }, tabbedAgain.Query.StripTabs);
    }

    [Fact]
    public void ASchoolTierClearsTheCategoryAndClampsBelowZero()
    {
        var tiered = S().SelectMenu("Education").SelectCategory("Education").SelectSchoolTier(3);

        Assert.Equal(3, tiered.SchoolTier);
        Assert.Equal("", tiered.Category);
        Assert.Equal(-1, tiered.SelectSchoolTier(-7).SchoolTier);
    }

    [Fact]
    public void BlankTabsAndCategoriesClearRatherThanSelect()
    {
        var state = S().SelectMenu("Roads").SelectStripTab("Bridges").SelectStripTab("");
        Assert.Null(state.Query.StripTabs);

        Assert.Equal("", S().SelectCategory("Highways").SelectCategory(null).Category);
    }

    [Fact]
    public void OrderAndGroupingChangesShrinkTheWindowAndNoOpsReturnTheSameInstance()
    {
        var grown = Grown(S());

        Assert.Same(grown, grown.SetSortColumn("  "));
        Assert.Same(grown, grown.SetDescending(false));
        Assert.Same(grown, grown.SetGroupBy("  "));

        var sorted = grown.SetSortColumn("ConstructionCost");
        Assert.Equal("ConstructionCost", sorted.Query.SortColumn);
        Assert.Equal(BuildingCatalogQuery.DefaultLimit, sorted.Query.Limit);
        Assert.Equal(0, sorted.Query.Offset);

        Assert.Equal(BuildingCatalogQuery.DefaultLimit, grown.SetDescending(true).Query.Limit);

        var grouped = grown.SetGroupBy(" cost ");
        Assert.Equal("cost", grouped.Query.GroupBy);
        Assert.Equal(BuildingCatalogQuery.DefaultLimit, grouped.Query.Limit);
        Assert.Same(grouped, grouped.SetGroupBy("cost"));
    }

    [Fact]
    public void LoadMoreGrowsByOneStepToTheCeilingAndNotPast()
    {
        var once = S().LoadMore();
        Assert.Equal(BuildingCatalogQuery.DefaultLimit + BuildingCatalogQuery.WindowStep, once.Query.Limit);

        var state = S();
        for (var i = 0; i < 100; i++)
        {
            state = state.LoadMore();
        }

        Assert.Equal(BuildingCatalogQuery.MaxLimit, state.Query.Limit);
        Assert.Same(state, state.LoadMore());
    }

    [Fact]
    public void ResetKeepsTheMenuAndDropsEverythingThePlayerNarrowed()
    {
        var state = Grown(S()
            .SelectMenu("Roads")
            .SelectCategory("Highways")
            .SelectSchoolTier(2)
            .Search("bridge")
            .SetSortColumn("ConstructionCost")
            .SetDescending(true)
            .SetGroupBy("cost")
            .ToggleFacet("theme", "European")
            .SetMetricRange("cost", "1000", "5000"));

        var reset = state.ResetMenu();

        Assert.Equal("Roads", reset.Menu);
        Assert.Equal("", reset.Category);
        Assert.Equal(-1, reset.SchoolTier);
        Assert.Null(reset.Query.StripTabs);
        Assert.Equal("", reset.SearchText);
        Assert.Equal("", reset.Query.SortColumn);
        Assert.False(reset.Query.Descending);
        Assert.Equal("", reset.Query.GroupBy);
        Assert.Null(reset.Query.Themes);
        Assert.Equal(BuildingCatalogMetricRangeState.Empty, reset.MetricRanges);
        Assert.Null(reset.Query.MinConstructionCost);
        Assert.Equal(0, reset.Query.Offset);
        Assert.Equal(BuildingCatalogQuery.DefaultLimit, reset.Query.Limit);
    }

    [Fact]
    public void SearchEverythingDropsTheScopeAndKeepsTheSearch()
    {
        var everywhere = S().SelectMenu("Roads").SelectCategory("Highways").Search("bridge").ClearMenuScope();

        Assert.Equal("", everywhere.Menu);
        Assert.Equal("", everywhere.Category);
        Assert.Equal("bridge", everywhere.SearchText);
    }

    [Fact]
    public void SearchStripsLineBreaksAndIsANoOpForEqualText()
    {
        var searched = S().Search("bri\r\ndge");

        Assert.Equal("bridge", searched.SearchText);
        Assert.Same(searched, searched.Search("bridge"));
        Assert.Equal("", searched.Search(null).SearchText);
    }

    [Fact]
    public void AMetricRangeLandsInBothTheStateAndTheQueryAndAnUnparsableOneChangesNothing()
    {
        var bounded = S().SetMetricRange("cost", "1000", "5000");

        Assert.Equal(1000, bounded.MetricRanges.MinCost);
        Assert.Equal(5000, bounded.MetricRanges.MaxCost);
        Assert.Equal(1000, bounded.Query.MinConstructionCost);
        Assert.Equal(5000, bounded.Query.MaxConstructionCost);

        Assert.Same(bounded, bounded.SetMetricRange("nonsense", "a", "b"));

        var cleared = bounded.ClearMetricRanges();
        Assert.Equal(BuildingCatalogMetricRangeState.Empty, cleared.MetricRanges);
        Assert.Null(cleared.Query.MinConstructionCost);
    }

    [Fact]
    public void FacetTogglesAreNoOpsOnlyWhenTheSelectionDoesNotMove()
    {
        var on = S().ToggleFacet("theme", "European");
        Assert.Equal(new[] { "European" }, on.Query.Themes);

        var off = on.ToggleFacet("theme", "European");
        Assert.True(off.Query.Themes is null || off.Query.Themes.Count == 0);

        Assert.Null(on.ClearFacets().Query.Themes);
    }

    [Fact]
    public void ComposeFoldsTheScopeTheSearchAndEveryBoundIntoTheQuery()
    {
        var state = S()
            .SelectMenu("Education & Research")
            .SelectSchoolTier(2)
            .Search("school")
            .SetMetricRange("cost", "1000", "5000")
            .SetMetricRange("lotWidth", "2", "6");

        var composed = state.Compose().Query;

        Assert.Equal("Education & Research", composed.UiMenu);
        Assert.Equal("", composed.UiCategory);
        Assert.Equal(2, composed.SchoolTier);
        Assert.Equal("school", composed.SearchText);
        Assert.Equal(1000, composed.MinConstructionCost);
        Assert.Equal(5000, composed.MaxConstructionCost);
        Assert.Equal(2, composed.MinLotWidth);
        Assert.Equal(6, composed.MaxLotWidth);
    }

    [Fact]
    public void ComposeKeepsAGrownWindowWhenNoPredicateMovedAndResetsItWhenOneDid()
    {
        var composed = S().SelectMenu("Roads").Compose();
        var grown = composed.LoadMore().LoadMore();
        Assert.Equal(300, grown.Query.Limit);

        var stillGrown = grown.Compose();
        Assert.Equal(300, stillGrown.Query.Limit);
        Assert.Same(grown, stillGrown);

        var narrowed = grown.Search("bridge").Compose();
        Assert.Equal(BuildingCatalogQuery.DefaultLimit, narrowed.Query.Limit);
        Assert.Equal(0, narrowed.Query.Offset);
    }

    [Fact]
    public void ComposeNeverLeavesTheWindowBelowOneChunk()
    {
        var tiny = S() with { Query = new BuildingCatalogQuery(Limit: 10) };

        Assert.Equal(BuildingCatalogQuery.DefaultLimit, tiny.Compose().Query.Limit);
    }
}
