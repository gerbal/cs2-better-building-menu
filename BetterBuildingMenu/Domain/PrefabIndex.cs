using Colossal.PSI.Common;

using BetterBuildingMenu.Domain.Enums;

using Game.Prefabs;

using System;
using System.Collections.Generic;

using Unity.Mathematics;

namespace BetterBuildingMenu.Domain
{
	public class PrefabIndex : PrefabIndexBase
	{
		public PrefabCategory Category { get; set; }
		public PrefabSubCategory SubCategory { get; set; }
		public DlcId DlcId { get; set; }

		/// <summary>Vanilla's PlacementFlags.Unique — only one may exist.</summary>
		/// <remarks>
		/// Static per prefab, so indexed here, unlike whether one has been
		/// PLACED — see PlacedUniqueRegistry. Vanilla badges every unique asset
		/// whether or not the city has one yet, so the menu needs both facts.
		/// </remarks>
		public bool IsUnique { get; set; }
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
		/// The branch of its service's development tree this asset hangs off.
		/// </summary>
		/// <remarks>
		/// CS2 gates assets two ways, and the milestone is only one of them.
		/// Service buildings are almost all bought with DEVELOPMENT POINTS from
		/// a per-service tree, which is why grouping those menus by milestone
		/// put every asset in one bucket.
		///
		/// The BRANCH rather than the node: a node usually unlocks one building,
		/// so nodes group nothing, while the branches are the service's own
		/// semantic split — fossil against renewable in Electricity, police
		/// against administration, health against deathcare, postal against
		/// telecom. Those are the useful subgroupings for exactly the menus
		/// vanilla gives no categories to.
		/// </remarks>
		public string DevTreeBranch { get; set; } = string.Empty;

		/// <summary>The icon the development tree draws for that branch.</summary>
		/// <remarks>
		/// Carried per asset rather than looked up by branch name, because the
		/// name is not unique: every service's root branch is called "Basic".
		/// </remarks>
		public string DevTreeBranchIcon { get; set; } = string.Empty;

		/// <summary>The branch's column in its service's development tree.</summary>
		/// <remarks>
		/// The order the game lays the chains out in, and so the order a rank
		/// over the tabs should follow. The root is 0.
		/// </remarks>
		public int DevTreeBranchDepth { get; set; }

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

		/// <summary>
		/// What the building gives the city, already phrased for display.
		/// </summary>
		/// <remarks>
		/// Signature buildings are bought with progress rather than money — the
		/// cost column reads "Free" for every one of them — so the effect IS the
		/// reason to choose one over another, and it was the one thing the card
		/// did not say.
		///
		/// Read from the two buffers the game applies: CityModifierData for
		/// citywide effects and LocalModifierData for radius ones.
		/// </remarks>
		public string[] Bonuses { get; set; } = Array.Empty<string>();
		public bool IsUniqueMesh { get; set; }
		public ThemePrefab Theme { get; set; }
		public AssetPackPrefab[] AssetPacks { get; set; }

		/// <summary>
		/// What the game's own toolbar filter row knows about this asset.
		/// </summary>
		/// <remarks>
		/// Deliberately separate from <see cref="Theme"/> and
		/// <see cref="AssetPacks"/> above, which look like the same facts and are
		/// not. Those are what the asset IS, read from ThemeObject and the pack
		/// buffer, and they drive our own facets. These are what vanilla GATES
		/// visibility on, read from the ObjectRequirementElement buffer — and an
		/// asset whose ThemeObject says European can still be visible under North
		/// American if its requirements say so. Matching the wrong one disagrees
		/// with the game's own menu silently.
		/// </remarks>
		public VanillaAssetFacts VanillaFacts { get; set; }
		public int[] RandomPrefabs { get; set; }
		public string[]? ExtensionIds { get; set; }
		/// <summary>
		/// The upgrades this building supports, in the game's own order.
		/// </summary>
		/// <remarks>
		/// The reverse of <see cref="ExtensionIds"/>, which says only that this
		/// prefab IS an upgrade. Kept apart because the query engine reads a
		/// non-empty ExtensionIds as "hide from every menu"; see
		/// BuildingCatalogEntry.SupportedUpgrades.
		/// </remarks>
		public string[]? SupportedUpgradeIds { get; set; }
		public List<string> Tags { get; set; }
		public int UIOrder { get; set; }
		// The game's own answer to "where does this asset live in the build
		// menu". Vanilla's menu is not a predicate over a flat list — each
		// category IS its own UIGroupElement buffer and membership is exactly
		// UIObjectData.m_Group == that category. These two fields are the only
		// scoping the lens has (cm-jjlv.6); the section taxonomy that used to
		// rebuild the same relationship from (Category, SubCategory, ZoneType)
		// is gone, along with the Healthcare view that showed 15 where vanilla
		// shows 8.
		/// <summary>
		/// A sub-building: placed from its parent's row, never from the grid.
		/// </summary>
		/// <remarks>
		/// The game's own marker, ServiceUpgradeData, and the same test
		/// ToolbarUISystem.FilterOutUpgrades applies before it draws a menu. A
		/// maintenance hall or a storage warehouse is an upgrade to a specific
		/// building, so offering it as a standalone row promises a placement that
		/// does not exist on its own.
		/// </remarks>
		public bool IsServiceUpgrade { get; set; }

		public string? UiCategoryName { get; set; }
		public string? UiMenuName { get; set; }

		/// <summary>
		/// The category's own UIObject.m_Priority — the game's tab order.
		/// </summary>
		/// <remarks>
		/// Read off the category prefab rather than the asset: two assets in the
		/// same category must rank identically, or grouping by category would
		/// split one heading in two.
		///
		/// Defaults to 0 like vanilla's, not to <see cref="UIOrder"/>'s
		/// int.MaxValue sentinel. Vanilla reads a missing UIObjectData as
		/// priority 0 (UIObjectInfo.GetObjects), so a category that never set
		/// one belongs in the middle of the strip, not at the end of it.
		/// </remarks>
		public int UiCategoryPriority { get; set; }
		public bool HasParking { get; set; }

		/// <summary>
		/// Parking bays, matching what the building has once placed. See
		/// PrefabIndexingSystem.GetParkingSlots.
		/// </summary>
		public int ParkingSlots { get; set; }
		// Nullable analytical values are populated from the same prefab entity
		// already being indexed. A missing component stays missing instead of
		// being serialized as a misleading zero.
		/// <summary>
		/// Whether Cost and Upkeep are per kilometre rather than per instance.
		/// </summary>
		/// <remarks>
		/// True for networks, which price by length. The figure is meaningless
		/// without this: 12,500 for a road is a rate, 12,500 for a hospital is a
		/// total, and a column that shows both unqualified invites the reader to
		/// compare them.
		/// </remarks>
		public bool CostIsPerDistance { get; set; }
		public uint? ConstructionCost { get; set; }
		public int? Upkeep { get; set; }
		public int? Workers { get; set; }

		/// <summary>How many households the building holds.</summary>
		/// <remarks>
		/// BuildingPropertyData.m_ResidentialProperties, which is the game's own
		/// answer and the one its info panels use. Kept apart from Capacity
		/// rather than folded in: Capacity is derived from SERVICE components —
		/// shelter beds, water m³, megawatts — and a residential building has
		/// none of them, which is why a signature mansion read capacity null and
		/// the hover card had nothing to say about the thing it is for.
		/// </remarks>
		public int? Households { get; set; }
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
