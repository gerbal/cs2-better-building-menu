using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class TreePrefabCategoryProcessor : IPrefabCategoryProcessor
    {
        public ProcessorQuery Query { get; } = ProcessorQuery.All(typeof(TreeData), typeof(GrowthScaleData));

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
        {
            prefabIndex = new PrefabIndex(prefab)
            {
                Category = Domain.Enums.PrefabCategory.Trees,
                SubCategory = Domain.Enums.PrefabSubCategory.Trees_Trees
            };

            if (prefab.name is "FlowerBushWild01" or "FlowerBushWild02" or "GreenBushWild01" or "GreenBushWild02")
            {
                prefabIndex.SubCategory = Domain.Enums.PrefabSubCategory.Trees_Shrubs;
            }

            return true;
        }
    }
}
