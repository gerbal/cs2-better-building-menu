using FindItBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain;

/// <summary>
/// The small, stable taxonomy used by Building Lens. It deliberately describes
/// building records only; tool-first vanilla surfaces remain outside this
/// contract until they have their own placement surface.
/// </summary>
public static class VanillaBuildMenuTaxonomy
{
    public const string Any = "Any";
    public const string AllBuildings = "AllBuildings";
    public const string Zones = "Zones";
    public const string SignatureBuildings = "SignatureBuildings";
    public const string ServiceBuildings = "ServiceBuildings";
    public const string Favorites = "Favorites";

    private static readonly VanillaBuildMenuDescriptor[] SectionDescriptors =
    {
        new(AllBuildings, "coui://finditbuildingmenu/Icons/Standard/StarAll.svg", "Any"),
        new(Zones, "coui://finditbuildingmenu/Icons/Colored/BuildingZoneSignature.svg", "Buildings"),
        new(SignatureBuildings, "Media/Game/Icons/ZoneSignature.svg", "ZoneSignature"),
        new(ServiceBuildings, "coui://finditbuildingmenu/Icons/Colored/ServiceBuilding.svg", "ServiceBuildings"),
        new(Favorites, "coui://finditbuildingmenu/Icons/Colored/StarFilledSmallIso.svg", "Favorite"),
    };

    private static readonly PrefabSubCategory[] ZoneSubcategories =
    {
        PrefabSubCategory.Buildings_Residential,
        PrefabSubCategory.Buildings_Mixed,
        PrefabSubCategory.Buildings_Commercial,
        PrefabSubCategory.Buildings_Industrial,
        PrefabSubCategory.Buildings_Office,
        PrefabSubCategory.Buildings_Specialized,
    };

    private static readonly PrefabSubCategory[] SignatureSubcategories =
    {
        PrefabSubCategory.Buildings_Residential,
        PrefabSubCategory.Buildings_Mixed,
        PrefabSubCategory.Buildings_Commercial,
        PrefabSubCategory.Buildings_Industrial,
        PrefabSubCategory.Buildings_Office,
    };

    private static readonly PrefabSubCategory[] ServiceSubcategories =
    {
        PrefabSubCategory.ServiceBuildings_Roads,
        PrefabSubCategory.ServiceBuildings_Electricity,
        PrefabSubCategory.ServiceBuildings_Water,
        PrefabSubCategory.ServiceBuildings_Health,
        PrefabSubCategory.ServiceBuildings_Police,
        PrefabSubCategory.ServiceBuildings_Fire,
        PrefabSubCategory.ServiceBuildings_EducationResearch,
        PrefabSubCategory.ServiceBuildings_Communications,
        PrefabSubCategory.ServiceBuildings_Garbage,
        PrefabSubCategory.ServiceBuildings_Transportation,
        PrefabSubCategory.ServiceBuildings_Landscaping,
        PrefabSubCategory.ServiceBuildings_Parks,
        PrefabSubCategory.ServiceBuildings_Misc,
    };

    public static IReadOnlyList<VanillaBuildMenuDescriptor> GetSectionDescriptors() => SectionDescriptors;

    public static IReadOnlyList<VanillaBuildMenuDescriptor> GetSubcategoryDescriptors(string section)
    {
        string normalizedSection = CanonicalSection(section) ?? AllBuildings;
        if (normalizedSection is AllBuildings or Favorites)
        {
            return new[] { CreateDescriptor(PrefabSubCategory.Any) };
        }

        PrefabSubCategory[] categories = normalizedSection switch
        {
            Zones => ZoneSubcategories,
            SignatureBuildings => SignatureSubcategories,
            ServiceBuildings => ServiceSubcategories,
            _ => Array.Empty<PrefabSubCategory>(),
        };

        return categories.Select(CreateDescriptor).ToArray();
    }

    public static VanillaBuildMenuTag? Resolve(
        PrefabCategory category,
        PrefabSubCategory subCategory,
        ZoneTypeFilter zoneType)
    {
        if (category == PrefabCategory.ServiceBuildings && ServiceSubcategories.Contains(subCategory))
        {
            return new VanillaBuildMenuTag(ServiceBuildings, subCategory.ToString());
        }

        if (category != PrefabCategory.Buildings)
        {
            return null;
        }

        if (SignatureSubcategories.Contains(subCategory) && zoneType == ZoneTypeFilter.Signature)
        {
            return new VanillaBuildMenuTag(SignatureBuildings, subCategory.ToString());
        }

        if (ZoneSubcategories.Contains(subCategory) && zoneType != ZoneTypeFilter.Signature)
        {
            return new VanillaBuildMenuTag(Zones, subCategory.ToString());
        }

        return null;
    }

    internal static string? CanonicalSection(string? section)
    {
        if (string.IsNullOrWhiteSpace(section))
        {
            return null;
        }

        return SectionDescriptors
            .FirstOrDefault(descriptor => string.Equals(descriptor.Id, section, StringComparison.OrdinalIgnoreCase))
            ?.Id;
    }

    private static VanillaBuildMenuDescriptor CreateDescriptor(PrefabSubCategory subCategory)
    {
        return new VanillaBuildMenuDescriptor(
            subCategory.ToString(),
            CategoryIconAttribute.GetAttribute(subCategory).Icon,
            subCategory.ToString());
    }
}

public sealed record VanillaBuildMenuTag(string Section, string SubCategory);

/// <summary>
/// A transport-neutral descriptor. Tooltip is a FindIt locale key suffix so UI
/// binding code can resolve it in the active language without making this pure
/// taxonomy depend on a live GameManager localization service.
/// </summary>
public sealed record VanillaBuildMenuDescriptor(string Id, string Icon, string Tooltip);
