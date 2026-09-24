using Colossal.Core;
using Colossal.Entities;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.Mathematics;
using Colossal.PSI.Common;
using Colossal.Serialization.Entities;

using BetterBuildingMenu.Domain;
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
		/// <summary>Cells per kilometre, so a network's per-cell cost reads as a per-km one.</summary>
		/// <remarks>Vanilla's own factor: PrefabUISystem binds int2(cost, cost * 125) for
		/// PlaceableNetData, and the shipped UI renders it through VALUE_MONEY_PER_KILOMETER.</remarks>
		private const float NetCellsPerKilometre = 125f;

		private void PopulateAnalyticalData(Entity entity, PrefabIndex prefabIndex)
		{
			// A filter on work, not on correctness: a component that does not apply
			// to a category simply does not match. Networks, zones, trees and props
			// are all priced from components read below, so they belong here.
			if (prefabIndex.Category is not PrefabCategory.Buildings
				and not PrefabCategory.ServiceBuildings
				and not PrefabCategory.Networks
				and not PrefabCategory.Zones
				and not PrefabCategory.Trees
				and not PrefabCategory.Props)
			{
				return;
			}

			if (EntityManager.TryGetComponent<PlaceableObjectData>(entity, out var placeableData))
			{
				prefabIndex.ConstructionCost = placeableData.m_ConstructionCost;
				Fact(prefabIndex, "xpReward", placeableData.m_XPReward);
			}
			else if (!EntityManager.HasComponent<PlaceableNetData>(entity)
				&& EntityManager.TryGetComponent<ServiceUpgradeData>(entity, out var upgradeData))
			{
				// An annex — a BuildingExtensionPrefab carrying ServiceUpgrade — has no
				// PlaceableObjectData: ServiceUpgrade adds that only to a BuildingPrefab.
				// Its price lives here, which is where GenerateObjectsSystem falls back to.
				prefabIndex.ConstructionCost = upgradeData.m_UpgradeCost;
				Fact(prefabIndex, "xpReward", upgradeData.m_XPReward);
			}
			else if (EntityManager.TryGetComponent<PlaceableNetData>(entity, out var netData))
			{
				// A network prices by length: m_DefaultConstructionCost is the sum of its
				// composition pieces for ONE cell, so it is converted to the per-kilometre
				// figure the game itself shows and flagged as a rate.
				prefabIndex.ConstructionCost = (uint)Math.Round(netData.m_DefaultConstructionCost * NetCellsPerKilometre);
				prefabIndex.Upkeep = (int)Math.Round(netData.m_DefaultUpkeepCost * NetCellsPerKilometre);
				prefabIndex.CostIsPerDistance = true;

				// Speed is per network TYPE rather than on a shared component, so each
				// is asked in turn and the first that answers wins. Each holds metres
				// per second; the catalog states km/h — see SpeedLimit.
				if (EntityManager.TryGetComponent<RoadData>(entity, out var roadData))
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(roadData.m_SpeedLimit);
				}
				else if (EntityManager.TryGetComponent<TrackData>(entity, out var trackData))
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(trackData.m_SpeedLimit);
				}
				else if (EntityManager.TryGetComponent<PathwayData>(entity, out var pathwayData))
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(pathwayData.m_SpeedLimit);
				}
				else if (EntityManager.TryGetComponent<WaterwayData>(entity, out var waterwayData))
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(waterwayData.m_SpeedLimit);
				}
				else if (EntityManager.TryGetComponent<TaxiwayData>(entity, out var taxiwayData))
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(taxiwayData.m_SpeedLimit);
				}

				if (EntityManager.TryGetComponent<NetGeometryData>(entity, out var geometryData)
					&& geometryData.m_DefaultWidth > 0f)
				{
					prefabIndex.NetworkWidth = geometryData.m_DefaultWidth;
				}

				if (EntityManager.TryGetComponent<NetGeometryData>(entity, out var elevatedGeometry)
					&& elevatedGeometry.m_ElevatedWidth > 0f
					&& Math.Abs(elevatedGeometry.m_ElevatedWidth - elevatedGeometry.m_DefaultWidth) > 0.01f)
				{
					// Only when it DIFFERS from the ground width. Stating both when
					// they are the same number is a line that says nothing.
					Fact(prefabIndex, "elevatedWidth", elevatedGeometry.m_ElevatedWidth);
				}

				if (netData.m_UndergroundPrefab != Entity.Null)
				{
					TextFact(prefabIndex, "roadFeature", "underground");
				}

				if (EntityManager.TryGetComponent<TrackData>(entity, out var trackKind)
					&& trackKind.m_TrackType != Game.Net.TrackTypes.None)
				{
					TextFact(prefabIndex, "trackType", trackKind.m_TrackType.ToString());
				}

				// Road class, traffic lights and zoning live on the AUTHORING prefab
				// rather than on a component, so they need the PrefabBase back. They are
				// three of the facts a player chooses a road by.
				if (_prefabSystem.TryGetPrefab<PrefabBase>(entity, out var netPrefab))
				{
					if (netPrefab is RoadPrefab roadPrefab)
					{
						if (roadPrefab.m_TrafficLights)
						{
							TextFact(prefabIndex, "roadFeature", "trafficLights");
						}
						if (roadPrefab.m_HighwayRules)
						{
							TextFact(prefabIndex, "roadFeature", "highwayRules");
						}
						if (roadPrefab.m_ZoneBlock is not null)
						{
							TextFact(prefabIndex, "roadFeature", "zonesAlongside");
						}
					}

					if (netPrefab.TryGet<PlaceableNetPiece>(out var netPiece) && netPiece.m_ElevationCost > 0)
					{
						Fact(prefabIndex, "elevationCost", netPiece.m_ElevationCost * NetCellsPerKilometre);
					}
				}
			}

			if (EntityManager.TryGetComponent<ConsumptionData>(entity, out var consumptionData))
			{
				prefabIndex.Upkeep = consumptionData.m_Upkeep;
				prefabIndex.ElectricityConsumption = consumptionData.m_ElectricityConsumption;
				prefabIndex.WaterConsumption = consumptionData.m_WaterConsumption;
				prefabIndex.GarbageAccumulation = consumptionData.m_GarbageAccumulation;
				prefabIndex.TelecomNeed = consumptionData.m_TelecomNeed;
			}

			// The upkeep buffer is the game's own answer, and for a city service
			// building the only place the money lives. Money entries are the upkeep;
			// every other resource is a fact of its own, in kilograms a month.
			if (EntityManager.TryGetBuffer<ServiceUpkeepData>(entity, true, out var upkeepBuffer) && upkeepBuffer.Length > 0)
			{
				var stacks = new List<(string Resource, int Amount)>(upkeepBuffer.Length);
				for (var i = 0; i < upkeepBuffer.Length; i++)
				{
					stacks.Add((upkeepBuffer[i].m_Upkeep.m_Resource.ToString(), upkeepBuffer[i].m_Upkeep.m_Amount));
				}

				var summary = ServiceUpkeepSummary.Summarise(prefabIndex.Upkeep ?? 0, stacks);
				if (summary.Money > 0)
				{
					prefabIndex.Upkeep = summary.Money;
				}
				foreach (var (resource, amount) in summary.Resources)
				{
					Fact(prefabIndex, ServiceUpkeepSummary.ResourceFactPrefix + resource, amount);
				}
			}

			if (EntityManager.TryGetComponent<WorkplaceData>(entity, out var workplaceData))
			{
				prefabIndex.Workers = workplaceData.m_MaxWorkers;
				// The rest of the staffing picture. MaxWorkers says how many; these
				// say how few it can run on and when they are there.
				Fact(prefabIndex, "minCrew", workplaceData.m_MinimumWorkersLimit);
				// 0-1 probabilities, not percentages: FindJobSystem rolls
				// `chance < m_EveningShiftProbability`. Shown as a percent, so scaled here.
				Fact(prefabIndex, "eveningShift", workplaceData.m_EveningShiftProbability * 100d);
				Fact(prefabIndex, "nightShift", workplaceData.m_NightShiftProbability * 100d);
				Fact(prefabIndex, "workConditions", workplaceData.m_WorkConditions);
				// Who the building employs. The game has no player-facing word for
				// WorkplaceComplexity — its CITIZEN_JOB_LEVEL vocabulary does not map
				// onto Manual/Simple/Complex/Hitech — so these are OUR words.
				TextFact(prefabIndex, "jobComplexity", workplaceData.m_Complexity.ToString());
			}

			// Zero is not a household count, it is "not residential": every service
			// building carries this component too. Left null so the card drops the
			// line rather than telling a fire station it houses nobody.
			if (EntityManager.TryGetComponent<BuildingPropertyData>(entity, out var propertyData)
				&& propertyData.m_ResidentialProperties > 0)
			{
				prefabIndex.Households = propertyData.m_ResidentialProperties;
			}

			if (EntityManager.TryGetComponent<PollutionData>(entity, out var pollutionData))
			{
				prefabIndex.GroundPollution = pollutionData.m_GroundPollution;
				prefabIndex.AirPollution = pollutionData.m_AirPollution;
				prefabIndex.NoisePollution = pollutionData.m_NoisePollution;
			}

			// Doubles: a telecom facility's capacity is gigabits a second with a
			// decimal, which an int would truncate.
			var capacities = new List<double>();
			// Doubles as the Role facet source: these are exactly the service
			// components that make a building a school, a hospital, and so on.
			var roles = new List<string>();
			if (EntityManager.TryGetComponent<SchoolData>(entity, out var schoolData))
			{
				roles.Add("School");
				capacities.Add(schoolData.m_StudentCapacity);
				Fact(prefabIndex, "studentWellbeing", schoolData.m_StudentWellbeing);
				Fact(prefabIndex, "studentHealth", schoolData.m_StudentHealth);
				// The tier the school grants, so nothing downstream has to guess it
				// from the building's name.
				prefabIndex.EducationLevel = schoolData.m_EducationLevel;
				Fact(prefabIndex, "graduation", schoolData.m_GraduationModifier);
			}

			// What a park gives the city: a park and a bowling alley are both
			// "ParksAndRecreation". The efficiency gate is vanilla's own —
			// LeisureProvider adds the component only when m_Efficiency > 0.
			if (EntityManager.TryGetComponent<LeisureProviderData>(entity, out var leisureData)
				&& leisureData.m_Efficiency > 0)
			{
				prefabIndex.LeisureType = leisureData.m_LeisureType.ToString();
				prefabIndex.LeisureEfficiency = leisureData.m_Efficiency;
			}

			if (EntityManager.TryGetComponent<HospitalData>(entity, out var hospitalData))
			{
				roles.Add("Hospital");
				capacities.Add(hospitalData.m_PatientCapacity);
				Fact(prefabIndex, "ambulances", hospitalData.m_AmbulanceCapacity);
				Fact(prefabIndex, "helicopters", hospitalData.m_MedicalHelicopterCapacity);
			}

			// A zone's own figures, carried as service facts rather than as new
			// columns: they are per-cell rates on ONE family of asset, which is the
			// same shape the per-service figures have.
			if (EntityManager.TryGetComponent<ZoneServiceConsumptionData>(entity, out var zoneConsumption))
			{
				// Only the upkeep: PropertyRenterSystem.GetUpkeep reads it as
				// level^exp × upkeep × lotSize. The electricity, water, garbage and
				// telecom coefficients beside it have no reader anywhere in the game.
				Fact(prefabIndex, "zoneUpkeep", zoneConsumption.m_Upkeep);
			}

			if (EntityManager.TryGetComponent<ZonePropertiesData>(entity, out var zoneProperties))
			{
				// Residential only; the other families report none rather than a zero
				// that would read as "no homes here". With ScaleResidentials the figure
				// is apartments per cell, without it a fixed count — hence two keys.
				Fact(prefabIndex, zoneProperties.m_ScaleResidentials ? "zoneHouseholdsPerCell" : "zoneHouseholds",
					zoneProperties.m_ResidentialProperties);
				Fact(prefabIndex, "zoneSpace", zoneProperties.m_SpaceMultiplier);
				// ×1 is the absence of a modifier, as with the pollution modifiers.
				if (zoneProperties.m_FireHazardMultiplier != 1f)
				{
					Fact(prefabIndex, "zoneFireHazard", zoneProperties.m_FireHazardMultiplier);
				}
				if (zoneProperties.m_IgnoreLandValue)
				{
					TextFact(prefabIndex, "zoneFeature", "ignoresLandValue");
				}
			}

			// The zone figures that are words rather than numbers.
			if (EntityManager.TryGetComponent<ZonePropertiesData>(entity, out var zoneResources))
			{
				TextFact(prefabIndex, "zoneSold", ResourceName(zoneResources.m_AllowedSold));
				TextFact(prefabIndex, "zoneManufactured", ResourceName(zoneResources.m_AllowedManufactured));
				TextFact(prefabIndex, "zoneStored", ResourceName(zoneResources.m_AllowedStored));
			}

			// The shapes the zone grows, for the glyphs the card already knows how
			// to draw. Computed once by IndexZones and cached, because it needs
			// every spawnable building's lot and this pass sees one prefab.
			if (prefabIndex.Category == Domain.Enums.PrefabCategory.Zones
				&& GetZoneLotSizes(entity) is ZoneLotSizes lots
				&& lots.Footprints is { Length: > 0 })
			{
				prefabIndex.Footprints = lots.Footprints;
				prefabIndex.FootprintOverflow = lots.FootprintOverflow;
			}

			if (EntityManager.TryGetComponent<ZoneData>(entity, out var zoneHeights))
			{
				// What the zone actually grows to, measured by the game from the
				// tallest mesh it can spawn and never shown by it.
				Fact(prefabIndex, "zoneMaxHeight", zoneHeights.m_MaxHeight);

				// Stated only when true: "does not support corners" is noise on
				// the majority of zones that do not.
				if ((zoneHeights.m_ZoneFlags & ZoneFlags.SupportNarrow) != 0)
				{
					TextFact(prefabIndex, "zoneLotShapes", "narrow");
				}

				if ((zoneHeights.m_ZoneFlags
					& (ZoneFlags.SupportLeftCorner | ZoneFlags.SupportRightCorner)) != 0)
				{
					TextFact(prefabIndex, "zoneLotShapes", "corners");
				}
			}

			// Tourism, and one of the few figures that matters across services
			// rather than inside one — a park, a landmark and a signature
			// building all trade on it.
			if (EntityManager.TryGetComponent<AttractionData>(entity, out var attractionData))
			{
				Fact(prefabIndex, "attractiveness", attractionData.m_Attractiveness);
			}

			if (EntityManager.TryGetComponent<CoverageData>(entity, out var coverageData)
				&& coverageData.m_Range > 0f)
			{
				prefabIndex.ServiceRange = coverageData.m_Range;
			}

			// The figure a mailbox is FOR, and the one vanilla reads for it:
			// Properties.MAIL_BOX_CAPACITY, an integer.
			if (EntityManager.TryGetComponent<MailBoxData>(entity, out var mailBox))
			{
				Fact(prefabIndex, "mailboxCapacity", mailBox.m_MailCapacity);
			}

			// RequiredResourceBinder's rule, transcribed: an extractor building whose
			// product needs a natural resource names the map feature of its extractor
			// area. The water half of that binder is already the waterSource fact.
			var requiredFeature = GetExtractorFeature(entity);
			if (requiredFeature is not null)
			{
				TextFact(prefabIndex, "requiredResource", requiredFeature);
			}

			if (EntityManager.TryGetComponent<PostFacilityData>(entity, out var postFacilityData))
			{
				roles.Add("PostFacility");
				// Mail held, not vans or sorting rate: the vans are how it works
				// and the rate is per unit time, while this is the size of the
				// thing — the same question capacity answers everywhere else.
				capacities.Add(postFacilityData.m_MailCapacity);
				Fact(prefabIndex, "postTrucks", postFacilityData.m_PostTruckCapacity);
				Fact(prefabIndex, "sortingRate", postFacilityData.m_SortingRate);
				Fact(prefabIndex, "postVans", postFacilityData.m_PostVanCapacity);
			}

			if (EntityManager.TryGetComponent<TelecomFacilityData>(entity, out var telecomFacilityData))
			{
				roles.Add("TelecomFacility");
				capacities.Add(telecomFacilityData.m_NetworkCapacity);
				// Telecom keeps its own range rather than using CoverageData's,
				// so it is read here and not above.
				if (telecomFacilityData.m_Range > 0f)
				{
					prefabIndex.ServiceRange = telecomFacilityData.m_Range;
				}
				if (telecomFacilityData.m_PenetrateTerrain)
				{
					TextFact(prefabIndex, "facilityFeature", "signalThroughTerrain");
				}
			}

			if (EntityManager.TryGetComponent<GarbageFacilityData>(entity, out var garbageFacilityData))
			{
				roles.Add("GarbageFacility");
				capacities.Add(garbageFacilityData.m_GarbageCapacity);
				// Its own key: kilograms a month, not the deathcare rate's bodies.
				Fact(prefabIndex, "garbageProcessing", garbageFacilityData.m_ProcessingSpeed);
				// m_VehicleCapacity, not m_TransportCapacity: the first is the garbage
				// trucks (GARBAGE_TRUCK_COUNT in vanilla's tooltip), the second the
				// delivery trucks that haul processed waste out.
				Fact(prefabIndex, "collectionTrucks", garbageFacilityData.m_VehicleCapacity);
				if (garbageFacilityData.m_IndustrialWasteOnly)
				{
					TextFact(prefabIndex, "facilityFeature", "industrialWasteOnly");
				}
			}

			if (EntityManager.TryGetComponent<FireStationData>(entity, out var fireStationData))
			{
				roles.Add("FireStation");
				capacities.Add(fireStationData.m_FireEngineCapacity);
				Fact(prefabIndex, "helicopters", fireStationData.m_FireHelicopterCapacity);
				Fact(prefabIndex, "disasterResponse", fireStationData.m_DisasterResponseCapacity);
			}

			if (EntityManager.TryGetComponent<PoliceStationData>(entity, out var policeStationData))
			{
				roles.Add("PoliceStation");
				capacities.Add(policeStationData.m_PatrolCarCapacity);
				Fact(prefabIndex, "jailCapacity", policeStationData.m_JailCapacity);
				Fact(prefabIndex, "helicopters", policeStationData.m_PoliceHelicopterCapacity);
			}

			if (EntityManager.TryGetComponent<PrisonData>(entity, out var prisonData))
			{
				roles.Add("Prison");
				capacities.Add(prisonData.m_PrisonerCapacity);
				Fact(prefabIndex, "prisonVans", prisonData.m_PrisonVanCapacity);
				Fact(prefabIndex, "prisonerWellbeing", prisonData.m_PrisonerWellbeing);
				Fact(prefabIndex, "prisonerHealth", prisonData.m_PrisonerHealth);
			}

			if (EntityManager.TryGetComponent<DeathcareFacilityData>(entity, out var deathcareFacilityData))
			{
				roles.Add("DeathcareFacility");
				capacities.Add(deathcareFacilityData.m_StorageCapacity);
				Fact(prefabIndex, "hearses", deathcareFacilityData.m_HearseCapacity);
				Fact(prefabIndex, "processingRate", deathcareFacilityData.m_ProcessingRate);
				if (deathcareFacilityData.m_LongTermStorage)
				{
					TextFact(prefabIndex, "facilityFeature", "longTermStorage");
				}
			}

			if (EntityManager.TryGetComponent<EmergencyShelterData>(entity, out var emergencyShelterData))
			{
				roles.Add("EmergencyShelter");
				capacities.Add(emergencyShelterData.m_ShelterCapacity);
				Fact(prefabIndex, "shelterVehicles", emergencyShelterData.m_VehicleCapacity);
			}

			if (EntityManager.TryGetComponent<WaterPumpingStationData>(entity, out var waterPumpingStationData))
			{
				roles.Add("WaterPumpingStation");
				prefabIndex.WaterCapacity = waterPumpingStationData.m_Capacity;
				capacities.Add(waterPumpingStationData.m_Capacity);
				Fact(prefabIndex, "purification", Percent.FromFraction(waterPumpingStationData.m_Purification));
				// Vanilla's wording and vanilla's silence: a tower allows no type
				// and says nothing, where the raw enum read "Draws from None".
				TextFact(prefabIndex, "waterSource", Domain.WaterSource.Describe(
					(waterPumpingStationData.m_Types & AllowedWaterTypes.Groundwater) != 0,
					(waterPumpingStationData.m_Types & AllowedWaterTypes.SurfaceWater) != 0));
			}

			if (EntityManager.TryGetComponent<SewageOutletData>(entity, out var sewageOutletData))
			{
				roles.Add("SewageOutlet");
				prefabIndex.SewageCapacity = sewageOutletData.m_Capacity;
				capacities.Add(sewageOutletData.m_Capacity);
				Fact(prefabIndex, "purification", Percent.FromFraction(sewageOutletData.m_Purification));
			}

			// Power plants report output as production rather than capacity, so
			// without this a coal plant has no capacity to forecast the city's
			// demand against. Solar is a separate component with its own field.
			if (EntityManager.TryGetComponent<PowerPlantData>(entity, out var powerPlantData))
			{
				roles.Add("PowerPlant");
				capacities.Add(powerPlantData.m_ElectricityProduction);
			}

			if (EntityManager.TryGetComponent<SolarPoweredData>(entity, out var solarData))
			{
				roles.Add("PowerPlant");
				capacities.Add(solarData.m_Production);
			}

			// Wind is a third component again, with its own production field.
			if (EntityManager.TryGetComponent<WindPoweredData>(entity, out var windData))
			{
				roles.Add("PowerPlant");
				capacities.Add(windData.m_Production);
			}

			// Each of these is the figure its building is FOR.
			if (EntityManager.TryGetComponent<BatteryData>(entity, out var batteryData))
			{
				roles.Add("Battery");
				capacities.Add(batteryData.m_Capacity);
				Fact(prefabIndex, "batteryOutput", batteryData.m_PowerOutput);
			}

			if (EntityManager.TryGetComponent<ParkData>(entity, out var parkData))
			{
				Fact(prefabIndex, "maintenancePool", parkData.m_MaintenancePool);
			}

			if (EntityManager.TryGetComponent<TransportDepotData>(entity, out var transportDepotData))
			{
				TextFact(prefabIndex, "transportType", transportDepotData.m_TransportType.ToString());
				Fact(prefabIndex, "depotVehicles", transportDepotData.m_VehicleCapacity);
			}

			if (EntityManager.TryGetComponent<MaintenanceDepotData>(entity, out var maintenanceDepotData))
			{
				Fact(prefabIndex, "maintenanceVehicles", maintenanceDepotData.m_VehicleCapacity);
			}

			// The two properties vanilla authors only on service upgrades. Both are
			// read exactly as PrefabUISystem binds them: multipliers as whole
			// percentages, the upkeep change as the largest multiplier minus one.
			if (EntityManager.TryGetComponent<PollutionModifierData>(entity, out var pollutionModifier))
			{
				// A multiplier of one changes nothing and "100 %" would say so at
				// length; only the factors that move a level are facts.
				PollutionModifierFact(prefabIndex, "groundPollutionModifier", pollutionModifier.m_GroundPollutionMultiplier);
				PollutionModifierFact(prefabIndex, "airPollutionModifier", pollutionModifier.m_AirPollutionMultiplier);
				PollutionModifierFact(prefabIndex, "noisePollutionModifier", pollutionModifier.m_NoisePollutionMultiplier);
			}

			if (EntityManager.TryGetBuffer<UpkeepModifierData>(entity, true, out var upkeepModifiers) && upkeepModifiers.Length > 0)
			{
				var largest = 1f;
				var changes = false;

				for (var i = 0; i < upkeepModifiers.Length; i++)
				{
					if (upkeepModifiers[i].m_Multiplier != 1f)
					{
						changes = true;
						largest = Math.Max(largest, upkeepModifiers[i].m_Multiplier);
					}
				}

				if (changes)
				{
					// Not through Fact: that helper drops anything at or below zero,
					// and a saving — the usual case for this modifier — is negative.
					prefabIndex.ServiceFacts.Add(new Domain.ServiceFact("upkeepChange", Math.Round(100d * (largest - 1d))));
				}
			}

			if (EntityManager.TryGetComponent<TransportStationData>(entity, out var transportStationData))
			{
				Fact(prefabIndex, "comfort", Percent.FromFraction(transportStationData.m_ComfortFactor));
			}

			// What vanilla's tooltip calls Cargo capacity: StorageLimitData on a
			// cargo station, and on the warehouse upgrade that adds to it.
			// Kilograms; the UI follows the game's own weight rule.
			if (EntityManager.TryGetComponent<StorageLimitData>(entity, out var storageLimit)
				&& storageLimit.m_Limit > 0)
			{
				Fact(prefabIndex, "cargoCapacity", storageLimit.m_Limit);
			}

			if (EntityManager.TryGetComponent<ElectricityConnectionData>(entity, out var electricityConnection)
				&& electricityConnection.m_Capacity > 0
				&& !EntityManager.HasComponent<RoadData>(entity))
			{
				Fact(prefabIndex, "electricityCapacity", electricityConnection.m_Capacity);
				TextFact(prefabIndex, "voltage", electricityConnection.m_Voltage.ToString());
			}

			if (EntityManager.TryGetComponent<WaterPipeConnectionData>(entity, out var pipeConnection)
				&& pipeConnection.m_StormCapacity > 0)
			{
				Fact(prefabIndex, "stormCapacity", pipeConnection.m_StormCapacity);
			}

			if (EntityManager.TryGetComponent<WastewaterTreatmentPlantData>(entity, out var wastewaterData))
			{
				roles.Add("WastewaterTreatmentPlant");
				prefabIndex.SewageCapacity = wastewaterData.m_Capacity;
				capacities.Add(wastewaterData.m_Capacity);
			}

			prefabIndex.BuildingTypeName = BuildingRole.ResolvePrimary(roles);

			if (capacities.Count > 0)
			{
				prefabIndex.Capacity = capacities.Max();
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

					bonuses.Add(DescribeModifier(
						modifier.m_Type.ToString(),
						modifier.m_Mode,
						modifier.m_Range.max));
				}
			}

			if (EntityManager.TryGetBuffer<LocalModifierData>(entity, true, out var localModifiers))
			{
				for (var i = 0; i < localModifiers.Length; i++)
				{
					var modifier = localModifiers[i];

					bonuses.Add(DescribeModifier(
						modifier.m_Type.ToString(),
						modifier.m_Mode,
						modifier.m_Delta.max));
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

		/// <summary>One effect, signed, with the unit its mode implies.</summary>
		private static string DescribeModifier(string type, ModifierValueMode mode, float value)
		{
			// ModifierUIUtils.GetModifierDelta, transcribed: a relative mode is a
			// fraction and reads as a percentage; absolute is already the number.
			var scaled = mode switch
			{
				ModifierValueMode.Relative => 100f * value,
				ModifierValueMode.InverseRelative => 100f * (1f / Math.Max(0.001f, 1f + value) - 1f),
				_ => value,
			};

			if (Math.Abs(scaled) < 0.005f)
			{
				return string.Empty;
			}

			var unit = mode == ModifierValueMode.Absolute ? string.Empty : "%";
			// The sign is the point — a modifier can make something worse, and an
			// unsigned number would read as a benefit either way.
			var sign = scaled > 0 ? "+" : string.Empty;

			return $"{type.FormatWords()} {sign}{scaled:0.##}{unit}";
		}

		/// <summary>Records one service figure, dropping the zeros.</summary>
		/// <remarks>A zero means "this building has none of that", and a card that has already dropped
		/// every field that does not apply has no use for the line.</remarks>
		private static void Fact(PrefabIndex prefabIndex, string key, double value)
		{
			if (value > 0d)
			{
				prefabIndex.ServiceFacts.Add(new Domain.ServiceFact(key, value));
			}
		}

		/// <summary>A pollution multiplier as the whole percentage vanilla shows, unless it is one.</summary>
		private static void PollutionModifierFact(PrefabIndex prefabIndex, string key, float multiplier)
		{
			if (Math.Abs(multiplier - 1f) > 0.0005f)
			{
				Fact(prefabIndex, key, Math.Round(multiplier * 100d));
			}
		}

		/// <summary>Records one worded figure, dropping the blanks.</summary>
		private static void TextFact(PrefabIndex prefabIndex, string key, string? value)
		{
			if (value?.Trim() is { Length: > 0 } trimmed)
			{
				prefabIndex.ServiceTextFacts.Add(new Domain.ServiceTextFact(key, trimmed));
			}
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
