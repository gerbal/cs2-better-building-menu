using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class BuildingRoleTests
	{
		[Fact]
		public void NamesTheRoleFromTheServiceDataThePrefabCarries()
		{
			// The role comes from the service data the indexer already reads for
			// capacity, which names it directly.
			Assert.Equal("School", BuildingRole.ResolvePrimary(new[] { "School" }));
			Assert.Equal("Hospital", BuildingRole.ResolvePrimary(new[] { "Hospital" }));
			Assert.Equal("WaterPumpingStation", BuildingRole.ResolvePrimary(new[] { "WaterPumpingStation" }));
		}

		[Fact]
		public void PicksOneRoleDeterministicallyWhenAPrefabCarriesSeveral()
		{
			// A few prefabs carry more than one service component. The entry
			// holds a single role, so the choice has to be stable rather than
			// dependent on component iteration order.
			Assert.Equal(
				"Hospital",
				BuildingRole.ResolvePrimary(new[] { "DeathcareFacility", "Hospital" }));
			Assert.Equal(
				"Hospital",
				BuildingRole.ResolvePrimary(new[] { "Hospital", "DeathcareFacility" }));
		}

		[Fact]
		public void NamesPowerPlantsFromTheirProductionComponent()
		{
			// Power plants report output as production rather than capacity, so the
			// role comes from the production component.
			Assert.Equal("PowerPlant", BuildingRole.ResolvePrimary(new[] { "PowerPlant" }));
		}

		[Fact]
		public void ReturnsNullWhenThePrefabHasNoServiceRole()
		{
			// Residential, commercial and prop prefabs have no service role, and
			// an empty string would create a blank facet option.
			Assert.Null(BuildingRole.ResolvePrimary(new string[0]));
			Assert.Null(BuildingRole.ResolvePrimary(null));
		}

		[Fact]
		public void IgnoresBlankRoleNames()
		{
			Assert.Null(BuildingRole.ResolvePrimary(new[] { "", "   " }));
			Assert.Equal("Prison", BuildingRole.ResolvePrimary(new[] { "", "Prison" }));
		}

		[Fact]
		public void KeepsAnUnrecognisedRoleRatherThanDiscardingIt()
		{
			// A service component this build does not know about should still
			// name its buildings instead of leaving them unfiltered.
			Assert.Equal("SomeNewService", BuildingRole.ResolvePrimary(new[] { "SomeNewService" }));
		}

		[Fact]
		public void PrefersAKnownRoleOverAnUnknownOne()
		{
			Assert.Equal("School", BuildingRole.ResolvePrimary(new[] { "SomeNewService", "School" }));
		}
		[Fact]
		public void CommunicationsBuildingsHaveARole()
		{
			// A role the indexer can produce but Priority does not list is dropped
			// by ResolvePrimary and never offered by the facet, so these have to be
			// registered as known.
			Assert.Contains("PostFacility", BuildingRole.Known);
			Assert.Contains("TelecomFacility", BuildingRole.Known);

			Assert.Equal("PostFacility", BuildingRole.ResolvePrimary(new[] { "PostFacility" }));
			Assert.Equal("TelecomFacility", BuildingRole.ResolvePrimary(new[] { "TelecomFacility" }));
		}

	}
}
