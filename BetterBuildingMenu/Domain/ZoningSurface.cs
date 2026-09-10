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
	/// Extractors are not zones: an extractor area is a LotPrefab carrying ExtractorAreaData
	/// and no ZoneData at all, and the zone index queries ZoneData, so no extractor can appear
	/// in it. The family list is filtered to what the city has, so the chip never offers it.
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
/// Zoning is the one surface where the lens owns the browsing hierarchy rather than handing
/// straight off to a vanilla menu; assignment still belongs to the native Zone tool. Theme
/// and pack zones carry the family word as an infix, so classification looks anywhere in the name.
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

	/// <summary>Family stems, matched anywhere in a zone's name.</summary>
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

	/// <summary>
	/// UI category group name to family id. The group names are plural ("ZonesOffice") and the
	/// family ids singular, so the two cannot be compared directly.
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
	/// The vanilla Zones menu's tabs are UIAssetCategoryPrefabs and a zone's UIObject.m_Group
	/// names the tab it appears under, so the ids here are those group names verbatim. The
	/// fallback for AreaType.None; the zone's own data is consulted first.
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
	/// The category strip speaks in group names while the view filters on family ids, so
	/// something has to translate. This map rather than the UI: the plural/singular mismatch
	/// is the kind of assumption that should be made in exactly one place.
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
	/// The authoritative classifier, and the first consulted. AreaType separates Residential,
	/// Commercial and Industrial, and office zones are industrial-area zones carrying
	/// ZoneFlags.Office — the same two fields ZonePrefab derives its own mod tags from.
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
	/// Last resort, after <see cref="ResolveFamily(AreaType, ZoneFlags)"/> and the UI group.
	/// It runs only for a zone whose AreaType is None and which carries no UI group, over names
	/// from the whole prefab index, so declining cleanly matters more than guessing.
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
