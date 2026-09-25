using BetterBuildingMenu.Domain.Enums;

using Game.Prefabs;

using System;
using System.Collections.Generic;
using System.Linq;

using Unity.Mathematics;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The per-prefab facts an entry carries: costs, service figures and the rest, mapped from
	/// what <see cref="PrefabSnapshot"/> holds.
	/// </summary>
	/// <remarks>
	/// The indexer fills the snapshot and this only maps it, so a test can build one by hand.
	/// See docs/indexing.md, "Per-prefab facts".
	/// </remarks>
	public static class PrefabFacts
	{
		/// <summary>Cells per kilometre, so a network's per-cell cost reads as a per-km one.</summary>
		/// <remarks>Vanilla's own factor: PrefabUISystem binds int2(cost, cost * 125) for
		/// PlaceableNetData, and the shipped UI renders it through VALUE_MONEY_PER_KILOMETER.</remarks>
		internal const float NetCellsPerKilometre = 125f;

		/// <summary>Whether a category's prefabs carry facts, so the indexer can skip reading the
		/// rest.</summary>
		/// <remarks>A filter on work, not on correctness: a component that does not apply to a
		/// category simply does not match. Networks, zones, trees and props are all priced from
		/// components, so they belong here.</remarks>
		public static bool AppliesTo(PrefabCategory category) =>
			category is PrefabCategory.Buildings
				or PrefabCategory.ServiceBuildings
				or PrefabCategory.Networks
				or PrefabCategory.Zones
				or PrefabCategory.Trees
				or PrefabCategory.Props;

		/// <summary>Sets an entry's figures and adds its facts from what its prefab holds.</summary>
		public static void Apply(PrefabSnapshot snapshot, PrefabIndex prefabIndex)
		{
			if (snapshot.PlaceableObjectData is { } placeableData)
			{
				prefabIndex.ConstructionCost = placeableData.m_ConstructionCost;
				Fact(prefabIndex, "xpReward", placeableData.m_XPReward);
			}
			else if (!snapshot.PlaceableNetData.HasValue
				&& snapshot.ServiceUpgradeData is { } upgradeData)
			{
				// An annex — a BuildingExtensionPrefab carrying ServiceUpgrade — has no
				// PlaceableObjectData: ServiceUpgrade adds that only to a BuildingPrefab.
				// Its price lives here, which is where GenerateObjectsSystem falls back to.
				prefabIndex.ConstructionCost = upgradeData.m_UpgradeCost;
				Fact(prefabIndex, "xpReward", upgradeData.m_XPReward);
			}
			else if (snapshot.PlaceableNetData is { } netData)
			{
				// A network prices by length: m_DefaultConstructionCost is the sum of its
				// composition pieces for ONE cell, so it is converted to the per-kilometre
				// figure the game itself shows and flagged as a rate.
				prefabIndex.ConstructionCost = (uint)Math.Round(netData.m_DefaultConstructionCost * NetCellsPerKilometre);
				// Rounded after the per-kilometre product, which is what NetUtils.GetUpkeepCost
				// charges, where vanilla's tooltip rounds the per-cell figure first. Its silence
				// on none is kept: a road with no upkeep has no upkeep line.
				var netUpkeep = (int)Math.Round(netData.m_DefaultUpkeepCost * NetCellsPerKilometre);
				prefabIndex.Upkeep = netUpkeep != 0 ? netUpkeep : null;
				prefabIndex.CostIsPerDistance = true;

				// Speed is per network TYPE rather than on a shared component, so each
				// is asked in turn and the first that answers wins. Each holds metres
				// per second; the catalog states km/h — see SpeedLimit.
				if (snapshot.RoadData is { } roadData)
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(roadData.m_SpeedLimit);
				}
				else if (snapshot.TrackData is { } trackData)
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(trackData.m_SpeedLimit);
				}
				else if (snapshot.PathwayData is { } pathwayData)
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(pathwayData.m_SpeedLimit);
				}
				else if (snapshot.WaterwayData is { } waterwayData)
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(waterwayData.m_SpeedLimit);
				}
				else if (snapshot.TaxiwayData is { } taxiwayData)
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(taxiwayData.m_SpeedLimit);
				}

				if (snapshot.NetGeometryData is { } geometryData
					&& geometryData.m_DefaultWidth > 0f)
				{
					prefabIndex.NetworkWidth = geometryData.m_DefaultWidth;
				}

				if (snapshot.NetGeometryData is { } elevatedGeometry
					&& elevatedGeometry.m_ElevatedWidth > 0f
					&& Math.Abs(elevatedGeometry.m_ElevatedWidth - elevatedGeometry.m_DefaultWidth) > 0.01f)
				{
					// Only when it DIFFERS from the ground width. Stating both when
					// they are the same number is a line that says nothing.
					Fact(prefabIndex, "elevatedWidth", elevatedGeometry.m_ElevatedWidth);
				}

				if (snapshot.HasUndergroundVariant)
				{
					TextFact(prefabIndex, "roadFeature", "underground");
				}

				if (snapshot.TrackData is { } trackKind
					&& trackKind.m_TrackType != Game.Net.TrackTypes.None)
				{
					TextFact(prefabIndex, "trackType", trackKind.m_TrackType.ToString());
				}

				// Road class, traffic lights and zoning live on the AUTHORING prefab
				// rather than on a component. They are three of the facts a player
				// chooses a road by.
				if (snapshot.TrafficLights)
				{
					TextFact(prefabIndex, "roadFeature", "trafficLights");
				}
				if (snapshot.HighwayRules)
				{
					TextFact(prefabIndex, "roadFeature", "highwayRules");
				}
				if (snapshot.ZonesAlongside)
				{
					TextFact(prefabIndex, "roadFeature", "zonesAlongside");
				}
			}

			if (snapshot.ConsumptionData is { } consumptionData)
			{
				// Not its m_Upkeep: BuildingInitializeSystem copies a city-paid figure into the
				// upkeep buffer below, and what stays here alone, on a zoned or signature
				// building, is PropertyRenterSystem's rent-side upkeep, which the city never pays.
				prefabIndex.ElectricityConsumption = consumptionData.m_ElectricityConsumption;
				prefabIndex.WaterConsumption = consumptionData.m_WaterConsumption;
				prefabIndex.GarbageAccumulation = consumptionData.m_GarbageAccumulation;
				prefabIndex.TelecomNeed = consumptionData.m_TelecomNeed;
			}

			// The upkeep buffer is the game's own answer, and UpkeepPropertyBinderSystem shows an
			// upkeep line for every prefab with one and for no other. Money entries are the
			// upkeep; every other resource is a fact of its own, in kilograms a month.
			if (snapshot.ServiceUpkeep is { } stacks)
			{
				var summary = ServiceUpkeepSummary.Summarise(stacks);
				prefabIndex.Upkeep = summary.Money;
				foreach (var (resource, amount) in summary.Resources)
				{
					Fact(prefabIndex, ServiceUpkeepSummary.ResourceFactPrefix + resource, amount);
				}
			}

			if (snapshot.WorkplaceData is { } workplaceData)
			{
				prefabIndex.Workers = workplaceData.m_MaxWorkers;
				// The rest of the staffing picture. MaxWorkers says how many; these
				// say how few it can run on and when they are there.
				Fact(prefabIndex, "minCrew", workplaceData.m_MinimumWorkersLimit);
				// 0-1 probabilities, not percentages: FindJobSystem rolls
				// `chance < m_EveningShiftProbability`. Shown as a percent, so scaled here.
				Fact(prefabIndex, "eveningShift", workplaceData.m_EveningShiftProbability * 100d);
				Fact(prefabIndex, "nightShift", workplaceData.m_NightShiftProbability * 100d);
				// An offset to employee happiness, so a penalty is a figure too.
				SignedFact(prefabIndex, "workConditions", workplaceData.m_WorkConditions);
				// Who the building employs. The game has no player-facing word for
				// WorkplaceComplexity — its CITIZEN_JOB_LEVEL vocabulary does not map
				// onto Manual/Simple/Complex/Hitech — so these are OUR words.
				TextFact(prefabIndex, "jobComplexity", workplaceData.m_Complexity.ToString());
			}

			// Zero is not a household count, it is "not residential": every service
			// building carries this component too. Left null so the card drops the
			// line rather than telling a fire station it houses nobody.
			if (snapshot.BuildingPropertyData is { } propertyData
				&& propertyData.m_ResidentialProperties > 0)
			{
				prefabIndex.Households = propertyData.m_ResidentialProperties;
			}

			if (snapshot.PollutionData is { } pollutionData)
			{
				prefabIndex.GroundPollution = pollutionData.m_GroundPollution;
				prefabIndex.AirPollution = pollutionData.m_AirPollution;
				prefabIndex.NoisePollution = pollutionData.m_NoisePollution;
			}

			// The Role facet's source: these are exactly the service components that make a
			// building a school, a hospital, and so on.
			var roles = new List<string>();
			// Each role's own figure, in its own unit, and the entry keeps its primary role's:
			// the UI formats Capacity by that role. Doubles: a telecom facility's capacity is
			// gigabits a second with a decimal, which an int would truncate.
			var capacityOf = new Dictionary<string, double>(StringComparer.Ordinal);
			void Role(string role, double capacity)
			{
				roles.Add(role);
				capacityOf[role] = capacity;
			}

			if (snapshot.SchoolData is { } schoolData)
			{
				Role("School", schoolData.m_StudentCapacity);
				// Offsets SchoolAISystem adds to a student's wellbeing and health, so a
				// penalty is a figure too.
				SignedFact(prefabIndex, "studentWellbeing", schoolData.m_StudentWellbeing);
				SignedFact(prefabIndex, "studentHealth", schoolData.m_StudentHealth);
				// The tier the school grants, so nothing downstream has to guess it
				// from the building's name.
				prefabIndex.EducationLevel = schoolData.m_EducationLevel;
				// Added to the graduation probability, not multiplied into it:
				// GraduationSystem ends on `+ graduationModifier`, so 0.05 is five points.
				SignedFact(prefabIndex, "graduation", Percent.FromFraction(schoolData.m_GraduationModifier));
			}

			// What a park gives the city: a park and a bowling alley are both
			// "ParksAndRecreation". The efficiency gate is vanilla's own —
			// LeisureProvider adds the component only when m_Efficiency > 0.
			if (snapshot.LeisureProviderData is { } leisureData
				&& leisureData.m_Efficiency > 0)
			{
				prefabIndex.LeisureType = leisureData.m_LeisureType.ToString();
				prefabIndex.LeisureEfficiency = leisureData.m_Efficiency;
			}

			if (snapshot.HospitalData is { } hospitalData)
			{
				Role("Hospital", hospitalData.m_PatientCapacity);
				Fact(prefabIndex, "ambulances", hospitalData.m_AmbulanceCapacity);
				Fact(prefabIndex, "helicopters", hospitalData.m_MedicalHelicopterCapacity);
			}

			// A zone's own figures, carried as service facts rather than as new
			// columns: they are per-cell rates on ONE family of asset, which is the
			// same shape the per-service figures have.
			if (snapshot.ZoneServiceConsumptionData is { } zoneConsumption)
			{
				// Only the upkeep: PropertyRenterSystem.GetUpkeep reads it as
				// level^exp × upkeep × lotSize. The electricity, water, garbage and
				// telecom coefficients beside it have no reader anywhere in the game.
				Fact(prefabIndex, "zoneUpkeep", zoneConsumption.m_Upkeep);
			}

			if (snapshot.ZonePropertiesData is { } zoneProperties)
			{
				// Residential only; the other families report none rather than a zero
				// that would read as "no homes here". With ScaleResidentials the figure
				// is apartments per cell, without it a fixed count — hence two keys.
				Fact(prefabIndex, zoneProperties.m_ScaleResidentials ? "zoneHouseholdsPerCell" : "zoneHouseholds",
					zoneProperties.m_ResidentialProperties);
				Fact(prefabIndex, "zoneSpace", zoneProperties.m_SpaceMultiplier);
				// ×1 is the absence of a modifier.
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
			if (snapshot.ZonePropertiesData is { } zoneResources)
			{
				TextFact(prefabIndex, "zoneSold", ResourceName(zoneResources.m_AllowedSold));
				TextFact(prefabIndex, "zoneManufactured", ResourceName(zoneResources.m_AllowedManufactured));
				TextFact(prefabIndex, "zoneStored", ResourceName(zoneResources.m_AllowedStored));
			}

			// The shapes the zone grows, for the glyphs the card already knows how
			// to draw. Computed once by IndexZones and kept in the index, because it
			// needs every spawnable building's lot and this pass sees one prefab.
			if (prefabIndex.Category == PrefabCategory.Zones
				&& snapshot.LotSizes is ZoneLotSizes lots
				&& lots.Footprints is { Length: > 0 })
			{
				prefabIndex.Footprints = lots.Footprints;
				prefabIndex.FootprintOverflow = lots.FootprintOverflow;
			}

			if (snapshot.ZoneData is { } zoneHeights)
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
			if (snapshot.AttractionData is { } attractionData)
			{
				Fact(prefabIndex, "attractiveness", attractionData.m_Attractiveness);
			}

			if (snapshot.CoverageData is { } coverageData
				&& coverageData.m_Range > 0f)
			{
				prefabIndex.ServiceRange = coverageData.m_Range;
			}

			// The figure a mailbox is FOR, and the one vanilla reads for it:
			// Properties.MAIL_BOX_CAPACITY, an integer.
			if (snapshot.MailBoxData is { } mailBox)
			{
				Fact(prefabIndex, "mailboxCapacity", mailBox.m_MailCapacity);
			}

			// RequiredResourceBinder's rule, transcribed: an extractor building whose
			// product needs a natural resource names the map feature of its extractor
			// area. The water half of that binder is already the waterSource fact.
			var requiredFeature = snapshot.RequiredResource;
			if (requiredFeature is not null)
			{
				TextFact(prefabIndex, "requiredResource", requiredFeature);
			}

			if (snapshot.PostFacilityData is { } postFacilityData)
			{
				// Mail held, not vans or sorting rate: the vans are how it works
				// and the rate is per unit time, while this is the size of the
				// thing — the same question capacity answers everywhere else.
				Role("PostFacility", postFacilityData.m_MailCapacity);
				Fact(prefabIndex, "postTrucks", postFacilityData.m_PostTruckCapacity);
				Fact(prefabIndex, "sortingRate", postFacilityData.m_SortingRate);
				Fact(prefabIndex, "postVans", postFacilityData.m_PostVanCapacity);
			}

			if (snapshot.TelecomFacilityData is { } telecomFacilityData)
			{
				Role("TelecomFacility", telecomFacilityData.m_NetworkCapacity);
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

			if (snapshot.GarbageFacilityData is { } garbageFacilityData)
			{
				Role("GarbageFacility", garbageFacilityData.m_GarbageCapacity);
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

			if (snapshot.FireStationData is { } fireStationData)
			{
				Role("FireStation", fireStationData.m_FireEngineCapacity);
				Fact(prefabIndex, "helicopters", fireStationData.m_FireHelicopterCapacity);
				Fact(prefabIndex, "disasterResponse", fireStationData.m_DisasterResponseCapacity);
			}

			if (snapshot.PoliceStationData is { } policeStationData)
			{
				Role("PoliceStation", policeStationData.m_PatrolCarCapacity);
				Fact(prefabIndex, "jailCapacity", policeStationData.m_JailCapacity);
				Fact(prefabIndex, "helicopters", policeStationData.m_PoliceHelicopterCapacity);
			}

			if (snapshot.PrisonData is { } prisonData)
			{
				Role("Prison", prisonData.m_PrisonerCapacity);
				Fact(prefabIndex, "prisonVans", prisonData.m_PrisonVanCapacity);
				SignedFact(prefabIndex, "prisonerWellbeing", prisonData.m_PrisonerWellbeing);
				SignedFact(prefabIndex, "prisonerHealth", prisonData.m_PrisonerHealth);
			}

			if (snapshot.DeathcareFacilityData is { } deathcareFacilityData)
			{
				Role("DeathcareFacility", deathcareFacilityData.m_StorageCapacity);
				Fact(prefabIndex, "hearses", deathcareFacilityData.m_HearseCapacity);
				// Rounded up, as vanilla's DECEASED_PROCESSING_CAPACITY binds it.
				Fact(prefabIndex, "processingRate", Math.Ceiling(deathcareFacilityData.m_ProcessingRate));
				if (deathcareFacilityData.m_LongTermStorage)
				{
					TextFact(prefabIndex, "facilityFeature", "longTermStorage");
				}
			}

			if (snapshot.EmergencyShelterData is { } emergencyShelterData)
			{
				Role("EmergencyShelter", emergencyShelterData.m_ShelterCapacity);
				Fact(prefabIndex, "shelterVehicles", emergencyShelterData.m_VehicleCapacity);
			}

			if (snapshot.WaterPumpingStationData is { } waterPumpingStationData)
			{
				prefabIndex.WaterCapacity = waterPumpingStationData.m_Capacity;
				Role("WaterPumpingStation", waterPumpingStationData.m_Capacity);
				Fact(prefabIndex, "purification", Percent.FromFraction(waterPumpingStationData.m_Purification));
			}

			// RequiredResourceBinder.RequiresWater, transcribed: a groundwater-powered plant
			// draws ground water, and asks first. Otherwise vanilla's wording and vanilla's
			// silence for a pumping station: a tower allows no type and says nothing, where
			// the raw enum read "Draws from None".
			if (snapshot.GroundWaterPoweredData.HasValue)
			{
				TextFact(prefabIndex, "waterSource", WaterSource.Describe(groundwater: true, surfaceWater: false));
			}
			else if (snapshot.WaterPumpingStationData is { } waterSourceData)
			{
				TextFact(prefabIndex, "waterSource", WaterSource.Describe(
					(waterSourceData.m_Types & AllowedWaterTypes.Groundwater) != 0,
					(waterSourceData.m_Types & AllowedWaterTypes.SurfaceWater) != 0));
			}

			if (snapshot.SewageOutletData is { } sewageOutletData)
			{
				prefabIndex.SewageCapacity = sewageOutletData.m_Capacity;
				Role("SewageOutlet", sewageOutletData.m_Capacity);
				Fact(prefabIndex, "purification", Percent.FromFraction(sewageOutletData.m_Purification));
			}

			// PowerProductionBinder, transcribed: shown for a plant or an emergency generator, as
			// the plant's own output, which is all it promises, up to that plus every source that
			// can add to it. The entry keeps the top of that range. Every other source requires
			// the PowerPlant component; an emergency generator counts on its own.
			if (snapshot.PowerPlantData.HasValue || snapshot.EmergencyGeneratorData.HasValue)
			{
				Role("PowerPlant",
					(snapshot.PowerPlantData?.m_ElectricityProduction ?? 0)
					+ (snapshot.WindPoweredData?.m_Production ?? 0)
					+ (snapshot.SolarPoweredData?.m_Production ?? 0)
					+ (snapshot.GarbagePoweredData?.m_Capacity ?? 0)
					+ (int)(1000000f * (snapshot.WaterPoweredData?.m_CapacityFactor ?? 0f))
					+ (snapshot.GroundWaterPoweredData?.m_Production ?? 0)
					+ (snapshot.EmergencyGeneratorData?.m_ElectricityProduction ?? 0));
			}

			// Each of these is the figure its building is FOR.
			if (snapshot.BatteryData is { } batteryData)
			{
				Role("Battery", batteryData.m_Capacity);
				Fact(prefabIndex, "batteryOutput", batteryData.m_PowerOutput);
			}

			if (snapshot.ParkData is { } parkData)
			{
				Fact(prefabIndex, "maintenancePool", parkData.m_MaintenancePool);
			}

			if (snapshot.TransportDepotData is { } transportDepotData)
			{
				TextFact(prefabIndex, "transportType", transportDepotData.m_TransportType.ToString());
				Fact(prefabIndex, "depotVehicles", transportDepotData.m_VehicleCapacity);
			}

			if (snapshot.MaintenanceDepotData is { } maintenanceDepotData)
			{
				Fact(prefabIndex, "maintenanceVehicles", maintenanceDepotData.m_VehicleCapacity);
			}

			// The two properties vanilla authors only on service upgrades. The pollution
			// factors are the signed whole percentages PrefabUISystem binds; the resource
			// consumption change is UpkeepModifierBinder's figure, below.
			if (snapshot.PollutionModifierData is { } pollutionModifier)
			{
				PollutionModifierFact(prefabIndex, "groundPollutionModifier", pollutionModifier.m_GroundPollutionMultiplier);
				PollutionModifierFact(prefabIndex, "airPollutionModifier", pollutionModifier.m_AirPollutionMultiplier);
				PollutionModifierFact(prefabIndex, "noisePollutionModifier", pollutionModifier.m_NoisePollutionMultiplier);
			}

			// UpkeepModifierBinder, transcribed: shown when any multiplier is not one, as the
			// largest of them all, ones included, from a seed of zero. In float and through
			// math, as vanilla computes it, so a figure on a half rounds the same way. Not
			// the money upkeep, whatever the component's name: CityServiceUpkeepSystem applies
			// it only to the resources a building consumes, and vanilla labels it
			// RESOURCE_CONSUMPTION.
			if (snapshot.UpkeepMultipliers is { Count: > 0 } upkeepMultipliers
				&& upkeepMultipliers.Any(multiplier => multiplier != 1f))
			{
				var largest = 0f;
				foreach (var multiplier in upkeepMultipliers)
				{
					largest = math.max(largest, multiplier);
				}

				// Not through a helper: vanilla shows the line once a multiplier is not one,
				// even when the change rounds to none.
				prefabIndex.ServiceFacts.Add(new ServiceFact("resourceConsumption", (int)math.round(100f * (largest - 1f))));
			}

			// Properties.COMFORT, from each of the three components vanilla binds it for, as
			// (int)math.round(100f * factor) and silent only on zero. A parking lot's is 50
			// unless its author set another.
			if (snapshot.ParkingFacilityData is { } parkingData)
			{
				ComfortFact(prefabIndex, parkingData.m_ComfortFactor);
			}
			if (snapshot.TransportStopData is { } transportStopData)
			{
				ComfortFact(prefabIndex, transportStopData.m_ComfortFactor);
			}
			if (snapshot.TransportStationData is { } transportStationData)
			{
				ComfortFact(prefabIndex, transportStationData.m_ComfortFactor);
			}

			// What vanilla's tooltip calls Cargo capacity: StorageLimitData on a
			// cargo station, and on the warehouse upgrade that adds to it.
			// Kilograms; the UI follows the game's own weight rule.
			if (snapshot.StorageLimitData is { } storageLimit
				&& storageLimit.m_Limit > 0)
			{
				Fact(prefabIndex, "cargoCapacity", storageLimit.m_Limit);
			}

			if (snapshot.ElectricityConnectionData is { } electricityConnection
				&& electricityConnection.m_Capacity > 0
				&& !snapshot.RoadData.HasValue)
			{
				Fact(prefabIndex, "electricityCapacity", electricityConnection.m_Capacity);
				TextFact(prefabIndex, "voltage", electricityConnection.m_Voltage.ToString());
			}

			if (snapshot.WaterPipeConnectionData is { } pipeConnection
				&& pipeConnection.m_StormCapacity > 0)
			{
				Fact(prefabIndex, "stormCapacity", pipeConnection.m_StormCapacity);
			}

			if (snapshot.WastewaterTreatmentPlantData is { } wastewaterData)
			{
				prefabIndex.SewageCapacity = wastewaterData.m_Capacity;
				Role("WastewaterTreatmentPlant", wastewaterData.m_Capacity);
			}

			// The first role that has a figure, so Capacity is always a figure in its own role's
			// unit: a water treatment plant's pumping station holds nothing, and its sewage is what
			// it is for. Only a building whose roles all hold nothing is filed by rank alone.
			var primary = BuildingRole.ResolvePrimary(roles.Where(role => capacityOf[role] > 0))
				?? BuildingRole.ResolvePrimary(roles);
			prefabIndex.BuildingTypeName = primary;

			if (primary is not null && capacityOf.TryGetValue(primary, out var capacity))
			{
				prefabIndex.Capacity = capacity;
			}

			// The two secondary figures a building in the catalog carries, under the labels
			// vanilla gives them. An incinerator is a garbage facility that also makes power.
			if (primary != "GarbageFacility" && snapshot.GarbageFacilityData is { } garbageStore)
			{
				Fact(prefabIndex, "garbageStorage", garbageStore.m_GarbageCapacity);
			}
			if (primary != "PowerPlant" && capacityOf.TryGetValue("PowerPlant", out var powerOutput))
			{
				Fact(prefabIndex, "powerOutput", powerOutput);
			}
		}

		/// <summary>The name of a single allowed resource, or null.</summary>
		/// <remarks><c>Resource</c> is a ulong flags enum: zero ToString()s as "NoResource" and a
		/// composite value as a raw number — and only a single flag tells the player anything.</remarks>
		public static string? ResourceName(Game.Economy.Resource resource)
		{
			ulong value = (ulong)resource;

			bool isSingleResource = value != 0UL && (value & (value - 1UL)) == 0UL;

			return isSingleResource ? resource.ToString() : null;
		}

		/// <summary>Records one service figure, dropping the zeros.</summary>
		/// <remarks>A zero means "this building has none of that", and a card that has already dropped
		/// every field that does not apply has no use for the line.</remarks>
		private static void Fact(PrefabIndex prefabIndex, string key, double value)
		{
			if (value > 0d)
			{
				prefabIndex.ServiceFacts.Add(new ServiceFact(key, value));
			}
		}

		/// <summary>Records a figure that can fall as well as rise, dropping only a zero.</summary>
		private static void SignedFact(PrefabIndex prefabIndex, string key, double value)
		{
			if (value != 0d)
			{
				prefabIndex.ServiceFacts.Add(new ServiceFact(key, value));
			}
		}

		/// <summary>A comfort factor as the whole number Properties.COMFORT shows, unless it rounds
		/// to none.</summary>
		private static void ComfortFact(PrefabIndex prefabIndex, float factor) =>
			SignedFact(prefabIndex, "comfort", (int)math.round(100f * factor));

		/// <summary>A pollution factor as the signed whole percentage vanilla shows, unless it rounds
		/// to none.</summary>
		/// <remarks>A change, not a multiplier: the game scales a level by max(0, 1 + factor) and adds
		/// upgrades' factors together. The product stays a float so a half rounds as vanilla's
		/// Mathf.RoundToInt(factor * 100f) rounds it.</remarks>
		private static void PollutionModifierFact(PrefabIndex prefabIndex, string key, float factor)
		{
			var percent = (int)math.round(factor * 100f);

			if (percent != 0)
			{
				// Not through Fact: that helper drops anything at or below zero, and a
				// reduction, the point of most of these upgrades, is negative.
				prefabIndex.ServiceFacts.Add(new ServiceFact(key, percent));
			}
		}

		/// <summary>Records one worded figure, dropping the blanks.</summary>
		private static void TextFact(PrefabIndex prefabIndex, string key, string? value)
		{
			if (value?.Trim() is { Length: > 0 } trimmed)
			{
				prefabIndex.ServiceTextFacts.Add(new ServiceTextFact(key, trimmed));
			}
		}
	}
}
