using Colossal.Core;
using Colossal.Entities;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.Mathematics;
using Colossal.PSI.Common;
using Colossal.Serialization.Entities;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.Interfaces;
using BetterBuildingMenu.Utilities;

using Game;
using Game.City;
using Game.Common;
using Game.Companies;
using Game.Prefabs;
using Game.SceneFlow;
using Game.UI;
using Game.UI.InGame;

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;

using Unity.Collections;
using Unity.Entities;
using Unity.Mathematics;

namespace BetterBuildingMenu.Systems
{
	// Milestones, the development tree, and what an asset needs before it unlocks.
	public partial class PrefabIndexingSystem
	{
		/// <summary>Names every milestone once, so locked assets can carry a bare index.</summary>
		/// <remarks>Resolved here because the modding API's translate(id, fallback) takes no arguments
		/// and the game's milestone name is a lookup parameterised by index.</remarks>
		private void IndexMilestones()
		{
			var query = GetEntityQuery(
				ComponentType.ReadOnly<MilestoneData>(),
				ComponentType.ReadOnly<PrefabData>());
			var milestones = query.ToEntityArray(Allocator.Temp);
			var names = new Dictionary<int, string>();

			for (var i = 0; i < milestones.Length; i++)
			{
				if (EntityManager.TryGetComponent<MilestoneData>(milestones[i], out var data)
					&& _prefabSystem.TryGetPrefab<PrefabBase>(milestones[i], out var prefab))
				{
					names[data.m_Index] = GetMilestoneTitle(data.m_Index) ?? GetAssetName(prefab);
				}
			}

			_milestoneNames = names;
			Mod.Log.Info($"Indexed Milestones: {names.Count}");
		}

		/// <summary>The milestone's name in the game's own words, or null.</summary>
		/// <remarks>The key is parameterised by index, so translate(id, fallback) cannot reach it, and
		/// GetAssetName falls through to the prefab name — literally "Milestone7".</remarks>
		private static string? GetMilestoneTitle(int index) =>
			GameManager.instance.localizationManager.activeDictionary
				.TryGetValue($"Progression.MILESTONE_NAME:{index}", out var name)
					? name
					: null;

		/// <summary>Dev-tree nodes drawn under another node's tab.</summary>
		/// <remarks>A narrow exception to the rule that a node is its own branch, keyed on the prefab
		/// name rather than the localized label. See docs/indexing.md, "Dev tree branches".</remarks>
		private static readonly Dictionary<string, string> FoldedDevTreeNodes = new(StringComparer.Ordinal)
		{
			// DEV TREE NODE prefab names, not the asset names the locale carries.
			// A key that matches nothing warns rather than passing silently.
			["InternationalAirportNode"] = "AirportNode",
			["SpaceCenterNode"] = "AirportNode",
		};

