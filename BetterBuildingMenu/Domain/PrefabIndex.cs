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
		/// PLACED — see PlacedUniques. Vanilla badges every unique asset
		/// whether or not the city has one yet, so the menu needs both facts.
		/// </remarks>
		public bool IsUnique { get; set; }
		public ZoneTypeFilter ZoneType { get; set; } = ZoneTypeFilter.Any;
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
		/// An index rather than a name: the requirement is static, so it costs an int per asset
		/// and the milestone names resolve once into their own table instead of being resolved
		/// again across every prefab each time an unlock triggers a full re-index.
		/// </remarks>
		public int UnlockMilestone { get; set; }

		/// <summary>
		/// The branch of its service's development tree this asset hangs off.
		/// </summary>
		/// <remarks>
		/// CS2 gates assets two ways and the milestone is only one: service buildings are bought
		/// with development points from a per-service tree. The BRANCH rather than the node, since
		/// a node usually unlocks one building while the branches are the service's own split.
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
		/// Signature buildings hang off requirement prefabs — zone built, objects built, citizens,
		/// processing — which vanilla renders through separately composed sentences. Each
		/// requirement contributes its OWN title rather than a reproduction of that grammar.
		/// </remarks>
		public string[] UnlockRequirements { get; set; } = Array.Empty<string>();

		/// <summary>
		/// What the building gives the city, already phrased for display.
		/// </summary>
		/// <remarks>
		/// Signature buildings are bought with progress rather than money, so the effect is the
		/// reason to choose one over another. Read from the two buffers the game applies:
		/// CityModifierData for citywide effects and LocalModifierData for radius ones.
		/// </remarks>
		public EffectLine[] Bonuses { get; set; } = Array.Empty<EffectLine>();
		public ThemePrefab? Theme { get; set; }

		/// <summary>The prefab's own asset packs, which AddPrefab always sets; null only before that.</summary>
		public AssetPackPrefab[]? AssetPacks { get; set; }

		/// <summary>
		/// What the game's own toolbar filter row knows about this asset.
		/// </summary>
		/// <remarks>
		/// Deliberately separate from <see cref="Theme"/> and <see cref="AssetPacks"/>, which are
		/// what the asset IS and drive our own facets. These are what vanilla GATES visibility on,
		/// read from ObjectRequirementElement; matching the wrong one disagrees with the game.
		/// </remarks>
		public VanillaAssetFacts VanillaFacts { get; set; }
		public string[]? ExtensionIds { get; set; }
		/// <summary>
		/// The upgrades this building supports, in the game's own order.
		/// </summary>
		/// <remarks>
		/// The reverse of <see cref="ExtensionIds"/>, which says only that this prefab IS an
		/// upgrade. Kept apart because the query engine reads a non-empty ExtensionIds as
		/// "hide from every menu".
		/// </remarks>
		public string[]? SupportedUpgradeIds { get; set; }
		/// <summary>
		/// The same upgrades, in the same order, by <c>prefab.name</c>.
		/// </summary>
		/// <remarks>
		/// SupportedUpgradeIds holds display names, which the hover card reads. The extension
		/// picker joins against vanilla's own rows, which carry prefab names, so it needs this.
		/// </remarks>
		public string[]? SupportedUpgradePrefabNames { get; set; }
		public int UIOrder { get; set; }
		/// <summary>
		/// A sub-building: placed from its parent's row, never from the grid.
		/// </summary>
		/// <remarks>
		/// The game's own marker, ServiceUpgradeData, and the same test
		/// ToolbarUISystem.FilterOutUpgrades applies before drawing a menu: an upgrade attaches to
		/// a specific building, so a standalone row promises a placement that does not exist.
		/// </remarks>
		public bool IsServiceUpgrade { get; set; }

		public string? UiCategoryName { get; set; }
		public string? UiMenuName { get; set; }

		/// <summary>
		/// The priority of the category the asset is filed under — the game's tab order.
		/// </summary>
		/// <remarks>
		/// Read off the category, not the asset, so one category's assets rank alike: the placed
		/// category's UIObjectData.m_Priority where the game places the asset (see
		/// MenuPlacementOverride), else the managed group's. 0 by default, as vanilla's is, which
		/// puts a category that never set one mid-strip rather than last.
		/// </remarks>
		public int UiCategoryPriority { get; set; }
		/// <summary>
		/// Service figures beyond the headline capacity, keyed for the UI.
		/// </summary>
		/// <remarks>
		/// See <see cref="ServiceFact"/> for why these are a list rather than a
		/// field each. Empty for most of the catalog.
		/// </remarks>
		public List<ServiceFact> ServiceFacts { get; } = new();

		/// <summary>The same, for figures that are words. See ServiceTextFact.</summary>
		public List<ServiceTextFact> ServiceTextFacts { get; } = new();

		/// <summary>
		/// The lot shapes a zone grows, for the card's footprint glyphs.
		/// </summary>
		public ZoneFootprint[]? Footprints { get; set; }

		/// <summary>Shapes beyond the ones drawn, as a "+N".</summary>
		public int FootprintOverflow { get; set; }

		/// <summary>
		/// A network's speed limit, in the game's own km/h.
		/// </summary>
		/// <remarks>
		/// Five components carry it rather than one — RoadData, TrackData, PathwayData,
		/// WaterwayData, TaxiwayData — because CS2 keeps it per network TYPE, so reading it is
		/// five small reads rather than one shared field.
		/// </remarks>
		public float? SpeedLimit { get; set; }

		/// <summary>How wide the network draws, in metres.</summary>
		public float? NetworkWidth { get; set; }

		/// <summary>
		/// How far the building's service reaches, in metres.
		/// </summary>
		/// <remarks>
		/// CoverageData.m_Range for the covered services, or TelecomFacilityData.m_Range for a
		/// tower, which keeps its own. Null where the building serves the whole city or nothing
		/// at all, which is most of the catalog.
		/// </remarks>
		public float? ServiceRange { get; set; }

		/// <summary>
		/// The kind of leisure this building provides, as the game names it.
		/// </summary>
		/// <remarks>
		/// LeisureProviderData.m_LeisureType, held as the enum's own name so the UI can ask the
		/// GAME for the word rather than putting a second vocabulary on the same property. Null
		/// where the prefab provides no leisure at all.
		/// </remarks>
		public string? LeisureType { get; set; }

		/// <summary>How much of it, from the same component.</summary>
		public int? LeisureEfficiency { get; set; }

		public bool HasParking { get; set; }

		/// <summary>
		/// Parking bays, matching what the building has once placed, its sub-objects' included:
		/// PrefabIndexingSystem.GetParkingSlots sums <see cref="Domain.ParkingSlots.Own"/> over the
		/// object and each sub-object.
		/// </summary>
		public int ParkingSlots { get; set; }
		// Nullable analytical values come from the prefab entity already being indexed.
		// A missing component stays missing rather than serializing as a misleading zero.
		/// <summary>
		/// Whether Cost and Upkeep are per kilometre rather than per instance.
		/// </summary>
		/// <remarks>
		/// True for networks, which price by length. The figure is meaningless without it — a
		/// road's cost is a rate and a hospital's a total — and a column showing both unqualified
		/// invites the reader to compare them.
		/// </remarks>
		public bool CostIsPerDistance { get; set; }
		public uint? ConstructionCost { get; set; }
		public int? Upkeep { get; set; }
		public int? Workers { get; set; }

		/// <summary>How many households the building holds.</summary>
		/// <remarks>
		/// BuildingPropertyData.m_ResidentialProperties, the answer the game's own info panels
		/// use. Kept apart from Capacity rather than folded in: Capacity is derived from service
		/// components a residential building has none of.
		/// </remarks>
		public int? Households { get; set; }
		public double? Capacity { get; set; }
		public float? ElectricityConsumption { get; set; }

		/// <summary>
		/// What the building asks of the telecom network.
		/// </summary>
		public float? TelecomNeed { get; set; }
		public float? WaterConsumption { get; set; }
		public float? GarbageAccumulation { get; set; }
		public int? WaterCapacity { get; set; }
		public int? SewageCapacity { get; set; }
		public float? GroundPollution { get; set; }
		public float? AirPollution { get; set; }
		public float? NoisePollution { get; set; }

		public PrefabIndex(PrefabBase prefabBase) : base(prefabBase)
		{
		}
	}
}
