using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The density tier a zone belongs to. Every fixture below is a REAL zone with
	/// its real field values: invented numbers agree with whatever the classifier
	/// happens to do, while these separate a working rule from a plausible one.
	/// </summary>
	public sealed class ZoneDensityClassifierTests
	{
		private static ZoneDensityFacts Residential(
			float properties, float space, bool scale, bool sells, int maxLotWidth, string name) =>
			new(true, properties, space, scale, sells, maxLotWidth, name);

		[Fact]
		public void ReadsMixedFromTheCommerceItAllows_NotFromItsName()
		{
			// A zone that sells goods is mixed use whatever its ratio says, and
			// m_AllowedSold is carried by the mixed zones and nothing else.
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
			// The ratio derivation alone calls the densest zones High, which loses
			// the distinction the player navigates by.
			Assert.Equal(
				ZoneTypeFilter.LowRent,
				ZoneDensityClassifier.Classify(
					Residential(4f, 1f, scale: true, sells: false, 6, "CN Residential LowRent")));
		}

		[Fact]
		public void DoesNotCallAnUnscaledZoneLowRentAtTheSameRatio()
		{
			// Without the m_ScaleResidentials guard the low-rent test captures a
			// terrace at the same ratio and files low density as high-density
			// affordable housing, which is why the test order in Classify matters.
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
			// m_ResidentialProperties is 0 for every commercial and office zone, so
			// the ratio derivation cannot speak for them and the name is the source.
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
			// The stems are substring tests and "LowRent" contains "Low", so the
			// fallback has to reach LowRent first. It is only reachable for a zone
			// with no usable residential data.
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
			// The derivation's fallback reads "no spawnable building wider than 2",
			// which is "the widest is at most 2", and a zone with none at all has a
			// max width of 0.
			Assert.Equal(
				ZoneTypeFilter.Row,
				ZoneDensityClassifier.Classify(
					Residential(0.75f, 1f, scale: true, sells: false, 0, "Residential Medium")));
		}
	}
}
