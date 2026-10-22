using BetterBuildingMenu.Domain.Enums;
using Game.Prefabs;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class IntersectionsPrefabCategoryProcessor : TypedProcessor<PrefabBase>
    {
        public override ProcessorQuery Query { get; } = ProcessorQuery.All(typeof(AssetStampData), typeof(SubNet));

        protected override PrefabSubCategory SubCategory => PrefabSubCategory.Networks_Intersections;
    }
}
