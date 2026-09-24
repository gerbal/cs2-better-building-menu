using BetterBuildingMenu.Domain.Catalog;

using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	/// <summary>One tab of a vanilla menu that the index does not cover as the game does.</summary>
	/// <param name="Vanilla">How many assets the game places in the tab.</param>
	/// <param name="Missing">Each placed asset the index does not hold, as the caller described it.</param>
	/// <param name="Misplaced">Each placed asset the index holds under another category, as
	/// <c>PrefabName-&gt;Category</c>, or <c>-&gt;none</c>.</param>
	public sealed record VanillaMenuCoverageLine(
		string Menu,
		string Category,
		int Vanilla,
		IReadOnlyList<string> Missing,
		IReadOnlyList<string> Misplaced);

	/// <summary>Every tab with a gap, in menu then category order, and the totals.</summary>
	public sealed record VanillaMenuCoverageReport(
		IReadOnlyList<VanillaMenuCoverageLine> Lines,
		int PlacementCount,
		int MissingCount);

	/// <summary>
	/// Every asset the vanilla build menu shows that the index does not, tab by tab.
	/// </summary>
	/// <remarks>
	/// The per-tab counterpart of <see cref="VanillaMenuAudit"/>. See docs/indexing.md, "The menu
	/// audit".
	/// </remarks>
	public static class VanillaMenuCoverage
	{
		/// <param name="describeMissing">Why a placed asset is not held, asked only for those; the
		/// caller asks the game what the prefab is, which this cannot.</param>
		/// <remarks>
		/// An entry's id is its prefab entity's index, so matching is by identity, not by name.
		/// Zones reach the player through the zoning hierarchy rather than the index's lists, so
		/// they count as covered; left out, every one of them would read as lost.
		/// </remarks>
		public static VanillaMenuCoverageReport Compare(CatalogIndex index, Func<VanillaMenuPlacement, string> describeMissing)
		{
			var zoned = new HashSet<int>(index.Zones.Catalog.Select(zone => zone.Id));
			var missing = new Dictionary<string, List<string>>();
			var misplaced = new Dictionary<string, List<string>>();
			var shown = new Dictionary<string, int>();

			foreach (var placement in index.Menus.Placements.Values)
			{
				var where = placement.Menu + '\u0000' + placement.Category;

				shown.TryGetValue(where, out var count);
				shown[where] = count + 1;

				if (zoned.Contains(placement.Entity.Index))
				{
					continue;
				}

				if (index.All.TryGetValue(placement.Entity.Index, out var entry))
				{
					// Held, but filed under a different category than the tree puts it in,
					// so it is absent from this tab for a different reason.
					if (entry.UiCategoryName != placement.Category)
					{
						Add(misplaced, where, $"{entry.PrefabName}->{entry.UiCategoryName ?? "none"}");
					}

					continue;
				}

				Add(missing, where, describeMissing(placement));
			}

			var lines = new List<VanillaMenuCoverageLine>();
			var totalMissing = 0;

			foreach (var where in shown.Keys.OrderBy(key => key, StringComparer.Ordinal))
			{
				missing.TryGetValue(where, out var gaps);
				misplaced.TryGetValue(where, out var strays);

				totalMissing += gaps?.Count ?? 0;

				if ((gaps?.Count ?? 0) == 0 && (strays?.Count ?? 0) == 0)
				{
					continue;
				}

				var parts = where.Split('\u0000');

				lines.Add(new VanillaMenuCoverageLine(
					parts[0],
					parts[1],
					shown[where],
					(IReadOnlyList<string>?)gaps ?? Array.Empty<string>(),
					(IReadOnlyList<string>?)strays ?? Array.Empty<string>()));
			}

			return new VanillaMenuCoverageReport(lines, index.Menus.Placements.Count, totalMissing);

			static void Add(Dictionary<string, List<string>> into, string where, string what)
			{
				if (!into.TryGetValue(where, out var list))
				{
					list = new List<string>();
					into[where] = list;
				}

				list.Add(what);
			}
		}
	}
}
