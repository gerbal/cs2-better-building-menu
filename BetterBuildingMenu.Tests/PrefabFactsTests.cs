using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;

using Game.Net;
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
						m_GroundPollutionMultiplier = -0.5f, m_AirPollutionMultiplier = 0.25f, m_NoisePollutionMultiplier = 0f,
					},
					UpkeepMultipliers = new[] { 0.75f },
					ParkingFacilityData = new ParkingFacilityData { m_ComfortFactor = 0.25f },
					TransportStopData = new TransportStopData { m_ComfortFactor = 0.1f },
					TransportStationData = new TransportStationData { m_ComfortFactor = 0.5f },
					StorageLimitData = new Game.Companies.StorageLimitData { m_Limit = 257 },
					// A building's own connection is no power line: that needs a network's layers.
					ElectricityConnectionData = new ElectricityConnectionData { m_Capacity = 263, m_Voltage = Game.Prefabs.ElectricityConnection.Voltage.Low },
					WaterPipeConnectionData = new WaterPipeConnectionData { m_StormCapacity = 269 },
					WastewaterTreatmentPlantData = new WastewaterTreatmentPlantData { m_Capacity = 271 },
					// Ground 41 sits on its medium threshold, so it stays low.
					PollutionScale = new PollutionScale(new(10, 41, 100), new(10, 20, 40), new(50, 60, 70)),
					SubNetPowerLayers = Layer.PowerlineLow,
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
			// The primary role's own figure, not the largest: that is the plant's, in another unit.
			Assert.Equal(53d, entry.Capacity);
			Assert.Equal("School", entry.BuildingTypeName);
			Assert.False(entry.CostIsPerDistance);
			Assert.Null(entry.Footprints);

			Assert.Equal(
				new[]
				{
					("xpReward", 2d), ("upkeep:Coal", 19d),
					("minCrew", 29d), ("eveningShift", 50d), ("nightShift", 25d), ("workConditions", 31d),
					("studentWellbeing", 4d), ("studentHealth", 6d), ("graduation", 75d),
					("ambulances", 67d), ("helicopters", 71d),
					("zoneUpkeep", 0.5d), ("zoneHouseholds", 73d), ("zoneSpace", 1.5d), ("zoneFireHazard", 2d), ("zoneMaxHeight", 79d),
					("attractiveness", 83d), ("mailboxCapacity", 89d),
					("postTrucks", 103d), ("sortingRate", 109d), ("postVans", 97d),
					("garbageProcessing", 137d), ("collectionTrucks", 127d),
					("helicopters", 149d), ("disasterResponse", 151d),
					("jailCapacity", 167d), ("helicopters", 163d),
					("prisonVans", 173d), ("prisonerWellbeing", 8d), ("prisonerHealth", 9d),
					("hearses", 181d), ("processingRate", 1d), ("shelterVehicles", 197d),
					("purification", 25d), ("purification", 50d),
					("batteryOutput", 233d), ("maintenancePool", 239d), ("depotVehicles", 241d), ("maintenanceVehicles", 251d),
					("groundPollutionModifier", -50d), ("airPollutionModifier", 25d), ("resourceConsumption", -25d),
					("comfort", 25d), ("comfort", 10d), ("comfort", 50d),
					("cargoCapacity", 257d), ("stormCapacity", 269d),
					// The secondary roles' figures, last.
					("garbageStorage", 113d), ("powerOutput", 5_450d),
				},
				entry.ServiceFacts.Select(fact => (fact.Key, fact.Value)));
			Assert.Equal(
				new[]
				{
					("jobComplexity", "Hitech"),
					("groundPollutionLevel", "Low"), ("airPollutionLevel", "High"), ("noisePollutionLevel", "None"),
					("zoneFeature", "ignoresLandValue"),
					("zoneSold", "Coal"), ("zoneManufactured", "Oil"), ("zoneStored", "Wood"),
					("zoneLotShapes", "narrow"), ("zoneLotShapes", "corners"),
					("requiredResource", "Ore"),
					("facilityFeature", "signalThroughTerrain"), ("facilityFeature", "industrialWasteOnly"), ("facilityFeature", "longTermStorage"),
					// The plant's voltage, from its power lines, before the depot's transport type.
					("waterSource", "GroundWater"), ("voltage", "Low"), ("transportType", "Bus"),
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
				},
				PrefabCategory.Networks);

			Assert.True(entry.CostIsPerDistance);
			Assert.Equal(5_000u, entry.ConstructionCost);
			Assert.Equal(75, entry.Upkeep);
		}

		[Fact]
		public void AnAuxiliaryNetworkAddsItsShareToTheCost()
		{
			var entry = Apply(
				new PrefabSnapshot
				{
					PlaceableNetData = new PlaceableNetData { m_DefaultConstructionCost = 40, m_DefaultUpkeepCost = 0.6f },
					AuxiliaryNetCosts = new[] { (10f, 0.5f), (20f, 1f) },
				},
				PrefabCategory.Networks);

			// (40 + 10 × 0.5 + 20) a cell, 125 cells a kilometre. The upkeep is the network's own.
			Assert.Equal(8_125u, entry.ConstructionCost);
			Assert.Equal(75, entry.Upkeep);
		}

		[Fact]
		public void ANetworkWithNoUpkeepHasNoUpkeepLine()
		{
			var entry = Apply(
				new PrefabSnapshot { PlaceableNetData = new PlaceableNetData { m_DefaultConstructionCost = 40, m_DefaultUpkeepCost = 0.003f } },
				PrefabCategory.Networks);

			Assert.Null(entry.Upkeep);
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
		public void ABufferWithNoMoneyIsAnUpkeepOfNothing()
		{
			var coal = Apply(new PrefabSnapshot
			{
				ConsumptionData = new ConsumptionData { m_Upkeep = 1_000 },
				ServiceUpkeep = new[] { ("Coal", 4_000) },
			});
			var empty = Apply(new PrefabSnapshot { ServiceUpkeep = System.Array.Empty<(string, int)>() });

			Assert.Equal(0, coal.Upkeep);
			Assert.Equal(4_000d, FactValue(coal, "upkeep:Coal"));
			Assert.Equal(0, empty.Upkeep);
		}

		/// <summary>A zoned or signature building: its ConsumptionData upkeep is what its renters pay,
		/// and vanilla, which reads only the buffer, shows none.</summary>
		[Fact]
		public void AConsumptionUpkeepWithoutTheBufferIsNotTheCitys()
		{
			var entry = Apply(new PrefabSnapshot
			{
				ConsumptionData = new ConsumptionData { m_Upkeep = 1_000, m_ElectricityConsumption = 300f },
			});

			Assert.Null(entry.Upkeep);
			Assert.Equal(300f, entry.ElectricityConsumption);
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

		/// <summary>ElectricityConnectionBinder's rule: a connection with a capacity, not a road's
		/// street lighting, on a network with a power-line layer.</summary>
		[Fact]
		public void APowerLineIsDrawnByVanillasRule()
		{
			PrefabIndex Line(int capacity, Layer layers, CompositionFlags.General composition = 0, bool network = true) =>
				Apply(
					new PrefabSnapshot
					{
						PlaceableNetData = new PlaceableNetData(),
						ElectricityConnectionData = new ElectricityConnectionData
						{
							m_Capacity = capacity,
							m_CompositionAll = new CompositionFlags { m_General = composition },
						},
						NetData = network ? new NetData { m_LocalConnectLayers = layers } : null,
					},
					PrefabCategory.Networks);

			var high = Line(400, Layer.PowerlineHigh | Layer.Road);
			Assert.Equal(400d, FactValue(high, "electricityCapacity"));
			Assert.Equal(new[] { "High" }, TextFacts(high, "voltage"));

			Assert.Equal(new[] { "Low" }, TextFacts(Line(400, Layer.PowerlineLow), "voltage"));
			Assert.Equal(new[] { "Both" }, TextFacts(Line(400, Layer.PowerlineLow | Layer.PowerlineHigh), "voltage"));

			foreach (var none in new[]
			{
				Line(400, Layer.PowerlineLow, CompositionFlags.General.Lighting),
				Line(400, Layer.Road),
				Line(0, Layer.PowerlineLow),
				Line(400, Layer.PowerlineLow, network: false),
			})
			{
				Assert.DoesNotContain("electricityCapacity", Keys(none));
				Assert.Empty(TextFacts(none, "voltage"));
			}
		}

		[Theory]
		[InlineData(10f, "None")]
		[InlineData(10.5f, "Low")]
		[InlineData(20f, "Low")]
		[InlineData(20.5f, "Medium")]
		[InlineData(40f, "Medium")]
		[InlineData(40.5f, "High")]
		[InlineData(-3f, "None")]
		public void APollutionFigureHasToPassAThreshold(float pollution, string level) =>
			Assert.Equal(level, new PollutionThresholds(10, 20, 40).LevelOf(pollution));

		[Fact]
		public void PollutionLevelsNeedTheScaleAndSomethingToGrade()
		{
			var scale = new PollutionScale(new(10, 20, 40), new(10, 20, 40), new(10, 20, 40));
			PrefabIndex Polluter(PollutionData pollution, PollutionScale? withScale) =>
				Apply(new PrefabSnapshot { PollutionData = pollution, PollutionScale = withScale });

			var noisy = Polluter(new PollutionData { m_NoisePollution = 25f }, scale);
			Assert.Equal(
				new[] { ("groundPollutionLevel", "None"), ("airPollutionLevel", "None"), ("noisePollutionLevel", "Medium") },
				noisy.ServiceTextFacts.Select(fact => (fact.Key, fact.Value)));

			// Vanilla tests the sum, so figures that cancel out draw no levels.
			Assert.Empty(Polluter(new PollutionData { m_GroundPollution = -5f, m_AirPollution = 5f }, scale).ServiceTextFacts);
			Assert.Empty(Polluter(new PollutionData(), scale).ServiceTextFacts);
			Assert.Empty(Polluter(new PollutionData { m_NoisePollution = 25f }, null).ServiceTextFacts);
			// The figures themselves are kept either way.
			Assert.Equal(25f, Polluter(new PollutionData { m_NoisePollution = 25f }, null).NoisePollution);
		}

		/// <summary>PowerProductionBinder's voltage: a transformer's low side, and the power lines
		/// among the plant's own sub-nets.</summary>
		[Theory]
		[InlineData(true, Layer.None, "Low")]
		[InlineData(false, Layer.PowerlineHigh, "High")]
		[InlineData(true, Layer.PowerlineHigh, "Both")]
		[InlineData(false, Layer.PowerlineLow | Layer.Road, "Low")]
		// No power line at all is "Both" too, as ElectricityUIUtils.GetVoltage words it.
		[InlineData(false, Layer.None, "Both")]
		public void APowerPlantNamesTheVoltageItFeeds(bool transformer, Layer subNets, string voltage)
		{
			var plant = Apply(new PrefabSnapshot
			{
				PowerPlantData = new PowerPlantData { m_ElectricityProduction = 100 },
				IsTransformer = transformer,
				SubNetPowerLayers = subNets,
			});
			var generator = Apply(new PrefabSnapshot
			{
				EmergencyGeneratorData = new EmergencyGeneratorData { m_ElectricityProduction = 100 },
				IsTransformer = transformer,
				SubNetPowerLayers = subNets,
			});

			Assert.Equal(new[] { voltage }, TextFacts(plant, "voltage"));
			Assert.Equal(new[] { voltage }, TextFacts(generator, "voltage"));
			Assert.Empty(TextFacts(Apply(new PrefabSnapshot { SubNetPowerLayers = subNets }), "voltage"));
		}

		[Fact]
		public void ATransformerShowsTheSmallerSideAndItsVoltages()
		{
			var connections = new[]
			{
				(Game.Prefabs.ElectricityConnection.Voltage.Low, 300),
				(Game.Prefabs.ElectricityConnection.Voltage.Low, 200),
				(Game.Prefabs.ElectricityConnection.Voltage.High, 400),
			};

			var substation = Apply(new PrefabSnapshot { IsTransformer = true, TransformerConnections = connections });
			Assert.Equal(400d, FactValue(substation, "transformerCapacity"));
			Assert.Equal(new[] { "High" }, TextFacts(substation, "transformerInput"));
			Assert.Equal(new[] { "Low" }, TextFacts(substation, "transformerOutput"));

			// A plant's own transformer shows only its output.
			var plant = Apply(new PrefabSnapshot
			{
				PowerPlantData = new PowerPlantData { m_ElectricityProduction = 100 },
				IsTransformer = true,
				TransformerConnections = connections,
			});
			Assert.DoesNotContain("transformerCapacity", Keys(plant));
			Assert.Empty(TextFacts(plant, "transformerInput"));
			Assert.Equal(new[] { "Low" }, TextFacts(plant, "transformerOutput"));

			var noTransformer = Apply(new PrefabSnapshot { TransformerConnections = connections });
			Assert.DoesNotContain("transformerCapacity", Keys(noTransformer));
			Assert.Empty(noTransformer.ServiceTextFacts);
		}

		[Fact]
		public void ANetworkNamesThePipesBuiltIntoIt()
		{
			PrefabIndex Pipe(int fresh, int sewage, Layer layers, bool pipeline = false, int storm = 0) =>
				Apply(
					new PrefabSnapshot
					{
						PlaceableNetData = new PlaceableNetData(),
						WaterPipeConnectionData = new WaterPipeConnectionData
						{
							m_FreshCapacity = fresh, m_SewageCapacity = sewage, m_StormCapacity = storm,
						},
						NetData = new NetData { m_LocalConnectLayers = layers },
						IsPipeline = pipeline,
					},
					PrefabCategory.Networks);

			Assert.Equal(new[] { "Combined" }, TextFacts(Pipe(10, 10, Layer.WaterPipe | Layer.SewagePipe), "pipeType"));
			// A pipe itself is a pipeline: the line is for a road's built-in pipes.
			Assert.Equal(new[] { "Fresh" }, TextFacts(Pipe(10, 0, Layer.WaterPipe), "pipeType"));
			Assert.Equal(new[] { "Sewage" }, TextFacts(Pipe(0, 10, Layer.SewagePipe), "pipeType"));
			Assert.Empty(TextFacts(Pipe(10, 0, Layer.WaterPipe, pipeline: true), "pipeType"));
			Assert.Empty(TextFacts(Pipe(10, 0, Layer.Road), "pipeType"));

			var stormDrain = Pipe(0, 0, Layer.StormwaterPipe, storm: 10);
			Assert.Empty(TextFacts(stormDrain, "pipeType"));
			Assert.Equal(10d, FactValue(stormDrain, "stormCapacity"));
		}

		[Fact]
		public void ABuildingCountsItsPassengerStopsByKind()
		{
			static TransportStopData Stop(TransportType type, bool passengers = true) =>
				new() { m_TransportType = type, m_PassengerTransport = passengers, m_CargoTransport = !passengers };

			var hub = Apply(new PrefabSnapshot
			{
				TransportStops = new[]
				{
					Stop(TransportType.Train), Stop(TransportType.Bus), Stop(TransportType.Bus),
					Stop(TransportType.Train, passengers: false), Stop(TransportType.Taxi), Stop(TransportType.Subway),
				},
			});
			Assert.Equal(
				new[] { ("subwayStops", 1d), ("trainStops", 1d), ("busStops", 2d) },
				hub.ServiceFacts.Select(fact => (fact.Key, fact.Value)));

			// The first stop decides whether there is a line at all.
			Assert.Empty(Apply(new PrefabSnapshot
			{
				TransportStops = new[] { Stop(TransportType.Train, passengers: false), Stop(TransportType.Train) },
			}).ServiceFacts);
			Assert.Empty(Apply(new PrefabSnapshot
			{
				TransportStops = new[] { Stop(TransportType.Taxi), Stop(TransportType.Bus) },
			}).ServiceFacts);
			// A network's stops are not counted.
			Assert.Empty(Apply(new PrefabSnapshot
			{
				NetData = new NetData(),
				TransportStops = new[] { Stop(TransportType.Bus) },
			}).ServiceFacts);
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
		public void TheResourceConsumptionChangeIsTheLargestMultiplier(float[] multipliers, double? expected)
		{
			var entry = Apply(new PrefabSnapshot { UpkeepMultipliers = multipliers });

			Assert.Equal(expected, entry.ServiceFacts.Where(fact => fact.Key == "resourceConsumption").Select(fact => (double?)fact.Value).SingleOrDefault());
		}

		/// <summary>PrefabUISystem's pollution binders: a signed change, where 0 is none, as
		/// Mathf.RoundToInt of the float product. A double product rounds 0.805 to 81 and 1.255 to 125.</summary>
		[Theory]
		[InlineData(0.5f, 50d)]
		[InlineData(1f, 100d)]
		[InlineData(-0.3f, -30d)]
		[InlineData(0.805f, 80d)]
		[InlineData(1.255f, 126d)]
		[InlineData(-0.255f, -26d)]
		[InlineData(0f, null)]
		[InlineData(0.004f, null)]
		public void APollutionModifierIsTheSignedChangeVanillaShows(float factor, double? expected)
		{
			var entry = Apply(new PrefabSnapshot
			{
				PollutionModifierData = new PollutionModifierData
				{
					m_GroundPollutionMultiplier = factor, m_AirPollutionMultiplier = 0f, m_NoisePollutionMultiplier = 0f,
				},
			});

			Assert.Equal(expected, entry.ServiceFacts.Where(fact => fact.Key == "groundPollutionModifier").Select(fact => (double?)fact.Value).SingleOrDefault());
		}

		[Fact]
		public void ARoleWithNoFigureDoesNotHideAnother()
		{
			// A water treatment plant: its pumping station holds no water, and its sewage is what
			// it is for.
			var plant = Apply(new PrefabSnapshot
			{
				WaterPumpingStationData = new WaterPumpingStationData { m_Capacity = 0, m_Purification = 0.5f },
				SewageOutletData = new SewageOutletData { m_Capacity = 400_000, m_Purification = 0.5f },
			});
			Assert.Equal("SewageOutlet", plant.BuildingTypeName);
			Assert.Equal(400_000d, plant.Capacity);

			// When no role has a figure, rank alone decides, as before.
			var depot = Apply(new PrefabSnapshot
			{
				FireStationData = new FireStationData { m_FireEngineCapacity = 0, m_FireHelicopterCapacity = 2 },
				PoliceStationData = new PoliceStationData { m_PatrolCarCapacity = 0 },
			});
			Assert.Equal("FireStation", depot.BuildingTypeName);
			Assert.Equal(0d, depot.Capacity);
		}

		/// <summary>GarbagePowered requires GarbageFacility and PowerPlant, so every incinerator is
		/// both, and vanilla shows its store and its output on two lines. It is filed with the
		/// landfills, so its Capacity is theirs: a weight.</summary>
		[Fact]
		public void AnIncineratorIsAGarbageFacilityThatMakesPower()
		{
			var entry = Apply(new PrefabSnapshot
			{
				GarbageFacilityData = new GarbageFacilityData { m_GarbageCapacity = 100_000, m_ProcessingSpeed = 5_000 },
				PowerPlantData = new PowerPlantData { m_ElectricityProduction = 0 },
				GarbagePoweredData = new GarbagePoweredData { m_Capacity = 30_000 },
			});

			Assert.Equal("GarbageFacility", entry.BuildingTypeName);
			Assert.Equal(100_000d, entry.Capacity);
			Assert.Equal(30_000d, FactValue(entry, "powerOutput"));
			Assert.DoesNotContain("garbageStorage", Keys(entry));
		}

		[Fact]
		public void ALandfillsStoreIsItsCapacityAlone()
		{
			var entry = Apply(new PrefabSnapshot { GarbageFacilityData = new GarbageFacilityData { m_GarbageCapacity = 500_000 } });

			Assert.Equal(500_000d, entry.Capacity);
			Assert.DoesNotContain("garbageStorage", Keys(entry));
		}

		[Fact]
		public void ASewageOutletsCapacityIsItsOwn()
		{
			var entry = Apply(new PrefabSnapshot { SewageOutletData = new SewageOutletData { m_Capacity = 400, m_Purification = 0f } });

			Assert.Equal("SewageOutlet", entry.BuildingTypeName);
			Assert.Equal(400d, entry.Capacity);
			Assert.Equal(400, entry.SewageCapacity);
		}

		[Fact]
		public void APlantsOutputIsEverySourceAdded()
		{
			var entry = Apply(new PrefabSnapshot
			{
				PowerPlantData = new PowerPlantData { m_ElectricityProduction = 100 },
				WindPoweredData = new WindPoweredData { m_Production = 10 },
				SolarPoweredData = new SolarPoweredData { m_Production = 20 },
				GarbagePoweredData = new GarbagePoweredData { m_Capacity = 30 },
				// (int)(1000000f * factor), as vanilla truncates it: 501.69998 is 501.
				WaterPoweredData = new WaterPoweredData { m_CapacityFactor = 0.0005017f },
				GroundWaterPoweredData = new GroundWaterPoweredData { m_Production = 40 },
				EmergencyGeneratorData = new EmergencyGeneratorData { m_ElectricityProduction = 50 },
			});

			Assert.Equal("PowerPlant", entry.BuildingTypeName);
			Assert.Equal(751d, entry.Capacity);
		}

		/// <summary>An emergency generator, a battery building's upgrade, is a power source on its
		/// own; a source without a plant is not, and vanilla draws no output for one.</summary>
		[Fact]
		public void AnEmergencyGeneratorIsPowerAndABareSourceIsNot()
		{
			var generator = Apply(new PrefabSnapshot { EmergencyGeneratorData = new EmergencyGeneratorData { m_ElectricityProduction = 500 } });
			var sourceOnly = Apply(new PrefabSnapshot { SolarPoweredData = new SolarPoweredData { m_Production = 20 } });

			Assert.Equal("PowerPlant", generator.BuildingTypeName);
			Assert.Equal(500d, generator.Capacity);
			Assert.Null(sourceOnly.BuildingTypeName);
			Assert.Null(sourceOnly.Capacity);
		}

		/// <summary>GraduationSystem adds the modifier to a probability, so it is points, signed.</summary>
		[Theory]
		[InlineData(0.05f, 5d)]
		[InlineData(-0.1f, -10d)]
		[InlineData(0f, null)]
		public void AGraduationModifierIsPercentagePointsAdded(float modifier, double? expected)
		{
			var entry = Apply(new PrefabSnapshot { SchoolData = new SchoolData { m_StudentCapacity = 100, m_GraduationModifier = modifier } });

			Assert.Equal(expected, entry.ServiceFacts.Where(fact => fact.Key == "graduation").Select(fact => (double?)fact.Value).SingleOrDefault());
		}

		[Fact]
		public void AnOffsetThatHurtsIsStillAFigure()
		{
			var entry = Apply(new PrefabSnapshot
			{
				SchoolData = new SchoolData { m_StudentCapacity = 100, m_StudentWellbeing = -5, m_StudentHealth = -2 },
				PrisonData = new PrisonData { m_PrisonerCapacity = 10, m_PrisonerWellbeing = -3, m_PrisonerHealth = -4 },
				WorkplaceData = new WorkplaceData { m_MaxWorkers = 5, m_WorkConditions = -10 },
			});

			Assert.Equal(-5d, FactValue(entry, "studentWellbeing"));
			Assert.Equal(-2d, FactValue(entry, "studentHealth"));
			Assert.Equal(-3d, FactValue(entry, "prisonerWellbeing"));
			Assert.Equal(-4d, FactValue(entry, "prisonerHealth"));
			Assert.Equal(-10d, FactValue(entry, "workConditions"));
		}

		[Fact]
		public void AParkingLotHasTheComfortVanillaShows()
		{
			var lot = Apply(new PrefabSnapshot { ParkingFacilityData = new ParkingFacilityData { m_ComfortFactor = 0.5f } });
			var none = Apply(new PrefabSnapshot { TransportStopData = new TransportStopData { m_ComfortFactor = 0.004f } });
			// Rounded, not truncated, and a discomfort is a figure too.
			var rounded = Apply(new PrefabSnapshot { TransportStopData = new TransportStopData { m_ComfortFactor = 0.337f } });
			var negative = Apply(new PrefabSnapshot { TransportStopData = new TransportStopData { m_ComfortFactor = -0.1f } });

			Assert.Equal(50d, FactValue(lot, "comfort"));
			Assert.DoesNotContain("comfort", Keys(none));
			Assert.Equal(34d, FactValue(rounded, "comfort"));
			Assert.Equal(-10d, FactValue(negative, "comfort"));
		}

		/// <summary>RequiredResourceBinder asks about a groundwater-powered plant first.</summary>
		[Fact]
		public void AGroundwaterPlantDrawsGroundWater()
		{
			var entry = Apply(new PrefabSnapshot
			{
				GroundWaterPoweredData = new GroundWaterPoweredData { m_Production = 10 },
				WaterPumpingStationData = new WaterPumpingStationData { m_Types = AllowedWaterTypes.SurfaceWater, m_Capacity = 10 },
			});

			Assert.Equal(new[] { "GroundWater" }, TextFacts(entry, "waterSource"));
		}

		/// <summary>Vanilla's DECEASED_PROCESSING_CAPACITY rounds up, however little is over.</summary>
		[Theory]
		[InlineData(2.4f, 3d)]
		[InlineData(2.05f, 3d)]
		[InlineData(3f, 3d)]
		public void AProcessingRateRoundsUp(float rate, double expected)
		{
			var entry = Apply(new PrefabSnapshot
			{
				DeathcareFacilityData = new DeathcareFacilityData { m_StorageCapacity = 10, m_ProcessingRate = rate },
			});

			Assert.Equal(expected, FactValue(entry, "processingRate"));
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
