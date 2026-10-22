using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Utilities.PrefabCategoryProcessor;

using Game.Prefabs;

using System.Diagnostics.CodeAnalysis;

using Unity.Entities;

namespace BetterBuildingMenu.Domain.Interfaces
{
	public interface IPrefabCategoryProcessor
	{
		/// <summary>The prefabs this processor reads.</summary>
		ProcessorQuery Query { get; }

		/// <summary>Whether this processor indexes the prefab, and under which category.</summary>
		/// <param name="target">The index the pass files into. A full pass's is new: the tables
		/// it read, and what earlier processors filed, so the menu-placed fallback claims only
		/// what is left. A partial pass's is the published one, edited in place.</param>
		bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, CatalogIndex target, [NotNullWhen(true)] out PrefabIndex? prefabIndex);
	}
}
