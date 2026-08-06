using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;

namespace FindItBuildingMenu.Tests;

public sealed class BuildingCatalogLabelsTests
{
    [Fact]
    public void ForCategory_UsesPlayerFacingServiceBuildingsLabel()
    {
        Assert.Equal(
            "Service Buildings",
            BuildingCatalogLabels.ForCategory(PrefabCategory.ServiceBuildings, "ServiceBuildings"));
    }

    [Fact]
    public void ForSubCategory_UsesPlayerFacingEducationResearchLabel()
    {
        Assert.Equal(
            "Education & Research",
            BuildingCatalogLabels.ForSubCategory(
                PrefabSubCategory.ServiceBuildings_EducationResearch,
                "ServiceBuildings_EducationResearch"));
    }

    [Fact]
    public void ForCategory_FormatsUnknownEnumIdentityAsDeterministicCategoryFallback()
    {
        PrefabCategory category = (PrefabCategory)9001;

        Assert.Equal(
            "Category 9001",
            BuildingCatalogLabels.ForCategory(category));
        Assert.Equal(
            "Category 9001",
            BuildingCatalogLabels.ForCategory(category, category.ToString()));
    }
}
