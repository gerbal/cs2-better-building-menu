using BetterBuildingMenu.Domain;

using System.Collections.Generic;
using System.Linq;

using Xunit;

using Gate = BetterBuildingMenu.Domain.DevTreeGates.Gate;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The node an asset gated by more than one is filed under: the deepest it needs, or its nearest
	/// way in when that is deeper.
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
			Assert.Null(DevTreeGates.Pick(Enumerable.Empty<Gate>(), Own, otherWaysIn: false));
			Assert.Null(DevTreeGates.Pick(Enumerable.Empty<Gate>(), Own, otherWaysIn: true));
		}

		[Fact]
		public void AmongNodesItNeedsTheDeepest()
		{
			// All of them must be bought; the deepest stands for the last.
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
		public void WithBothItIsTheDeepestNeededOrTheNearestWayInIfDeeper()
		{
			// Every needed node, and one way in: the asset waits for whichever lies deeper.
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
		public void AWayInThatIsNotANodeSetsTheNodesWaysInAside()
		{
			// A milestone, say, could let the asset in before the far way in is bought, so the
			// node that holds it back is the one it needs.
			AssertPicksInEveryOrder(
				Needed("Owner", 1), Own, otherWaysIn: true,
				Needed("Owner", 1), WayIn("Far", 5));

			// With nothing needed, the nearest way in still names it.
			AssertPicksInEveryOrder(
				WayIn("Near", 3), Own, otherWaysIn: true,
				WayIn("Near", 3), WayIn("Far", 5));
		}

		[Fact]
		public void AWayInElsewhereSetsTheOwnWaysInAside()
		{
			// The own-service rule leaves the Water node out, but it is still a way in: buying it
			// lets the asset in without the far Electricity one.
			AssertPicksInEveryOrder(
				Needed("Owner", 1),
				Needed("Owner", 1), WayIn("Far", 5), WayIn("Pumping", 1, service: "Water"));

			// A needed node elsewhere sets nothing aside: the asset still waits for a way in.
			AssertPicksInEveryOrder(
				WayIn("Far", 5),
				Needed("Owner", 1), WayIn("Far", 5), Needed("Pumping", 6, service: "Water"));
		}

		[Fact]
		public void TheAssetsOwnServiceComesFirst()
		{
			// Depth ranks a node within its own service's tree, so a deeper node in another
			// service is not bought later in any sense.
			AssertPicksInEveryOrder(
				Needed("Own", 1),
				Needed("Own", 1), Needed("Elsewhere", 6, service: "Water"));

			// Its own way in, even behind a nearer one elsewhere.
			AssertPicksInEveryOrder(
				WayIn("Own", 5),
				WayIn("Own", 5), WayIn("Elsewhere", 1, service: "Water"));
		}

		[Fact]
		public void WithNoneInItsOwnServiceAllOfThemDecide()
		{
			AssertPicksInEveryOrder(
				Needed("Deeper", 4, service: "Water"),
				Needed("Shallower", 2, service: "Water"), Needed("Deeper", 4, service: "Water"));

			AssertPicksInEveryOrder(
				Needed("Deepest", 5, service: "Healthcare"),
				Needed("Shallower", 2, service: "Water"), Needed("Deepest", 5, service: "Healthcare"),
				WayIn("Near", 1, service: "Police"));

			// An asset with no service at all is the same case.
			AssertPicksInEveryOrder(
				WayIn("Near", 3), service: null, otherWaysIn: false,
				Needed("Early", 1), WayIn("Near", 3));
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
				Needed("Clinic", 4, icon: "c1.svg"),
				Needed("Hospital", 4), Needed("Clinic", 4, icon: "c2.svg"), Needed("Clinic", 4, icon: "c1.svg"));

			AssertPicksInEveryOrder(
				Needed("Same", 4, service: "Healthcare", icon: "s.svg"), service: null, otherWaysIn: false,
				Needed("Same", 4, service: "Police", icon: "s.svg"), Needed("Same", 4, service: "Healthcare", icon: "s.svg"));

			// Ways in tie the same way.
			AssertPicksInEveryOrder(
				WayIn("A", 2, icon: "z.svg"),
				WayIn("B", 2, icon: "a.svg"), WayIn("A", 2, icon: "z.svg"));

			AssertPicksInEveryOrder(
				WayIn("Clinic", 2, icon: "c1.svg"),
				WayIn("Clinic", 2, icon: "c2.svg"), WayIn("Clinic", 2, icon: "c1.svg"));

			AssertPicksInEveryOrder(
				WayIn("Same", 2, service: "Healthcare", icon: "s.svg"), service: null, otherWaysIn: false,
				WayIn("Same", 2, service: "Police", icon: "s.svg"), WayIn("Same", 2, service: "Healthcare", icon: "s.svg"));
		}

		private static void AssertPicksInEveryOrder(Gate expected, params Gate[] gates) =>
			AssertPicksInEveryOrder(expected, Own, otherWaysIn: false, gates);

		private static void AssertPicksInEveryOrder(Gate expected, string? service, bool otherWaysIn, params Gate[] gates)
		{
			foreach (var order in Permutations(gates))
			{
				Assert.Equal(expected, DevTreeGates.Pick(order, service, otherWaysIn));
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
