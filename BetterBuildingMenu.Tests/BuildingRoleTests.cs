using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class BuildingRoleTests
	{
		[Fact]
		public void NamesTheRoleFromTheServiceDataThePrefabCarries()
		{
			// The Role facet was wired end to end but always empty: it read
			// BuildingMarkerData.m_BuildingType, an editor marker component that
			// ordinary building prefabs do not carry. The service data the
			// indexer already reads for capacity names the role directly.
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
			// Power plants report output as production rather than capacity, so
			// they had no role and no capacity until the component was read.
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
	}
}
