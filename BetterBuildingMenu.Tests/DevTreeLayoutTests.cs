using BetterBuildingMenu.Domain;

using System.Collections.Generic;
using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Each service's dev-tree nodes ranked by the tree's own layout, and the nodes drawn under
	/// another node's tab.
	/// </summary>
	public sealed class DevTreeLayoutTests
	{
		private const int Education = 900;
		private const int Police = 901;

		private static DevTreeNodePlace At(int node, int column, float row, int service = Education) =>
			new(node, service, column, row);

		private static int[] InRankOrder(Dictionary<int, int> ranked) =>
			ranked.OrderBy(pair => pair.Value).Select(pair => pair.Key).ToArray();

		/// <summary>Education's trunk sits at row 1, with Technical above at 0 and Medical below at 2:
		/// the plain University first, then its specialisations.</summary>
		[Fact]
		public void AColumnRanksOutwardFromTheTrunk()
		{
			const int root = 1, university = 2, technical = 3, medical = 4;

			var ranked = DevTreeLayout.Rank(new[]
			{
				At(medical, 1, 2f), At(technical, 1, 0f), At(university, 1, 1f), At(root, 0, 1f),
			});

			Assert.Equal(new[] { root, university, technical, medical }, InRankOrder(ranked));
		}

		[Fact]
		public void ColumnBeatsRow()
		{
			const int root = 1, nearFarOff = 2, farOnTrunk = 3;

			var ranked = DevTreeLayout.Rank(new[] { At(farOnTrunk, 2, 0f), At(nearFarOff, 1, 5f), At(root, 0, 0f) });

			Assert.Equal(new[] { root, nearFarOff, farOnTrunk }, InRankOrder(ranked));
		}

		[Fact]
		public void TheTrunkIsTheFirstRootsRowOrZero()
		{
			// No node in column 0: the trunk is row 0, so -0.4 is nearer than 1.5.
			var noRoot = DevTreeLayout.Rank(new[] { At(1, 1, 1.5f), At(2, 1, -0.4f) });
			// Two in column 0: the first one given sets the trunk, at 3, so 2.5 is nearer than 0.
			var twoRoots = DevTreeLayout.Rank(new[] { At(1, 0, 3f), At(2, 0, 0f), At(3, 1, 0f), At(4, 1, 2.5f) });

			Assert.Equal(new[] { 2, 1 }, InRankOrder(noRoot));
			Assert.Equal(new[] { 1, 2, 4, 3 }, InRankOrder(twoRoots));
		}

		[Fact]
		public void EachServiceIsRankedOnItsOwn()
		{
			var ranked = DevTreeLayout.Rank(new[]
			{
				At(1, 0, 0f, Education), At(2, 0, 0f, Police), At(3, 1, 0f, Education), At(4, 1, 0f, Police),
			});

			Assert.Equal(new Dictionary<int, int> { [1] = 0, [3] = 1, [2] = 0, [4] = 1 }, ranked);
		}

		[Fact]
		public void AnExactTieKeepsTheOrderGiven()
		{
			var ranked = DevTreeLayout.Rank(new[] { At(1, 0, 0f), At(3, 1, 1f), At(2, 1, 1f) });

			Assert.Equal(new[] { 1, 3, 2 }, InRankOrder(ranked));
		}

		private static Dictionary<int, (string Label, string Icon, int Depth, string Service)> Branches() => new()
		{
			[10] = ("Airport", "Airport.svg", 3, "Transportation"),
			[11] = ("International Airport", string.Empty, 5, "Transportation"),
			[12] = ("Space Center", string.Empty, 6, "Transportation"),
			[13] = (string.Empty, string.Empty, 0, "Transportation"),
		};

		private static readonly Dictionary<string, int> Names = new()
		{
			["AirportNode"] = 10,
			["InternationalAirportNode"] = 11,
			["SpaceCenterNode"] = 12,
			["UnlabelledNode"] = 13,
		};

		[Fact]
		public void AFoldedNodeTakesItsTargetsBranchWhole()
		{
			var branches = Branches();

			var unmatched = DevTreeLayout.Fold(
				branches,
				Names,
				new Dictionary<string, string> { ["InternationalAirportNode"] = "AirportNode", ["SpaceCenterNode"] = "AirportNode" });

			Assert.Empty(unmatched);
			Assert.Equal(branches[10], branches[11]);
			Assert.Equal(branches[10], branches[12]);
			Assert.Equal(("Airport", "Airport.svg", 3, "Transportation"), branches[10]);
		}

		[Fact]
		public void AFoldThatMatchesNothingIsReportedAndChangesNothing()
		{
			var branches = Branches();

			var unmatched = DevTreeLayout.Fold(
				branches,
				Names,
				new Dictionary<string, string>
				{
					["SpaceCenterNode"] = "UnlabelledNode",
					["International Airport"] = "AirportNode",
					["InternationalAirportNode"] = "NoSuchNode",
				});

			Assert.Equal(
				new[] { ("SpaceCenterNode", "UnlabelledNode"), ("International Airport", "AirportNode"), ("InternationalAirportNode", "NoSuchNode") },
				unmatched);
			Assert.Equal(Branches(), branches);
		}

		[Fact]
		public void FoldsApplyInOrder()
		{
			var branches = Branches();

			// The first fold moves Airport under International Airport, so the second, into
			// Airport, takes International Airport's branch.
			DevTreeLayout.Fold(
				branches,
				Names,
				new[]
				{
					new KeyValuePair<string, string>("AirportNode", "InternationalAirportNode"),
					new KeyValuePair<string, string>("SpaceCenterNode", "AirportNode"),
				});

			Assert.Equal(("International Airport", string.Empty, 5, "Transportation"), branches[12]);
		}
	}
}
