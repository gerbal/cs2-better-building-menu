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

		public static string ForCategory(PrefabCategory category, string? rawValue = null) =>
			ForEnum(category, rawValue, "Category");

		public static string ForSubCategory(PrefabSubCategory subCategory, string? rawValue = null) =>
			ForEnum(subCategory, rawValue, "Subcategory");

		private static string ForEnum<TEnum>(TEnum value, string? rawValue, string unknownEnumPrefix)
			where TEnum : struct, Enum
		{
			string enumIdentity = value.ToString();
			string raw = rawValue ?? enumIdentity;
			bool isUnknownEnumIdentity = string.Equals(raw, enumIdentity, StringComparison.Ordinal)
				&& !Enum.IsDefined(typeof(TEnum), value);
			return For(raw, isUnknownEnumIdentity ? unknownEnumPrefix : null);
		}

		// The game first, where it names the same concept: it ships these category labels in
		// every language, while the mod's Locale.json is English only. Each step runs only when
		// the one before found nothing; with no game running the display stays the fallback.
		private static string For(string rawValue, string? unknownEnumPrefix) =>
			LocaleHelper.TryTranslate(GameLocaleKeys.For(rawValue))
			?? LocaleHelper.TryTranslate($"Tooltip.LABEL[BetterBuildingMenu.{rawValue}]")
			?? Fallback(rawValue, unknownEnumPrefix);

		/// <summary>A theme's name in the player's language, or the split prefab name.</summary>
		public static string ForTheme(string theme) => GameNameOr(GameLocaleKeys.ForTheme(theme), theme);

		/// <summary>A building role's name in the player's language, or the split role id.</summary>
		public static string ForRole(string role) => GameNameOr(GameLocaleKeys.ForRole(role), role);

		private static string GameNameOr(string? gameKey, string identifier) =>
			LocaleHelper.TryTranslate(gameKey) ?? WordFormat.SplitIdentifier(identifier);

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
