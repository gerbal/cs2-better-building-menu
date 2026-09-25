using Colossal.Core;
using Colossal.Entities;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.Mathematics;
using Colossal.PSI.Common;
using Colossal.Serialization.Entities;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.Interfaces;
using BetterBuildingMenu.Utilities;

using Game;
using Game.City;
using Game.Common;
using Game.Companies;
using Game.Prefabs;
using Game.SceneFlow;
using Game.UI;
using Game.UI.InGame;

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;

using Unity.Collections;
using Unity.Entities;
using Unity.Mathematics;

namespace BetterBuildingMenu.Systems
{
	// The per-prefab facts an entry carries: costs, service figures, bonuses, parking, upgrades.
	public partial class PrefabIndexingSystem
	{
		/// <summary>An entry's figures and facts. See <see cref="PrefabFacts"/>.</summary>
		private void PopulateAnalyticalData(Entity entity, PrefabIndex prefabIndex, ZoneIndex zones)
		{
			if (PrefabFacts.AppliesTo(prefabIndex.Category))
			{
				PrefabFacts.Apply(ReadSnapshot(DetailsSource(entity), zones), prefabIndex);
			}
		}

		/// <summary>The prefab whose figures a card shows for this one: for a network that owns a
		/// building, the building.</summary>
		/// <remarks>PrefabUISystem.BindPrefabDetails, transcribed: a network's cost, effects and
		/// properties come from its first sub-object flagged MakeOwner, as a hydroelectric dam's
		/// come from its power plant.</remarks>
		private Entity DetailsSource(Entity entity)
		{
			if (EntityManager.HasComponent<NetData>(entity)
				&& EntityManager.TryGetBuffer<Game.Prefabs.SubObject>(entity, true, out var subObjects))
			{
				for (var i = 0; i < subObjects.Length; i++)
				{
					if ((subObjects[i].m_Flags & SubObjectFlags.MakeOwner) != 0)
					{
						// Vanilla shows no details at all for an owner it cannot read;
						// the network's own figures are the better fallback.
						return EntityManager.HasEnabledComponent<PrefabData>(subObjects[i].m_Prefab)
							? subObjects[i].m_Prefab
							: entity;
					}
				}
			}

			return entity;
		}

