using Colossal.UI.Binding;
using FindItBuildingMenu.Domain.Enums;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// One assignable zone, as the zoning hierarchy presents it.
	/// </summary>
	/// <remarks>
	/// Family and density both come from the zone's own data rather than its
	/// name: <c>ZoneData.m_AreaType</c> plus <c>ZoneFlags.Office</c> for the
	/// family, and the <c>ZonePropertiesData</c> derivation IndexZones already
	/// performs for the density.
	///
	/// The remaining fields are what the game knows about a zone and never shows
	/// anyone. <c>MaxHeight</c> is not authored: ZoneSystem seeds it to zero and
	/// BuildingInitializeSystem raises it to the tallest mesh of every spawnable
	/// building assigned to the zone, so it is a measured answer to "how tall
	/// does this grow" rather than an estimate. The corner and narrow flags are
	/// derived the same way, from the level-1 buildings the zone can spawn. The
	/// allowed resources come from ZonePropertiesData and say what a commercial
	/// or industrial zone will actually trade in.
	///
	/// <c>Id</c> and <c>Version</c> are the ECS entity's two halves. They are
	/// runtime values and must not be persisted; the UI needs both to hand the
	/// entity back to the game's own toolbar.selectAsset trigger, which is what
	/// actually activates the Zone tool.
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
		/// Still behind a milestone. Read from the enableable Locked component,
		/// the same source the building index uses.
		/// </summary>
		/// <remarks>
		/// Zones carried no lock state at all until this: high-density
		/// residential is locked at the start of a city and the lens drew it
		/// exactly like an unlocked one, so the only way to learn it was
		/// unavailable was to try to paint with it.
		/// </remarks>
		bool IsLocked = false,
		/// <summary>Milestone index it unlocks at, 0 when not locked.</summary>
		int UnlockMilestone = 0,
		/// <summary>Everything standing between the player and this zone.</summary>
		string[]? UnlockRequirements = null,
		/// <summary>
		/// The natural resource an extractor area works, empty for a zone.
		/// </summary>
		/// <remarks>
		/// Non-empty marks this entry as an AREA rather than a zone: a LotPrefab
		/// carrying ExtractorArea, painted with the Area tool. Grain, livestock
		/// and cotton live here, not in any zone — Game.Zones.AreaType has only
		/// None, Residential, Commercial and Industrial, so there is no
		/// specialised zone type for them to be.
		/// </remarks>
		string? MapFeature = null) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("id");
			writer.Write(Id);
			writer.PropertyName("version");
			writer.Write(Version);
			writer.PropertyName("prefabName");
			writer.Write(PrefabName);
			writer.PropertyName("name");
			writer.Write(Name);
			writer.PropertyName("family");
			writer.Write(Family);
			writer.PropertyName("density");
			writer.Write(Density.ToString());
			writer.PropertyName("thumbnail");
			writer.Write(Thumbnail);
			writer.PropertyName("maxHeight");
			writer.Write(MaxHeight);
			writer.PropertyName("supportsNarrow");
			writer.Write(SupportsNarrow);
			writer.PropertyName("supportsCorners");
			writer.Write(SupportsCorners);
			writer.PropertyName("allowedSold");
			writer.Write(AllowedSold ?? string.Empty);
			writer.PropertyName("allowedManufactured");
			writer.Write(AllowedManufactured ?? string.Empty);
			writer.PropertyName("allowedStored");
			writer.Write(AllowedStored ?? string.Empty);
			writer.PropertyName("minLotWidth");
			writer.Write(MinLotWidth);
			writer.PropertyName("maxLotWidth");
			writer.Write(MaxLotWidth);
			writer.PropertyName("minLotDepth");
			writer.Write(MinLotDepth);
			writer.PropertyName("maxLotDepth");
			writer.Write(MaxLotDepth);
			writer.PropertyName("footprints");
			var footprints = Footprints ?? System.Array.Empty<ZoneFootprint>();
			writer.ArrayBegin((uint)footprints.Length);
			foreach (ZoneFootprint footprint in footprints)
			{
				footprint.Write(writer);
			}
			writer.ArrayEnd();
			writer.PropertyName("footprintOverflow");
			writer.Write(FootprintOverflow);
			writer.PropertyName("isLocked");
			writer.Write(IsLocked);
			writer.PropertyName("unlockMilestone");
			writer.Write(UnlockMilestone);
			writer.PropertyName("mapFeature");
			writer.Write(MapFeature ?? string.Empty);
			writer.PropertyName("unlockRequirements");
			var requirements = UnlockRequirements ?? System.Array.Empty<string>();
			writer.ArrayBegin((uint)requirements.Length);
			foreach (string requirement in requirements)
			{
				writer.Write(requirement);
			}
			writer.ArrayEnd();
			writer.TypeEnd();
		}
	}
}
