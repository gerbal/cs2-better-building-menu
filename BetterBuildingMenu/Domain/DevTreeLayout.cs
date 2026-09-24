using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Where a development-tree node is drawn.</summary>
	/// <param name="Node">The node's prefab entity index.</param>
	/// <param name="Service">The prefab entity index of the service whose tree it sits in.</param>
	/// <param name="Column">DevTreeNodePrefab.m_HorizontalPosition: 0 is the root's column.</param>
	/// <param name="Row">DevTreeNodePrefab.m_VerticalPosition.</param>
	public readonly record struct DevTreeNodePlace(int Node, int Service, int Column, float Row);

	/// <summary>The order of each service's dev-tree nodes, and the nodes drawn under another's tab.</summary>
	/// <remarks>See docs/indexing.md, "Dev tree branches".</remarks>
	public static class DevTreeLayout
	{
		/// <summary>Each node's rank within its own service's tree, by node.</summary>
		/// <remarks>
		/// The tree's own layout: column, then distance from the trunk row, then row, then the order
		/// given. The trunk is the row of the service's first node in column 0, which need not be
		/// zero. See docs/indexing.md, "Dev tree branches".
		/// </remarks>
		public static Dictionary<int, int> Rank(IEnumerable<DevTreeNodePlace> nodes)
		{
			var ranked = new Dictionary<int, int>();

			foreach (var service in nodes.GroupBy(node => node.Service))
			{
				var trunk = service
					.Where(node => node.Column == 0)
					.Select(node => node.Row)
					.DefaultIfEmpty(0f)
					.First();

				var ordered = service
					.OrderBy(node => node.Column)
					// Siblings in a column are drawn around the chain they hang off, so
					// measuring outward takes the generic before its specialisations.
					.ThenBy(node => Math.Abs(node.Row - trunk))
					.ThenBy(node => node.Row)
					.ToArray();

				for (var rank = 0; rank < ordered.Length; rank++)
				{
					ranked[ordered[rank].Node] = rank;
				}
			}

			return ranked;
		}

		/// <summary>Files each folded node under its target's branch, label, icon and rank.</summary>
		/// <param name="branches">Each node's branch, by node; changed in place.</param>
		/// <param name="nodesByName">Each node, by its dev tree NODE prefab name.</param>
		/// <param name="folds">Node name to the node name whose tab it is drawn under, applied in order.</param>
		/// <returns>The folds that matched nothing: a name no node has, or a target with no label. Each
		/// is a typo rather than a no-op, and nothing in the build can catch it.</returns>
		public static List<(string From, string Into)> Fold(
			IDictionary<int, (string Label, string Icon, int Depth, string Service)> branches,
			IReadOnlyDictionary<string, int> nodesByName,
			IEnumerable<KeyValuePair<string, string>> folds)
		{
			var unmatched = new List<(string From, string Into)>();

			foreach (var fold in folds)
			{
				if (nodesByName.TryGetValue(fold.Key, out var from)
					&& nodesByName.TryGetValue(fold.Value, out var into)
					&& branches.TryGetValue(into, out var target)
					&& target.Label.Length > 0)
				{
					branches[from] = target;
				}
				else
				{
					unmatched.Add((fold.Key, fold.Value));
				}
			}

			return unmatched;
		}
	}
}
