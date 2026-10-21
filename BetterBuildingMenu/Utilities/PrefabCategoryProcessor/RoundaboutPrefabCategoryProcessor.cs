using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class RoundaboutPrefabCategoryProcessor : IPrefabCategoryProcessor
    {
        private readonly EntityManager _entityManager;

        public RoundaboutPrefabCategoryProcessor(EntityManager entityManager)
        {
            _entityManager = entityManager;
        }

        public ProcessorQuery Query { get; } = ProcessorQuery.All(typeof(NetObjectData)).None(typeof(PillarData));

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
        {
            var netObjectData = _entityManager.GetComponentData<NetObjectData>(entity);

            prefabIndex = new PrefabIndex(prefab)
            {
                Category = Domain.Enums.PrefabCategory.Networks,
            };

            if (netObjectData.m_CompositionFlags.m_General.HasFlag(CompositionFlags.General.Roundabout))
            {
                prefabIndex.SubCategory = Domain.Enums.PrefabSubCategory.Networks_Intersections;
            }
            else
            {
                prefabIndex.SubCategory = Domain.Enums.PrefabSubCategory.Networks_Stops;
            }

            return true;
        }
    }
}
