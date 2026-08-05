using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;

namespace FindItBuildingMenu.Tests;

public sealed class VanillaBuildMenuTaxonomyTests
{
    [Theory]
    [InlineData(PrefabCategory.Buildings, PrefabSubCategory.Buildings_Residential, ZoneTypeFilter.Low, "Zones", "Buildings_Residential")]
    [InlineData(PrefabCategory.Buildings, PrefabSubCategory.Buildings_Mixed, ZoneTypeFilter.Row, "Zones", "Buildings_Mixed")]
    [InlineData(PrefabCategory.Buildings, PrefabSubCategory.Buildings_Specialized, ZoneTypeFilter.Any, "Zones", "Buildings_Specialized")]
    [InlineData(PrefabCategory.Buildings, PrefabSubCategory.Buildings_Residential, ZoneTypeFilter.Signature, "SignatureBuildings", "Buildings_Residential")]
    [InlineData(PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Health, ZoneTypeFilter.Any, "ServiceBuildings", "ServiceBuildings_Health")]
    public void Resolve_MapsIndexedBuildingRecordsToVanillaSections(
        PrefabCategory category,
        PrefabSubCategory subCategory,
        ZoneTypeFilter zoneType,
        string section,
        string normalizedSubCategory)
    {
        VanillaBuildMenuTag? result = VanillaBuildMenuTaxonomy.Resolve(category, subCategory, zoneType);

        Assert.NotNull(result);
        Assert.Equal(section, result.Section);
        Assert.Equal(normalizedSubCategory, result.SubCategory);
    }

    [Fact]
    public void Resolve_LeavesUnsupportedRecordsOutOfBuildingSections()
    {
        // Networks_Roads used to be here. Networks is a section of its own now,
        // so the unsupported cases are the categories the lens still does not
        // catalogue, and a category/subcategory pairing that cannot occur.
        Assert.Null(VanillaBuildMenuTaxonomy.Resolve(
            PrefabCategory.Trees,
            PrefabSubCategory.Trees_Trees,
            ZoneTypeFilter.Any));
        Assert.Null(VanillaBuildMenuTaxonomy.Resolve(
            PrefabCategory.Networks,
            PrefabSubCategory.ServiceBuildings_Health,
            ZoneTypeFilter.Any));
        Assert.Null(VanillaBuildMenuTaxonomy.Resolve(
            PrefabCategory.Buildings,
            PrefabSubCategory.Buildings_Miscellaneous,
            ZoneTypeFilter.Any));
    }

    [Fact]
    public void Normalize_RejectsInheritedAndCrossSectionSelections()
    {
        // "Networks" is a real section now, so an unknown one stands in for the
        // case this was protecting; the Networks pairing below keeps the
        // cross-section rejection honest for it too.
        Assert.Equal(
            new VanillaBuildMenuSelection(VanillaBuildMenuTaxonomy.AllBuildings, VanillaBuildMenuTaxonomy.Any),
            VanillaBuildMenuSelection.Normalize("Vehicles", "Vehicles_Cars"));
        Assert.Equal(
            new VanillaBuildMenuSelection(VanillaBuildMenuTaxonomy.Networks, VanillaBuildMenuTaxonomy.Any),
            VanillaBuildMenuSelection.Normalize(VanillaBuildMenuTaxonomy.Networks, "ServiceBuildings_Health"));
        Assert.Equal(
            new VanillaBuildMenuSelection(VanillaBuildMenuTaxonomy.Zones, VanillaBuildMenuTaxonomy.Any),
            VanillaBuildMenuSelection.Normalize(VanillaBuildMenuTaxonomy.Zones, "ServiceBuildings_Health"));
        Assert.Equal(
            new VanillaBuildMenuSelection(VanillaBuildMenuTaxonomy.Favorites, VanillaBuildMenuTaxonomy.Any),
            VanillaBuildMenuSelection.Normalize(VanillaBuildMenuTaxonomy.Favorites, "Buildings_Office"));
    }

    [Fact]
    public void Descriptors_PreserveVanillaSectionAndSubcategoryOrder()
    {
        Assert.Equal(
            new[] { "AllBuildings", "Zones", "SignatureBuildings", "ServiceBuildings", "Networks", "Favorites" },
            VanillaBuildMenuTaxonomy.GetSectionDescriptors().Select(descriptor => descriptor.Id).ToArray());
        Assert.Equal(
            new[]
            {
                "Buildings_Residential",
                "Buildings_Mixed",
                "Buildings_Commercial",
                "Buildings_Industrial",
                "Buildings_Office",
                "Buildings_Specialized",
            },
            VanillaBuildMenuTaxonomy.GetSubcategoryDescriptors(VanillaBuildMenuTaxonomy.Zones)
                .Select(descriptor => descriptor.Id)
                .ToArray());
        Assert.Equal(
            new[]
            {
                "ServiceBuildings_Roads",
                "ServiceBuildings_Electricity",
                "ServiceBuildings_Water",
                "ServiceBuildings_Health",
                "ServiceBuildings_Police",
                "ServiceBuildings_Fire",
                "ServiceBuildings_EducationResearch",
                "ServiceBuildings_Communications",
                "ServiceBuildings_Garbage",
                "ServiceBuildings_Transportation",
                "ServiceBuildings_Landscaping",
                "ServiceBuildings_Parks",
                "ServiceBuildings_Misc",
            },
            VanillaBuildMenuTaxonomy.GetSubcategoryDescriptors(VanillaBuildMenuTaxonomy.ServiceBuildings)
                .Select(descriptor => descriptor.Id)
                .ToArray());
    }
}
