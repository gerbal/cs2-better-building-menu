using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The game's key for each service menu, spelled out so a table that derives them cannot drift.
	/// </summary>
	public sealed class ServiceLocaleKeysTests
	{
		[Theory]
		[InlineData(PrefabSubCategory.ServiceBuildings_Roads, "Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Roads]")]
		[InlineData(PrefabSubCategory.ServiceBuildings_Electricity, "Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Electricity]")]
		[InlineData(PrefabSubCategory.ServiceBuildings_Water, "Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Water & Sewage]")]
		[InlineData(PrefabSubCategory.ServiceBuildings_Communications, "Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Communications]")]
		[InlineData(PrefabSubCategory.ServiceBuildings_Health, "Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Health & Deathcare]")]
		[InlineData(PrefabSubCategory.ServiceBuildings_Police, "Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Police & Administration]")]
		[InlineData(PrefabSubCategory.ServiceBuildings_Fire, "Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Fire & Rescue]")]
		[InlineData(PrefabSubCategory.ServiceBuildings_EducationResearch, "Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Education & Research]")]
		[InlineData(PrefabSubCategory.ServiceBuildings_Garbage, "Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Garbage Management]")]
		[InlineData(PrefabSubCategory.ServiceBuildings_Transportation, "Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Transportation]")]
		[InlineData(PrefabSubCategory.ServiceBuildings_Parks, "Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Parks & Recreation]")]
		[InlineData(PrefabSubCategory.ServiceBuildings_Landscaping, "Services.NAME[Landscaping]")]
		public void NamesTheGamesKeyForEachServiceMenu(PrefabSubCategory subCategory, string key)
		{
			Assert.Equal(key, GameLocaleKeys.For(subCategory.ToString()));
		}

		[Fact]
		public void LeavesTheMiscServiceMenuToOurOwnWording()
		{
			Assert.Null(GameLocaleKeys.For(nameof(PrefabSubCategory.ServiceBuildings_Misc)));
		}

		[Fact]
		public void KeepsEveryKeyTheTableHolds()
		{
			Assert.Equal(44, GameLocaleKeys.All.Count);
		}
	}
}
