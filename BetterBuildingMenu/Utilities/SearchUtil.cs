using Colossal.Entities;

using Game.Prefabs;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities
{
    /// <summary>
    /// Two prefab-entity predicates the indexer asks for. Catalog search itself
    /// lives in BuildingCatalogQueryEngine and BuildingCatalogRelevance, and the
    /// name formatter in Domain/WordFormat.
    /// </summary>
    internal static class SearchUtil
    {
        public static bool IsDecal(this EntityManager entityManager, Entity entity)
        {
            if (!entityManager.TryGetBuffer<SubMesh>(entity, true, out var subMesh) || subMesh.Length == 0)
            {
                return false;
            }

            if (!entityManager.TryGetComponent<MeshData>(subMesh[0].m_SubMesh, out var component))
            {
                return false;
            }

            return component.m_State == MeshFlags.Decal;
        }

        public static bool IsBrandEntity(this EntityManager entityManager, Entity entity)
        {
            if (entityManager.HasComponent<BrandObjectData>(entity))
            {
                return true;
            }

            if (!entityManager.TryGetBuffer<ObjectRequirementElement>(entity, true, out var requirementBuffer))
            {
                return false;
            }

            for (var i = 0; i < requirementBuffer.Length; i++)
            {
                if (entityManager.HasComponent<BrandData>(requirementBuffer[i].m_Requirement))
                {
                    return true;
                }
            }

            return false;
        }
    }
}
