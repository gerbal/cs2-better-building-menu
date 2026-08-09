using FindItBuildingMenu.Domain;
using Game.Prefabs;
using Game.Zones;
using FindItBuildingMenu.Domain.Enums;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	public sealed class ZoningSurfaceTests
	{
		[Theory]
		[InlineData(AreaType.Residential, (ZoneFlags)0, ZoningFamilies.Residential)]
		[InlineData(AreaType.Commercial, (ZoneFlags)0, ZoningFamilies.Commercial)]
		[InlineData(AreaType.Industrial, (ZoneFlags)0, ZoningFamilies.Industrial)]
		public void ClassifiesFamilyFromZoneDataRatherThanTheName(
			AreaType areaType,
			ZoneFlags flags,
			string expected)
		{
			// ZoneData carries the authority: m_AreaType plus m_ZoneFlags. The
			// name-based classifier is only a fallback for prefabs that have no
			// ZoneData at all.
			Assert.Equal(expected, ZoningSurfaceCatalog.ResolveFamily(areaType, flags));
		}

		[Fact]
		public void SplitsOfficeOutOfIndustrialByItsZoneFlag()
		{
			// Office zones are INDUSTRIAL-area zones carrying ZoneFlags.Office —
			// logged from a running city as "area=Industrial flags=Office".
			// Assuming they were commercial-area put every one of them under
			// Commercial and lost the Office family entirely.
			Assert.Equal(
				ZoningFamilies.Office,
				ZoningSurfaceCatalog.ResolveFamily(AreaType.Industrial, ZoneFlags.Office));
			Assert.Equal(
				ZoningFamilies.Industrial,
				ZoningSurfaceCatalog.ResolveFamily(AreaType.Industrial, ZoneFlags.SupportNarrow));
		}

		[Fact]
		public void IgnoresTheOfficeFlagOutsideIndustrialAreas()
		{
			Assert.Equal(
				ZoningFamilies.Residential,
				ZoningSurfaceCatalog.ResolveFamily(AreaType.Residential, ZoneFlags.Office));
			Assert.Equal(
				ZoningFamilies.Commercial,
				ZoningSurfaceCatalog.ResolveFamily(AreaType.Commercial, ZoneFlags.Office));
		}

		[Fact]
		public void PrefersTheGameSOwnCategoryGroupOverInference()
		{
			// The vanilla Zones menu's tabs are UIAssetCategoryPrefabs, and a
			// zone's UIObject.m_Group names the tab it appears under. That is
			// the game's own answer, and it is the only source that separates
			// Office from Commercial: ZoneData.m_AreaType has no Office value,
			// and the ZoneFlags.Office bit did not distinguish them in a real
			// city.
			// The UI group names are plural — "ZonesOffice", not "ZoneOffice" —
			// which is why matching them against the family ids directly never
			// fired. Logged from a running city.
			Assert.Equal(ZoningFamilies.Office, ZoningSurfaceCatalog.ResolveFamilyFromGroup("ZonesOffice"));
			Assert.Equal(ZoningFamilies.Residential, ZoningSurfaceCatalog.ResolveFamilyFromGroup("ZonesResidential"));
			Assert.Equal(ZoningFamilies.Commercial, ZoningSurfaceCatalog.ResolveFamilyFromGroup("ZonesCommercial"));
			Assert.Equal(ZoningFamilies.Industrial, ZoningSurfaceCatalog.ResolveFamilyFromGroup("ZonesIndustrial"));
		}

		[Fact]
		public void DeclinesAGroupThatIsNotAZoningTab()
		{
			// Every prefab has a UI group; only the zoning ones name a family.
			Assert.Null(ZoningSurfaceCatalog.ResolveFamilyFromGroup("ServiceBuildings"));
			// Singular is not what the game emits; accepting it would hide a
			// future rename rather than surface it.
			Assert.Null(ZoningSurfaceCatalog.ResolveFamilyFromGroup("ZoneOffice"));
			Assert.Null(ZoningSurfaceCatalog.ResolveFamilyFromGroup(""));
			Assert.Null(ZoningSurfaceCatalog.ResolveFamilyFromGroup(null));
		}

		[Fact]
		public void DeclinesToClassifyAnUnzonedArea()
		{
			Assert.Null(ZoningSurfaceCatalog.ResolveFamily(AreaType.None, (ZoneFlags)0));
		}

		[Fact]
		public void OffersTheFiveFamiliesTheVanillaZonesMenuIsBuiltFrom()
		{
			// Read off the running toolbar rather than assumed: the Zones menu's
			// category tabs are ZoneResidential, ZoneCommercial, ZoneIndustrial,
			// ZoneOffice and ZoneExtractors.
			Assert.Equal(
				new[]
				{
					ZoningFamilies.Residential,
					ZoningFamilies.Commercial,
					ZoningFamilies.Industrial,
					ZoningFamilies.Office,
					ZoningFamilies.Extractors,
				},
				ZoningSurfaceCatalog.Families);
		}

		[Fact]
		public void CannotNameExtractorsFromANameBecauseNoExtractorIsAZone()
		{
			// An extractor area is a LotPrefab carrying ExtractorAreaData with a
			// MapFeature; it has no ZoneData, and the zone index queries
			// ZoneData. The stem that used to match this could only ever have
			// produced a family with nothing behind it.
			Assert.Null(ZoningSurfaceCatalog.ResolveFamily("ZoneExtractorFarming"));
		}

		[Theory]
		[InlineData("ZoneResidentialLow", ZoningFamilies.Residential)]
		[InlineData("ZoneResidentialHigh", ZoningFamilies.Residential)]
		[InlineData("ZoneCommercialLow", ZoningFamilies.Commercial)]
		[InlineData("ZoneIndustrialManufacturing", ZoningFamilies.Industrial)]
		[InlineData("ZoneOfficeHigh", ZoningFamilies.Office)]
		public void FilesAZoneUnderItsFamily(string prefabName, string expected)
		{
			Assert.Equal(expected, ZoningSurfaceCatalog.ResolveFamily(prefabName));
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
			Assert.Equal(expected, ZoningSurfaceCatalog.ResolveFamily(prefabName));
		}

		[Theory]
		[InlineData("ZoneResidentialLow", ZoneTypeFilter.Low)]
		[InlineData("ZoneResidentialLowRent", ZoneTypeFilter.Low)]
		[InlineData("ZoneResidentialMediumRow", ZoneTypeFilter.Row)]
		[InlineData("ZoneResidentialMedium", ZoneTypeFilter.Medium)]
		[InlineData("ZoneResidentialHigh", ZoneTypeFilter.High)]
		public void ReadsDensityFromTheZoneName(string prefabName, ZoneTypeFilter expected)
		{
			// Row is checked before Medium: "MediumRow" is a row zone, and a
			// naive contains-check on "Medium" would swallow it.
			Assert.Equal(expected, ZoningSurfaceCatalog.ResolveDensity(prefabName));
		}

		[Fact]
		public void LeavesDensityUnsetWhenTheNameDoesNotCarryOne()
		{
			// Industrial and extractor zones have no density tier, and guessing
			// one would filter their buildings away.
			Assert.Equal(ZoneTypeFilter.Any, ZoningSurfaceCatalog.ResolveDensity("ZoneIndustrialManufacturing"));
			Assert.Equal(ZoneTypeFilter.Any, ZoningSurfaceCatalog.ResolveDensity("ZoneExtractorFarming"));
		}

		[Fact]
		public void ReturnsNoFamilyForSomethingThatIsNotAZone()
		{
			// The classifier runs over prefab names from the index, so it has to
			// decline cleanly rather than file a school under Residential.
			Assert.Null(ZoningSurfaceCatalog.ResolveFamily("ElementarySchool01"));
			Assert.Null(ZoningSurfaceCatalog.ResolveFamily(""));
			Assert.Null(ZoningSurfaceCatalog.ResolveFamily(null));
		}

		[Fact]
		public void DescribesEachFamilyForTheUiWithoutEntityIds()
		{
			// A flat, serializable contract:
			// and free of runtime entity ids.
			var residential = ZoningSurfaceCatalog.Describe(ZoningFamilies.Residential);

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
			Assert.Contains("Buildings_Residential", ZoningSurfaceCatalog.SpawnedSubCategories(ZoningFamilies.Residential));
			Assert.Contains("Buildings_Commercial", ZoningSurfaceCatalog.SpawnedSubCategories(ZoningFamilies.Commercial));
			Assert.Contains("Buildings_Office", ZoningSurfaceCatalog.SpawnedSubCategories(ZoningFamilies.Office));
		}

		[Fact]
		public void TreatsMixedZonesAsSpawningBothHousingAndCommerce()
		{
			// Mixed zones grow mixed-use buildings, which the catalog files
			// under their own subcategory rather than under Residential.
			Assert.Contains("Buildings_Mixed", ZoningSurfaceCatalog.SpawnedSubCategories(ZoningFamilies.Residential));
		}
	}
}
