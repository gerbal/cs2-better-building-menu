using Colossal.Entities;

using Game.Prefabs;

using System.Text.RegularExpressions;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities
{
    /// <summary>
    /// What is left of the inherited search helpers: two prefab-entity
    /// predicates the indexer still asks for, and the name formatter.
    /// </summary>
    /// <remarks>
    /// The fuzzy-search engine that gave this file its name — SearchCheck,
    /// PreparedSearchTerm, the Levenshtein SpellCheck, AbbreviationCheck and
    /// their word-splitting helpers — was Find It's, and nothing calls it any
    /// more. Catalog search is BuildingCatalogQueryEngine's substring test plus
    /// BuildingCatalogRelevance.Score, with ranking done UI-side in
    /// buildingSearchRank.ts. The dead engine and its three characterization
    /// test files were removed rather than left to imply a second search path.
    /// </remarks>
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
