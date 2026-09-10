using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    /// <summary>
    /// Everything the game draws as a fence net: road upgrades, and the
    /// decorative fences that share their prefab type.
    /// </summary>
    /// <remarks>
    /// NetUpgrade is the game's own split: it marks a net applied to an
    /// existing one rather than drawn on its own — a crosswalk versus a garden
    /// fence. Read off the managed prefab, which is where a ComponentBase lives.
    /// </remarks>
    public class FencePrefabCategoryProcessor : IPrefabCategoryProcessor
    {
        public EntityQueryDesc[] GetEntityQuery()
        {
            return new[]
            {
                new EntityQueryDesc
                {
                    All = new[]
                    {
                        ComponentType.ReadOnly<FenceData>(),
                        ComponentType.ReadOnly<NetData>(),
                    },
                },
            };
        }

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, out PrefabIndex prefabIndex)
        {
            if (prefab is not FencePrefab)
            {
                prefabIndex = null;
                return false;
            }

            var upgrade = prefab.Has<NetUpgrade>();

            prefabIndex = new PrefabIndex(prefab)
            {
                Category = upgrade
                    ? Domain.Enums.PrefabCategory.Networks
                    : Domain.Enums.PrefabCategory.Props,
                SubCategory = upgrade
                    ? Domain.Enums.PrefabSubCategory.Networks_Upgrades
                    : Domain.Enums.PrefabSubCategory.Props_Fences,
            };

            return true;
        }
    }
}
