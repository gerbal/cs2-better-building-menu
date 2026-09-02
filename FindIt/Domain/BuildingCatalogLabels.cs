using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Utilities;

using System;
using System.Text;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// Converts the catalog's stable enum identities into localized labels for
	/// display. The raw values remain the query and diagnostic identities.
	/// </summary>
	public static class BuildingCatalogLabels
	{
		/// <summary>The heading for one density tier; empty for a zone with no tier.</summary>
		/// <remarks>
		/// The game's own words, taken off the zone names it ships — "Low
		/// Density Housing", "Medium Density Row Housing", "Mixed Housing",
		/// "Low Rent Housing" — with "Housing" trimmed, because the same tiers
		/// apply to commercial and office zones.
		///
		/// The only copy. The UI used to hold DENSITY_TIERS beside it, with a
		/// test reading the TypeScript to keep them agreeing; since the page
		/// carries its headings (BuildingCatalogGrouping.Labels) there is
		/// nothing on that side to agree with.
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
				// The game first, where it names the same concept. These labels
				// are the game's own categories, and it ships them in every
				// language it supports while the mod's Locale.json is English
				// only. A missing key falls through to exactly what was shown
				// before, so nothing regresses if the game renames one.
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
					$"Tooltip.LABEL[FindItBuildingMenu.{rawValue}]",
					fallback);
			}
			catch
			{
				// Pure catalog tests and early startup can run without an active game
				// localization manager. Keep the display deterministic in that case.
				return fallback;
			}
		}

		private static string Fallback(string rawValue, string? unknownEnumPrefix)
		{
			if (string.Equals(rawValue, "ServiceBuildings_EducationResearch", StringComparison.Ordinal))
			{
				return "Education & Research";
			}

			string formatted = FormatFacetWords(rawValue);
			return unknownEnumPrefix is null ? formatted : $"{unknownEnumPrefix} {formatted}";
		}

		private static string FormatFacetWords(string value)
		{
			if (string.IsNullOrWhiteSpace(value))
			{
				return value;
			}

			var label = new StringBuilder(value.Length + 8);
			for (int index = 0; index < value.Length; index++)
			{
				char current = value[index];
				if (current == '_' || current == '-')
				{
					if (label.Length > 0 && label[label.Length - 1] != ' ')
					{
						label.Append(' ');
					}

					continue;
				}

				char previous = index > 0 ? value[index - 1] : '\0';
				bool startsNewWord = index > 0
					&& ((char.IsUpper(current)
						&& (char.IsLower(previous)
							|| char.IsDigit(previous)
							|| (index + 1 < value.Length && char.IsUpper(previous) && char.IsLower(value[index + 1]))))
						|| (char.IsDigit(current) && !char.IsDigit(previous))
						|| (char.IsLetter(current) && char.IsDigit(previous)));
				if (startsNewWord && label.Length > 0 && label[label.Length - 1] != ' ')
				{
					label.Append(' ');
				}

				label.Append(current);
			}

			return label.ToString().Trim();
		}
	}
}
