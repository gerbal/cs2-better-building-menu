using System;
using Colossal.UI.Binding;

using BetterBuildingMenu.Domain.Enums;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The stable, UI-facing projection of a building in the prefab index. It carries no ECS
	/// handles and no mutable prefab objects, so catalog work stays separate from indexing
	/// and placement.
	/// </summary>
	public sealed record BuildingCatalogEntry(
		int Id,
		string PrefabName,
		string Name,
		string Category,
		string SubCategory,
		string Thumbnail,
		int LotWidth,
		int LotDepth,
		int BuildingLevel,
		ZoneTypeFilter ZoneType,
		bool HasParking,
		bool IsVanilla,
		string PdxModsId,
		double? ConstructionCost = null,
		double? Upkeep = null,
		double? Workers = null,
		/// <summary>Households the building holds; null when it is not residential.</summary>
		double? Households = null,
		double? Capacity = null,
		double? ElectricityConsumption = null,
		double? WaterConsumption = null,
		double? GarbageAccumulation = null,
		double? TelecomNeed = null,
		double? WaterCapacity = null,
		double? SewageCapacity = null,
		double? GroundPollution = null,
		double? AirPollution = null,
		double? NoisePollution = null,
		string? BuildingType = null,
		int? EducationLevel = null,
		string? Provenance = null,
		string? DlcId = null,
		string? Theme = null,
		string[]? AssetPacks = null,
		/// <summary>The pack entities this asset belongs to, by index.</summary>
		/// <remarks>
		/// Beside the names above rather than replacing them: the names are what a card shows, and
		/// the indices are what vanilla's pack SELECTION is keyed on, which the facet must speak to
		/// write back to the game's own toolbar. Backend only — never serialized.
		/// </remarks>
		int[]? AssetPackIndices = null,
		string[]? PlacementFlags = null,
		string[]? Extensions = null,
		string? CategoryLabel = null,
		string? SubCategoryLabel = null,
		/// <summary>
		/// Whether the game still has this behind a milestone.
		/// </summary>
		bool IsLocked = false,
		/// <summary>Only one of these may exist in a city.</summary>
		/// <remarks>
		/// Beside IsAlreadyBuilt because vanilla badges BOTH states — one icon
		/// for a unique you have not built, another for one you have — so the
		/// tile needs to tell them apart from an ordinary asset.
		/// </remarks>
		bool IsUnique = false,
		/// <summary>A unique asset the city already holds one of.</summary>
		/// <remarks>
		/// Read per query rather than stored at index time, because it changes
		/// as the player builds and bulldozes — see PlacedUniques.
		/// </remarks>
		bool IsAlreadyBuilt = false,
		/// <summary>
		/// Icon to draw when <see cref="Thumbnail"/> resolves to nothing.
		/// </summary>
		/// <remarks>
		/// Kept separate rather than folded into Thumbnail with a null-coalesce. The failure this
		/// exists for is not a null URL but a non-null one that renders nothing, which only the
		/// renderer can detect, so both have to reach it.
		/// </remarks>
		string? FallbackThumbnail = null,
		/// <summary>
		/// A black copy of <see cref="Thumbnail"/>, when it is a vector.
		/// </summary>
		/// <remarks>
		/// Vanilla silhouettes a locked asset by filtering its thumbnail, and that filter is
		/// unusable over an SVG in this engine — see SilhouetteIcons. Empty for raster thumbnails,
		/// which keep vanilla's filter, and empty when the icon is not on disk.
		/// </remarks>
		string? SilhouetteThumbnail = null,
		/// <summary>
		/// Where the GAME puts this asset in the build menu.
		/// </summary>
		string? UiMenu = null,
		string? UiCategory = null,
		/// <summary>
		/// Where in the progression the asset is gated, and what it is waiting
		/// on. Only the requirements are limited to IsLocked.
		/// </summary>
		/// <remarks>
		/// The MILESTONE is a property of the asset — the point the game gates it behind — so it
		/// survives unlocking. Index 0 means UNGATED, since the game's milestones start at 1. An
		/// index, not a name: the names are published once in their own table.
		/// </remarks>
		int UnlockMilestone = 0,
		/// <summary>
		/// The branch of its service's development tree the asset hangs off.
		/// </summary>
		/// <remarks>
		/// The milestone's counterpart: milestones gate on city growth, development-tree nodes on
		/// points spent per service, and a service menu is almost entirely the second. See
		/// PrefabIndex.DevTreeBranch for why the branch and not the node.
		/// </remarks>
		string? DevTreeBranch = null,
		string? DevTreeBranchIcon = null,
		int DevTreeBranchDepth = 0,
		string[]? UnlockRequirements = null,
		/// <summary>
		/// What the building gives the city. Signature buildings are free, so
		/// the effect is the whole basis for choosing one over another.
		/// </summary>
		string[]? Bonuses = null,
		/// <summary>
		/// Cost and Upkeep are per kilometre, not per instance. True for
		/// networks, which price by length.
		/// </summary>
		bool CostIsPerDistance = false,
		/// <summary>
		/// Approximate parking bays; zero means none. A count rather than a flag, so that sorting
		/// by parking can actually order rows.
		/// </summary>
		int ParkingSlots = 0,
		/// <summary>
		/// The game's sort order for <see cref="UiCategory"/> within its menu.
		/// </summary>
		/// <remarks>
		/// Ordering only, never rendered, so it is deliberately absent from <see cref="Write"/>: the
		/// UI preserves the order C# sent. Zero, not int.MaxValue, when the category has no UIObject,
		/// which is vanilla's own default and sorts such a category into the middle.
		/// </remarks>
		int UiCategoryPriority = 0,
		/// <summary>
		/// Where <see cref="UiCategory"/>'s tab sits in its menu's strip, counted from 0, in one
		/// menu's view; int.MaxValue in any other, or when the menu draws no such tab.
		/// </summary>
		/// <remarks>
		/// Ordering only, like the priority: it breaks the ties the priority leaves the way the strip
		/// breaks them, so the All tab's headings read in the strip's order.
		/// </remarks>
		int UiCategoryTab = int.MaxValue,
		/// <summary>How far the building's service reaches, in metres.</summary>
		double? ServiceRange = null,
		/// <summary>
		/// Service figures beyond the headline capacity — see ServiceFact.
		/// </summary>
		IReadOnlyList<ServiceFact>? ServiceFacts = null,
		IReadOnlyList<ServiceTextFact>? ServiceTextFacts = null,
		/// <summary>Lot shapes a zone grows — see PrefabIndex.Footprints.</summary>
		IReadOnlyList<ZoneFootprint>? Footprints = null,
		int FootprintOverflow = 0,
		/// <summary>A network's speed limit in km/h; null for anything else.</summary>
		double? SpeedLimit = null,
		/// <summary>How wide a network draws, in metres; null for anything else.</summary>
		double? NetworkWidth = null,
		/// <summary>
		/// The leisure this building provides, named as the game names it.
		/// </summary>
		/// <remarks>
		/// The enum's own name — "CityPark", "CityIndoors" — so the UI can
		/// resolve vanilla's Properties.LEISURE_TYPE key rather than inventing a
		/// second word for a property the player already reads elsewhere.
		/// Empty for the great majority of the catalog, which provides none.
		/// </remarks>
		string LeisureType = "",
		double? LeisureEfficiency = null,
		/// <summary>
		/// Vanilla's own order for this asset: UIObject.m_Priority ascending.
		/// </summary>
		/// <remarks>
		/// The whole of the game's sort: UIObjectInfo.CompareTo compares this integer and nothing
		/// else, so equal priorities land wherever the unstable sort puts them. Zero for an asset
		/// with no UIObject, which is what vanilla reads, rather than PrefabIndex.UIOrder's sentinel.
		/// </remarks>
		int UIOrder = 0,
		/// <summary>
		/// The upgrades that can be attached to this building later.
		/// </summary>
		/// <remarks>
		/// Not <see cref="Extensions"/>, and the distinction is load-bearing: Extensions says the
		/// asset IS an upgrade, and the query engine drops such a prefab from every menu, so the two
		/// can never share a field. Read from the building prefab's own reverse index.
		/// </remarks>
		string[]? SupportedUpgrades = null,
		// The headings this entry files under, set on the page by CatalogView from
		// BuildingCatalogGroupDimension.Labels: the UI builds its group tree from consecutive runs
		// of these. LabelId is the game's category id, so the UI can localise that one.
		string[]? GroupPath = null,
		string? GroupLabelId = null) : IJsonWritable
	{
		// Search compares these three folded (SearchFold). Folding each once, when the entry is
		// built, is what keeps a keystroke from refolding the whole menu, and the setters refold
		// on a `with` copy that changes one. Equality is unchanged: each fold follows its field.
		private readonly string _prefabName = PrefabName;
		private readonly string _name = Name;
		private readonly string _pdxModsId = PdxModsId;
		private readonly string _searchPrefabName = SearchFold.Fold(PrefabName);
		private readonly string _searchName = SearchFold.Fold(Name);
		private readonly string _searchPdxModsId = SearchFold.Fold(PdxModsId);

		public string PrefabName { get => _prefabName; init { _prefabName = value; _searchPrefabName = SearchFold.Fold(value); } }

		public string Name { get => _name; init { _name = value; _searchName = SearchFold.Fold(value); } }

		public string PdxModsId { get => _pdxModsId; init { _pdxModsId = value; _searchPdxModsId = SearchFold.Fold(value); } }

		internal string SearchPrefabName => _searchPrefabName;

		internal string SearchName => _searchName;

		internal string SearchPdxModsId => _searchPdxModsId;

		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);

			writer.Prop("id", Id);
			writer.Prop("prefabName", PrefabName);
			writer.Prop("name", Name);
			writer.Prop("category", Category);
			writer.Prop("subCategory", SubCategory);
			writer.Prop("categoryLabel", CategoryLabel ?? Category);
			writer.Prop("subCategoryLabel", SubCategoryLabel ?? SubCategory);
			writer.Prop("thumbnail", Thumbnail);
			writer.Prop("fallbackThumbnail", FallbackThumbnail ?? string.Empty);
			writer.Prop("silhouetteThumbnail", SilhouetteThumbnail ?? string.Empty);
			writer.Prop("lotWidth", LotWidth);
			writer.Prop("lotDepth", LotDepth);
			writer.Prop("buildingLevel", BuildingLevel);
			writer.Prop("zoneType", (int)ZoneType);
			writer.Prop("hasParking", HasParking);
			writer.Prop("isVanilla", IsVanilla);
			writer.Prop("isLocked", IsLocked);
			writer.Prop("isUnique", IsUnique);
			writer.Prop("isAlreadyBuilt", IsAlreadyBuilt);
			writer.Prop("unlockMilestone", UnlockMilestone);
			writer.Prop("devTreeBranch", DevTreeBranch ?? string.Empty);
			// The tree column, so the UI can order its headings by unlock the way the tabs
			// already are rather than in encounter order.
			writer.Prop("devTreeBranchDepth", DevTreeBranchDepth);
			writer.Prop("unlockRequirements", NonBlank(UnlockRequirements));
			writer.Prop("bonuses", NonBlank(Bonuses));
			writer.Prop("costIsPerDistance", CostIsPerDistance);
			writer.Prop("parkingSlots", ParkingSlots);
			writer.Prop("pdxModsId", PdxModsId);
			writer.Prop("educationLevel", EducationLevel);
			writer.Prop("buildingType", BuildingType ?? string.Empty);
			writer.Prop("provenance", Provenance ?? string.Empty);
			writer.Prop("dlcId", DlcId ?? string.Empty);
			writer.Prop("theme", Theme ?? string.Empty);
			writer.Prop("assetPacks", NonBlank(AssetPacks));
			writer.Prop("placementFlags", NonBlank(PlacementFlags));
			writer.Prop("extensions", NonBlank(Extensions));
			writer.Prop("supportedUpgrades", NonBlank(SupportedUpgrades));
			writer.Prop("constructionCost", ConstructionCost);
			writer.Prop("upkeep", Upkeep);
			writer.Prop("workers", Workers);
			writer.Prop("households", Households);
			writer.Prop("capacity", Capacity);
			writer.Prop("serviceRange", ServiceRange);
			writer.Prop("serviceFacts", ServiceFacts);
			writer.Prop("footprints", Footprints);
			writer.Prop("footprintOverflow", FootprintOverflow);
			writer.Prop("serviceTextFacts", ServiceTextFacts);
			writer.Prop("speedLimit", SpeedLimit);
			writer.Prop("networkWidth", NetworkWidth);
			writer.Prop("leisureType", LeisureType ?? string.Empty);
			writer.Prop("leisureEfficiency", LeisureEfficiency);
			writer.Prop("electricityConsumption", ElectricityConsumption);
			writer.Prop("waterConsumption", WaterConsumption);
			writer.Prop("garbageAccumulation", GarbageAccumulation);
			writer.Prop("telecomNeed", TelecomNeed);
			writer.Prop("waterCapacity", WaterCapacity);
			writer.Prop("sewageCapacity", SewageCapacity);
			writer.Prop("groundPollution", GroundPollution);
			writer.Prop("airPollution", AirPollution);
			writer.Prop("noisePollution", NoisePollution);
			writer.Prop("groupPath", GroupPath);
			writer.Prop("groupLabelId", GroupLabelId ?? string.Empty);

			writer.TypeEnd();
		}

		// The string lists the UI receives hold no blank members.
		private static string[] NonBlank(IEnumerable<string>? values) =>
			values?.Where(value => !string.IsNullOrWhiteSpace(value)).ToArray() ?? Array.Empty<string>();
	}
}