		/// <summary>What <see cref="PrefabFacts.Apply"/> maps, read from the prefab's entity, its
		/// authoring prefab and the zone table.</summary>
		private PrefabSnapshot ReadSnapshot(Entity entity, ZoneIndex zones)
		{
			var snapshot = new PrefabSnapshot
			{
				AttractionData = Read<AttractionData>(entity),
				BatteryData = Read<BatteryData>(entity),
				BuildingPropertyData = Read<BuildingPropertyData>(entity),
				ConsumptionData = Read<ConsumptionData>(entity),
				CoverageData = Read<CoverageData>(entity),
				DeathcareFacilityData = Read<DeathcareFacilityData>(entity),
				ElectricityConnectionData = Read<ElectricityConnectionData>(entity),
				EmergencyGeneratorData = Read<EmergencyGeneratorData>(entity),
				EmergencyShelterData = Read<EmergencyShelterData>(entity),
				FireStationData = Read<FireStationData>(entity),
				GarbageFacilityData = Read<GarbageFacilityData>(entity),
				GarbagePoweredData = Read<GarbagePoweredData>(entity),
				GroundWaterPoweredData = Read<GroundWaterPoweredData>(entity),
				HospitalData = Read<HospitalData>(entity),
				LeisureProviderData = Read<LeisureProviderData>(entity),
				MailBoxData = Read<MailBoxData>(entity),
				MaintenanceDepotData = Read<MaintenanceDepotData>(entity),
				NetData = Read<NetData>(entity),
				NetGeometryData = Read<NetGeometryData>(entity),
				ParkData = Read<ParkData>(entity),
				ParkingFacilityData = Read<ParkingFacilityData>(entity),
				PathwayData = Read<PathwayData>(entity),
				PlaceableNetData = Read<PlaceableNetData>(entity),
				PlaceableObjectData = Read<PlaceableObjectData>(entity),
				PoliceStationData = Read<PoliceStationData>(entity),
				PollutionData = Read<PollutionData>(entity),
				PollutionModifierData = Read<PollutionModifierData>(entity),
				PostFacilityData = Read<PostFacilityData>(entity),
				PowerPlantData = Read<PowerPlantData>(entity),
				PrisonData = Read<PrisonData>(entity),
				RoadData = Read<RoadData>(entity),
				SchoolData = Read<SchoolData>(entity),
				ServiceUpgradeData = Read<ServiceUpgradeData>(entity),
				SewageOutletData = Read<SewageOutletData>(entity),
				SolarPoweredData = Read<SolarPoweredData>(entity),
				StorageLimitData = Read<StorageLimitData>(entity),
				TaxiwayData = Read<TaxiwayData>(entity),
				TelecomFacilityData = Read<TelecomFacilityData>(entity),
				TrackData = Read<TrackData>(entity),
				TransportDepotData = Read<TransportDepotData>(entity),
				TransportStationData = Read<TransportStationData>(entity),
				TransportStopData = Read<TransportStopData>(entity),
				WastewaterTreatmentPlantData = Read<WastewaterTreatmentPlantData>(entity),
				WaterPipeConnectionData = Read<WaterPipeConnectionData>(entity),
				WaterPoweredData = Read<WaterPoweredData>(entity),
				WaterPumpingStationData = Read<WaterPumpingStationData>(entity),
				WaterwayData = Read<WaterwayData>(entity),
				WindPoweredData = Read<WindPoweredData>(entity),
				WorkplaceData = Read<WorkplaceData>(entity),
				ZoneData = Read<ZoneData>(entity),
				ZonePropertiesData = Read<ZonePropertiesData>(entity),
				ZoneServiceConsumptionData = Read<ZoneServiceConsumptionData>(entity),
				RequiredResource = GetExtractorFeature(entity),
				LotSizes = zones.LotSizesOf(entity.Index),
				IsPipeline = EntityManager.HasComponent<PipelineData>(entity),
				IsTransformer = EntityManager.HasComponent<TransformerData>(entity),
				PollutionScale = _pollutionScale,
			};

			if (snapshot.IsTransformer || snapshot.PowerPlantData.HasValue || snapshot.EmergencyGeneratorData.HasValue)
			{
				ReadPowerSubNets(entity, snapshot);
			}

			if (!snapshot.NetData.HasValue)
			{
				snapshot.TransportStops = ReadTransportStops(entity);
			}

			if (snapshot.PlaceableNetData.HasValue)
			{
				List<(float Cost, float Share)>? auxiliary = null;
				CollectAuxiliaryNetCosts(entity, 1f, ref auxiliary, depth: 0);
				snapshot.AuxiliaryNetCosts = auxiliary;
			}

			if (snapshot.PlaceableNetData is { } netData)
			{
				snapshot.HasUndergroundVariant = netData.m_UndergroundPrefab != Entity.Null;

				// Road class, traffic lights and zoning live on the authoring prefab.
				if (_prefabSystem.TryGetPrefab<PrefabBase>(entity, out var netPrefab))
				{
					if (netPrefab is RoadPrefab roadPrefab)
					{
						snapshot.TrafficLights = roadPrefab.m_TrafficLights;
						snapshot.HighwayRules = roadPrefab.m_HighwayRules;
						snapshot.ZonesAlongside = roadPrefab.m_ZoneBlock is not null;
					}
				}
			}

			// Even empty: UpkeepPropertyBinderSystem shows the line for any prefab with the
			// buffer, and for no other.
			if (EntityManager.TryGetBuffer<ServiceUpkeepData>(entity, true, out var upkeepBuffer))
			{
				var stacks = new List<(string Resource, int Amount)>(upkeepBuffer.Length);
				for (var i = 0; i < upkeepBuffer.Length; i++)
				{
					stacks.Add((upkeepBuffer[i].m_Upkeep.m_Resource.ToString(), upkeepBuffer[i].m_Upkeep.m_Amount));
				}

				snapshot.ServiceUpkeep = stacks;
			}

			if (EntityManager.TryGetBuffer<UpkeepModifierData>(entity, true, out var upkeepModifiers) && upkeepModifiers.Length > 0)
			{
				var multipliers = new float[upkeepModifiers.Length];
				for (var i = 0; i < upkeepModifiers.Length; i++)
				{
					multipliers[i] = upkeepModifiers[i].m_Multiplier;
				}

				snapshot.UpkeepMultipliers = multipliers;
			}

			return snapshot;
		}

