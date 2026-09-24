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
	/// The indexer fills the snapshot from the game and this only maps it, so a test can build one
	/// by hand. The entry keeps the order facts are added in, but a card re-sorts them by the UI's
	/// FACT_ORDER, so that order only breaks ties within one key. UI/test/factCoverage.test.ts reads
	/// this file for every key it can emit. See docs/indexing.md.
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
				prefabIndex.Upkeep = (int)Math.Round(netData.m_DefaultUpkeepCost * NetCellsPerKilometre);
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

				if (snapshot.ElevationCost is { } elevationCost)
				{
					Fact(prefabIndex, "elevationCost", elevationCost * NetCellsPerKilometre);
				}
			}

			if (snapshot.ConsumptionData is { } consumptionData)
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
			if (snapshot.ServiceUpkeep is { Count: > 0 } stacks)
			{
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
				Fact(prefabIndex, "workConditions", workplaceData.m_WorkConditions);
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

			// Doubles: a telecom facility's capacity is gigabits a second with a
			// decimal, which an int would truncate.
			var capacities = new List<double>();
			// Doubles as the Role facet source: these are exactly the service
			// components that make a building a school, a hospital, and so on.
			var roles = new List<string>();
			if (snapshot.SchoolData is { } schoolData)
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
			if (snapshot.LeisureProviderData is { } leisureData
				&& leisureData.m_Efficiency > 0)
			{
				prefabIndex.LeisureType = leisureData.m_LeisureType.ToString();
				prefabIndex.LeisureEfficiency = leisureData.m_Efficiency;
			}

			if (snapshot.HospitalData is { } hospitalData)
			{
				roles.Add("Hospital");
				capacities.Add(hospitalData.m_PatientCapacity);
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
				roles.Add("PostFacility");
				// Mail held, not vans or sorting rate: the vans are how it works
				// and the rate is per unit time, while this is the size of the
				// thing — the same question capacity answers everywhere else.
				capacities.Add(postFacilityData.m_MailCapacity);
				Fact(prefabIndex, "postTrucks", postFacilityData.m_PostTruckCapacity);
				Fact(prefabIndex, "sortingRate", postFacilityData.m_SortingRate);
				Fact(prefabIndex, "postVans", postFacilityData.m_PostVanCapacity);
			}

			if (snapshot.TelecomFacilityData is { } telecomFacilityData)
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

			if (snapshot.GarbageFacilityData is { } garbageFacilityData)
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

			if (snapshot.FireStationData is { } fireStationData)
			{
				roles.Add("FireStation");
				capacities.Add(fireStationData.m_FireEngineCapacity);
				Fact(prefabIndex, "helicopters", fireStationData.m_FireHelicopterCapacity);
				Fact(prefabIndex, "disasterResponse", fireStationData.m_DisasterResponseCapacity);
			}

			if (snapshot.PoliceStationData is { } policeStationData)
			{
				roles.Add("PoliceStation");
				capacities.Add(policeStationData.m_PatrolCarCapacity);
				Fact(prefabIndex, "jailCapacity", policeStationData.m_JailCapacity);
				Fact(prefabIndex, "helicopters", policeStationData.m_PoliceHelicopterCapacity);
			}

			if (snapshot.PrisonData is { } prisonData)
			{
				roles.Add("Prison");
				capacities.Add(prisonData.m_PrisonerCapacity);
				Fact(prefabIndex, "prisonVans", prisonData.m_PrisonVanCapacity);
				Fact(prefabIndex, "prisonerWellbeing", prisonData.m_PrisonerWellbeing);
				Fact(prefabIndex, "prisonerHealth", prisonData.m_PrisonerHealth);
			}

			if (snapshot.DeathcareFacilityData is { } deathcareFacilityData)
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

			if (snapshot.EmergencyShelterData is { } emergencyShelterData)
			{
				roles.Add("EmergencyShelter");
				capacities.Add(emergencyShelterData.m_ShelterCapacity);
				Fact(prefabIndex, "shelterVehicles", emergencyShelterData.m_VehicleCapacity);
			}

			if (snapshot.WaterPumpingStationData is { } waterPumpingStationData)
			{
				roles.Add("WaterPumpingStation");
				prefabIndex.WaterCapacity = waterPumpingStationData.m_Capacity;
				capacities.Add(waterPumpingStationData.m_Capacity);
				Fact(prefabIndex, "purification", Percent.FromFraction(waterPumpingStationData.m_Purification));
				// Vanilla's wording and vanilla's silence: a tower allows no type
				// and says nothing, where the raw enum read "Draws from None".
				TextFact(prefabIndex, "waterSource", WaterSource.Describe(
					(waterPumpingStationData.m_Types & AllowedWaterTypes.Groundwater) != 0,
					(waterPumpingStationData.m_Types & AllowedWaterTypes.SurfaceWater) != 0));
			}

			if (snapshot.SewageOutletData is { } sewageOutletData)
			{
				roles.Add("SewageOutlet");
				prefabIndex.SewageCapacity = sewageOutletData.m_Capacity;
				capacities.Add(sewageOutletData.m_Capacity);
				Fact(prefabIndex, "purification", Percent.FromFraction(sewageOutletData.m_Purification));
			}

			// Power plants report output as production rather than capacity, so
			// without this a coal plant has no capacity to forecast the city's
			// demand against. Solar is a separate component with its own field.
			if (snapshot.PowerPlantData is { } powerPlantData)
			{
				roles.Add("PowerPlant");
				capacities.Add(powerPlantData.m_ElectricityProduction);
			}

			if (snapshot.SolarPoweredData is { } solarData)
			{
				roles.Add("PowerPlant");
				capacities.Add(solarData.m_Production);
			}

			// Wind is a third component again, with its own production field.
			if (snapshot.WindPoweredData is { } windData)
			{
				roles.Add("PowerPlant");
				capacities.Add(windData.m_Production);
			}

			// Each of these is the figure its building is FOR.
			if (snapshot.BatteryData is { } batteryData)
			{
				roles.Add("Battery");
				capacities.Add(batteryData.m_Capacity);
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

			// The two properties vanilla authors only on service upgrades. The multipliers
			// are the whole percentages PrefabUISystem binds; the upkeep change is
			// UpkeepModifierBinder's figure, below.
			if (snapshot.PollutionModifierData is { } pollutionModifier)
			{
				// A multiplier of one changes nothing and "100 %" would say so at
				// length; only the factors that move a level are facts.
				PollutionModifierFact(prefabIndex, "groundPollutionModifier", pollutionModifier.m_GroundPollutionMultiplier);
				PollutionModifierFact(prefabIndex, "airPollutionModifier", pollutionModifier.m_AirPollutionMultiplier);
				PollutionModifierFact(prefabIndex, "noisePollutionModifier", pollutionModifier.m_NoisePollutionMultiplier);
			}

			// UpkeepModifierBinder, transcribed: shown when any multiplier is not one, as the
			// largest of them all, ones included, from a seed of zero. In float and through
			// math, as vanilla computes it, so a figure on a half rounds the same way.
			if (snapshot.UpkeepMultipliers is { Count: > 0 } upkeepMultipliers
				&& upkeepMultipliers.Any(multiplier => multiplier != 1f))
			{
				var largest = 0f;
				foreach (var multiplier in upkeepMultipliers)
				{
					largest = math.max(largest, multiplier);
				}

				// Not through Fact: that helper drops anything at or below zero,
				// and a saving is negative.
				prefabIndex.ServiceFacts.Add(new ServiceFact("upkeepChange", (int)math.round(100f * (largest - 1f))));
			}

			if (snapshot.TransportStationData is { } transportStationData)
			{
				Fact(prefabIndex, "comfort", Percent.FromFraction(transportStationData.m_ComfortFactor));
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

		/// <summary>A pollution multiplier as the whole percentage vanilla shows, unless it is one.</summary>
		/// <remarks>Rounded as PrefabUISystem's binder does, Mathf.RoundToInt of the float product, so a
		/// figure on a half rounds the same way.</remarks>
		private static void PollutionModifierFact(PrefabIndex prefabIndex, string key, float multiplier)
		{
			if (Math.Abs(multiplier - 1f) > 0.0005f)
			{
				Fact(prefabIndex, key, (int)math.round(multiplier * 100f));
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
