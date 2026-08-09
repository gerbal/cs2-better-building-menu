using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using Unity.Entities;

namespace FindItBuildingMenu.Utilities.PrefabCategoryProcessor
{
    /// <summary>
    /// Everything the game draws as a fence net: road upgrades, and the
    /// decorative fences that share their prefab type.
    /// </summary>
    /// <remarks>
    /// The Roads menu's Services tab is fifteen assets and the lens had none of
    /// them — traffic lights, crosswalks, bike lanes, sound barriers, grass and
    /// tree verges, all FencePrefabs, and FenceData was a component no processor
    /// asked for.
    ///
    /// The split is the game's own: NetUpgrade is the component that says this
    /// net is applied to an existing one rather than drawn on its own, which is
    /// exactly the difference between a crosswalk and a garden fence. Read off
    /// the managed prefab because NetUpgrade is a ComponentBase and contributes
    /// no marker of its own to the entity.
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
