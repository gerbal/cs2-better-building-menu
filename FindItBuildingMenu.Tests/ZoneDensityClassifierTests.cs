using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The density tier a zone belongs to.
	/// </summary>
	/// <remarks>
	/// Every fixture below is a REAL zone, with its real field values, taken
	/// from docs/superpowers/specs/2026-08-23-zone-density-probe-data.txt — an
	/// instrumented boot over all 88 shipped zone prefabs. Invented numbers
	/// would have agreed with whatever the classifier happened to do; these
	/// are the cases that actually distinguish a working rule from a plausible
	/// one, and two of them caught bugs in the rule as first written.
	/// </remarks>
	public sealed class ZoneDensityClassifierTests
	{
		private static ZoneDensityFacts Residential(
			float properties, float space, bool scale, bool sells, int maxLotWidth, string name) =>
			new(true, properties, space, scale, sells, maxLotWidth, name);

		[Fact]
		public void ReadsMixedFromTheCommerceItAllows_NotFromItsName()
		{
			// EU Residential Mixed sells goods, so it is mixed use whatever its
			// ratio says. All thirteen mixed zones carry m_AllowedSold and
			// nothing else in the catalog does.
			Assert.Equal(
				ZoneTypeFilter.Mixed,
				ZoneDensityClassifier.Classify(
					Residential(2f, 2.667f, scale: true, sells: true, 5, "EU Residential Mixed")));
		}

		[Fact]
		public void DoesNotCallATownhouseMixedJustBecauseOfItsName()
		{
			// UK London Townhouse sells nothing and is a plain high-density
			// zone. A name test for "townhouse" captures it; the data does not.
			// This is the whole argument for reading the data first.
			Assert.Equal(
				ZoneTypeFilter.High,
				ZoneDensityClassifier.Classify(
					Residential(0.5f, 0.2f, scale: true, sells: false, 3, "UK London Townhouse")));
		}

		[Fact]
		public void ReadsLowRentFromItsDensityRatio()
		{
			// CN Residential LowRent: four properties per unit of space, the
			// densest thing in the game. The ratio derivation alone calls it
			// High, which loses the distinction the player navigates by.
			Assert.Equal(
				ZoneTypeFilter.LowRent,
				ZoneDensityClassifier.Classify(
					Residential(4f, 1f, scale: true, sells: false, 6, "CN Residential LowRent")));
		}

		[Fact]
		public void DoesNotCallAnUnscaledZoneLowRentAtTheSameRatio()
		{
			// UK Residential Low Terraced sits at ratio 3.0 with
			// m_ScaleResidentials FALSE. Without that guard the low-rent test
			// captures it and a low-density terrace is filed as high-density
			// affordable housing. The guard is why the test order in Classify
			// matters, and this is the case that proves it.
			Assert.Equal(
				ZoneTypeFilter.Low,
				ZoneDensityClassifier.Classify(
					Residential(3f, 1f, scale: false, sells: false, 3, "UK Residential Low Terraced")));
		}

		[Theory]
		[InlineData("CN Residential Low", 1f, 1f, false, 4, ZoneTypeFilter.Low)]
		[InlineData("EU Residential Medium Row", 0.5f, 1f, true, 2, ZoneTypeFilter.Row)]
		[InlineData("CN Residential Medium", 0.75f, 1f, true, 4, ZoneTypeFilter.Medium)]
		[InlineData("CN Residential High", 6f, 3f, true, 6, ZoneTypeFilter.High)]
		public void KeepsTheExistingFourTiers(
			string name, float properties, float space, bool scale, int maxLotWidth, ZoneTypeFilter expected)
		{
			Assert.Equal(
				expected,
				ZoneDensityClassifier.Classify(Residential(properties, space, scale, false, maxLotWidth, name)));
		}

		[Theory]
		[InlineData("EU Commercial High", ZoneTypeFilter.High)]
		[InlineData("EE Commercial Low", ZoneTypeFilter.Low)]
		[InlineData("Office Low", ZoneTypeFilter.Low)]
		[InlineData("CN Office High", ZoneTypeFilter.High)]
		public void FallsBackToTheNameForZonesWithNoResidents(string name, ZoneTypeFilter expected)
		{
			// m_ResidentialProperties is 0 for every commercial and office
			// zone, so the ratio derivation cannot speak for them at all. The
			// name is the only source, and all sixteen carry their tier in it.
			Assert.Equal(
				expected,
				ZoneDensityClassifier.Classify(new ZoneDensityFacts(false, 0f, 30f, false, true, 6, name)));
		}

		[Fact]
		public void LeavesIndustrialUntiered()
		{
			Assert.Equal(
				ZoneTypeFilter.Any,
				ZoneDensityClassifier.Classify(
					new ZoneDensityFacts(false, 0f, 1f, false, false, 6, "Industrial Manufacturing")));
		}

		[Fact]
		public void DoesNotLetTheLowStemCaptureLowRentInTheNameFallback()
		{
			// The old stem table was Row, Low, Medium, High in that order, and
			// these are substring tests, so "LowRent" matched "Low" and every
			// low-rent zone read as low density. Only reachable now for a zone
			// with no usable residential data, but the ordering has to be right
			// or the fallback reintroduces the bug the data rule fixed.
			Assert.Equal(
				ZoneTypeFilter.LowRent,
				ZoneDensityClassifier.Classify(
					new ZoneDensityFacts(false, 0f, 1f, false, false, 6, "XX Residential LowRent")));
		}

		[Fact]
		public void ReadsRowBeforeMediumInTheNameFallback()
		{
			// "Medium Density Row Housing" is row housing. Medium first would
			// take it, since both stems are present.
			Assert.Equal(
				ZoneTypeFilter.Row,
				ZoneDensityClassifier.Classify(
					new ZoneDensityFacts(false, 0f, 1f, false, false, 2, "XX Residential Medium Row")));
		}

		[Fact]
		public void TreatsAZoneWithNoSpawnableBuildingsAsRow()
		{
			// The documented fallback of the existing derivation: "no spawnable
			// building wider than 2" is exactly "the widest is at most 2", and
			// a zone with none at all has a max width of 0. Preserved here
			// rather than corrected — it is pre-existing behaviour, and
			// Residential Medium is the one zone it mislabels.
			Assert.Equal(
				ZoneTypeFilter.Row,
				ZoneDensityClassifier.Classify(
					Residential(0.75f, 1f, scale: true, sells: false, 0, "Residential Medium")));
		}
	}
}
