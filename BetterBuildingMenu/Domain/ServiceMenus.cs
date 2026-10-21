using BetterBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain;

/// <summary>
/// The game's service menus: the service prefab name each is known by, the sub-category its
/// buildings are filed under, and how the game titles it.
/// </summary>
public static class ServiceMenus
{
	/// <param name="Name">The service prefab's name, which is also the leaf of its editor category path.</param>
	/// <param name="SubCategory">The sub-category its buildings are filed under.</param>
	/// <param name="TitledByCategoryPath">Whether the title is the editor category
	/// <c>Buildings/Services/Name</c>; Landscaping is titled by its service name instead.</param>
	internal sealed record Menu(string Name, PrefabSubCategory SubCategory, bool TitledByCategoryPath = true);

	private static readonly Menu[] Table =
	{
		new("Roads", PrefabSubCategory.ServiceBuildings_Roads),
		new("Electricity", PrefabSubCategory.ServiceBuildings_Electricity),
		new("Water & Sewage", PrefabSubCategory.ServiceBuildings_Water),
		new("Communications", PrefabSubCategory.ServiceBuildings_Communications),
		new("Health & Deathcare", PrefabSubCategory.ServiceBuildings_Health),
		new("Police & Administration", PrefabSubCategory.ServiceBuildings_Police),
		new("Fire & Rescue", PrefabSubCategory.ServiceBuildings_Fire),
		new("Education & Research", PrefabSubCategory.ServiceBuildings_EducationResearch),
		new("Garbage Management", PrefabSubCategory.ServiceBuildings_Garbage),
		new("Transportation", PrefabSubCategory.ServiceBuildings_Transportation),
		new("Landscaping", PrefabSubCategory.ServiceBuildings_Landscaping, TitledByCategoryPath: false),
		new("Parks & Recreation", PrefabSubCategory.ServiceBuildings_Parks),
	};

	internal static IReadOnlyList<Menu> All => Table;

	/// <summary>The sub-category for a service prefab's name, Misc for a name it does not list.</summary>
	public static PrefabSubCategory SubCategoryOf(string? serviceName)
	{
		foreach (var menu in Table)
		{
			if (string.Equals(menu.Name, serviceName, StringComparison.Ordinal))
			{
				return menu.SubCategory;
			}
		}

		return PrefabSubCategory.ServiceBuildings_Misc;
	}
}
