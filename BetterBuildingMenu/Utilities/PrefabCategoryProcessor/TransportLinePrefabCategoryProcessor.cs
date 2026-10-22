using BetterBuildingMenu.Domain.Enums;
using Game.Prefabs;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    /// <summary>
    /// The line tools: bus, tram, subway, train, ship and airplane routes.
    /// </summary>
    /// <remarks>
    /// Routes rather than networks: a TransportLinePrefab is a RoutePrefab,
    /// drawn stop to stop across track that already exists, so it gets its own
    /// subcategory rather than being filed with the rails it runs on.
    /// </remarks>
    public class TransportLinePrefabCategoryProcessor : TypedProcessor<TransportLinePrefab>
    {
        public override ProcessorQuery Query { get; } = ProcessorQuery.All(typeof(TransportLineData), typeof(RouteData));

        protected override PrefabSubCategory SubCategory => PrefabSubCategory.Networks_Routes;
    }
}
