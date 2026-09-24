using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Interfaces;

using Game.Prefabs;
using Game.Zones;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
	/// <summary>
	/// Puts the game's zones in the index, so a zone can be armed the same way
	/// every other asset is.
	/// </summary>
	/// <remarks>
	/// Indexing is all that arming needs: <c>ToolSystem.ActivatePrefabTool</c>
	/// takes the first <c>ToolBaseSystem</c> whose <c>TrySetPrefab</c> accepts,
	/// and <c>ZoneToolSystem</c>'s is a bare <c>prefab is ZonePrefab</c> test.
	/// </remarks>
	public class ZonePrefabCategoryProcessor : IPrefabCategoryProcessor
	{
		private readonly EntityManager _entityManager;

		public ZonePrefabCategoryProcessor(EntityManager entityManager)
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
						ComponentType.ReadOnly<ZoneData>(),
					},
				},
			};
		}

		public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
		{
			if (prefab is not ZonePrefab)
			{
				prefabIndex = null;
				return false;
			}

			prefabIndex = new PrefabIndex(prefab)
			{
				Category = Domain.Enums.PrefabCategory.Zones,
				SubCategory = ResolveSubCategory(entity),
				// Without this every zone entry carries ZoneType = Any, and a
				// group-by dimension whose entries all share one value is
				// dropped. IndexZones reads the tiers before any processor runs.
				ZoneType = target.Zones.DensityOf(entity.Index),
			};

			return true;
		}

		/// <summary>
		/// The family, from the same two fields the game switches on.
		/// </summary>
		/// <remarks>
		/// <c>ZoneData</c> rather than the prefab name or its UI group, matching
		/// <c>IndexZones</c>. A zone that cannot be filed lands in Misc rather
		/// than being dropped: skipping it here would make it unarmable.
		/// </remarks>
		private Domain.Enums.PrefabSubCategory ResolveSubCategory(Entity entity)
		{
			if (!_entityManager.HasComponent<ZoneData>(entity))
			{
				return Domain.Enums.PrefabSubCategory.Zones_Misc;
			}

			var data = _entityManager.GetComponentData<ZoneData>(entity);

			return ZoningSurfaceCatalog.ResolveFamily(data.m_AreaType, data.m_ZoneFlags) switch
			{
				ZoningFamilies.Residential => Domain.Enums.PrefabSubCategory.Zones_Residential,
				ZoningFamilies.Commercial => Domain.Enums.PrefabSubCategory.Zones_Commercial,
				ZoningFamilies.Industrial => Domain.Enums.PrefabSubCategory.Zones_Industrial,
				ZoningFamilies.Office => Domain.Enums.PrefabSubCategory.Zones_Office,
				ZoningFamilies.Extractors => Domain.Enums.PrefabSubCategory.Zones_Extractors,
				_ => Domain.Enums.PrefabSubCategory.Zones_Misc,
			};
		}
	}
}
