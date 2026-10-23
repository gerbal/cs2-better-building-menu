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
			Assert.Equal(new[] { "Cars" }, Facts(RoadTypes.Car).ParkingVehicles);
			Assert.Equal(new[] { "Bicycles" }, Facts(RoadTypes.Bicycle).ParkingVehicles);
			Assert.Equal(new[] { "Cars", "Bicycles" }, Facts(RoadTypes.Car | RoadTypes.Bicycle).ParkingVehicles);
			Assert.Null(Facts(RoadTypes.None).ParkingVehicles);
		}

		[Fact]
		public void VehicleHeadsCarsThenBicyclesThenBoth()
		{
			var car = TestEntries.Make(1, "Parking Lot") with { ParkingVehicles = new[] { "Cars" } };
			var bike = TestEntries.Make(2, "Bicycle Parking") with { ParkingVehicles = new[] { "Bicycles" } };
			var both = TestEntries.Make(3, "Parking Hall") with { ParkingVehicles = new[] { "Cars", "Bicycles" } };
			var road = TestEntries.Make(4, "Avenue");
			var vehicle = BuildingCatalogGrouping.Find("vehicle");

			Assert.Equal(new[] { "Cars" }, vehicle.Labels(car).Path);
			Assert.Equal(new[] { "Bicycles" }, vehicle.Labels(bike).Path);
			Assert.Equal(new[] { "Cars and bicycles" }, vehicle.Labels(both).Path);
			Assert.Equal(new[] { "Other" }, vehicle.Labels(road).Path);
			Assert.Equal(
				new[] { car, bike, both, road }.Select(e => e.Id),
				new[] { road, both, bike, car }.OrderBy(vehicle.PrimaryKey, System.StringComparer.Ordinal).Select(e => e.Id));
		}

		[Fact]
		public void VehicleFiltersOnAnyVehiclePicked()
		{
			Assert.True(BuildingCatalogFacetFields.TryFind("vehicle", out var facet));
			var both = TestEntries.Make(3, "Parking Hall") with { ParkingVehicles = new[] { "Cars", "Bicycles" } };

			Assert.True(facet!.Matches!(both, new[] { "Bicycles" }));
			Assert.False(facet.Matches!(TestEntries.Make(4, "Avenue"), new[] { "Bicycles" }));
			Assert.Equal(new[] { "Bicycles" }, facet.Selected(facet.QueryWith(new BuildingCatalogQuery(), new[] { "Bicycles" })));
		}
	}
}
