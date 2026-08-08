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
		public string? BuildingTypeName { get; set; }

		/// <summary>
		/// The tier a school grants (SchoolData.m_EducationLevel): 1 elementary,
		/// 2 high school, 3 college, 4 university. Null for anything that is not
		/// a school.
		/// </summary>
		public int? EducationLevel { get; set; }
		public BuildingFlags? BuildingFlagsValue { get; set; }
		public bool IsVanilla { get; set; }

		/// <summary>
		/// Whether the game still has this behind a milestone.
		/// </summary>
		/// <remarks>
		/// Locked is an enableable component, so presence is not the test —
		/// HasEnabledComponent is, which is what the game's own toolbar uses
		/// when it decides to grey an asset out.
		/// </remarks>
		public bool IsLocked { get; set; }

		/// <summary>
		/// The milestone index this asset waits on, or 0 for none.
		/// </summary>
		/// <remarks>
		/// An index rather than a name. The requirement is static — which
		/// milestone unlocks a building never changes — so it costs an int per
		/// asset, and the ~20 milestone names are resolved once into their own
		/// table instead of being re-resolved across 17,898 prefabs every time an
		/// unlock triggers a full re-index.
		/// </remarks>
		public int UnlockMilestone { get; set; }

		/// <summary>
		/// Everything else the asset is waiting on, already localized.
		/// </summary>
		/// <remarks>
		/// Signature buildings are the reason this is not just a milestone.
		/// They hang off requirement prefabs — zone built, objects built,
		/// citizens, processing — which vanilla renders through about eight
		/// separately composed sentences (PrefabUISystem.BindUnlockRequirement).
		/// Reproducing that grammar is where this would start drifting from the
		/// game, so each requirement contributes its OWN title instead, resolved
		/// exactly the way asset names are.
		/// </remarks>
		public string[] UnlockRequirements { get; set; } = Array.Empty<string>();
		public bool IsUniqueMesh { get; set; }
		public ThemePrefab Theme { get; set; }
		public AssetPackPrefab[] AssetPacks { get; set; }
		public int[] RandomPrefabs { get; set; }
		public string[]? ExtensionIds { get; set; }
		public List<string> Tags { get; set; }
		public int UIOrder { get; set; }
		// SPIKE (cm-e98i): the game's own answer to "where does this asset live
		// in the build menu". Vanilla's menu is not a predicate over a flat list
		// — each category IS its own UIGroupElement buffer and membership is
		// exactly UIObjectData.m_Group == that category. We currently rebuild
		// that relationship from (Category, SubCategory, ZoneType) in
		// VanillaBuildMenuTaxonomy, which is a second source of truth and the
		// reason our Healthcare view showed 15 where vanilla shows 8.
		//
		// Recorded here to test whether reading it reproduces vanilla exactly.
		// Remove these two, or commit to them, once that question is answered.
		public string? UiCategoryName { get; set; }
		public string? UiMenuName { get; set; }
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
