using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;

using Game.Prefabs;

using System.Runtime.CompilerServices;

namespace BetterBuildingMenu.Tests
{
	/// <summary>Index entries, and indexes of them, built the way the indexer builds them.</summary>
	internal static class TestPrefabs
	{
		/// <summary>A prefab to hang an entry on.</summary>
		/// <remarks>
		/// Uninitialized, because a prefab is a Unity ScriptableObject, which only the
		/// engine can create. The entry only holds it; no test reads its fields.
		/// </remarks>
		public static PrefabBase Prefab() => (PrefabBase)RuntimeHelpers.GetUninitializedObject(typeof(BuildingPrefab));

		public static PrefabIndex Entry(int id, PrefabCategory category, PrefabSubCategory subCategory) =>
			new(Prefab())
			{
				Id = id,
				Category = category,
				SubCategory = subCategory,
			};

		/// <summary>An entry with a prefab name, and a display name that defaults to it.</summary>
		public static PrefabIndex Named(int id, string prefabName, PrefabCategory category, PrefabSubCategory subCategory, string? name = null)
		{
			var entry = Entry(id, category, subCategory);
			entry.PrefabName = prefabName;
			entry.AssetName = name ?? prefabName;
			entry.Name = entry.AssetName;
			return entry;
		}

		/// <summary>An index a pass has filled with these entries, over no tables.</summary>
		public static CatalogIndex ReadyIndex(params PrefabIndex[] entries) => ReadyIndex(new CatalogIndex(), entries);

		/// <summary>This index, filled with these entries and marked ready, as a successful pass leaves it.</summary>
		public static CatalogIndex ReadyIndex(CatalogIndex index, params PrefabIndex[] entries)
		{
			foreach (var entry in entries)
			{
				index.File(entry);
			}

			index.IsReady = true;
			return index;
		}
	}
}
