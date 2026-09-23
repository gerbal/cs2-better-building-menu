using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class RoadsPrefabCategoryProcessor : IPrefabCategoryProcessor
    {
        public EntityQueryDesc[] GetEntityQuery()
        {
            return new[]
            {
                new EntityQueryDesc
                {
                    All = new[]
                    {
                        ComponentType.ReadOnly<RoadData>(),
                    },
                    None = new[]
                    {
                        ComponentType.ReadOnly<BridgeData>(),
                    },
                },
            };
        }

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
        {
            if (prefab is not RoadPrefab roadPrefab)
            {
                prefabIndex = null;
                return false;
            }

            prefabIndex = new PrefabIndex(prefab)
            {
                Category = Domain.Enums.PrefabCategory.Networks,
                SubCategory = Domain.Enums.PrefabSubCategory.Networks_Roads
            };

            if (roadPrefab.m_HighwayRules)
            {
                prefabIndex.SubCategory = Domain.Enums.PrefabSubCategory.Networks_Highways;
            }
            else
            {
                prefabIndex.SubCategory = Domain.Enums.PrefabSubCategory.Networks_Roads;
            }

            return true;
        }
    }
}
