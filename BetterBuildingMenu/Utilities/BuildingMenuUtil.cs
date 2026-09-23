
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;

using Game.Prefabs;

using System;
using System.Collections.Generic;
using System.Linq;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities
{
	public static class BuildingMenuUtil
	{

		public static Dictionary<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>> CategorizedPrefabs { get; } = new();
		public static bool IsReady { get; set; }

		public static PrefabBase GetPrefabBase(int id)
		{
			if (CategorizedPrefabs.TryGetValue(PrefabCategory.Any, out var categories)
				&& categories.TryGetValue(PrefabSubCategory.Any, out var prefabs)
				&& prefabs.TryGetValue(id, out var prefabIndex))
			{
				return prefabIndex.Prefab;
			}

			return null;
		}

		public static PrefabIndex GetPrefabIndex(int id)
		{
			if (CategorizedPrefabs.TryGetValue(PrefabCategory.Any, out var categories)
				&& categories.TryGetValue(PrefabSubCategory.Any, out var prefabs)
				&& prefabs.TryGetValue(id, out var prefabIndex))
			{
				return prefabIndex;
			}

			return null;
		}

		public static bool Find(PrefabBase prefab, out int id)
		{
			var name = prefab.name;

			var prefabIndex = CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].FirstOrDefault(x => name == x.PrefabName);

			if (prefabIndex is null)
			{
				id = 0;
				return false;
			}

			id = prefabIndex.Id;
			return true;
		}

		public static void RemoveItem(Entity entity)
		{
			RemoveItem(entity.Index);
		}

		public static void RemoveItem(int index)
		{
			if (CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].TryGetValue(index, out var prefabIndex))
			{
				// All three lists AddPrefab files it in.
				CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].Remove(prefabIndex);
				CategorizedPrefabs[prefabIndex.Category][PrefabSubCategory.Any].Remove(prefabIndex);
				CategorizedPrefabs[prefabIndex.Category][prefabIndex.SubCategory].Remove(prefabIndex);
			}
		}
	}
}