		private T? Read<T>(Entity entity)
			where T : unmanaged, IComponentData =>
			EntityManager.TryGetComponent<T>(entity, out var value) ? value : default(T?);

		/// <summary>The pollution thresholds, or null when the game has none.</summary>
		/// <remarks>Settings from the game's UIPollutionConfigurationPrefab, which PollutionBinder
		/// grades every building by. Read once a pass rather than once a prefab.</remarks>
		private PollutionScale? ReadPollutionScale()
		{
			var query = GetEntityQuery(ComponentType.ReadOnly<UIPollutionConfigurationData>());

			if (query.IsEmptyIgnoreFilter)
			{
				return null;
			}

			var entities = query.ToEntityArray(Allocator.Temp);

			if (!_prefabSystem.TryGetPrefab<UIPollutionConfigurationPrefab>(entities[0], out var config)
				|| config.m_GroundPollution is not { } ground
				|| config.m_AirPollution is not { } air
				|| config.m_NoisePollution is not { } noise)
			{
				return null;
			}

			return new PollutionScale(
				new PollutionThresholds(ground.m_Low, ground.m_Medium, ground.m_High),
				new PollutionThresholds(air.m_Low, air.m_Medium, air.m_High),
				new PollutionThresholds(noise.m_Low, noise.m_Medium, noise.m_High));
		}

		/// <summary>A transformer's connections and a power plant's power-line layers, from the
		/// prefab's sub-nets.</summary>
		/// <remarks>TransformerCapacityBinder counts only the connections that start and end on one
		/// node. ElectricityUIUtils.GetPowerLineLayers takes every power-line sub-net's.</remarks>
		private void ReadPowerSubNets(Entity entity, PrefabSnapshot snapshot)
		{
			if (!EntityManager.TryGetBuffer<Game.Prefabs.SubNet>(entity, true, out var subNets))
			{
				return;
			}

			var connections = new List<(ElectricityConnection.Voltage Voltage, int Capacity)>();
			var layers = Game.Net.Layer.None;

			for (var i = 0; i < subNets.Length; i++)
			{
				var subNet = subNets[i];

				if (!EntityManager.TryGetComponent<ElectricityConnectionData>(subNet.m_Prefab, out var connection))
				{
					continue;
				}

				if (subNet.m_NodeIndex.x == subNet.m_NodeIndex.y)
				{
					connections.Add((connection.m_Voltage, connection.m_Capacity));
				}

				if (EntityManager.TryGetComponent<NetData>(subNet.m_Prefab, out var net))
				{
					layers |= net.m_LocalConnectLayers;
				}
			}

			snapshot.TransformerConnections = connections;
			snapshot.SubNetPowerLayers = layers;
		}

		/// <summary>Each sub-object's stop, in the prefab's order, or null when it has none.</summary>
		private List<TransportStopData>? ReadTransportStops(Entity entity)
		{
			if (!EntityManager.TryGetBuffer<Game.Prefabs.SubObject>(entity, true, out var subObjects))
			{
				return null;
			}

			List<TransportStopData>? stops = null;

			for (var i = 0; i < subObjects.Length; i++)
			{
				if (EntityManager.TryGetComponent<TransportStopData>(subObjects[i].m_Prefab, out var stop))
				{
					(stops ??= new List<TransportStopData>()).Add(stop);
				}
			}

			return stops;
		}

