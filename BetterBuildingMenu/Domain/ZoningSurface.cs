using Colossal.UI.Binding;
using BetterBuildingMenu.Domain.Enums;

using Game.Prefabs;
using Game.Zones;

using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain;

/// <summary>
/// Stable identifiers for the zoning families the vanilla Zones menu is built
/// from. These cross the C# / Gameface boundary and must not change when
/// runtime toolbar entities do.
/// </summary>
public static class ZoningFamilies
{
	public const string Residential = "ZoneResidential";
	public const string Commercial = "ZoneCommercial";
	public const string Industrial = "ZoneIndustrial";
	public const string Office = "ZoneOffice";
	/// <summary>
	/// Kept for the zone-spawned building mapping, but unreachable as a zone
	/// family.
	/// </summary>
	/// <remarks>
	/// Extractors are not zones. An extractor area is a LotPrefab carrying
	/// <c>ExtractorAreaData</c> with a <c>MapFeature</c> — fertile land, forest,
	/// ore, oil — and it has no <c>ZoneData</c> at all, while
	/// <c>AreaType</c> has only None, Residential, Commercial and Industrial and
	/// <c>ZoneFlags</c> only Office alongside three corner-support bits. The
	/// zone index queries ZoneData, so no extractor can ever appear in it.
	///
	/// The name stem that used to guess at this family has been removed for that
	/// reason: it could only ever have matched a zone named "…Extractor…", and
	/// the family it produced would have had nothing behind it. The family list
	/// is filtered to what the city actually has, so the chip never offers it.
	/// </remarks>
	public const string Extractors = "ZoneExtractors";
}

/// <summary>
/// A flat, serializable descriptor for one zoning family.
/// </summary>
public sealed record ZoningFamilyDescriptor(
	string Id,
	string Icon,
	string ToolTip) : IJsonWritable
{
	public void Write(IJsonWriter writer)
	{
		writer.TypeBegin(GetType().FullName);
		writer.PropertyName("id");
		writer.Write(Id);
		writer.PropertyName("icon");
		writer.Write(Icon);
		writer.PropertyName("tooltip");
		writer.Write(ToolTip);
		writer.TypeEnd();
	}
}

/// <summary>
/// The zoning hierarchy: family, then density, then the buildings that grow
/// there.
/// </summary>
/// <remarks>
/// Zoning is the one surface where the lens owns the browsing hierarchy rather
/// than handing straight off to a vanilla menu. Assignment itself still
/// belongs to the native Zone tool — this contract never places anything, in
/// keeping with the tool-first design's rule that native tools remain the
/// placement authority.
///
/// Families and zone names were read off the running toolbar rather than
/// assumed. Note that theme and creator-pack zones ("ZoneEUResidentialLow-
/// Waterfront", "ZoneCP5ResidentialMedium", "ZoneEUMixedOldTown") carry an
/// infix or no recognisable stem, so classification looks for the family word
/// anywhere in the name rather than as a prefix.
/// </remarks>
public static class ZoningSurfaceCatalog
{
	public static readonly string[] Families =
	{
		ZoningFamilies.Residential,
		ZoningFamilies.Commercial,
		ZoningFamilies.Industrial,
		ZoningFamilies.Office,
		ZoningFamilies.Extractors,
	};

	private static readonly ZoningFamilyDescriptor[] Descriptors =
	{
		new(ZoningFamilies.Residential, "Media/Game/Icons/ZoneResidential.svg", "Zoning_Residential"),
		new(ZoningFamilies.Commercial, "Media/Game/Icons/ZoneCommercial.svg", "Zoning_Commercial"),
		new(ZoningFamilies.Industrial, "Media/Game/Icons/ZoneIndustrial.svg", "Zoning_Industrial"),
		new(ZoningFamilies.Office, "Media/Game/Icons/ZoneOffice.svg", "Zoning_Office"),
		new(ZoningFamilies.Extractors, "Media/Game/Icons/ZoneExtractors.svg", "Zoning_Extractors"),
	};

	/// <summary>
	/// Family stems. "Extractor" used to lead this list; it was removed because
	/// no extractor is a zone, so it could only ever have produced an empty
	/// family.
	/// </summary>
	private static readonly (string Stem, string Family)[] FamilyStems =
	{
		("Residential", ZoningFamilies.Residential),
		("Commercial", ZoningFamilies.Commercial),
		("Industrial", ZoningFamilies.Industrial),
		("Office", ZoningFamilies.Office),
		// Mixed zones are residential zones that also carry commerce; the
		// vanilla menu files them under Residential and so do we.
		("Mixed", ZoningFamilies.Residential),
	};

	// The density stems and ResolveDensity that used to live here are gone.
	// ZoneDensityClassifier owns the tier now, and it reads the zone's own data
	// first — which this could not do, being a name match. Removed rather than
	// left as a fallback: it disagreed with the new rule on the five low-rent
	// zones, filing them as low density because "LowRent" contains "Low", and a
	// second answer to the same question is how the badge and the picture ended
	// up disagreeing elsewhere in this codebase.

	/// <summary>
	/// UI category group name to family id. The group names are plural
	/// ("ZonesOffice"), the family ids singular, so they cannot be compared
	/// directly — logged from a running city after assuming otherwise and
	/// getting a classifier that never matched anything.
	/// </summary>
	private static readonly Dictionary<string, string> GroupFamilies = new(StringComparer.OrdinalIgnoreCase)
	{
		["ZonesResidential"] = ZoningFamilies.Residential,
		["ZonesCommercial"] = ZoningFamilies.Commercial,
		["ZonesIndustrial"] = ZoningFamilies.Industrial,
		["ZonesOffice"] = ZoningFamilies.Office,
		["ZonesExtractors"] = ZoningFamilies.Extractors,
	};

