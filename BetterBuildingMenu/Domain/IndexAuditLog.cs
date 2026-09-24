using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;

using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain
{
	public enum AuditSeverity
	{
		Info,
		Warn,
	}

	/// <summary>One line of the index's audit logs, at the level it is logged at.</summary>
	public readonly record struct AuditLine(AuditSeverity Severity, string Text);

	/// <summary>
	/// The wording of the audit lines a full pass logs: the processor census and the menu
	/// audit and coverage.
	/// </summary>
	/// <remarks>
	/// Returned rather than logged, so a test can read them: anything that touches <c>Mod</c>
	/// cannot run in one (docs/ci.md). The indexer logs them in order. See docs/indexing.md,
	/// "The menu audit".
	/// </remarks>
	public static class IndexAuditLog
	{
		/// <summary>Eight names, then a comma and an ellipsis when there are more.</summary>
		/// <remarks>A long tail in these lines is a pattern, not a list to read.</remarks>
		public static string Cap(IReadOnlyList<string> names) =>
			string.Join(",", names.Take(8)) + (names.Count > 8 ? ",…" : string.Empty);

		/// <summary>How many prefabs each processor indexed, and how many of them the lens can show.</summary>
		/// <remarks>The lens shows buildings and networks, and whatever vanilla places in a menu. A
		/// processor whose every prefab is neither is indexing for nobody. In processor name order.</remarks>
		public static IEnumerable<AuditLine> ProcessorCensus(IReadOnlyDictionary<string, List<int>> census, CatalogIndex index)
		{
			foreach (var pair in census.OrderBy(pair => pair.Key, System.StringComparer.Ordinal))
			{
				var lens = pair.Value.Count(id =>
					index.All.TryGetValue(id, out var indexed)
					&& (indexed.Category is PrefabCategory.Buildings or PrefabCategory.ServiceBuildings or PrefabCategory.Networks
						|| index.Menus.IsPlaced(id)));

				yield return new AuditLine(AuditSeverity.Info, $"[PROCESSOR-CENSUS] {pair.Key} indexed={pair.Value.Count} lens={lens}");
			}
		}

		/// <summary>The menu audit's opening lines, logged before the DLC audit.</summary>
		public static IEnumerable<AuditLine> MenuAuditHeader(VanillaMenuAuditReport report, int indexedCount, int zoneCount)
		{
			yield return new AuditLine(
				AuditSeverity.Info,
				$"[MENU-AUDIT] {report.Menus.Count} vanilla menus, {report.PlacementCount} placements, "
				+ $"{indexedCount} indexed assets, {zoneCount} zones"
				+ (report.IsClean ? "" : " — NOT CLEAN"));

			// The reason goes next to the census, once, rather than living only in a
			// source comment nobody reading Modding.log can see.
			if (report.Menus.Any(line => line.ExpectedExtras.Count > 0))
			{
				yield return new AuditLine(AuditSeverity.Info, $"[MENU-AUDIT] expectedExtras: {VanillaMenuAudit.Divergences}");
			}
		}

		/// <summary>A line per vanilla menu, then a warning per menu we file under that vanilla has none of.</summary>
		public static IEnumerable<AuditLine> MenuAuditBody(VanillaMenuAuditReport report)
		{
			foreach (var line in report.Menus)
			{
				var text =
					$"[MENU-AUDIT] menu=\"{line.Menu}\" categories={line.Categories} vanilla={line.VanillaPlaces} "
					+ $"held={line.Held} missing={line.Missing.Count} ours={line.Ours}";

				if (line.Missing.Count > 0)
				{
					text += $" [{Cap(line.Missing)}]";
				}

				if (line.ExpectedExtras.Count > 0)
				{
					text += $" expectedExtras={line.ExpectedExtras.Count} [{Cap(line.ExpectedExtras)}]";
				}

				if (line.UnexplainedExtras.Count > 0)
				{
					text += $" UNEXPLAINED={line.UnexplainedExtras.Count} [{Cap(line.UnexplainedExtras)}]";
				}

				yield return new AuditLine(AuditSeverity.Info, text);
			}

			foreach (var menu in report.InventedMenus)
			{
				yield return new AuditLine(
					AuditSeverity.Warn,
					$"[MENU-AUDIT] menu=\"{menu}\" is not a vanilla menu at all, yet our assets claim it");
			}
		}

		/// <summary>A warning per tab with a gap, then the summary: Info with nothing missing, else Warn.</summary>
		public static IEnumerable<AuditLine> MenuCoverage(VanillaMenuCoverageReport report)
		{
			foreach (var line in report.Lines)
			{
				yield return new AuditLine(
					AuditSeverity.Warn,
					$"[MENU-COVERAGE] menu=\"{line.Menu}\" category=\"{line.Category}\" "
					+ $"vanilla={line.Vanilla} missing={line.Missing.Count} [{string.Join(",", line.Missing)}]"
					+ (line.Misplaced.Count == 0 ? string.Empty : $" misplaced=[{string.Join(",", line.Misplaced)}]"));
			}

			yield return new AuditLine(
				report.MissingCount == 0 ? AuditSeverity.Info : AuditSeverity.Warn,
				$"[MENU-COVERAGE] vanilla shows {report.PlacementCount} assets across its menus; "
				+ $"{report.MissingCount} missing from the index");
		}
	}
}