		/// <summary>A network's auxiliary networks, and theirs in turn, as each one's cost for a
		/// cell and the share of it the owner pays.</summary>
		/// <remarks>PlaceableNetCostBinder's walk: each one is scaled by (1000 - 2z) / 1000 of its
		/// offset along the owner. The depth is capped only so a cycle cannot recurse forever.</remarks>
		private void CollectAuxiliaryNetCosts(Entity net, float share, ref List<(float Cost, float Share)>? into, int depth)
		{
			if (depth > 8 || !EntityManager.TryGetBuffer<AuxiliaryNet>(net, true, out var auxiliaryNets))
			{
				return;
			}

			for (var i = 0; i < auxiliaryNets.Length; i++)
			{
				var auxiliary = auxiliaryNets[i];
				var auxiliaryShare = share * ((1000f - auxiliary.m_Position.z * 2f) / 1000f);

				if (EntityManager.TryGetComponent<PlaceableNetData>(auxiliary.m_Prefab, out var auxiliaryData))
				{
					(into ??= new List<(float Cost, float Share)>()).Add((auxiliaryData.m_DefaultConstructionCost, auxiliaryShare));
				}

				CollectAuxiliaryNetCosts(auxiliary.m_Prefab, auxiliaryShare, ref into, depth + 1);
			}
		}

		/// <summary>What this building does for the city, phrased for a hover card.</summary>
		/// <remarks>Both buffers the game applies, with vanilla's own arithmetic in
		/// ModifierUIUtils.GetModifierDelta. m_Range.max is the figure vanilla binds.</remarks>
		private string[] GetBonuses(Entity entity)
		{
			var bonuses = new List<string>();

			if (EntityManager.TryGetBuffer<CityModifierData>(entity, true, out var cityModifiers))
			{
				for (var i = 0; i < cityModifiers.Length; i++)
				{
					var modifier = cityModifiers[i];

					// Vanilla hides this one from its own effect list, so a card
					// that showed it would be inventing an effect the game does
					// not acknowledge.
					if (modifier.m_Type == CityModifierType.CriminalMonitorProbability)
					{
						continue;
					}

					bonuses.Add(EffectWording.Describe(
						modifier.m_Type.ToString(),
						modifier.m_Mode,
						modifier.m_Range.max,
						EffectWording.IsPercent(modifier.m_Type, modifier.m_Mode)));
				}
			}

			if (EntityManager.TryGetBuffer<LocalModifierData>(entity, true, out var localModifiers))
			{
				for (var i = 0; i < localModifiers.Length; i++)
				{
					var modifier = localModifiers[i];

					bonuses.Add(EffectWording.Describe(
						modifier.m_Type.ToString(),
						modifier.m_Mode,
						modifier.m_Delta.max,
						EffectWording.IsPercent(modifier.m_Mode)));
				}
			}

			return bonuses.Where(b => !string.IsNullOrEmpty(b)).Distinct().ToArray();
		}

