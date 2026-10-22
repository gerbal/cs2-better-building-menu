using BetterBuildingMenu.Domain.Enums;
using Game.Prefabs;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class PillarPrefabCategoryProcessor : TypedProcessor<PrefabBase>
    {
        public override ProcessorQuery Query { get; } = ProcessorQuery.All(typeof(PillarData), typeof(SpawnableObjectData));

        protected override PrefabSubCategory SubCategory => PrefabSubCategory.Networks_Pillars;
    }
}
