using BetterBuildingMenu.Domain.Enums;
using Game.Prefabs;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class TracksPrefabCategoryProcessor : TypedProcessor<TrackPrefab>
    {
        public override ProcessorQuery Query { get; } = ProcessorQuery.All(typeof(TrackData));

        protected override PrefabSubCategory SubCategory => PrefabSubCategory.Networks_Tracks;
    }
}
