using BetterBuildingMenu.Domain;

using System;

namespace BetterBuildingMenu.Tests;

public sealed class AssetMenuStateTests
{
    [Fact]
    public void ClearFilters_ClearsAssetMenuFacetsMetricRangesAndEducationCapacityTogether()
    {
        BuildingCatalogQuery query = new(
            SearchText: "school",
            SortColumn: "Capacity",
            Offset: 200,
            MinConstructionCost: 5000,
            MaxConstructionCost: 100000,
            MinUpkeep: 100,
            MaxUpkeep: 5000,
            MinCapacity: 100,
            MaxCapacity: 1000,
            BuildingTypes: new[] { "School" },
            Themes: new[] { "European" });

        AssetMenuState cleared = new AssetMenuState(query, SearchText: "school").ClearFilters();

        Assert.Null(cleared.Query.BuildingTypes);
        Assert.Null(cleared.Query.Themes);
        Assert.Null(cleared.Query.MinCapacity);
        Assert.Null(cleared.Query.MaxCapacity);
        Assert.Null(cleared.Query.MinConstructionCost);
        Assert.Null(cleared.Query.MaxUpkeep);
        Assert.Equal("school", cleared.Query.SearchText);
        Assert.Equal(0, cleared.Query.Offset);
        Assert.False(cleared.MetricRanges.HasSelection);
        Assert.Equal(BuildingCatalogMetricRangeState.Empty, cleared.MetricRanges);
    }

    [Fact]
    public void EverywhereQuery_DropsTheWholeMenuScopeAndKeepsTheSearch()
    {
        // What "Search everywhere" runs. Dropping only the menu leaves the category, tab
        // and tier pinning the count to the section that just came up empty.
        AssetMenuState state = new(
            new BuildingCatalogQuery(
                SearchText: "clinic",
                UiMenu: "Healthcare",
                UiCategory: "Clinics",
                StripTabs: new[] { "Small" },
                SchoolTier: 2),
            SearchText: "clinic");

        BuildingCatalogQuery everywhere = state.EverywhereQuery();

        Assert.Equal(string.Empty, everywhere.UiMenu);
        Assert.Equal(string.Empty, everywhere.UiCategory);
        Assert.Null(everywhere.StripTabs);
        Assert.Equal(-1, everywhere.SchoolTier);
        Assert.Equal("clinic", everywhere.SearchText);
    }

    [Fact]
    public void Search_TrimsTheQuerysCopySoATypedSpaceIsNotANewPredicate()
    {
        // The box echoes the asset menu's own text, so that keeps the space the player typed;
        // the query does not, and a grown window survives the keystroke.
        AssetMenuState grown = AssetMenuState.Initial.Search("clinic").LoadMore();

        AssetMenuState spaced = grown.Search("clinic ");

        Assert.Equal("clinic ", spaced.SearchText);
        Assert.Equal("clinic", spaced.Query.SearchText);
        Assert.Equal(grown.Query.Limit, spaced.Query.Limit);
    }

    [Fact]
    public void PageStatus_DistinguishesIndexingFromReadyEmptyResults()
    {
        Assert.Equal(AssetMenuState.Indexing, AssetMenuState.GetPageStatus(isReady: false, totalCount: 0));
        Assert.Equal(AssetMenuState.Empty, AssetMenuState.GetPageStatus(isReady: true, totalCount: 0));
        Assert.Equal(AssetMenuState.Ready, AssetMenuState.GetPageStatus(isReady: true, totalCount: 1));

        BuildingCatalogPage page = new(
            Array.Empty<BuildingCatalogEntry>(),
            TotalCount: 0,
            Offset: 0,
            Limit: 100,
            Status: AssetMenuState.GetPageStatus(isReady: false, totalCount: 0));

        Assert.Equal(AssetMenuState.Indexing, page.Status);
    }
}

public sealed class AssetMenuStateTransitionTests
{
    private static AssetMenuState S() => AssetMenuState.Initial;

    private static AssetMenuState Grown(AssetMenuState state) =>
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
    public void LoadMoreToIsIdempotentSoARepeatedRequestLoadsOneStep()
    {
        // A double click, or the scroll poll firing again before the answer lands,
        // sends the same limit twice; the second must change nothing.
        var once = S().LoadMoreTo(BuildingCatalogQuery.DefaultLimit + BuildingCatalogQuery.WindowStep);

        Assert.Equal(BuildingCatalogQuery.DefaultLimit + BuildingCatalogQuery.WindowStep, once.Query.Limit);
        Assert.Same(once, once.LoadMoreTo(BuildingCatalogQuery.DefaultLimit + BuildingCatalogQuery.WindowStep));
    }

