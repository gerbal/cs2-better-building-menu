using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Interfaces;
using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
    public class SurfacePrefabCategoryProcessor : IPrefabCategoryProcessor
    {
        public ProcessorQuery Query { get; } = ProcessorQuery
            .All(typeof(AreaData))
            .Or(ProcessorQuery.All(typeof(SurfaceData)))
            .None(typeof(PlaceholderObjectElement));

        public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
        {
            prefabIndex = new PrefabIndex(prefab)
            {
                Category = Domain.Enums.PrefabCategory.Props,
                SubCategory = Domain.Enums.PrefabSubCategory.Props_Surfaces,
            };

            return true;
        }
    }
}
