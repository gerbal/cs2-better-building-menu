using Colossal.PSI.Common;

using FindItBuildingMenu.Domain.Enums;

using Game.Prefabs;

using System;
using System.Collections.Generic;

using Unity.Mathematics;

namespace FindItBuildingMenu.Domain
{
	public class PrefabIndex : PrefabIndexBase
	{
		public PrefabCategory Category { get; set; }
		public PrefabSubCategory SubCategory { get; set; }
		public DlcId DlcId { get; set; }
		public ZoneTypeFilter ZoneType { get; set; } = ZoneTypeFilter.Any;
		public BuildingCornerFilter CornerType { get; set; }
		public int2 LotSize { get; set; }
		public int BuildingLevel { get; set; }
		public bool IsVanilla { get; set; }
		public bool IsUniqueMesh { get; set; }
		public ThemePrefab Theme { get; set; }
		public AssetPackPrefab[] AssetPacks { get; set; }
		public int[] RandomPrefabs { get; set; }
		public List<string> Tags { get; set; }
		public int UIOrder { get; set; }
		public bool HasParking { get; set; }
		// Nullable analytical values are populated from the same prefab entity
		// already being indexed. A missing component stays missing instead of
		// being serialized as a misleading zero.
		public uint? ConstructionCost { get; set; }
		public int? Upkeep { get; set; }
		public int? Workers { get; set; }
		public int? Capacity { get; set; }
		public float? ElectricityConsumption { get; set; }
		public float? WaterConsumption { get; set; }
		public float? GarbageAccumulation { get; set; }
		public int? WaterCapacity { get; set; }
		public int? SewageCapacity { get; set; }
		public float? GroundPollution { get; set; }
		public float? AirPollution { get; set; }
		public float? NoisePollution { get; set; }
		public DateTime? InstalledDate { get; set; }
		public DateTime? UpdatedDate { get; set; }

		public PrefabIndex(PrefabBase prefabBase) : base(prefabBase)
		{
		}
	}
}
