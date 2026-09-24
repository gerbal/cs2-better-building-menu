using Colossal.UI.Binding;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;
using BetterBuildingMenu.Utilities;

using Game.Prefabs;

using System.Collections.Generic;

namespace BetterBuildingMenu.Tests;

public sealed class BuildingCatalogQueryEngineTests
{
    private static readonly IReadOnlyList<BuildingCatalogEntry> SampleEntries = new[]
    {
        Entry(1, "CoalPlant", "Coal Power Plant", "Buildings", "Buildings_Industrial", 4, 3, 3, false, "") with
        {
            ConstructionCost = 80000,
            Upkeep = 5000,
            Workers = 40,
            Capacity = 200,
            ElectricityConsumption = 100,
            WaterConsumption = 20,
        },
        Entry(2, "WindTurbine", "Wind Turbine", "Buildings", "Buildings_Specialized", 2, 2, 1, true, "") with
        {
            ConstructionCost = 25000,
            Upkeep = 200,
            Workers = 2,
            ElectricityConsumption = 0,
        },
        Entry(3, "WaterPumpingStation", "Water Pumping Station", "ServiceBuildings", "ServiceBuildings_Water", 3, 4, 2, true, "12345") with
        {
            ConstructionCost = 45000,
            Upkeep = 1500,
            Workers = 12,
            Capacity = 1000,
            WaterCapacity = 1000,
            ElectricityConsumption = 30,
            WaterConsumption = 5,
        },
        Entry(4, "SmallClinic", "Small Clinic", "ServiceBuildings", "ServiceBuildings_Health", 3, 2, 2, false, "") with
        {
            ConstructionCost = 5000,
            Upkeep = 50,
            Workers = 4,
            Capacity = 20,
        },
        Entry(5, "ZonedOffice", "Office Block", "Buildings", "Buildings_Office", 5, 4, 4, true, "") with
        {
            ConstructionCost = 12000,
            Upkeep = 450,
            Workers = 80,
            Capacity = 300,
        },
    };

    /// <summary>
    /// The same five entries, filed under the menus vanilla puts them in, for
    /// the tests that narrow by UiMenu.
    /// </summary>
    private static readonly IReadOnlyList<BuildingCatalogEntry> MenuedEntries = SampleEntries
        .Select(entry => entry with
        {
            UiMenu = entry.Category == "Buildings" ? "Zones" : "Health & Deathcare",
        })
        .ToArray();

		[Fact]
		public void AMenuOpensOnOneChunkLikeEverythingElse()
		{
			// A window that opens on a whole menu costs DOM nodes the UI thread
			// cannot spare; scrolling grows it instead.
			var scoped = new BuildingCatalogQuery { UiMenu = "Roads" };
			var unscoped = new BuildingCatalogQuery();

			Assert.Equal(BuildingCatalogQuery.DefaultLimit, scoped.Limit);
			Assert.Equal(scoped.Limit, unscoped.Limit);
		}

		[Fact]
		public void EnteringAMenuStartsItsWindowOver()
		{
			// The window resets rather than carrying the previous view's growth
			// in: entering a menu after scrolling the whole catalog should not
			// open that menu with two thousand rows already rendered.
			var browsing = new BuildingCatalogQuery { Limit = BuildingCatalogQuery.MaxLimit };
			var entered = (browsing with { UiMenu = "Roads" })
				.ResetWindowIfPredicatesChanged(browsing);

			Assert.Equal(BuildingCatalogQuery.DefaultLimit, entered.Limit);
			Assert.Equal(0, entered.Offset);
		}

		[Fact]
		public void LeavingAMenuGoesBackToTheCatalogsChunk()
		{
			// The other direction matters too: a window grown by scrolling inside
			// a menu must not follow the player out to the unscoped catalog.
			var scoped = new BuildingCatalogQuery { UiMenu = "Roads", Limit = BuildingCatalogQuery.MaxLimit };
			var left = (scoped with { UiMenu = string.Empty })
				.ResetWindowIfPredicatesChanged(scoped);

			Assert.Equal(BuildingCatalogQuery.DefaultLimit, left.Limit);
		}

    [Fact]
    public void Query_SearchAndMenuScope_AreCaseInsensitive()
    {
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            MenuedEntries,
            new BuildingCatalogQuery(SearchText: "POWER", UiMenu: "zones"));

