using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Which development-tree branch an asset is filed under when more than one node gates it.</summary>
	/// <remarks>
	/// The requirements arrive in hash order, which follows entity numbering and moves when the
	/// installed content does, so the first match is an answer nobody chose. The rule is modelled on
	/// the game's UnlockSystem instead: an asset unlocks once every node it needs is bought, and one of
	/// its ways in. See docs/indexing.md, "Dev tree branches".
	/// </remarks>
	public static class DevTreeGates
	{
		/// <summary>One dev-tree node among an asset's requirements.</summary>
		/// <param name="Depth">The node's rank in its own service's tree layout. It stands for the order
		/// the player buys nodes in, exactly only along one chain: across services it says nothing.</param>
		/// <param name="Required">RequireAll: the asset needs it. Otherwise it is one of the asset's
		/// ways in (RequireAny).</param>
		/// <param name="Service">The service whose tree the node sits in.</param>
		public readonly record struct Gate(string Label, string Icon, int Depth, bool Required, string Service);

		/// <summary>
		/// The deepest node the asset needs, or its nearest way in when that is deeper, with a tie
		/// going to the needed node.
		/// </summary>
		/// <param name="service">The asset's own service. Its nodes are the only ones weighed when it
		/// has any, because depth only orders nodes within one tree.</param>
		/// <param name="otherWaysIn">Whether the asset has a way in that is not a node, such as a
		/// milestone.</param>
		/// <remarks>
		/// A way in the rule cannot weigh, one that is not a node or sits in another service's tree,
		/// could let the asset in first. Then the ways in it can weigh hold nothing back, and the
		/// deepest needed node decides. A lone way in needs no special case: the game treats it as
		/// needed, and the deeper of it and the needed nodes is already the deepest of them.
		/// </remarks>
		public static Gate? Pick(IEnumerable<Gate> gates, string? service, bool otherWaysIn)
		{
			var all = gates.ToList();
			var own = all.Where(gate => IsIn(gate, service)).ToList();
			var hiddenWayIn = otherWaysIn || (own.Count > 0 && all.Any(gate => !gate.Required && !IsIn(gate, service)));

			Gate? lastNeeded = null;
			Gate? firstWayIn = null;

			foreach (var gate in own.Count > 0 ? own : all)
			{
				if (gate.Required)
				{
					if (lastNeeded is null || Before(gate, lastNeeded.Value, deeperFirst: true))
					{
						lastNeeded = gate;
					}
				}
				else if (firstWayIn is null || Before(gate, firstWayIn.Value, deeperFirst: false))
				{
					firstWayIn = gate;
				}
			}

			if (lastNeeded is null)
			{
				return firstWayIn;
			}

			if (firstWayIn is null || hiddenWayIn)
			{
				return lastNeeded;
			}

			return firstWayIn.Value.Depth > lastNeeded.Value.Depth ? firstWayIn : lastNeeded;
		}

		private static bool IsIn(Gate gate, string? service) =>
			string.Equals(gate.Service, service, StringComparison.Ordinal);

		/// <summary>Whether <paramref name="a"/> is picked over <paramref name="b"/>: by depth, then by
		/// label, icon and service, so a tie never falls to collection order.</summary>
		private static bool Before(Gate a, Gate b, bool deeperFirst)
		{
			if (a.Depth != b.Depth)
			{
				return deeperFirst ? a.Depth > b.Depth : a.Depth < b.Depth;
			}

			var byLabel = string.CompareOrdinal(a.Label, b.Label);

			if (byLabel != 0)
			{
				return byLabel < 0;
			}

			var byIcon = string.CompareOrdinal(a.Icon, b.Icon);

			return byIcon != 0 ? byIcon < 0 : string.CompareOrdinal(a.Service, b.Service) < 0;
		}
	}
}
