using System;

namespace FindItBuildingMenu.Services
{
	/// <summary>
	/// Holds the small interaction policies shared by FindIt's game-facing UI
	/// adapters. It operates only on prefab ids and sequence indices; resolving
	/// prefabs, finding entities, and performing game side effects remain with
	/// their owning systems.
	/// </summary>
	public sealed class FindItInteractionBoundary
	{
		private readonly Action<int> _activatePrefab;
		private int _lastLocatePrefabId;
		private int _lastLocateIndex;

		public FindItInteractionBoundary(Action<int> activatePrefab)
		{
			_activatePrefab = activatePrefab ?? throw new ArgumentNullException(nameof(activatePrefab));
		}

		public bool TryActivatePrefab(int prefabId, bool isAvailable, bool isAlreadyActive)
		{
			if (prefabId <= 0 || !isAvailable || isAlreadyActive)
			{
				return false;
			}

			_activatePrefab(prefabId);
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
