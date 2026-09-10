using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using Unity.Entities;

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
    public class WaterwaysPrefabCategoryProcessor : IPrefabCategoryProcessor
    {
        public EntityQueryDesc[] GetEntityQuery()
        {
            return new[]
            {
                new EntityQueryDesc
                {
                    All = new[]
                    {
                        ComponentType.ReadOnly<WaterwayData>(),
                        ComponentType.ReadOnly<NetData>(),
                    },
                },
            };
        }

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, out PrefabIndex prefabIndex)
        {
            if (prefab is not WaterwayPrefab)
            {
                prefabIndex = null;
                return false;
            }

            prefabIndex = new PrefabIndex(prefab)
            {
                Category = Domain.Enums.PrefabCategory.Networks,
                SubCategory = Domain.Enums.PrefabSubCategory.Networks_Waterways,
            };

            return true;
        }
    }
}
