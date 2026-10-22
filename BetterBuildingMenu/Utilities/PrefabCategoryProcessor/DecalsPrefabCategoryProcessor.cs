using BetterBuildingMenu.Domain.Enums;
using Game.Prefabs;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class DecalsPrefabCategoryProcessor : TypedProcessor<StaticObjectPrefab>
    {
        private readonly EntityManager _entityManager;

        public DecalsPrefabCategoryProcessor(EntityManager entityManager)
        {
            _entityManager = entityManager;
        }

        public override ProcessorQuery Query { get; } = ProcessorQuery
            .All(typeof(StaticObjectData), typeof(SubMesh))
            .None(typeof(BuildingData), typeof(BrandObjectData), typeof(PlaceholderObjectElement));

        protected override PrefabSubCategory SubCategory => PrefabSubCategory.Props_Decals;

        protected override bool Accepts(StaticObjectPrefab prefab, Entity entity) => _entityManager.IsDecal(entity);
    }
}
