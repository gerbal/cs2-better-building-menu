using BetterBuildingMenu.Domain.Enums;
using Game.Prefabs;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class PillarPrefabCategoryProcessor : TypedProcessor<PrefabBase>
    {
        private readonly EntityManager _entityManager;

        public PillarPrefabCategoryProcessor(EntityManager entityManager)
        {
            _entityManager = entityManager;
        }

        public override ProcessorQuery Query { get; } = ProcessorQuery.All(typeof(PillarData), typeof(SpawnableObjectData));

        protected override PrefabSubCategory SubCategory => PrefabSubCategory.Networks_Pillars;

        // A pillar must be a net object as well to be filed.
        protected override bool Accepts(PrefabBase prefab, Entity entity) => _entityManager.HasComponent<NetObjectData>(entity);
    }
}
