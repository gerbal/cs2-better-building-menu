using Colossal.Entities;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.Interfaces;
using BetterBuildingMenu.Systems;

using Game.Prefabs;
using Game.UI;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
	public class ZonedBuildingPrefabCategoryProcessor : IPrefabCategoryProcessor
	{
		private readonly EntityManager _entityManager;
		private readonly ImageSystem _imageSystem;
		private readonly PrefabSystem _prefabSystem;

		public ZonedBuildingPrefabCategoryProcessor(EntityManager entityManager, ImageSystem imageSystem, PrefabSystem prefabSystem)
		{
			_entityManager = entityManager;
			_imageSystem = imageSystem;
			_prefabSystem = prefabSystem;
		}

		public EntityQueryDesc[] GetEntityQuery()
		{
			return new[]
			{
				new EntityQueryDesc
				{
					All = new[]
					{
						ComponentType.ReadOnly<BuildingData>(),
						ComponentType.ReadOnly<SpawnableBuildingData>(),
					}
				},
				new EntityQueryDesc
				{
					All = new[]
					{
						ComponentType.ReadOnly<BuildingData>(),
						ComponentType.ReadOnly<PlaceholderBuildingData>()
					}
				}
			};
		}

		public bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, [NotNullWhen(true)] out PrefabIndex? prefabIndex)
		{
			if (prefab is not BuildingPrefab buildingPrefab)
			{
				prefabIndex = null;
				return false;
			}

			var zonePrefab = GetZonePrefab(entity, out var level);

			if (zonePrefab == Entity.Null)
			{
				prefabIndex = null;
				return false;
			}

			prefabIndex = new PrefabIndex(prefab)
			{
				Category = PrefabCategory.Buildings,
				BuildingLevel = level
			};

			prefabIndex.CategoryThumbnail = prefabIndex.FallbackThumbnail = _imageSystem.GetIconOrGroupIcon(zonePrefab);

			if (_prefabSystem.TryGetPrefab<ZonePrefab>(zonePrefab, out var _zonePrefab))
			{
				prefabIndex.ZoneType = GetZoneType(entity, zonePrefab);
				prefabIndex.Theme = _zonePrefab.GetComponent<ThemeObject>()?.m_Theme;
				prefabIndex.AssetPacks = _zonePrefab.GetComponent<AssetPackItem>()?.m_Packs ?? new AssetPackPrefab[0];
			}

			var zoneData = _entityManager.GetComponentData<ZoneData>(zonePrefab);
			var ambienceData = _entityManager.GetComponentData<GroupAmbienceData>(zonePrefab);

			switch (zoneData.m_AreaType)
			{
				case Game.Zones.AreaType.Residential:
					prefabIndex.SubCategory = ambienceData.m_AmbienceType == Game.Simulation.GroupAmbienceType.ResidentialMixed ? PrefabSubCategory.Buildings_Mixed : PrefabSubCategory.Buildings_Residential;
					break;
				case Game.Zones.AreaType.Commercial:
					prefabIndex.SubCategory = PrefabSubCategory.Buildings_Commercial;
					break;
				case Game.Zones.AreaType.Industrial:
					if (_zonePrefab.m_Office)
					{
						prefabIndex.SubCategory = PrefabSubCategory.Buildings_Office;
					}
					else if (ambienceData.m_AmbienceType == Game.Simulation.GroupAmbienceType.Industrial)
					{
						prefabIndex.SubCategory = PrefabSubCategory.Buildings_Industrial;
					}
					else
					{
						prefabIndex.SubCategory = PrefabSubCategory.Buildings_Specialized;
					}

					break;
				default:
					return false;
			}

			return true;
		}

		private Entity GetZonePrefab(Entity entity, out int level)
		{
			if (_entityManager.TryGetComponent<SpawnableBuildingData>(entity, out var component))
			{
				level = component.m_Level;

				return component.m_ZonePrefab;
			}

			level = 0;

			if (_entityManager.TryGetComponent<PlaceholderBuildingData>(entity, out var component2))
			{
				return component2.m_ZonePrefab;
			}

			return Entity.Null;
		}

		private ZoneTypeFilter GetZoneType(Entity entity, Entity zonePrefab)
		{
			if (_entityManager.HasComponent<SignatureBuildingData>(entity))
			{
				return ZoneTypeFilter.Signature;
			}

			return PrefabIndexingSystem.GetZoneType(zonePrefab);
		}
	}
}
