using FindItBuildingMenu.Domain;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	public sealed class ZoneFamilySelectionTests
	{
		[Fact]
		public void EmptyMeansEveryFamilyRatherThanNone()
		{
			// A filter nobody has touched must not hide anything. Treating the
			// empty set as "match nothing" would open the zoning view on a
			// blank panel.
			Assert.True(ZoneFamilySelection.Includes(null, ZoningFamilies.Residential));
			Assert.True(ZoneFamilySelection.Includes(new string[0], ZoningFamilies.Office));
		}

		[Fact]
		public void SelectsSeveralFamiliesAtOnce()
		{
			// The whole point of leaving the tab strip behind: residential and
			// commercial zones side by side was previously unaskable.
			string[] selected = ZoneFamilySelection.Toggle(
				ZoneFamilySelection.Toggle(null, ZoningFamilies.Residential),
				ZoningFamilies.Commercial);

			Assert.Equal(new[] { ZoningFamilies.Residential, ZoningFamilies.Commercial }, selected);
			Assert.True(ZoneFamilySelection.Includes(selected, ZoningFamilies.Commercial));
			Assert.False(ZoneFamilySelection.Includes(selected, ZoningFamilies.Industrial));
		}

		[Fact]
		public void TogglingTheSameFamilyTwiceRemovesIt()
		{
			string[] once = ZoneFamilySelection.Toggle(null, ZoningFamilies.Office);
			string[] twice = ZoneFamilySelection.Toggle(once, ZoningFamilies.Office);

			Assert.Equal(new[] { ZoningFamilies.Office }, once);
			Assert.Empty(twice);
		}

		[Fact]
		public void KeepsFamilyOrderRatherThanClickOrder()
		{
			// The chips should read like the vanilla Zones menu's tabs whatever
			// order the player happened to click them in.
			string[] selected = ZoneFamilySelection.Toggle(
				ZoneFamilySelection.Toggle(null, ZoningFamilies.Extractors),
				ZoningFamilies.Residential);

			Assert.Equal(new[] { ZoningFamilies.Residential, ZoningFamilies.Extractors }, selected);
		}

		[Fact]
		public void IgnoresAFamilyThisBuildDoesNotKnow()
		{
			// An unknown id would become a chip that filters everything away
			// and cannot be reasoned about.
			Assert.Empty(ZoneFamilySelection.Toggle(null, "ZoneUnderwater"));
			Assert.Empty(ZoneFamilySelection.Toggle(null, ""));
			Assert.Empty(ZoneFamilySelection.Toggle(null, null));
		}

		[Fact]
		public void MatchesFamilyNamesWithoutRegardToCase()
		{
			string[] selected = ZoneFamilySelection.Toggle(null, "zoneresidential");

			Assert.Equal(new[] { ZoningFamilies.Residential }, selected);
			Assert.True(ZoneFamilySelection.Includes(selected, "ZONERESIDENTIAL"));
		}

		[Fact]
		public void NormalizeDropsBlanksDuplicatesAndUnknowns()
		{
			string[] normalized = ZoneFamilySelection.Normalize(new[]
			{
				"  ZoneCommercial  ", "ZoneCommercial", "", "   ", "ZoneNonsense", ZoningFamilies.Residential,
			});

			Assert.Equal(new[] { ZoningFamilies.Residential, ZoningFamilies.Commercial }, normalized);
		}

		[Fact]
		public void DeclinesAFamilylessZoneOnceSomethingIsSelected()
		{
			// Zones carrying no family should not sneak through a narrowed view.
			string[] selected = ZoneFamilySelection.Toggle(null, ZoningFamilies.Industrial);

			Assert.False(ZoneFamilySelection.Includes(selected, null));
			Assert.False(ZoneFamilySelection.Includes(selected, ""));
			Assert.True(ZoneFamilySelection.Includes(null, null));
		}
	}
}
