using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Interfaces;
using BetterBuildingMenu.Utilities;
using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class SportPropPrefabCategoryProcessor : IPrefabCategoryProcessor
    {
        private readonly EntityManager _entityManager;

        public SportPropPrefabCategoryProcessor(EntityManager entityManager)
        {
            _entityManager = entityManager;
        }

        public ProcessorQuery Query { get; } = ProcessorQuery
            .All(typeof(StaticObjectData), typeof(BuildingExtensionData), typeof(PlaceableObjectData))
            .None(typeof(BuildingData));

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
        {
            if (prefab is not BuildingExtensionPrefab)
            {
                prefabIndex = null;
                return false;
            }

            prefabIndex = new PrefabIndex(prefab)
            {
                Category = Domain.Enums.PrefabCategory.Props,
            };

            if (_entityManager.IsDecal(entity))
            {
                return false;
            }

            prefabIndex.SubCategory = Domain.Enums.PrefabSubCategory.Props_Misc;

            return true;
        }
    }
}