    [Fact]
    public void LoadMoreToGrowsAtMostOneStepAndNeverShrinks()
    {
        // A limit asked for from a page the window has since outgrown, or one
        // reset under it, still means "one more chunk" at most.
        Assert.Equal(
            BuildingCatalogQuery.DefaultLimit + BuildingCatalogQuery.WindowStep,
            S().LoadMoreTo(BuildingCatalogQuery.MaxLimit).Query.Limit);

        var grown = S().LoadMore().LoadMore();
        Assert.Same(grown, grown.LoadMoreTo(BuildingCatalogQuery.DefaultLimit));
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
    public void AMetricRangeLandsInTheQueryTheDrawerReadsAndAnUnparsableOneChangesNothing()
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
    public void TheQueryCarriesTheScopeTheSearchAndEveryBound()
    {
        var state = S()
            .SelectMenu("Education & Research")
            .SelectSchoolTier(2)
            .Search("school")
            .SetMetricRange("cost", "1000", "5000")
            .SetMetricRange("lotWidth", "2", "6");

        var query = state.Query;

        Assert.Equal("Education & Research", query.UiMenu);
        Assert.Equal("", query.UiCategory);
        Assert.Equal(2, query.SchoolTier);
        Assert.Equal("school", query.SearchText);
        Assert.Equal(1000, query.MinConstructionCost);
        Assert.Equal(5000, query.MaxConstructionCost);
        Assert.Equal(2, query.MinLotWidth);
        Assert.Equal(6, query.MaxLotWidth);
        Assert.Equal(2, state.MetricRanges.MinLotWidth);
        Assert.Equal(6, state.MetricRanges.MaxLotWidth);
    }

    [Fact]
    public void ANarrowingResetsAGrownWindowAndOneThatChangesNothingKeepsIt()
    {
        var grown = S().SelectMenu("Roads").SetMetricRange("cost", "1000", "5000").LoadMore().LoadMore();
        Assert.Equal(300, grown.Query.Limit);

        Assert.Equal(300, grown.SetMetricRange("cost", "1000", "5000").Query.Limit);
        Assert.Equal(300, grown.ClearFacets().Query.Limit);

        foreach (var narrowed in new[]
        {
            grown.Search("bridge"),
            grown.ToggleFacet("theme", "European"),
            grown.SetMetricRange("cost", "1000", "6000"),
            grown.ClearMetricRanges(),
            grown.ClearFilters(),
        })
        {
            Assert.Equal(BuildingCatalogQuery.DefaultLimit, narrowed.Query.Limit);
            Assert.Equal(0, narrowed.Query.Offset);
        }
    }

    [Fact]
    public void EveryTransitionLeavesTheQueryReadyToRun()
    {
        // Nothing folds the state into the query before a refresh, so each transition
        // must leave it right: the search trimmed, and the window started over exactly
        // when the result set changed.
        var steps = new (string Name, Func<AssetMenuState, AssetMenuState> Step)[]
        {
            ("menu", s => s.SelectMenu("Roads")),
            ("load more", s => s.LoadMore()),
            ("search", s => s.Search("  bridge ")),
            ("load more", s => s.LoadMoreTo(BuildingCatalogQuery.MaxLimit)),
            ("same search, spaced", s => s.Search("bridge")),
            ("facet", s => s.ToggleFacet("theme", "European")),
            ("load more", s => s.LoadMore()),
            ("metric", s => s.SetMetricRange("upkeep", "10", "")),
            ("load more", s => s.LoadMore()),
            ("same metric", s => s.SetMetricRange("upkeep", "10", "")),
            ("category", s => s.SelectCategory("Highways")),
            ("tab", s => s.SelectStripTab("Bridges")),
            ("tier", s => s.SelectSchoolTier(2)),
            ("sort", s => s.SetSortColumn("Upkeep")),
            ("descending", s => s.SetDescending(true)),
            ("group", s => s.SetGroupBy("cost")),
            ("load more", s => s.LoadMore()),
            ("clear metrics", s => s.ClearMetricRanges()),
            ("clear facets", s => s.ClearFacets()),
            ("clear filters", s => s.ClearFilters()),
            ("reset", s => s.ResetMenu()),
            ("search", s => s.Search("depot")),
            ("everywhere", s => s.ClearMenuScope()),
        };

        var state = S();

        foreach (var (name, step) in steps)
        {
            var next = step(state);

            Assert.True(next.SearchText.Trim() == next.Query.SearchText, $"{name}: the query searches for something else than the box shows");

            var resultSetMoved = (next.Query with { Offset = 0, Limit = 0 }) != (state.Query with { Offset = 0, Limit = 0 });
            if (resultSetMoved)
            {
                Assert.True(next.Query.Limit == BuildingCatalogQuery.DefaultLimit && next.Query.Offset == 0, $"{name}: a new result set kept the old window");
            }

            Assert.True(next.Query.Limit >= BuildingCatalogQuery.DefaultLimit, $"{name}: the window fell below one chunk");

            state = next;
        }
    }
}
