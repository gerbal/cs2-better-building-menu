using System;

namespace BetterBuildingMenu.Services
{
	/// <summary>
	/// The small interaction policies shared by the mod's game-facing UI adapters. It operates
	/// only on prefab ids and sequence indices; resolving prefabs, finding entities and game
	/// side effects stay with their owning systems.
	/// </summary>
	public sealed class InteractionBoundary
	{
		private int _lastLocatePrefabId;
		private int _lastLocateIndex;

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

		public bool TryLocate(int prefabId, int sequenceLength, Action<int> locateAtIndex)
		{
			if (prefabId <= 0 || sequenceLength <= 0)
			{
				ResetLocateCursor();
				return false;
			}

			if (locateAtIndex is null)
			{
				throw new ArgumentNullException(nameof(locateAtIndex));
			}

			if (_lastLocatePrefabId != prefabId)
			{
				_lastLocatePrefabId = prefabId;
				_lastLocateIndex = 0;
			}
			else
			{
				_lastLocateIndex = (_lastLocateIndex + 1) % sequenceLength;
			}

			locateAtIndex(_lastLocateIndex);
			return true;
		}

		private void ResetLocateCursor()
		{
			_lastLocatePrefabId = 0;
			_lastLocateIndex = 0;
		}
	}
}
