using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;
using System.Linq;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class ServiceBuildingPrefabCategoryProcessor : IPrefabCategoryProcessor
    {
        public ProcessorQuery Query { get; } = ProcessorQuery
            .All(typeof(BuildingData), typeof(ServiceObjectData))
            .Or(ProcessorQuery.All(typeof(ServiceUpgradeBuilding), typeof(BuildingData)))
            .Or(ProcessorQuery.All(typeof(ServiceUpgradeBuilding), typeof(BuildingExtensionData)))
            .None(typeof(TrafficSpawnerData), typeof(SpawnableBuildingData), typeof(PlaceholderBuildingData));

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
        {
            // A BuildingExtensionPrefab is a StaticObjectPrefab, not a
            // BuildingPrefab, so the gate has to admit both: the third query
            // above exists to deliver pure extensions like a Hearse Garage.
            if (prefab is not BuildingPrefab && prefab is not BuildingExtensionPrefab)
            {
                prefabIndex = null;
                return false;
            }

            var subCategory = PrefabSubCategory.ServiceBuildings_Misc;

            // An upgrade files under the service of the first building it upgrades.
            if (prefab.TryGet<ServiceObject>(out var serviceObject)
                || prefab.TryGet<ServiceUpgrade>(out var serviceUpgrade)
                    && serviceUpgrade.m_Buildings.FirstOrDefault() is { } upgraded
                    && upgraded.TryGet<ServiceObject>(out serviceObject))
            {
                subCategory = serviceObject.m_Service.name switch
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

            prefabIndex = new PrefabIndex(prefab)
            {
                Category = PrefabCategory.ServiceBuildings,
                SubCategory = subCategory
            };

            return true;
        }
    }
}