	private static readonly Dictionary<string, string[]> SpawnedBy = new(StringComparer.OrdinalIgnoreCase)
	{
		[ZoningFamilies.Residential] = new[] { "Buildings_Residential", "Buildings_Mixed" },
		[ZoningFamilies.Commercial] = new[] { "Buildings_Commercial", "Buildings_Mixed" },
		[ZoningFamilies.Industrial] = new[] { "Buildings_Industrial" },
		[ZoningFamilies.Office] = new[] { "Buildings_Office" },
		[ZoningFamilies.Extractors] = new[] { "Buildings_Industrial", "Buildings_Specialized" },
	};

	/// <summary>
	/// The family a zone belongs to, from the UI category group the game files
	/// it under.
	/// </summary>
	/// <remarks>
	/// The vanilla Zones menu's tabs are UIAssetCategoryPrefabs and a zone's
	/// <c>UIObject.m_Group</c> names the tab it appears under, so the family ids
	/// here are those group names verbatim.
	///
	/// This used to be consulted first, on the grounds that it was the only
	/// source separating Office from Commercial. That was wrong —
	/// <see cref="ZoneFlags.Office"/> does it, and
	/// <see cref="ResolveFamily(AreaType, ZoneFlags)"/> has been reading it
	/// since — and it also meant 13 of the 41 zones in a base-game city, which
	/// carry no UIObject at all, fell through to a name match. The zone's own
	/// data goes first now and this is the fallback for AreaType.None.
	/// </remarks>
	public static string? ResolveFamilyFromGroup(string? groupName)
	{
		if (string.IsNullOrWhiteSpace(groupName))
		{
			return null;
		}

		return GroupFamilies.TryGetValue(groupName.Trim(), out var family) ? family : null;
	}

	/// <summary>
	/// The UI category group a family is filed under — <see cref="ResolveFamilyFromGroup"/>
	/// read backwards.
	/// </summary>
	/// <remarks>
	/// The category strip above the zoning view is built from the Zones menu's
	/// own tabs, so it speaks in group names while the view filters on family
	/// ids. Something has to translate, and it is this map rather than the UI:
	/// the plural/singular mismatch is exactly the assumption that produced a
	/// classifier matching nothing, and teaching it to a second place would
	/// invite the same mistake twice.
	/// </remarks>
	public static string? ResolveGroupFromFamily(string? family)
	{
		if (string.IsNullOrWhiteSpace(family))
		{
			return null;
		}

		string trimmed = family.Trim();

		foreach (var pair in GroupFamilies)
		{
			if (string.Equals(pair.Value, trimmed, StringComparison.OrdinalIgnoreCase))
			{
				return pair.Key;
			}
		}

		return null;
	}

	/// <summary>
	/// The family a zone belongs to, from its own <c>ZoneData</c>.
	/// </summary>
	/// <remarks>
	/// The authoritative classifier, and the first one consulted.
	///
	/// AreaType distinguishes Residential, Commercial and Industrial, and office
	/// zones are <em>industrial</em>-area zones carrying
	/// <see cref="ZoneFlags.Office"/> — verified in a running city, having first
	/// assumed they were commercial-area, which put every one of them under
	/// Commercial and lost the Office family. <c>ZonePrefab</c> derives its own
	/// "ZonesOffice"/"Zones{AreaType}" mod tags from the same two fields, so
	/// this agrees with the game by construction.
	///
	/// Returns null only for <see cref="AreaType.None"/>. It cannot produce
	/// Extractors because no extractor is a zone; see
	/// <see cref="ZoningFamilies.Extractors"/>.
	/// </remarks>
	public static string? ResolveFamily(AreaType areaType, ZoneFlags flags) => areaType switch
	{
		AreaType.Residential => ZoningFamilies.Residential,
		AreaType.Commercial => ZoningFamilies.Commercial,
		AreaType.Industrial => (flags & ZoneFlags.Office) != 0
			? ZoningFamilies.Office
			: ZoningFamilies.Industrial,
		_ => null,
	};

	public static ZoningFamilyDescriptor? Describe(string? family) =>
		family is null
			? null
			: Descriptors.FirstOrDefault(descriptor =>
				string.Equals(descriptor.Id, family, StringComparison.OrdinalIgnoreCase));

	/// <summary>
	/// The family a zone prefab belongs to, inferred from its name.
	/// </summary>
	/// <remarks>
	/// Last resort. Prefer <see cref="ResolveFamily(AreaType, ZoneFlags)"/>,
	/// which reads the zone's own data, then the UI group. Since the zone index
	/// requires ZoneData, this only runs for a zone whose AreaType is None and
	/// which carries no UI group — a case the game's own data does not
	/// distinguish either. Runs over names from the whole prefab index, so
	/// declining cleanly matters more than guessing.
	/// </remarks>
	public static string? ResolveFamily(string? prefabName)
	{
		if (string.IsNullOrWhiteSpace(prefabName))
		{
			return null;
		}

		// Only classify things that actually look like zones; without this an
		// "OfficeBuilding01" would be filed as a zoning family.
		if (prefabName.IndexOf("Zone", StringComparison.OrdinalIgnoreCase) < 0)
		{
			return null;
		}

		foreach (var (stem, family) in FamilyStems)
		{
			if (prefabName.IndexOf(stem, StringComparison.OrdinalIgnoreCase) >= 0)
			{
				return family;
			}
		}

		return null;
	}

	/// <summary>
	/// The catalog subcategories whose buildings grow in this family's zones —
	/// the leaf of the hierarchy.
	/// </summary>
	public static IReadOnlyList<string> SpawnedSubCategories(string? family) =>
		family is not null && SpawnedBy.TryGetValue(family, out var subCategories)
			? subCategories
			: Array.Empty<string>();
}
