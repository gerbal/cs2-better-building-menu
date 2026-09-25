using BetterBuildingMenu.Domain;

using Unity.Mathematics;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The bays an object parks, counted with the game's own arithmetic: NetInitializeSystem's slot
	/// interval and GetParkingSlotCount's divide.
	/// </summary>
	/// <remarks>Requires the game: the interval is Unity.Mathematics' arithmetic, which a mock
	/// assembly does not carry.</remarks>
	[Trait("Requires", "Game")]
	public sealed class ParkingSlotsTests
	{
		private static readonly ParkingLaneShape[] NoLanes = System.Array.Empty<ParkingLaneShape>();

		// A bay 2.5 m wide and 5 m deep.
		private static readonly float2 Bay = new(2.5f, 5f);

		[Fact]
		public void AGarageDeclaresItsCapacityAndIsNotAlsoADriveway()
		{
			Assert.Equal(40, ParkingSlots.Own(garageCapacity: 40, parkingSpawn: true, NoLanes));
			Assert.Equal(1, ParkingSlots.Own(garageCapacity: 1, parkingSpawn: false, NoLanes));
		}

		[Fact]
		public void AParkingConnectionWithNoCapacityIsOneSpace()
		{
			Assert.Equal(1, ParkingSlots.Own(garageCapacity: 0, parkingSpawn: true, NoLanes));
			Assert.Equal(0, ParkingSlots.Own(garageCapacity: 0, parkingSpawn: false, NoLanes));
		}

		[Theory]
		// Perpendicular: a bay takes its width along the lane.
		[InlineData(90f, 16)]
		// Parallel: a bay takes its depth along the lane.
		[InlineData(0f, 8)]
		// Angled at 60°: the smaller of width / sin and depth / cos, 2.887 m.
		[InlineData(60f, 13)]
		// Clamped to 90°. Unclamped, 300° would take the depth, as 0° does.
		[InlineData(300f, 16)]
		public void ALaneHoldsItsLengthOverTheSlotInterval(float angle, int bays)
		{
			var lane = new ParkingLaneShape(40f, Bay, angle);

			Assert.Equal(bays, ParkingSlots.Own(0, false, new[] { lane }));
		}

		[Fact]
		public void AVirtualLaneHasNoBays()
		{
			// No slot width: RoadsInfoviewUISystem drops a VirtualLane before counting. Parallel, so
			// the depth alone would otherwise give it eight bays.
			var lane = new ParkingLaneShape(40f, new float2(0f, 5f), 0f);

			Assert.Equal(0, ParkingSlots.Own(0, false, new[] { lane }));
		}

		[Fact]
		public void ALengthAHairShortOfExactStillCountsItsLastBay()
		{
			// GetParkingSlotCount adds 0.01 before dividing: a curve measured at 9.9999 m holds
			// four 2.5 m bays, not three.
			var lane = new ParkingLaneShape(9.9999f, Bay, 90f);

			Assert.Equal(4, ParkingSlots.Own(0, false, new[] { lane }));

			// Added to the length, not to the quotient: 9.98 m is 3.996 bays, not 4.002.
			Assert.Equal(3, ParkingSlots.Own(0, false, new[] { new ParkingLaneShape(9.98f, Bay, 90f) }));
		}

		[Fact]
		public void TheIntervalIsTheGamesBakedOne()
		{
			Assert.Equal(2.5f, ParkingSlots.Interval(Bay, 90f));
			Assert.Equal(5f, ParkingSlots.Interval(Bay, 0f));
			Assert.Equal(2.5f / math.sin(math.radians(60f)), ParkingSlots.Interval(Bay, 60f), 5);
		}

		/// <summary>A surface car park: two 60 m rows of perpendicular bays, a 20 m run of parallel
		/// ones along its entrance, and a parking connection, which counts one space of its own
		/// beside the lanes.</summary>
		[Fact]
		public void GoldenSurfaceCarPark()
		{
			var lanes = new[]
			{
				new ParkingLaneShape(60f, Bay, 90f),
				new ParkingLaneShape(60f, Bay, 90f),
				new ParkingLaneShape(20f, new float2(2f, 6f), 0f),
			};

			// 24 + 24 + 3, and the parking connection's one space.
			Assert.Equal(52, ParkingSlots.Own(0, parkingSpawn: true, lanes));
		}
	}
}
