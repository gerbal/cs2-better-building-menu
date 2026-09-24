using BetterBuildingMenu.Domain.Catalog;

using Game.Prefabs;

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

		/// <summary>Whether this processor indexes the prefab, and under which category.</summary>
		/// <param name="target">The index the pass is filing into. It holds the tables the full pass
		/// read before any processor ran, and every entry an earlier processor filed in this pass,
		/// which is how the menu-placed fallback claims only what the others left.</param>
		bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex);
	}
}
