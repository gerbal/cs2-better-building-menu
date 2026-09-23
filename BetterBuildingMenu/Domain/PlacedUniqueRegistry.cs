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

		/// <summary>Replaces the whole set — used when a city loads or is rescanned.</summary>
		/// <returns>
		/// Whether the set actually moved. The rescan runs on every catalog publish, and
		/// the catalog's snapshot cache is keyed on PrefabIndexingSystem.IndexGeneration:
		/// bumping that generation for a rescan that found nothing new would throw a good
		/// cache away on every keystroke.
		/// </returns>
		public static bool Reset(IEnumerable<int>? placed)
		{
			var next = new HashSet<int>();

			if (placed is not null)
			{
				foreach (var id in placed)
				{
					next.Add(id);
				}
			}

			if (_placed.SetEquals(next))
			{
				return false;
			}

			_placed.Clear();
			_placed.UnionWith(next);

			return true;
		}

		public static int Count => _placed.Count;
	}
}
