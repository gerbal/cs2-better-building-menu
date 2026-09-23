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
		/// as the player builds and bulldozes — see PlacedUniqueRegistry.
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
		// BuildingCatalogGrouping.Labels: the UI builds its group tree from consecutive runs
		// of these. LabelId is the game's category id, so the UI can localise that one.
		string[]? GroupPath = null,
		string? GroupLabelId = null) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);

			writer.PropertyName("id");
			writer.Write(Id);
			writer.PropertyName("prefabName");
			writer.Write(PrefabName);
			writer.PropertyName("name");
			writer.Write(Name);
			writer.PropertyName("category");
			writer.Write(Category);
			writer.PropertyName("subCategory");
			writer.Write(SubCategory);
			writer.PropertyName("categoryLabel");
			writer.Write(CategoryLabel ?? Category);
			writer.PropertyName("subCategoryLabel");
			writer.Write(SubCategoryLabel ?? SubCategory);
			writer.PropertyName("thumbnail");
			writer.Write(Thumbnail);
			writer.PropertyName("fallbackThumbnail");
			writer.Write(FallbackThumbnail ?? string.Empty);
			writer.PropertyName("silhouetteThumbnail");
			writer.Write(SilhouetteThumbnail ?? string.Empty);
			writer.PropertyName("lotWidth");
			writer.Write(LotWidth);
			writer.PropertyName("lotDepth");
			writer.Write(LotDepth);
			writer.PropertyName("buildingLevel");
			writer.Write(BuildingLevel);
			writer.PropertyName("zoneType");
			writer.Write((int)ZoneType);
			writer.PropertyName("hasParking");
			writer.Write(HasParking);
			writer.PropertyName("isVanilla");
			writer.Write(IsVanilla);
			writer.PropertyName("isLocked");
			writer.Write(IsLocked);
			writer.PropertyName("isUnique");
			writer.Write(IsUnique);
			writer.PropertyName("isAlreadyBuilt");
			writer.Write(IsAlreadyBuilt);
			writer.PropertyName("unlockMilestone");
			writer.Write(UnlockMilestone);
			writer.PropertyName("devTreeBranch");
			writer.Write(DevTreeBranch ?? string.Empty);
			// The tree column, so the UI can order its headings by unlock the way the tabs
			// already are rather than in encounter order.
			writer.PropertyName("devTreeBranchDepth");
			writer.Write(DevTreeBranchDepth);
			WriteStringArray(writer, "unlockRequirements", UnlockRequirements);
			WriteStringArray(writer, "bonuses", Bonuses);
			writer.PropertyName("costIsPerDistance");
			writer.Write(CostIsPerDistance);
			writer.PropertyName("parkingSlots");
			writer.Write(ParkingSlots);
			writer.PropertyName("pdxModsId");
			writer.Write(PdxModsId);
			writer.PropertyName("educationLevel");
			if (EducationLevel.HasValue) writer.Write(EducationLevel.Value); else writer.WriteNull();
			writer.PropertyName("buildingType");
			writer.Write(BuildingType ?? string.Empty);
			writer.PropertyName("provenance");
			writer.Write(Provenance ?? string.Empty);
			writer.PropertyName("dlcId");
			writer.Write(DlcId ?? string.Empty);
			writer.PropertyName("theme");
			writer.Write(Theme ?? string.Empty);
			WriteStringArray(writer, "assetPacks", AssetPacks);
			WriteStringArray(writer, "placementFlags", PlacementFlags);
			WriteStringArray(writer, "extensions", Extensions);
			WriteStringArray(writer, "supportedUpgrades", SupportedUpgrades);
			WriteNullable(writer, "constructionCost", ConstructionCost);
			WriteNullable(writer, "upkeep", Upkeep);
			WriteNullable(writer, "workers", Workers);
			WriteNullable(writer, "households", Households);
			WriteNullable(writer, "capacity", Capacity);
			WriteNullable(writer, "serviceRange", ServiceRange);
			writer.PropertyName("serviceFacts");
			writer.ArrayBegin(ServiceFacts?.Count ?? 0);
			for (var i = 0; i < (ServiceFacts?.Count ?? 0); i++)
			{
				ServiceFacts![i].Write(writer);
			}
			writer.ArrayEnd();
			writer.PropertyName("footprints");
			writer.ArrayBegin(Footprints?.Count ?? 0);
			for (var i = 0; i < (Footprints?.Count ?? 0); i++)
			{
				Footprints![i].Write(writer);
			}
			writer.ArrayEnd();
			writer.PropertyName("footprintOverflow");
			writer.Write(FootprintOverflow);
			writer.PropertyName("serviceTextFacts");
			writer.ArrayBegin(ServiceTextFacts?.Count ?? 0);
			for (var i = 0; i < (ServiceTextFacts?.Count ?? 0); i++)
			{
				ServiceTextFacts![i].Write(writer);
			}
			writer.ArrayEnd();
			WriteNullable(writer, "speedLimit", SpeedLimit);
			WriteNullable(writer, "networkWidth", NetworkWidth);
			writer.PropertyName("leisureType");
			writer.Write(LeisureType ?? string.Empty);
			WriteNullable(writer, "leisureEfficiency", LeisureEfficiency);
			WriteNullable(writer, "electricityConsumption", ElectricityConsumption);
			WriteNullable(writer, "waterConsumption", WaterConsumption);
			WriteNullable(writer, "garbageAccumulation", GarbageAccumulation);
			WriteNullable(writer, "telecomNeed", TelecomNeed);
			WriteNullable(writer, "waterCapacity", WaterCapacity);
			WriteNullable(writer, "sewageCapacity", SewageCapacity);
			WriteNullable(writer, "groundPollution", GroundPollution);
			WriteNullable(writer, "airPollution", AirPollution);
			WriteNullable(writer, "noisePollution", NoisePollution);
			writer.PropertyName("groupPath");
			var path = GroupPath ?? Array.Empty<string>();
			writer.ArrayBegin((uint)path.Length);
			foreach (var label in path)
			{
				writer.Write(label);
			}
			writer.ArrayEnd();
			writer.PropertyName("groupLabelId");
			writer.Write(GroupLabelId ?? string.Empty);

			writer.TypeEnd();
		}

		private static void WriteNullable(IJsonWriter writer, string propertyName, double? value)
		{
			writer.PropertyName(propertyName);
			if (value.HasValue)
			{
				writer.Write(value.Value);
			}
			else
			{
				writer.WriteNull();
			}
		}

		private static void WriteStringArray(IJsonWriter writer, string propertyName, IEnumerable<string>? values)
		{
			writer.PropertyName(propertyName);
			string[] normalized = values?.Where(value => !string.IsNullOrWhiteSpace(value)).ToArray() ?? Array.Empty<string>();
			writer.ArrayBegin((uint)normalized.Length);
			foreach (string value in normalized)
			{
				writer.Write(value);
			}
			writer.ArrayEnd();
		}
	}
}
