using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Which sub-category each of the game's service names files its buildings under.
	/// </summary>
	public sealed class ServiceMenusTests
	{
		[Theory]
		[InlineData("Roads", PrefabSubCategory.ServiceBuildings_Roads)]
		[InlineData("Electricity", PrefabSubCategory.ServiceBuildings_Electricity)]
		[InlineData("Water & Sewage", PrefabSubCategory.ServiceBuildings_Water)]
		[InlineData("Communications", PrefabSubCategory.ServiceBuildings_Communications)]
		[InlineData("Health & Deathcare", PrefabSubCategory.ServiceBuildings_Health)]
		[InlineData("Police & Administration", PrefabSubCategory.ServiceBuildings_Police)]
		[InlineData("Fire & Rescue", PrefabSubCategory.ServiceBuildings_Fire)]
		[InlineData("Education & Research", PrefabSubCategory.ServiceBuildings_EducationResearch)]
		[InlineData("Garbage Management", PrefabSubCategory.ServiceBuildings_Garbage)]
		[InlineData("Transportation", PrefabSubCategory.ServiceBuildings_Transportation)]
		[InlineData("Landscaping", PrefabSubCategory.ServiceBuildings_Landscaping)]
		[InlineData("Parks & Recreation", PrefabSubCategory.ServiceBuildings_Parks)]
		public void FilesAServiceUnderItsOwnSubCategory(string serviceName, PrefabSubCategory expected)
		{
			Assert.Equal(expected, ServiceMenus.SubCategoryOf(serviceName));
		}

		[Theory]
		[InlineData("roads")]
		[InlineData(" Roads ")]
		[InlineData("Water")]
		[InlineData("Zones")]
		[InlineData("")]
		[InlineData(null)]
		public void FilesAnyOtherNameUnderMisc(string? serviceName)
		{
			Assert.Equal(PrefabSubCategory.ServiceBuildings_Misc, ServiceMenus.SubCategoryOf(serviceName));
		}
	}
}
