using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Interfaces;

using Game.Prefabs;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
	/// <summary>
	/// The terrain brushes: level, shift, soften and slope.
	/// </summary>
	/// <remarks>
	/// A TerraformingPrefab is a bare PrefabBase carrying only TerraformingData,
	/// so the component queries the other processors use cannot match it. Filed
	/// under Props, which IsBuilding keeps out of the unscoped catalog.
	/// </remarks>
	public class TerraformingPrefabCategoryProcessor : IPrefabCategoryProcessor
	{
		private readonly EntityManager _entityManager;

		public TerraformingPrefabCategoryProcessor(EntityManager entityManager)
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
						ComponentType.ReadOnly<TerraformingData>(),
					},
				},
			};
		}

		public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, out PrefabIndex prefabIndex)
		{
			// The type check and not the component alone: TerraformingData is
			// what the query found, but only a TerraformingPrefab is something
			// ActivatePrefabTool can arm.
			if (prefab is not TerraformingPrefab terraforming)
			{
				prefabIndex = null!;
				return false;
			}

			// Height is the four tools the toolbar offers. The other targets are
			// editor resource brushes, kept out so an unscoped search for "level"
			// cannot turn one up — unless the vanilla menu itself places it.
			if (terraforming.m_Target != TerraformingTarget.Height
				&& !Systems.PrefabIndexingSystem.IsPlacedInVanillaMenu(entity.Index))
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
