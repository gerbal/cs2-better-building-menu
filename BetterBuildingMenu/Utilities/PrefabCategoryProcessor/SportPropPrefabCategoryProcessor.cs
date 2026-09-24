using BetterBuildingMenu.Domain;
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

        public EntityQueryDesc[] GetEntityQuery()
        {
            return new[]
            {
                new EntityQueryDesc
                {
                    All = new[]
                    {
                        ComponentType.ReadOnly<StaticObjectData>(),
                        ComponentType.ReadOnly<BuildingExtensionData>(),
                        ComponentType.ReadOnly<PlaceableObjectData>(),
                    },
                    None = new[]
                    {
                        ComponentType.ReadOnly<BuildingData>(),
                    }
                },
            };
        }

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
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
