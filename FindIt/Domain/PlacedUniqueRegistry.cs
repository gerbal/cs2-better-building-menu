using System.Collections.Generic;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// The unique assets the city has already got one of.
	/// </summary>
	/// <remarks>
	/// A third availability state, and the only one that is not a property of
	/// the asset: Locked and Unlocked are decided by progression, but "already
	/// built" is decided by what the player has done since. It changes mid
	/// session, both ways — build the Space Center and it leaves the list you
	/// can build from; bulldoze it and it comes back.
	///
	/// So it cannot be captured at index time and left there. The game already
	/// tracks it in UniqueAssetTrackingSystem and raises
	/// EventUniqueAssetStatusChanged on both edges; the indexing system keeps
	/// this in step with that, and projection reads it per query.
	///
	/// Keyed by prefab entity INDEX, matching PrefabIndexBase.Id, so projection
	/// can ask without holding an Entity.
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
