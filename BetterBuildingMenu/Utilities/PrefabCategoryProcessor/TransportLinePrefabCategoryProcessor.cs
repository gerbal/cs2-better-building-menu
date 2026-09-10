using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using Unity.Entities;

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
    public class TransportLinePrefabCategoryProcessor : IPrefabCategoryProcessor
    {
        public EntityQueryDesc[] GetEntityQuery()
        {
            return new[]
            {
                new EntityQueryDesc
                {
                    All = new[]
                    {
                        ComponentType.ReadOnly<TransportLineData>(),
                        ComponentType.ReadOnly<RouteData>(),
                    },
                },
            };
        }

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, out PrefabIndex prefabIndex)
        {
            if (prefab is not TransportLinePrefab)
            {
                prefabIndex = null;
                return false;
            }

            prefabIndex = new PrefabIndex(prefab)
            {
                Category = Domain.Enums.PrefabCategory.Networks,
                SubCategory = Domain.Enums.PrefabSubCategory.Networks_Routes,
            };

            return true;
        }
    }
}
