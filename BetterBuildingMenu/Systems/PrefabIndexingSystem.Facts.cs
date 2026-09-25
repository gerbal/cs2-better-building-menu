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
using System.Reflection;

using Unity.Collections;
using Unity.Entities;

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

			using var entities = query.ToEntityArray(Allocator.Temp);

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

		/// <summary>What this building does for the city, phrased for a hover card. See
		/// <see cref="EffectWording.Lines"/>.</summary>
		private string[] GetBonuses(Entity entity)
		{
			var city = EntityManager.TryGetBuffer<CityModifierData>(entity, true, out var cityModifiers)
				? cityModifiers.AsNativeArray().ToArray()
				: null;
			var local = EntityManager.TryGetBuffer<LocalModifierData>(entity, true, out var localModifiers)
				? localModifiers.AsNativeArray().ToArray()
				: null;

			return EffectWording.Lines(city, local);
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

		/// <summary>The upgrades a building supports, in the order vanilla offers them. See
		/// <see cref="SupportedUpgrades.InMenuOrder"/>.</summary>
		/// <remarks>Two buffers, as UpgradeMenuUISystem reads them: BuildingUpgradeElement for service
		/// upgrades, BuildingModule for the modules signature towers take.</remarks>
		private (string[] DisplayNames, string[] PrefabNames) GetSupportedUpgrades(Entity entity)
		{
			List<UpgradeOffer>? offers = null;

			if (EntityManager.TryGetBuffer<BuildingUpgradeElement>(entity, true, out var upgrades))
			{
				for (var i = 0; i < upgrades.Length; i++)
				{
					CollectUpgrade(upgrades[i].m_Upgrade, ref offers);
				}
			}

			if (EntityManager.TryGetBuffer<BuildingModule>(entity, true, out var modules))
			{
				for (var i = 0; i < modules.Length; i++)
				{
					CollectUpgrade(modules[i].m_Module, ref offers);
				}
			}

			return SupportedUpgrades.InMenuOrder(offers);
		}

		/// <summary>One upgrade, when it has the UIObject and the prefab a menu entry needs.</summary>
		private void CollectUpgrade(Entity upgrade, ref List<UpgradeOffer>? offers)
		{
			if (!EntityManager.TryGetComponent<UIObjectData>(upgrade, out var ui))
			{
				return;
			}

			if (!_prefabSystem.TryGetPrefab<PrefabBase>(upgrade, out var prefab) || prefab?.name is null)
			{
				return;
			}

			(offers ??= new List<UpgradeOffer>()).Add(new UpgradeOffer(ui.m_Priority, GetAssetName(prefab), prefab.name));
		}

		/// <summary>What the game's own toolbar filter row knows about a prefab. See
		/// <see cref="VanillaAssetFacts.From"/>.</summary>
		/// <remarks>Identity-free by design: WHICH requirement and pack entities an asset carries, never
		/// which themes or packs they are, so a theme or pack a mod ships needs no change here.</remarks>
		private VanillaAssetFacts GetVanillaAssetFacts(Entity entity)
		{
			var requirements = new List<(int Index, bool IsTheme)>();

			if (EntityManager.TryGetBuffer<ObjectRequirementElement>(entity, true, out var requirementElements))
			{
				for (var i = 0; i < requirementElements.Length; i++)
				{
					var requirement = requirementElements[i].m_Requirement;
					requirements.Add((requirement.Index, EntityManager.HasComponent<ThemeData>(requirement)));
				}
			}

			List<(int Index, bool HasModPrerequisite)>? packs = null;

			if (EntityManager.TryGetBuffer<AssetPackElement>(entity, true, out var packElements))
			{
				packs = new List<(int Index, bool HasModPrerequisite)>(packElements.Length);

				for (var i = 0; i < packElements.Length; i++)
				{
					var pack = packElements[i].m_Pack;
					packs.Add((pack.Index, EntityManager.HasComponent<ModPrerequisiteData>(pack)));
				}
			}

			return VanillaAssetFacts.From(requirements, packs, EntityManager.HasComponent<ModPrerequisiteData>(entity));
		}

		/// <summary>How many cars the asset can park, its sub-objects' included. See
		/// <see cref="ParkingSlots.Own"/>.</summary>
		private int GetParkingSlots(PrefabBase prefab)
		{
			var garageCapacity = prefab.TryGet<ParkingFacility>(out var parkingFacility)
				? parkingFacility.m_GarageMarkerCapacity
				: 0;
			var parkingSpawn = prefab.TryGet<SpawnLocation>(out var spawnLocation)
				&& spawnLocation.m_ConnectionType == RouteConnectionType.Parking;

			List<ParkingLaneShape>? lanes = null;

			if (prefab.TryGet<ObjectSubLanes>(out var subLanes) && subLanes.m_SubLanes is not null)
			{
				foreach (var lane in subLanes.m_SubLanes)
				{
					if (lane?.m_LanePrefab is not null && lane.m_LanePrefab.TryGet<ParkingLane>(out var parkingLane))
					{
						(lanes ??= new List<ParkingLaneShape>()).Add(
							new ParkingLaneShape(MathUtils.Length(lane.m_BezierCurve), parkingLane.m_SlotSize, parkingLane.m_SlotAngle));
					}
				}
			}

			var slots = ParkingSlots.Own(garageCapacity, parkingSpawn, (IEnumerable<ParkingLaneShape>?)lanes ?? Array.Empty<ParkingLaneShape>());

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
	}
}
