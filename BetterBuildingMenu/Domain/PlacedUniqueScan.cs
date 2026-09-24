using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Which unique assets the city counts as already built.</summary>
	/// <remarks>
	/// The answer comes from the game's own per-asset accessor,
	/// UniqueAssetTrackingSystem.IsPlacedUniqueAsset, never from the tracker's
	/// placedUniqueAssets collection. Anarchy answers that accessor false while its
	/// "place multiple unique buildings" option is on, and disables the system that
	/// fills the collection either way, so only the accessor follows the player's
	/// choice. Reading it is what makes any mod that overrides the same accessor
	/// reach this panel without a mod-specific case here. See PlacedUniques.
	/// </remarks>
	public static class PlacedUniqueScan
	{
		/// <summary>One indexed prefab and what the game says about it right now.</summary>
		public readonly struct Candidate
		{
			public Candidate(int id, bool isUnique, bool accessorSaysPlaced)
			{
				Id = id;
				IsUnique = isUnique;
				AccessorSaysPlaced = accessorSaysPlaced;
			}

			/// <summary>Prefab index, as PrefabIndexBase.Id is.</summary>
			public int Id { get; }

			public bool IsUnique { get; }

			public bool AccessorSaysPlaced { get; }
		}

		/// <summary>The prefab ids to mark already built, each at most once.</summary>
		public static List<int> Collect(IEnumerable<Candidate>? candidates)
		{
			var placed = new List<int>();

			if (candidates is null)
			{
				return placed;
			}

			var seen = new HashSet<int>();

			foreach (var candidate in candidates)
			{
				if (candidate.IsUnique && candidate.AccessorSaysPlaced && seen.Add(candidate.Id))
				{
					placed.Add(candidate.Id);
				}
			}

			return placed;
		}
	}
}
