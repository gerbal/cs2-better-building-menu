using Game.Prefabs;

using BetterBuildingMenu.Domain.Catalog;
using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Domain.Interfaces
{
	public interface IPrefabCategoryProcessor
	{
		/// <summary>The prefabs this processor reads.</summary>
		/// <remarks>New descriptions on every call: the indexer asks twice, once for full passes
		/// and once for a copy it narrows to what changed.</remarks>
		EntityQueryDesc[] GetEntityQuery();
		bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex);
	}
}
