using Colossal.Json;

using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;

using Game.Prefabs;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

using Unity.Entities;

namespace FindItBuildingMenu.Utilities
{
	public static class FindItUtil
	{
		private static Dictionary<string, CustomPrefabData> customPrefabsData = new();

		public static Dictionary<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>> CategorizedPrefabs { get; } = new();
		public static Dictionary<string, string> AssetMap { get; } = new();
		public static bool IsReady { get; set; }
		public static AssetPackPrefab FavoritePack { get; private set; }

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

		public static bool IsFavorited(string prefab)
		{
			return customPrefabsData.TryGetValue(prefab, out var data) && data.IsFavorited;
		}

		public static void ToggleFavorited(int id)
		{
			if (!CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].TryGetValue(id, out var prefabIndex))
			{
				return;
			}

			if (customPrefabsData.TryGetValue(prefabIndex.PrefabName, out var data))
			{
				data.IsFavorited = !data.IsFavorited;

				prefabIndex.IsFavorited = data.IsFavorited;
			}
			else
			{
				customPrefabsData[prefabIndex.PrefabName] = new CustomPrefabData
				{
					IsFavorited = true
				};

				prefabIndex.IsFavorited = true;
			}

			UpdateFavoritesList(prefabIndex);

			SaveCustomPrefabData();
		}

		private static void UpdateFavoritesList(PrefabIndex prefabIndex)
		{
			//UpdateFavoritesPack(prefabIndex);

			if (!prefabIndex.IsFavorited)
			{
				if (CategorizedPrefabs[PrefabCategory.Favorite].ContainsKey(prefabIndex.SubCategory))
				{
					CategorizedPrefabs[PrefabCategory.Favorite][prefabIndex.SubCategory].Remove(prefabIndex);

					if (CategorizedPrefabs[PrefabCategory.Favorite][prefabIndex.SubCategory].Count == 0)
					{
						CategorizedPrefabs[PrefabCategory.Favorite].Remove(prefabIndex.SubCategory);
					}
				}

				CategorizedPrefabs[PrefabCategory.Favorite][PrefabSubCategory.Any].Remove(prefabIndex);

				return;
			}

			if (!CategorizedPrefabs[PrefabCategory.Favorite].ContainsKey(prefabIndex.SubCategory))
			{
				CategorizedPrefabs[PrefabCategory.Favorite][prefabIndex.SubCategory] = new();
			}

			CategorizedPrefabs[PrefabCategory.Favorite][PrefabSubCategory.Any][prefabIndex.Id] = prefabIndex;
			CategorizedPrefabs[PrefabCategory.Favorite][prefabIndex.SubCategory][prefabIndex.Id] = prefabIndex;
		}

		//public static void UpdateFavoritesPack(PrefabIndex prefabIndex)
		//{
		//	if (!prefabIndex.Prefab.TryGet<AssetPackItem>(out var component))
		//	{
		//		component = prefabIndex.Prefab.AddComponent<AssetPackItem>();
		//	}

		//	if (prefabIndex.IsFavorited)
		//	{
		//		component.m_Packs = component.m_Packs is null ? new[] { FavoritePack } : component.m_Packs.Append(FavoritePack).ToArray();
		//	}
		//	else if (component.m_Packs is not null)
		//	{
		//		component.m_Packs = component.m_Packs.Where(x => x != FavoritePack).ToArray();
		//	}
		//}

		public static void ResetFavorites()
		{
			CategorizedPrefabs[PrefabCategory.Favorite] = new()
			{
				[PrefabSubCategory.Any] = new()
			};

			foreach (var item in customPrefabsData.Values)
			{
				item.IsFavorited = false;
			}

			SaveCustomPrefabData();
		}

		public static void SaveCustomPrefabData()
		{
			var path = Path.Combine(FolderUtil.ContentFolder, "CustomPrefabData.json");

			File.WriteAllText(path, JSON.Dump(customPrefabsData));
		}

		public static void LoadCustomPrefabData()
		{
			//FavoritePack = ScriptableObject.CreateInstance<AssetPackPrefab>();
			//FavoritePack.name = "FindItFavoritesFilter";
			//FavoritePack.AddComponent<UIObject>().m_Icon = "coui://finditbuildingmenu/starFavorite.svg";

			//World.DefaultGameObjectInjectionWorld.GetOrCreateSystemManaged<PrefabSystem>().AddPrefab(FavoritePack);

			var path = Path.Combine(FolderUtil.ContentFolder, "CustomPrefabData.json");

			if (!File.Exists(path))
			{
				return;
			}

			try
			{
				customPrefabsData = JSON.MakeInto<Dictionary<string, CustomPrefabData>>(JSON.Load(File.ReadAllText(path))) ?? new();
			}
			catch (Exception ex)
			{
				Mod.Log.Error(ex, "Failed to load custom prefab data");
			}
		}

		public static bool Find(PrefabBase prefab, out int id)
		{
			var name = prefab is MovingObjectPrefab ? $"Prop_{prefab.name}" : prefab.name;

			if (AssetMap.TryGetValue(name, out var newName))
			{
				name = newName;
			}

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
				if (IsFavorited(prefabIndex.PrefabName))
				{
					ToggleFavorited(index);
				}

				CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].Remove(prefabIndex);
				CategorizedPrefabs[prefabIndex.Category][prefabIndex.SubCategory].Remove(prefabIndex);
			}
		}
	}
}
