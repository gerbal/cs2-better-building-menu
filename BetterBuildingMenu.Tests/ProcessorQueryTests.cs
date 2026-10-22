using BetterBuildingMenu.Utilities.PrefabCategoryProcessor;

using Game.Prefabs;

using System;
using System.Collections.Generic;
using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The prefabs each processor's query names, read off its spec without the game.
	/// </summary>
	public sealed class ProcessorQueryTests
	{
		/// <summary>Each processor's query: its descriptions, any of which a prefab may match.</summary>
		private static readonly Dictionary<string, string> Queries = new()
		{
			["BridgesPrefabCategoryProcessor"] = "All BridgeData",
			["DecalsPrefabCategoryProcessor"] = "All StaticObjectData SubMesh; None BuildingData BrandObjectData PlaceholderObjectElement",
			["FencePrefabCategoryProcessor"] = "All FenceData NetData",
			["IntersectionsPrefabCategoryProcessor"] = "All AssetStampData SubNet",
			["LanesPrefabCategoryProcessor"] = "All NetLaneData SubMesh; None PathwayData RoadData BridgeData TrackData TrackLaneData PlaceholderObjectElement",
			["MenuPlacedPrefabCategoryProcessor"] = "All UIObjectData PrefabData",
			["MiscBuildingPrefabCategoryProcessor"] = "All BuildingData; None ServiceObjectData SpawnableBuildingData SignatureBuildingData ServiceUpgradeBuilding",
			["PathsPrefabCategoryProcessor"] = "All PathwayData NetData; None BridgeData",
			["PillarPrefabCategoryProcessor"] = "All PillarData SpawnableObjectData",
			["PropPrefabCategoryProcessor"] = "All StaticObjectData; None BuildingData NetObjectData BuildingExtensionData PillarData PlantData TrafficSignData LaneDirectionData TrafficLightData",
			["RoadsPrefabCategoryProcessor"] = "All RoadData; None BridgeData",
			["RoundaboutPrefabCategoryProcessor"] = "All NetObjectData; None PillarData",
			["ServiceBuildingPrefabCategoryProcessor"] =
				"All BuildingData ServiceObjectData; None TrafficSpawnerData SpawnableBuildingData PlaceholderBuildingData"
				+ " | All ServiceUpgradeBuilding BuildingData; None TrafficSpawnerData SpawnableBuildingData PlaceholderBuildingData"
				+ " | All ServiceUpgradeBuilding BuildingExtensionData; None TrafficSpawnerData SpawnableBuildingData PlaceholderBuildingData",
			["ShrubPrefabCategoryProcessor"] = "All PlantData LoadedIndex; None TreeData NetLaneData",
			["SportPropPrefabCategoryProcessor"] = "All StaticObjectData BuildingExtensionData PlaceableObjectData; None BuildingData",
			["SurfacePrefabCategoryProcessor"] = "All AreaData; None PlaceholderObjectElement | All SurfaceData; None PlaceholderObjectElement",
			["TerraformingPrefabCategoryProcessor"] = "All TerraformingData",
			["TracksPrefabCategoryProcessor"] = "All TrackData",
			["TransportLinePrefabCategoryProcessor"] = "All TransportLineData RouteData",
			["TreePrefabCategoryProcessor"] = "All TreeData GrowthScaleData",
			["UtilityNetworksPrefabCategoryProcessor"] = "All PowerLineData NetData | All PipelineData NetData",
			["WaterwaysPrefabCategoryProcessor"] = "All WaterwayData NetData",
			["ZonePrefabCategoryProcessor"] = "All ZoneData",
			["ZonedBuildingPrefabCategoryProcessor"] = "All BuildingData SpawnableBuildingData | All BuildingData PlaceholderBuildingData",
		};

		private static string Describe(ProcessorQuery query) =>
			string.Join(" | ", query.Descriptions.Select(description =>
				string.Join("; ", new[] { Slot("All", description.All), Slot("None", description.None) }.Where(slot => slot is not null))));

		private static string? Slot(string name, IReadOnlyList<Type> components) =>
			components.Count == 0 ? null : name + " " + string.Join(" ", components.Select(component => component.Name));

		[Fact]
		public void EachProcessorReadsThePrefabsItsQueryNames()
		{
			var built = PrefabCategoryProcessors.Create(new PrefabCategoryProcessors.Dependencies(default, null!, null!));

			Assert.Equal(
				Queries.OrderBy(pair => pair.Key, StringComparer.Ordinal).Select(pair => $"{pair.Key}: {pair.Value}"),
				built.Select(processor => $"{processor.GetType().Name}: {Describe(processor.Query)}").OrderBy(line => line, StringComparer.Ordinal));
		}

		[Fact]
		public void NarrowingAQueryLeavesTheOneItNarrowedAsItWas()
		{
			var roads = ProcessorQuery.All(typeof(RoadData));
			var unbridged = roads.None(typeof(BridgeData));

			Assert.Equal("All RoadData", Describe(roads));
			Assert.Equal("All RoadData; None BridgeData", Describe(unbridged));
			Assert.IsNotType<Type[]>(unbridged.Descriptions[0].None);
		}

		[Fact]
		public void NarrowingAnAlternativeNarrowsEachOfItsDescriptions()
		{
			var query = ProcessorQuery.All(typeof(AreaData)).Or(ProcessorQuery.All(typeof(SurfaceData))).None(typeof(PlaceholderObjectElement));

			Assert.Equal("All AreaData; None PlaceholderObjectElement | All SurfaceData; None PlaceholderObjectElement", Describe(query));
		}
	}
}
