using Game.Prefabs;

using Unity.Entities;

namespace BetterBuildingMenu.Domain.Interfaces
{
	public interface IPrefabCategoryProcessor
	{
		EntityQueryDesc[] GetEntityQuery();
		bool TryCreatePrefabIndex(PrefabBase prefab, Entity entity, out PrefabIndex prefabIndex);
	}
}
