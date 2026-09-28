using BetterBuildingMenu.Domain;
using Game.Prefabs;
using Game.Zones;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class ZoningCatalogTests
	{
		[Theory]
		[InlineData(AreaType.Residential, ZoningFamilies.Residential)]
		[InlineData(AreaType.Commercial, ZoningFamilies.Commercial)]
		[InlineData(AreaType.Industrial, ZoningFamilies.Industrial)]
		public void ClassifiesFamilyFromZoneDataRatherThanTheName(AreaType areaType, string expected)
		{
			// ZoneData carries the authority: m_AreaType plus m_ZoneFlags. The
			// name-based classifier is only a fallback for prefabs that have no
			// ZoneData at all.
			Assert.Equal(expected, ZoningCatalog.ResolveFamily(areaType, (ZoneFlags)0));
		}

		[Fact]
		public void SplitsOfficeOutOfIndustrialByItsZoneFlag()
		{
			// Office zones are INDUSTRIAL-area zones carrying ZoneFlags.Office, not
			// commercial-area zones.
			Assert.Equal(
				ZoningFamilies.Office,
				ZoningCatalog.ResolveFamily(AreaType.Industrial, ZoneFlags.Office));
			Assert.Equal(
				ZoningFamilies.Industrial,
				ZoningCatalog.ResolveFamily(AreaType.Industrial, ZoneFlags.SupportNarrow));
		}

		[Fact]
		public void IgnoresTheOfficeFlagOutsideIndustrialAreas()
		{
			Assert.Equal(
				ZoningFamilies.Residential,
				ZoningCatalog.ResolveFamily(AreaType.Residential, ZoneFlags.Office));
			Assert.Equal(
				ZoningFamilies.Commercial,
				ZoningCatalog.ResolveFamily(AreaType.Commercial, ZoneFlags.Office));
		}

		[Fact]
		public void PrefersTheGameSOwnCategoryGroupOverInference()
		{
			// A zone's UIObject.m_Group names the vanilla Zones tab it appears under:
			// the game's own answer, and the only source separating Office from
			// Commercial. The group names are plural — "ZonesOffice", not "ZoneOffice".
			Assert.Equal(ZoningFamilies.Office, ZoningCatalog.ResolveFamilyFromGroup("ZonesOffice"));
			Assert.Equal(ZoningFamilies.Residential, ZoningCatalog.ResolveFamilyFromGroup("ZonesResidential"));
			Assert.Equal(ZoningFamilies.Commercial, ZoningCatalog.ResolveFamilyFromGroup("ZonesCommercial"));
			Assert.Equal(ZoningFamilies.Industrial, ZoningCatalog.ResolveFamilyFromGroup("ZonesIndustrial"));
		}

		[Fact]
		public void DeclinesAGroupThatIsNotAZoningTab()
		{
			// Every prefab has a UI group; only the zoning ones name a family.
			Assert.Null(ZoningCatalog.ResolveFamilyFromGroup("ServiceBuildings"));
			// Singular is not what the game emits; accepting it would hide a
			// future rename rather than surface it.
			Assert.Null(ZoningCatalog.ResolveFamilyFromGroup("ZoneOffice"));
			Assert.Null(ZoningCatalog.ResolveFamilyFromGroup(""));
			Assert.Null(ZoningCatalog.ResolveFamilyFromGroup(null));
		}

		[Fact]
		public void DeclinesToClassifyAnUnzonedArea()
		{
			Assert.Null(ZoningCatalog.ResolveFamily(AreaType.None, (ZoneFlags)0));
		}

		[Fact]
		public void OffersTheFiveFamiliesTheVanillaZonesMenuIsBuiltFrom()
		{
			// The Zones menu's category tabs: ZoneResidential, ZoneCommercial,
			// ZoneIndustrial, ZoneOffice and ZoneExtractors.
			Assert.Equal(
				new[]
				{
					ZoningFamilies.Residential,
					ZoningFamilies.Commercial,
					ZoningFamilies.Industrial,
					ZoningFamilies.Office,
					ZoningFamilies.Extractors,
				},
				ZoningCatalog.Families);
		}

		[Fact]
		public void CannotNameExtractorsFromANameBecauseNoExtractorIsAZone()
		{
			// An extractor area is a LotPrefab carrying ExtractorAreaData with a
			// MapFeature; it has no ZoneData, and the zone index queries ZoneData, so
			// a name that matched would name a family with nothing behind it.
			Assert.Null(ZoningCatalog.ResolveFamily("ZoneExtractorFarming"));
		}

		[Theory]
		[InlineData("ZoneResidentialLow", ZoningFamilies.Residential)]
		[InlineData("ZoneResidentialHigh", ZoningFamilies.Residential)]
		[InlineData("ZoneCommercialLow", ZoningFamilies.Commercial)]
		[InlineData("ZoneIndustrialManufacturing", ZoningFamilies.Industrial)]
		[InlineData("ZoneOfficeHigh", ZoningFamilies.Office)]
		public void FilesAZoneUnderItsFamily(string prefabName, string expected)
		{
			Assert.Equal(expected, ZoningCatalog.ResolveFamily(prefabName));
		}

		[Theory]
		[InlineData("ZoneEUResidentialLowWaterfront", ZoningFamilies.Residential)]
		[InlineData("ZoneCP5ResidentialMedium", ZoningFamilies.Residential)]
		[InlineData("ZoneEUMixedOldTown", ZoningFamilies.Residential)]
		public void SeesThroughThemeAndPackPrefixesToTheFamily(string prefabName, string expected)
		{
			// Theme and creator-pack zones carry an infix (EU, CP5) or no
			// recognisable stem at all. They are still residential zones and
			// must not fall out of the hierarchy.
			Assert.Equal(expected, ZoningCatalog.ResolveFamily(prefabName));
		}

		[Fact]
		public void ReturnsNoFamilyForSomethingThatIsNotAZone()
		{
			// The classifier runs over prefab names from the index, so it has to
			// decline cleanly rather than file a school under Residential.
			Assert.Null(ZoningCatalog.ResolveFamily("ElementarySchool01"));
			Assert.Null(ZoningCatalog.ResolveFamily(""));
			Assert.Null(ZoningCatalog.ResolveFamily(null));
		}

		[Fact]
		public void DescribesEachFamilyForTheUiWithoutEntityIds()
		{
			// A flat, serializable contract, free of runtime entity ids.
			var residential = ZoningCatalog.Describe(ZoningFamilies.Residential);

			Assert.NotNull(residential);
			Assert.Equal(ZoningFamilies.Residential, residential!.Id);
			Assert.False(string.IsNullOrWhiteSpace(residential.Icon));
			Assert.False(string.IsNullOrWhiteSpace(residential.ToolTip));
		}

		[Fact]
		public void MapsAFamilyOntoTheBuildingSubCategoriesItSpawns()
		{
			// The leaf of the hierarchy is the catalog: having picked a zone,
			// you should see the buildings that grow in it.
			Assert.Contains("Buildings_Residential", ZoningCatalog.SpawnedSubCategories(ZoningFamilies.Residential));
			Assert.Contains("Buildings_Commercial", ZoningCatalog.SpawnedSubCategories(ZoningFamilies.Commercial));
			Assert.Contains("Buildings_Office", ZoningCatalog.SpawnedSubCategories(ZoningFamilies.Office));
		}

		[Fact]
		public void TreatsMixedZonesAsSpawningBothHousingAndCommerce()
		{
			// Mixed zones grow mixed-use buildings, which the catalog files
			// under their own subcategory rather than under Residential.
			Assert.Contains("Buildings_Mixed", ZoningCatalog.SpawnedSubCategories(ZoningFamilies.Residential));
		}
	}
}
