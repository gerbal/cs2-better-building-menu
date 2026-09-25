using Game.Companies;
using Game.Prefabs;

using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// What a prefab's entity and authoring prefab hold that <see cref="PrefabFacts"/> maps onto
	/// an entry: each component read, or null when the prefab has none.
	/// </summary>
	/// <remarks>
	/// Filled by the indexer, which asks the game; built directly in a test. Every game component
	/// struct here has public fields, so a test can write
	/// <c>new SchoolData { m_StudentCapacity = 500 }</c>.
	/// See docs/indexing.md, "Per-prefab facts".
	/// </remarks>
	public sealed class PrefabSnapshot
	{
		public AttractionData? AttractionData { get; set; }
		public BatteryData? BatteryData { get; set; }
		public BuildingPropertyData? BuildingPropertyData { get; set; }
		public ConsumptionData? ConsumptionData { get; set; }
		public CoverageData? CoverageData { get; set; }
		public DeathcareFacilityData? DeathcareFacilityData { get; set; }
		public ElectricityConnectionData? ElectricityConnectionData { get; set; }
		public EmergencyGeneratorData? EmergencyGeneratorData { get; set; }
		public EmergencyShelterData? EmergencyShelterData { get; set; }
		public FireStationData? FireStationData { get; set; }
		public GarbageFacilityData? GarbageFacilityData { get; set; }
		public GarbagePoweredData? GarbagePoweredData { get; set; }
		public GroundWaterPoweredData? GroundWaterPoweredData { get; set; }
		public HospitalData? HospitalData { get; set; }
		public LeisureProviderData? LeisureProviderData { get; set; }
		public MailBoxData? MailBoxData { get; set; }
		public MaintenanceDepotData? MaintenanceDepotData { get; set; }
		public NetData? NetData { get; set; }
		public NetGeometryData? NetGeometryData { get; set; }
		public ParkData? ParkData { get; set; }
		public ParkingFacilityData? ParkingFacilityData { get; set; }
		public PathwayData? PathwayData { get; set; }
		public PlaceableNetData? PlaceableNetData { get; set; }
		public PlaceableObjectData? PlaceableObjectData { get; set; }
		public PoliceStationData? PoliceStationData { get; set; }
		public PollutionData? PollutionData { get; set; }
		public PollutionModifierData? PollutionModifierData { get; set; }
		public PostFacilityData? PostFacilityData { get; set; }
		public PowerPlantData? PowerPlantData { get; set; }
		public PrisonData? PrisonData { get; set; }
		public RoadData? RoadData { get; set; }
		public SchoolData? SchoolData { get; set; }
		public ServiceUpgradeData? ServiceUpgradeData { get; set; }
		public SewageOutletData? SewageOutletData { get; set; }
		public SolarPoweredData? SolarPoweredData { get; set; }
		public StorageLimitData? StorageLimitData { get; set; }
		public TaxiwayData? TaxiwayData { get; set; }
		public TelecomFacilityData? TelecomFacilityData { get; set; }
		public TrackData? TrackData { get; set; }
		public TransportDepotData? TransportDepotData { get; set; }
		public TransportStationData? TransportStationData { get; set; }
		public TransportStopData? TransportStopData { get; set; }
		public WastewaterTreatmentPlantData? WastewaterTreatmentPlantData { get; set; }
		public WaterPipeConnectionData? WaterPipeConnectionData { get; set; }
		public WaterPoweredData? WaterPoweredData { get; set; }
		public WaterPumpingStationData? WaterPumpingStationData { get; set; }
		public WaterwayData? WaterwayData { get; set; }
		public WindPoweredData? WindPoweredData { get; set; }
		public WorkplaceData? WorkplaceData { get; set; }
		public ZoneData? ZoneData { get; set; }
		public ZonePropertiesData? ZonePropertiesData { get; set; }
		public ZoneServiceConsumptionData? ZoneServiceConsumptionData { get; set; }

		/// <summary><c>PlaceableNetData.m_UndergroundPrefab</c> is set: the network has an
		/// underground version.</summary>
		public bool HasUndergroundVariant { get; set; }

		/// <summary>The authoring <c>RoadPrefab</c>'s traffic lights, read only for a placeable
		/// network.</summary>
		public bool TrafficLights { get; set; }

		/// <summary>The authoring <c>RoadPrefab</c>'s highway rules, read only for a placeable
		/// network.</summary>
		public bool HighwayRules { get; set; }

		/// <summary>The authoring <c>RoadPrefab</c> zones the cells beside it, read only for a
		/// placeable network.</summary>
		public bool ZonesAlongside { get; set; }

		/// <summary>The <c>ServiceUpkeepData</c> buffer, as each entry's resource name and amount;
		/// empty when the prefab has the buffer with nothing in it, null when it has none.</summary>
		public IReadOnlyList<(string Resource, int Amount)>? ServiceUpkeep { get; set; }

		/// <summary>The <c>UpkeepModifierData</c> buffer's multipliers.</summary>
		public IReadOnlyList<float>? UpkeepMultipliers { get; set; }

		/// <summary>The map feature an extractor building needs, or null when it is not one.</summary>
		public string? RequiredResource { get; set; }

		/// <summary>The lots a zone grows, from the zone table a full pass built.</summary>
		public ZoneLotSizes? LotSizes { get; set; }
		/// <summary>The prefab carries <c>PipelineData</c>: it is a pipe, not a network with pipes built
		/// in.</summary>
		public bool IsPipeline { get; set; }
		/// <summary>The prefab carries <c>TransformerData</c>.</summary>
		public bool IsTransformer { get; set; }
		/// <summary>A transformer's power connections: each sub-net that starts and ends on one node
		/// and carries <c>ElectricityConnectionData</c>, as its voltage and capacity.</summary>
		public IReadOnlyList<(ElectricityConnection.Voltage Voltage, int Capacity)>? TransformerConnections { get; set; }
		/// <summary>Every layer the prefab's power-line sub-nets connect on.</summary>
		public Game.Net.Layer SubNetPowerLayers { get; set; }
		/// <summary>Each sub-object's <c>TransportStopData</c>, in the prefab's order, leaving out
		/// the sub-objects that are not stops.</summary>
		public IReadOnlyList<TransportStopData>? TransportStops { get; set; }
		/// <summary>A network's auxiliary networks, nested ones included, as each one's cost for a
		/// cell and the share of it the owner pays.</summary>
		public IReadOnlyList<(float Cost, float Share)>? AuxiliaryNetCosts { get; set; }
		/// <summary>The pollution thresholds, which are settings and the same for every prefab.</summary>
		public PollutionScale? PollutionScale { get; set; }
	}
}
