using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// A building another service's tree unlocks keeps that branch for Group by Development, but the
	/// strip files it with its category's own buildings: no tab of one for a foreign node.
	/// </summary>
	public sealed class StripBranchTests
	{
		private static readonly BuildingCatalogEntry Station =
			TestEntries.Make(1, "City Center Bus Station") with { DevTreeBranch = "Large Parks", StripBranch = "Road" };

		[Fact]
		public void TheStripReadsTheStripBranch()
		{
			Assert.Equal("Road", BuildingCatalogQueryEngine.StripValue(Station, StripAxes.Development));
			Assert.True(BuildingCatalogQueryEngine.StripMatches(Station, "Road"));
			Assert.False(BuildingCatalogQueryEngine.StripMatches(Station, "Large Parks"));
		}

		[Fact]
		public void DevelopmentStillHeadsItByItsOwnBranch()
		{
			Assert.Equal(new[] { "Large Parks" }, BuildingCatalogGrouping.Find("development").Labels(Station).Path);
		}

		[Fact]
		public void AnyOtherBuildingStripsByItsBranch()
		{
			var hospital = TestEntries.Make(2, "Hospital") with { DevTreeBranch = "Hospital" };

			Assert.Equal("Hospital", BuildingCatalogQueryEngine.StripValue(hospital, StripAxes.Development));
			Assert.True(BuildingCatalogQueryEngine.StripMatches(hospital, "Hospital"));
		}
	}
}
