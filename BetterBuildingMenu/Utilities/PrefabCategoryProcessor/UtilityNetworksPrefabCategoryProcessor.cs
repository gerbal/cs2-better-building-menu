using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    /// <summary>
    /// Power lines and pipes: the networks that carry a service rather than
    /// traffic.
    /// </summary>
    /// <remarks>
    /// One processor for two prefab types: PowerLinePrefab and PipelinePrefab
    /// are both NetGeometryPrefabs distinguished only by the data component
    /// named after them, so splitting them would duplicate this to change a word.
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

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
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
