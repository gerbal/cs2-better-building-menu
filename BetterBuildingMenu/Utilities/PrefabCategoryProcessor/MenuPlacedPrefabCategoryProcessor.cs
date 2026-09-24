using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Interfaces;

using Game.Prefabs;

using System;
using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
	/// <summary>
	/// Whatever the vanilla menu places that no other processor claimed. Runs
	/// last, so a prefab type this mod has never heard of (a mod's tool) still
	/// reaches the panel the way it reaches the vanilla grid.
	/// </summary>
	public class MenuPlacedPrefabCategoryProcessor : IPrefabCategoryProcessor
	{
		private readonly EntityManager _entityManager;
		private readonly Func<int, bool> _isIndexed;

		public MenuPlacedPrefabCategoryProcessor(EntityManager entityManager, Func<int, bool> isIndexed)
		{
			_entityManager = entityManager;
			_isIndexed = isIndexed;
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

		public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
		{
			var isCategory = prefab is UIGroupPrefab
				|| _entityManager.HasComponent<UIAssetCategoryData>(entity)
				|| _entityManager.HasComponent<UIAssetMenuData>(entity)
				|| prefab.GetType().Name.Contains("Category");

			if (!MenuPlacedFallback.ShouldIndex(
				placedInVanillaMenu: Systems.PrefabIndexingSystem.IsPlacedInVanillaMenu(entity.Index),
				isCategory: isCategory,
				alreadyIndexed: _isIndexed(entity.Index)))
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
