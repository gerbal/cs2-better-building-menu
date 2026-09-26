using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The headings the page carries: cost and footprint bands, density and
	/// transit tiers, menuCategory sub-grouping, and the Other group.
	/// </summary>
	public sealed class BuildingCatalogGroupingLabelsTests
	{
		private static BuildingCatalogEntry Entry() =>
			new BuildingCatalogEntry(
				Id: 1, PrefabName: "Thing", Name: "Thing", Category: "ServiceBuildings", SubCategory: "ServiceBuildings_Health",
				Thumbnail: "", LotWidth: 4, LotDepth: 4, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
				with
			{
				CategoryLabel = "Service Buildings",
				SubCategoryLabel = "Health & Deathcare",
				BuildingType = "Hospital",
				Theme = "European",
				Provenance = "Base game",
				ConstructionCost = 10_000,
			};

		private static string[] Path(BuildingCatalogEntry entry, string dimension, string[]? names = null) =>
			BuildingCatalogGrouping.Labels(entry, dimension, names).Path;

		[Fact]
		public void YieldsTwoLevelsForCategoryAndOneForEverythingElse()
		{
			Assert.Equal(new[] { "Service Buildings", "Health & Deathcare" }, Path(Entry(), "category"));

			foreach (var dimension in BuildingCatalogGrouping.Dimensions.Where(d => d != "category" && d != "menuCategory" && d != "none"))
			{
				Assert.Single(Path(Entry(), dimension));
			}

			Assert.Empty(Path(Entry(), "none"));
		}

		[Fact]
		public void WithoutTheGamesNamesEachSchoolTierIsInEnglish()
		{
			Assert.Equal(new[] { "Elementary School" }, Path(Entry() with { EducationLevel = 1 }, "schoolTier"));
			Assert.Equal(new[] { "High School" }, Path(Entry() with { EducationLevel = 2 }, "schoolTier"));
			Assert.Equal(new[] { "College" }, Path(Entry() with { EducationLevel = 3 }, "schoolTier"));
			Assert.Equal(new[] { "University" }, Path(Entry() with { EducationLevel = 4 }, "schoolTier"));
		}

		[Fact]
		public void ASchoolTierIsWhatTheGameCallsItsBaseGameSchool()
		{
			var names = new System.Collections.Generic.Dictionary<int, string> { [1] = "Grundschule" };

			Assert.Equal(new[] { "Grundschule" }, BuildingCatalogGrouping.Labels(Entry() with { EducationLevel = 1 }, "schoolTier", schoolTierNames: names).Path);
			Assert.Equal(new[] { "High School" }, BuildingCatalogGrouping.Labels(Entry() with { EducationLevel = 2 }, "schoolTier", schoolTierNames: names).Path);
		}

		[Fact]
		public void FilesANonSchoolUnderItsOwnCategoryNotUnderOther()
		{
			Assert.Equal(new[] { "Research" }, Path(Entry() with { EducationLevel = null, UiCategory = "Research" }, "schoolTier"));
		}

		[Fact]
		public void CarriesTheGamesCategoryIdOnTheCategoryLevelOnly()
		{
			// The renderer resolves LabelId back to the game's own category name.
			var labels = BuildingCatalogGrouping.Labels(Entry() with { UiMenu = "Zones", UiCategory = "ZonesResidential", ZoneType = ZoneTypeFilter.Low }, "menuCategory");

			Assert.Equal("ZonesResidential", labels.LabelId);
			Assert.Equal(new[] { "Residential", "Low Density" }, labels.Path);
			Assert.Null(BuildingCatalogGrouping.Labels(Entry() with { BuildingType = "Hospital" }, "role").LabelId);
		}

		[Fact]
		public void PrefersTheDlcNameOverTheBroadProvenanceForSource()
		{
			Assert.Equal(new[] { "Bridges & Ports" }, Path(Entry() with { DlcId = "Bridges & Ports" }, "source"));
			Assert.Equal(new[] { "Base game" }, Path(Entry() with { DlcId = null }, "source"));
		}

		[Fact]
		public void FallsBackToTheIdWhenADisplayLabelIsMissingWordSplit()
		{
			Assert.Equal(
				new[] { "Service Buildings", "Service Buildings Health" },
				Path(Entry() with { CategoryLabel = null, SubCategoryLabel = null }, "category"));
			Assert.Equal(new[] { "Deathcare Facility" }, Path(Entry() with { BuildingType = "DeathcareFacility" }, "role"));
		}

		[Fact]
		public void PutsAnEntryWithNoValueUnderOneExplicitHeadingNeverABlankOne()
		{
			Assert.Equal(new[] { "Other" }, Path(Entry() with { Theme = null }, "theme"));
			Assert.Equal(new[] { "Other" }, Path(Entry() with { Theme = "   " }, "theme"));
			Assert.Equal(new[] { "Other" }, Path(Entry() with { BuildingType = null }, "role"));
			Assert.Equal(new[] { "Other" }, Path(Entry() with { DevTreeBranch = "" }, "development"));
		}

		[Fact]
		public void WordSplitsAnIdSoTheHeadingDoesNotReadAsOneShout()
		{
			Assert.Equal("Deathcare Facility", BuildingCatalogGrouping.Humanize("DeathcareFacility"));
			Assert.Equal("Water Pumping Station", BuildingCatalogGrouping.Humanize("WaterPumpingStation"));
			Assert.Equal("Service Buildings Health", BuildingCatalogGrouping.Humanize("ServiceBuildings_Health"));
			Assert.Equal("Hospital", BuildingCatalogGrouping.Humanize("Hospital"));
		}

		[Fact]
		public void LandsEachCostOnTheCorrectSideOfEveryEdge()
		{
			var bands = BuildingCatalogGrouping.CostBands;
			Assert.Equal("₡0–₡5k", BuildingCatalogGrouping.CostBandLabel(0));
			Assert.Equal("₡0–₡5k", BuildingCatalogGrouping.CostBandLabel(bands[0] - 1));
			Assert.Equal("₡5k–₡25k", BuildingCatalogGrouping.CostBandLabel(bands[0]));
			Assert.Equal("₡5k–₡25k", BuildingCatalogGrouping.CostBandLabel(bands[1] - 1));
			Assert.Equal("₡25k–₡100k", BuildingCatalogGrouping.CostBandLabel(bands[1]));
			Assert.Equal("₡100k+", BuildingCatalogGrouping.CostBandLabel(bands[2]));
			Assert.Equal("₡100k+", BuildingCatalogGrouping.CostBandLabel(999_999));
			Assert.Equal("Other", BuildingCatalogGrouping.CostBandLabel(null));
			Assert.Equal("Other", BuildingCatalogGrouping.CostBandLabel(double.NaN));
		}

		[Fact]
		public void BandsAFootprintByItsLongerSide()
		{
			Assert.Equal("2×2 and under", BuildingCatalogGrouping.FootprintBandLabel(2, 2));
			Assert.Equal("6×6 and under", BuildingCatalogGrouping.FootprintBandLabel(2, 6));
			Assert.Equal("4×4 and under", BuildingCatalogGrouping.FootprintBandLabel(3, 3));
			Assert.Equal("Larger than 6×6", BuildingCatalogGrouping.FootprintBandLabel(20, 1));
			Assert.Equal("Other", BuildingCatalogGrouping.FootprintBandLabel(0, 0));
		}

		[Fact]
		public void NamesEachDensityTierRatherThanPrintingItsEnumValue()
		{
			Assert.Equal("Low Density", BuildingCatalogGrouping.DensityTierLabel(ZoneTypeFilter.Low));
			Assert.Equal("Row Housing", BuildingCatalogGrouping.DensityTierLabel(ZoneTypeFilter.Row));
			Assert.Equal("Medium Density", BuildingCatalogGrouping.DensityTierLabel(ZoneTypeFilter.Medium));
			Assert.Equal("Mixed Housing", BuildingCatalogGrouping.DensityTierLabel(ZoneTypeFilter.Mixed));
			Assert.Equal("Low Rent Housing", BuildingCatalogGrouping.DensityTierLabel(ZoneTypeFilter.LowRent));
			Assert.Equal("High Density", BuildingCatalogGrouping.DensityTierLabel(ZoneTypeFilter.High));
			Assert.Equal("Other", BuildingCatalogGrouping.DensityTierLabel(ZoneTypeFilter.Any));
		}

		[Fact]
		public void TheTierUnderAMenuCategoryIsDensityThenTransitThenBranchThenMilestone()
		{
			var names = new[] { "", "A", "B", "", "", "", "", "", "", "Metropolis" };

			Assert.Equal("Low Rent Housing", BuildingCatalogGrouping.CategoryTierLabel(Entry() with { ZoneType = ZoneTypeFilter.LowRent }));
			Assert.Equal("Crematorium", BuildingCatalogGrouping.CategoryTierLabel(Entry() with { DevTreeBranch = "Crematorium" }));
			// Signature is excluded from the density branch, so it falls through to the milestone.
			Assert.Equal("Metropolis", BuildingCatalogGrouping.CategoryTierLabel(Entry() with { ZoneType = ZoneTypeFilter.Signature, UnlockMilestone = 9 }, names));
			Assert.Equal("Low Density", BuildingCatalogGrouping.CategoryTierLabel(Entry() with { ZoneType = ZoneTypeFilter.Low, DevTreeBranch = "Hospital" }));
		}

		[Fact]
		public void TransitSplitsByWhatAnAssetIsAndRelabelsTheStations()
		{
			var transit = Entry() with { UiMenu = "Transportation", UiCategory = "TransportationTrain", DevTreeBranch = "Train" };

			Assert.Equal("Tracks", BuildingCatalogGrouping.CategoryTierLabel(transit with { SubCategory = "Networks_Tracks", SubCategoryLabel = "Tracks" }));
			Assert.Equal("Stations", BuildingCatalogGrouping.CategoryTierLabel(transit with { SubCategory = "ServiceBuildings_Transportation", SubCategoryLabel = "Transportation" }));
			// A service menu's subcategory is constant across the menu, so the rule stays in transit.
			Assert.Equal("Hospital", BuildingCatalogGrouping.CategoryTierLabel(Entry() with { UiMenu = "Health & Deathcare", DevTreeBranch = "Hospital" }));
		}

		[Fact]
		public void NamesAMilestoneOutOfThePublishedTableAndFallsBackToItsIndex()
		{
			var names = new[] { "", "Tiny Village", "Small Village" };

			Assert.Equal("Tiny Village", BuildingCatalogGrouping.MilestoneLabel(1, names));
			Assert.Equal("From the start", BuildingCatalogGrouping.MilestoneLabel(0, names));
			Assert.Equal("Milestone 7", BuildingCatalogGrouping.MilestoneLabel(7, names));
			Assert.Equal("Other", BuildingCatalogGrouping.MilestoneLabel(null, names));
			Assert.Equal("Other", BuildingCatalogGrouping.MilestoneLabel(-1, names));
		}

		[Fact]
		public void OffersOnlyTheDimensionsThatCanSplitTheSet()
		{
			var ungated = new[]
			{
				Entry() with { Id = 1, DevTreeBranch = "Basic" },
				Entry() with { Id = 2, DevTreeBranch = "Basic" },
			};
			var offered = BuildingCatalogGrouping.OfferedDimensions(ungated, educationMenu: false);

			Assert.DoesNotContain("development", offered);
			Assert.DoesNotContain("theme", offered);
			Assert.DoesNotContain("schoolTier", offered);
			Assert.Contains("none", offered);

			var split = new[] { ungated[0], ungated[1] with { DevTreeBranch = "Nuclear Power Plant" } };
			Assert.Contains("development", BuildingCatalogGrouping.OfferedDimensions(split, educationMenu: false));
			// Everything before any entries have arrived, and school tier only where schools are.
			Assert.Equal(BuildingCatalogGrouping.Dimensions, BuildingCatalogGrouping.OfferedDimensions(System.Array.Empty<BuildingCatalogEntry>(), educationMenu: true));
			Assert.DoesNotContain("schoolTier", BuildingCatalogGrouping.OfferedDimensions(System.Array.Empty<BuildingCatalogEntry>(), educationMenu: false));
		}
	}
}