		/// <summary>Maps every development-tree node to the label assets it gates are filed under.</summary>
		/// <remarks>The node ITSELF, ranked by the tree's own layout, with the free root taking the
		/// service's name. See docs/indexing.md, "Dev tree branches".</remarks>
		private void IndexDevTreeBranches()
		{
			var query = GetEntityQuery(
				ComponentType.ReadOnly<DevTreeNodeData>(),
				ComponentType.ReadOnly<PrefabData>());
			var nodes = query.ToEntityArray(Allocator.Temp);
			var branches = new Dictionary<Entity, (string Label, string Icon, int Depth, string Service)>();
			var roots = new Dictionary<string, (string Label, string Icon, int Depth)>();
			// Prefab name to node, so FoldedDevTreeNodes can be resolved once the
			// whole tree is known — a fold's target may be indexed after it.
			var nodesByName = new Dictionary<string, Entity>(StringComparer.Ordinal);

			// Ranked per service by the tree's OWN LAYOUT — column first, then
			// distance from the trunk row. The game lays its siblings out in a
			// deliberate order; any other tie-break invents one.
			var ranked = new Dictionary<Entity, int>();

			foreach (var service in nodes
				.Where(node => EntityManager.HasComponent<DevTreeNodeData>(node))
				.GroupBy(node => EntityManager.GetComponentData<DevTreeNodeData>(node).m_Service))
			{
				var placed = service
					.Select(node => (Node: node, Prefab: _prefabSystem.TryGetPrefab<PrefabBase>(node, out var pf) ? pf as DevTreeNodePrefab : null))
					.Where(pair => pair.Prefab is not null)
					.ToArray();

				// The row the service's chain runs along, taken from its root.
				// NOT zero: education's trunk sits at 1, with Technical above at
				// 0 and Medical below at 2.
				var trunk = placed
					.Where(pair => pair.Prefab!.m_HorizontalPosition == 0)
					.Select(pair => pair.Prefab!.m_VerticalPosition)
					.DefaultIfEmpty(0f)
					.First();

				var ordered = placed
					.OrderBy(pair => pair.Prefab!.m_HorizontalPosition)
					// Then by distance from that trunk. Siblings in a column are drawn
					// around the chain they hang off, so measuring outward takes the
					// generic before its specialisations.
					.ThenBy(pair => Math.Abs(pair.Prefab!.m_VerticalPosition - trunk))
					.ThenBy(pair => pair.Prefab!.m_VerticalPosition)
					.ToArray();

				for (var r = 0; r < ordered.Length; r++)
				{
					ranked[ordered[r].Node] = r;
				}
			}

			for (var i = 0; i < nodes.Length; i++)
			{
				var node = nodes[i];

				if (!_prefabSystem.TryGetPrefab<PrefabBase>(node, out var prefab))
				{
					continue;
				}

				var isRoot = !EntityManager.TryGetBuffer<DevTreeNodeRequirement>(node, true, out var reqs)
					|| reqs.Length == 0;
				var depth = ranked.TryGetValue(node, out var rank) ? rank : 0;

				// The node ITSELF, not the chain it hangs off: collapsing a chain to
				// the branch below the root files the Central Intelligence Bureau under
				// "Police Headquarters", a separate unlock the player buys separately.
				var rootLabel = isRoot ? RootBranchLabel(node) : string.Empty;

				// The service whose tree the node sits in: its rank only orders it within that tree.
				var service = EntityManager.TryGetComponent<DevTreeNodeData>(node, out var nodeData)
					&& _prefabSystem.TryGetPrefab<PrefabBase>(nodeData.m_Service, out var servicePrefab)
						? servicePrefab.name
						: string.Empty;

				branches[node] = isRoot
					? (rootLabel, DevTreeIcon(prefab), 0, service)
					: (DevTreeBranchName(prefab), DevTreeIcon(prefab), depth, service);

				nodesByName[prefab.name] = node;

				// The root also names the bucket for everything the tree never
				// gated, so it is recorded against its service.
				if (isRoot && service.Length > 0)
				{
					roots[service] = (rootLabel, DevTreeIcon(prefab), 0);
				}
			}

			// Applied after the walk: an asset gated by a folded node now reports
			// the target's branch, so it lands in that tab with the target's
			// label, icon and rank rather than opening one of its own.
			var folded = 0;

			foreach (var fold in FoldedDevTreeNodes)
			{
				if (nodesByName.TryGetValue(fold.Key, out var from)
					&& nodesByName.TryGetValue(fold.Value, out var into)
					&& branches.TryGetValue(into, out var target)
					&& target.Label.Length > 0)
				{
					branches[from] = target;
					folded++;
				}
				else
				{
					// A fold that matches nothing is a typo, not a no-op, and nothing in
					// the build or the tests can catch it.
					Mod.Log.Warn(
						$"[DEVTREE] fold '{fold.Key}' -> '{fold.Value}' matched no node; "
						+ "the key is a dev tree NODE prefab name, not an asset name");
				}
			}

			_devTreeBranches = branches;
			_devTreeRoots = roots;
			Mod.Log.Info($"Indexed Dev Tree: {nodes.Length} nodes, {roots.Count} services, {folded} folded");
		}

