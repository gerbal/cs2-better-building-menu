using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using Unity.Entities;

namespace FindItBuildingMenu.Utilities.PrefabCategoryProcessor
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

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, out PrefabIndex prefabIndex)
        {
            if (prefab is not BuildingPrefab)
            {
                prefabIndex = null;
                return false;
            }

            // A building with properties but no zone and no service is normally
            // a placeholder or a brand shell, and stays out. Unless the game's
            // own menus place it: Bridges & Ports' hotels (Dome Rural Hotel 01,
            // Dome Road House 01) carry BuildingPropertyData, no
            // SpawnableBuildingData and no ServiceObjectData, and sit in
            // Signatures › Commercial — the one place a player would look for
            // them (cm-vxuv). Vanilla's placement is the evidence.
            var placed = Systems.PrefabIndexingSystem.TryGetVanillaCategory(entity.Index, out var vanillaCategory);

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
