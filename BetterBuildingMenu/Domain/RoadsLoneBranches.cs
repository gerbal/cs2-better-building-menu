using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Folds a Parking development branch of one building into Parking's largest branch.
	/// </summary>
	/// <remarks>
	/// Parking's dev tree gives the Underground and the Automated Parking Building a branch
	/// each, which grouping by category would draw as a sub-group per building. Parking only:
	/// in Roads' other categories a lone branch is a node of its own, such as Services' Road
	/// Zones, the base node, beside Advanced Road Services, and folding it would name a node
	/// that does not unlock it. For the same reason it runs only where the category heads the
	/// branches (CatalogView.Page); grouped by development, every building keeps its own node.
	/// </remarks>
	public static class RoadsLoneBranches
	{
		/// <summary>The Roads category whose lone branches fold.</summary>
		public const string ParkingCategory = "RoadsParking";

		public static IReadOnlyList<BuildingCatalogEntry> Fold(IReadOnlyList<BuildingCatalogEntry> entries, string? menu)
		{
			if (!VanillaMenus.IsRoads(menu))
			{
				return entries;
			}

			var hosts = new Dictionary<BuildingCatalogEntry, BuildingCatalogEntry>();

			var categories = entries
				.Where(entry => !string.IsNullOrEmpty(entry.DevTreeBranch))
				.GroupBy(entry => NetworkMenuExtension.EffectiveCategory(entry, menu) ?? string.Empty)
				.Where(category => string.Equals(category.Key, ParkingCategory, StringComparison.Ordinal));

			foreach (var category in categories)
			{
				var branches = category.GroupBy(entry => entry.DevTreeBranch, StringComparer.Ordinal).ToArray();

				if (branches.Length < 2)
				{
					continue;
				}

				// Largest first, then the game's own tree order, so the host is the same
				// branch on every rebuild.
				var host = branches
					.OrderByDescending(branch => branch.Count())
					.ThenBy(branch => branch.Min(entry => entry.DevTreeBranchDepth))
					.ThenBy(branch => branch.Key, StringComparer.Ordinal)
					.First()
					.First();

				foreach (var lone in branches.Where(branch => branch.Count() == 1 && branch.Key != host.DevTreeBranch))
				{
					hosts[lone.Single()] = host;
				}
			}

			if (hosts.Count == 0)
			{
				return entries;
			}

			return entries
				.Select(entry => hosts.TryGetValue(entry, out var host)
					? entry with
					{
						DevTreeBranch = host.DevTreeBranch,
						DevTreeBranchDepth = host.DevTreeBranchDepth,
						DevTreeBranchIcon = host.DevTreeBranchIcon,
					}
					: entry)
				.ToArray();
		}
	}
}
