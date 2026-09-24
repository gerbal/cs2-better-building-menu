using BetterBuildingMenu.Domain.Catalog;

using System;
using System.Collections.Generic;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The branch an asset is filed under, from its unlock requirements, its service and its menu.
	/// </summary>
	/// <remarks>DevTreeGatesTests covers the pick among several nodes; these cover what reaches it.</remarks>
	public sealed class DevTreeBranchTests
	{
		private const int GasNode = 1, NuclearNode = 2, UnlabelledNode = 3, ParkNode = 4, Milestone = 99;

		private static readonly ProgressionIndex Progression = new(
			new Dictionary<int, string>(),
			new Dictionary<int, (string Label, string Icon, int Depth, string Service)>
			{
				[GasNode] = ("Gas Power Plant", "Gas.svg", 2, "Electricity"),
				[NuclearNode] = ("Nuclear Power Plant", "Nuclear.svg", 5, "Electricity"),
				[UnlabelledNode] = (string.Empty, string.Empty, 7, "Electricity"),
				[ParkNode] = ("Parks", "Parks.svg", 9, "Parks & Recreation"),
			},
			new Dictionary<string, (string Label, string Icon, int Depth)>
			{
				["Electricity"] = ("Electricity", "Electricity.svg", 0),
			});

		private static (int, bool) Needs(int node) => (node, true);

		private static (int, bool) WayIn(int node) => (node, false);

		[Fact]
		public void AnAssetWithNoGateFallsToItsMenusRoot()
		{
			Assert.Equal(
				("Electricity", "Electricity.svg", 0),
				Progression.BranchOf(Array.Empty<(int, bool)>(), "Electricity", "Electricity"));
			// Through a node with no label, or a requirement that is no node at all.
			Assert.Equal(
				("Electricity", "Electricity.svg", 0),
				Progression.BranchOf(new[] { Needs(UnlabelledNode), Needs(Milestone) }, "Electricity", "Electricity"));
		}

		[Fact]
		public void AMenuWithNoRootGivesNoBranch()
		{
			Assert.Equal(
				(string.Empty, string.Empty, 0),
				Progression.BranchOf(Array.Empty<(int, bool)>(), "Electricity", "Roads"));
		}

		[Fact]
		public void TheDeepestNeededNodeNamesTheBranch()
		{
			Assert.Equal(
				("Nuclear Power Plant", "Nuclear.svg", 5),
				Progression.BranchOf(new[] { Needs(GasNode), Needs(NuclearNode) }, "Electricity", "Electricity"));
		}

		[Fact]
		public void AWayInThatIsNoNodeLeavesTheNeededNodeToDecide()
		{
			// With only the nodes it can weigh, the deeper way in would win. A milestone way in could
			// let the asset in first, so the needed node decides.
			Assert.Equal(
				("Nuclear Power Plant", "Nuclear.svg", 5),
				Progression.BranchOf(new[] { WayIn(NuclearNode), Needs(GasNode) }, "Electricity", "Electricity"));
			Assert.Equal(
				("Gas Power Plant", "Gas.svg", 2),
				Progression.BranchOf(new[] { WayIn(NuclearNode), Needs(GasNode), WayIn(Milestone) }, "Electricity", "Electricity"));
			// A milestone it needs is no way in, so it changes nothing.
			Assert.Equal(
				("Nuclear Power Plant", "Nuclear.svg", 5),
				Progression.BranchOf(new[] { WayIn(NuclearNode), Needs(GasNode), Needs(Milestone) }, "Electricity", "Electricity"));
		}

		[Fact]
		public void WithNoServiceTheMenuStandsIn()
		{
			// The asset's own service decides whose nodes are weighed; the deeper Parks node is set
			// aside when the menu names Electricity.
			var required = new[] { Needs(GasNode), Needs(ParkNode) };

			Assert.Equal(("Gas Power Plant", "Gas.svg", 2), Progression.BranchOf(required, null, "Electricity"));
			Assert.Equal(("Parks", "Parks.svg", 9), Progression.BranchOf(required, "Parks & Recreation", "Electricity"));
		}
	}
}
