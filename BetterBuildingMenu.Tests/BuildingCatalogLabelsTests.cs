using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;

namespace BetterBuildingMenu.Tests;

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

    [Theory]
    [InlineData(1, "Elementary School")]
    [InlineData(2, "High School")]
    [InlineData(3, "College")]
    [InlineData(4, "University")]
    public void SchoolLevel_FallsBackToTheEnglishNameWithoutTheGame(int level, string english)
    {
        Assert.Equal(english, BuildingCatalogLabels.SchoolLevel(level));
        Assert.Equal(english, BuildingCatalogGrouping.SchoolTierLabel(level));
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    [InlineData(5)]
    public void SchoolLevel_NamesNothingOutsideTheGamesFourLevels(int? level)
    {
        Assert.Null(BuildingCatalogLabels.SchoolLevel(level));
    }
}
