using BetterBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The game's own zoning icon for a (family, tier) pair.
	/// </summary>
	/// <remarks>
	/// Vanilla ships one icon per pair, in the colours the zoning map paints, so the
	/// strip uses the marks a player already knows. Keyed on the pair, not the tier
	/// alone: "Low" sits under three families, each with its own icon.
	/// </remarks>
	public static class ZoneDensityIcons
	{
		private const string Root = "Media/Game/Icons/";

		/// <summary>
		/// Vanilla's own file names. "Row" is "MediumRow" in the game's vocabulary:
		/// row housing is a medium-density form.
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
		/// Empty rather than a guess: the strip falls back to the category's own icon,
		/// where a derived path like ZoneIndustrialLow would render as a silent hole.
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
