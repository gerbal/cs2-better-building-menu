using System;
using System.Collections.Generic;

using Unity.Mathematics;

namespace BetterBuildingMenu.Domain
{
	/// <summary>One parking lane of an object: how long its curve is, and its ParkingLane's slot
	/// size and angle.</summary>
	public readonly record struct ParkingLaneShape(float Length, float2 SlotSize, float SlotAngle);

	/// <summary>How many cars an object parks, counted rather than merely detected.</summary>
	/// <remarks>Exact for an object's own lanes: LaneSystem.CreateObjectLane sets FindConnections on
	/// every one, so the curve is never trimmed and the game's own arithmetic reproduces the count.
	/// The indexer adds each sub-object's count to its owner's.</remarks>
	public static class ParkingSlots
	{
		/// <summary>The bays an object has of its own, not counting its sub-objects.</summary>
		/// <param name="garageCapacity">ParkingFacility.m_GarageMarkerCapacity, or 0 without one.</param>
		/// <param name="parkingSpawn">Whether a SpawnLocation connects to parking.</param>
		/// <param name="lanes">Its sub-lanes whose lane prefab is a ParkingLane.</param>
		public static int Own(int garageCapacity, bool parkingSpawn, IEnumerable<ParkingLaneShape> lanes)
		{
			var slots = 0;

			// A garage parks cars inside rather than along marked lanes, so it has no sub-lanes to
			// divide up and declares its capacity outright.
			if (garageCapacity > 0)
			{
				slots += garageCapacity;
			}
			else if (parkingSpawn)
			{
				// A parking connection with no declared capacity really is one dedicated space: a
				// driveway rather than a car park.
				slots++;
			}

			foreach (var lane in lanes)
			{
				// A lane with no slot width is Virtual, and the game's own capacity sum skips those:
				// RoadsInfoviewUISystem drops VirtualLane before adding slots, and a slot angle near
				// zero would otherwise count bays.
				if (lane.SlotSize.x < 0.001f)
				{
					continue;
				}

				var interval = Interval(lane.SlotSize, lane.SlotAngle);

				if (interval > 0.001f)
				{
					// The +0.01 is the game's, not a fudge: GetParkingSlotCount adds it before the
					// divide, and dropping it loses a bay whenever the length divides exactly.
					slots += (int)Math.Floor((lane.Length + 0.01f) / interval);
				}
			}

			return slots;
		}

		/// <summary>The spacing between bays, derived the way the game bakes it.</summary>
		/// <remarks>NetInitializeSystem computes ParkingLaneData.m_SlotInterval from the managed slot
		/// size and angle; deriving it from them lets the indexer read the prefab graph's managed
		/// ParkingLane rather than the baked component.</remarks>
		public static float Interval(float2 slotSize, float slotAngle)
		{
			var angle = math.radians(math.clamp(slotAngle, 0f, 90f));
			var size = math.select(slotSize, 0f, slotSize < 0.001f);
			var y = new float2(math.cos(angle), math.sin(angle));

			if (y.y < 0.001f)
			{
				return size.y;
			}

			if (y.x < 0.001f)
			{
				return size.x;
			}

			var scaled = size / new float2(y.y, y.x);
			scaled = math.select(scaled, 0f, scaled < 0.001f);

			return math.min(scaled.x, scaled.y);
		}
	}
}
