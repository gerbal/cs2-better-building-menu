using BetterBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The game's own zoning icon for a (family, tier) pair.
	/// </summary>
	/// <remarks>
	/// Vanilla ships one icon per pair — ZoneResidentialLowRent,
	/// ZoneCommercialHigh, ZoneResidentialMediumRow — in the same colours the
	/// zoning map paints. Those are the marks a player already associates with
	/// these zones, so the strip uses them rather than anything of ours.
	///
	/// Keyed on the pair, not on the tier alone: "Low" is a tab under
	/// Residential, Commercial AND Office, and the game draws a different icon
	/// for each. A tier-only lookup would put one glyph on all three.
	///
	/// Distinct from ZoneTypeOption's table, which is right to be tier-only:
	/// that row is a FILTER chip meaning "any low-density zone", a question
	/// about the tier itself rather than about one family's version of it.
	/// </remarks>
	public static class ZoneDensityIcons
	{
		private const string Root = "Media/Game/Icons/";

		/// <summary>
		/// Vanilla's own file names. "Row" is "MediumRow" in the game's
		/// vocabulary, which is also how it names the zone: row housing is a
		/// medium-density form.
		/// </summary>
		private static readonly Dictionary<string, string> Icons = new(StringComparer.OrdinalIgnoreCase)
		{
			["ZonesResidential|Low"] = "ZoneResidentialLow",
			["ZonesResidential|Row"] = "ZoneResidentialMediumRow",
			["ZonesResidential|Medium"] = "ZoneResidentialMedium",
			["ZonesResidential|Mixed"] = "ZoneResidentialMixed",
			["ZonesResidential|LowRent"] = "ZoneResidentialLowRent",
			["ZonesResidential|High"] = "ZoneResidentialHigh",
			["ZonesCommercial|Low"] = "ZoneCommercialLow",
			["ZonesCommercial|High"] = "ZoneCommercialHigh",
			["ZonesOffice|Low"] = "ZoneOfficeLow",
			["ZonesOffice|High"] = "ZoneOfficeHigh",
		};

		/// <summary>
		/// The icon for one tier tab, or empty when the game ships none.
		/// </summary>
		/// <remarks>
		/// Empty rather than a guess. The strip falls back to the category's own
		/// icon, which is a truthful "this family, some tier" — where a derived
		/// path like ZoneIndustrialLow, which does not exist, would render as a
		/// silent hole.
		/// </remarks>
		public static string For(string? uiCategory, ZoneTypeFilter density)
		{
			if (string.IsNullOrWhiteSpace(uiCategory) || density == ZoneTypeFilter.Any)
			{
				return string.Empty;
			}

			return Icons.TryGetValue($"{uiCategory!.Trim()}|{density}", out var name)
				? Root + name + ".svg"
				: string.Empty;
		}
	}
}
