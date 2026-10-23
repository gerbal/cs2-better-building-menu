using System.Linq;
using BetterBuildingMenu.Domain;
using Game.Net;
using Game.Prefabs;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// What a parking building parks, from the game's ParkingFacility road types: Car and
	/// Bicycle. The game has no motorcycle type; motorcycles park as cars.
	/// </summary>
	public sealed class VehicleTests
	{
		private static PrefabIndex Facts(RoadTypes roadTypes)
		{
			var prefabIndex = TestPrefabs.Entry(1, BetterBuildingMenu.Domain.Enums.PrefabCategory.ServiceBuildings, BetterBuildingMenu.Domain.Enums.PrefabSubCategory.Any);
			PrefabFacts.Apply(new PrefabSnapshot { ParkingFacilityData = new ParkingFacilityData { m_RoadTypes = roadTypes } }, prefabIndex);
			return prefabIndex;
		}

		[Fact]
		public void AParkingBuildingSaysWhatItParks()
		{
			Assert.Equal(new[] { "Vehicles" }, Facts(RoadTypes.Car).ParkingVehicles);
			Assert.Equal(new[] { "Bicycles" }, Facts(RoadTypes.Bicycle).ParkingVehicles);
			Assert.Equal(new[] { "Vehicles", "Bicycles" }, Facts(RoadTypes.Car | RoadTypes.Bicycle).ParkingVehicles);
			Assert.Null(Facts(RoadTypes.None).ParkingVehicles);
		}

		[Fact]
		public void VehicleHeadsVehiclesThenBicyclesThenBoth()
		{
			var car = TestEntries.Make(1, "Parking Lot") with { ParkingVehicles = new[] { "Vehicles" } };
			var bike = TestEntries.Make(2, "Bicycle Parking") with { ParkingVehicles = new[] { "Bicycles" } };
			var both = TestEntries.Make(3, "Parking Hall") with { ParkingVehicles = new[] { "Vehicles", "Bicycles" } };
			var road = TestEntries.Make(4, "Avenue");
			var vehicle = BuildingCatalogGrouping.Find("vehicle");

			Assert.Equal(new[] { "Vehicles" }, vehicle.Labels(car).Path);
			Assert.Equal(new[] { "Bicycles" }, vehicle.Labels(bike).Path);
			Assert.Equal(new[] { "Vehicles and bicycles" }, vehicle.Labels(both).Path);
			Assert.Equal(new[] { "Other" }, vehicle.Labels(road).Path);
			Assert.Equal(
				new[] { car, bike, both, road }.Select(e => e.Id),
				new[] { road, both, bike, car }.OrderBy(vehicle.PrimaryKey, System.StringComparer.Ordinal).Select(e => e.Id));
		}

		[Fact]
		public void VehicleFiltersOnAnyVehiclePicked()
		{
			Assert.True(BuildingCatalogFacetFields.TryFind("vehicle", out var facet));
			var both = TestEntries.Make(3, "Parking Hall") with { ParkingVehicles = new[] { "Vehicles", "Bicycles" } };

			Assert.True(facet!.Matches!(both, new[] { "Bicycles" }));
			Assert.False(facet.Matches!(TestEntries.Make(4, "Avenue"), new[] { "Bicycles" }));
			Assert.Equal(new[] { "Bicycles" }, facet.Selected(facet.QueryWith(new BuildingCatalogQuery(), new[] { "Bicycles" })));
		}

		[Fact]
		public void ParkingWithNoFacilityParksWhatItsLanesPark()
		{
			// Bicycle Stand, Bicycle Stands, Bicycle Shelter: stops in Roads' Parking category with
			// bicycle parking lanes and no ParkingFacility (read in game, 2026-10-22).
			Assert.Equal(new[] { "Bicycles" }, PrefabFacts.ParkingVehiclesOf(null, "RoadsParking", RoadTypes.Bicycle));
			// A facility's answer stands.
			Assert.Equal(new[] { "Vehicles" }, PrefabFacts.ParkingVehiclesOf(new[] { "Vehicles" }, "RoadsParking", RoadTypes.Bicycle));
			// Outside Parking a car park is not what a building is for: a hospital's lot says nothing.
			Assert.Null(PrefabFacts.ParkingVehiclesOf(null, "HealthcareHospital", RoadTypes.Car));
		}
	}
}
