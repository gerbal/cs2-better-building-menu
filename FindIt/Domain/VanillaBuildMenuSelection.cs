using System;
using System.Linq;

namespace FindItBuildingMenu.Domain;

public sealed record VanillaBuildMenuSelection(string Section, string SubCategory)
{
    public static VanillaBuildMenuSelection Normalize(string? section, string? subCategory)
    {
        string normalizedSection = VanillaBuildMenuTaxonomy.CanonicalSection(section)
            ?? VanillaBuildMenuTaxonomy.AllBuildings;
        string normalizedSubCategory = VanillaBuildMenuTaxonomy.GetSubcategoryDescriptors(normalizedSection)
            .FirstOrDefault(descriptor => string.Equals(descriptor.Id, subCategory, StringComparison.OrdinalIgnoreCase))
            ?.Id
            ?? VanillaBuildMenuTaxonomy.Any;

        return new VanillaBuildMenuSelection(normalizedSection, normalizedSubCategory);
    }
}
