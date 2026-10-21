using BetterBuildingMenu.Domain.Enums;
using Game.Prefabs;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    /// <summary>
    /// Seaways: the shipping corridors the Transportation menu draws on water.
    /// </summary>
    /// <remarks>
    /// A WaterwayPrefab is a NetGeometryPrefab like a road or a track, but it
    /// carries WaterwayData rather than RoadData or TrackData, and every network
    /// processor here queries one specific data component.
    /// </remarks>
    public class WaterwaysPrefabCategoryProcessor : TypedProcessor<WaterwayPrefab>
    {
        public override ProcessorQuery Query { get; } = ProcessorQuery.All(typeof(WaterwayData), typeof(NetData));

        protected override PrefabSubCategory SubCategory => PrefabSubCategory.Networks_Waterways;
    }
}
