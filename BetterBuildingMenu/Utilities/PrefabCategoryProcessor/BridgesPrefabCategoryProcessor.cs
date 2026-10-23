using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.Interfaces;

using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
	/// <summary>Every net the game builds with its Bridge component: bridges, quays and piers, told
	/// apart by <see cref="BridgeNets"/> from the build style and the game's own UI category.</summary>
	public class BridgesPrefabCategoryProcessor : IPrefabCategoryProcessor
	{
		public ProcessorQuery Query { get; } = ProcessorQuery.All(typeof(BridgeData));

		public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
		{
			if (prefab is StaticObjectPrefab)
			{
				prefabIndex = null;
				return false;
			}

			var style = prefab.TryGet<Bridge>(out var bridge) ? bridge.m_BuildStyle : (BridgeBuildStyle?)null;
			var uiCategory = prefab.TryGet<UIObject>(out var uiObject) ? uiObject.m_Group?.name : null;
			var subCategory = BridgeNets.SubCategoryOf(style == BridgeBuildStyle.Quay, uiCategory, prefab.name);

			prefabIndex = new PrefabIndex(prefab)
			{
				Category = subCategory.CategoryOf(),
				SubCategory = subCategory,
			};

			return true;
		}
	}
}
