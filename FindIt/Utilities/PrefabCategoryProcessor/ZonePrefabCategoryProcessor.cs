using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Interfaces;

using Game.Prefabs;
using Game.Zones;

using Unity.Entities;

namespace FindItBuildingMenu.Utilities.PrefabCategoryProcessor
{
	/// <summary>
	/// Puts the game's zones in the index, so a zone can be armed the same way
	/// every other asset is.
	/// </summary>
	/// <remarks>
	/// Zones were catalogued into <c>_zoneCatalog</c> and nowhere else, which
	/// left them reachable for DRAWING and not for PLACING:
	/// <c>FindItUtil.GetPrefabBase</c> reads only
	/// <c>CategorizedPrefabs</c>, so <c>SetCurrentPrefab</c> with a zone id was
	/// a silent no-op. The zoning surface worked around it by triggering the
	/// game's own <c>toolbar.selectAsset</c> instead — a second placement path
	/// that is the root of the inconsistencies in cm-2xvs.7.
	///
	/// Nothing else is needed to make arming work. <c>ToolSystem
	/// .ActivatePrefabTool</c> walks every registered <c>ToolBaseSystem</c> and
	/// takes the first whose <c>TrySetPrefab</c> accepts, and
	/// <c>ZoneToolSystem.TrySetPrefab</c> is a bare <c>prefab is ZonePrefab</c>
	/// test. Read off the game's IL rather than guessed.
	///
	/// Menu membership comes free: <c>UiMenuName</c> is taken from the prefab's
	/// own <c>UIObject.m_Group.m_Menu.name</c>, which for every zone is "Zones",
	/// so this does not leak zones into any other menu.
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

		public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, out PrefabIndex prefabIndex)
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
				// The line that makes the tier reach the menu. Without it every
				// zone entry shipped ZoneType = Any, which is also why Density
				// never appeared in the group-by picker: a dimension whose
				// entries all share one value is dropped as useless, and they
				// did.
				//
				// Safe to read here. IndexZones fills the cache inside
				// RunIndex's full branch, before the processor loop this method
				// runs in — and ZonedBuildingPrefabCategoryProcessor already
				// reads the sibling cache from the same point.
				ZoneType = Systems.PrefabIndexingSystem.GetZoneDensity(entity),
			};

			return true;
		}

		/// <summary>
		/// The family, from the same two fields the game switches on.
		/// </summary>
		/// <remarks>
		/// <c>ZoneData</c> rather than the prefab name or its UI group, matching
		/// <c>IndexZones</c> — the name and the group are both fallbacks there,
		/// and only for a zone whose AreaType is None, which the data does not
		/// distinguish at all. Those land in Misc rather than being dropped: the
		/// zone catalog can afford to skip a zone it cannot file, but the index
		/// cannot, because skipping it here is what makes it unarmable.
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
