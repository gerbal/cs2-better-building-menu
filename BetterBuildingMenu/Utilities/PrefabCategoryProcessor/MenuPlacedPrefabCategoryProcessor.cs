using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Interfaces;

using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
	/// <summary>
	/// Whatever the vanilla menu places that no other processor claimed. Runs
	/// last, so a prefab type this mod has never heard of (a mod's tool) still
	/// reaches the asset menu the way it reaches the vanilla grid.
	/// </summary>
	public class MenuPlacedPrefabCategoryProcessor : IPrefabCategoryProcessor
	{
		private readonly EntityManager _entityManager;

		public MenuPlacedPrefabCategoryProcessor(EntityManager entityManager)
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
						ComponentType.ReadOnly<UIObjectData>(),
						ComponentType.ReadOnly<PrefabData>(),
					},
				},
			};
		}

		public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
		{
			var isCategory = prefab is UIGroupPrefab
				|| _entityManager.HasComponent<UIAssetCategoryData>(entity)
				|| _entityManager.HasComponent<UIAssetMenuData>(entity)
				|| prefab.GetType().Name.Contains("Category");

			if (!MenuPlacedFallback.ShouldIndex(
				placedInVanillaMenu: target.Menus.IsPlaced(entity.Index),
				isCategory: isCategory,
				alreadyIndexed: target.Get(entity.Index) is not null))
			{
				prefabIndex = null!;
				return false;
			}

			prefabIndex = new PrefabIndex(prefab)
			{
				Category = Domain.Enums.PrefabCategory.Props,
				SubCategory = Domain.Enums.PrefabSubCategory.Props_Misc,
			};

			return true;
		}
	}
}