		/// <summary>The node's icon, resolved the way the game's own dev tree resolves it.</summary>
		/// <remarks>DevTreeUISystem.GetDevTreeIcon, transcribed: an explicit m_IconPath wins, else the
		/// thumbnail of the prefab the node points at, else empty rather than a placeholder glyph.</remarks>
		private string DevTreeIcon(PrefabBase prefab)
		{
			if (prefab is not DevTreeNodePrefab node)
			{
				return string.Empty;
			}

			if (!string.IsNullOrEmpty(node.m_IconPath))
			{
				return IconPath.Normalize(node.m_IconPath) ?? string.Empty;
			}

			return node.m_IconPrefab is not null
				? IconPath.Normalize(ImageSystem.GetThumbnail(node.m_IconPrefab)) ?? string.Empty
				: string.Empty;
		}

		/// <summary>What the service's free root node is called.</summary>
		/// <remarks>The SERVICE's name, because that is what the top bar already calls this bucket. The
		/// node itself has no localized title and would fall through to its prefab name.</remarks>
		private string RootBranchLabel(Entity node)
		{
			if (EntityManager.TryGetComponent<DevTreeNodeData>(node, out var data)
				&& _prefabSystem.TryGetPrefab<PrefabBase>(data.m_Service, out var service))
			{
				var name = GetAssetName(service);

				if (!string.IsNullOrEmpty(name))
				{
					return name;
				}
			}

			return "Basic";
		}

		/// <summary>The node's name, without the "Node" the prefab titles all carry.</summary>
		/// <remarks>An authoring artefact the player never sees in the dev tree, which draws the node
		/// under its icon, so it is dropped rather than repeated across every tab of the strip.</remarks>
		private string DevTreeBranchName(PrefabBase prefab)
		{
			var name = GetAssetName(prefab);

			return name.EndsWith(" Node", StringComparison.Ordinal)
				? name.Substring(0, name.Length - " Node".Length)
				: name;
		}

		/// <summary>The label the tree's root carries for a menu, or empty.</summary>
		/// <remarks>A sentinel more than a name: the adapter replaces it with what the MENU calls that
		/// bucket, which needs the whole set of ungated assets. See ProjectForMenu.</remarks>
		public static string GetDevTreeRootLabel(string? menu) =>
			menu is not null && _devTreeRoots.TryGetValue(menu, out var root) ? root.Label : string.Empty;

