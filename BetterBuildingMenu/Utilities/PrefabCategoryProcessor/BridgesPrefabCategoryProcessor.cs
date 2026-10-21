using BetterBuildingMenu.Domain.Enums;
using Game.Prefabs;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class BridgesPrefabCategoryProcessor : TypedProcessor<PrefabBase>
    {
        public override ProcessorQuery Query { get; } = ProcessorQuery.All(typeof(BridgeData));

        protected override PrefabSubCategory SubCategory => PrefabSubCategory.Networks_Bridges;

        protected override bool Accepts(PrefabBase prefab, Entity entity) => prefab is not StaticObjectPrefab;
    }
}
