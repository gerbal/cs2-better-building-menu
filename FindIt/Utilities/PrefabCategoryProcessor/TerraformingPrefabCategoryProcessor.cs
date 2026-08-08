using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Interfaces;

using Game.Prefabs;

using Unity.Entities;

namespace FindItBuildingMenu.Utilities.PrefabCategoryProcessor
{
	/// <summary>
	/// The terrain brushes: level, shift, soften and slope.
	/// </summary>
	/// <remarks>
	/// These live in the vanilla Landscaping menu under its Terraforming
	/// category, and nothing here indexed them. Every other processor queries
	/// for components a placeable object carries — StaticObjectData, BuildingData,
	/// NetData — and a TerraformingPrefab is a bare PrefabBase carrying only
	/// TerraformingData and PlaceableInfoviewItem, so no query could match it.
	///
	/// The symptom was worse than absence. The category strip is built from the
	/// game's own UIAssetCategoryData, so Landscaping rendered a Terraforming
	/// tab that returned "No buildings in this category" — the same "twenty rows
	/// is worse than zero" failure that GetIndexedBuildings already argues
	/// against, in the same menu.
	///
	/// Filed under Props rather than a category of their own. IsBuilding then
	/// keeps them out of the unscoped catalog, where four cost-less lot-less
	/// tool rows have no business, while a player who has opened Landscaping
	/// still gets the menu's real contents. A new PrefabCategory would have
	/// meant a top-level rail button, an icon, a label table, a localization
	/// entry and two taxonomy test suites for four assets.
	///
	/// Activation needs nothing: ToolSystem.ActivatePrefabTool already routes a
	/// TerraformingPrefab to TerrainToolSystem, which is the same call the
	/// vanilla toolbar makes.
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

			// Height is the four tools the toolbar offers. The other targets —
			// Ore, Oil, FertileLand, GroundWater, Material — are editor resource
			// brushes with no place in a city's build menu.
			//
			// The menu tree would drop them anyway, since they sit under no
			// UIAssetCategoryPrefab, but saying so here means an unscoped search
			// for "level" cannot turn up an editor brush either.
			if (terraforming.m_Target != TerraformingTarget.Height)
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
