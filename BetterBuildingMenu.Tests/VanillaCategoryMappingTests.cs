using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class VanillaCategoryMappingTests
	{
		[Fact]
		public void MapsASignaturesCategoryToTheBuildingSubcategoryAndKnowsItIsASignature()
		{
			Assert.Equal(PrefabSubCategory.Buildings_Commercial, VanillaCategoryMapping.BuildingSubCategoryFor("SignaturesCommercial"));
			Assert.Equal(PrefabSubCategory.Buildings_Residential, VanillaCategoryMapping.BuildingSubCategoryFor("SignaturesResidential"));
			Assert.Equal(PrefabSubCategory.Buildings_Office, VanillaCategoryMapping.BuildingSubCategoryFor("SignaturesOffice"));
			Assert.Equal(PrefabSubCategory.Buildings_Miscellaneous, VanillaCategoryMapping.BuildingSubCategoryFor("SignaturesLandmarks"));
			Assert.Null(VanillaCategoryMapping.BuildingSubCategoryFor(""));
			Assert.True(VanillaCategoryMapping.IsSignatureCategory("SignaturesCommercial"));
			Assert.False(VanillaCategoryMapping.IsSignatureCategory("RoadsParking"));
		}
	}
}
