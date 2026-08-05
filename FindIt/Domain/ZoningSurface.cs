using Colossal.UI.Binding;
using FindItBuildingMenu.Domain.Enums;

using Game.Prefabs;
using Game.Zones;

using System;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain;

/// <summary>
/// Stable identifiers for the zoning families the vanilla Zones menu is built
/// from. Like <see cref="ToolSurfaceIds"/> these cross the C# / Gameface
/// boundary and must not change when runtime toolbar entities do.
/// </summary>
public static class ZoningFamilies
{
	public const string Residential = "ZoneResidential";
	public const string Commercial = "ZoneCommercial";
	public const string Industrial = "ZoneIndustrial";
	public const string Office = "ZoneOffice";
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
/// Zoning is a seventh construction surface alongside
/// <see cref="ToolSurfaceIds"/>, but unlike the other six the lens owns the
/// browsing hierarchy rather than handing straight off. Assignment itself still
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
	/// Family stems, longest-first so "Extractor" is tested before the shorter
	/// stems and a name carrying both cannot be misfiled.
	/// </summary>
	private static readonly (string Stem, string Family)[] FamilyStems =
	{
		("Extractor", ZoningFamilies.Extractors),
		("Residential", ZoningFamilies.Residential),
		("Commercial", ZoningFamilies.Commercial),
		("Industrial", ZoningFamilies.Industrial),
		("Office", ZoningFamilies.Office),
		// Mixed zones are residential zones that also carry commerce; the
		// vanilla menu files them under Residential and so do we.
		("Mixed", ZoningFamilies.Residential),
	};

	/// <summary>
	/// Density stems. Row is tested before Medium because "MediumRow" is a row
	/// zone and a plain contains-check on "Medium" would swallow it.
	/// </summary>
	private static readonly (string Stem, ZoneTypeFilter Density)[] DensityStems =
	{
		("Row", ZoneTypeFilter.Row),
		("Low", ZoneTypeFilter.Low),
		("Medium", ZoneTypeFilter.Medium),
		("High", ZoneTypeFilter.High),
	};

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
	/// This is the authoritative classifier. The vanilla Zones menu's tabs are
	/// UIAssetCategoryPrefabs and a zone's <c>UIObject.m_Group</c> names the tab
	/// it appears under, so the family ids here are those group names verbatim.
	///
	/// It is preferred because it is the game's own grouping, but note that 13 of
	/// the 41 zones in a base-game city carry no UIObject at all, so the
	/// ZoneData fallback below is load-bearing rather than theoretical.
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
	/// The family a zone belongs to, from its own <c>ZoneData</c>.
	/// </summary>
	/// <remarks>
	/// Fallback for zones with no UI group. Note this cannot produce Office or
	/// Extractors.
	///
	/// AreaType only distinguishes Residential, Commercial and Industrial, and
	/// office zones are <em>industrial</em>-area zones carrying
	/// <see cref="ZoneFlags.Office"/> — verified in a running city, having first
	/// assumed they were commercial-area, which put every one of them under
	/// Commercial and lost the Office family.
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
	/// Fallback only. Prefer <see cref="ResolveFamily(AreaType, ZoneFlags)"/>,
	/// which reads the zone's own data; this exists for prefabs that carry no
	/// ZoneData, and for the extractor zones, which are not ZoneData-backed at
	/// all. Runs over names from the whole prefab index, so declining cleanly
	/// matters more than guessing.
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
	/// The density tier a zone name carries, or <see cref="ZoneTypeFilter.Any"/>
	/// when it carries none.
	/// </summary>
	/// <remarks>
	/// Fallback only. PrefabIndexingSystem.IndexZones already derives density
	/// from real ZonePropertiesData — residential properties over space
	/// multiplier, with row housing detected from spawnable lot sizes — and
	/// that result is available through GetZoneType. Prefer it; this name-based
	/// reading is for zones missing that data.
	///
	/// Industrial and extractor zones have no tier, and inventing one would
	/// filter their buildings away.
	/// </remarks>
	public static ZoneTypeFilter ResolveDensity(string? prefabName)
	{
		if (string.IsNullOrWhiteSpace(prefabName))
		{
			return ZoneTypeFilter.Any;
		}

		foreach (var (stem, density) in DensityStems)
		{
			if (prefabName.IndexOf(stem, StringComparison.OrdinalIgnoreCase) >= 0)
			{
				return density;
			}
		}

		return ZoneTypeFilter.Any;
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
