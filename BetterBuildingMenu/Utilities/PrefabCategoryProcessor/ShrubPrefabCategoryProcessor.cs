using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class ShrubPrefabCategoryProcessor : IPrefabCategoryProcessor
    {
        private readonly EntityManager _entityManager;

        public ShrubPrefabCategoryProcessor(EntityManager entityManager)
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
                        ComponentType.ReadOnly<PlantData>(),
                        ComponentType.ReadOnly<LoadedIndex>(),
                    },
                    None = new[]
                    {
                        ComponentType.ReadOnly<TreeData>(),
                        ComponentType.ReadOnly<NetLaneData>(),
                    },
                },
            };
        }

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
        {
            prefabIndex = new PrefabIndex(prefab)
            {
                Category = Domain.Enums.PrefabCategory.Trees,
                SubCategory = Domain.Enums.PrefabSubCategory.Trees_Shrubs
            };

            if (prefab.name is "TreeCityRandom01" or "TreeWildRandom01")
            {
                prefabIndex.SubCategory = Domain.Enums.PrefabSubCategory.Trees_Trees;
            }

            if (!_entityManager.HasComponent<Effect>(entity))
            {
                prefabIndex.SubCategory = Domain.Enums.PrefabSubCategory.Trees_Props;
            }

            return true;
        }
    }
}
