using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class VanillaCategoryMappingTests
	{
		[Fact]
		public void MapsALandscapingCategoryToThePropSubcategoryVanillaFilesItUnder()
		{
			Assert.Equal(PrefabSubCategory.Props_Industrial, VanillaCategoryMapping.PropSubCategoryFor("PropsIndustrial"));
			Assert.Equal(PrefabSubCategory.Props_Commercial, VanillaCategoryMapping.PropSubCategoryFor("PropsCommercial"));
			// Nature props are trees and rocks to us, not props; unmapped on purpose.
			Assert.Null(VanillaCategoryMapping.PropSubCategoryFor("PropsNature"));
			Assert.Null(VanillaCategoryMapping.PropSubCategoryFor("Vegetation"));
			Assert.Null(VanillaCategoryMapping.PropSubCategoryFor("PropsSomethingNew"));
			Assert.Null(VanillaCategoryMapping.PropSubCategoryFor(null));
		}

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