		/// <summary>The map feature an extractor building requires, or null when it is not one.
		/// PrefabUISystem.RequiredResourceBinder.GetExtractorType, transcribed: an upgrade defers to its
		/// building, whose manufactured resource must itself require a natural resource.</summary>
		private string? GetExtractorFeature(Entity entity)
		{
			var building = entity;
			if (EntityManager.TryGetBuffer<ServiceUpgradeBuilding>(entity, true, out var upgradeOf) && upgradeOf.Length >= 1)
			{
				building = upgradeOf[0].m_Building;
			}

			if (!EntityManager.TryGetComponent<PlaceholderBuildingData>(building, out var placeholder)
				|| placeholder.m_Type != BuildingType.ExtractorBuilding
				|| !EntityManager.TryGetComponent<BuildingPropertyData>(building, out var property)
				|| !EntityManager.TryGetBuffer<Game.Prefabs.SubArea>(entity, true, out var subAreas))
			{
				return null;
			}

			var resourcePrefab = _resourceSystem.GetPrefabs()[property.m_AllowedManufactured];
			if (!EntityManager.TryGetComponent<ResourceData>(resourcePrefab, out var resource) || !resource.m_RequireNaturalResource)
			{
				return null;
			}

			for (var i = 0; i < subAreas.Length; i++)
			{
				if (EntityManager.TryGetComponent<ExtractorAreaData>(subAreas[i].m_Prefab, out var extractor) && extractor.m_RequireNaturalResource)
				{
					return extractor.m_MapFeature.ToString();
				}
			}

			return null;
		}

		/// <summary>The upgrades a building supports, in the order vanilla offers them.</summary>
		/// <remarks>Two buffers, as UpgradeMenuUISystem reads them — BuildingUpgradeElement for service
		/// upgrades, BuildingModule for the modules signature towers take — filtered and ordered as it does.</remarks>
		private (string[] DisplayNames, string[] PrefabNames) GetSupportedUpgrades(Entity entity)
		{
			List<(int Priority, string Name, string PrefabName)>? found = null;

			if (EntityManager.TryGetBuffer<BuildingUpgradeElement>(entity, true, out var upgrades))
			{
				for (var i = 0; i < upgrades.Length; i++)
				{
					CollectUpgrade(upgrades[i].m_Upgrade, ref found);
				}
			}

			if (EntityManager.TryGetBuffer<BuildingModule>(entity, true, out var modules))
			{
				for (var i = 0; i < modules.Length; i++)
				{
					CollectUpgrade(modules[i].m_Module, ref found);
				}
			}

			if (found is null)
			{
				return (Array.Empty<string>(), Array.Empty<string>());
			}

			// OrderBy, not Sort: it is stable, so two upgrades sharing a priority
			// keep the order the game's own buffers hold them in.
			var ordered = found.OrderBy(entry => entry.Priority).ToArray();

			return (
				ordered.Select(entry => entry.Name).ToArray(),
				ordered.Select(entry => entry.PrefabName).ToArray());
		}

		private void CollectUpgrade(Entity upgrade, ref List<(int Priority, string Name, string PrefabName)>? found)
		{
			if (!EntityManager.TryGetComponent<UIObjectData>(upgrade, out var ui))
			{
				return;
			}

			if (!_prefabSystem.TryGetPrefab<PrefabBase>(upgrade, out var prefab) || prefab?.name is null)
			{
				return;
			}

			(found ??= new List<(int Priority, string Name, string PrefabName)>()).Add((ui.m_Priority, GetAssetName(prefab), prefab.name));
		}

		/// <summary>What the game's own toolbar filter row knows about a prefab.</summary>
		/// <remarks>Identity-free by design: WHICH requirement and pack entities an asset carries, never
		/// which themes or packs they are, so a theme or pack a mod ships needs no change here.</remarks>
		private VanillaAssetFacts GetVanillaAssetFacts(Entity entity)
		{
			var themeRequirements = new List<int>();

			if (EntityManager.TryGetBuffer<ObjectRequirementElement>(entity, true, out var requirements))
			{
				for (var i = 0; i < requirements.Length; i++)
				{
					var requirement = requirements[i].m_Requirement;

					if (EntityManager.HasComponent<ThemeData>(requirement))
					{
						themeRequirements.Add(requirement.Index);
					}
				}
			}

			var packs = new List<int>();
			var hasPackBuffer = EntityManager.TryGetBuffer<AssetPackElement>(entity, true, out var packElements);

			// IsModAsset, and the second half is easy to get backwards: an asset
			// carrying ModPrerequisiteData is NOT a mod asset when one of its packs
			// carries it too, so the pack filter governs it, not the Mods toggle.
			var isModAsset = EntityManager.HasComponent<ModPrerequisiteData>(entity);

			if (hasPackBuffer)
			{
				for (var i = 0; i < packElements.Length; i++)
				{
					var pack = packElements[i].m_Pack;
					packs.Add(pack.Index);

					if (isModAsset && EntityManager.HasComponent<ModPrerequisiteData>(pack))
					{
						isModAsset = false;
					}
				}
			}

			return new VanillaAssetFacts(themeRequirements, packs, hasPackBuffer, isModAsset);
		}

