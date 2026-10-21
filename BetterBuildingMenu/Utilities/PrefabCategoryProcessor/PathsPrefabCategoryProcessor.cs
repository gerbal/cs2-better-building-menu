using BetterBuildingMenu.Domain.Enums;
using Game.Prefabs;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class PathsPrefabCategoryProcessor : TypedProcessor<PathwayPrefab>
    {
        public override ProcessorQuery Query { get; } = ProcessorQuery
            .All(typeof(PathwayData), typeof(NetData))
            .None(typeof(BridgeData));

        protected override PrefabSubCategory SubCategory => PrefabSubCategory.Networks_Paths;
    }
}
