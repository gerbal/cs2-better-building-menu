using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Utilities;

using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Converts the catalog's stable enum identities into localized labels for
	/// display. The raw values remain the query and diagnostic identities.
	/// </summary>
	public static class BuildingCatalogLabels
	{
		/// <summary>The heading for one density tier; empty for a zone with no tier.</summary>
		/// <remarks>
		/// The game's own words, taken off the zone names it ships, with "Housing"
		/// trimmed because the same tiers apply to commercial and office zones.
		/// </remarks>
		public static string DensityTier(ZoneTypeFilter density) => density switch
		{
			ZoneTypeFilter.Low => "Low Density",
			ZoneTypeFilter.Row => "Row Housing",
			ZoneTypeFilter.Medium => "Medium Density",
			ZoneTypeFilter.Mixed => "Mixed Housing",
			ZoneTypeFilter.LowRent => "Low Rent Housing",
			ZoneTypeFilter.High => "High Density",
			ZoneTypeFilter.Signature => "Signature",
			_ => string.Empty,
		};

		public static string ForCategory(PrefabCategory category, string? rawValue = null)
		{
			string enumIdentity = category.ToString();
			string value = rawValue ?? enumIdentity;
			bool isUnknownEnumIdentity = string.Equals(value, enumIdentity, StringComparison.Ordinal)
				&& !Enum.IsDefined(typeof(PrefabCategory), category);
			return For(value, isUnknownEnumIdentity ? "Category" : null);
		}

		public static string ForSubCategory(PrefabSubCategory subCategory, string? rawValue = null)
		{
			string enumIdentity = subCategory.ToString();
			string value = rawValue ?? enumIdentity;
			bool isUnknownEnumIdentity = string.Equals(value, enumIdentity, StringComparison.Ordinal)
				&& !Enum.IsDefined(typeof(PrefabSubCategory), subCategory);
			return For(value, isUnknownEnumIdentity ? "Subcategory" : null);
		}

		private static string For(string rawValue, string? unknownEnumPrefix)
		{
			string fallback = Fallback(rawValue, unknownEnumPrefix);
			try
			{
				// The game first, where it names the same concept: it ships these
				// category labels in every language, while the mod's Locale.json is
				// English only. A missing key falls through to the mod's own label.
				string? gameKey = GameLocaleKeys.For(rawValue);
				if (gameKey is not null)
				{
					string localized = LocaleHelper.Translate(gameKey, string.Empty);
					if (!string.IsNullOrWhiteSpace(localized))
					{
						return localized;
					}
				}

				return LocaleHelper.Translate(
					$"Tooltip.LABEL[BetterBuildingMenu.{rawValue}]",
					fallback);
			}
			catch
			{
				// Pure catalog tests and early startup can run without an active game
				// localization manager. Keep the display deterministic in that case.
				return fallback;
			}
		}

		/// <summary>A theme's name in the player's language, or the split prefab name.</summary>
		public static string ForTheme(string theme) => GameNameOr(GameLocaleKeys.ForTheme(theme), theme);

		/// <summary>A building role's name in the player's language, or the split role id.</summary>
		public static string ForRole(string role) => GameNameOr(GameLocaleKeys.ForRole(role), role);

		private static string GameNameOr(string? gameKey, string identifier)
		{
			string fallback = WordFormat.SplitIdentifier(identifier);
			try
			{
				string localized = gameKey is null ? string.Empty : LocaleHelper.Translate(gameKey, string.Empty);
				return string.IsNullOrWhiteSpace(localized) ? fallback : localized;
			}
			catch
			{
				// No localization manager in pure tests and early startup.
				return fallback;
			}
		}

		private static string Fallback(string rawValue, string? unknownEnumPrefix)
		{
			if (string.Equals(rawValue, "ServiceBuildings_EducationResearch", StringComparison.Ordinal))
			{
				return "Education & Research";
			}

			string formatted = WordFormat.SplitIdentifier(rawValue);
			return unknownEnumPrefix is null ? formatted : $"{unknownEnumPrefix} {formatted}";
		}
	}
}