		/// <summary>How many cars the asset can park, counted rather than merely detected.</summary>
		/// <remarks>Exact for an object's own lanes: LaneSystem.CreateObjectLane sets FindConnections on
		/// every one, so the curve is never trimmed and the game's own arithmetic reproduces the count.</remarks>
		private int GetParkingSlots(PrefabBase prefab)
		{
			var slots = 0;

			// A garage parks cars inside rather than along marked lanes, so it has
			// no sub-lanes to divide up and declares its capacity outright.
			if (prefab.TryGet<ParkingFacility>(out var parkingFacility)
				&& parkingFacility.m_GarageMarkerCapacity > 0)
			{
				slots += parkingFacility.m_GarageMarkerCapacity;
			}
			else if (prefab.TryGet<SpawnLocation>(out var spawnLocation)
				&& spawnLocation.m_ConnectionType == RouteConnectionType.Parking)
			{
				// A parking connection with no declared capacity really is one
				// dedicated space — a driveway rather than a car park.
				slots++;
			}

			if (prefab.TryGet<ObjectSubLanes>(out var subLanes) && subLanes.m_SubLanes is not null)
			{
				foreach (var lane in subLanes.m_SubLanes)
				{
					if (lane?.m_LanePrefab is null
						|| !lane.m_LanePrefab.TryGet<ParkingLane>(out var parkingLane))
					{
						continue;
					}

					// A lane with no slot width is Virtual, and the game's own capacity sum
					// skips those: RoadsInfoviewUISystem drops VirtualLane before adding
					// slots, and a slot angle near zero would otherwise count bays.
					if (parkingLane.m_SlotSize.x < 0.001f)
					{
						continue;
					}

					var interval = GetParkingSlotInterval(parkingLane);

					if (interval > 0.001f)
					{
						// The +0.01 is the game's, not a fudge: GetParkingSlotCount
						// adds it before the divide, and dropping it loses a bay
						// whenever the length divides exactly.
						slots += (int)Math.Floor((MathUtils.Length(lane.m_BezierCurve) + 0.01f) / interval);
					}
				}
			}

			if (prefab.TryGet<ObjectSubObjects>(out var subObjects) && subObjects.m_SubObjects is not null)
			{
				foreach (var obj in subObjects.m_SubObjects)
				{
					if (obj.m_Object is not null)
					{
						slots += GetParkingSlots(obj.m_Object);
					}
				}
			}

			return slots;
		}

		/// <summary>The spacing between bays, derived the way the game bakes it.</summary>
		/// <remarks>NetInitializeSystem computes ParkingLaneData.m_SlotInterval from the managed slot
		/// size and angle; deriving it here keeps to the prefab graph the rest of the walk uses.</remarks>
		private static float GetParkingSlotInterval(ParkingLane parkingLane)
		{
			var angle = math.radians(math.clamp(parkingLane.m_SlotAngle, 0f, 90f));
			var slotSize = math.select(parkingLane.m_SlotSize, 0f, parkingLane.m_SlotSize < 0.001f);
			var y = new float2(math.cos(angle), math.sin(angle));

			if (y.y < 0.001f)
			{
				return slotSize.y;
			}

			if (y.x < 0.001f)
			{
				return slotSize.x;
			}

			var scaled = slotSize / new float2(y.y, y.x);
			scaled = math.select(scaled, 0f, scaled < 0.001f);

			return math.min(scaled.x, scaled.y);
		}
	}
}
