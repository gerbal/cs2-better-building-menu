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
		/// <param name="roots">Each service's free root, by service prefab name.</param>
		public ProgressionIndex(
			IReadOnlyDictionary<int, string> milestoneNames,
			IReadOnlyDictionary<int, (string Label, string Icon, int Depth, string Service)> branches,
			IReadOnlyDictionary<string, (string Label, string Icon, int Depth)> roots)
		{
			_milestoneNames = milestoneNames;
			_branches = branches;
			_roots = roots;
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

		/// <summary>The label the tree's root carries for a menu, or empty.</summary>
		/// <remarks>A sentinel more than a name: the adapter replaces it with what the MENU calls that
		/// bucket, which needs the whole set of ungated assets. See ProjectForMenu.</remarks>
		public string RootLabel(string? menu) =>
			TryGetRoot(menu, out var root) ? root.Label : string.Empty;
	}
}
