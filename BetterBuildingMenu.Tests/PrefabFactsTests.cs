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

		/// <summary>A hospital, end to end: the figures, the order its facts are listed in, and what
		/// is left out.</summary>
		[Fact]
		public void AHospitalGetsItsFiguresAndItsFactsInCardOrder()
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
					ZonesAlongside = true,
				},
				PrefabCategory.Networks);

			Assert.Equal(new[] { "underground", "trafficLights", "zonesAlongside" }, TextFacts(entry, "roadFeature"));
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
			Assert.Equal(1.5d, entry.Capacity!.Value, 3);
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
		public void TheUpkeepChangeIsTheLargestMultiplier(float[] multipliers, double? expected)
		{
			var entry = Apply(new PrefabSnapshot { UpkeepMultipliers = multipliers });

			Assert.Equal(expected, entry.ServiceFacts.Where(fact => fact.Key == "upkeepChange").Select(fact => (double?)fact.Value).SingleOrDefault());
		}

		[Fact]
		public void ANetworkHasNoFactsWithoutComponents()
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
