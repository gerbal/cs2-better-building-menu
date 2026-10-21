using Colossal.UI.Binding;
using BetterBuildingMenu.Domain.Enums;

using Game.Prefabs;
using Game.Zones;

using System;
using System.Collections.Generic;

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
/// The game's icon for each zoning family. Constants, so the sub-category icon attributes
/// that draw the same idea can name them.
/// </summary>
public static class ZoningIcons
{
	public const string Residential = "Media/Game/Icons/ZoneResidential.svg";
	public const string Commercial = "Media/Game/Icons/ZoneCommercial.svg";
	public const string Industrial = "Media/Game/Icons/ZoneIndustrial.svg";
	public const string Office = "Media/Game/Icons/ZoneOffice.svg";
	public const string Extractors = "Media/Game/Icons/ZoneExtractors.svg";
}

/// <summary>
/// One zoning family and everything the catalog knows about it.
/// </summary>
/// <param name="Id">The stable identifier, one of <see cref="ZoningFamilies"/>.</param>
/// <param name="Group">The UI category group the game files the family's zones under. The group
/// names are plural ("ZonesOffice") and the ids singular, so the two cannot be compared directly.</param>
/// <param name="Icon">The family's icon.</param>
/// <param name="ToolTip">The family's tooltip key.</param>
/// <param name="SubCategory">The sub-category the family's zones are filed under.</param>
/// <param name="SpawnedBy">The sub-categories of the buildings that grow in the family's zones.</param>
internal sealed record ZoningFamily(
	string Id,
	string Group,
	string Icon,
	string ToolTip,
	PrefabSubCategory SubCategory,
	PrefabSubCategory[] SpawnedBy)
{
	/// <summary>The family as the UI reads it.</summary>
	public ZoningFamilyDescriptor Descriptor { get; } = new(Id, Icon, ToolTip);

	/// <summary><see cref="SpawnedBy"/> by member name, the form <see cref="ZoningCatalog.SpawnedSubCategories"/> returns.</summary>
	public IReadOnlyList<string> SpawnedByNames { get; } = Array.ConvertAll(SpawnedBy, spawned => spawned.ToString());
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
		writer.Prop("id", Id);
		writer.Prop("icon", Icon);
		writer.Prop("tooltip", ToolTip);
		writer.TypeEnd();
	}
}

/// <summary>
/// The zoning hierarchy: family, then density, then the buildings that grow
/// there.
/// </summary>
/// <remarks>
/// Zoning is the one menu where the asset menu owns the browsing hierarchy rather than handing
/// straight off to a vanilla menu; assignment still belongs to the native Zone tool. Theme
/// and pack zones carry the family word as an infix, so classification looks anywhere in the name.
/// </remarks>
public static class ZoningCatalog
{
	/// <summary>Every zoning family, one row each; the lookups below read it.</summary>
	private static readonly ZoningFamily[] Table =
	{
		new(ZoningFamilies.Residential, "ZonesResidential", ZoningIcons.Residential, "Zoning_Residential",
			PrefabSubCategory.Zones_Residential,
			new[] { PrefabSubCategory.Buildings_Residential, PrefabSubCategory.Buildings_Mixed }),
		new(ZoningFamilies.Commercial, "ZonesCommercial", ZoningIcons.Commercial, "Zoning_Commercial",
			PrefabSubCategory.Zones_Commercial,
			new[] { PrefabSubCategory.Buildings_Commercial, PrefabSubCategory.Buildings_Mixed }),
		new(ZoningFamilies.Industrial, "ZonesIndustrial", ZoningIcons.Industrial, "Zoning_Industrial",
			PrefabSubCategory.Zones_Industrial,
			new[] { PrefabSubCategory.Buildings_Industrial }),
		new(ZoningFamilies.Office, "ZonesOffice", ZoningIcons.Office, "Zoning_Office",
			PrefabSubCategory.Zones_Office,
			new[] { PrefabSubCategory.Buildings_Office }),
		new(ZoningFamilies.Extractors, "ZonesExtractors", ZoningIcons.Extractors, "Zoning_Extractors",
			PrefabSubCategory.Zones_Extractors,
			new[] { PrefabSubCategory.Buildings_Industrial, PrefabSubCategory.Buildings_Specialized }),
	};

	public static readonly string[] Families = Array.ConvertAll(Table, family => family.Id);

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
		if (groupName?.Trim() is not { Length: > 0 } trimmed)
		{
			return null;
		}

		foreach (var family in Table)
		{
			if (string.Equals(family.Group, trimmed, StringComparison.OrdinalIgnoreCase))
			{
				return family.Id;
			}
		}

		return null;
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
		if (family?.Trim() is not { Length: > 0 } trimmed)
		{
			return null;
		}

		return Find(trimmed, StringComparison.OrdinalIgnoreCase)?.Group;
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

	/// <summary>The sub-category a family's zones are filed under, Misc for none.</summary>
	public static PrefabSubCategory SubCategoryOf(string? family) =>
		Find(family, StringComparison.Ordinal)?.SubCategory ?? PrefabSubCategory.Zones_Misc;

	public static ZoningFamilyDescriptor? Describe(string? family) =>
		Find(family, StringComparison.OrdinalIgnoreCase)?.Descriptor;

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
		if (prefabName is null || string.IsNullOrWhiteSpace(prefabName))
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
		Find(family, StringComparison.OrdinalIgnoreCase)?.SpawnedByNames ?? Array.Empty<string>();

	private static ZoningFamily? Find(string? id, StringComparison comparison)
	{
		if (id is null)
		{
			return null;
		}

		foreach (var family in Table)
		{
			if (string.Equals(family.Id, id, comparison))
			{
				return family;
			}
		}

		return null;
	}
}
