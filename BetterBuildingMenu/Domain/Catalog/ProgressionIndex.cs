using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain.Catalog
{
	/// <summary>
	/// The progression as a full pass read it: every milestone's name, and each development-tree
	/// node's branch with each service's root.
	/// </summary>
	/// <remarks>
	/// Fixed once built; a new pass builds a new one. Nodes are keyed by their prefab entity's
	/// index. See docs/indexing.md, "Dev tree branches".
	/// </remarks>
	public sealed class ProgressionIndex
	{
		private readonly IReadOnlyDictionary<int, string> _milestoneNames;
		private readonly IReadOnlyDictionary<int, (string Label, string Icon, int Depth, string Service)> _branches;
		private readonly IReadOnlyDictionary<string, (string Label, string Icon, int Depth)> _roots;

		/// <summary>No milestones and no tree, as before the first pass.</summary>
		public static ProgressionIndex Empty { get; } = new(
			new Dictionary<int, string>(),
			new Dictionary<int, (string Label, string Icon, int Depth, string Service)>(),
			new Dictionary<string, (string Label, string Icon, int Depth)>());

		/// <param name="milestoneNames">Each milestone's name, by its index.</param>
		/// <param name="branches">The branch every dev-tree node files what it gates under, by node.
		/// A branch also names the service whose tree it sits in; see DevTreeGates.</param>
		/// <param name="roots">Each service's free root, by service prefab name, matched exactly
		/// whatever comparer the caller's dictionary has.</param>
		public ProgressionIndex(
			IReadOnlyDictionary<int, string> milestoneNames,
			IReadOnlyDictionary<int, (string Label, string Icon, int Depth, string Service)> branches,
			IReadOnlyDictionary<string, (string Label, string Icon, int Depth)> roots)
		{
			_milestoneNames = milestoneNames;
			_branches = branches;
			_roots = Exactly(roots);
		}

		/// <summary>The name the game gives a milestone index, or empty.</summary>
		public string MilestoneName(int index) =>
			_milestoneNames.TryGetValue(index, out var name) ? name : string.Empty;

		/// <summary>Every milestone name, dense by index.</summary>
		/// <remarks>Sized from the highest index present rather than probed from 0, which the game's
		/// first milestone need not use. Gaps stay empty so every later name keeps its own index.</remarks>
		public string[] MilestoneNames()
		{
			if (_milestoneNames.Count == 0)
			{
				return Array.Empty<string>();
			}

			var names = new string[Math.Max(0, _milestoneNames.Keys.Max()) + 1];

			for (var i = 0; i < names.Length; i++)
			{
				names[i] = MilestoneName(i);
			}

			return names;
		}

		/// <summary>The branch a dev-tree node files what it gates under.</summary>
		public bool TryGetBranch(int node, out (string Label, string Icon, int Depth, string Service) branch) =>
			_branches.TryGetValue(node, out branch);

		/// <summary>A service's free root, which names the bucket for everything its tree never gated.</summary>
		public bool TryGetRoot(string? service, out (string Label, string Icon, int Depth) root)
		{
			root = default;

			return service is not null && _roots.TryGetValue(service, out root);
		}

		/// <summary>The branch an asset is filed under: the node DevTreeGates.Pick chooses among its
		/// requirements, or its menu's root when none of them is a labelled node.</summary>
		/// <param name="required">The asset's unlock requirements: each one's prefab entity index, and
		/// whether the asset needs it (RequireAll) rather than having it as one way in.</param>
		/// <param name="service">The asset's own service, or null when it has none. Its menu stands
		/// in then: a mod that regroups the menus renames the menu, not the service.</param>
		/// <param name="menu">The menu the asset is filed under, which names its service's root.</param>
		public (string Label, string Icon, int Depth) BranchOf(
			IEnumerable<(int Requirement, bool Needed)> required,
			string? service,
			string? menu)
		{
			var gates = new List<DevTreeGates.Gate>();
			var otherWaysIn = false;

			foreach (var (requirement, needed) in required)
			{
				if (TryGetBranch(requirement, out var branch) && branch.Label.Length > 0)
				{
					gates.Add(new DevTreeGates.Gate(branch.Label, branch.Icon, branch.Depth, needed, branch.Service));
				}
				else if (!needed)
				{
					// A way in that is not a node, such as a milestone. UnlockSystem lets the
					// asset in through it as through any other.
					otherWaysIn = true;
				}
			}

			if (DevTreeGates.Pick(gates, service ?? menu, otherWaysIn) is { } gate)
			{
				return (gate.Label, gate.Icon, gate.Depth);
			}

			// No node gated it, so it belongs to the service's free root — the same
			// bucket the game puts the starting kit in. Named after the root node
			// rather than "Other": it is a real place in the tree.
			return TryGetRoot(menu, out var root)
				? root
				: (string.Empty, string.Empty, 0);
		}

		/// <summary>The label the tree's root carries for a menu, or empty.</summary>
		/// <remarks>A sentinel more than a name: the adapter replaces it with what the MENU calls that
		/// bucket, which needs the whole set of ungated assets. See ProjectForMenu.</remarks>
		public string RootLabel(string? menu) =>
			TryGetRoot(menu, out var root) ? root.Label : string.Empty;

		// Prefab names are exact: a menu that differs from its service only in case is
		// another menu. A copy, so that holds whoever built the dictionary.
		private static Dictionary<string, (string Label, string Icon, int Depth)> Exactly(
			IReadOnlyDictionary<string, (string Label, string Icon, int Depth)> byService)
		{
			var copy = new Dictionary<string, (string Label, string Icon, int Depth)>(StringComparer.Ordinal);

			foreach (var pair in byService)
			{
				copy[pair.Key] = pair.Value;
			}

			return copy;
		}
	}
}