		/// <summary>The branch an asset's unlock node belongs to, or its service's root.</summary>
		/// <remarks>More than one node can gate an asset; DevTreeGates.Pick decides which names it,
		/// preferring the nodes of the asset's own service.</remarks>
		private (string Label, string Icon, int Depth) DevTreeBranchOf(
			Entity asset,
			IReadOnlyList<(Entity Requirement, UnlockFlags Flags)> required,
			string? menu)
		{
			// The asset's own service, else the one its menu is named after: a mod that
			// regroups the menus renames the menu, not the service.
			var service = EntityManager.TryGetComponent<ServiceObjectData>(asset, out var serviceObject)
				&& _prefabSystem.TryGetPrefab<PrefabBase>(serviceObject.m_Service, out var servicePrefab)
					? servicePrefab.name
					: menu;
			var gates = new List<DevTreeGates.Gate>();
			var otherWaysIn = false;

			foreach (var (requirement, flags) in required)
			{
				var needed = (flags & UnlockFlags.RequireAll) != 0;

				if (_devTreeBranches.TryGetValue(requirement, out var branch) && branch.Label.Length > 0)
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

			if (DevTreeGates.Pick(gates, service, otherWaysIn) is { } gate)
			{
				return (gate.Label, gate.Icon, gate.Depth);
			}

			// No node gated it, so it belongs to the service's free root — the same
			// bucket the game puts the starting kit in. Named after the root node
			// rather than "Other": it is a real place in the tree.
			return menu is not null && _devTreeRoots.TryGetValue(menu, out var root)
				? root
				: (string.Empty, string.Empty, 0);
		}

		/// <summary>The name the game gives a milestone index.</summary>
		public static string GetMilestoneName(int index) =>
			_milestoneNames.TryGetValue(index, out var name) ? name : string.Empty;

		/// <summary>Every milestone name, dense by index.</summary>
		/// <remarks>Sized from the highest index present rather than probed from 0, which the game's
		/// first milestone need not use. Gaps stay empty so every later name keeps its own index.</remarks>
		public static string[] GetMilestoneNames()
		{
			if (_milestoneNames.Count == 0)
			{
				return Array.Empty<string>();
			}

			var highest = 0;
			foreach (var index in _milestoneNames.Keys)
			{
				if (index > highest)
				{
					highest = index;
				}
			}

			var names = new string[highest + 1];
			for (var i = 0; i <= highest; i++)
			{
				names[i] = GetMilestoneName(i);
			}

			return names;
		}

		/// <summary>An asset's transitive unlock requirements, or none when nothing gates it.</summary>
		/// <remarks>The milestone, the requirement lines and the dev-tree branch all read this one set,
		/// so an asset indexed in full walks its requirements once.</remarks>
		private List<(Entity Requirement, UnlockFlags Flags)> CollectRequirements(Entity entity)
		{
			var collected = new List<(Entity Requirement, UnlockFlags Flags)>();

			if (!EntityManager.HasComponent<UnlockRequirement>(entity))
			{
				return collected;
			}

			var required = new NativeParallelHashMap<Entity, UnlockFlags>(10, Allocator.TempJob);

			try
			{
				ProgressionUtils.CollectSubRequirements(EntityManager, entity, required);

				foreach (var item in required)
				{
					collected.Add((item.Key, item.Value));
				}
			}
			finally
			{
				required.Dispose();
			}

			return collected;
		}

		/// <summary>What the game still wants before this asset can be built.</summary>
		private (int Milestone, string[] Requirements) GetUnlockRequirements(Entity entity) =>
			UnlockRequirementsOf(CollectRequirements(entity));

		/// <summary>The highest milestone the requirements need, and a line for each of the rest.</summary>
		/// <remarks>Mirrors PrefabUISystem.GetRequirements: take the highest milestone, and let
		/// everything else contribute its own localized title.</remarks>
		private (int Milestone, string[] Requirements) UnlockRequirementsOf(
			IReadOnlyList<(Entity Requirement, UnlockFlags Flags)> required)
		{
			var milestone = 0;
			var requirements = new List<string>();

			foreach (var (requirement, flags) in required)
			{
				// RequireAll, matching ProgressionUtils.GetRequiredMilestone:
				// a milestone reachable through a RequireAny branch is one of
				// several ways in, so it is not "the" milestone.
				if (EntityManager.TryGetComponent<MilestoneData>(requirement, out var milestoneData))
				{
					if ((flags & UnlockFlags.RequireAll) != 0 && milestoneData.m_Index > milestone)
					{
						milestone = milestoneData.m_Index;
					}

					continue;
				}

				// Tutorials are not a requirement the player can act on, and their
				// titles are internal. Vanilla special-cases them too:
				// BindUnlockRequirement tests m_TutorialRequirementEntity first.
				if (!_prefabSystem.TryGetPrefab<PrefabBase>(requirement, out var requirementPrefab)
					|| requirementPrefab is TutorialPrefab
					|| requirementPrefab is TutorialListPrefab
					|| requirementPrefab is TutorialBalloonPrefab)
				{
					continue;
				}

				var described = DescribeRequirement(requirement, requirementPrefab);

				if (!string.IsNullOrEmpty(described))
				{
					requirements.Add(described);
				}
			}

			return (milestone, requirements.Distinct().ToArray());
		}

		/// <summary>Says what a requirement actually asks of the player.</summary>
		/// <remarks>Composed from each requirement's own data, the way vanilla does it in PrefabUISystem,
		/// because the strings do not exist as data: requirement prefabs carry no localized title.</remarks>
		private string DescribeRequirement(Entity entity, PrefabBase prefab)
		{
			if (EntityManager.TryGetComponent<CitizenRequirementData>(entity, out var citizens))
			{
				if (citizens.m_MinimumPopulation > 0)
				{
					return Format("Requirement.POPULATION", "{0} population", citizens.m_MinimumPopulation.ToString("N0"));
				}

				return citizens.m_MinimumHappiness > 0
					? Format("Requirement.HAPPINESS", "{0} happiness", citizens.m_MinimumHappiness.ToString())
					: string.Empty;
			}

			if (EntityManager.TryGetComponent<ProcessingRequirementData>(entity, out var processing))
			{
				return Format(
					"Requirement.PROCESSING",
					"produce {0} {1}",
					processing.m_MinimumProducedAmount.ToString("N0"),
					processing.m_ResourceType.ToString());
			}

			if (EntityManager.TryGetComponent<ZoneBuiltRequirementData>(entity, out var zone))
			{
				var zoneName = _prefabSystem.TryGetPrefab<PrefabBase>(zone.m_RequiredZone, out var zonePrefab)
					? GetAssetName(zonePrefab)
					: string.Empty;

				// Squares and count are alternative measures of the same demand;
				// the game sets whichever it means, so report the one it set.
				if (zone.m_MinimumSquares > 0)
				{
					return Format("Requirement.ZONE_SQUARES", "{0} squares of {1}", zone.m_MinimumSquares.ToString("N0"), zoneName);
				}

				return zone.m_MinimumCount > 0
					? Format("Requirement.ZONE_COUNT", "{0} × {1}", zone.m_MinimumCount.ToString("N0"), zoneName)
					: zoneName;
			}

			// Only the STRICT variant names the object it wants. Plain
			// ObjectBuiltRequirementPrefab carries a count and no reference of any
			// kind, so it could only ever say "build 1" — worse than silence.
			if (prefab is StrictObjectBuiltRequirementPrefab strict && strict.m_Requirement is not null)
			{
				return Format(
					"Requirement.OBJECTS_BUILT",
					"build {0} × {1}",
					strict.m_MinimumCount.ToString("N0"),
					GetAssetName(strict.m_Requirement));
			}

			// The subject is authored text rather than a reference: every
			// requirement prefab carries m_LabelID and vanilla binds it. Asked after
			// the formatters that compose better, before the count-only branch.
			var authored = UnlockRequirementLabel.Resolve(
				(prefab as UnlockRequirementPrefab)?.m_LabelID,
				key => GameManager.instance.localizationManager.activeDictionary.TryGetValue(key, out var text) ? text : null);

			if (authored.Length > 0)
			{
				return authored;
			}

			if (EntityManager.TryGetComponent<ObjectBuiltRequirementData>(entity, out var objectBuilt))
			{
				// The prefab names what to build even though it references nothing:
				// "Subway Yard Built Req", "Bus Depot Built Req". These carry an empty
				// m_LabelID, so the name is the only subject there is.
				var subject = ObjectBuiltRequirement.SubjectOf(prefab.name);

				if (subject.Length == 0)
				{
					// A name that was only bookkeeping. Silence beats a subjectless
					// "build 1".
					return string.Empty;
				}

				return objectBuilt.m_MinimumCount > 1
					? Format("Requirement.OBJECTS_BUILT", "build {0} × {1}", objectBuilt.m_MinimumCount.ToString("N0"), subject)
					: Format("Requirement.OBJECT_BUILT", "build a {0}", subject);
			}

			// A dev tree node's own name is near-redundant beside the building it
			// unlocks. What the player cannot see from the card is where to go and
			// what it costs, so say that instead.
			if (prefab is DevTreeNodePrefab node)
			{
				var service = node.m_Service is not null ? GetAssetName(node.m_Service) : string.Empty;

				return node.m_Cost > 0
					? Format("Requirement.DEV_TREE_COST", "{0} tech, {1} pts", service, node.m_Cost.ToString())
					: Format("Requirement.DEV_TREE", "{0} tech", service);
			}

			return GetAssetName(prefab);
		}

		/// <summary>
		/// Localized requirement phrasing, falling back to the English shape.
		/// </summary>
		private static string Format(string key, string fallback, params string[] args)
		{
			var template = GameManager.instance.localizationManager.activeDictionary.TryGetValue(key, out var localized)
				? localized
				: fallback;

			for (var i = 0; i < args.Length; i++)
			{
				template = template.Replace("{" + i + "}", args[i]);
			}

			return template.Trim();
		}
	}
}
