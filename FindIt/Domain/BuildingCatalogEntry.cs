using Colossal.UI.Binding;

using FindItBuildingMenu.Domain.Enums;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// The stable, UI-facing projection of a building already present in FindIt's
	/// prefab index. It intentionally contains no ECS handles or mutable prefab
	/// objects so catalog work can remain separate from indexing and placement.
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
		bool IsUniqueMesh,
		bool IsVanilla,
		bool IsFavorited,
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
		/// Beside the names above rather than replacing them: the names are what
		/// a card shows, the indices are what vanilla's pack SELECTION is keyed
		/// on, and the facet has to speak the second to write back to the game's
		/// own toolbar. Backend only — never serialized.
		/// </remarks>
		int[]? AssetPackIndices = null,
		string[]? PlacementFlags = null,
		string? VanillaSection = null,
		string? VanillaSubCategory = null,
		string[]? Extensions = null,
		string? CategoryLabel = null,
		string? SubCategoryLabel = null,
		/// <summary>
		/// Whether the game still has this behind a milestone.
		/// </summary>
		/// <remarks>
		/// Defaulted, and last, so the construction sites that predate it stay
		/// untouched — inserting it mid-record broke every test that builds an
		/// entry positionally, which is a lot of noise for one flag.
		/// </remarks>
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
		/// Kept separate rather than folded into Thumbnail with a null-coalesce.
		/// The failure this exists for is not a null URL, it is a non-null one
		/// that renders nothing: the game's thumbnail camera has no render for
		/// spawnable zone buildings, because vanilla never shows them in a menu.
		/// Only the renderer can tell that happened, so both have to reach it.
		/// Last and defaulted, for the same reason as IsLocked above.
		/// </remarks>
		string? FallbackThumbnail = null,
		/// <summary>
		/// A black copy of <see cref="Thumbnail"/>, when it is a vector.
		/// </summary>
		/// <remarks>
		/// Vanilla silhouettes a locked asset by filtering its thumbnail, and
		/// that filter is unusable over an SVG in this engine — see
		/// SilhouetteIcons. So a vector-thumbnailed entry carries a pre-blackened
		/// copy of its own icon and the locked view swaps to it instead of
		/// filtering. Empty for raster thumbnails, which keep vanilla's filter,
		/// and empty when the icon could not be found on disk, in which case the
		/// tile falls back to its normal artwork.
		/// </remarks>
		string? SilhouetteThumbnail = null,
		/// <summary>
		/// SPIKE (cm-e98i): where the GAME puts this asset in the build menu.
		/// </summary>
		string? UiMenu = null,
		string? UiCategory = null,
		/// <summary>
		/// Where in the progression the asset is gated, and what it is waiting
		/// on. Only the requirements are limited to IsLocked.
		/// </summary>
		/// <remarks>
		/// The MILESTONE is a property of the asset — the point the game gates
		/// it behind — not of how far the player has got, so it is kept whatever
		/// the current lock state. It used to be zeroed on unlock, which dropped
		/// an asset out of its own tier at the moment it was earned.
		///
		/// Index 0 means UNGATED rather than "the first milestone": the game's
		/// milestones start at 1, so nothing is ever gated behind 0.
		///
		/// Milestone as an index rather than a name: the ~20 names are published
		/// once in their own table, so a locked asset costs an int instead of a
		/// string re-resolved on every unlock-triggered re-index. Requirements
		/// arrive already localized, because they have no shared ordinal the way
		/// milestones do.
		/// </remarks>
		int UnlockMilestone = 0,
		/// <summary>
		/// The branch of its service's development tree the asset hangs off.
		/// </summary>
		/// <remarks>
		/// The milestone's counterpart. Milestones gate on city growth and
		/// development-tree nodes gate on points spent per service, and a
		/// service menu is almost entirely the second — so this is the axis that
		/// splits the menus vanilla gives no categories to. See
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
		/// Approximate parking bays. Zero means none; a boolean could not say
		/// how many, and made sorting by parking a no-op.
		/// </summary>
		int ParkingSlots = 0,
		/// <summary>
		/// The game's sort order for <see cref="UiCategory"/> within its menu.
		/// </summary>
		/// <remarks>
		/// Ordering only, never rendered — so it is deliberately absent from
		/// <see cref="Write"/>. The UI derives its headings from UiCategory and
		/// preserves the order C# sent, so the rank has no work to do there and
		/// serialising it would cost a field on all ~3,667 entries to say
		/// something the wire already implies.
		///
		/// Zero, not int.MaxValue, when the category has no UIObject: that is
		/// vanilla's own default (UIObjectInfo.GetObjects), and it sorts such a
		/// category into the middle rather than pushing it to the end.
		/// </remarks>
		int UiCategoryPriority = 0,
		/// <summary>
		/// The upgrades that can be attached to this building later.
		/// </summary>
		/// <remarks>
		/// Not <see cref="Extensions"/>, and the distinction is load-bearing.
		/// Extensions answers "is this asset ITSELF an upgrade" — the indexer tags
		/// such a prefab with its own name — and the query engine reads a non-empty
		/// value as vanilla's FilterOutUpgrades does: drop it from every menu. So
		/// the two can never share a field. Filling Extensions with the upgrades a
		/// building supports would delete every upgradeable building from the menus.
		///
		/// Read from the building prefab's own reverse index the way
		/// UpgradeMenuUISystem builds its list — see
		/// PrefabIndexingSystem.GetSupportedUpgrades.
		/// </remarks>
		string[]? SupportedUpgrades = null) : IJsonWritable
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
			// VanillaSection and VanillaSubCategory are NOT written. They are the
			// query engine's, used to scope a menu server-side, and no component
			// has ever read them off an entry — so sending them was two strings
			// per row per render for nothing. The record keeps both; only the
			// wire loses them.
			writer.PropertyName("thumbnail");
			writer.Write(Thumbnail);
			writer.PropertyName("fallbackThumbnail");
			writer.Write(FallbackThumbnail ?? string.Empty);
			writer.PropertyName("silhouetteThumbnail");
			writer.Write(SilhouetteThumbnail ?? string.Empty);
			writer.PropertyName("uiMenu");
			writer.Write(UiMenu ?? string.Empty);
			writer.PropertyName("uiCategory");
			writer.Write(UiCategory ?? string.Empty);
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
			// Same for IsUniqueMesh: it drives a server-side filter in Filters.cs
			// and nothing renders it.
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
			// The tree column, so the UI can order its headings by unlock the
			// way the tabs already are. Without it the grouped view formed
			// groups in encounter order and, sorted by name, drew Coal Power
			// Plant above the basic buildings it is unlocked long after.
			writer.PropertyName("devTreeBranchDepth");
			writer.Write(DevTreeBranchDepth);
			WriteStringArray(writer, "unlockRequirements", UnlockRequirements);
			WriteStringArray(writer, "bonuses", Bonuses);
			writer.PropertyName("costIsPerDistance");
			writer.Write(CostIsPerDistance);
			writer.PropertyName("parkingSlots");
			writer.Write(ParkingSlots);
			writer.PropertyName("isFavorited");
			writer.Write(IsFavorited);
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
			WriteNullable(writer, "electricityConsumption", ElectricityConsumption);
			WriteNullable(writer, "waterConsumption", WaterConsumption);
			WriteNullable(writer, "garbageAccumulation", GarbageAccumulation);
			WriteNullable(writer, "waterCapacity", WaterCapacity);
			WriteNullable(writer, "sewageCapacity", SewageCapacity);
			WriteNullable(writer, "groundPollution", GroundPollution);
			WriteNullable(writer, "airPollution", AirPollution);
			WriteNullable(writer, "noisePollution", NoisePollution);

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
