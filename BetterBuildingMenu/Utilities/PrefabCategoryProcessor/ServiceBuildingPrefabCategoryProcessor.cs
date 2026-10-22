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
                subCategory = ServiceMenus.SubCategoryOf(serviceObject.m_Service.name);
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
