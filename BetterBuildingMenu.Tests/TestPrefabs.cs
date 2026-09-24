using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;

using Game.Prefabs;

using System.Runtime.CompilerServices;

namespace BetterBuildingMenu.Tests
{
	/// <summary>Index entries built the way the indexer builds them, through the constructor.</summary>
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
	}
}
