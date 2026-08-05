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
