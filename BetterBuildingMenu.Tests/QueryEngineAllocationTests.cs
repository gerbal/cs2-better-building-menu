using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

namespace BetterBuildingMenu.Tests;

public sealed class QueryEngineAllocationTests
{
    // Every refresh runs the match once per entry, so a closure built per call is a per-entry
    // allocation however early the call returns. This runs on CoreCLR, where a foreach over an
    // IReadOnlyList still allocates its enumerator per entry, so a selected zone type guards
    // the indexed loops.
    [Fact]
    public void Count_AllocatesNothingPerEntry_WithEveryFilterSet()
    {
        var query = new BuildingCatalogQuery(
            SearchText: "building",
            StripTabs: new[] { StripAxes.BuildingValue },
            SchoolTier: 1,
            Availability: new[] { BuildingCatalogFacetSelection.Availability.Unlocked },
            BuildingTypes: new[] { "school" },
            Provenance: new[] { "vanilla" },
            Themes: new[] { "european" },
            PlacementFlags: new[] { "RequireRoad" },
            ZoneTypes: new[] { "low" });

        Assert.Equal(0, PerEntryBytes(query));
    }

    [Fact]
    public void Count_AllocatesNothingPerEntry_WhenScopedToAMenuAndCategory()
    {
        var query = new BuildingCatalogQuery(UiMenu: "Education", UiCategory: "Schools");

        Assert.Equal(0, PerEntryBytes(query));
    }

    [Fact]
    public void Count_AllocatesNothingPerEntry_WhenNoFacetIsSelected()
    {
        Assert.Equal(0, PerEntryBytes(new BuildingCatalogQuery()));
    }

    private static long PerEntryBytes(BuildingCatalogQuery query)
    {
        var few = Entries(100);
        var many = Entries(1100);

        // The first call pays for jitting and the enumerator machinery.
        Assert.Equal(few.Length, BuildingCatalogQueryEngine.Count(few, query));

        var before = GC.GetAllocatedBytesForCurrentThread();
        BuildingCatalogQueryEngine.Count(few, query);
        var small = GC.GetAllocatedBytesForCurrentThread() - before;

        before = GC.GetAllocatedBytesForCurrentThread();
        var counted = BuildingCatalogQueryEngine.Count(many, query);
        var large = GC.GetAllocatedBytesForCurrentThread() - before;

        Assert.Equal(many.Length, counted);

        return (large - small) / (many.Length - few.Length);
    }

    private static BuildingCatalogEntry[] Entries(int count)
    {
        var entries = new BuildingCatalogEntry[count];

        for (var i = 0; i < count; i++)
        {
            entries[i] = TestEntries.Make(id: i + 1, name: "Building " + i) with
            {
                BuildingType = "School",
                Provenance = "Vanilla",
                Theme = "European",
                PlacementFlags = new[] { "RequireRoad", "Water" },
                UiMenu = "Education",
                UiCategory = "Schools",
                ZoneType = ZoneTypeFilter.Low,
                EducationLevel = 1,
            };
        }

        return entries;
    }
}
