using Colossal.UI.Binding;

using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Services;
using FindItBuildingMenu.Utilities;

using Game.Prefabs;

using System.Collections.Generic;

namespace FindItBuildingMenu.Tests;

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

		[Fact]
		public void AMenuOpensOnOneChunkLikeEverythingElse()
		{
			// It used to open on the whole menu. That was compensation for a
			// scroll that never grew the window — cs2/ui's Scrollable takes an
			// onScroll prop and never forwards it, so the passive load-more had
			// never once fired and the only way past row 100 was a button at the
			// end of a list nothing said was incomplete.
			//
			// A frame loop over scrollTop replaced it, and the cost of the
			// compensation was measured: Roads & Networks at 401 rows is 8,465 DOM
			// nodes, 95% of the game UI's total, and it more than halved the UI
			// thread's throughput. Reported from play as the interface lagging.
			var scoped = new BuildingCatalogQuery { UiMenu = "Roads" };
			var unscoped = new BuildingCatalogQuery();

			// Asserted on Limit itself now. This used to read StartingLimit, a
			// property whose two branches had both been walked back to
			// DefaultLimit — so it compared the constant to itself and would have
			// held whatever the scoping did.
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
    public void Query_SearchAndCategoryFilters_AreCaseInsensitive()
    {
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(SearchText: "POWER", Category: "buildings"));

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
    public void Query_RangeSubcategoryAndParkingFilters_UseInclusiveBounds()
    {
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(
                SubCategory: "ServiceBuildings_Health",
                MinLotWidth: 3,
                MaxLotWidth: 3,
                MinLotDepth: 2,
                MaxLotDepth: 2,
                MinBuildingLevel: 2,
                MaxBuildingLevel: 2,
                HasParking: false));

        BuildingCatalogEntry entry = Assert.Single(page.Items);
        Assert.Equal(4, entry.Id);
        Assert.Equal(1, page.TotalCount);
    }

    [Fact]
    public void Query_BuildMenuSectionsAndSubcategoriesFilterProjectedEntries()
    {
        BuildingCatalogEntry[] entries =
        {
            SampleEntries[0] with { VanillaSection = VanillaBuildMenuTaxonomy.Zones, VanillaSubCategory = "Buildings_Industrial" },
            SampleEntries[1] with { VanillaSection = VanillaBuildMenuTaxonomy.Zones, VanillaSubCategory = "Buildings_Specialized" },
            SampleEntries[2] with { VanillaSection = VanillaBuildMenuTaxonomy.ServiceBuildings, VanillaSubCategory = "ServiceBuildings_Water" },
            SampleEntries[3] with { VanillaSection = VanillaBuildMenuTaxonomy.ServiceBuildings, VanillaSubCategory = "ServiceBuildings_Health", IsFavorited = true },
            SampleEntries[4] with { VanillaSection = VanillaBuildMenuTaxonomy.SignatureBuildings, VanillaSubCategory = "Buildings_Office" },
        };

        BuildingCatalogPage zones = BuildingCatalogQueryEngine.Query(
            entries,
            new BuildingCatalogQuery(BuildMenuSection: VanillaBuildMenuTaxonomy.Zones));
        BuildingCatalogPage serviceHealth = BuildingCatalogQueryEngine.Query(
            entries,
            new BuildingCatalogQuery(
                BuildMenuSection: VanillaBuildMenuTaxonomy.ServiceBuildings,
                BuildMenuSubCategory: "ServiceBuildings_Health"));
        BuildingCatalogPage favorites = BuildingCatalogQueryEngine.Query(
            entries,
            new BuildingCatalogQuery(BuildMenuSection: VanillaBuildMenuTaxonomy.Favorites));

        Assert.Equal(new[] { 1, 2 }, zones.Items.Select(entry => entry.Id).ToArray());
        Assert.Equal(2, zones.TotalCount);
        Assert.Equal(new[] { 4 }, serviceHealth.Items.Select(entry => entry.Id).ToArray());
        Assert.Equal(new[] { 4 }, favorites.Items.Select(entry => entry.Id).ToArray());
    }

    [Fact]
    public void Query_UnknownBuildMenuSectionDoesNotFallBackToAllBuildings()
    {
        BuildingCatalogPage invalid = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(BuildMenuSection: "Networks"));
        BuildingCatalogPage all = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(BuildMenuSection: VanillaBuildMenuTaxonomy.AllBuildings));

        Assert.Empty(invalid.Items);
        Assert.Equal(0, invalid.TotalCount);
        Assert.Equal(SampleEntries.Count, all.TotalCount);
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
    public void Query_ExtensionFacetMatchesStableExtensionIdentity()
    {
        BuildingCatalogEntry extension = SampleEntries[2] with
        {
            Id = 9,
            PrefabName = "HospitalWing01",
            Name = "Hospital Wing",
            Extensions = new[] { "HospitalWing01" },
        };

        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries.Append(extension),
            new BuildingCatalogQuery(Extensions: new[] { "hospitalwing01" }));

        BuildingCatalogEntry entry = Assert.Single(page.Items);
        Assert.Equal(9, entry.Id);
        Assert.Equal(1, page.TotalCount);
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
            AssetPacks = new[] { "FindIt_NoPack" },
        };

        BuildingCatalogFacetState state = BuildingCatalogAdapter.BuildFacetState(
            new[] { school, hospital, unbundled },
            new BuildingCatalogQuery(BuildingTypes: new[] { "hospital" }));

        Assert.True(state.HasSelection);
        // "availability" IS offered even though all three fixtures are unlocked.
        // Every other dimension is dropped when it holds one value and cannot
        // narrow anything (IsWorthOffering), but this one is exhaustive: its
        // resting state is a fact about the view rather than an absence of
        // input, and "everything here is unlocked" is worth saying.
        // "content", not "dlc" and "assetPack": those two were one axis wearing
        // two hats — measured in game, one strictly contained the other — so
        // they are merged. The pack half is keyed on the pack ENTITY and reads
        // the game's own selection; see AssetPackFacetTests, which seeds it.
        Assert.Equal(new[] { "buildingType", "provenance", "availability", "content", "theme", "placement" }, state.Groups.Select(group => group.Id).ToArray());

        // NOTHING ticked at rest, matching the vanilla Pack row this control
        // now sits beside — measured in the live panel: Pack draws every button
        // dark while every pack is showing, because nothing picked means
        // nothing excluded. Availability is the same kind of set and says it
        // the same way.
        BuildingCatalogFacetGroup availability = Assert.Single(state.Groups, group => group.Id == "availability");
        Assert.All(availability.Options, option => Assert.False(option.Selected));
        Assert.False(availability.Narrowing);
        BuildingCatalogFacetGroup role = Assert.Single(state.Groups, group => group.Id == "buildingType");
		Assert.Equal(new[] { "Hospital", "Library", "School" }, role.Options.Select(option => option.Id).ToArray());
		Assert.True(role.Options.Single(option => option.Id == "Hospital").Selected);
		Assert.False(role.Options.Single(option => option.Id == "School").Selected);
		Assert.False(role.Options.Single(option => option.Id == "Library").Selected);

        // The DLC half of Content. Its options carry a "dlc:" prefix because
        // the group spans three mechanisms and the prefix is how a click finds
        // the one that owns it; base game carries none, because the game's own
        // Vanilla toggle owns that.
        BuildingCatalogFacetGroup content = Assert.Single(state.Groups, group => group.Id == "content");
        Assert.Equal("No DLC required", content.Options.Single(option => option.Id == "vanilla").Label);
        Assert.Equal(
            "Unresolved DLC content (ID 123)",
            content.Options.Single(option => option.Id == "dlc:123").Label);

        BuildingCatalogFacetGroup provenance = Assert.Single(state.Groups, group => group.Id == "provenance");
        Assert.Equal("Base game", provenance.Options.Single(option => option.Id == "Vanilla").Label);
        Assert.Equal("Custom content", provenance.Options.Single(option => option.Id == "Custom").Label);

        // Source and Content answer different questions — "who made it" versus
        // "where did it come from" — so they must not offer the same option
        // label in adjacent groups, which reads as a duplicated control. The
        // whole reason Content exists is that two groups DID read that way.
        Assert.NotEqual(
            provenance.Options.Single(option => option.Id == "Vanilla").Label,
            content.Options.Single(option => option.Id == "vanilla").Label);

        // The pack group used to be asserted here on its NAMES, including a
        // synthetic "FindIt_NoPack" for assets belonging to none. Both are gone
        // with the name-keyed field: the group is keyed on the pack entity now
        // (AssetPackFacetTests), and "belongs to no pack" is what vanilla's own
        // base-game chip already says, beside its Pack row.
    }

    [Fact]
    public void Adapter_ExtensionFacetUsesReadableStableOptionsAndOmitsEmptyMetadata()
    {
        BuildingCatalogEntry extension = SampleEntries[2] with
        {
            Id = 9,
            PrefabName = "HospitalWing01",
            Extensions = new[] { "HospitalWing01" },
        };

        BuildingCatalogFacetState state = BuildingCatalogAdapter.BuildFacetState(
            new[] { SampleEntries[0], extension },
            new BuildingCatalogQuery(Extensions: new[] { "HospitalWing01" }));

        BuildingCatalogFacetGroup group = Assert.Single(state.Groups, facet => facet.Id == "extension");
        BuildingCatalogFacetOption option = Assert.Single(group.Options);
        Assert.Equal("HospitalWing01", option.Id);
        Assert.Equal("Hospital Wing 01", option.Label);
        Assert.True(option.Selected);

        BuildingCatalogFacetState empty = BuildingCatalogAdapter.BuildFacetState(
            new[] { SampleEntries[0] },
            new BuildingCatalogQuery());
        Assert.DoesNotContain(empty.Groups, facet => facet.Id == "extension");
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

        BuildingCatalogQuery extensionSelected = BuildingCatalogFacetSelection.Toggle(
            new BuildingCatalogQuery(SearchText: "wing", Offset: 50),
            "extension",
            "HospitalWing01");
        Assert.Equal(new[] { "HospitalWing01" }, extensionSelected.Extensions);
        BuildingCatalogQuery extensionCleared = BuildingCatalogFacetSelection.Clear(extensionSelected);
        Assert.Null(extensionCleared.Extensions);
        Assert.Equal("wing", extensionCleared.SearchText);
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
            SampleEntries,
            new BuildingCatalogQuery(Category: "Buildings", Offset: 1, Limit: 2));

        Assert.Equal(3, page.TotalCount);
        Assert.Equal(1, page.Offset);
        Assert.Equal(2, page.Limit);
        Assert.Equal(new[] { 5, 2 }, page.Items.Select(item => item.Id).ToArray());
    }

    [Fact]
    public void LegacyFilterSnapshot_ReportsNothingActiveWhenTheLegacyPanelIsUntouched()
    {
        Assert.Empty(BuildingLensLegacyFilterSnapshot.Empty.Describe());
        Assert.False(BuildingLensLegacyFilterSnapshot.Empty.HasSelection);
    }

    [Fact]
    public void LegacyFilterSnapshot_NamesEveryFilterThatShapesTheLensResult()
    {
        // These are applied to the lens index by BuildingCatalogAdapter via
        // Filters.GetFilterList, but the lens summary used to count only its
        // own facets and ranges — so the panel could claim "No active lens
        // filters" while silently hiding most of the catalog.
        BuildingLensLegacyFilterSnapshot snapshot = BuildingLensLegacyFilterSnapshot.Empty with
        {
            OnlyPlaced = true,
            HideVanilla = true,
            WithParking = true,
            BuildingLevel = 3,
        };

        Assert.True(snapshot.HasSelection);
        Assert.Equal(
            new[] { "Hide vanilla", "Only placed", "With parking", "Building level" },
            snapshot.Describe());
    }

    [Fact]
    public void LegacyFilterSnapshot_TreatsParkingAsMutuallyExclusive()
    {
        // GetFilterList uses if/else for this pair, so reporting both would
        // describe a filter the query never applied.
        //
        // Theme was the other pair here. It went with ThemeOption: the game's
        // own toolbar row answers that question now, so a second theme filter
        // of ours could only disagree with it.
        BuildingLensLegacyFilterSnapshot parking = BuildingLensLegacyFilterSnapshot.Empty with
        {
            WithParking = true,
            WithoutParking = true,
        };
        Assert.Equal(new[] { "With parking" }, parking.Describe());
    }

    [Fact]
    public void CompareSelection_TogglesAndHoldsTheLimit()
    {
        IReadOnlyList<int> one = BuildingCatalogCompareSelection.Toggle(Array.Empty<int>(), 1);
        IReadOnlyList<int> two = BuildingCatalogCompareSelection.Toggle(one, 2);
        IReadOnlyList<int> three = BuildingCatalogCompareSelection.Toggle(two, 3);

        Assert.Equal(new[] { 1, 2, 3 }, three);

        // At the limit an unselected id is refused rather than silently
        // evicting one the player already chose.
        Assert.Equal(new[] { 1, 2, 3 }, BuildingCatalogCompareSelection.Toggle(three, 4));

        // Toggling a selected id always removes it, even at the limit.
        Assert.Equal(new[] { 1, 3 }, BuildingCatalogCompareSelection.Toggle(three, 2));
    }

    [Fact]
    public void CompareSelection_PreservesSelectionOrderAndIgnoresDuplicates()
    {
        IReadOnlyList<int> selection = BuildingCatalogCompareSelection.Toggle(
            BuildingCatalogCompareSelection.Toggle(Array.Empty<int>(), 7),
            4);

        Assert.Equal(new[] { 7, 4 }, selection);
        Assert.Equal(new[] { 7 }, BuildingCatalogCompareSelection.Toggle(selection, 4));
    }

    [Fact]
    public void CompareSelection_MatchesTheClientLimitContract()
    {
        // The tray renders "n / MAX" from the TypeScript MAX_COMPARE_ENTRIES.
        // If these ever diverge the counter lies about the real limit.
        Assert.Equal(3, BuildingCatalogCompareSelection.MaxEntries);
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
    public void ResetWindowIfPredicatesChanged_ResetsForLegacyFilterAndRangeChanges()
    {
        // The legacy FindIt parking filters and the metric drawer feed the same
        // query, so they invalidate the window just as a search does.
        BuildingCatalogQuery previous = new(Offset: 200, Limit: 600);

        Assert.Equal(0, (previous with { HasParking = true }).ResetWindowIfPredicatesChanged(previous).Offset);
        Assert.Equal(0, (previous with { MinCapacity = 500 }).ResetWindowIfPredicatesChanged(previous).Offset);
        Assert.Equal(0, (previous with { BuildMenuSection = "Education" }).ResetWindowIfPredicatesChanged(previous).Offset);
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
        // A player on page 3 who narrows the result set leaves Offset far past
        // the new TotalCount. Without a clamp the engine skips every match and
        // returns an empty page while reporting a non-zero total, which the UI
        // renders as "no buildings match" above a footer describing rows that
        // are not on screen.
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(Category: "Buildings", Offset: 200, Limit: 100));

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
            SampleEntries,
            new BuildingCatalogQuery(Category: "Buildings", Offset: 40, Limit: 2));

        // Category "Buildings" orders to [1, 5, 2]; the last page holds id 2.
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
        // Menu scope used to force the limit to the ceiling, so the window size
        // changed under the player the moment they entered a menu and changed
        // back when they left. The growing window covers a whole menu without
        // that: it just keeps asking for more.
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
        // Unscoped, the set is 3,667 buildings and no page size makes that one
        // thing — so the 100 stands.
        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            SampleEntries,
            new BuildingCatalogQuery(Limit: 100));

        Assert.Equal(100, page.Limit);
    }

    [Fact]
    public void Query_AGrownWindowIsAStrictSupersetPrefixOfTheSmallerOne()
    {
        // The property the whole growing-window design rests on. The client
        // never accumulates rows — placing a building unmounts the lens panel,
        // which would destroy any UI-side accumulator — so it re-renders the
        // page it is handed. That only works if a larger Limit returns the same
        // leading rows in the same order, which it does because Order runs over
        // the whole match set every call and the window is only ever a prefix.
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
	public void Query_EducationCapacityFloorIsCategoryScopedAndInclusive()
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
			"") with { Capacity = 100 };
		BuildingCatalogEntry missingCapacity = smallSchool with { Id = 8, PrefabName = "ResearchCenter", Name = "Research Center", Capacity = null };

		BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
			SampleEntries.Concat(new[] { smallSchool, missingCapacity }),
			new BuildingCatalogQuery(
				Category: "servicebuildings",
				SubCategory: "servicebuildings_educationresearch",
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
    public void Adapter_WhenFindItIndexIsUnready_ReturnsAnEmptyBoundedPage()
    {
        bool previousReady = FindItUtil.IsReady;
        try
        {
            FindItUtil.IsReady = false;

            BuildingCatalogPage page = new BuildingCatalogAdapter().Query(
                new BuildingCatalogQuery(Limit: BuildingCatalogQuery.MaxLimit + 1));

            Assert.Empty(page.Items);
            Assert.Equal(0, page.TotalCount);
            Assert.Equal(BuildingCatalogQuery.MaxLimit, page.Limit);
        }
        finally
        {
            FindItUtil.IsReady = previousReady;
        }
    }

    [Fact]
    public void Filters_CatalogFilterList_ExcludesSearchForTheTypedLensQuery()
    {
        Filters filters = new()
        {
            CurrentSearch = "academy",
            SelectedBuildingCorner = BuildingCornerFilter.Any,
        };

        Assert.Empty(filters.GetFilterList(includeSearch: false));
    }

    [Fact]
    public void FindItUtil_WhenIndexCategoriesAreMissing_ReturnsEmptyCollections()
    {
        bool previousReady = FindItUtil.IsReady;
        PrefabCategory previousCategory = FindItUtil.CurrentCategory;
        PrefabSubCategory previousSubCategory = FindItUtil.CurrentSubCategory;
        KeyValuePair<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>>[] previousCategories =
            FindItUtil.CategorizedPrefabs.ToArray();

        try
        {
            FindItUtil.CategorizedPrefabs.Clear();
            FindItUtil.CurrentCategory = PrefabCategory.Any;
            FindItUtil.CurrentSubCategory = PrefabSubCategory.Any;
            FindItUtil.IsReady = true;

            Assert.Empty(FindItUtil.GetSubCategories());
            Assert.Empty(FindItUtil.GetFilteredPrefabs());
            Assert.Empty(FindItUtil.GetUnfilteredPrefabs());
            Assert.Null(FindItUtil.GetPrefabBase(0));
            Assert.Null(FindItUtil.GetPrefabIndex(0));
        }
        finally
        {
            FindItUtil.CategorizedPrefabs.Clear();
            foreach (KeyValuePair<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>> category in previousCategories)
            {
                FindItUtil.CategorizedPrefabs[category.Key] = category.Value;
            }

            FindItUtil.IsReady = previousReady;
            FindItUtil.CurrentCategory = previousCategory;
            FindItUtil.CurrentSubCategory = previousSubCategory;
        }
    }

    [Fact]
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
            new[] { "items", "id", "prefabName", "name", "category", "subCategory", "categoryLabel", "subCategoryLabel", "thumbnail", "fallbackThumbnail", "silhouetteThumbnail", "uiMenu", "uiCategory", "lotWidth", "lotDepth", "buildingLevel", "zoneType", "hasParking", "isVanilla", "isLocked",
            "isUnique",
            "isAlreadyBuilt", "unlockMilestone", "devTreeBranch", "devTreeBranchDepth", "unlockRequirements", "bonuses", "costIsPerDistance", "parkingSlots", "isFavorited", "pdxModsId", "educationLevel", "buildingType", "provenance", "dlcId", "theme", "assetPacks", "placementFlags", "extensions", "constructionCost", "upkeep", "workers", "households", "capacity", "electricityConsumption", "waterConsumption", "garbageAccumulation", "waterCapacity", "sewageCapacity", "groundPollution", "airPollution", "noisePollution", "sortCanReorder", "reorderableSortColumns", "totalCount", "offset", "limit", "hasMore" },
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

    [Fact]
    public void Query_MenuScopeDropsUpgradesButUnscopedQueriesKeepThem()
    {
        // Vanilla drops service upgrades from every build menu
        // (ToolbarUISystem.FilterOutUpgrades), so a menu-scoped query must not
        // offer something the player cannot place. An UNSCOPED query is not
        // looking at a menu and must still find them, or the Extensions facet
        // offers values that match nothing.
        //
        // This exact exclusion once ran outside the menu guard, which deleted
        // every upgrade-bearing asset from the whole catalog.
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
            new BuildingCatalogQuery(Extensions: new[] { "hospitalwing02" }));

        Assert.Equal(41, Assert.Single(unscoped.Items).Id);
    }

    [Fact]
    public void Query_MenuScopeReplacesTheSectionOverlayRatherThanLayeringOnIt()
    {
        // A menu member that indexes into a different section than the preset
        // pins. Roads is pinned to Networks, but its parking lots index as
        // ServiceBuildings — 35 of 157 members used to vanish for exactly this.
        BuildingCatalogEntry parkingLot = SampleEntries[3] with
        {
            Id = 51,
            PrefabName = "ParkingLot01",
            Name = "Parking Lot",
            UiMenu = "Roads",
            UiCategory = "RoadsParking",
            VanillaSection = "ServiceBuildings",
        };

        // Scoped to the menu: the game says it is in Roads, so it is in Roads,
        // whatever our own section reconstruction thinks.
        BuildingCatalogPage scoped = BuildingCatalogQueryEngine.Query(
            new[] { parkingLot },
            new BuildingCatalogQuery(UiMenu: "Roads", BuildMenuSection: "Networks"));

        Assert.Equal(51, Assert.Single(scoped.Items).Id);

        // Unscoped, the section overlay still applies — it is the only scope
        // there is when no menu is named.
        BuildingCatalogPage unscoped = BuildingCatalogQueryEngine.Query(
            new[] { parkingLot },
            new BuildingCatalogQuery(BuildMenuSection: "Networks"));

        Assert.Empty(unscoped.Items);
    }

    [Fact]
    public void Query_SortsParkingByCountRatherThanByTheFlag()
    {
        // The flag put everything into two buckets and left the order inside
        // them alone, so a set that agreed — all of Water & Sewage — appeared
        // not to sort at all.
        BuildingCatalogEntry small = SampleEntries[3] with { Id = 61, HasParking = true, ParkingSlots = 12 };
        BuildingCatalogEntry large = SampleEntries[3] with { Id = 62, HasParking = true, ParkingSlots = 240 };
        BuildingCatalogEntry none = SampleEntries[3] with { Id = 63, HasParking = false, ParkingSlots = 0 };

        BuildingCatalogPage page = BuildingCatalogQueryEngine.Query(
            new[] { small, none, large },
            new BuildingCatalogQuery(SortColumn: "HasParking", Descending: true));

        Assert.Equal(new[] { 62, 61, 63 }, page.Items.Select(entry => entry.Id).ToArray());
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
            IsUniqueMesh: false,
            IsVanilla: true,
            IsFavorited: false,
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
