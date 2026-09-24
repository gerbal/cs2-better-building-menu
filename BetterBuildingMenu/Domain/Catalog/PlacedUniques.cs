using System.Collections.Generic;

namespace BetterBuildingMenu.Domain.Catalog
{
	/// <summary>
	/// The unique assets the city has already got one of.
	/// </summary>
	/// <remarks>
	/// A third availability state, and the only one that is not a property of the
	/// asset: it changes mid-session both ways, so it is kept in step with the game's
	/// UniqueAssetTrackingSystem. Keyed by prefab index, as PrefabIndexBase.Id is.
	/// PrefabIndexingSystem owns the one the panel reads.
	/// </remarks>
	public sealed class PlacedUniques
	{
		private readonly HashSet<int> _placed = new();

		/// <summary>Whether the city already holds one of this prefab.</summary>
		public bool IsAlreadyBuilt(int prefabId) => _placed.Contains(prefabId);

		// Internal, like Reset: a change that does not also bump PrefabIndexingSystem.Generation
		// leaves the cached projections showing the old set.
		internal void Set(int prefabId, bool placed)
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
		/// the catalog's snapshot cache is keyed on PrefabIndexingSystem.Generation:
		/// bumping that generation for a rescan that found nothing new would throw a good
		/// cache away on every keystroke.
		/// </returns>
		internal bool Reset(IEnumerable<int>? placed)
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

		public int Count => _placed.Count;
	}
}
