using BetterBuildingMenu.Domain.Enums;
using Game.Prefabs;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class SurfacePrefabCategoryProcessor : TypedProcessor<PrefabBase>
    {
        public override ProcessorQuery Query { get; } = ProcessorQuery
            .All(typeof(AreaData))
            .Or(ProcessorQuery.All(typeof(SurfaceData)))
            .None(typeof(PlaceholderObjectElement));

        protected override PrefabSubCategory SubCategory => PrefabSubCategory.Props_Surfaces;
    }
}
