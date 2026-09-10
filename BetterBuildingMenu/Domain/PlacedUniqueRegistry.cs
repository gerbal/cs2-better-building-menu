using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The unique assets the city has already got one of.
	/// </summary>
	/// <remarks>
	/// A third availability state, and the only one that is not a property of the
	/// asset: it changes mid-session both ways, so it is kept in step with the game's
	/// UniqueAssetTrackingSystem. Keyed by prefab index, as PrefabIndexBase.Id is.
	/// </remarks>
	public static class PlacedUniqueRegistry
	{
		private static readonly HashSet<int> _placed = new();

		/// <summary>Whether the city already holds one of this prefab.</summary>
		public static bool IsAlreadyBuilt(int prefabId) => _placed.Contains(prefabId);

		public static void Set(int prefabId, bool placed)
		{
			if (placed)
			{
				_placed.Add(prefabId);
			}
			else
			{
				_placed.Remove(prefabId);
			}
		}

		/// <summary>Replaces the whole set — used when a city loads.</summary>
		public static void Reset(IEnumerable<int> placed)
		{
			_placed.Clear();

			if (placed is null)
			{
				return;
			}

			foreach (var id in placed)
			{
				_placed.Add(id);
			}
		}

		public static int Count => _placed.Count;
	}
}
