using Colossal.Entities;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class LanesPrefabCategoryProcessor : IPrefabCategoryProcessor
    {
        private readonly EntityManager _entityManager;

        public LanesPrefabCategoryProcessor(EntityManager entityManager)
        {
            _entityManager = entityManager;
        }

        public ProcessorQuery Query { get; } = ProcessorQuery
            .All(typeof(NetLaneData), typeof(SubMesh))
            .None(
                typeof(PathwayData),
                typeof(RoadData),
                typeof(BridgeData),
                typeof(TrackData),
                typeof(TrackLaneData),
                typeof(PlaceholderObjectElement));

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
        {
            if (!target.Mods.ExtraDetailing || prefab is not NetLaneGeometryPrefab)
            {
                prefabIndex = null;
                return false;
            }

            if (_entityManager.TryGetComponent<UtilityLaneData>(entity, out var utilityLaneData) && utilityLaneData.m_UtilityTypes < Game.Net.UtilityTypes.LowVoltageLine)
            {
                prefabIndex = null;
                return false;
            }

            prefabIndex = new PrefabIndex(prefab)
            {
                Category = Domain.Enums.PrefabCategory.Networks,
                SubCategory = Domain.Enums.PrefabSubCategory.Networks_Lanes
            };

            return true;
        }
    }
}
