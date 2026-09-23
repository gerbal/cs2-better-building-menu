using BetterBuildingMenu.Domain;

using System.Collections.Generic;
using System.Linq;

using Xunit;

using Gate = BetterBuildingMenu.Domain.DevTreeGates.Gate;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The node an asset gated by more than one is filed under: the one the player reaches last.
	/// </summary>
	/// <remarks>
	/// The gates are independent nodes, such as the asset's own and the one a building it needs
	/// sits behind. The game's walk stops at each node, so a node's ancestors are never among them.
	/// </remarks>
	public sealed class DevTreeGatesTests
	{
		private const string Own = "Electricity";

		private static Gate Needed(string label, int depth, string service = Own, string icon = "") =>
			new(label, icon.Length > 0 ? icon : $"{label}.svg", depth, Required: true, service);

		private static Gate WayIn(string label, int depth, string service = Own, string icon = "") =>
			new(label, icon.Length > 0 ? icon : $"{label}.svg", depth, Required: false, service);

		[Fact]
		public void NothingGatesAnAssetTheTreeNeverReached()
		{
			Assert.Null(DevTreeGates.Pick(Enumerable.Empty<Gate>(), Own));
		}

		[Fact]
		public void AmongNodesItNeedsTheDeepest()
		{
			// All of them must be bought, and the deepest is bought last.
			var dependency = Needed("Gas Power Plant", 2);
			var itsOwn = Needed("Nuclear Power Plant", 5);

			AssertPicksInEveryOrder(itsOwn, dependency, itsOwn);
		}

		[Fact]
		public void AmongWaysInTheNearest()
		{
			// Any one of them unlocks the asset, so it is first reachable at the nearest.
			var near = WayIn("Near", 3);
			var far = WayIn("Far", 7);

			AssertPicksInEveryOrder(near, far, near);
		}

		[Fact]
		public void WithBothItUnlocksAtTheLaterOfTheDeepestNeededAndTheNearestWayIn()
		{
			// Every needed node, and one way in: the asset waits for whichever comes later.
			AssertPicksInEveryOrder(
				WayIn("Near", 3),
				Needed("Early", 1), WayIn("Near", 3), WayIn("Far", 5));

			AssertPicksInEveryOrder(
				Needed("Late", 4),
				Needed("Late", 4), WayIn("Near", 3), WayIn("Far", 5));
		}

		[Fact]
		public void ALoneWayInCountsAsNeeded()
		{
			// With nothing else to choose, the game treats it as needed, so the deeper of it and
			// the needed node is the one that unlocks the asset.
			AssertPicksInEveryOrder(
				WayIn("Upgrade", 5),
				Needed("Owner", 2), WayIn("Upgrade", 5));
		}

		[Fact]
		public void AtTheSameDepthTheNeededNodeWins()
		{
			// Even though the way in's label sorts first.
			AssertPicksInEveryOrder(
				Needed("Z", 3),
				Needed("Z", 3), WayIn("A", 3));
		}

		[Fact]
		public void TheAssetsOwnServiceComesFirst()
		{
			// Depth ranks a node within its own service's tree, so a deeper node in another
			// service is not bought later in any sense.
			AssertPicksInEveryOrder(
				Needed("Own", 1),
				Needed("Own", 1), Needed("Elsewhere", 6, service: "Water"));
		}

		[Fact]
		public void WithNoneInItsOwnServiceTheOthersStillDecide()
		{
			AssertPicksInEveryOrder(
				Needed("Deeper", 4, service: "Water"),
				Needed("Shallower", 2, service: "Water"), Needed("Deeper", 4, service: "Water"));
		}

		[Fact]
		public void TiesGoByLabelThenIconThenService()
		{
			// Hash order moves when the installed content does; no order may change the answer.
			// The label decides even where the icon would sort the other way.
			AssertPicksInEveryOrder(
				Needed("A", 4, icon: "z.svg"),
				Needed("B", 4, icon: "a.svg"), Needed("A", 4, icon: "z.svg"));

			AssertPicksInEveryOrder(
				WayIn("A", 2, icon: "z.svg"),
				WayIn("B", 2, icon: "a.svg"), WayIn("A", 2, icon: "z.svg"));

			AssertPicksInEveryOrder(
				Needed("Clinic", 4, icon: "c1.svg"),
				Needed("Hospital", 4), Needed("Clinic", 4, icon: "c2.svg"), Needed("Clinic", 4, icon: "c1.svg"));

			AssertPicksInEveryOrder(
				Needed("Same", 4, service: "Health", icon: "s.svg"),
				Needed("Same", 4, service: "Police", icon: "s.svg"), Needed("Same", 4, service: "Health", icon: "s.svg"));
		}

		private static void AssertPicksInEveryOrder(Gate expected, params Gate[] gates)
		{
			foreach (var order in Permutations(gates))
			{
				Assert.Equal(expected, DevTreeGates.Pick(order, Own));
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
