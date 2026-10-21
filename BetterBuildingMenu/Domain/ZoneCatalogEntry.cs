using Colossal.UI.Binding;
using BetterBuildingMenu.Domain.Enums;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One assignable zone, as the zoning hierarchy presents it.
	/// </summary>
	/// <remarks>
	/// Family and density come from the zone's own data, not its name; MaxHeight and
	/// the corner and narrow flags are derived from the buildings it can spawn.
	/// <c>Id</c> and <c>Version</c> are the entity's halves: runtime, never persisted.
	/// </remarks>
	public sealed record ZoneCatalogEntry(
		int Id,
		int Version,
		string PrefabName,
		string Name,
		string Family,
		ZoneTypeFilter Density,
		string Thumbnail,
		/// <summary>Tallest spawnable building, in metres. 0 when unknown.</summary>
		int MaxHeight = 0,
		/// <summary>The zone accepts a one-cell-wide lot.</summary>
		bool SupportsNarrow = false,
		/// <summary>The zone has a building that fits a left or right corner.</summary>
		bool SupportsCorners = false,
		/// <summary>What a commercial or industrial zone trades in, if anything.</summary>
		string? AllowedSold = null,
		string? AllowedManufactured = null,
		string? AllowedStored = null,
		/// <summary>Lot sizes the zone's spawnable buildings occupy. 0 = none known.</summary>
		int MinLotWidth = 0,
		int MaxLotWidth = 0,
		int MinLotDepth = 0,
		int MaxLotDepth = 0,
		/// <summary>Distinct lot shapes, narrowest first. Empty when unknown.</summary>
		ZoneFootprint[]? Footprints = null,
		/// <summary>Shapes beyond the display cap, counted rather than dropped.</summary>
		int FootprintOverflow = 0,
		/// <summary>
		/// Still behind a milestone. Read from the enableable Locked component, the
		/// same source the building index uses.
		/// </summary>
		bool IsLocked = false,
		/// <summary>Milestone index it unlocks at, 0 when not locked.</summary>
		int UnlockMilestone = 0,
		/// <summary>Everything standing between the player and this zone.</summary>
		string[]? UnlockRequirements = null,
		/// <summary>
		/// The natural resource an extractor area works, empty for a zone.
		/// </summary>
		/// <remarks>
		/// Non-empty marks this entry as an AREA rather than a zone: a LotPrefab carrying
		/// ExtractorArea, painted with the Area tool. Game.Zones.AreaType has no
		/// specialised type for grain, livestock or cotton, so they can only live here.
		/// </remarks>
		string? MapFeature = null) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.Prop("id", Id);
			writer.Prop("version", Version);
			writer.Prop("prefabName", PrefabName);
			writer.Prop("name", Name);
			writer.Prop("family", Family);
			writer.Prop("density", Density.ToString());
			writer.Prop("thumbnail", Thumbnail);
			writer.Prop("maxHeight", MaxHeight);
			writer.Prop("supportsNarrow", SupportsNarrow);
			writer.Prop("supportsCorners", SupportsCorners);
			writer.Prop("allowedSold", AllowedSold ?? string.Empty);
			writer.Prop("allowedManufactured", AllowedManufactured ?? string.Empty);
			writer.Prop("allowedStored", AllowedStored ?? string.Empty);
			writer.Prop("minLotWidth", MinLotWidth);
			writer.Prop("maxLotWidth", MaxLotWidth);
			writer.Prop("minLotDepth", MinLotDepth);
			writer.Prop("maxLotDepth", MaxLotDepth);
			writer.Prop("footprints", Footprints);
			writer.Prop("footprintOverflow", FootprintOverflow);
			writer.Prop("isLocked", IsLocked);
			writer.Prop("unlockMilestone", UnlockMilestone);
			writer.Prop("mapFeature", MapFeature ?? string.Empty);
			writer.Prop("unlockRequirements", UnlockRequirements);
			writer.TypeEnd();
		}
	}
}
