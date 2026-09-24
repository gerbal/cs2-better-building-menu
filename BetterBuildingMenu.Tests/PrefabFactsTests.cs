using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;

using Game.Prefabs;

using System;
using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The mapping from a prefab's components to an entry's figures and facts, over a snapshot
	/// built by hand the way the indexer fills one from the game.
	/// </summary>
	public sealed class PrefabFactsTests
	{
		private static PrefabIndex Apply(PrefabSnapshot snapshot, PrefabCategory category = PrefabCategory.ServiceBuildings)
		{
			var entry = TestPrefabs.Entry(1, category, PrefabSubCategory.Any);
			PrefabFacts.Apply(snapshot, entry);
			return entry;
		}

		private static string[] Keys(PrefabIndex entry) => entry.ServiceFacts.Select(fact => fact.Key).ToArray();

		private static double FactValue(PrefabIndex entry, string key) => entry.ServiceFacts.Single(fact => fact.Key == key).Value;

		private static string[] TextFacts(PrefabIndex entry, string key) =>
			entry.ServiceTextFacts.Where(fact => fact.Key == key).Select(fact => fact.Value).ToArray();

		[Fact]
		public void OnlyTheCategoriesThatCarryFactsAreRead()
		{
			foreach (var category in new[]
			{
				PrefabCategory.Buildings, PrefabCategory.ServiceBuildings, PrefabCategory.Networks,
				PrefabCategory.Zones, PrefabCategory.Trees, PrefabCategory.Props,
			})
			{
				Assert.True(PrefabFacts.AppliesTo(category), category.ToString());
			}

			Assert.False(PrefabFacts.AppliesTo(PrefabCategory.Any));
		}

		/// <summary>A hospital, end to end: the figures, the order its facts are added in, and what
		/// is left out.</summary>
		[Fact]
		public void AHospitalGetsItsFiguresAndItsFactsInEmitOrder()
		{
			var entry = Apply(new PrefabSnapshot
			{
				PlaceableObjectData = new PlaceableObjectData { m_ConstructionCost = 150_000, m_XPReward = 40 },
				ConsumptionData = new ConsumptionData { m_Upkeep = 1_000, m_ElectricityConsumption = 300f, m_WaterConsumption = 200f },
				ServiceUpkeep = new[] { ("Money", 2_400) },
				WorkplaceData = new WorkplaceData
				{
					m_MaxWorkers = 60,
					m_MinimumWorkersLimit = 10,
					m_EveningShiftProbability = 0.5f,
					m_NightShiftProbability = 0.25f,
					m_Complexity = WorkplaceComplexity.Complex,
				},
				BuildingPropertyData = new BuildingPropertyData { m_ResidentialProperties = 0 },
				HospitalData = new HospitalData { m_PatientCapacity = 200, m_AmbulanceCapacity = 5, m_MedicalHelicopterCapacity = 1 },
				CoverageData = new CoverageData { m_Range = 2_000f },
			});

			Assert.Equal(150_000u, entry.ConstructionCost);
			Assert.Equal(2_400, entry.Upkeep);
			Assert.Equal(300f, entry.ElectricityConsumption);
			Assert.Equal(60, entry.Workers);
			Assert.Null(entry.Households);
			Assert.Equal(200d, entry.Capacity);
			Assert.Equal("Hospital", entry.BuildingTypeName);
			Assert.Equal(2_000f, entry.ServiceRange);
			Assert.False(entry.CostIsPerDistance);

			// workConditions is zero, so it is left out rather than listed as nothing.
			Assert.Equal(
				new[]
				{
					new ServiceFact("xpReward", 40), new ServiceFact("minCrew", 10),
					new ServiceFact("eveningShift", 50), new ServiceFact("nightShift", 25),
					new ServiceFact("ambulances", 5), new ServiceFact("helicopters", 1),
				},
				entry.ServiceFacts);
			Assert.Equal(new[] { new ServiceTextFact("jobComplexity", "Complex") }, entry.ServiceTextFacts);
		}

		/// <summary>A building carrying every service component at once, each figure distinct, so a
		/// dropped, swapped or reordered line changes the result.</summary>
		/// <remarks>No real prefab carries all of these; this pins the whole mapping, fact by fact, in
		/// the order it is added.</remarks>
		[Fact]
		public void EveryServiceFamilyMapsToItsOwnFigures()
		{
			var entry = Apply(
				new PrefabSnapshot
				{
					PlaceableObjectData = new PlaceableObjectData { m_ConstructionCost = 101, m_XPReward = 2 },
					ConsumptionData = new ConsumptionData
					{
						m_Upkeep = 3, m_ElectricityConsumption = 5f, m_WaterConsumption = 7f, m_GarbageAccumulation = 11f, m_TelecomNeed = 13f,
					},
					ServiceUpkeep = new[] { ("Money", 17), ("Coal", 19), ("Oil", 0) },
					WorkplaceData = new WorkplaceData
					{
						m_MaxWorkers = 23,
						m_MinimumWorkersLimit = 29,
						m_EveningShiftProbability = 0.5f,
						m_NightShiftProbability = 0.25f,
						m_WorkConditions = 31,
						m_Complexity = WorkplaceComplexity.Hitech,
					},
					BuildingPropertyData = new BuildingPropertyData { m_ResidentialProperties = 37 },
					PollutionData = new PollutionData { m_GroundPollution = 41f, m_AirPollution = 43f, m_NoisePollution = 47f },
					SchoolData = new SchoolData
					{
						m_StudentCapacity = 53, m_StudentWellbeing = 4, m_StudentHealth = 6, m_EducationLevel = 2, m_GraduationModifier = 0.75f,
					},
					LeisureProviderData = new LeisureProviderData { m_Efficiency = 59, m_LeisureType = Game.Agents.LeisureType.Meals },
					HospitalData = new HospitalData { m_PatientCapacity = 61, m_AmbulanceCapacity = 67, m_MedicalHelicopterCapacity = 71 },
					ZoneServiceConsumptionData = new ZoneServiceConsumptionData { m_Upkeep = 0.5f },
					ZonePropertiesData = new ZonePropertiesData
					{
						m_ResidentialProperties = 73f,
						m_SpaceMultiplier = 1.5f,
						m_FireHazardMultiplier = 2f,
						m_IgnoreLandValue = true,
						m_AllowedSold = Game.Economy.Resource.Coal,
						m_AllowedManufactured = Game.Economy.Resource.Oil,
						m_AllowedStored = Game.Economy.Resource.Wood,
					},
					ZoneData = new ZoneData { m_MaxHeight = 79, m_ZoneFlags = ZoneFlags.SupportNarrow | ZoneFlags.SupportLeftCorner },
					AttractionData = new AttractionData { m_Attractiveness = 83 },
					CoverageData = new CoverageData { m_Range = 1_000f },
					MailBoxData = new MailBoxData { m_MailCapacity = 89 },
					RequiredResource = "Ore",
					PostFacilityData = new PostFacilityData { m_PostVanCapacity = 97, m_PostTruckCapacity = 103, m_MailCapacity = 107, m_SortingRate = 109 },
					TelecomFacilityData = new TelecomFacilityData { m_Range = 2_000f, m_NetworkCapacity = 1.5f, m_PenetrateTerrain = true },
					GarbageFacilityData = new GarbageFacilityData
					{
						m_GarbageCapacity = 113, m_VehicleCapacity = 127, m_TransportCapacity = 131, m_ProcessingSpeed = 137, m_IndustrialWasteOnly = true,
					},
					FireStationData = new FireStationData { m_FireEngineCapacity = 139, m_FireHelicopterCapacity = 149, m_DisasterResponseCapacity = 151 },
					PoliceStationData = new PoliceStationData { m_PatrolCarCapacity = 157, m_PoliceHelicopterCapacity = 163, m_JailCapacity = 167 },
					PrisonData = new PrisonData { m_PrisonVanCapacity = 173, m_PrisonerCapacity = 179, m_PrisonerWellbeing = 8, m_PrisonerHealth = 9 },
					DeathcareFacilityData = new DeathcareFacilityData
					{
						m_HearseCapacity = 181, m_StorageCapacity = 191, m_ProcessingRate = 0.125f, m_LongTermStorage = true,
					},
					EmergencyShelterData = new EmergencyShelterData { m_ShelterCapacity = 193, m_VehicleCapacity = 197 },
					WaterPumpingStationData = new WaterPumpingStationData
					{
						m_Types = AllowedWaterTypes.Groundwater, m_Capacity = 199, m_Purification = 0.25f,
					},
					SewageOutletData = new SewageOutletData { m_Capacity = 211, m_Purification = 0.5f },
					PowerPlantData = new PowerPlantData { m_ElectricityProduction = 223 },
					SolarPoweredData = new SolarPoweredData { m_Production = 227 },
					WindPoweredData = new WindPoweredData { m_Production = 5_000 },
					BatteryData = new BatteryData { m_Capacity = 229, m_PowerOutput = 233 },
					ParkData = new ParkData { m_MaintenancePool = 239 },
					TransportDepotData = new TransportDepotData { m_TransportType = TransportType.Bus, m_VehicleCapacity = 241 },
					MaintenanceDepotData = new MaintenanceDepotData { m_VehicleCapacity = 251 },
					PollutionModifierData = new PollutionModifierData
					{
						m_GroundPollutionMultiplier = 0.5f, m_AirPollutionMultiplier = 1.25f, m_NoisePollutionMultiplier = 1f,
					},
					UpkeepMultipliers = new[] { 0.75f },
					TransportStationData = new TransportStationData { m_ComfortFactor = 0.5f },
					StorageLimitData = new Game.Companies.StorageLimitData { m_Limit = 257 },
					ElectricityConnectionData = new ElectricityConnectionData { m_Capacity = 263, m_Voltage = ElectricityConnection.Voltage.Low },
					WaterPipeConnectionData = new WaterPipeConnectionData { m_StormCapacity = 269 },
					WastewaterTreatmentPlantData = new WastewaterTreatmentPlantData { m_Capacity = 271 },
				},
				PrefabCategory.Buildings);

			Assert.Equal(101u, entry.ConstructionCost);
			Assert.Equal(17, entry.Upkeep);
			Assert.Equal(5f, entry.ElectricityConsumption);
			Assert.Equal(7f, entry.WaterConsumption);
			Assert.Equal(11f, entry.GarbageAccumulation);
			Assert.Equal(13f, entry.TelecomNeed);
			Assert.Equal(23, entry.Workers);
			Assert.Equal(37, entry.Households);
			Assert.Equal(41f, entry.GroundPollution);
			Assert.Equal(43f, entry.AirPollution);
			Assert.Equal(47f, entry.NoisePollution);
			Assert.Equal(2, entry.EducationLevel);
			Assert.Equal("Meals", entry.LeisureType);
			Assert.Equal(59, entry.LeisureEfficiency);
			Assert.Equal(2_000f, entry.ServiceRange);
			Assert.Equal(199, entry.WaterCapacity);
			// The treatment plant is read after the outlet, so its figure stands.
			Assert.Equal(271, entry.SewageCapacity);
			// The largest, and neither the first nor the last added.
			Assert.Equal(5_000d, entry.Capacity);
			Assert.Equal("School", entry.BuildingTypeName);
			Assert.False(entry.CostIsPerDistance);
			Assert.Null(entry.Footprints);

			Assert.Equal(
				new[]
				{
					("xpReward", 2d), ("upkeep:Coal", 19d),
					("minCrew", 29d), ("eveningShift", 50d), ("nightShift", 25d), ("workConditions", 31d),
					("studentWellbeing", 4d), ("studentHealth", 6d), ("graduation", 0.75d),
					("ambulances", 67d), ("helicopters", 71d),
					("zoneUpkeep", 0.5d), ("zoneHouseholds", 73d), ("zoneSpace", 1.5d), ("zoneFireHazard", 2d), ("zoneMaxHeight", 79d),
					("attractiveness", 83d), ("mailboxCapacity", 89d),
					("postTrucks", 103d), ("sortingRate", 109d), ("postVans", 97d),
					("garbageProcessing", 137d), ("collectionTrucks", 127d),
					("helicopters", 149d), ("disasterResponse", 151d),
					("jailCapacity", 167d), ("helicopters", 163d),
					("prisonVans", 173d), ("prisonerWellbeing", 8d), ("prisonerHealth", 9d),
					("hearses", 181d), ("processingRate", 0.125d), ("shelterVehicles", 197d),
					("purification", 25d), ("purification", 50d),
					("batteryOutput", 233d), ("maintenancePool", 239d), ("depotVehicles", 241d), ("maintenanceVehicles", 251d),
					("groundPollutionModifier", 50d), ("airPollutionModifier", 125d), ("upkeepChange", -25d),
					("comfort", 50d), ("cargoCapacity", 257d), ("electricityCapacity", 263d), ("stormCapacity", 269d),
				},
				entry.ServiceFacts.Select(fact => (fact.Key, fact.Value)));
			Assert.Equal(
				new[]
				{
					("jobComplexity", "Hitech"),
					("zoneFeature", "ignoresLandValue"),
					("zoneSold", "Coal"), ("zoneManufactured", "Oil"), ("zoneStored", "Wood"),
					("zoneLotShapes", "narrow"), ("zoneLotShapes", "corners"),
					("requiredResource", "Ore"),
					("facilityFeature", "signalThroughTerrain"), ("facilityFeature", "industrialWasteOnly"), ("facilityFeature", "longTermStorage"),
					("waterSource", "GroundWater"), ("transportType", "Bus"), ("voltage", "Low"),
				},
				entry.ServiceTextFacts.Select(fact => (fact.Key, fact.Value)));
		}

		[Fact]
		public void ANetworkIsPricedPerKilometre()
		{
			var entry = Apply(
				new PrefabSnapshot
				{
					PlaceableNetData = new PlaceableNetData { m_DefaultConstructionCost = 40, m_DefaultUpkeepCost = 0.6f },
					ElevationCost = 2f,
				},
				PrefabCategory.Networks);

			Assert.True(entry.CostIsPerDistance);
			Assert.Equal(5_000u, entry.ConstructionCost);
			Assert.Equal(75, entry.Upkeep);
			Assert.Equal(250d, FactValue(entry, "elevationCost"));
		}

		[Fact]
		public void ANetworkRoundsItsUpkeepAndLeavesOutAZeroWidth()
		{
			var entry = Apply(
				new PrefabSnapshot
				{
					PlaceableNetData = new PlaceableNetData { m_DefaultUpkeepCost = 0.599f },
					NetGeometryData = new NetGeometryData { m_DefaultWidth = 0f },
				},
				PrefabCategory.Networks);

			Assert.Equal(75, entry.Upkeep);
			Assert.Null(entry.NetworkWidth);
		}

		/// <summary>Each network type holds its own speed, and the first that answers wins.</summary>
		[Fact]
		public void ANetworkTakesItsSpeedFromItsOwnType()
		{
			PrefabIndex Network(PrefabSnapshot snapshot)
			{
				snapshot.PlaceableNetData = new PlaceableNetData();
				return Apply(snapshot, PrefabCategory.Networks);
			}

			var road = Network(new PrefabSnapshot
			{
				RoadData = new RoadData { m_SpeedLimit = 10f },
				TrackData = new TrackData { m_SpeedLimit = 20f, m_TrackType = Game.Net.TrackTypes.Tram },
			});
			var track = Network(new PrefabSnapshot { TrackData = new TrackData { m_SpeedLimit = 20f, m_TrackType = Game.Net.TrackTypes.Train } });
			var untyped = Network(new PrefabSnapshot { TrackData = new TrackData { m_SpeedLimit = 20f } });
			var path = Network(new PrefabSnapshot { PathwayData = new PathwayData { m_SpeedLimit = 3f } });
			var waterway = Network(new PrefabSnapshot { WaterwayData = new WaterwayData { m_SpeedLimit = 7f } });
			var taxiway = Network(new PrefabSnapshot { TaxiwayData = new TaxiwayData { m_SpeedLimit = 5f } });

			Assert.Equal(SpeedLimit.KilometresPerHour(10f), road.SpeedLimit);
			Assert.Equal(new[] { "Tram" }, TextFacts(road, "trackType"));
			Assert.Equal(SpeedLimit.KilometresPerHour(20f), track.SpeedLimit);
			Assert.Equal(new[] { "Train" }, TextFacts(track, "trackType"));
			Assert.Empty(TextFacts(untyped, "trackType"));
			Assert.Equal(SpeedLimit.KilometresPerHour(3f), path.SpeedLimit);
			Assert.Equal(SpeedLimit.KilometresPerHour(7f), waterway.SpeedLimit);
			Assert.Equal(SpeedLimit.KilometresPerHour(5f), taxiway.SpeedLimit);
		}

		[Fact]
		public void AnAnnexIsPricedFromItsUpgradeCost()
		{
			var entry = Apply(new PrefabSnapshot
			{
				ServiceUpgradeData = new ServiceUpgradeData { m_UpgradeCost = 22_500, m_XPReward = 10 },
			});

			Assert.Equal(22_500u, entry.ConstructionCost);
			Assert.Equal(10d, FactValue(entry, "xpReward"));
			Assert.False(entry.CostIsPerDistance);
		}

		[Fact]
		public void ANetworkUpgradeIsPricedAsANetwork()
		{
			var entry = Apply(
				new PrefabSnapshot
				{
					ServiceUpgradeData = new ServiceUpgradeData { m_UpgradeCost = 22_500 },
					PlaceableNetData = new PlaceableNetData { m_DefaultConstructionCost = 8 },
				},
				PrefabCategory.Networks);

			Assert.Equal(1_000u, entry.ConstructionCost);
			Assert.True(entry.CostIsPerDistance);
		}

		[Fact]
		public void TheUpkeepBufferOverridesConsumptionAndNamesItsOtherResources()
		{
			var entry = Apply(new PrefabSnapshot
			{
				ConsumptionData = new ConsumptionData { m_Upkeep = 1_000 },
				ServiceUpkeep = new[] { ("Money", 5_000), ("Coal", 4_000) },
			});

			Assert.Equal(5_000, entry.Upkeep);
			Assert.Equal(4_000d, FactValue(entry, "upkeep:Coal"));
		}

		[Fact]
		public void ConsumptionStandsInWhenTheBufferHasNoMoney()
		{
			var entry = Apply(new PrefabSnapshot
			{
				ConsumptionData = new ConsumptionData { m_Upkeep = 1_000 },
				ServiceUpkeep = new[] { ("Coal", 4_000) },
			});

			Assert.Equal(1_000, entry.Upkeep);
		}

		[Fact]
		public void ABufferWithNoMoneyAndNoConsumptionLeavesTheUpkeepUnknown()
		{
			var entry = Apply(new PrefabSnapshot { ServiceUpkeep = new[] { ("Coal", 4_000) } });

			Assert.Null(entry.Upkeep);
			Assert.Equal(4_000d, FactValue(entry, "upkeep:Coal"));
		}

		[Fact]
		public void AZeroFigureIsLeftOut()
		{
			var entry = Apply(new PrefabSnapshot
			{
				FireStationData = new FireStationData { m_FireEngineCapacity = 4, m_FireHelicopterCapacity = 0, m_DisasterResponseCapacity = 2 },
			});

			Assert.Equal(new[] { "disasterResponse" }, Keys(entry));
			Assert.Equal(4d, entry.Capacity);
			Assert.Equal("FireStation", entry.BuildingTypeName);
		}

		[Fact]
		public void ARoadCarryingPowerHasNoPowerCapacity()
		{
			var connection = new ElectricityConnectionData { m_Capacity = 400, m_Voltage = ElectricityConnection.Voltage.High };

			var road = Apply(
				new PrefabSnapshot
				{
					PlaceableNetData = new PlaceableNetData(),
					RoadData = new RoadData(),
					ElectricityConnectionData = connection,
				},
				PrefabCategory.Networks);
			var powerLine = Apply(
				new PrefabSnapshot { PlaceableNetData = new PlaceableNetData(), ElectricityConnectionData = connection },
				PrefabCategory.Networks);

			Assert.DoesNotContain("electricityCapacity", Keys(road));
			Assert.Empty(TextFacts(road, "voltage"));
			Assert.Equal(400d, FactValue(powerLine, "electricityCapacity"));
			Assert.Equal(new[] { "High" }, TextFacts(powerLine, "voltage"));
		}

		[Theory]
		[InlineData(8.005f, false)]
		[InlineData(8.02f, true)]
		[InlineData(10f, true)]
		public void TheElevatedWidthIsStatedOnlyWhenItDiffers(float elevatedWidth, bool stated)
		{
			var entry = Apply(
				new PrefabSnapshot
				{
					PlaceableNetData = new PlaceableNetData(),
					NetGeometryData = new NetGeometryData { m_DefaultWidth = 8f, m_ElevatedWidth = elevatedWidth },
				},
				PrefabCategory.Networks);

			Assert.Equal(8f, entry.NetworkWidth);
			Assert.Equal(stated, Keys(entry).Contains("elevatedWidth"));
		}

		[Fact]
		public void ARoadListsItsFeaturesInOrder()
		{
			var entry = Apply(
				new PrefabSnapshot
				{
					PlaceableNetData = new PlaceableNetData(),
					HasUndergroundVariant = true,
					TrafficLights = true,
					HighwayRules = true,
					ZonesAlongside = true,
				},
				PrefabCategory.Networks);

			Assert.Equal(new[] { "underground", "trafficLights", "highwayRules", "zonesAlongside" }, TextFacts(entry, "roadFeature"));
		}

		[Theory]
		[InlineData(3_000f, 3_000f)]
		[InlineData(0f, 1_000f)]
		public void ATelecomRangeOverridesTheCoverageRange(float telecomRange, float expected)
		{
			var entry = Apply(new PrefabSnapshot
			{
				CoverageData = new CoverageData { m_Range = 1_000f },
				TelecomFacilityData = new TelecomFacilityData { m_Range = telecomRange, m_NetworkCapacity = 1.5f },
			});

			Assert.Equal(expected, entry.ServiceRange);
			Assert.Equal(1.5d, entry.Capacity ?? double.NaN, 3);
		}

		[Theory]
		[InlineData(true, "zoneHouseholdsPerCell")]
		[InlineData(false, "zoneHouseholds")]
		public void AZoneStatesHouseholdsPerCellOnlyWhenItScales(bool scales, string key)
		{
			var entry = Apply(
				new PrefabSnapshot
				{
					ZonePropertiesData = new ZonePropertiesData
					{
						m_ScaleResidentials = scales,
						m_ResidentialProperties = 1.5f,
						m_FireHazardMultiplier = 1f,
					},
				},
				PrefabCategory.Zones);

			Assert.Equal(new[] { key }, Keys(entry));
			Assert.Equal(1.5d, FactValue(entry, key));
		}

		[Fact]
		public void AZeroCoverageRangeIsLeftOut()
		{
			Assert.Null(Apply(new PrefabSnapshot { CoverageData = new CoverageData() }).ServiceRange);
		}

		[Fact]
		public void AZoneCountsTheWidthsItCannotShow()
		{
			var lots = ZoneLotSizes.From(1, 2);
			for (var width = 2; width <= ZoneLotSizes.MaxFootprintsShown + 2; width++)
			{
				lots.Include(width, 2);
			}

			var entry = Apply(new PrefabSnapshot { LotSizes = lots }, PrefabCategory.Zones);

			Assert.Equal(ZoneLotSizes.MaxFootprintsShown, entry.Footprints?.Length);
			Assert.Equal(2, entry.FootprintOverflow);
		}

		/// <summary>×1 is the absence of a modifier; either side of it is a fact.</summary>
		[Theory]
		[InlineData(0.5f, true)]
		[InlineData(1f, false)]
		[InlineData(2f, true)]
		public void AZoneFireHazardIsStatedUnlessItIsOne(float multiplier, bool stated)
		{
			var entry = Apply(
				new PrefabSnapshot { ZonePropertiesData = new ZonePropertiesData { m_FireHazardMultiplier = multiplier } },
				PrefabCategory.Zones);

			Assert.Equal(stated, Keys(entry).Contains("zoneFireHazard"));
		}

		[Theory]
		[InlineData(PrefabCategory.Zones, true)]
		[InlineData(PrefabCategory.Buildings, false)]
		public void OnlyAZoneGetsFootprints(PrefabCategory category, bool gets)
		{
			var entry = Apply(new PrefabSnapshot { LotSizes = ZoneLotSizes.From(2, 2).Include(4, 3) }, category);

			Assert.Equal(gets, entry.Footprints is { Length: > 0 });
		}

		[Theory]
		[InlineData(0, null)]
		[InlineData(5, "Relaxation")]
		public void LeisureCountsOnlyWhenItHasAnEfficiency(int efficiency, string? expected)
		{
			var entry = Apply(new PrefabSnapshot
			{
				LeisureProviderData = new LeisureProviderData { m_Efficiency = efficiency, m_LeisureType = Game.Agents.LeisureType.Relaxation },
			});

			Assert.Equal(expected, entry.LeisureType);
		}

		/// <summary>Vanilla's UpkeepModifierBinder: the largest multiplier of all, ones included,
		/// shown only when one of them is not one.</summary>
		[Theory]
		[InlineData(new[] { 0.8f }, -20d)]
		[InlineData(new[] { 1.25f }, 25d)]
		[InlineData(new[] { 0.8f, 1.1f }, 10d)]
		[InlineData(new[] { 1f, 0.8f }, 0d)]
		[InlineData(new[] { 1f }, null)]
		[InlineData(new[] { 0.805f }, -20d)]
		[InlineData(new[] { float.NaN }, -100d)]
		public void TheUpkeepChangeIsTheLargestMultiplier(float[] multipliers, double? expected)
		{
			var entry = Apply(new PrefabSnapshot { UpkeepMultipliers = multipliers });

			Assert.Equal(expected, entry.ServiceFacts.Where(fact => fact.Key == "upkeepChange").Select(fact => (double?)fact.Value).SingleOrDefault());
		}

		[Fact]
		public void AnEmptySnapshotGivesNoFigures()
		{
			var entry = Apply(new PrefabSnapshot(), PrefabCategory.Networks);

			Assert.Null(entry.ConstructionCost);
			Assert.Empty(entry.ServiceFacts);
			Assert.Empty(entry.ServiceTextFacts);
			Assert.Null(entry.BuildingTypeName);
			Assert.Null(entry.Capacity);
		}

		[Fact]
		public void OnlyASingleResourceHasAName()
		{
			Assert.Equal("Coal", PrefabFacts.ResourceName(Game.Economy.Resource.Coal));
			Assert.Null(PrefabFacts.ResourceName(Game.Economy.Resource.NoResource));
			Assert.Null(PrefabFacts.ResourceName(Game.Economy.Resource.Coal | Game.Economy.Resource.Oil));
		}
	}
}
