
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

		public static void RemoveItem(int index) => Unfile(CategorizedPrefabs, index);

		/// <summary>Files an entry in the three lists the panel reads: everything, its category, its subcategory.</summary>
		/// <remarks>
		/// An entry already filed under the same id is taken out of its own lists first. Two
		/// processors can claim one prefab, and the later entry replaced the earlier one only in
		/// the lists they shared, leaving it listed under the earlier category too.
		/// </remarks>
		public static void File(
			Dictionary<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>> index,
			PrefabIndex prefabIndex)
		{
			Unfile(index, prefabIndex.Id);

			index[PrefabCategory.Any][PrefabSubCategory.Any][prefabIndex.Id] = prefabIndex;
			index[prefabIndex.Category][PrefabSubCategory.Any][prefabIndex.Id] = prefabIndex;
			index[prefabIndex.Category][prefabIndex.SubCategory][prefabIndex.Id] = prefabIndex;
		}

		private static void Unfile(
			Dictionary<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>> index,
			int id)
		{
			if (index[PrefabCategory.Any][PrefabSubCategory.Any].TryGetValue(id, out var prefabIndex))
			{
				index[PrefabCategory.Any][PrefabSubCategory.Any].Remove(prefabIndex);
				index[prefabIndex.Category][PrefabSubCategory.Any].Remove(prefabIndex);
				index[prefabIndex.Category][prefabIndex.SubCategory].Remove(prefabIndex);
			}
		}
	}
}
