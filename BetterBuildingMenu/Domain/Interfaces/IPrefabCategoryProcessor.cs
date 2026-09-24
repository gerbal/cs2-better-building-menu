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
		/// <param name="target">The index the pass files into. A full pass's is new: the tables
		/// it read, and what earlier processors filed, so the menu-placed fallback claims only
		/// what is left. A partial pass's is the published one, edited in place.</param>
		bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex);
	}
}
