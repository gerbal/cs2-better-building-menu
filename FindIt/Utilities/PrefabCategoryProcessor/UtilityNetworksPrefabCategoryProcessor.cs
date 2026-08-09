using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using Unity.Entities;

namespace FindItBuildingMenu.Utilities.PrefabCategoryProcessor
{
    /// <summary>
    /// Power lines and pipes: the networks that carry a service rather than
    /// traffic.
    /// </summary>
    /// <remarks>
    /// One processor for two prefab types because they are the same idea told
    /// twice — PowerLinePrefab and PipelinePrefab are both NetGeometryPrefabs
    /// whose only distinguishing component is the data component named after
    /// them — and splitting them would duplicate this file to change one word.
    ///
    /// Both were missing entirely: the Electricity menu offered no high- or
    /// low-voltage line, and Water &amp; Sewage none of its three small pipes.
    /// </remarks>
    public class UtilityNetworksPrefabCategoryProcessor : IPrefabCategoryProcessor
    {
        public EntityQueryDesc[] GetEntityQuery()
        {
            return new[]
            {
                new EntityQueryDesc
                {
                    All = new[]
                    {
                        ComponentType.ReadOnly<PowerLineData>(),
                        ComponentType.ReadOnly<NetData>(),
                    },
                },
                new EntityQueryDesc
                {
                    All = new[]
                    {
                        ComponentType.ReadOnly<PipelineData>(),
                        ComponentType.ReadOnly<NetData>(),
                    },
                },
            };
        }

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, out PrefabIndex prefabIndex)
        {
            var subCategory = prefab switch
            {
                PowerLinePrefab => Domain.Enums.PrefabSubCategory.Networks_PowerLines,
                PipelinePrefab => Domain.Enums.PrefabSubCategory.Networks_Pipes,
                _ => Domain.Enums.PrefabSubCategory.Any,
            };

            if (subCategory == Domain.Enums.PrefabSubCategory.Any)
            {
                prefabIndex = null;
                return false;
            }

            prefabIndex = new PrefabIndex(prefab)
            {
                Category = Domain.Enums.PrefabCategory.Networks,
                SubCategory = subCategory,
            };

            return true;
        }
    }
}
