using System;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// Which zoning families the zone list is narrowed to.
	/// </summary>
	/// <remarks>
	/// The zoning view used to pick a family through a tab strip: one row of
	/// four icons, permanently on screen, expressing exactly one value. That is
	/// the same shape the scope and type strips had before the chip row replaced
	/// them, and it carries the same two costs — 27rem of chrome that cannot be
	/// spent on zones, and no way to look at residential and commercial zones
	/// side by side.
	///
	/// It is also the case least suited to an exclusive control. Office zones
	/// are <c>AreaType.Industrial</c> carrying <c>ZoneFlags.Office</c>, and
	/// density cuts across all four families, so "pick exactly one of R/C/I/O"
	/// asserts a partition the data does not have.
	///
	/// Empty means every family, not none: a filter nobody has touched should
	/// not hide anything.
	/// </remarks>
	public static class ZoneFamilySelection
	{
		/// <summary>
		/// Adds or removes one family, ignoring anything that is not a family.
		/// </summary>
		/// <remarks>
		/// The result keeps <see cref="ZoningSurfaceCatalog.Families"/> order
		/// rather than click order, so the chips read the same way as the
		/// vanilla Zones menu's tabs however the player arrived at them.
		/// </remarks>
		public static string[] Toggle(IEnumerable<string>? selected, string? family)
		{
			string[] current = Normalize(selected);

			if (string.IsNullOrWhiteSpace(family))
			{
				return current;
			}

			string trimmed = family.Trim();

			if (!IsKnown(trimmed))
			{
				// A family this build does not know about would become a chip
				// that filters everything away and cannot be reasoned about.
				return current;
			}

			return current.Any(entry => Matches(entry, trimmed))
				? current.Where(entry => !Matches(entry, trimmed)).ToArray()
				: Order(current.Append(trimmed));
		}

		/// <summary>
		/// Drops unknown, blank and duplicate entries and imposes family order.
		/// </summary>
		public static string[] Normalize(IEnumerable<string>? selected)
		{
			if (selected is null)
			{
				return Array.Empty<string>();
			}

			return Order(selected
				.Where(entry => !string.IsNullOrWhiteSpace(entry))
				.Select(entry => entry.Trim())
				.Where(IsKnown));
		}

		/// <summary>
		/// Whether a family should be shown. Empty selects everything.
		/// </summary>
		public static bool Includes(IEnumerable<string>? selected, string? family)
		{
			string[] current = Normalize(selected);

			if (current.Length == 0)
			{
				return true;
			}

			return !string.IsNullOrWhiteSpace(family)
				&& current.Any(entry => Matches(entry, family!.Trim()));
		}

		private static bool IsKnown(string family) =>
			ZoningSurfaceCatalog.Families.Any(known => Matches(known, family));

		private static bool Matches(string left, string right) =>
			string.Equals(left, right, StringComparison.OrdinalIgnoreCase);

		private static string[] Order(IEnumerable<string> families)
		{
			var distinct = new List<string>();

			foreach (string known in ZoningSurfaceCatalog.Families)
			{
				if (families.Any(entry => Matches(entry, known)))
				{
					distinct.Add(known);
				}
			}

			return distinct.ToArray();
		}
	}
}
