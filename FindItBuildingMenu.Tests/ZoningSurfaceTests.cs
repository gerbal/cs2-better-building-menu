using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	public sealed class ZoningSurfaceTests
	{
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

		[Theory]
		[InlineData("ZoneResidentialLow", ZoningFamilies.Residential)]
		[InlineData("ZoneResidentialHigh", ZoningFamilies.Residential)]
		[InlineData("ZoneCommercialLow", ZoningFamilies.Commercial)]
		[InlineData("ZoneIndustrialManufacturing", ZoningFamilies.Industrial)]
		[InlineData("ZoneOfficeHigh", ZoningFamilies.Office)]
		[InlineData("ZoneExtractorFarming", ZoningFamilies.Extractors)]
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
			// Same contract shape as ToolSurfaceCatalog: flat, serializable,
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
