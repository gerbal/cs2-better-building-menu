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
        Assert.Null(VanillaBuildMenuTaxonomy.Resolve(
            PrefabCategory.Networks,
            PrefabSubCategory.Networks_Roads,
            ZoneTypeFilter.Any));
        Assert.Null(VanillaBuildMenuTaxonomy.Resolve(
            PrefabCategory.Buildings,
            PrefabSubCategory.Buildings_Miscellaneous,
            ZoneTypeFilter.Any));
    }

    [Fact]
    public void Normalize_RejectsInheritedAndCrossSectionSelections()
    {
        Assert.Equal(
            new VanillaBuildMenuSelection(VanillaBuildMenuTaxonomy.AllBuildings, VanillaBuildMenuTaxonomy.Any),
            VanillaBuildMenuSelection.Normalize("Networks", "Networks_Roads"));
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
            new[] { "AllBuildings", "Zones", "SignatureBuildings", "ServiceBuildings", "Favorites" },
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
