using Colossal.Entities;

using Game.Prefabs;

using System.Text.RegularExpressions;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities
{
    /// <summary>
    /// Two prefab-entity predicates the indexer asks for, plus the name
    /// formatter. Catalog search itself lives in BuildingCatalogQueryEngine
    /// and BuildingCatalogRelevance.
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

        public static string FormatWords(this string str, bool forceUpper = false)
        {
            str = Regex.Replace(Regex.Replace(str,
                @"([a-z])([A-Z])", x => $"{x.Groups[1].Value} {x.Groups[2].Value}"),
                @"(\b)(?<!')([a-z])", x => $"{x.Groups[1].Value}{x.Groups[2].Value.ToUpper()}");

            if (forceUpper)
            {
                str = Regex.Replace(str, @"(^[a-z])|(\ [a-z])", x => x.Value.ToUpper(), RegexOptions.IgnoreCase);
            }

            return str;
        }
    }
}
