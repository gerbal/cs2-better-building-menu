using Colossal.Entities;
using BetterBuildingMenu.Domain;
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

        public EntityQueryDesc[] GetEntityQuery()
        {
            return new[]
            {
                new EntityQueryDesc
                {
                    All = new[]
                    {
                        ComponentType.ReadOnly<NetLaneData>(),
                        ComponentType.ReadOnly<SubMesh>(),
					},
                    None = new[]
                    {
                        ComponentType.ReadOnly<PathwayData>(),
                        ComponentType.ReadOnly<RoadData>(),
                        ComponentType.ReadOnly<BridgeData>(),
                        ComponentType.ReadOnly<TrackData>(),
                        ComponentType.ReadOnly<TrackLaneData>(),
                        ComponentType.ReadOnly<PlaceholderObjectElement>(),
                    }
                },
            };
        }

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
        {
            if (!Mod.IsExtraDetailingEnabled || prefab is not NetLaneGeometryPrefab)
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
