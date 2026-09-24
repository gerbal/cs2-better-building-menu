using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class MiscBuildingPrefabCategoryProcessor : IPrefabCategoryProcessor
    {
        private readonly EntityManager _entityManager;

        public MiscBuildingPrefabCategoryProcessor(EntityManager entityManager)
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
                        ComponentType.ReadOnly<BuildingData>(),
                    },
                    None = new[]
                    {
                        ComponentType.ReadOnly<ServiceObjectData>(),
                        ComponentType.ReadOnly<SpawnableBuildingData>(),
                        ComponentType.ReadOnly<SignatureBuildingData>(),
                        ComponentType.ReadOnly<ServiceUpgradeBuilding>(),
                    }
                },
            };
        }

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
        {
            if (prefab is not BuildingPrefab)
            {
                prefabIndex = null;
                return false;
            }

            // A building with properties but no zone and no service is normally
            // a placeholder or a brand shell, and stays out — unless the game's
            // own menus place it, which outranks this filter.
            var placed = target.Menus.TryGetCategory(entity.Index, out var vanillaCategory);

            if (_entityManager.HasComponent<BuildingPropertyData>(entity) && !placed)
            {
                prefabIndex = null;
                return false;
            }

            prefabIndex = new PrefabIndex(prefab)
            {
                Category = Domain.Enums.PrefabCategory.Buildings,
                SubCategory = (placed ? VanillaCategoryMapping.BuildingSubCategoryFor(vanillaCategory) : null)
                    ?? Domain.Enums.PrefabSubCategory.Buildings_Miscellaneous
            };

            if (placed && VanillaCategoryMapping.IsSignatureCategory(vanillaCategory))
            {
                prefabIndex.ZoneType = Domain.Enums.ZoneTypeFilter.Signature;
            }

            if (_entityManager.HasComponent<ExtractorFacilityData>(entity))
            {
                prefabIndex.SubCategory = Domain.Enums.PrefabSubCategory.Buildings_Specialized;
            }

            return true;
        }
    }
}
