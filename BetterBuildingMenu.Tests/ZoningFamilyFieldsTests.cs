using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Every field of every zoning family, read through each way the catalog answers.
	/// </summary>
	public sealed class ZoningFamilyFieldsTests
	{
		[Theory]
		[InlineData(ZoningFamilies.Residential, "ZonesResidential", "Media/Game/Icons/ZoneResidential.svg", "Zoning_Residential", PrefabSubCategory.Zones_Residential, "Buildings_Residential,Buildings_Mixed")]
		[InlineData(ZoningFamilies.Commercial, "ZonesCommercial", "Media/Game/Icons/ZoneCommercial.svg", "Zoning_Commercial", PrefabSubCategory.Zones_Commercial, "Buildings_Commercial,Buildings_Mixed")]
		[InlineData(ZoningFamilies.Industrial, "ZonesIndustrial", "Media/Game/Icons/ZoneIndustrial.svg", "Zoning_Industrial", PrefabSubCategory.Zones_Industrial, "Buildings_Industrial")]
		[InlineData(ZoningFamilies.Office, "ZonesOffice", "Media/Game/Icons/ZoneOffice.svg", "Zoning_Office", PrefabSubCategory.Zones_Office, "Buildings_Office")]
		[InlineData(ZoningFamilies.Extractors, "ZonesExtractors", "Media/Game/Icons/ZoneExtractors.svg", "Zoning_Extractors", PrefabSubCategory.Zones_Extractors, "Buildings_Industrial,Buildings_Specialized")]
		public void AnswersEveryFieldOfAFamily(
			string family,
			string group,
			string icon,
			string tooltip,
			PrefabSubCategory subCategory,
			string spawnedBy)
		{
			var described = ZoningCatalog.Describe(family);

			Assert.NotNull(described);
			Assert.Equal(family, described!.Id);
			Assert.Equal(icon, described.Icon);
			Assert.Equal(tooltip, described.ToolTip);
			Assert.Equal(group, ZoningCatalog.ResolveGroupFromFamily(family));
			Assert.Equal(family, ZoningCatalog.ResolveFamilyFromGroup(group));
			Assert.Equal(subCategory, ZoningCatalog.SubCategoryOf(family));
			Assert.Equal(spawnedBy, string.Join(",", ZoningCatalog.SpawnedSubCategories(family).Select(name => name.ToString())));
		}

		[Fact]
		public void ListsFamiliesInTheOrderTheMenuShowsThem()
		{
			Assert.Equal(
				new[] { "ZoneResidential", "ZoneCommercial", "ZoneIndustrial", "ZoneOffice", "ZoneExtractors" },
				ZoningCatalog.Families);
		}

		[Fact]
		public void DescribesAFamilyWhateverItsCase()
		{
			Assert.Equal(ZoningFamilies.Office, ZoningCatalog.Describe("zoneoffice")!.Id);
			Assert.Equal(ZoningFamilies.Office, ZoningCatalog.Describe("ZONEOFFICE")!.Id);
		}

		[Fact]
		public void DoesNotTrimAFamilyItIsAskedToDescribe()
		{
			Assert.Null(ZoningCatalog.Describe(" ZoneOffice "));
			Assert.Null(ZoningCatalog.Describe(""));
			Assert.Null(ZoningCatalog.Describe(null));
			Assert.Null(ZoningCatalog.Describe("NotAFamily"));
		}

		[Fact]
		public void FilesASubCategoryByTheExactFamilyId()
		{
			// The one lookup that is case-sensitive.
			Assert.Equal(PrefabSubCategory.Zones_Misc, ZoningCatalog.SubCategoryOf("zoneoffice"));
			Assert.Equal(PrefabSubCategory.Zones_Misc, ZoningCatalog.SubCategoryOf(" ZoneOffice "));
		}

		[Fact]
		public void NamesWhatASpawningFamilyGrowsWhateverItsCaseButNotPadded()
		{
			Assert.Equal(
				new[] { "Buildings_Residential", "Buildings_Mixed" },
				ZoningCatalog.SpawnedSubCategories("zoneresidential").Select(name => name.ToString()));
			Assert.Empty(ZoningCatalog.SpawnedSubCategories(" ZoneResidential "));
			Assert.Empty(ZoningCatalog.SpawnedSubCategories("NotAFamily"));
			Assert.Empty(ZoningCatalog.SpawnedSubCategories(null));
		}

		[Fact]
		public void TranslatesBetweenGroupAndFamilyTrimmedAndCaseBlind()
		{
			Assert.Equal(ZoningFamilies.Office, ZoningCatalog.ResolveFamilyFromGroup("  zonesoffice  "));
			Assert.Equal("ZonesOffice", ZoningCatalog.ResolveGroupFromFamily("  zoneoffice  "));
			Assert.Null(ZoningCatalog.ResolveFamilyFromGroup("   "));
			Assert.Null(ZoningCatalog.ResolveGroupFromFamily("   "));
			Assert.Null(ZoningCatalog.ResolveGroupFromFamily(null));
			Assert.Null(ZoningCatalog.ResolveGroupFromFamily("NotAFamily"));
			Assert.Null(ZoningCatalog.ResolveGroupFromFamily("ZonesOffice"));
		}

		[Theory]
		[InlineData("ZoneResidentialLow", ZoningFamilies.Residential)]
		[InlineData("zonemixedoldtown", ZoningFamilies.Residential)]
		[InlineData("ZoneCommercialHigh", ZoningFamilies.Commercial)]
		[InlineData("ZoneIndustrialStorage", ZoningFamilies.Industrial)]
		[InlineData("ZoneOfficeLow", ZoningFamilies.Office)]
		public void ReadsAFamilyFromEveryStem(string prefabName, string expected)
		{
			Assert.Equal(expected, ZoningCatalog.ResolveFamily(prefabName));
		}

		[Fact]
		public void TakesTheFirstStemWhenANameCarriesTwo()
		{
			// Stems are tried in order, so a name carrying two takes the first.
			Assert.Equal(ZoningFamilies.Residential, ZoningCatalog.ResolveFamily("ZoneResidentialOffice"));
			Assert.Equal(ZoningFamilies.Commercial, ZoningCatalog.ResolveFamily("ZoneCommercialMixed"));
		}

		[Theory]
		[InlineData(PrefabSubCategory.Buildings_Residential, "Media/Game/Icons/ZoneResidential.svg")]
		[InlineData(PrefabSubCategory.Buildings_Commercial, "Media/Game/Icons/ZoneCommercial.svg")]
		[InlineData(PrefabSubCategory.Buildings_Industrial, "Media/Game/Icons/ZoneIndustrial.svg")]
		[InlineData(PrefabSubCategory.Buildings_Office, "Media/Game/Icons/ZoneOffice.svg")]
		[InlineData(PrefabSubCategory.Buildings_Specialized, "Media/Game/Icons/ZoneExtractors.svg")]
		[InlineData(PrefabSubCategory.Buildings_Mixed, "coui://betterbuildingmenu/ZoneResidentialMixed.svg")]
		[InlineData(PrefabSubCategory.Zones_Residential, "Media/Game/Icons/ZoneResidential.svg")]
		[InlineData(PrefabSubCategory.Zones_Commercial, "Media/Game/Icons/ZoneCommercial.svg")]
		[InlineData(PrefabSubCategory.Zones_Industrial, "Media/Game/Icons/ZoneIndustrial.svg")]
		[InlineData(PrefabSubCategory.Zones_Office, "Media/Game/Icons/ZoneOffice.svg")]
		[InlineData(PrefabSubCategory.Zones_Extractors, "Media/Game/Icons/ZoneExtractors.svg")]
		[InlineData(PrefabSubCategory.Zones_Misc, "coui://uil/Standard/StarAll.svg")]
		public void KeepsTheCategoryIconOfEveryZoneAndZonedBuildingGroup(PrefabSubCategory subCategory, string icon)
		{
			Assert.Equal(icon, CategoryIconAttribute.GetAttribute(subCategory).Icon);
		}
	}
}
