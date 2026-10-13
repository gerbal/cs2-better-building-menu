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
    public void ALevelPickedWithItsTabLightsTheTabToo()
    {
        var tiered = S().SelectMenu("Education").SelectSchoolTier(2, "Education");

        Assert.Equal(2, tiered.SchoolTier);
        Assert.Equal("Education", tiered.Category);
    }

    [Fact]
    public void ALevelPickedWithItsTabClearsTheStripTabAsTheTabsOwnPickDoes()
    {
        var tabbed = S().SelectMenu("Education").SelectStripTab("Primary");

        Assert.Null(tabbed.SelectSchoolTier(2, "Education").Query.StripTabs);
        // Without a tab to set, the level narrows the strip tab's list rather than replacing it.
        Assert.Equal(new[] { "Primary" }, tabbed.SelectSchoolTier(2).Query.StripTabs);
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

/// <summary>Where the list starts: an open and a tab pick at the armed building, a sort and a second click on the lit tab at the top.</summary>
public sealed class AssetMenuAnchorTests
{
    private const string Roads = "Roads";
    private const string Education = "Education & Research";
    private static readonly MenuOpening OnHighways = new("RoadsHighways", -1, 4206);

    private static AssetMenuState Opened(MenuOpening opening, string menu = Roads) =>
        AssetMenuState.Initial.OpenMenu(menu, _ => opening);

    [Fact]
    public void AnOpenStartsTheListOnTheTabAndRowTheRulePicks()
    {
        var opened = Opened(OnHighways);

        Assert.Equal(Roads, opened.Menu);
        Assert.Equal("RoadsHighways", opened.Category);
        Assert.Equal(-1, opened.SchoolTier);
        Assert.Equal(4206, opened.Anchor);
        Assert.Equal(AssetMenuState.Initial.ListStart + 1, opened.ListStart);
        Assert.Equal(BuildingCatalogQuery.DefaultLimit, opened.Query.Limit);
    }

    [Fact]
    public void AnOpenClearsTheSearchAndAsksTheRuleAboutTheMenuAsItOpens()
    {
        BuildingCatalogQuery? asked = null;
        var typed = Opened(MenuOpening.All, "Parks & Recreation").SelectCategory("ParksParks").Search("tree ");

        var opened = typed.OpenMenu(Roads, query =>
        {
            asked = query;
            return OnHighways;
        });

        Assert.Equal(string.Empty, opened.SearchText);
        Assert.Equal(string.Empty, opened.Query.SearchText);
        Assert.NotNull(asked);
        Assert.Equal(Roads, asked.UiMenu);
        Assert.Equal(string.Empty, asked.UiCategory);
        Assert.Equal(-1, asked.SchoolTier);
        Assert.Null(asked.StripTabs);
        Assert.Equal(string.Empty, asked.SearchText);
    }

    [Fact]
    public void AnOpenOnALevelSetsTheTabAndTheLevel()
    {
        var opened = Opened(new MenuOpening("Education", 2, 0), Education);

        Assert.Equal("Education", opened.Category);
        Assert.Equal(2, opened.SchoolTier);
        Assert.Equal(0, opened.Anchor);
    }

    [Fact]
    public void ReopeningTheSameMenuStartsItsListAgain()
    {
        // The list goes back to the armed building every time the menu opens, the same menu too.
        var opened = Opened(OnHighways);
        var again = opened.OpenMenu(Roads, _ => OnHighways);

        Assert.Equal(opened.ListStart + 1, again.ListStart);
        Assert.Equal(4206, again.Anchor);
    }

    [Fact]
    public void ABlankMenuClearsTheScopeAndTheAnchorWithoutAskingTheRule()
    {
        var asked = false;
        var cleared = Opened(OnHighways).OpenMenu("  ", _ =>
        {
            asked = true;
            return OnHighways;
        });

        Assert.False(asked);
        Assert.Equal(string.Empty, cleared.Menu);
        Assert.Equal(0, cleared.Anchor);
    }

    [Fact]
    public void ATabPickStartsTheListAtTheArmedBuilding()
    {
        var opened = Opened(OnHighways);
        var tab = opened.SelectCategory("RoadsSmallRoads", armed: 77);
        var strip = Opened(MenuOpening.All, "Electricity").SelectStripTab("Wind", armed: 77);
        var level = Opened(MenuOpening.All, Education).SelectSchoolTier(2, "Education", armed: 77);

        Assert.Equal(77, tab.Anchor);
        Assert.Equal(opened.ListStart + 1, tab.ListStart);
        Assert.Equal(77, strip.Anchor);
        Assert.Equal(77, level.Anchor);
    }

    [Fact]
    public void ReturningToATabAfterASortStartsItAtTheArmedBuildingAgain()
    {
        var sorted = Opened(OnHighways).SetSortColumn("ConstructionCost");

        var back = sorted.SelectCategory("RoadsSmallRoads", armed: 4206).SelectCategory("RoadsHighways", armed: 4206);

        Assert.Equal(0, sorted.Anchor);
        Assert.Equal(4206, back.Anchor);
    }

    [Fact]
    public void ASecondClickOnTheLitTabStartsItsListAtTheTop()
    {
        var opened = Opened(OnHighways);
        var tab = opened.SelectCategory("RoadsHighways", armed: 4206);
        var all = Opened(MenuOpening.All).SelectCategory(string.Empty, armed: 4206);
        var strip = Opened(MenuOpening.All, "Electricity").SelectStripTab("Wind", armed: 7).SelectStripTab("Wind", armed: 7);
        var level = Opened(new MenuOpening("Education", 2, 0), Education).SelectSchoolTier(2, "Education", armed: 7);

        Assert.Equal(0, tab.Anchor);
        Assert.Equal(opened.ListStart + 1, tab.ListStart);
        Assert.Equal(0, all.Anchor);
        Assert.Equal(0, strip.Anchor);
        Assert.Equal(0, level.Anchor);
    }

    [Fact]
    public void ANewLevelOnTheSameTabIsAnotherListAndStartsAtTheArmedBuilding()
    {
        // The tab is the same, the level is not: only the same tab and level is the second click.
        var atTwo = Opened(new MenuOpening("Education", 2, 0), Education);
        var grown = atTwo.CoverAnchor(409);

        var atThree = grown.SelectSchoolTier(3, "Education", armed: 77);

        Assert.Equal(77, atThree.Anchor);
        Assert.Equal(3, atThree.SchoolTier);
        Assert.Equal(grown.ListStart + 1, atThree.ListStart);
        Assert.Equal(BuildingCatalogQuery.DefaultLimit, atThree.Query.Limit);
    }

    [Fact]
    public void ATabPickedWhileASearchIsTypedStartsAtTheTop()
    {
        // The search orders that list, and the armed row on line 1 would hide better matches.
        var picked = Opened(OnHighways).Search("road").SelectCategory("RoadsSmallRoads", armed: 4206);

        Assert.Equal(0, picked.Anchor);
    }

    [Fact]
    public void ASortStartsTheListAtTheTopAndAnUnchangedDirectionStartsNothing()
    {
        var opened = Opened(OnHighways);
        var byCost = opened.SetSortColumn("ConstructionCost");
        var flipped = byCost.SetDescending(true);

        Assert.Equal(0, byCost.Anchor);
        Assert.Equal(opened.ListStart + 1, byCost.ListStart);
        Assert.Equal(byCost.ListStart + 1, flipped.ListStart);
        Assert.Same(flipped, flipped.SetDescending(true));
    }

    [Fact]
    public void SearchingFilteringRangingAndGroupingClearTheAnchorAndStartNothing()
    {
        // The open's start is served: these leave the list where the player has it, and the window
        // grows only for a page that answers a start.
        var opened = Opened(OnHighways).CoverAnchor(899);
        var moves = new[]
        {
            opened.Search("four"),
            opened.ToggleFacet(FacetIds.Availability, BuildingCatalogFacetSelection.Availability.Locked),
            opened.SetMetricRange("cost", "1000", "5000"),
            opened.SetGroupBy(BuildingCatalogGrouping.Theme),
        };

        Assert.All(moves, next =>
        {
            Assert.Equal(0, next.Anchor);
            Assert.Equal(opened.ListStart, next.ListStart);
            Assert.Equal(BuildingCatalogQuery.DefaultLimit, next.Query.Limit);
        });
    }

    [Fact]
    public void LoadingMoreAndANarrowingThatChangesNothingKeepTheAnchorAndStartNothing()
    {
        var opened = Opened(OnHighways).CoverAnchor(409);
        var moves = new[]
        {
            opened.LoadMoreTo(opened.Query.Limit + BuildingCatalogQuery.WindowStep),
            // No filter is set, and a trailing space trims to the same search: the result set is the same.
            opened.ClearFilters(),
            opened.Search(" "),
        };

        Assert.All(moves, next =>
        {
            Assert.Equal(4206, next.Anchor);
            Assert.Equal(opened.ListStart, next.ListStart);
            Assert.True(next.Query.Limit >= opened.Query.Limit);
        });
    }

    [Fact]
    public void TheWindowTheAnchorGrewIsTheOneLoadMoreGrowsFrom()
    {
        // Past row 200, a Load more counted from the first chunk would ask for less than the page holds.
        var covered = Opened(OnHighways).CoverAnchor(409);
        var asked = covered.Query.Limit + BuildingCatalogQuery.WindowStep;

        Assert.Equal(409 + 1 + BuildingCatalogQuery.WindowStep, covered.Query.Limit);
        Assert.Equal(asked, covered.LoadMoreTo(asked).Query.Limit);
    }

    [Fact]
    public void CoveringAnAnchorGrowsTheWindowToItUpToTheCeiling()
    {
        var opened = Opened(OnHighways);
        var covered = opened.CoverAnchor(409);

        Assert.Equal(40 + 1 + BuildingCatalogQuery.WindowStep, opened.CoverAnchor(40).Query.Limit);
        Assert.Equal(BuildingCatalogQuery.MaxLimit, opened.CoverAnchor(BuildingCatalogQuery.MaxLimit - 1).Query.Limit);
        // A row at or past the ceiling cannot be held, so it grows nothing.
        Assert.Same(opened, opened.CoverAnchor(BuildingCatalogQuery.MaxLimit));
        Assert.Same(opened, opened.CoverAnchor(5000));
        Assert.Same(opened, opened.CoverAnchor(-1));
        Assert.Same(covered, covered.CoverAnchor(409));
    }

    [Fact]
    public void LeavingAMenuForgetsItsAnchor()
    {
        var opened = Opened(OnHighways);

        Assert.Equal(0, opened.ClearMenuScope().Anchor);
        Assert.Equal(0, opened.SelectMenu("Parks & Recreation").Anchor);
    }

    [Fact]
    public void PickingTheLitSortColumnAgainReturnsTheSameStateAndStartsNothing()
    {
        var byCost = Opened(OnHighways).SetSortColumn("ConstructionCost");

        Assert.Same(byCost, byCost.SetSortColumn("ConstructionCost"));
    }

    [Fact]
    public void ChangingTheAnchorStartsTheWindowOver()
    {
        // A window grown to hold one anchored row is not the window of another.
        var covered = Opened(OnHighways).CoverAnchor(409);
        var moved = covered.Query with { AnchorId = 4300 };

        Assert.Equal(BuildingCatalogQuery.DefaultLimit, moved.ResetWindowIfPredicatesChanged(covered.Query).Limit);
        Assert.Equal(covered.Query.Limit, covered.Query.ResetWindowIfPredicatesChanged(covered.Query).Limit);
    }
}

/// <summary>Enter's target moved by the keys: a row a press while a search is typed, back on the best match with any new result, never a start.</summary>
public sealed class AssetMenuEnterStepTests
{
    private static AssetMenuState Searched() => AssetMenuState.Initial.SelectMenu("Roads").Search("lane");

    [Fact]
    public void AKeyMovesTheTargetOneRowWhileASearchIsTyped()
    {
        var searched = Searched();

        Assert.Equal(1, searched.MoveEnterTarget(1).Query.EnterStep);
        Assert.Equal(-1, searched.MoveEnterTarget(-1).Query.EnterStep);
        // A row a press, whatever number a caller sends.
        Assert.Equal(2, searched.MoveEnterTarget(1).MoveEnterTarget(7).Query.EnterStep);
        Assert.Same(searched, searched.MoveEnterTarget(0));

        var unsearched = AssetMenuState.Initial.SelectMenu("Roads");
        Assert.Same(unsearched, unsearched.MoveEnterTarget(1));
    }

    [Fact]
    public void TheStateKeepsTheStepThePageServedSoAKeyPastAnEndMovesBackAtOnce()
    {
        // Three presses down where only two rows lie below: the page served 2.
        var pressed = Searched().MoveEnterTarget(1).MoveEnterTarget(1).MoveEnterTarget(1);
        var kept = pressed.KeepEnterStep(2);

        Assert.Equal(2, kept.Query.EnterStep);
        Assert.Same(kept, kept.KeepEnterStep(2));
        Assert.Equal(1, kept.MoveEnterTarget(-1).Query.EnterStep);
    }

    [Fact]
    public void AMoveStartsNothingAndKeepsTheWindow()
    {
        var opened = AssetMenuState.Initial.OpenMenu("Roads", _ => new MenuOpening("RoadsHighways", -1, 4206)).Search("lane").LoadMore();
        var moved = opened.MoveEnterTarget(1);

        Assert.Equal(opened.ListStart, moved.ListStart);
        // A typed search has already cleared the anchor.
        Assert.Equal(0, moved.Anchor);
        Assert.Equal(opened.Query.Limit, moved.Query.Limit);
        Assert.Equal(opened.Query.Offset, moved.Query.Offset);
    }

    [Fact]
    public void ANewResultPutsTheTargetBackOnTheBestMatch()
    {
        var moved = Searched().MoveEnterTarget(1).MoveEnterTarget(1);
        var changes = new (string Name, Func<AssetMenuState, AssetMenuState> Change)[]
        {
            ("typing on", s => s.Search("lanes")),
            ("a filter", s => s.ToggleFacet("theme", "European")),
            ("a range", s => s.SetMetricRange("upkeep", "10", "")),
            ("a sort", s => s.SetSortColumn("Upkeep")),
            ("a direction", s => s.SetDescending(true)),
            ("a grouping", s => s.SetGroupBy("cost")),
            ("a tab", s => s.SelectCategory("RoadsHighways")),
            ("another menu", s => s.SelectMenu("Parks & Recreation")),
        };

        Assert.All(changes, change => Assert.True(change.Change(moved).Query.EnterStep == 0, change.Name + " kept the moved target"));
    }

    [Fact]
    public void LoadingMoreOrTheSameSearchKeepsTheTargetWhereTheKeysPutIt()
    {
        var moved = Searched().MoveEnterTarget(1);

        Assert.Equal(1, moved.LoadMore().Query.EnterStep);
        Assert.Equal(1, moved.CoverAnchor(150).Query.EnterStep);
        // A trailing space is the same search.
        Assert.Equal(1, moved.Search("lane ").Query.EnterStep);
    }
}
