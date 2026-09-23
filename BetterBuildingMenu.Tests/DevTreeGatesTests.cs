using BetterBuildingMenu.Domain;

using System.Collections.Generic;
using System.Linq;

using Xunit;

using Gate = BetterBuildingMenu.Domain.DevTreeGates.Gate;

namespace BetterBuildingMenu.Tests
{
	public sealed class DevTreeGatesTests
	{
		[Fact]
		public void NothingGatesAnAssetTheTreeNeverReached()
		{
			Assert.Null(DevTreeGates.Pick(Enumerable.Empty<Gate>()));
		}

		[Fact]
		public void ANodeTheAssetNeedsBeatsOneOfSeveralWaysIn()
		{
			// However deep the alternative sits: it is not what unlocks the asset.
			var needed = new Gate("Needed", "a.svg", 2, Required: true);
			var wayIn = new Gate("Alternative", "b.svg", 5, Required: false);

			Assert.Equal(needed, DevTreeGates.Pick(new[] { wayIn, needed }));
			Assert.Equal(needed, DevTreeGates.Pick(new[] { needed, wayIn }));
		}

		[Fact]
		public void AmongNodesItNeedsTheOneFurthestIntoTheTree()
		{
			// The player buys it last, so it is the one that actually unlocks the asset;
			// the root and the chain below it are needed too, and never the answer.
			var root = new Gate("Electricity", "root.svg", 0, Required: true);
			var gas = new Gate("Gas Power Plant", "gas.svg", 3, Required: true);
			var nuclear = new Gate("Nuclear Power Plant", "nuclear.svg", 6, Required: true);

			Assert.Equal(nuclear, DevTreeGates.Pick(new[] { root, nuclear, gas }));
		}

		[Fact]
		public void AmongWaysInTheNearest()
		{
			// Any one of them unlocks the asset, so it is first reachable at the nearest.
			var near = new Gate("Near", "a.svg", 2, Required: false);
			var far = new Gate("Far", "b.svg", 7, Required: false);

			Assert.Equal(near, DevTreeGates.Pick(new[] { far, near }));
		}

		[Fact]
		public void ATieNeverFallsToTheOrderTheRequirementsWereCollectedIn()
		{
			// The walk hands requirements over in hash order, which moves when the
			// installed content does; every order must give the same branch.
			var gates = new[]
			{
				new Gate("Hospital", "h.svg", 4, Required: true),
				new Gate("Clinic", "c2.svg", 4, Required: true),
				new Gate("Clinic", "c1.svg", 4, Required: true),
			};

			var expected = gates[2];

			foreach (var order in Permutations(gates))
			{
				Assert.Equal(expected, DevTreeGates.Pick(order));
			}
		}

		private static IEnumerable<Gate[]> Permutations(Gate[] items)
		{
			if (items.Length <= 1)
			{
				yield return items;
				yield break;
			}

			for (var i = 0; i < items.Length; i++)
			{
				var rest = items.Where((_, j) => j != i).ToArray();

				foreach (var tail in Permutations(rest))
				{
					yield return new[] { items[i] }.Concat(tail).ToArray();
				}
			}
		}
	}
}
