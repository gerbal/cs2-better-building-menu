using BetterBuildingMenu.Domain.Enums;

namespace BetterBuildingMenu.Domain;

/// <summary>
/// The game's service names and the sub-category each files its buildings under.
/// </summary>
public static class ServiceMenus
{
	/// <summary>The sub-category for a service prefab's name, Misc for a name it does not list.</summary>
	public static PrefabSubCategory SubCategoryOf(string? serviceName) => serviceName switch
	{
		"Roads" => PrefabSubCategory.ServiceBuildings_Roads,
		"Electricity" => PrefabSubCategory.ServiceBuildings_Electricity,
		"Water & Sewage" => PrefabSubCategory.ServiceBuildings_Water,
		"Communications" => PrefabSubCategory.ServiceBuildings_Communications,
		"Health & Deathcare" => PrefabSubCategory.ServiceBuildings_Health,
		"Police & Administration" => PrefabSubCategory.ServiceBuildings_Police,
		"Fire & Rescue" => PrefabSubCategory.ServiceBuildings_Fire,
		"Education & Research" => PrefabSubCategory.ServiceBuildings_EducationResearch,
		"Garbage Management" => PrefabSubCategory.ServiceBuildings_Garbage,
		"Transportation" => PrefabSubCategory.ServiceBuildings_Transportation,
		"Landscaping" => PrefabSubCategory.ServiceBuildings_Landscaping,
		"Parks & Recreation" => PrefabSubCategory.ServiceBuildings_Parks,
		_ => PrefabSubCategory.ServiceBuildings_Misc
	};
}
