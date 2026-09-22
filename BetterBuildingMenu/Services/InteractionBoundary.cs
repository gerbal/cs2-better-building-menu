using System;

namespace BetterBuildingMenu.Services
{
	/// <summary>
	/// The small interaction policies shared by the mod's game-facing UI adapters. It operates
	/// only on prefab ids; resolving prefabs and game side effects stay with their owning systems.
	/// </summary>
	public sealed class InteractionBoundary
	{
		public bool TryActivatePrefab(int prefabId, bool isAvailable, bool isAlreadyActive, Action activatePrefab)
		{
			if (prefabId <= 0 || !isAvailable || isAlreadyActive)
			{
				return false;
			}

			if (activatePrefab is null)
			{
				throw new ArgumentNullException(nameof(activatePrefab));
			}

			activatePrefab();
			return true;
		}
	}
}