        BuildingCatalogEntry entry = Assert.Single(page.Items);
        Assert.Equal(1, entry.Id);
        Assert.Equal(1, page.TotalCount);
    }

    [Fact]
    public void Query_SearchAlsoMatchesPrefabAndPdxIds()
    {
        BuildingCatalogPage prefabPage = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(SearchText: "windturbine"));
        BuildingCatalogPage pdxPage = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(SearchText: "12345"));

        Assert.Equal(2, Assert.Single(prefabPage.Items).Id);
        Assert.Equal(3, Assert.Single(pdxPage.Items).Id);
    }

    [Fact]
    public void Query_SearchIgnoresSurroundingWhitespaceTheBoxSends()
    {
        // The box sends what was typed, and the space before the next word must not
        // drop every name that ends at this one. The lens trims the query's copy.
        BuildingCatalogPage trailing = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            BuildingCatalogLensState.Initial.Search("turbine ").Query);
        BuildingCatalogPage leading = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            BuildingCatalogLensState.Initial.Search("  wind").Query);

        Assert.Equal(2, Assert.Single(trailing.Items).Id);
        Assert.Equal(2, Assert.Single(leading.Items).Id);
    }

    [Fact]
    public void Query_EverywhereQueryFindsMatchesOutsideTheSelectedCategory()
    {
        var entries = new[]
        {
            SampleEntries[0] with { Id = 1, Name = "Elementary School", UiMenu = "Education", UiCategory = "Schools" },
            SampleEntries[0] with { Id = 2, Name = "Medical Clinic", UiMenu = "Healthcare", UiCategory = "Clinics" },
        };
        BuildingCatalogLensState lens = BuildingCatalogLensState.Initial
            .SelectMenu("Education")
            .SelectCategory("Schools")
            .Search("clinic");

        Assert.Equal(0, BuildingCatalogQueryEngine.Query(entries, lens.Query).TotalCount);
        Assert.Equal(1, BuildingCatalogQueryEngine.Query(entries, lens.EverywhereQuery()).TotalCount);
    }

    [Fact]
    public void Query_RangeFilters_UseInclusiveBounds()
    {
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(
                MinLotWidth: 3,
                MaxLotWidth: 3,
                MinLotDepth: 2,
                MaxLotDepth: 2,
                MinBuildingLevel: 2,
                MaxBuildingLevel: 2));

        BuildingCatalogEntry entry = Assert.Single(page.Items);
        Assert.Equal(4, entry.Id);
        Assert.Equal(1, page.TotalCount);
    }

    [Fact]
    public void Query_FacetValuesOrWithinFacetAndAcrossFacets()
    {
        BuildingCatalogEntry schoolEuropean = Entry(6, "SchoolA", "School A", "ServiceBuildings", "ServiceBuildings_EducationResearch", 4, 4, 2, false, "") with
        {
            BuildingType = "School",
            Theme = "European",
            PlacementFlags = new[] { "RequireRoad" },
        };
        BuildingCatalogEntry hospitalEuropean = schoolEuropean with
        {
            Id = 7,
            PrefabName = "HospitalA",
            Name = "Hospital A",
            BuildingType = "Hospital",
        };
        BuildingCatalogEntry schoolModern = schoolEuropean with
        {
            Id = 8,
            PrefabName = "SchoolB",
            Name = "School B",
            Theme = "Modern",
            PlacementFlags = Array.Empty<string>(),
        };

        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            new[] { schoolEuropean, hospitalEuropean, schoolModern },
            new BuildingCatalogQuery(
                BuildingTypes: new[] { "school", "hospital" },
                Themes: new[] { "european" },
                PlacementFlags: new[] { "RequireRoad" },
                SortColumn: "BuildingLevel"));

        Assert.Equal(new[] { 6, 7 }, page.Items.Select(item => item.Id).ToArray());
        Assert.Equal(2, page.TotalCount);
    }

    [Fact]
    public void Query_MissingFacetValuesDoNotMatchSelectedValues()
    {
        BuildingCatalogEntry missing = Entry(6, "NoFacet", "No facet", "Buildings", "", 1, 1, 1, false, "");

        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            new[] { missing },
            new BuildingCatalogQuery(BuildingTypes: new[] { "School" }));

        Assert.Empty(page.Items);
    }

    [Fact]
    public void Adapter_ProjectsStablePlacementFlagNames()
    {
        BuildingFlags flags = BuildingFlags.RequireRoad
            | BuildingFlags.HasWaterNode
            | BuildingFlags.RestrictedCar;

        Assert.Equal(
            new[] { "RequireRoad", "RestrictedCar", "HasWaterNode" },
            BuildingCatalogAdapter.GetPlacementFlagNames(flags));
        Assert.Empty(BuildingCatalogAdapter.GetPlacementFlagNames(null));
    }

    [Fact]
    public void Adapter_FacetState_UsesDistinctBoundedOptionsAndSelectionState()
    {
        BuildingCatalogEntry school = Entry(6, "SchoolA", "School A", "ServiceBuildings", "", 4, 4, 2, false, "") with
        {
            BuildingType = "School",
            Provenance = "Vanilla",
            DlcId = "-2009",
            Theme = "European",
            AssetPacks = new[] { "PackA" },
            PlacementFlags = new[] { "RequireRoad", "HasWaterNode" },
        };
        BuildingCatalogEntry hospital = school with
        {
            Id = 7,
            BuildingType = "Hospital",
            Provenance = "Custom",
            DlcId = "123",
            Theme = "Modern",
            AssetPacks = new[] { "PackA", "PackB" },
            PlacementFlags = new[] { "RequireRoad" },
        };
        BuildingCatalogEntry unbundled = school with
        {
            Id = 8,
            BuildingType = "Library",
            AssetPacks = new[] { "NoPack" },
        };

        BuildingCatalogFacetState state = BuildingCatalogAdapter.BuildFacetState(
            new[] { school, hospital, unbundled },
            new BuildingCatalogQuery(BuildingTypes: new[] { "hospital" }));

        Assert.True(state.HasSelection);
        // "availability" is offered even where every entry is unlocked: the set
        // is exhaustive, so its resting state is a fact about the view. "content"
        // merges the DLC and pack axes, which are one axis wearing two hats.
        Assert.Equal(new[] { "buildingType", "provenance", "availability", "content", "theme", "placement" }, state.Groups.Select(group => group.Id).ToArray());

        // Nothing ticked at rest, like the vanilla Pack row this control sits
        // beside: nothing picked means nothing excluded.
        BuildingCatalogFacetGroup availability = Assert.Single(state.Groups, group => group.Id == "availability");
        Assert.All(availability.Options, option => Assert.False(option.Selected));
        Assert.False(availability.Narrowing);
        BuildingCatalogFacetGroup role = Assert.Single(state.Groups, group => group.Id == "buildingType");
		Assert.Equal(new[] { "Hospital", "Library", "School" }, role.Options.Select(option => option.Id).ToArray());
		Assert.True(role.Options.Single(option => option.Id == "Hospital").Selected);
		Assert.False(role.Options.Single(option => option.Id == "School").Selected);
		Assert.False(role.Options.Single(option => option.Id == "Library").Selected);

        // The DLC half of Content. Its options carry a "dlc:" prefix so a click
        // finds which of the group's three mechanisms owns it; base game carries
        // none, because the game's own Vanilla toggle owns that.
        BuildingCatalogFacetGroup content = Assert.Single(state.Groups, group => group.Id == "content");
        Assert.Equal("No DLC required", content.Options.Single(option => option.Id == "vanilla").Label);
        Assert.Equal(
            "Unresolved DLC content (ID 123)",
            content.Options.Single(option => option.Id == "dlc:123").Label);

        BuildingCatalogFacetGroup provenance = Assert.Single(state.Groups, group => group.Id == "provenance");
        Assert.Equal("Base game", provenance.Options.Single(option => option.Id == "Vanilla").Label);
        Assert.Equal("Custom content", provenance.Options.Single(option => option.Id == "Custom").Label);

        // Source and Content answer different questions — "who made it" versus
        // "where did it come from" — so they must not offer the same option label
        // in adjacent groups, which reads as one control duplicated.
        Assert.NotEqual(
            provenance.Options.Single(option => option.Id == "Vanilla").Label,
            content.Options.Single(option => option.Id == "vanilla").Label);
    }

    [Fact]
    public void FacetSelection_TogglesValuesCaseInsensitivelyAndClearsOnlyLensFacets()
    {
        BuildingCatalogQuery selected = BuildingCatalogFacetSelection.Toggle(
            new BuildingCatalogQuery(SearchText: "school", Offset: 50),
            "buildingType",
            "School");
        selected = BuildingCatalogFacetSelection.Toggle(selected, "buildingType", "Hospital");

        Assert.Equal(new[] { "School", "Hospital" }, selected.BuildingTypes);
        Assert.Equal(0, selected.Offset);
        Assert.Equal("school", selected.SearchText);

        BuildingCatalogQuery removed = BuildingCatalogFacetSelection.Toggle(selected, "buildingType", "school");
        Assert.Equal(new[] { "Hospital" }, removed.BuildingTypes);

        BuildingCatalogQuery cleared = BuildingCatalogFacetSelection.Clear(removed);
        Assert.Null(cleared.BuildingTypes);
        Assert.Equal("school", cleared.SearchText);
        Assert.Equal(0, cleared.Offset);
    }

    [Fact]
    public void Query_NumericSortAndStableIdTieBreak_WorkInBothDirections()
    {
        BuildingCatalogPage ascending = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(SortColumn: "LotWidth"));
        BuildingCatalogPage descending = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(SortColumn: "BuildingLevel", Descending: true));

        Assert.Equal(new[] { 2, 3, 4, 1, 5 }, ascending.Items.Select(item => item.Id).ToArray());
        Assert.Equal(new[] { 5, 1, 3, 4, 2 }, descending.Items.Select(item => item.Id).ToArray());
    }

    [Fact]
    public void Query_PagesAfterFilteringAndReportsUnpagedTotal()
    {
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            MenuedEntries,
            new BuildingCatalogQuery(UiMenu: "Zones", Offset: 1, Limit: 2));

        Assert.Equal(3, page.TotalCount);
        Assert.Equal(1, page.Offset);
        Assert.Equal(2, page.Limit);
        Assert.Equal(new[] { 5, 2 }, page.Items.Select(item => item.Id).ToArray());
    }

    [Fact]
    public void ResetWindowIfPredicatesChanged_KeepsTheWindowWhenOnlyItsSizeMoved()
    {
        // Load-more is a Limit change and nothing else. If Limit counted as a
        // predicate the window would reset itself the instant it grew, so the
        // button would appear to do nothing.
        BuildingCatalogQuery previous = new(SearchText: "school", Limit: 100);
        BuildingCatalogQuery grown = previous with { Limit = 200 };

        Assert.Equal(200, grown.ResetWindowIfPredicatesChanged(previous).Limit);
        // Offset is masked for the same reason, though nothing moves it now.
        Assert.Equal(100, (previous with { Offset = 100 }).ResetWindowIfPredicatesChanged(previous).Offset);
    }

    [Fact]
    public void ResetWindowIfPredicatesChanged_ShrinksTheWindowWhenTheSearchTextChanged()
    {
        // A new predicate is a new result set, so the player starts over at the
        // base chunk rather than keeping a window they grew against other rows.
        BuildingCatalogQuery previous = new(SearchText: "", Offset: 200, Limit: 600);
        BuildingCatalogQuery searched = previous with { SearchText = "school" };

        Assert.Equal(0, searched.ResetWindowIfPredicatesChanged(previous).Offset);
        Assert.Equal(BuildingCatalogQuery.DefaultLimit, searched.ResetWindowIfPredicatesChanged(previous).Limit);
        Assert.Equal("school", searched.ResetWindowIfPredicatesChanged(previous).SearchText);
    }

    [Fact]
    public void ResetWindowIfPredicatesChanged_ResetsForRangeChanges()
    {
        // The metric drawer feeds the same query, so it invalidates the window
        // just as a search does.
        BuildingCatalogQuery previous = new(Offset: 200, Limit: 600);

        Assert.Equal(0, (previous with { MinLotWidth = 2 }).ResetWindowIfPredicatesChanged(previous).Offset);
        Assert.Equal(0, (previous with { MinCapacity = 500 }).ResetWindowIfPredicatesChanged(previous).Offset);
        Assert.Equal(0, (previous with { UiMenu = "Education & Research" }).ResetWindowIfPredicatesChanged(previous).Offset);
    }

    [Fact]
    public void ResetWindowIfPredicatesChanged_KeepsTheWindowWhenNothingChanged()
    {
        BuildingCatalogQuery previous = new(SearchText: "school", Offset: 200, Limit: 600);

        Assert.Equal(200, (previous with { }).ResetWindowIfPredicatesChanged(previous).Offset);
        Assert.Equal(600, (previous with { }).ResetWindowIfPredicatesChanged(previous).Limit);
    }

    [Fact]
    public void Query_ClampsOffsetPastTheEndSoAShrunkResultStillShowsRows()
    {
        // Narrowing the result set can leave Offset past the new TotalCount.
        // Without a clamp the page comes back empty above a footer describing
        // rows that are not on screen.
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            MenuedEntries,
            new BuildingCatalogQuery(UiMenu: "Zones", Offset: 200, Limit: 100));

        Assert.Equal(3, page.TotalCount);
        Assert.Equal(0, page.Offset);
        Assert.Equal(3, page.Items.Count);
    }

    [Fact]
    public void Query_ClampsOffsetToTheLastPopulatedPageNotToZero()
    {
        // Clamping must land on the last page that actually holds rows, so the
        // player keeps their position instead of being thrown back to page 1.
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            MenuedEntries,
            new BuildingCatalogQuery(UiMenu: "Zones", Offset: 40, Limit: 2));

        Assert.Equal(3, page.TotalCount);
        Assert.Equal(2, page.Offset);
        Assert.Equal(new[] { 2 }, page.Items.Select(item => item.Id).ToArray());
    }

    [Fact]
    public void Query_ClampsOffsetToZeroWhenNothingMatches()
    {
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(SearchText: "nothing-matches-this", Offset: 200));

        Assert.Equal(0, page.TotalCount);
        Assert.Equal(0, page.Offset);
        Assert.Empty(page.Items);
    }

    [Theory]
    [InlineData(-1, 1)]
    [InlineData(0, 1)]
    [InlineData(37, 37)]
    [InlineData(2001, 2000)]
    public void Query_NormalizesBoundsBeforePaging(int requestedLimit, int expectedLimit)
    {
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(Limit: requestedLimit));

        Assert.Equal(expectedLimit, page.Limit);
        Assert.Equal(Math.Min(expectedLimit, SampleEntries.Count), page.Items.Count);
    }

    [Fact]
    public void Query_GivesAMenuScopedQueryTheWindowItAskedFor()
    {
        // Scope does not decide the window size: a scoped query gets the limit it
        // asked for, and covers its menu by asking for more.
        BuildingCatalogPage menu = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(UiMenu: "Roads", Limit: 100));
        BuildingCatalogPage category = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(UiCategory: "RoadsSmallRoads", Limit: 100));

        Assert.Equal(100, menu.Limit);
        Assert.Equal(100, category.Limit);
    }

    [Fact]
    public void Query_StillPagesTheWholeCatalog()
    {
        // No page size makes the unscoped catalog one thing, so the limit stands.
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(Limit: 100));

        Assert.Equal(100, page.Limit);
    }

    [Fact]
    public void Query_AGrownWindowIsAStrictSupersetPrefixOfTheSmallerOne()
    {
        // The property the growing window rests on: the client re-renders the page
        // it is handed rather than accumulating rows, so a larger Limit has to
        // return the same leading rows in the same order.
        BuildingCatalogEntry[] many = Enumerable
            .Range(1, 30)
            .Select(i => Entry(i, $"Prefab{i:D2}", $"Building {i:D2}", "Buildings", "", 2, 2, 1, false, ""))
            .ToArray();
        // Sorted against the order the entries arrive in, so that taking the
        // first n of the SOURCE cannot pass this by accident.
        BuildingCatalogQuery window = new(SortColumn: "Name", Descending: true, Limit: 10);

        BuildingCatalogPage small = BuildingCatalogQueryEngine.Query(many, window);
        BuildingCatalogPage grown = BuildingCatalogQueryEngine.Query(many, window with { Limit = 20 });

        Assert.Equal(30, small.Items[0].Id);

        Assert.Equal(10, small.Items.Count);
        Assert.Equal(20, grown.Items.Count);
        Assert.Equal(
            small.Items.Select(item => item.Id).ToArray(),
            grown.Items.Take(small.Items.Count).Select(item => item.Id).ToArray());
    }

    [Fact]
    public void Query_ReportsHasMoreUntilTheWindowCoversEveryMatch()
    {
        // C# is authoritative about whether more exists: the client cannot work
        // it out from TotalCount without duplicating the clamp, and a Load more
        // button that stays lit on a complete list is worse than none.
        BuildingCatalogPage partial = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(Limit: 2));
        BuildingCatalogPage exact = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(Limit: SampleEntries.Count));
        BuildingCatalogPage roomToSpare = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(Limit: 100));

        Assert.True(partial.HasMore);
        Assert.False(exact.HasMore);
        Assert.False(roomToSpare.HasMore);
    }

    [Fact]
    public void Query_EmptyAndMissingFields_ReturnEmptyWithoutThrowing()
    {
        BuildingCatalogEntry empty = Entry(6, "", "", "", "", 0, 0, 0, false, "");

        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            new[] { empty },
            new BuildingCatalogQuery(SearchText: "missing", SortColumn: "Unknown"));
        BuildingCatalogPage noSource = BuildingCatalogQueryEngine.Query(
            Array.Empty<BuildingCatalogEntry>(),
            new BuildingCatalogQuery());

        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalCount);
        Assert.Empty(noSource.Items);
        Assert.Equal(0, noSource.TotalCount);
    }

    [Fact]
	public void Query_AnalyticalRangesExcludeMissingValuesAndUseInclusiveBounds()
	{
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(
                MinConstructionCost: 12000,
                MaxConstructionCost: 45000,
                MinWorkers: 2,
                MaxWorkers: 12));

        Assert.Equal(new[] { 3, 2 }, page.Items.Select(item => item.Id).ToArray());
        Assert.Equal(2, page.TotalCount);

        BuildingCatalogPage capacityPage = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(MinCapacity: 20, MaxCapacity: 1000));

        Assert.Equal(new[] { 1, 5, 4, 3 }, capacityPage.Items.Select(item => item.Id).ToArray());
        Assert.Equal(4, capacityPage.TotalCount);

        BuildingCatalogPage missing = BuildingCatalogQueryEngine.Query(
            new[] { Entry(6, "NoMetrics", "No metrics", "Buildings", "", 1, 1, 1, false, "") },
            new BuildingCatalogQuery(MinUpkeep: 0));

		Assert.Empty(missing.Items);
	}

	[Fact]
	public void Query_EducationCapacityFloorIsMenuScopedAndInclusive()
	{
		BuildingCatalogEntry smallSchool = Entry(
			7,
			"ElementarySchool",
			"Elementary School",
			"ServiceBuildings",
			"ServiceBuildings_EducationResearch",
			4,
			4,
			2,
			false,
			"") with { Capacity = 100, UiMenu = "Education & Research" };
		BuildingCatalogEntry missingCapacity = smallSchool with { Id = 8, PrefabName = "ResearchCenter", Name = "Research Center", Capacity = null };

		BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
			SampleEntries.Concat(new[] { smallSchool, missingCapacity }),
			new BuildingCatalogQuery(
				UiMenu: "education & research",
				MinCapacity: 100));

		BuildingCatalogEntry entry = Assert.Single(page.Items);
		Assert.Equal(7, entry.Id);
		Assert.Equal(1, page.TotalCount);

	}

    [Fact]
    public void Query_AnalyticalSortKeepsMissingValuesLastAndUsesIdTieBreak()
    {
        BuildingCatalogEntry missing = Entry(6, "NoCost", "No cost", "Buildings", "", 1, 1, 1, false, "");
        BuildingCatalogEntry sameCost = Entry(7, "SameCost", "Same cost", "Buildings", "", 1, 1, 1, false, "") with { ConstructionCost = 5000 };

        BuildingCatalogPage ascending = BuildingCatalogQueryEngine.Query(
            SampleEntries.Concat(new[] { missing, sameCost }),
            new BuildingCatalogQuery(SortColumn: "Cost"));
        BuildingCatalogPage descending = BuildingCatalogQueryEngine.Query(
            SampleEntries.Concat(new[] { missing, sameCost }),
            new BuildingCatalogQuery(SortColumn: "Upkeep", Descending: true));

        Assert.Equal(new[] { 4, 7, 5, 2, 3, 1, 6 }, ascending.Items.Select(item => item.Id).ToArray());
        Assert.Equal(new[] { 1, 3, 5, 2, 4, 6, 7 }, descending.Items.Select(item => item.Id).ToArray());
    }

    [Fact]
    public void Query_RejectsNullInputs()
    {
        Assert.Throws<ArgumentNullException>(() => BuildingCatalogQueryEngine.Query(
            null!,
            new BuildingCatalogQuery()));
        Assert.Throws<ArgumentNullException>(() => BuildingCatalogQueryEngine.Query(
            SampleEntries,
            null!));
    }

    [Fact]
    public void Adapter_WhenPrefabIndexIsUnready_ReturnsAnEmptyBoundedPage()
    {
        bool previousReady = BuildingMenuUtil.IsReady;
        try
        {
            BuildingMenuUtil.IsReady = false;

            BuildingCatalogPage page = new BuildingCatalogAdapter().Build(
                new CatalogSource(new PlacedUniques(), Generation: 1),
                new BuildingCatalogQuery(Limit: BuildingCatalogQuery.MaxLimit + 1),
                VanillaToolbarSelection.None).Page;

            Assert.Empty(page.Items);
            Assert.Equal(0, page.TotalCount);
            Assert.Equal(BuildingCatalogQuery.MaxLimit, page.Limit);
        }
        finally
        {
            BuildingMenuUtil.IsReady = previousReady;
        }
    }

    [Fact, Trait("Requires", "Game")]
    public void BuildingMenuUtil_WhenIndexCategoriesAreMissing_ReturnsNulls()
    {
        bool previousReady = BuildingMenuUtil.IsReady;
        KeyValuePair<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>>[] previousCategories =
            BuildingMenuUtil.CategorizedPrefabs.ToArray();

        try
        {
            BuildingMenuUtil.CategorizedPrefabs.Clear();
            BuildingMenuUtil.IsReady = true;

            Assert.Null(BuildingMenuUtil.GetPrefabBase(0));
            Assert.Null(BuildingMenuUtil.GetPrefabIndex(0));
        }
        finally
        {
            BuildingMenuUtil.CategorizedPrefabs.Clear();
            foreach (KeyValuePair<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>> category in previousCategories)
            {
                BuildingMenuUtil.CategorizedPrefabs[category.Key] = category.Value;
            }

            BuildingMenuUtil.IsReady = previousReady;
        }
    }

    [Fact, Trait("Requires", "Game")]
    public void PageWrite_EmitsStablePageAndEntryPropertyNames()
    {
        BuildingCatalogEntry labeledEntry = SampleEntries[0] with
        {
            Category = "ServiceBuildings",
            SubCategory = "ServiceBuildings_EducationResearch",
            CategoryLabel = "Service Buildings",
            SubCategoryLabel = "Education & Research",
        };
        BuildingCatalogPage page = new(
            new[] { labeledEntry },
            TotalCount: 1,
            Offset: 0,
            Limit: 100);
        RecordingJsonWriter writer = new();

        page.Write(writer);

        Assert.Equal(
            new[] { "items", "id", "prefabName", "name", "category", "subCategory", "categoryLabel", "subCategoryLabel", "thumbnail", "fallbackThumbnail", "silhouetteThumbnail", "lotWidth", "lotDepth", "buildingLevel", "zoneType", "hasParking", "isVanilla", "isLocked",
            "isUnique",
            "isAlreadyBuilt", "unlockMilestone", "devTreeBranch", "devTreeBranchDepth", "unlockRequirements", "bonuses", "costIsPerDistance", "parkingSlots", "pdxModsId", "educationLevel", "buildingType", "provenance", "dlcId", "theme", "assetPacks", "placementFlags", "extensions", "supportedUpgrades", "constructionCost", "upkeep", "workers", "households", "capacity", "serviceRange", "serviceFacts", "footprints", "footprintOverflow", "serviceTextFacts", "speedLimit", "networkWidth", "leisureType", "leisureEfficiency", "electricityConsumption", "waterConsumption", "garbageAccumulation", "telecomNeed", "waterCapacity", "sewageCapacity", "groundPollution", "airPollution", "noisePollution", "groupPath", "groupLabelId", "reorderableSortColumns", "totalCount", "offset", "limit", "hasMore", "bestMatchId", "searchText" },
            writer.PropertyNames);
        Assert.Contains("Write:Int32:1", writer.Tokens);
        Assert.Contains("Write:String:Coal Power Plant", writer.Tokens);
        Assert.Contains("Write:String:ServiceBuildings", writer.Tokens);
        Assert.Contains("Write:String:ServiceBuildings_EducationResearch", writer.Tokens);
        Assert.Contains("Write:String:Service Buildings", writer.Tokens);
        Assert.Contains("Write:String:Education & Research", writer.Tokens);
        Assert.Contains("Write:Int32:100", writer.Tokens);
        Assert.Contains("Write:Double:80000", writer.Tokens);
    }

    [Fact, Trait("Requires", "Game")]
    public void EntryWrite_WritesEachFactListAsAnArrayOfItsItems()
    {
        // The three lists share one writer, so one list's items must not leak
        // into the next, and an empty list is still an array.
        BuildingCatalogEntry entry = SampleEntries[0] with
        {
            ServiceFacts = new[] { new ServiceFact("capacity", 5), new ServiceFact("range", 3) },
            Footprints = new[] { new ZoneFootprint(2, 3) },
            ServiceTextFacts = System.Array.Empty<ServiceTextFact>(),
        };
        RecordingJsonWriter writer = new();

        entry.Write(writer);

        List<string> After(string property, int count) =>
            writer.Tokens.SkipWhile(token => token != "PropertyName:" + property).Skip(1).Take(count).ToList();

        Assert.Equal(
            new[]
            {
                "ArrayBegin:2",
                "TypeBegin:" + typeof(ServiceFact).FullName, "PropertyName:key", "Write:String:capacity", "PropertyName:value", "Write:Double:5", "TypeEnd",
                "TypeBegin:" + typeof(ServiceFact).FullName, "PropertyName:key", "Write:String:range", "PropertyName:value", "Write:Double:3", "TypeEnd",
                "ArrayEnd",
                "PropertyName:footprints",
            },
            After("serviceFacts", 15));
        Assert.Equal(
            new[]
            {
                "ArrayBegin:1",
                "TypeBegin:" + typeof(ZoneFootprint).FullName, "PropertyName:width", "Write:Int32:2", "PropertyName:depth", "Write:Int32:3", "TypeEnd",
                "ArrayEnd",
                "PropertyName:footprintOverflow",
            },
            After("footprints", 9));
        Assert.Equal(new[] { "ArrayBegin:0", "ArrayEnd" }, After("serviceTextFacts", 2));
    }

    [Fact]
    public void Query_MenuScopeDropsUpgradesButUnscopedQueriesKeepThem()
    {
        // Vanilla drops service upgrades from every build menu, so a menu-scoped
        // query must not offer what the player cannot place. An unscoped query is
        // not looking at a menu, and search still finds them there.
        BuildingCatalogEntry upgrade = SampleEntries[3] with
        {
            Id = 41,
            PrefabName = "HospitalWing02",
            Name = "Hospital Wing",
            UiMenu = "Health & Deathcare",
            UiCategory = "Healthcare",
            Extensions = new[] { "HospitalWing02" },
        };
        BuildingCatalogEntry placeable = SampleEntries[3] with
        {
            Id = 42,
            PrefabName = "Hospital01",
            Name = "Hospital",
            UiMenu = "Health & Deathcare",
            UiCategory = "Healthcare",
        };
        BuildingCatalogEntry[] entries = { upgrade, placeable };

        BuildingCatalogPage scoped = BuildingCatalogQueryEngine.Query(
            entries,
            new BuildingCatalogQuery(UiMenu: "Health & Deathcare"));

        Assert.Equal(42, Assert.Single(scoped.Items).Id);

        BuildingCatalogPage unscoped = BuildingCatalogQueryEngine.Query(
            entries,
            new BuildingCatalogQuery());

        Assert.Equal(new[] { 41, 42 }, unscoped.Items.Select(item => item.Id).OrderBy(id => id));
    }

    [Fact]
    public void Query_SortsParkingByCountRatherThanByTheFlag()
    {
        // The flag alone leaves two buckets in arbitrary order, so a set that
        // agrees on it appears not to sort at all.
        BuildingCatalogEntry small = SampleEntries[3] with { Id = 61, HasParking = true, ParkingSlots = 12 };
        BuildingCatalogEntry large = SampleEntries[3] with { Id = 62, HasParking = true, ParkingSlots = 240 };
        BuildingCatalogEntry none = SampleEntries[3] with { Id = 63, HasParking = false, ParkingSlots = 0 };

        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            new[] { small, none, large },
            new BuildingCatalogQuery(SortColumn: "HasParking", Descending: true));

        Assert.Equal(new[] { 62, 61, 63 }, page.Items.Select(entry => entry.Id).ToArray());
    }

    [Fact]
    public void Query_RelevanceOrdersWithinAGroupAndTheSortColumnBreaksTies()
    {
        // Exact, then prefix, then the two word-start hits — the shorter name
        // first, cost never getting a say between them.
        var entries = new[]
        {
            SampleEntries[0] with { Id = 1, Name = "Clinic Annex", ConstructionCost = 1 },
            SampleEntries[0] with { Id = 2, Name = "Clinic", ConstructionCost = 9 },
            SampleEntries[0] with { Id = 3, Name = "Medical Clinic", ConstructionCost = 5 },
            SampleEntries[0] with { Id = 4, Name = "Old Clinic", ConstructionCost = 3 },
        };

        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            entries,
            new BuildingCatalogQuery(SearchText: "clinic", SortColumn: "ConstructionCost"));

        Assert.Equal(new[] { 2, 1, 4, 3 }, page.Items.Select(e => e.Id).ToArray());
    }

    [Fact]
    public void Query_RelevanceStaysInsideTheGroup()
    {
        // Grouping is the primary key; relevance only reorders within it.
        var entries = new[]
        {
            SampleEntries[0] with { Id = 1, Name = "Clinic", Category = "ServiceBuildings" },
            SampleEntries[0] with { Id = 2, Name = "Old Clinic", Category = "Buildings" },
        };

        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            entries,
            new BuildingCatalogQuery(SearchText: "clinic", GroupBy: "category"));

        Assert.Equal(new[] { 2, 1 }, page.Items.Select(e => e.Id).ToArray());
    }

    [Fact]
    public void Query_BestMatchIsTheBestAcrossGroupsNotTheFirstRow()
    {
        // Grouping puts Old Clinic's group first; Enter should still arm Clinic.
        var entries = new[]
        {
            SampleEntries[0] with { Id = 1, Name = "Clinic", Category = "ServiceBuildings" },
            SampleEntries[0] with { Id = 2, Name = "Old Clinic", Category = "Buildings" },
        };

        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            entries,
            new BuildingCatalogQuery(SearchText: "clinic", GroupBy: "category"));

        Assert.Equal(2, page.Items[0].Id);
        Assert.Equal(1, page.BestMatchId);
    }

    [Fact]
    public void Query_BestMatchTieGoesToTheShorterName()
    {
        // Two word-start hits score the same, and the plain name is nearly always
        // what was meant — the tie-break the ordering within a group uses.
        var entries = new[]
        {
            SampleEntries[0] with { Id = 1, Name = "Medical Clinic", Category = "Buildings" },
            SampleEntries[0] with { Id = 2, Name = "Old Clinic", Category = "ServiceBuildings" },
        };

        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            entries,
            new BuildingCatalogQuery(SearchText: "clinic", GroupBy: "category"));

        Assert.Equal(2, page.BestMatchId);
    }

    [Fact]
    public void Query_BestMatchSkipsWhatCannotBePlaced()
    {
        // Enter on a locked or already-built match does nothing, so it goes to the
        // best one that can actually be placed.
        var entries = new[]
        {
            SampleEntries[0] with { Id = 1, Name = "Hospital", IsLocked = true },
            SampleEntries[0] with { Id = 2, Name = "Hospital", IsUnique = true, IsAlreadyBuilt = true },
            SampleEntries[0] with { Id = 3, Name = "General Hospital" },
        };

        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(entries, new BuildingCatalogQuery(SearchText: "hospital"));

        Assert.Equal(3, page.BestMatchId);
    }

    [Fact]
    public void Query_HasNoBestMatchWhenNothingCanBePlaced()
    {
        var entries = new[] { SampleEntries[0] with { Id = 1, Name = "Hospital", IsLocked = true } };

        Assert.Null(BuildingCatalogQueryEngine.Query(entries, new BuildingCatalogQuery(SearchText: "hospital")).BestMatchId);
    }

    [Fact]
    public void Query_NamesTheSearchThePageWasBuiltFor()
    {
        // The box echoes at once and the page follows a debounce later; the UI holds
        // Enter until the two agree, so the page has to say which search it answers.
        Assert.Equal("clinic", BuildingCatalogQueryEngine.Query(SampleEntries, new BuildingCatalogQuery(SearchText: "clinic")).SearchText);
        Assert.Equal(string.Empty, BuildingCatalogQueryEngine.Query(SampleEntries, new BuildingCatalogQuery()).SearchText);
    }

    [Fact]
    public void Query_HasNoBestMatchWithoutASearchOrAResult()
    {
        Assert.Null(BuildingCatalogQueryEngine.Query(SampleEntries, new BuildingCatalogQuery()).BestMatchId);
        Assert.Null(BuildingCatalogQueryEngine.Query(SampleEntries, new BuildingCatalogQuery(SearchText: "   ")).BestMatchId);
        Assert.Null(BuildingCatalogQueryEngine.Query(SampleEntries, new BuildingCatalogQuery(SearchText: "nothing-matches-this")).BestMatchId);
    }

    private static BuildingCatalogEntry Entry(
        int id,
        string prefabName,
        string name,
        string category,
        string subCategory,
        int lotWidth,
        int lotDepth,
        int buildingLevel,
        bool hasParking,
        string pdxModsId)
    {
        return new BuildingCatalogEntry(
            Id: id,
            PrefabName: prefabName,
            Name: name,
            Category: category,
            SubCategory: subCategory,
            Thumbnail: string.Empty,
            LotWidth: lotWidth,
            LotDepth: lotDepth,
            BuildingLevel: buildingLevel,
            ZoneType: ZoneTypeFilter.Any,
            HasParking: hasParking,
            IsVanilla: true,
            PdxModsId: pdxModsId);
    }

    private sealed class RecordingJsonWriter : IJsonWriter
    {
        public List<string> Tokens { get; } = new();

        public IReadOnlyList<string> PropertyNames => Tokens
            .Where(token => token.StartsWith("PropertyName:", StringComparison.Ordinal))
            .Select(token => token["PropertyName:".Length..])
            .ToArray();

        public string debugName => nameof(RecordingJsonWriter);

        public void TypeBegin(string typeName) => Tokens.Add("TypeBegin:" + typeName);
        public void TypeEnd() => Tokens.Add("TypeEnd");
        public void MapBegin(uint size) => Tokens.Add("MapBegin:" + size);
        public void MapEnd() => Tokens.Add("MapEnd");
        public void ArrayBegin(uint size) => Tokens.Add("ArrayBegin:" + size);
        public void ArrayEnd() => Tokens.Add("ArrayEnd");
        public void PropertyName(string name) => Tokens.Add("PropertyName:" + name);
        public void WriteNull() => Tokens.Add("WriteNull");
        public void Write(bool value) => Tokens.Add("Write:Boolean:" + value);
        public void Write(int value) => Tokens.Add("Write:Int32:" + value);
        public void Write(uint value) => Tokens.Add("Write:UInt32:" + value);
        public void Write(long value) => Tokens.Add("Write:Int64:" + value);
        public void Write(ulong value) => Tokens.Add("Write:UInt64:" + value);
        public void Write(float value) => Tokens.Add("Write:Single:" + value);
        public void Write(double value) => Tokens.Add("Write:Double:" + value);
        public void Write(string value) => Tokens.Add("Write:String:" + value);
    }
}
