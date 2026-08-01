using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Utilities;

using System;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Services
{
	/// <summary>
	/// Projects FindIt's indexed prefab records into the successor's building
	/// lens. This is deliberately not an ECS query: PrefabIndexingSystem remains
	/// the single source of truth for discovery, categorisation, thumbnails, and
	/// placement identity.
	/// </summary>
	public sealed class BuildingCatalogAdapter
	{
		public BuildingCatalogPage Query(BuildingCatalogQuery query)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			return BuildingCatalogQueryEngine.Query(GetIndexedBuildings().Select(Project), query);
		}

		public bool TryGet(int id, out BuildingCatalogEntry? entry)
		{
			entry = null;

			if (!FindItUtil.CategorizedPrefabs.TryGetValue(PrefabCategory.Any, out var allCategories)
				|| !allCategories.TryGetValue(PrefabSubCategory.Any, out var allPrefabs)
				|| !allPrefabs.TryGetValue(id, out var prefab)
				|| !IsBuilding(prefab))
			{
				return false;
			}

			entry = Project(prefab);
			return true;
		}

		private static bool IsBuilding(PrefabIndex prefab)
		{
			return prefab.Category is PrefabCategory.Buildings or PrefabCategory.ServiceBuildings;
		}

		private static IEnumerable<PrefabIndex> GetIndexedBuildings()
		{
			if (!FindItUtil.IsReady
				|| !FindItUtil.CategorizedPrefabs.TryGetValue(PrefabCategory.Any, out var allCategories)
				|| !allCategories.TryGetValue(PrefabSubCategory.Any, out var allPrefabs))
			{
				return Array.Empty<PrefabIndex>();
			}

			return allPrefabs.Where(IsBuilding);
		}

		private static BuildingCatalogEntry Project(PrefabIndex prefab)
		{
			return new BuildingCatalogEntry(
				Id: prefab.Id,
				PrefabName: prefab.PrefabName ?? string.Empty,
				Name: prefab.Name ?? prefab.PrefabName ?? string.Empty,
				Category: prefab.Category.ToString(),
				SubCategory: prefab.SubCategory.ToString(),
				Thumbnail: IconPath.Normalize(prefab.Thumbnail ?? prefab.FallbackThumbnail ?? string.Empty),
				LotWidth: prefab.LotSize.x,
				LotDepth: prefab.LotSize.y,
				BuildingLevel: prefab.BuildingLevel,
				ZoneType: prefab.ZoneType,
				HasParking: prefab.HasParking,
				IsUniqueMesh: prefab.IsUniqueMesh,
				IsVanilla: prefab.IsVanilla,
				IsFavorited: prefab.IsFavorited,
				PdxModsId: prefab.PdxModsId ?? string.Empty,
				ConstructionCost: prefab.ConstructionCost,
				Upkeep: prefab.Upkeep,
				Workers: prefab.Workers,
				Capacity: prefab.Capacity,
				ElectricityConsumption: prefab.ElectricityConsumption,
				WaterConsumption: prefab.WaterConsumption,
				GarbageAccumulation: prefab.GarbageAccumulation,
				WaterCapacity: prefab.WaterCapacity,
				SewageCapacity: prefab.SewageCapacity,
				GroundPollution: prefab.GroundPollution,
				AirPollution: prefab.AirPollution,
				NoisePollution: prefab.NoisePollution);
		}
	}
}
