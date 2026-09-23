using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Which development-tree branch an asset is filed under when more than one node gates it.</summary>
	/// <remarks>
	/// The requirements arrive in hash order, which follows entity numbering and moves when the
	/// installed content does, so the first match is an answer nobody chose. See docs/indexing.md,
	/// "Dev tree branches".
	/// </remarks>
	public static class DevTreeGates
	{
		/// <summary>One dev-tree node among an asset's requirements, and whether the asset needs it.</summary>
		/// <param name="Required">RequireAll: needed. Otherwise one of several ways in (RequireAny).</param>
		public readonly record struct Gate(string Label, string Icon, int Depth, bool Required);

		/// <summary>
		/// A node the asset needs before one of several ways in. Among needed nodes the one furthest
		/// into the tree, which the player buys last; among ways in the nearest, which they reach
		/// first. Then by label and icon, so a tie never falls to collection order.
		/// </summary>
		public static Gate? Pick(IEnumerable<Gate> gates)
		{
			Gate? best = null;

			foreach (var gate in gates)
			{
				if (best is null || Precedes(gate, best.Value))
				{
					best = gate;
				}
			}

			return best;
		}

		private static bool Precedes(Gate a, Gate b)
		{
			if (a.Required != b.Required)
			{
				return a.Required;
			}

			if (a.Depth != b.Depth)
			{
				return a.Required ? a.Depth > b.Depth : a.Depth < b.Depth;
			}

			var byLabel = string.CompareOrdinal(a.Label, b.Label);

			return byLabel != 0 ? byLabel < 0 : string.CompareOrdinal(a.Icon, b.Icon) < 0;
		}
	}
}
